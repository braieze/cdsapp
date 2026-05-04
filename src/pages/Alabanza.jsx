import { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  Music, Calendar, Clock, BookOpen, PlusCircle, 
  Search, Filter, ChevronRight, Mic2, Save, X,
  Youtube, ArrowUpCircle, ArrowDownCircle,
  PlayCircle, StopCircle, Flame, Sparkles, Lock, 
  ClipboardList, CheckCircle2, ChevronLeft, Loader2,
  Trash2, Edit3, ArrowLeft, Home, FileText, ListMusic, User, Settings
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, setDoc, 
  serverTimestamp, where, updateDoc, deleteDoc
} from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameWeek, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

// --- LÓGICA DEL TRANSPOSITOR ---
const scale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const getIndex = (c) => scale.indexOf(flatToSharp[c] || c);

const transposeChord = (chord, steps) => {
  if (!chord) return chord; // Seguro anti-crasheo (Evita el error 'match of undefined')
  const match = chord.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return chord;
  let root = match[1];
  const rest = match[2];
  if (flatToSharp[root]) root = flatToSharp[root];
  let index = scale.indexOf(root);
  if (index === -1) return chord;
  let newIndex = (index + steps) % 12;
  if (newIndex < 0) newIndex += 12;
  return scale[newIndex] + rest;
};

const getStepsDiff = (from, to) => {
  const i1 = getIndex(from);
  const i2 = getIndex(to);
  if (i1 === -1 || i2 === -1) return 0;
  return (i2 - i1 + 12) % 12;
};

const CATEGORIAS = ['Todas', 'Bienvenida', 'Fuego', 'Alabanza', 'Adoración', 'Ministración', 'Especial'];
const NOTAS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const MODIFICADORES = ['', 'm', '#', 'b', '7', 'm7'];

// Helper para compatibilidad de base de datos
const getSongId = (item) => typeof item === 'string' ? item : item.songId;

export default function Alabanza() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const [activeTab, setActiveTab] = useState('semanal');
  const [loading, setLoading] = useState(true);

  // Datos
  const [songs, setSongs] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todas');
  const [viewMonth, setViewMonth] = useState(new Date());

  // Modales y Visores
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [setlistSearchTerm, setSetlistSearchTerm] = useState(''); 
  
  // Setlist y Modo Ensayo
  const [activeSetlist, setActiveSetlist] = useState([]);
  const [currentSongIdx, setCurrentSongIdx] = useState(0);
  const [transposeSteps, setTransposeSteps] = useState(0);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [genderToggle, setGenderToggle] = useState('man'); 
  const [textSize, setTextSize] = useState('md'); // sm, md, lg
  const [showSettings, setShowSettings] = useState(false);

  // Metrónomo
  const [isPlayingMetro, setIsPlayingMetro] = useState(false);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);

  // Formulario Canción y Acordes
  const [songForm, setSongForm] = useState({ id: null, title: '', artist: '', keyMan: 'C', keyWoman: 'C', bpm: '', category: 'Adoración', link: '', content: '', songChords: '' });
  const textAreaRef = useRef(null);

  // Generar lista completa de acordes para el carrusel
  const allChords = useMemo(() => {
    const list = [];
    NOTAS.forEach(n => MODIFICADORES.forEach(m => list.push(n + m)));
    return list;
  }, []);

  // 🛡️ ACCESO
  const isPastor = dbUser?.role === 'pastor';
  const isAlabanza = dbUser?.area?.toLowerCase() === 'alabanza';
  const hasAccess = isPastor || isAlabanza;

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    const qSongs = query(collection(db, 'songs'), orderBy('title', 'asc'));
    const unsubSongs = onSnapshot(qSongs, (snap) => setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const qTeam = query(collection(db, 'users'), where('area', '==', 'alabanza'));
    const unsubTeam = onSnapshot(qTeam, (snap) => setTeamMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const qEvents = query(collection(db, 'alabanza_events'), orderBy('date', 'asc'));
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { unsubSongs(); unsubTeam(); unsubEvents(); };
  }, [hasAccess]);

  // --- METRÓNOMO AUDIO API ---
  const toggleMetronome = (bpm) => {
    if (isPlayingMetro) {
      clearInterval(timerRef.current);
      setIsPlayingMetro(false);
    } else {
      if (!bpm || bpm <= 0) return toast.error("La canción no tiene BPM");
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      setIsPlayingMetro(true);
      const interval = 60000 / bpm;
      let count = 0;
      
      playClick(count);
      count++;
      
      timerRef.current = setInterval(() => {
        playClick(count);
        count++;
      }, interval);
    }
  };

  const playClick = (count) => {
    if (!audioCtxRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    osc.frequency.value = (count % 4 === 0) ? 1000 : 800; 
    gainNode.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.1);
    osc.start(audioCtxRef.current.currentTime);
    osc.stop(audioCtxRef.current.currentTime + 0.1);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentSongIdx, activeSetlist]);

  // --- VISOR SETLIST & SLIDES (PAGINACIÓN INTELIGENTE CON TAMAÑO CONFIGURABLE) ---
  const changeSongIdx = (newIdx, list = activeSetlist) => {
    setCurrentSongIdx(newIdx);
    setTransposeSteps(0);
    setCurrentSlideIdx(0);
    const nextSong = list[newIdx];
    if (nextSong && nextSong.setlistConfig?.keyType) {
        setGenderToggle(nextSong.setlistConfig.keyType);
    } else {
        setGenderToggle('man');
    }
  };

  const openSongViewer = (songList, startIndex = 0) => {
    setActiveSetlist(songList);
    setIsPlayingMetro(false);
    setShowSettings(false);
    if (timerRef.current) clearInterval(timerRef.current);
    changeSongIdx(startIndex, songList);
  };

  const closeViewer = () => {
    setActiveSetlist([]);
    setIsPlayingMetro(false);
    setShowSettings(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const viewingSong = activeSetlist[currentSongIdx];
  
  const songSlides = useMemo(() => {
    if (!viewingSong) return [];
    const stanzas = viewingSong.content.split(/\n\s*\n/);
    const slides = [];
    let currentSlide = [];
    let currentLines = 0;
    
    const maxLines = textSize === 'sm' ? 14 : textSize === 'lg' ? 6 : 10;
    
    stanzas.forEach(stanza => {
       const linesCount = stanza.split('\n').length;
       if (currentLines + linesCount > maxLines && currentSlide.length > 0) {
           slides.push(currentSlide.join('\n\n'));
           currentSlide = [stanza];
           currentLines = linesCount;
       } else {
           currentSlide.push(stanza);
           currentLines += linesCount;
       }
    });
    if (currentSlide.length > 0) slides.push(currentSlide.join('\n\n'));
    return slides;
  }, [viewingSong, textSize]);

  const effectiveSteps = transposeSteps + (genderToggle === 'woman' ? getStepsDiff(viewingSong?.keyMan, viewingSong?.keyWoman) : 0);

  const handleNextSlide = () => {
    if (currentSlideIdx < songSlides.length - 1) setCurrentSlideIdx(p => p + 1);
  };
  const handlePrevSlide = () => {
    if (currentSlideIdx > 0) setCurrentSlideIdx(p => p - 1);
  };

  // --- ACCIONES PLANIFICACIÓN (CARRUSEL MES) ---
  const handleNextMonth = () => setViewMonth(addMonths(viewMonth, 1));
  const handlePrevMonth = () => setViewMonth(subMonths(viewMonth, 1));

  const generateMonth = async () => {
    const monthName = format(viewMonth, 'MMMM', { locale: es });
    if (!window.confirm(`¿Generar turnos vacíos para ${monthName}?`)) return;
    
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const days = eachDayOfInterval({ start, end });

    try {
      for (const day of days) {
        const dayOfWeek = getDay(day); 
        let type = '';
        if (dayOfWeek === 2) type = 'Culto Martes';
        if (dayOfWeek === 3) type = 'Ensayo / Devo';
        if (dayOfWeek === 5) type = 'Devocional';
        if (dayOfWeek === 6) type = 'Culto Sabado';

        if (type) {
          const eventId = format(day, 'yyyy-MM-dd');
          const docSnap = events.find(e => e.id === eventId);
          if (!docSnap) {
            await setDoc(doc(db, 'alabanza_events', eventId), {
              date: eventId,
              type,
              team: { teclado: '', bajo: '', bateria: '', electrica: '', acustica: '', voces: [], devo: '' },
              setlist: [],
              observations: ''
            });
          }
        }
      }
      toast.success(`Mes de ${monthName} generado`);
    } catch (e) { toast.error("Error al generar mes"); }
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'alabanza_events', editingEvent.id), editingEvent);
      setEditingEvent(null);
      toast.success("Plan actualizado");
    } catch (err) { toast.error("Error al guardar"); }
  };

  const handleDeleteEvent = async (eventId) => {
    if(!window.confirm("¿Seguro que querés borrar esta actividad?")) return;
    try {
      await deleteDoc(doc(db, 'alabanza_events', eventId));
      toast.success("Actividad borrada");
    } catch(e) { toast.error("Error al borrar"); }
  };

  // --- CRUD CANCIONES & ACORDES VIRTUALES ---
  const handleSaveSong = async () => {
    if (!songForm.title || !songForm.content) return toast.error("Título y letra son obligatorios");
    try {
      const songData = {
        title: songForm.title, artist: songForm.artist, 
        keyMan: songForm.keyMan || 'C', keyWoman: songForm.keyWoman || 'C', 
        bpm: Number(songForm.bpm) || 0, category: songForm.category, link: songForm.link, 
        content: songForm.content, songChords: songForm.songChords || '', updatedAt: serverTimestamp()
      };
      if (songForm.id) {
        await updateDoc(doc(db, 'songs', songForm.id), songData);
        toast.success("Canción actualizada");
      } else {
        await setDoc(doc(collection(db, 'songs')), { ...songData, createdAt: serverTimestamp() });
        toast.success("Canción creada");
      }
      setIsFormOpen(false);
    } catch (e) { toast.error("Error al guardar la canción"); }
  };

  const handleDeleteSong = async (id) => {
    if(!window.confirm("¿Estás seguro de borrar esta canción?")) return;
    try {
      await deleteDoc(doc(db, 'songs', id));
      setIsFormOpen(false);
      toast.success("Canción eliminada");
    } catch(e) { toast.error("Error al borrar"); }
  };

  const insertChord = (chord) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = songForm.content;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const chordStr = `[${chord}]`;
    
    setSongForm({...songForm, content: before + chordStr + after});
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + chordStr.length, start + chordStr.length);
    }, 0);
  };

  // 100% RENOVADO: Evita superposición, el acorde va arriba en su propia mini-columna
  const renderLyricsWithChords = (text, steps, size) => {
    const lines = text.split('\n');
    
    const sizeClasses = { sm: 'text-lg md:text-xl', md: 'text-xl md:text-2xl', lg: 'text-2xl md:text-3xl' };
    const chordSizeClasses = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' };

    return lines.map((line, idx) => {
      if (line.trim().match(/^\[?(intro|coro|verso|puente|pre-coro|instrumental|final)\]?:?/i)) {
        return <div key={idx} className="mt-8 mb-3 text-[11px] font-black text-brand-500 uppercase tracking-[0.2em] bg-brand-50 inline-block px-3 py-1 rounded-md">{line.replace(/\[|\]/g, '')}</div>;
      }

      const parts = line.split(/(\[[^\]]+\])/g);
      let hasChords = parts.some(p => p.startsWith('[') && p.endsWith(']'));
      
      // Si la línea no tiene acordes, la dibuja normal
      if (!hasChords) {
         return <div key={idx} className={`${sizeClasses[size]} font-bold text-slate-800 min-h-[2.5rem] whitespace-pre-wrap text-center`}>{line}</div>;
      }
      
      // Lógica estructural inteligente para separar acorde de sílaba y agruparlos en una mini columna (evita superposiciones)
      const segments = [];
      let currentChord = null;
      
      parts.forEach(part => {
        if (part.startsWith('[') && part.endsWith(']')) {
          if (currentChord) segments.push({ chord: currentChord, text: '' });
          currentChord = part.slice(1, -1);
        } else {
          segments.push({ chord: currentChord, text: part });
          currentChord = null;
        }
      });
      if (currentChord) segments.push({ chord: currentChord, text: '' });

      return (
        <div key={idx} className="flex flex-wrap items-end justify-center mb-5 w-full">
          {segments.map((seg, i) => (
            <div key={i} className="inline-flex flex-col items-start mx-[1px]">
              {/* PISO 1: EL ACORDE */}
              <span className={`text-brand-600 font-black leading-none min-h-[1.2em] ${chordSizeClasses[size]}`}>
                {seg.chord ? transposeChord(seg.chord, steps) : '\u200B'}
              </span>
              {/* PISO 2: LA LETRA ASOCIADA A ESE ACORDE */}
              <span className={`${sizeClasses[size]} font-bold text-slate-800 leading-tight mt-1 whitespace-pre-wrap text-left`}>
                {seg.text || '\u200B'}
              </span>
            </div>
          ))}
        </div>
      );
    });
  };

  // --- FILTROS ---
  const filteredSongs = songs.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'Todas' || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredSetlistSongs = songs.filter(s => s.title.toLowerCase().includes(setlistSearchTerm.toLowerCase()));

  const weeklyEvents = events.filter(ev => isSameWeek(new Date(ev.date + 'T00:00:00'), new Date(), { weekStartsOn: 1 }));
  const monthlyEvents = events.filter(ev => {
    const evDate = new Date(ev.date + 'T00:00:00');
    return evDate.getMonth() === viewMonth.getMonth() && evDate.getFullYear() === viewMonth.getFullYear();
  });

  const customChordsArr = (songForm.songChords || '').split(',').map(s => s.trim()).filter(Boolean);

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-outfit relative">
      {/* HEADER SUPERIOR CON NAVEGACIÓN */}
      <div className="px-5 pt-8 pb-4 bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3 text-left">
            <button onClick={() => navigate(-1)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 active:scale-90 transition-all"><ArrowLeft size={20}/></button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Alabanza</h1>
              <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1 flex items-center gap-1.5"><Sparkles size={12} /> Panel de Gestión</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/')} className="w-10 h-10 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center active:scale-90 transition-all"><Home size={18}/></button>
          </div>
        </div>

        <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
          {['semanal', 'mensual', 'cancionero'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-400'}`}>{tab}</button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-8">
        {/* =========================================
            PESTAÑA: SEMANAL 
        ============================================= */}
        {activeTab === 'semanal' && (
          <div className="animate-slide-up space-y-6">
            {weeklyEvents.length === 0 ? (
              <div className="py-20 text-center opacity-20"><Calendar size={48} className="mx-auto mb-4" /><p className="font-black text-xs uppercase">Sin actividades esta semana</p></div>
            ) : (
              weeklyEvents.map(ev => {
                const eventSongs = ev.setlist?.map(item => {
                  const songId = getSongId(item);
                  const s = songs.find(s => s.id === songId);
                  if(!s) return null;
                  return { ...s, setlistConfig: typeof item === 'string' ? { singer: '', keyType: 'man', notes: '' } : item };
                }).filter(Boolean) || [];

                return (
                  <div key={ev.id} className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-5">
                      <div className="text-left">
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md ${ev.type.includes('Culto') ? 'bg-brand-50 text-brand-600' : 'bg-indigo-50 text-indigo-600'}`}>{ev.type}</span>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mt-2">{format(new Date(ev.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleDeleteEvent(ev.id)} className="p-2 bg-rose-50 rounded-xl text-rose-400 active:scale-90"><Trash2 size={16}/></button>
                        <button onClick={() => setEditingEvent(ev)} className="p-2 bg-slate-50 rounded-xl text-slate-400 active:scale-90"><Edit3 size={16}/></button>
                      </div>
                    </div>
                    
                    {/* BANDA ASIGNADA */}
                    {(ev.type.includes('Culto') || ev.type.includes('Ensayo')) && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {['teclado', 'bajo', 'bateria', 'electrica', 'acustica'].map(role => ev.team[role] && (
                          <div key={role} className="flex items-center gap-2 text-left bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm">{role.substring(0,2).toUpperCase()}</div>
                            <p className="text-[10px] font-black text-slate-700 truncate">{ev.team[role]}</p>
                          </div>
                        ))}

                        {/* VOCES - MULTIPLE CHIPS */}
                        {ev.team.voces?.length > 0 && (
                          <div className="col-span-2 flex flex-col gap-2 text-left bg-indigo-50 p-3 rounded-xl border border-indigo-100 mt-1">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm shrink-0"><Mic2 size={12}/></div>
                                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Voces Asignadas</span>
                             </div>
                             <div className="flex flex-wrap gap-1.5 mt-1">
                                {ev.team.voces.map((v, i) => (
                                   <span key={i} className="bg-white text-indigo-700 border border-indigo-100 px-2.5 py-1.5 rounded-lg text-[10px] font-bold">
                                      {v}
                                   </span>
                                ))}
                             </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DEVOCIONAL */}
                    {ev.team.devo && (
                       <div className="flex items-center gap-2 text-left bg-amber-50 p-3 rounded-xl border border-amber-100 mb-4">
                         <BookOpen size={14} className="text-amber-600 shrink-0"/>
                         <p className="text-[10px] font-black text-amber-900 uppercase">Devocional: <span className="text-amber-600">{ev.team.devo}</span></p>
                       </div>
                    )}

                    {/* SETLIST DETALLADO */}
                    {eventSongs.length > 0 && (
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left mb-2 flex items-center justify-between">Setlist <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">Abrir Modo Ensayo</span></p>
                         {eventSongs.map((song, idx) => (
                           <div key={song.id} className="flex items-start gap-3 text-left p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer transition-colors active:scale-95" onClick={() => openSongViewer(eventSongs, idx)}>
                             <PlayCircle size={20} className="text-brand-500 shrink-0 mt-0.5" />
                             <div className="flex-1 min-w-0">
                                <span className="block text-xs font-black text-slate-800 uppercase tracking-tighter">{song.title}</span>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                   {song.setlistConfig.singer && (
                                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Mic2 size={8}/> {song.setlistConfig.singer}</span>
                                   )}
                                   <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">
                                      Tono: {song.setlistConfig.keyType === 'woman' ? song.keyWoman : song.keyMan}
                                   </span>
                                </div>
                                {song.setlistConfig.notes && (
                                   <p className="text-[9px] font-bold text-amber-600 mt-2 flex items-center gap-1"><FileText size={10}/> {song.setlistConfig.notes}</p>
                                )}
                             </div>
                           </div>
                         ))}
                      </div>
                    )}

                    {/* OBSERVACIONES GENERALES */}
                    {ev.observations && (
                      <div className="mt-4 p-3 bg-slate-50 border-l-4 border-slate-300 rounded-r-xl text-left">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Observaciones</p>
                         <p className="text-xs font-medium text-slate-700 italic">{ev.observations}</p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* =========================================
            PESTAÑA: MENSUAL 
        ============================================= */}
        {activeTab === 'mensual' && (
          <div className="animate-slide-up space-y-4">
            <div className="flex items-center justify-between bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-4">
              <button onClick={handlePrevMonth} className="p-3 bg-slate-50 rounded-xl text-slate-600 active:scale-90"><ChevronLeft size={18}/></button>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">{format(viewMonth, 'MMMM yyyy', { locale: es })}</h2>
              <button onClick={handleNextMonth} className="p-3 bg-slate-50 rounded-xl text-slate-600 active:scale-90"><ChevronRight size={18}/></button>
            </div>

            <button onClick={generateMonth} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-2 mb-6">
              <Calendar size={16} /> Generar Turnos de {format(viewMonth, 'MMMM', { locale: es })}
            </button>
            
            <div className="space-y-3">
              {monthlyEvents.length === 0 ? (
                <div className="text-center py-10 opacity-40"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No hay turnos creados este mes.</p></div>
              ) : (
                monthlyEvents.map(ev => (
                  <div key={ev.id} onClick={() => setEditingEvent(ev)} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
                     <div className="flex items-center gap-4 text-left">
                       <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex flex-col items-center justify-center shrink-0">
                          <span className="text-[8px] font-black uppercase">{format(new Date(ev.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                          <span className="text-lg font-black text-slate-900">{format(new Date(ev.date + 'T00:00:00'), 'dd')}</span>
                       </div>
                       <div>
                         <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{ev.type}</h4>
                         <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">
                           {ev.type === 'Devocional' ? `Resp: ${ev.team.devo || '?'}` : `${ev.setlist?.length || 0} canciones asignadas`}
                         </p>
                       </div>
                     </div>
                     <ChevronRight size={20} className="text-slate-300"/>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =========================================
            PESTAÑA: CANCIONERO 
        ============================================= */}
        {activeTab === 'cancionero' && (
          <div className="animate-slide-up space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 flex items-center px-4 gap-3 shadow-sm">
                <Search size={18} className="text-slate-400" />
                <input type="text" placeholder="Buscar canción..." className="w-full py-4 text-sm font-bold bg-transparent outline-none text-slate-800" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
               {CATEGORIAS.map(cat => (
                 <button key={cat} onClick={() => setActiveCategory(cat)} className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>
                   {cat}
                 </button>
               ))}
            </div>

            <div className="grid grid-cols-1 gap-3">
               {filteredSongs.length === 0 ? (
                 <div className="text-center py-20 opacity-30"><BookOpen size={48} className="mx-auto mb-4 text-slate-400"/><p className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400">Sin resultados</p></div>
               ) : (
                 filteredSongs.map(song => (
                   <div key={song.id} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-transform">
                      <div className="flex items-center gap-4 text-left min-w-0 flex-1 cursor-pointer" onClick={() => openSongViewer([song], 0)}>
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0"><span className="font-black text-lg">{song.keyMan || 'C'}</span></div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight truncate">{song.title}</h4>
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1 flex items-center gap-1.5 truncate"><Flame size={10} className="text-brand-500"/> {song.category} {song.bpm ? `• ${song.bpm} BPM` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button onClick={() => { setSongForm(song); setIsFormOpen(true); }} className="p-2 bg-slate-50 rounded-xl text-slate-400"><Edit3 size={16}/></button>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        )}
      </div>

      {activeTab === 'cancionero' && (
        <button onClick={() => { setSongForm({ id: null, title: '', artist: '', keyMan: 'C', keyWoman: 'C', bpm: '', category: 'Adoración', link: '', content: '', songChords: '' }); setIsFormOpen(true); }} className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[26px] shadow-2xl flex items-center justify-center active:scale-90 z-40 transition-all border-4 border-white"><PlusCircle size={32} /></button>
      )}

      {/* =============================================================
          MODAL 1: EDITAR ORGANIZACIÓN DEL DÍA (CULTOS/ENSAYOS)
      ================================================================= */}
      {editingEvent && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-end sm:items-center justify-center font-outfit">
          <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 max-h-[90vh] overflow-y-auto no-scrollbar animate-slide-up">
            <div className="flex justify-between items-center mb-8">
              <div className="text-left">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingEvent.type}</h2>
                <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mt-1">{format(new Date(editingEvent.date + 'T00:00:00'), "d 'de' MMMM", { locale: es })}</p>
              </div>
              <button onClick={() => setEditingEvent(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={24}/></button>
            </div>

            <form onSubmit={handleUpdateEvent} className="space-y-6 pb-6">
              
              {/* CULTO / ENSAYO: Toda la banda */}
              {(editingEvent.type.includes('Culto') || editingEvent.type.includes('Ensayo')) && (
                <>
                  <div className="text-left">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1 mb-2 flex items-center gap-2"><Mic2 size={12}/> Voces (Múltiple)</label>
                    <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      {teamMembers.map(m => {
                        const isSelected = editingEvent.team.voces?.includes(m.displayName);
                        return (
                          <button key={m.id} type="button" onClick={() => {
                            const current = editingEvent.team.voces || [];
                            const newVoces = isSelected ? current.filter(n => n !== m.displayName) : [...current, m.displayName];
                            setEditingEvent({...editingEvent, team: {...editingEvent.team, voces: newVoces}});
                          }} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>
                            {m.displayName.split(' ')[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {['teclado', 'bajo', 'bateria', 'electrica', 'acustica'].map(role => (
                      <div key={role} className="text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{role}</label>
                        <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" value={editingEvent.team[role] || ''} onChange={e => setEditingEvent({...editingEvent, team: {...editingEvent.team, [role]: e.target.value}})}>
                          <option value="">-</option>
                          {teamMembers.map(m => <option key={m.id} value={m.displayName}>{m.displayName}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* CONSTRUCTOR DE SETLIST DETALLADO */}
                  <div className="text-left border-t border-slate-100 pt-4">
                    <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-1 mb-3 flex items-center gap-2"><ListMusic size={12}/> Constructor de Setlist</label>
                    
                    <div className="flex items-center bg-slate-50 border border-slate-200 p-3 rounded-xl mb-3">
                       <Search size={16} className="text-slate-400 mr-2"/>
                       <input placeholder="Buscar para agregar..." value={setlistSearchTerm} onChange={e => setSetlistSearchTerm(e.target.value)} className="bg-transparent outline-none w-full text-xs font-bold" />
                    </div>

                    {setlistSearchTerm && (
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-1 mb-4 border-b border-slate-100 pb-4 no-scrollbar">
                        {filteredSetlistSongs.map(song => {
                          const isSelected = editingEvent.setlist.some(item => getSongId(item) === song.id);
                          return (
                            <div key={song.id} onClick={() => {
                                let newList = [...editingEvent.setlist];
                                if (isSelected) {
                                   newList = newList.filter(item => getSongId(item) !== song.id);
                                } else {
                                   newList.push({ songId: song.id, singer: '', keyType: 'man', notes: '' });
                                }
                                setEditingEvent({...editingEvent, setlist: newList});
                              }} className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${isSelected ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-white'}`}>
                              <div className="flex flex-col">
                                 <span className="text-xs font-black text-slate-700 uppercase truncate pr-2">{song.title}</span>
                                 <span className="text-[9px] text-slate-400 font-bold uppercase">{song.category}</span>
                              </div>
                              {isSelected ? <CheckCircle2 size={16} className="text-brand-600 shrink-0"/> : <PlusCircle size={16} className="text-slate-300 shrink-0"/>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* CANCIONES SELECCIONADAS (Mini Formulario por canción) */}
                    <div className="space-y-3 mt-4">
                       {editingEvent.setlist.map((item, idx) => {
                          const songId = getSongId(item);
                          const song = songs.find(s => s.id === songId);
                          if(!song) return null;
                          
                          // Convertir vieja data string a objeto por compatibilidad
                          const config = typeof item === 'string' ? { songId, singer: '', keyType: 'man', notes: '' } : item;

                          return (
                             <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm relative">
                                <button type="button" onClick={() => {
                                    const newList = [...editingEvent.setlist];
                                    newList.splice(idx, 1);
                                    setEditingEvent({...editingEvent, setlist: newList});
                                }} className="absolute top-3 right-3 text-rose-400 active:scale-90"><Trash2 size={14}/></button>
                                
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tighter mb-2 pr-6">{song.title}</h4>
                                
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                   <div>
                                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Canta (Principal)</label>
                                      <select value={config.singer} onChange={e => {
                                         const newList = [...editingEvent.setlist];
                                         newList[idx] = { ...config, singer: e.target.value };
                                         setEditingEvent({...editingEvent, setlist: newList});
                                      }} className="w-full bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10px] font-bold outline-none text-slate-700">
                                         <option value="">Nadie / Todos</option>
                                         {teamMembers.map(m => <option key={m.id} value={m.displayName}>{m.displayName}</option>)}
                                      </select>
                                   </div>
                                   <div>
                                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Tono a tocar</label>
                                      <select value={config.keyType} onChange={e => {
                                         const newList = [...editingEvent.setlist];
                                         newList[idx] = { ...config, keyType: e.target.value };
                                         setEditingEvent({...editingEvent, setlist: newList});
                                      }} className="w-full bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10px] font-bold outline-none text-slate-700">
                                         <option value="man">Hombre ({song.keyMan || 'C'})</option>
                                         <option value="woman">Mujer ({song.keyWoman || 'C'})</option>
                                      </select>
                                   </div>
                                </div>
                                <div>
                                   <input placeholder="Notas de ensayo (Ej: Solo acústico al principio)..." value={config.notes || ''} onChange={e => {
                                       const newList = [...editingEvent.setlist];
                                       newList[idx] = { ...config, notes: e.target.value };
                                       setEditingEvent({...editingEvent, setlist: newList});
                                   }} className="w-full bg-amber-50/50 border border-amber-100 p-2.5 rounded-lg text-[10px] font-bold outline-none placeholder:text-amber-300 text-amber-900" />
                                </div>
                             </div>
                          )
                       })}
                    </div>
                  </div>
                </>
              )}

              {/* ENSAYO: Observaciones */}
              {editingEvent.type.includes('Ensayo') && (
                <div className="text-left pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1 mb-2 flex items-center gap-2 mt-4"><FileText size={12}/> Observaciones del Ensayo</label>
                  <textarea placeholder="Ej: Faltó repasar el puente, voces del coro..." className="w-full p-4 bg-amber-50/50 border border-amber-100 rounded-2xl font-medium text-sm h-24 resize-none outline-none focus:border-amber-400" value={editingEvent.observations} onChange={e => setEditingEvent({...editingEvent, observations: e.target.value})} />
                </div>
              )}

              {/* DEVOCIONAL */}
              {(editingEvent.type === 'Devocional' || editingEvent.type.includes('Ensayo')) && (
                 <div className="text-left pt-2 border-t border-slate-100 mt-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block mt-4">Responsable Devocional</label>
                   <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" value={editingEvent.team.devo || ''} onChange={e => setEditingEvent({...editingEvent, team: {...editingEvent.team, devo: e.target.value}})}>
                     <option value="">-</option>
                     {teamMembers.map(m => <option key={m.id} value={m.displayName}>{m.displayName}</option>)}
                   </select>
                 </div>
              )}

              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl flex items-center justify-center gap-3 mt-4 active:scale-95 transition-transform">
                <Save size={18}/> Guardar Organización
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 2: NUEVA/EDITAR CANCIÓN
      ================================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col animate-slide-up h-[100dvh]">
          <div className="flex justify-between items-center p-5 border-b bg-white shrink-0 shadow-sm">
            <div className="text-left"><h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{songForm.id ? 'Editar Canción' : 'Nueva Canción'}</h2></div>
            <div className="flex gap-2">
              {songForm.id && <button onClick={() => handleDeleteSong(songForm.id)} className="p-3 bg-rose-50 rounded-full text-rose-500"><Trash2 size={18}/></button>}
              <button onClick={() => setIsFormOpen(false)} className="p-3 bg-slate-100 rounded-full text-slate-500"><X size={18}/></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 pb-48 text-left">
            <div className="space-y-4">
              <input placeholder="Título" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-lg outline-none focus:border-brand-500" value={songForm.title} onChange={e => setSongForm({...songForm, title: e.target.value})} />
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 flex items-center gap-1"><User size={10}/> Voz H.</label>
                   <input placeholder="C" className="w-full p-4 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-2xl font-black uppercase outline-none" value={songForm.keyMan} onChange={e => setSongForm({...songForm, keyMan: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 flex items-center gap-1"><User size={10}/> Voz M.</label>
                   <input placeholder="G" className="w-full p-4 bg-pink-50 text-pink-700 border border-pink-100 rounded-2xl font-black uppercase outline-none" value={songForm.keyWoman} onChange={e => setSongForm({...songForm, keyWoman: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Tempo</label>
                   <input placeholder="120" type="number" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black outline-none focus:border-brand-500" value={songForm.bpm} onChange={e => setSongForm({...songForm, bpm: e.target.value})} />
                </div>
              </div>

              {/* CAMPO DE ACORDES DE LA CANCIÓN */}
              <div className="mt-3">
                 <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-1 mb-1 block">Acordes de la canción (Separados por coma)</label>
                 <input placeholder="Ej: C, Dm, F, G..." className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black outline-none focus:border-brand-500 text-slate-800" value={songForm.songChords || ''} onChange={e => setSongForm({...songForm, songChords: e.target.value})} />
              </div>

              <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none" value={songForm.category} onChange={e => setSongForm({...songForm, category: e.target.value})}>
                {CATEGORIAS.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="relative">
                 <Youtube size={18} className="absolute top-4 left-4 text-rose-500" />
                 <input placeholder="Link YouTube/Spotify (Opcional)" className="w-full py-4 pl-12 pr-4 bg-rose-50 border border-rose-100 rounded-2xl font-bold text-sm outline-none focus:border-rose-400 text-rose-900" value={songForm.link} onChange={e => setSongForm({...songForm, link: e.target.value})} />
              </div>
              
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                 <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest leading-relaxed">
                   💡 TIP: Ubicá el cursor justo ANTES de la letra y tocá el acorde abajo. Ejemplo: E<span className="text-brand-600 font-bold bg-white px-1 rounded">[Dm]</span>TERNO
                 </p>
              </div>

              <textarea ref={textAreaRef} placeholder="Escribí la letra acá y usá el teclado flotante de abajo para insertar los acordes..." className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-medium text-[15px] h-[400px] resize-none outline-none leading-relaxed font-mono shadow-inner pb-32" value={songForm.content} onChange={e => setSongForm({...songForm, content: e.target.value})} />
            </div>
          </div>

          {/* TECLADO FLOTANTE HORIZONTAL COMPACTO */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 text-center mt-1">Deslizá para ver todos los acordes 👉</p>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-2 pb-2">
               
               {/* Acordes guardados por el usuario */}
               {customChordsArr.map((c, i) => (
                 <button key={`custom-${i}`} type="button" onClick={() => insertChord(c)} className="shrink-0 h-12 min-w-[3.5rem] px-3 bg-brand-50 text-brand-700 rounded-xl text-sm font-black transition-colors border border-brand-200 shadow-sm active:scale-90">
                   {c}
                 </button>
               ))}
               
               {customChordsArr.length > 0 && <div className="w-px h-8 bg-slate-300 mx-1 shrink-0"></div>}

               {/* Todos los demás acordes */}
               {allChords.map(c => (
                 <button key={c} type="button" onClick={() => insertChord(c)} className="shrink-0 h-12 min-w-[3.5rem] px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-black transition-colors border border-slate-200 shadow-sm active:scale-90">
                   {c}
                 </button>
               ))}
            </div>
            <button onClick={handleSaveSong} className="w-full mt-2 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl flex justify-center items-center gap-2"><Save size={18}/> Guardar Canción</button>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 3: VISOR SETLIST / PROYECTOR (PAGINADO)
      ================================================================= */}
      {viewingSong && (
        <div className="fixed inset-0 z-[300] bg-white flex flex-col animate-slide-up h-[100dvh] overflow-hidden">
          <div className="flex justify-between items-start p-5 bg-slate-900 text-white shrink-0 relative">
            <div className="text-left flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2">
                 <span className="bg-white/20 text-white px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest">{viewingSong.category}</span>
                 {viewingSong.setlistConfig?.notes && (
                    <span className="bg-amber-500 text-amber-900 px-2 py-1 rounded-md text-[8px] font-black uppercase flex items-center gap-1"><FileText size={8}/> Notas</span>
                 )}
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter truncate">{viewingSong.title}</h2>
              {activeSetlist.length > 1 && <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mt-1">Setlist: {currentSongIdx + 1} de {activeSetlist.length}</p>}
            </div>
            
            <div className="flex items-center gap-2">
               <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-white/10 rounded-full text-slate-300 active:scale-75 transition-all shrink-0"><Settings size={20}/></button>
               <button onClick={closeViewer} className="p-3 bg-white/10 rounded-full text-slate-300 active:scale-75 transition-all shrink-0"><X size={20}/></button>
            </div>

            {/* DROPDOWN DE CONFIGURACIÓN DE TEXTO */}
            {showSettings && (
               <div className="absolute top-20 right-5 bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-xl z-50 animate-slide-up">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Tamaño de Letra</p>
                  <div className="flex gap-2">
                     {['sm', 'md', 'lg'].map(s => (
                        <button key={s} onClick={() => { setTextSize(s); setShowSettings(false); }} className={`w-10 h-10 rounded-lg flex items-center justify-center font-black transition-colors ${textSize === s ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                           {s === 'sm' ? 'A' : s === 'md' ? 'A+' : 'A++'}
                        </button>
                     ))}
                  </div>
               </div>
            )}
          </div>

          {viewingSong.setlistConfig?.notes && (
             <div className="bg-amber-400 text-amber-900 px-5 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shrink-0">
                <FileText size={14} className="shrink-0"/>
                <span className="truncate">{viewingSong.setlistConfig.notes}</span>
             </div>
          )}

          <div className="bg-slate-800 p-3 flex gap-2 shrink-0 shadow-md z-10">
            {/* SELECTOR DE VOZ (HOMBRE/MUJER) Y TRANSPOSITOR */}
            <div className="flex-[1.5] bg-slate-900/50 rounded-xl p-2 flex flex-col border border-slate-700 justify-between">
              <div className="flex bg-slate-800 rounded-lg p-1 mb-2">
                <button onClick={() => setGenderToggle('man')} className={`flex-1 text-[9px] font-black uppercase tracking-widest py-1.5 rounded-md transition-colors ${genderToggle === 'man' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>Hombre</button>
                <button onClick={() => setGenderToggle('woman')} className={`flex-1 text-[9px] font-black uppercase tracking-widest py-1.5 rounded-md transition-colors ${genderToggle === 'woman' ? 'bg-pink-500 text-white' : 'text-slate-400'}`}>Mujer</button>
              </div>
              <div className="flex items-center justify-between px-1">
                <button onClick={() => setTransposeSteps(p => p - 1)} className="w-8 h-8 rounded-md bg-slate-700 text-white flex items-center justify-center active:scale-95 transition-transform"><ArrowDownCircle size={16}/></button>
                <div className="text-center"><span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest">Tono Actual</span><span className="block text-lg font-black text-white">{transposeChord(viewingSong.keyMan, effectiveSteps)}</span></div>
                <button onClick={() => setTransposeSteps(p => p + 1)} className="w-8 h-8 rounded-md bg-slate-700 text-white flex items-center justify-center active:scale-95 transition-transform"><ArrowUpCircle size={16}/></button>
              </div>
            </div>

            {/* METRÓNOMO */}
            <div className="flex-1 bg-slate-900/50 rounded-xl p-2 flex flex-col justify-center items-center border border-slate-700">
               <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Metrónomo</span>
               <div className="flex items-center gap-3">
                 <span className="block text-xl font-black text-white">{viewingSong.bpm || '--'}</span>
                 <button onClick={() => toggleMetronome(viewingSong.bpm)} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all ${isPlayingMetro ? 'bg-rose-500 shadow-rose-500/50 animate-pulse' : 'bg-brand-600 shadow-brand-500/50'}`}>
                   {isPlayingMetro ? <StopCircle size={20} className="text-white"/> : <PlayCircle size={20} className="text-white"/>}
                 </button>
               </div>
            </div>
          </div>

          {/* ÁREA DE LETRA PAGINADA CON TAP ZONES */}
          <div className="flex-1 relative bg-[#fdfdfd] overflow-hidden flex items-center justify-center">
             {/* ZONAS DE TOQUE INVISIBLES */}
             <div className="absolute left-0 top-0 bottom-0 w-1/2 z-10" onClick={handlePrevSlide}></div>
             <div className="absolute right-0 top-0 bottom-0 w-1/2 z-10" onClick={handleNextSlide}></div>
             
             <div className="p-8 w-full max-w-2xl transition-all duration-300 pointer-events-none">
               {renderLyricsWithChords(songSlides[currentSlideIdx] || '', effectiveSteps, textSize)}
             </div>

             {/* INDICADOR DE PAGINACIÓN */}
             <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1 z-20 pointer-events-none">
               {songSlides.map((_, i) => (
                 <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentSlideIdx ? 'w-6 bg-brand-500' : 'w-1.5 bg-slate-200'}`}></div>
               ))}
             </div>
          </div>

          {/* NAVEGACIÓN DE SETLIST */}
          {activeSetlist.length > 1 && (
            <div className="bg-slate-900 p-4 flex items-center gap-4 border-t border-slate-800 shrink-0 z-20 relative">
              <button onClick={() => { if(currentSongIdx > 0) changeSongIdx(currentSongIdx - 1) }} className={`p-4 rounded-2xl flex items-center justify-center transition-all ${currentSongIdx === 0 ? 'opacity-30' : 'bg-slate-800 text-white active:scale-90'}`}><ChevronLeft size={24} /></button>
              <div className="flex-1 text-center min-w-0">
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{currentSongIdx < activeSetlist.length - 1 ? 'SIGUIENTE CANCIÓN' : 'FIN DEL SETLIST'}</span>
                <span className="block text-sm font-black text-white truncate mt-1">{currentSongIdx < activeSetlist.length - 1 ? activeSetlist[currentSongIdx+1].title : '-'}</span>
              </div>
              <button onClick={() => { if(currentSongIdx < activeSetlist.length - 1) changeSongIdx(currentSongIdx + 1) }} className={`p-4 rounded-2xl flex items-center justify-center transition-all ${currentSongIdx === activeSetlist.length - 1 ? 'opacity-30' : 'bg-brand-600 text-white active:scale-90'}`}><ChevronRight size={24} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}