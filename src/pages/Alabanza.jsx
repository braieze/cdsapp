import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  Music, Calendar, Clock, BookOpen, PlusCircle, 
  Search, Filter, ChevronRight, Mic2, Save, X,
  Youtube, ArrowUpCircle, ArrowDownCircle,
  PlayCircle, StopCircle, Flame, Sparkles, Lock, 
  ClipboardList, CheckCircle2, ChevronLeft, Loader2
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, setDoc, 
  serverTimestamp, getDocs, where, updateDoc 
} from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

// --- LÓGICA DEL TRANSPOSITOR ---
const scale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
const transposeChord = (chord, steps) => {
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

const CATEGORIAS = ['Bienvenida', 'Fuego', 'Alabanza', 'Adoración', 'Ministración', 'Especial'];

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

  // Modales y Visores
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  
  // ✅ NUEVO: Lógica de Setlist
  const [activeSetlist, setActiveSetlist] = useState([]);
  const [currentSongIdx, setCurrentSongIdx] = useState(0);
  const [transposeSteps, setTransposeSteps] = useState(0);

  // ✅ NUEVO: Metrónomo Real
  const [isPlayingMetro, setIsPlayingMetro] = useState(false);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);

  // Formulario Canción
  const [songForm, setSongForm] = useState({ title: '', artist: '', originalKey: 'C', bpm: '', category: 'Adoración', link: '', content: '' });

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
      
      // Hacemos el primer click inmediato
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
    
    // Acento en el primer golpe (frecuencia más alta)
    osc.frequency.value = (count % 4 === 0) ? 1000 : 800; 
    
    gainNode.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.1);
    
    osc.start(audioCtxRef.current.currentTime);
    osc.stop(audioCtxRef.current.currentTime + 0.1);
  };

  // Limpiar metrónomo si cambiamos de canción o cerramos
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentSongIdx, activeSetlist]);

  // --- FUNCIONES VISOR SETLIST ---
  const openSongViewer = (songList, startIndex = 0) => {
    setActiveSetlist(songList);
    setCurrentSongIdx(startIndex);
    setTransposeSteps(0);
    setIsPlayingMetro(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const closeViewer = () => {
    setActiveSetlist([]);
    setIsPlayingMetro(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const viewingSong = activeSetlist[currentSongIdx];

  // --- ACCIONES PLANIFICACIÓN ---
  const generateMonth = async () => {
    if (!window.confirm("¿Generar los turnos del mes actual?")) return;
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
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
          await setDoc(doc(db, 'alabanza_events', eventId), {
            date: eventId,
            type,
            team: { bateria: '', bajo: '', piano: '', guitarra: '', voces: [], devo: '' },
            setlist: [],
            observations: ''
          }, { merge: true });
        }
      }
      toast.success("Mes generado correctamente");
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

  const handleSaveSong = async () => {
    if (!songForm.title || !songForm.content) return toast.error("Título y letra son obligatorios");
    try {
      const newRef = doc(collection(db, 'songs'));
      await setDoc(newRef, {
        ...songForm,
        bpm: Number(songForm.bpm) || 0,
        createdAt: serverTimestamp()
      });
      setIsFormOpen(false);
      setSongForm({ title: '', artist: '', originalKey: 'C', bpm: '', category: 'Adoración', link: '', content: '' });
      toast.success("Canción guardada con éxito");
    } catch (e) { toast.error("Error al guardar la canción"); }
  };

  // --- RENDERIZADO DE LETRAS ---
  const renderLyricsWithChords = (text, steps) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.trim().match(/^\[?(intro|coro|verso|puente|pre-coro|instrumental)\]?:?/i)) {
        return <div key={idx} className="mt-6 mb-2 text-[10px] font-black text-brand-600 uppercase tracking-[0.2em]">{line.replace(/\[|\]/g, '')}</div>;
      }
      const parts = line.split(/(\[[^\]]+\])/g);
      let hasChords = parts.some(p => p.startsWith('[') && p.endsWith(']'));
      if (!hasChords) return <div key={idx} className="text-[15px] font-medium text-slate-800 leading-relaxed min-h-[1.5rem]">{line}</div>;
      return (
        <div key={idx} className="relative flex flex-wrap items-end mt-4 mb-2">
          {parts.map((part, i) => {
            if (part.startsWith('[') && part.endsWith(']')) {
              const chord = part.slice(1, -1);
              return <span key={i} className="absolute -top-4 text-brand-600 font-black text-sm tracking-tighter">{transposeChord(chord, steps)}</span>;
            }
            return <span key={i} className="text-[15px] font-medium text-slate-800 whitespace-pre leading-relaxed">{part}</span>;
          })}
        </div>
      );
    });
  };

  const filteredSongs = songs.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const weeklyEvents = events.filter(ev => isSameWeek(new Date(ev.date + 'T00:00:00'), new Date(), { weekStartsOn: 1 }));

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-brand-600" /></div>;

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-outfit relative">
      {/* HEADER */}
      <div className="px-5 pt-8 pb-4 bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-6">
          <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Alabanza</h1>
            <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-2 flex items-center gap-2"><Sparkles size={12} /> {activeTab === 'cancionero' ? 'Cancionero Pro' : 'Planificación'}</p>
          </div>
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl"><Music size={24} /></div>
        </div>

        <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
          {['semanal', 'mensual', 'cancionero'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-400'}`}>{tab}</button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-8">
        {/* PESTAÑA: SEMANAL */}
        {activeTab === 'semanal' && (
          <div className="animate-slide-up space-y-6">
            {weeklyEvents.length === 0 ? (
              <div className="py-20 text-center opacity-20"><Calendar size={48} className="mx-auto mb-4" /><p className="font-black text-xs uppercase">No hay actividades esta semana</p></div>
            ) : (
              weeklyEvents.map(ev => {
                const eventSongs = ev.setlist?.map(id => songs.find(s => s.id === id)).filter(Boolean) || [];
                return (
                  <div key={ev.id} className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="text-left">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-brand-600 bg-brand-50 px-2 py-1 rounded-md">{ev.type}</span>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mt-1">{format(new Date(ev.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}</h3>
                      </div>
                      <button onClick={() => setEditingEvent(ev)} className="p-2 bg-slate-50 rounded-xl text-slate-400"><ClipboardList size={18}/></button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {Object.entries(ev.team).map(([role, person]) => person && (
                        <div key={role} className="flex items-center gap-2 text-left bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm">{role[0].toUpperCase()}</div>
                          <p className="text-[10px] font-black text-slate-700 truncate">{person}</p>
                        </div>
                      ))}
                    </div>

                    {eventSongs.length > 0 && (
                      <div className="border-t pt-4 space-y-2">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left mb-3 flex items-center justify-between">
                            Setlist
                            <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">Modo Ensayo</span>
                         </p>
                         {eventSongs.map((song, idx) => (
                           <div key={song.id} className="flex items-center gap-3 text-left p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => openSongViewer(eventSongs, idx)}>
                             <PlayCircle size={18} className="text-brand-500 shrink-0" />
                             <div>
                                <span className="block text-xs font-black text-slate-800 uppercase tracking-tighter">{song.title}</span>
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">{song.originalKey} • {song.bpm} BPM</span>
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

        {/* PESTAÑA: MENSUAL */}
        {activeTab === 'mensual' && (
          <div className="animate-slide-up space-y-4">
            <button onClick={generateMonth} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-2 mb-6">
              <Calendar size={16} /> Generar Turnos del Mes
            </button>
            <div className="space-y-3">
              {events.map(ev => (
                <div key={ev.id} onClick={() => setEditingEvent(ev)} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
                   <div className="flex items-center gap-4 text-left">
                     <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex flex-col items-center justify-center shrink-0">
                        <span className="text-[8px] font-black uppercase">{format(new Date(ev.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                        <span className="text-lg font-black text-slate-900">{format(new Date(ev.date + 'T00:00:00'), 'dd')}</span>
                     </div>
                     <div>
                       <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{ev.type}</h4>
                       <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">
                         {ev.team.piano || 'Sin asignar'} • {ev.setlist.length} canciones
                       </p>
                     </div>
                   </div>
                   <ChevronRight size={20} className="text-slate-300"/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA: CANCIONERO */}
        {activeTab === 'cancionero' && (
          <div className="animate-slide-up space-y-6">
            <div className="flex gap-2">
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 flex items-center px-4 gap-3 shadow-sm">
                <Search size={18} className="text-slate-400" />
                <input type="text" placeholder="Buscar canción..." className="w-full py-4 text-sm font-bold bg-transparent outline-none text-slate-800" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <button className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl active:scale-90 transition-all"><Filter size={20} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3">
               {filteredSongs.map(song => (
                 <div key={song.id} onClick={() => openSongViewer([song], 0)} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
                    <div className="flex items-center gap-4 text-left min-w-0">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0"><span className="font-black text-lg">{song.originalKey}</span></div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight truncate">{song.title}</h4>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1 flex items-center gap-1.5 truncate"><Flame size={10} className="text-brand-500"/> {song.category} {song.bpm ? `• ${song.bpm} BPM` : ''}</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 shrink-0"/>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE */}
      {activeTab === 'cancionero' && (
        <button onClick={() => setIsFormOpen(true)} className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[26px] shadow-2xl flex items-center justify-center active:scale-90 z-40 transition-all border-4 border-white"><PlusCircle size={32} /></button>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: EDITAR ORGANIZACIÓN DEL DÍA */}
      {/* ------------------------------------------------------------- */}
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

            <form onSubmit={handleUpdateEvent} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 {['piano', 'bajo', 'bateria', 'guitarra', 'devo'].map(role => (
                   <div key={role} className="text-left">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{role}</label>
                     <select 
                       className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
                       value={editingEvent.team[role]}
                       onChange={e => setEditingEvent({...editingEvent, team: {...editingEvent.team, [role]: e.target.value}})}
                     >
                       <option value="">-</option>
                       {teamMembers.map(m => <option key={m.id} value={m.displayName}>{m.displayName}</option>)}
                     </select>
                   </div>
                 ))}
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Setlist (Canciones)</label>
                <div className="space-y-2">
                  {songs.map(song => (
                    <div 
                      key={song.id} 
                      onClick={() => {
                        const newList = editingEvent.setlist.includes(song.id) 
                          ? editingEvent.setlist.filter(id => id !== song.id)
                          : [...editingEvent.setlist, song.id];
                        setEditingEvent({...editingEvent, setlist: newList});
                      }}
                      className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${editingEvent.setlist.includes(song.id) ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-white'}`}
                    >
                      <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">{song.title}</span>
                      {editingEvent.setlist.includes(song.id) && <CheckCircle2 size={16} className="text-brand-600"/>}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl flex items-center justify-center gap-3">
                <Save size={18}/> Guardar Organización
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: NUEVA CANCIÓN */}
      {/* ------------------------------------------------------------- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col animate-slide-up h-[100dvh]">
          <div className="flex justify-between items-center p-5 border-b bg-white shrink-0">
            <div className="text-left"><h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Nueva Canción</h2></div>
            <button onClick={() => setIsFormOpen(false)} className="p-3 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-32 text-left">
            <input placeholder="Título" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-lg outline-none focus:border-brand-500" value={songForm.title} onChange={e => setSongForm({...songForm, title: e.target.value})} />
            <div className="flex gap-3">
              <div className="flex-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Tono</label>
                 <input placeholder="C, Dm..." className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black uppercase outline-none focus:border-brand-500" value={songForm.originalKey} onChange={e => setSongForm({...songForm, originalKey: e.target.value})} />
              </div>
              <div className="flex-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">BPM</label>
                 <input placeholder="120" type="number" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black outline-none focus:border-brand-500" value={songForm.bpm} onChange={e => setSongForm({...songForm, bpm: e.target.value})} />
              </div>
            </div>
            <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none" value={songForm.category} onChange={e => setSongForm({...songForm, category: e.target.value})}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="relative">
               <Youtube size={18} className="absolute top-4 left-4 text-rose-500" />
               <input placeholder="Link YouTube/Spotify (Opcional)" className="w-full py-4 pl-12 pr-4 bg-rose-50 border border-rose-100 rounded-2xl font-bold text-sm outline-none focus:border-rose-400 text-rose-900" value={songForm.link} onChange={e => setSongForm({...songForm, link: e.target.value})} />
            </div>
            <textarea placeholder="[C]Cuan grande es [Am]Dios..." className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-medium text-sm h-64 resize-none outline-none leading-relaxed font-mono" value={songForm.content} onChange={e => setSongForm({...songForm, content: e.target.value})} />
          </div>
          <div className="p-5 bg-white border-t shrink-0"><button onClick={handleSaveSong} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl flex justify-center items-center gap-2"><Save size={18}/> Guardar Canción</button></div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: VISOR SETLIST / PROYECTOR */}
      {/* ------------------------------------------------------------- */}
      {viewingSong && (
        <div className="fixed inset-0 z-[300] bg-white flex flex-col animate-slide-up h-[100dvh]">
          {/* HEADER DEL VISOR + NAVEGACIÓN SETLIST */}
          <div className="flex justify-between items-start p-5 bg-slate-900 text-white shrink-0">
            <div className="text-left flex-1 min-w-0 pr-4">
              <span className="bg-white/20 text-white px-2.5 py-1 rounded-md text-[8px] font-black uppercase mb-2 inline-block tracking-widest">{viewingSong.category}</span>
              <h2 className="text-2xl font-black uppercase tracking-tighter truncate">{viewingSong.title}</h2>
              {activeSetlist.length > 1 && (
                 <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mt-1">Canción {currentSongIdx + 1} de {activeSetlist.length}</p>
              )}
            </div>
            <button onClick={closeViewer} className="p-3 bg-white/10 rounded-full text-slate-300 active:scale-75 transition-all shrink-0"><X size={20}/></button>
          </div>

          <div className="bg-slate-800 p-3 flex gap-2 shrink-0">
            <div className="flex-1 bg-slate-900/50 rounded-xl p-2 flex items-center justify-between border border-slate-700">
              <button onClick={() => setTransposeSteps(p => p - 1)} className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center active:scale-95 transition-transform"><ArrowDownCircle size={20}/></button>
              <div className="text-center"><span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest">Tono</span><span className="block text-lg font-black text-white">{transposeChord(viewingSong.originalKey, transposeSteps)}</span></div>
              <button onClick={() => setTransposeSteps(p => p + 1)} className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center active:scale-95 transition-transform"><ArrowUpCircle size={20}/></button>
            </div>
            <div className="flex-1 bg-slate-900/50 rounded-xl p-2 flex items-center justify-between border border-slate-700 px-4">
               <div className="text-left"><span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest">Tempo</span><span className="block text-lg font-black text-white">{viewingSong.bpm || '--'} <span className="text-[10px]">bpm</span></span></div>
               <button onClick={() => toggleMetronome(viewingSong.bpm)} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all ${isPlayingMetro ? 'bg-rose-500 shadow-rose-500/50 animate-pulse' : 'bg-brand-600 shadow-brand-500/50'}`}>
                 {isPlayingMetro ? <StopCircle size={20} className="text-white"/> : <PlayCircle size={20} className="text-white"/>}
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-[#fdfdfd] pb-32 text-left">
             <div className="max-w-2xl mx-auto">{renderLyricsWithChords(viewingSong.content, transposeSteps)}</div>
          </div>

          {/* NAVEGACIÓN INFERIOR PARA SETLIST */}
          {activeSetlist.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 p-2 rounded-full flex items-center gap-4 shadow-2xl border border-slate-700 w-11/12 max-w-sm">
              <button 
                onClick={() => { if(currentSongIdx > 0) { setCurrentSongIdx(p=>p-1); setTransposeSteps(0); } }}
                className={`p-3 rounded-full flex items-center justify-center transition-all ${currentSongIdx === 0 ? 'opacity-30' : 'bg-slate-800 text-white active:scale-90'}`}
              >
                <ChevronLeft size={24} />
              </button>
              <div className="flex-1 text-center min-w-0">
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
                   {currentSongIdx < activeSetlist.length - 1 ? 'Siguiente: ' + activeSetlist[currentSongIdx+1].title : 'Última Canción'}
                </span>
              </div>
              <button 
                onClick={() => { if(currentSongIdx < activeSetlist.length - 1) { setCurrentSongIdx(p=>p+1); setTransposeSteps(0); } }}
                className={`p-3 rounded-full flex items-center justify-center transition-all ${currentSongIdx === activeSetlist.length - 1 ? 'opacity-30' : 'bg-slate-800 text-white active:scale-90'}`}
              >
                <ChevronRight size={24} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}