import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  deleteDoc, doc, getDoc, serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import {
  Plus, Calendar as CalIcon, List, Clock, Trash2, X,
  ChevronLeft, ChevronRight, Loader2, Megaphone,
  Send, EyeOff, CheckCircle, XCircle,
  AlertCircle, ChevronRight as ArrowRight, History, LayoutGrid, Sparkles, Heart, UserCheck, Globe
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { 
  format, addMonths, subMonths, isSameMonth, startOfMonth, 
  endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, 
  isSameDay, isWithinInterval, parseISO, isAfter, subDays, startOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

export default function CalendarPage() {
  const navigate = useNavigate();
  
  // --- 1. ESTADOS DE VISTA Y FILTROS ---
  const [viewMode, setViewMode] = useState('list'); // list, month, history
  const [filterType, setFilterType] = useState('mine'); // ✅ DEFAULT: Mis Servicios (Punto 2)
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [officialAreas, setOfficialAreas] = useState([]); // Punto 7: Dinámico

  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionConfirm, setActionConfirm] = useState(null);

  const currentUser = auth.currentUser;
  const CLOUD_NAME = "djmkggzjp";
  const UPLOAD_PRESET = "ml_default";

  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '',
    published: false
  });

  // --- 2. EFECTOS (DATOS Y ROLES) ---
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Cargar áreas dinámicas para el creador (Punto 7)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'metadata', 'areas'), (snap) => {
      if (snap.exists()) setOfficialAreas(snap.data().list || []);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (currentUser) {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) setUserRole(userSnap.data().role);
      }
    };
    fetchUserRole();

    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribeEvents();
  }, [currentUser]);

  // --- 3. LÓGICA DE NOTIFICACIONES Y ACCIONES ---
  const sendOneSignalNotification = async (notifTitle, notifBody, path) => {
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      if (!REST_API_KEY) return;
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
          included_segments: ["Total Subscriptions"],
          headings: { en: notifTitle, es: notifTitle },
          contents: { en: notifBody, es: notifBody },
          data: { route: path }, 
          isAndroid: true, isIos: true, priority: 10
        })
      });
    } catch (error) { console.error("Error envío notif:", error); }
  };

  const executeConfirmedAction = async () => {
    if (!actionConfirm) return;
    const { type, id } = actionConfirm;
    setActionConfirm(null);

    if (type === 'delete') {
      try {
        await deleteDoc(doc(db, 'events', id));
        setToast({ message: "Evento eliminado", type: "info" });
      } catch (e) { setToast({ message: "Error al borrar", type: "error" }); }
    }

    if (type === 'publish') {
      setIsPublishing(true);
      try {
        const monthEvents = events.filter(e => !e.published && isSameMonth(new Date(e.date + 'T00:00:00'), currentDate));
        const batch = writeBatch(db);
        monthEvents.forEach(e => {
          batch.update(doc(db, 'events', e.id), { published: true, updatedAt: serverTimestamp() });
        });
        await batch.commit();
        const monthName = format(currentDate, 'MMMM', { locale: es });
        await sendOneSignalNotification(`📅 Agenda de ${monthName} lista`, "Se publicaron las nuevas actividades.", "/calendario");
        setToast({ message: "¡Todo el mes publicado!", type: "success" });
      } catch (e) { setToast({ message: "Error al publicar", type: "error" }); }
      finally { setIsPublishing(false); }
    }
  };

  // --- 4. FILTRADO INTELIGENTE (Punto 2 y 4) ---
  const filteredEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const ayer = subDays(today, 1);
    const isPastor = ['pastor', 'lider'].includes(userRole);

    return events.filter(ev => {
      const eventDate = new Date(ev.date + 'T00:00:00');
      const isMyTask = ev.assignments && Object.values(ev.assignments).flat().includes(currentUser?.displayName);
      
      // 🛡️ Privacidad de Borradores (Punto 4)
      if (!ev.published && !isPastor && !isMyTask) return false;

      // Filtro de Historial vs Actual
      if (viewMode === 'history') return !isAfter(eventDate, ayer);

      if (viewMode === 'list' || viewMode === 'month') {
        if (!isAfter(eventDate, ayer)) return false; 
        
        // ✅ FILTRO "MIS SERVICIOS" (Punto 2)
        if (filterType === 'mine' && !isMyTask) return false;
        
        return isSameMonth(eventDate, currentDate);
      }
      return true;
    });
  }, [events, viewMode, filterType, currentDate, userRole, currentUser]);

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return setToast({ message: "Falta título o fecha", type: "error" });
    setIsUploading(true);
    let uploadedImageUrl = null;
    try {
        if (imageFile) {
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressed = await imageCompression(imageFile, options);
            const formData = new FormData();
            formData.append("file", compressed); formData.append("upload_preset", UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
            const data = await res.json();
            uploadedImageUrl = data.secure_url;
        }
        const eventDocRef = await addDoc(collection(db, 'events'), {
            ...newEvent,
            endDate: newEvent.endDate || newEvent.date,
            image: uploadedImageUrl,
            createdAt: serverTimestamp(),
            assignments: {},
            createdBy: currentUser?.uid
        });
        if (newEvent.published) {
            await sendOneSignalNotification("Nueva actividad", newEvent.title, `/calendario/${eventDocRef.id}`);
        }
        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '', published: false });
        setImageFile(null);
        setToast({ message: "Evento guardado", type: "success" });
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); }
    finally { setIsUploading(false); }
  };

  // --- 5. RENDERIZADO DE VISTAS ---
  const renderListView = () => {
    if (filteredEvents.length === 0) return (
      <div className="py-24 text-center opacity-30 flex flex-col items-center">
        <CalIcon size={48} className="mb-4 text-slate-300"/>
        <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
          {filterType === 'mine' ? 'No tienes tareas asignadas\nen este periodo' : 'Sin actividades este mes'}
        </p>
      </div>
    );

    return (
      <div className="space-y-4 animate-fade-in px-4 text-left pb-20">
          {filteredEvents.map(event => {
            const config = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            const isMyTask = event.assignments && Object.values(event.assignments).flat().includes(currentUser?.displayName);
            return (
              <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} 
                   className={`bg-white p-5 rounded-[35px] border-2 flex gap-5 transition-all active:scale-95 cursor-pointer relative shadow-sm ${!event.published ? 'border-amber-200 bg-amber-50/10' : isMyTask ? 'border-brand-500 shadow-brand-100' : 'border-slate-50'}`}>
                
                {isMyTask && <div className="absolute -top-2.5 right-8 bg-brand-600 text-white px-3 py-1 rounded-full text-[8px] font-black tracking-widest shadow-lg border-2 border-white">MI TURNO</div>}

                <div className={`flex flex-col items-center justify-center px-4 rounded-3xl border-2 min-w-[75px] ${event.type === 'ayuno' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-[10px] font-black uppercase text-slate-400">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className={`text-2xl font-black ${event.type === 'ayuno' ? 'text-rose-600' : 'text-slate-900'}`}>{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-wrap gap-2">
                       <span className={`text-[9px] font-black px-2.5 py-1 rounded-xl uppercase tracking-widest ${config.color}`}>{config.label}</span>
                       {!event.published && <span className="text-[9px] font-black px-2.5 py-1 rounded-xl uppercase tracking-widest bg-amber-500 text-white flex items-center gap-1 shadow-sm"><EyeOff size={10}/> Borrador</span>}
                    </div>
                    {['pastor', 'lider'].includes(userRole) && (
                      <button onClick={(e) => { e.stopPropagation(); setActionConfirm({ type: 'delete', id: event.id, title: '¿Borrar evento?', message: 'Se eliminará permanentemente.' }); }} className="p-2 text-slate-200 hover:text-rose-500"><Trash2 size={16}/></button>
                    )}
                  </div>
                  <h4 className="font-black text-slate-800 text-lg leading-tight mt-2 uppercase tracking-tighter truncate">{event.title}</h4>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Clock size={14} className="text-brand-500"/> {event.time} hs</div>
                </div>
              </div>
            )
          })}
      </div>
    );
  };

  const renderMonthView = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="bg-white rounded-[45px] border-2 border-slate-50 shadow-xl p-7 animate-fade-in mx-4 mb-20">
            <div className="grid grid-cols-7 mb-4 border-b border-slate-50 pb-4">
                {weekDays.map(day => <div key={day} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonthDay = isSameMonth(day, currentDate);
                    const dayEvents = events.filter(e => {
                        const eventStart = new Date(e.date + 'T00:00:00');
                        const eventEnd = new Date((e.endDate || e.date) + 'T23:59:59');
                        return isWithinInterval(day, { start: eventStart, end: eventEnd });
                    });
                    const hasEvents = dayEvents.length > 0;
                    return (
                        <div key={day.toString()} 
                            onClick={() => hasEvents && setSelectedDayEvents({ date: day, events: dayEvents })}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all active:scale-90
                                ${!isCurrentMonthDay ? 'opacity-20' : 'text-slate-700'}
                                ${isToday ? 'bg-slate-900 text-white shadow-xl scale-110 z-10' : 'hover:bg-slate-50'}
                                ${hasEvents && isCurrentMonthDay && !isToday ? 'bg-brand-50 font-black text-brand-700' : ''}`}>
                            <span className="text-xs font-black">{format(day, 'd')}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="pb-36 pt-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit">
      
      {/* HEADER MINIMALISTA (Punto 2) */}
      <div className="px-6 flex justify-between items-center mb-6 sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md py-4">
        <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
              {viewMode === 'history' ? 'Historial' : 'Agenda'}
            </h1>
            <div className="h-1.5 w-10 bg-brand-500 rounded-full mt-2"></div>
        </div>
        <div className="flex bg-white p-1.5 rounded-[22px] border-2 border-slate-50 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300'}`}><List size={20}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'month' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300'}`}><LayoutGrid size={20}/></button>
            <button onClick={() => setViewMode('history')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'history' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300'}`}><History size={20}/></button>
        </div>
      </div>

      {/* ✅ FILTROS PRO (Punto 2) */}
      {viewMode === 'list' && (
        <div className="px-6 mb-8 flex gap-3">
           <button 
             onClick={() => setFilterType('mine')}
             className={`flex-1 py-4 rounded-3xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 ${filterType === 'mine' ? 'bg-brand-600 border-brand-600 text-white shadow-xl scale-105' : 'bg-white text-slate-400 border-white'}`}
           >
             <UserCheck size={16}/> Mis Turnos
           </button>
           <button 
             onClick={() => setFilterType('all')}
             className={`flex-1 py-4 rounded-3xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 ${filterType === 'all' ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 border-white'}`}
           >
             <Globe size={16}/> Agenda Global
           </button>
        </div>
      )}

      {/* AVISO BORRADORES (Solo Pastor) */}
      {['pastor', 'lider'].includes(userRole) && viewMode === 'list' && events.some(e => !e.published && isSameMonth(new Date(e.date + 'T00:00:00'), currentDate)) && (
          <div className="mx-6 bg-amber-500 p-6 rounded-[35px] mb-8 flex items-center justify-between shadow-xl shadow-amber-200/50">
             <div className="flex items-center gap-4 text-white text-left">
                <Megaphone size={26}/>
                <div><p className="text-xs font-black uppercase tracking-tighter">Borradores</p><p className="text-[9px] font-bold opacity-90 uppercase">Listos para lanzar</p></div>
             </div>
             <button onClick={() => setActionConfirm({ type: 'publish', title: '¿Lanzar Agenda?', message: 'Se notificará a la iglesia.' })} disabled={isPublishing} className="bg-white text-amber-600 px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg">
                {isPublishing ? <Loader2 size={12} className="animate-spin"/> : 'Publicar'}
             </button>
          </div>
      )}

      {/* SELECTOR DE MES */}
      {viewMode !== 'history' && (
        <div className="px-6 flex items-center justify-between bg-white mx-5 p-5 rounded-[30px] border border-slate-100 mb-8 shadow-sm">
           <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-3 text-slate-300 bg-slate-50 rounded-2xl active:scale-75 transition-transform"><ChevronLeft size={24} /></button>
           <h2 className="text-lg font-black text-slate-900 capitalize tracking-tighter">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
           <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-3 text-slate-300 bg-slate-50 rounded-2xl active:scale-75 transition-transform"><ChevronRight size={24} /></button>
        </div>
      )}

      {/* LISTADO DINÁMICO */}
      <div className="flex-1">
        {loading ? (
          <div className="py-24 text-center opacity-20"><Loader2 className="animate-spin mx-auto mb-4" size={48} strokeWidth={3}/></div>
        ) : (viewMode === 'month' ? renderMonthView() : renderListView())}
      </div>

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center z-40 border-4 border-white transition-transform active:scale-90">
          <Plus size={32} strokeWidth={3}/>
        </button>
      )}

      {/* --- MODALES SOPORTE (selectedDayEvents, isModalOpen, actionConfirm, toast) --- */}
      {/* ... (Se mantienen idénticos a tu versión original para no romper funcionalidad) ... */}
      
      {selectedDayEvents && (
        <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setSelectedDayEvents(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[50px] p-10 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 text-left">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{format(selectedDayEvents.date, "EEEE d", { locale: es })}</h3>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{format(selectedDayEvents.date, "MMMM", { locale: es })}</p>
              </div>
              <button onClick={() => setSelectedDayEvents(null)} className="p-3 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar pb-6">
              {selectedDayEvents.events.map(ev => (
                <button key={ev.id} onClick={() => { setSelectedDayEvents(null); navigate(`/calendario/${ev.id}`); }} className="w-full flex items-center justify-between p-6 bg-slate-50 rounded-[30px] border-2 border-slate-100 active:scale-95 transition-all">
                  <div className="flex items-center gap-5 text-left">
                    <div className={`p-4 rounded-2xl ${EVENT_TYPES[ev.type]?.color || 'bg-slate-200'}`}>
                      {(() => { const Icon = EVENT_TYPES[ev.type]?.icon || CalIcon; return <Icon size={24}/> })()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{ev.title}</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">{ev.time} hs</p>
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[45px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative animate-slide-up">
                <div className="flex justify-between items-center mb-8 border-b pb-5 border-slate-50 text-left">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Planificar</h2>
                        <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Actividad Ministerial</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400"><X size={24}/></button>
                </div>
                <div className="space-y-6 text-left">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Título</label>
                        <input type="text" placeholder="Nombre de la actividad" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] font-black text-slate-800 outline-none focus:border-brand-500 uppercase text-sm" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Fecha</label>
                            <input type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] outline-none text-xs font-black uppercase" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Hora</label>
                            <input type="time" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] outline-none text-xs font-black uppercase" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                    </div>
                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-5 rounded-[28px] border-2 flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">¿Notificar iglesia?</span>
                        {newEvent.published ? <CheckCircle size={24}/> : <EyeOff size={24}/>}
                    </button>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Tipo</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(EVENT_TYPES).map(([key, config]) => (
                                <button key={key} onClick={() => setNewEvent({...newEvent, type: key})} className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-[10px] font-black uppercase transition-all ${newEvent.type === key ? config.color + ' border-current shadow-md' : 'bg-white border-slate-50 text-slate-300'}`}>
                                  <config.icon size={18}/> {config.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-6 rounded-[35px] shadow-2xl mt-4 active:scale-95 transition-all disabled:opacity-50 uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-3">
                        {isUploading ? <Loader2 className="animate-spin" size={24}/> : "Confirmar Actividad"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {actionConfirm && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[45px] p-10 shadow-2xl text-center">
            <div className={`w-20 h-20 rounded-[30px] mx-auto mb-6 flex items-center justify-center ${actionConfirm.type === 'delete' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertCircle size={44} strokeWidth={3}/>
            </div>
            <h4 className="font-black text-slate-900 text-xl mb-3 uppercase tracking-tighter leading-tight">{actionConfirm.title}</h4>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-10 leading-relaxed">{actionConfirm.message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeConfirmedAction} className={`w-full py-5 rounded-2xl font-black text-xs uppercase shadow-xl ${actionConfirm.type === 'delete' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>Sí, confirmar</button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-5 rounded-2xl font-black text-xs uppercase text-slate-400 bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[600] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <CheckCircle size={24}/>
            <span className="text-[11px] font-black uppercase tracking-widest leading-none">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}