import { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  Music, Calendar, Clock, BookOpen, PlusCircle, 
  Search, Filter, ChevronRight, Mic2, Save, X,
  Youtube, ArrowUpCircle, ArrowDownCircle,
  PlayCircle, StopCircle, Flame, Sparkles, Lock, 
  ClipboardList, CheckCircle2, ChevronLeft, Loader2,
  Trash2, Edit3, ArrowLeft, Home, FileText, ListMusic, User, Settings, Check
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, setDoc, 
  serverTimestamp, where, updateDoc, deleteDoc, getDocs
} from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameWeek, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

// --- LÓGICA DEL TRANSPOSITOR CORREGIDA ---
const scale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const getIndex = (c) => {
  if (!c || typeof c !== 'string') return -1;
  const match = c.trim().match(/^([a-gA-G][b#B]?)/);
  if (!match) return -1;
  let root = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  if (root.length === 2 && root[1].toUpperCase() === 'B') root = root[0] + 'b';
  return scale.indexOf(flatToSharp[root] || root);
};

const transposeChord = (chord, steps) => {
  if (!chord || typeof chord !== 'string') return chord;
  const match = chord.trim().match(/^([a-gA-G][b#B]?)(.*)$/);
  if (!match) return chord;
  let root = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  if (root.length === 2 && root[1].toUpperCase() === 'B') root = root[0] + 'b';
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

const getSongId = (item) => typeof item === 'string' ? item : item.songId;

export default function MinisterioMusical() {
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
  const [textSize, setTextSize] = useState('sm');
  const [showSettings, setShowSettings] = useState(false);

  // Metrónomo
  const [isPlayingMetro, setIsPlayingMetro] = useState(false);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);

  // Formulario Canción
  const [songForm, setSongForm] = useState({ id: null, title: '', artist: '', keyMan: 'C', keyWoman: 'C', bpm: '', category: 'Adoración', link: '', content: '', songChords: '', baseTone: 'man' });
  const textAreaRef = useRef(null);

  const allChords = useMemo(() => {
    const list = [];
    NOTAS.forEach(n => MODIFICADORES.forEach(m => list.push(n + m)));
    return list;
  }, []);

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

  // --- VISOR SETLIST & SLIDES ---
  const changeSongIdx = (newIdx, list = activeSetlist) => {
    setCurrentSongIdx(newIdx);
    setTransposeSteps(0);
    setCurrentSlideIdx(0);
    const nextSong = list[newIdx];
    if (nextSong && nextSong.setlistConfig?.keyType) {
        setGenderToggle(nextSong.setlistConfig.keyType);
    } else {
        setGenderToggle(nextSong?.baseTone || 'man');
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

  const baseKey = viewingSong?.baseTone === 'woman' ? viewingSong?.keyWoman : viewingSong?.keyMan;
  const targetKey = genderToggle === 'woman' ? viewingSong?.keyWoman : viewingSong?.keyMan;
  const genderSteps = getStepsDiff(baseKey, targetKey);
  const effectiveSteps = transposeSteps + genderSteps;

  const handleNextSlide = () => {
    if (currentSlideIdx < songSlides.length - 1) setCurrentSlideIdx(p => p + 1);
  };
  const handlePrevSlide = () => {
    if (currentSlideIdx > 0) setCurrentSlideIdx(p => p - 1);
  };

  // --- ACCIONES PLANIFICACIÓN ---
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

  // ✅ MAGIA: SINCRONIZACIÓN AUTOMÁTICA CON LA AGENDA GENERAL
  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    try {
      // 1. Guarda en Alabanza
      await updateDoc(doc(db, 'alabanza_events', editingEvent.id), editingEvent);
      
      // 2. Sincroniza con la Agenda General (Events)
      const qEvents = query(collection(db, 'events'), where('date', '==', editingEvent.date));
      const snap = await getDocs(qEvents);
      
      if (!snap.empty) {
        const mainEventDoc = snap.docs[0];
        const mainEventData = mainEventDoc.data();
        const currentAssignments = mainEventData.assignments || {};

        // Mapea el equipo de alabanza al formato de la Agenda
        const newAssignments = {
          ...currentAssignments,
          vocalistas: editingEvent.team.voces || [],
          teclado: editingEvent.team.teclado ? [editingEvent.team.teclado] : [],
          bajo: editingEvent.team.bajo ? [editingEvent.team.bajo] : [],
          bateria: editingEvent.team.bateria ? [editingEvent.team.bateria] : [],
          g_electrica: editingEvent.team.electrica ? [editingEvent.team.electrica] : [],
          g_acustica: editingEvent.team.acustica ? [editingEvent.team.acustica] : [],
        };

        // Limpia arrays vacíos
        Object.keys(newAssignments).forEach(k => {
          if (Array.isArray(newAssignments[k]) && newAssignments[k].length === 0) {
            delete newAssignments[k];
          }
        });

        await updateDoc(doc(db, 'events', mainEventDoc.id), { assignments: newAssignments });
      }

      setEditingEvent(null);
      toast.success("Organización guardada y sincronizada con Agenda");
    } catch (err) { toast.error("Error al guardar"); }
  };

  const handleDeleteEvent = async (eventId) => {
    if(!window.confirm("¿Seguro que querés borrar esta actividad?")) return;
    try {
      await deleteDoc(doc(db, 'alabanza_events', eventId));
      toast.success("Actividad borrada");
    } catch(e) { toast.error("Error al borrar"); }
  };

  // --- CRUD CANCIONES & ACORDES ---
  const handleSaveSong = async () => {
    if (!songForm.title || !songForm.content) return toast.error("Título y letra son obligatorios");
    try {
      const songData = {
        title: songForm.title, artist: songForm.artist, 
        keyMan: songForm.keyMan || 'C', keyWoman: songForm.keyWoman || 'C', 
        bpm: Number(songForm.bpm) || 0, category: songForm.category, link: songForm.link, 
        content: songForm.content, songChords: songForm.songChords || '', baseTone: songForm.baseTone || 'man', updatedAt: serverTimestamp()
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

  const renderLyricsWithChords = (text, steps, size) => {
    const lines = text.split('\n');
    const sizeClasses = { sm: 'text-sm md:text-base', md: 'text-base md:text-lg', lg: 'text-lg md:text-xl' };
    const chordSizeClasses = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };

    return lines.map((line, idx) => {
      if (line.trim().match(/^\[?(intro|coros?|versos?|puente|pre-coro|instrumental|final|solo)\]?:?/i)) {
        return <div key={idx} className="mt-6 mb-1 font-bold text-slate-900 text-left capitalize text-lg">{line.replace(/\[|\]/g, '')}</div>;
      }
      const parts = line.split(/(\[[^\]]+\])/g);
      let hasChords = parts.some(p => p.startsWith('[') && p.endsWith(']'));
      if (!hasChords) {
         return <div key={idx} className={`${sizeClasses[size]} font-medium text-slate-800 min-h-[1.5rem] whitespace-pre-wrap break-words text-left`}>{line}</div>;
      }
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
        <div key={idx} className="flex flex-wrap items-end justify-start mb-4 w-full text-left">
          {segments.map((seg, i) => (
            <div key={i} className="inline-flex flex-col items-start min-w-[0.3rem]">
              <span className={`text-[#aa8e4a] font-bold leading-none min-h-[1.2em] ${chordSizeClasses[size]}`}>
                {seg.chord ? transposeChord(seg.chord, steps) : '\u200B'}
              </span>
              <span className={`${sizeClasses[size]} font-medium text-slate-800 leading-tight whitespace-pre-wrap break-words text-left max-w-full`}>
                {seg.text || '\u200B'}
              </span>
            </div>
          ))}
        </div>
      );
    });
  };

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

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-sans relative">
      
      {/* 🚀 HEADER SOCIALYO */}
      <div className="px-5 pt-8 pb-4 bg-white border-b border-slate-100 sticky top-0 z-30 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex justify-between items-center mb-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 text-left">
            <button onClick={() => navigate(-1)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600 active:scale-90 transition-all hover:bg-slate-100 border border-slate-100"><ChevronLeft size={24}/></button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">Ministerio Musical</h1>
            </div>
          </div>
        </div>

        {/* 🚀 TABS PASTILLERO SOCIALYO */}
        <div className="flex p-1.5 bg-slate-50 border border-slate-100 rounded-full max-w-md mx-auto shadow-inner">
          {['semanal', 'mensual', 'canciones'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-full text-xs font-bold capitalize transition-all duration-300 ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab === 'canciones' ? 'Canciones' : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6 max-w-md mx-auto">
        {/* =========================================
            PESTAÑA: SEMANAL 
        ============================================= */}
        {activeTab === 'semanal' && (
          <div className="animate-slide-up space-y-5">
            {weeklyEvents.length === 0 ? (
              <div className="py-20 text-center opacity-40"><Calendar size={40} className="mx-auto mb-3 text-slate-400" /><p className="font-semibold text-sm text-slate-500">Sin actividades esta semana</p></div>
            ) : (
              weeklyEvents.map(ev => {
                const eventSongs = ev.setlist?.map(item => {
                  const songId = getSongId(item);
                  const s = songs.find(s => s.id === songId);
                  if(!s) return null;
                  return { ...s, setlistConfig: typeof item === 'string' ? { singer: '', keyType: 'man', notes: '' } : item };
                }).filter(Boolean) || [];

                return (
                  <div key={ev.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative overflow-hidden">
                    <div className="flex justify-between items-start mb-5">
                      <div className="text-left">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${ev.type.includes('Culto') ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>{ev.type}</span>
                        <h3 className="text-lg font-bold text-slate-900 mt-2">{format(new Date(ev.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingEvent(ev)} className="w-9 h-9 bg-slate-50 rounded-full text-slate-400 flex items-center justify-center hover:text-blue-600 transition-colors"><Edit3 size={16}/></button>
                        <button onClick={() => handleDeleteEvent(ev.id)} className="w-9 h-9 bg-slate-50 rounded-full text-slate-400 flex items-center justify-center hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    
                    {/* BANDA ASIGNADA */}
                    {(ev.type.includes('Culto') || ev.type.includes('Ensayo')) && (
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        {['teclado', 'bajo', 'bateria', 'electrica', 'acustica'].map(role => ev.team[role] && (
                          <div key={role} className="flex items-center gap-3 text-left bg-slate-50 p-2.5 rounded-[16px] border border-slate-100">
                            <div className="w-8 h-8 bg-white rounded-[10px] flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm shrink-0">{role.substring(0,2).toUpperCase()}</div>
                            <p className="text-xs font-semibold text-slate-800 truncate">{ev.team[role]}</p>
                          </div>
                        ))}

                        {ev.team.voces?.length > 0 && (
                          <div className="col-span-2 flex flex-col gap-2 text-left bg-blue-50/50 p-4 rounded-[20px] border border-blue-100 mt-1">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0"><Mic2 size={12}/></div>
                                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Voces Asignadas</span>
                             </div>
                             <div className="flex flex-wrap gap-2 mt-1">
                                {ev.team.voces.map((v, i) => (
                                   <span key={i} className="bg-white text-slate-700 border border-slate-200 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm">
                                      {v}
                                   </span>
                                ))}
                             </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SETLIST DETALLADO */}
                    {eventSongs.length > 0 && (
                      <div className="border-t border-slate-100 pt-5 space-y-3">
                         <div className="flex items-center justify-between mb-3">
                           <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Setlist</p>
                           <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer hover:bg-slate-200 transition-colors">Modo Ensayo</span>
                         </div>
                         {eventSongs.map((song, idx) => (
                           <div key={song.id} className="flex items-start gap-3 text-left p-3.5 rounded-[20px] bg-slate-50 border border-slate-100 cursor-pointer transition-colors hover:bg-slate-100 active:scale-95" onClick={() => openSongViewer(eventSongs, idx)}>
                             <PlayCircle size={24} className="text-blue-600 shrink-0" strokeWidth={2} />
                             <div className="flex-1 min-w-0">
                                <span className="block text-sm font-bold text-slate-800 truncate">{song.title}</span>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                   {song.setlistConfig.singer && (
                                      <span className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1"><Mic2 size={10}/> {song.setlistConfig.singer}</span>
                                   )}
                                   <span className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold">
                                      Tono: {song.setlistConfig.keyType === 'woman' ? song.keyWoman : song.keyMan}
                                   </span>
                                </div>
                             </div>
                           </div>
                         ))}
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
            <div className="flex items-center justify-between bg-white p-2.5 rounded-full shadow-sm border border-slate-100 mb-6">
              <button onClick={handlePrevMonth} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600 active:scale-90"><ChevronLeft size={20}/></button>
              <h2 className="text-sm font-bold text-slate-900 capitalize">{format(viewMonth, 'MMMM yyyy', { locale: es })}</h2>
              <button onClick={handleNextMonth} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600 active:scale-90"><ChevronRight size={20}/></button>
            </div>

            <button onClick={generateMonth} className="w-full py-4 bg-blue-600 text-white rounded-full font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 mb-6 active:scale-95 transition-transform">
              <Calendar size={18} /> Generar Turnos del Mes
            </button>
            
            <div className="space-y-4">
              {monthlyEvents.length === 0 ? (
                <div className="text-center py-10 opacity-40"><p className="text-xs font-semibold text-slate-500">No hay turnos creados este mes.</p></div>
              ) : (
                monthlyEvents.map(ev => (
                  <div key={ev.id} onClick={() => setEditingEvent(ev)} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between active:scale-95 transition-transform cursor-pointer hover:border-blue-200">
                     <div className="flex items-center gap-4 text-left">
                       <div className="w-14 h-14 bg-slate-50 text-slate-500 rounded-[16px] flex flex-col items-center justify-center shrink-0 border border-slate-100">
                          <span className="text-[10px] font-bold uppercase">{format(new Date(ev.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                          <span className="text-lg font-bold text-slate-900 leading-none mt-0.5">{format(new Date(ev.date + 'T00:00:00'), 'dd')}</span>
                       </div>
                       <div>
                         <h4 className="font-bold text-slate-900 text-[15px]">{ev.type}</h4>
                         <p className="text-[11px] text-slate-500 font-medium mt-1">
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
            PESTAÑA: CANCIONES 
        ============================================= */}
        {activeTab === 'canciones' && (
          <div className="animate-slide-up space-y-4">
            <div className="bg-white rounded-full border border-slate-200 flex items-center px-4 shadow-sm">
              <Search size={20} className="text-slate-400" strokeWidth={2.5}/>
              <input type="text" placeholder="Buscar canción..." className="w-full py-3.5 px-3 text-sm font-semibold bg-transparent outline-none text-slate-800 placeholder-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-2">
               {CATEGORIAS.map(cat => (
                 <button key={cat} onClick={() => setActiveCategory(cat)} className={`shrink-0 px-5 py-2 rounded-full text-[11px] font-bold transition-all ${activeCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                   {cat}
                 </button>
               ))}
            </div>

            <div className="grid grid-cols-1 gap-3">
               {filteredSongs.length === 0 ? (
                 <div className="text-center py-20 opacity-40"><BookOpen size={40} className="mx-auto mb-4 text-slate-400"/><p className="font-semibold text-sm text-slate-500">Sin resultados</p></div>
               ) : (
                 filteredSongs.map(song => (
                   <div key={song.id} className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between active:scale-95 transition-transform">
                      <div className="flex items-center gap-4 text-left min-w-0 flex-1 cursor-pointer" onClick={() => openSongViewer([song], 0)}>
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-[14px] flex items-center justify-center shrink-0 border border-blue-100"><span className="font-bold text-lg">{song.keyMan || 'C'}</span></div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-900 text-[15px] truncate">{song.title}</h4>
                          <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">{song.category} {song.bpm ? `• ${song.bpm} BPM` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center shrink-0 ml-2">
                        <button onClick={() => { setSongForm({ ...song, baseTone: song.baseTone || 'man' }); setIsFormOpen(true); }} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={18}/></button>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        )}
      </div>

      {/* FAB Nueva Canción */}
      {activeTab === 'canciones' && (
        <button onClick={() => { setSongForm({ id: null, title: '', artist: '', keyMan: 'C', keyWoman: 'C', bpm: '', category: 'Adoración', link: '', content: '', songChords: '', baseTone: 'man' }); setIsFormOpen(true); }} className="fixed bottom-24 right-5 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center active:scale-90 z-40 transition-transform"><Plus size={28} strokeWidth={2.5} /></button>
      )}

      {/* =============================================================
          MODAL 1: EDITAR ORGANIZACIÓN DEL DÍA (ESTILO REFERENCIA SOCIALYO)
      ================================================================= */}
      {editingEvent && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center font-sans p-4 sm:p-0">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 sm:p-8 max-h-[90vh] overflow-y-auto no-scrollbar animate-slide-up shadow-2xl relative">
            <button onClick={() => setEditingEvent(null)} className="absolute top-6 right-6 w-8 h-8 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-500 transition-colors"><X size={18}/></button>
            
            <div className="mb-6 pr-10">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{editingEvent.type}</h2>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mt-1">{format(new Date(editingEvent.date + 'T00:00:00'), "d 'de' MMMM", { locale: es })}</p>
            </div>

            <form onSubmit={handleUpdateEvent} className="space-y-6 pb-4">
              
              {/* CULTO / ENSAYO: Toda la banda */}
              {(editingEvent.type.includes('Culto') || editingEvent.type.includes('Ensayo')) && (
                <>
                  <div>
                    <label className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Mic2 size={14}/> Voces (Múltiple)</label>
                    <div className="flex flex-wrap gap-2 bg-slate-50 p-4 rounded-[24px] border border-slate-100">
                      {teamMembers.map(m => {
                        const isSelected = editingEvent.team.voces?.includes(m.displayName);
                        return (
                          <button key={m.id} type="button" onClick={() => {
                            const current = editingEvent.team.voces || [];
                            const newVoces = isSelected ? current.filter(n => n !== m.displayName) : [...current, m.displayName];
                            setEditingEvent({...editingEvent, team: {...editingEvent.team, voces: newVoces}});
                          }} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}>
                            {m.displayName.split(' ')[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {['teclado', 'bajo', 'bateria', 'electrica', 'acustica'].map(role => (
                      <div key={role}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{role}</label>
                        <select className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-[16px] text-sm font-semibold text-slate-700 outline-none focus:border-blue-300" value={editingEvent.team[role] || ''} onChange={e => setEditingEvent({...editingEvent, team: {...editingEvent.team, [role]: e.target.value}})}>
                          <option value="">-</option>
                          {teamMembers.map(m => <option key={m.id} value={m.displayName}>{m.displayName}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* CONSTRUCTOR DE SETLIST DETALLADO */}
                  <div className="border-t border-slate-100 pt-6">
                    <label className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1.5"><ListMusic size={14}/> Constructor de Setlist</label>
                    
                    <div className="flex items-center bg-white border border-slate-200 p-3 rounded-2xl mb-4 shadow-sm">
                       <Search size={18} className="text-slate-400 mr-2"/>
                       <input placeholder="Buscar para agregar..." value={setlistSearchTerm} onChange={e => setSetlistSearchTerm(e.target.value)} className="bg-transparent outline-none w-full text-sm font-semibold placeholder-slate-400" />
                    </div>

                    {setlistSearchTerm && (
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1 mb-6 border-b border-slate-100 pb-6 no-scrollbar">
                        {filteredSetlistSongs.map(song => {
                          const isSelected = editingEvent.setlist.some(item => getSongId(item) === song.id);
                          return (
                            <div key={song.id} onClick={() => {
                                let newList = [...editingEvent.setlist];
                                if (isSelected) {
                                   newList = newList.filter(item => getSongId(item) !== song.id);
                                } else {
                                   newList.push({ songId: song.id, singer: '', keyType: song.baseTone || 'man', notes: '' });
                                }
                                setEditingEvent({...editingEvent, setlist: newList});
                              }} className={`p-3.5 rounded-[16px] border transition-all flex items-center justify-between cursor-pointer ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                              <div className="flex flex-col">
                                 <span className={`text-sm font-bold truncate pr-2 ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{song.title}</span>
                                 <span className="text-[10px] text-slate-400 font-semibold uppercase">{song.category}</span>
                              </div>
                              {isSelected ? <CheckCircle2 size={20} className="text-blue-600 shrink-0"/> : <Plus size={20} className="text-slate-300 shrink-0"/>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* CANCIONES SELECCIONADAS */}
                    <div className="space-y-3">
                       {editingEvent.setlist.map((item, idx) => {
                          const songId = getSongId(item);
                          const song = songs.find(s => s.id === songId);
                          if(!song) return null;
                          
                          const config = typeof item === 'string' ? { songId, singer: '', keyType: song.baseTone || 'man', notes: '' } : item;

                          return (
                             <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-[20px] relative">
                                <button type="button" onClick={() => {
                                    const newList = [...editingEvent.setlist];
                                    newList.splice(idx, 1);
                                    setEditingEvent({...editingEvent, setlist: newList});
                                }} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 active:scale-90 transition-colors"><Trash2 size={16}/></button>
                                
                                <h4 className="text-sm font-bold text-slate-900 mb-3 pr-8">{song.title}</h4>
                                
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                   <div>
                                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1 block mb-1">Canta (Principal)</label>
                                      <select value={config.singer} onChange={e => {
                                         const newList = [...editingEvent.setlist];
                                         newList[idx] = { ...config, singer: e.target.value };
                                         setEditingEvent({...editingEvent, setlist: newList});
                                      }} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold outline-none text-slate-700">
                                         <option value="">Nadie / Todos</option>
                                         {teamMembers.map(m => <option key={m.id} value={m.displayName}>{m.displayName}</option>)}
                                      </select>
                                   </div>
                                   <div>
                                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1 block mb-1">Tono a tocar</label>
                                      <select value={config.keyType} onChange={e => {
                                         const newList = [...editingEvent.setlist];
                                         newList[idx] = { ...config, keyType: e.target.value };
                                         setEditingEvent({...editingEvent, setlist: newList});
                                      }} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold outline-none text-slate-700">
                                         <option value="man">Hombre ({song.keyMan || 'C'})</option>
                                         <option value="woman">Mujer ({song.keyWoman || 'C'})</option>
                                      </select>
                                   </div>
                                </div>
                                <div>
                                   <input placeholder="Notas de ensayo..." value={config.notes || ''} onChange={e => {
                                       const newList = [...editingEvent.setlist];
                                       newList[idx] = { ...config, notes: e.target.value };
                                       setEditingEvent({...editingEvent, setlist: newList});
                                   }} className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs font-medium outline-none text-slate-700" />
                                </div>
                             </div>
                          )
                       })}
                    </div>
                  </div>
                </>
              )}

              <button type="submit" disabled={isUploading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 mt-6 active:scale-95 transition-transform disabled:opacity-50 uppercase tracking-widest">
                {isUploading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} {editingId ? "Guardar Organización" : "Confirmar Actividad"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 2: NUEVA/EDITAR CANCIÓN (REDISEÑO SOCIALYO)
      ================================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[300] bg-white flex flex-col animate-slide-up h-[100dvh]">
          <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white shrink-0">
            <h2 className="text-xl font-bold text-slate-900">{songForm.id ? 'Editar Canción' : 'Nueva Canción'}</h2>
            <div className="flex gap-2">
              {songForm.id && <button onClick={() => handleDeleteSong(songForm.id)} className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500 active:scale-90 transition-transform"><Trash2 size={18}/></button>}
              <button onClick={() => setIsFormOpen(false)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600 active:scale-90 transition-transform"><X size={18}/></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 pb-48 text-left bg-slate-50 no-scrollbar">
            <div className="max-w-md mx-auto space-y-5">
              <input placeholder="Título de la canción" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-lg outline-none focus:border-blue-500 shadow-sm" value={songForm.title} onChange={e => setSongForm({...songForm, title: e.target.value})} />
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1.5 flex items-center gap-1"><User size={12}/> Voz H.</label>
                   <input placeholder="C" className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold uppercase outline-none focus:border-blue-500 shadow-sm" value={songForm.keyMan} onChange={e => setSongForm({...songForm, keyMan: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1.5 flex items-center gap-1"><User size={12}/> Voz M.</label>
                   <input placeholder="G" className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold uppercase outline-none focus:border-pink-500 shadow-sm" value={songForm.keyWoman} onChange={e => setSongForm({...songForm, keyWoman: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1.5 block">Tempo</label>
                   <input placeholder="120" type="number" className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 shadow-sm" value={songForm.bpm} onChange={e => setSongForm({...songForm, bpm: e.target.value})} />
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-3 text-center">¿En qué tono estás escribiendo la letra acá abajo?</label>
                 <div className="flex gap-2">
                    <button type="button" onClick={() => setSongForm({...songForm, baseTone: 'man'})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${songForm.baseTone === 'man' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>Tono H. ({songForm.keyMan || 'C'})</button>
                    <button type="button" onClick={() => setSongForm({...songForm, baseTone: 'woman'})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${songForm.baseTone === 'woman' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>Tono M. ({songForm.keyWoman || 'C'})</button>
                 </div>
              </div>

              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1.5 block">Acordes de la canción (Separados por coma)</label>
                 <input placeholder="Ej: C, Dm, F, G..." className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 text-sm shadow-sm" value={songForm.songChords || ''} onChange={e => setSongForm({...songForm, songChords: e.target.value})} />
              </div>

              <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold outline-none shadow-sm text-sm" value={songForm.category} onChange={e => setSongForm({...songForm, category: e.target.value})}>
                {CATEGORIAS.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              
              <div className="relative">
                 <Youtube size={20} className="absolute top-4 left-4 text-rose-500" />
                 <input placeholder="Link YouTube/Spotify (Opcional)" className="w-full py-4 pl-12 pr-4 bg-white border border-slate-200 rounded-xl font-medium text-sm outline-none focus:border-blue-500 shadow-sm" value={songForm.link} onChange={e => setSongForm({...songForm, link: e.target.value})} />
              </div>

              <textarea ref={textAreaRef} placeholder="Escribí la letra acá y usá el teclado flotante de abajo para insertar los acordes..." className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-medium text-sm h-[400px] resize-none outline-none leading-relaxed shadow-sm pb-32 whitespace-pre-wrap" value={songForm.content} onChange={e => setSongForm({...songForm, content: e.target.value})} />
            </div>
          </div>

          {/* TECLADO FLOTANTE */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-3 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
            <div className="max-w-md mx-auto">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 pb-3">
                 {customChordsArr.map((c, i) => (
                   <button key={`custom-${i}`} type="button" onClick={() => insertChord(c)} className="shrink-0 h-10 min-w-[3rem] px-3 bg-blue-50 text-blue-600 rounded-[12px] text-sm font-bold border border-blue-100 active:scale-90 transition-transform">
                     {c}
                   </button>
                 ))}
                 {customChordsArr.length > 0 && <div className="w-px h-8 bg-slate-200 mx-1 shrink-0"></div>}
                 {allChords.map(c => (
                   <button key={c} type="button" onClick={() => insertChord(c)} className="shrink-0 h-10 min-w-[3rem] px-3 bg-white text-slate-700 rounded-[12px] text-sm font-bold border border-slate-200 active:scale-90 transition-transform">
                     {c}
                   </button>
                 ))}
              </div>
              <button onClick={handleSaveSong} className="w-full py-4 bg-blue-600 text-white rounded-full font-bold text-sm shadow-md shadow-blue-600/20 flex justify-center items-center gap-2 active:scale-95 transition-transform"><Save size={18}/> Guardar Canción</button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 3: VISOR SETLIST (Proyector Mantenido Oscuro)
      ================================================================= */}
      {viewingSong && (
        <div className="fixed inset-0 z-[400] bg-slate-900 flex flex-col animate-slide-up h-[100dvh] overflow-hidden">
          <div className="flex justify-between items-start p-6 shrink-0 relative border-b border-slate-800">
            <div className="text-left flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2">
                 <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest">{viewingSong.category}</span>
                 {viewingSong.setlistConfig?.notes && (
                    <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5"><FileText size={12}/> Notas</span>
                 )}
              </div>
              <h2 className="text-2xl font-bold text-white truncate">{viewingSong.title}</h2>
              {activeSetlist.length > 1 && <p className="text-xs font-semibold text-slate-400 mt-1">Setlist: {currentSongIdx + 1} de {activeSetlist.length}</p>}
            </div>
            
            <div className="flex items-center gap-3">
               <button onClick={() => setShowSettings(!showSettings)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 active:scale-90 transition-transform shrink-0"><Settings size={20}/></button>
               <button onClick={closeViewer} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 active:scale-90 transition-transform shrink-0"><X size={20}/></button>
            </div>

            {showSettings && (
               <div className="absolute top-24 right-6 bg-slate-800 border border-slate-700 rounded-[20px] p-4 shadow-2xl z-50 animate-slide-up">
                  <p className="text-xs font-bold text-slate-400 mb-3 text-center">Tamaño de Letra</p>
                  <div className="flex gap-2">
                     {['sm', 'md', 'lg'].map(s => (
                        <button key={s} onClick={() => { setTextSize(s); setShowSettings(false); }} className={`w-12 h-12 rounded-xl flex items-center justify-center font-black transition-colors ${textSize === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                           {s === 'sm' ? 'A' : s === 'md' ? 'A+' : 'A++'}
                        </button>
                     ))}
                  </div>
               </div>
            )}
          </div>

          {viewingSong.setlistConfig?.notes && (
             <div className="bg-amber-400 text-amber-900 px-6 py-3 text-xs font-bold flex items-center gap-2 shrink-0">
                <FileText size={16} className="shrink-0"/>
                <span className="truncate">{viewingSong.setlistConfig.notes}</span>
             </div>
          )}

          <div className="bg-slate-900 p-4 flex gap-3 shrink-0 z-10 border-b border-slate-800">
            <div className="flex-[1.5] bg-slate-800 rounded-[20px] p-3 flex flex-col justify-between">
              <div className="flex bg-slate-900 rounded-xl p-1 mb-3">
                <button onClick={() => setGenderToggle('man')} className={`flex-1 text-[10px] font-bold uppercase py-2 rounded-lg transition-colors ${genderToggle === 'man' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400'}`}>Hombre</button>
                <button onClick={() => setGenderToggle('woman')} className={`flex-1 text-[10px] font-bold uppercase py-2 rounded-lg transition-colors ${genderToggle === 'woman' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400'}`}>Mujer</button>
              </div>
              <div className="flex items-center justify-between px-2">
                <button onClick={() => setTransposeSteps(p => p - 1)} className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center active:scale-90 transition-transform"><ArrowDownCircle size={20}/></button>
                <div className="text-center"><span className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Tono Actual</span><span className="block text-2xl font-black text-white">{transposeChord(genderToggle === 'woman' ? viewingSong.keyWoman : viewingSong.keyMan, transposeSteps)}</span></div>
                <button onClick={() => setTransposeSteps(p => p + 1)} className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center active:scale-90 transition-transform"><ArrowUpCircle size={20}/></button>
              </div>
            </div>

            <div className="flex-1 bg-slate-800 rounded-[20px] p-3 flex flex-col justify-center items-center">
               <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2">Metrónomo</span>
               <div className="flex flex-col items-center gap-2">
                 <span className="block text-2xl font-black text-white leading-none">{viewingSong.bpm || '--'}</span>
                 <button onClick={() => toggleMetronome(viewingSong.bpm)} className={`px-6 py-2 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all ${isPlayingMetro ? 'bg-rose-500 text-white animate-pulse' : 'bg-white text-slate-900'}`}>
                   {isPlayingMetro ? 'PARAR' : 'PLAY'}
                 </button>
               </div>
            </div>
          </div>

          <div className="flex-1 relative bg-slate-900 overflow-hidden flex items-start justify-start p-8 pb-24">
             <div className="absolute left-0 top-0 bottom-0 w-1/2 z-10" onClick={handlePrevSlide}></div>
             <div className="absolute right-0 top-0 bottom-0 w-1/2 z-10" onClick={handleNextSlide}></div>
             
             <div className="w-full transition-all duration-300 pointer-events-none text-white">
               {renderLyricsWithChords(songSlides[currentSlideIdx] || '', effectiveSteps, textSize)}
             </div>

             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 pointer-events-none">
               {songSlides.map((_, i) => (
                 <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlideIdx ? 'w-8 bg-white' : 'w-2 bg-slate-600'}`}></div>
               ))}
             </div>
          </div>

          {activeSetlist.length > 1 && (
            <div className="bg-slate-950 p-5 flex items-center gap-4 border-t border-slate-900 shrink-0 z-20 relative">
              <button onClick={() => { if(currentSongIdx > 0) changeSongIdx(currentSongIdx - 1) }} className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform ${currentSongIdx === 0 ? 'opacity-30' : 'bg-slate-800 text-white active:scale-90'}`}><ChevronLeft size={24} /></button>
              <div className="flex-1 text-center min-w-0">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{currentSongIdx < activeSetlist.length - 1 ? 'Siguiente' : 'Fin del Setlist'}</span>
                <span className="block text-base font-bold text-white truncate mt-1">{currentSongIdx < activeSetlist.length - 1 ? activeSetlist[currentSongIdx+1].title : '-'}</span>
              </div>
              <button onClick={() => { if(currentSongIdx < activeSetlist.length - 1) changeSongIdx(currentSongIdx + 1) }} className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform ${currentSongIdx === activeSetlist.length - 1 ? 'opacity-30' : 'bg-blue-600 text-white active:scale-90 shadow-lg shadow-blue-600/30'}`}><ChevronRight size={24} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}