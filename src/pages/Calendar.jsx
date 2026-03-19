import { useState, useEffect } from 'react';
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
  AlertCircle, ChevronRight as ArrowRight
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { 
  format, addMonths, subMonths, isSameMonth, startOfMonth, 
  endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, 
  isSameDay, isWithinInterval, parseISO 
} from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [toast, setToast] = useState(null);
  const [actionConfirm, setActionConfirm] = useState(null);

  const CLOUD_NAME = "djmkggzjp";
  const UPLOAD_PRESET = "ml_default";

  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '',
    published: false
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ✅ FUNCIÓN DE ENVÍO BLINDADA (SOLO RUTA INTERNA)
  const sendOneSignalNotification = async (notifTitle, notifBody, path) => {
    try {
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

      if (!REST_API_KEY) return;

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          included_segments: ["Total Subscriptions"],
          headings: { en: notifTitle, es: notifTitle },
          contents: { en: notifBody, es: notifBody },
          // 🎯 ELIMINAMOS url y web_url PARA QUE NO ABRA EL NAVEGADOR
          // Dejamos solo data para que App.jsx capture la ruta internamente
          data: { route: path }, 
          isAndroid: true,
          isIos: true,
          priority: 10
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
        const monthEvents = filteredEvents.filter(e => !e.published);
        const batch = writeBatch(db);
        monthEvents.forEach(e => {
          batch.update(doc(db, 'events', e.id), { published: true, updatedAt: serverTimestamp() });
        });
        await batch.commit();
        
        const monthName = format(currentDate, 'MMMM', { locale: es });
        await sendOneSignalNotification(
          `📅 Agenda de ${monthName} lista`,
          "Se publicaron las nuevas actividades. ¡Miralas ahora!",
          "/calendario"
        );
        setToast({ message: "¡Todo el mes publicado!", type: "success" });
      } catch (e) { setToast({ message: "Error al publicar", type: "error" }); }
      finally { setIsPublishing(false); }
    }
  };

  useEffect(() => {
    const fetchUserRole = async () => {
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
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
  }, []);

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

        const finalEndDate = newEvent.endDate || newEvent.date;

        const eventDocRef = await addDoc(collection(db, 'events'), {
            ...newEvent,
            endDate: finalEndDate,
            image: uploadedImageUrl,
            createdAt: serverTimestamp(),
            assignments: {},
            createdBy: auth.currentUser?.uid
        });

        if (newEvent.published) {
            const dateStr = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d", { locale: es });
            const typeLabel = EVENT_TYPES[newEvent.type]?.label || "Evento";
            await sendOneSignalNotification(
              `Nueva actividad: ${typeLabel}`,
              `${newEvent.title} - 📅 ${dateStr}`,
              `/calendario/${eventDocRef.id}`
            );
        }

        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '', published: false });
        setImageFile(null);
        setToast({ message: "Evento guardado", type: "success" });
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); }
    finally { setIsUploading(false); }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  
  const filteredEvents = events.filter(e => {
    const start = new Date(e.date + 'T00:00:00');
    const end = new Date((e.endDate || e.date) + 'T23:59:59');
    return isSameMonth(start, currentDate) || isSameMonth(end, currentDate);
  });

  const renderListView = () => {
    if (filteredEvents.length === 0) return (
      <div className="text-center py-16 opacity-40">
        <CalIcon size={64} className="mx-auto text-slate-300 mb-4" strokeWidth={1} />
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sin actividades este mes</p>
      </div>
    );

    return (
      <div className="space-y-4 animate-fade-in px-2 text-left">
          {filteredEvents.map(event => {
            const config = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            return (
              <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className={`bg-white p-5 rounded-[32px] border-2 flex gap-5 transition-all active:scale-[0.98] cursor-pointer relative shadow-sm ${!event.published ? 'border-amber-100 bg-amber-50/20' : 'border-slate-50'}`}>
                <div className={`flex flex-col items-center justify-center px-4 rounded-2xl border-2 min-w-[70px] ${event.type === 'ayuno' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-[10px] font-black uppercase text-slate-400">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className={`text-2xl font-black ${event.type === 'ayuno' ? 'text-rose-600' : 'text-slate-900'}`}>{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-wrap gap-2">
                       <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${config.color}`}>{config.label}</span>
                       {!event.published && <span className="text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest bg-amber-500 text-white flex items-center gap-1 shadow-sm"><EyeOff size={10}/> Borrador</span>}
                    </div>
                    {['pastor', 'lider'].includes(userRole) && (
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setActionConfirm({ type: 'delete', id: event.id, title: '¿Borrar evento?', message: `Se eliminará permanentemente de la agenda.` });
                      }} className="p-2 text-slate-200 hover:text-rose-500 transition-colors">
                        <Trash2 size={18}/>
                      </button>
                    )}
                  </div>
                  <h4 className="font-black text-slate-800 text-lg leading-tight mt-2 uppercase tracking-tighter truncate">{event.title}</h4>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Clock size={14} className="text-brand-500"/> {event.time} hs
                  </div>
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
        <div className="bg-white rounded-[40px] border-2 border-slate-50 shadow-xl p-6 animate-fade-in mx-2">
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
    <div className="pb-32 pt-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit">
      
      <div className="px-6 flex justify-between items-center mb-8 sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md py-4">
        <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Agenda</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Actividades CDS</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-[22px] border-2 border-slate-50 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300'}`}><List size={20}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'month' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300'}`}><CalIcon size={20}/></button>
        </div>
      </div>

      {['pastor', 'lider'].includes(userRole) && filteredEvents.some(e => !e.published) && (
          <div className="mx-6 bg-amber-500 p-6 rounded-[35px] mb-8 flex items-center justify-between shadow-xl animate-pulse">
             <div className="flex items-center gap-4 text-white text-left">
                <Megaphone size={24}/>
                <div>
                    <p className="text-xs font-black uppercase tracking-tighter">Borradores</p>
                    <p className="text-[9px] font-bold opacity-80 uppercase">Pulsa para publicar</p>
                </div>
             </div>
             <button
                onClick={() => setActionConfirm({ type: 'publish', title: '¿Publicar Mes?', message: 'Se notificará a la iglesia.' })}
                disabled={isPublishing}
                className="bg-white text-amber-600 px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg"
             >
                {isPublishing ? <Loader2 size={12} className="animate-spin"/> : 'Publicar'}
             </button>
          </div>
      )}

      <div className="px-6 flex items-center justify-between bg-white mx-4 p-5 rounded-[30px] border border-slate-100 mb-8 shadow-sm">
         <button onClick={prevMonth} className="p-3 text-slate-300 bg-slate-50 rounded-2xl"><ChevronLeft size={24} /></button>
         <h2 className="text-lg font-black text-slate-900 capitalize tracking-tighter">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
         <button onClick={nextMonth} className="p-3 text-slate-300 bg-slate-50 rounded-2xl"><ChevronRight size={24} /></button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 opacity-20">
            <Loader2 className="animate-spin text-slate-900 mb-4" size={48} strokeWidth={3}/>
            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Sincronizando...</span>
        </div>
      ) : (viewMode === 'list' ? renderListView() : renderMonthView())}

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 right-6 w-16 h-16 bg-brand-600 text-white rounded-[24px] shadow-2xl flex items-center justify-center z-40 border-4 border-white transition-transform active:scale-90">
          <Plus size={32} strokeWidth={3}/>
        </button>
      )}

      {/* MODAL EVENTOS DÍA */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setSelectedDayEvents(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[50px] p-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 text-left">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{format(selectedDayEvents.date, "EEEE d", { locale: es })}</h3>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{format(selectedDayEvents.date, "MMMM", { locale: es })}</p>
              </div>
              <button onClick={() => setSelectedDayEvents(null)} className="p-3 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar pb-6">
              {selectedDayEvents.events.map(ev => (
                <button key={ev.id} onClick={() => { setSelectedDayEvents(null); navigate(`/calendario/${ev.id}`); }} className="w-full flex items-center justify-between p-5 bg-slate-50 rounded-[28px] border-2 border-slate-100">
                  <div className="flex items-center gap-4 text-left">
                    <div className={`p-3 rounded-2xl ${EVENT_TYPES[ev.type]?.color || 'bg-slate-200'}`}>
                      {(() => { const Icon = EVENT_TYPES[ev.type]?.icon || CalIcon; return <Icon size={20}/> })()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{ev.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{ev.time} hs</p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EVENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[45px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative animate-slide-up">
                <div className="flex justify-between items-center mb-8 border-b pb-5 border-slate-50 text-left">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Planificar</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividades CDS</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full"><X size={24}/></button>
                </div>
                <div className="space-y-6 text-left">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Título</label>
                        <input type="text" placeholder="Nombre del evento" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] font-black text-slate-800 outline-none focus:border-brand-500 uppercase text-sm" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Fecha</label>
                            <input type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] outline-none text-xs font-black uppercase" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Hora</label>
                            <input type="time" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] outline-none text-xs font-black uppercase" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                    </div>
                    {(newEvent.type === 'ayuno' || newEvent.type === 'especial') && (
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-rose-400 uppercase ml-4 tracking-widest">Hasta (Opcional)</label>
                          <input type="date" className="w-full p-4 bg-rose-50/30 border-2 border-rose-100 rounded-[20px] outline-none text-xs font-black uppercase text-rose-600" value={newEvent.endDate} onChange={e => setNewEvent({...newEvent, endDate: e.target.value})} />
                      </div>
                    )}
                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-5 rounded-[28px] border-2 flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                       <span className="text-[10px] font-black uppercase tracking-widest">¿Notificar iglesia?</span>
                       {newEvent.published ? <CheckCircle size={24}/> : <XCircle size={24}/>}
                    </button>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Tipo</label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                            {Object.entries(EVENT_TYPES).map(([key, config]) => (
                                <button key={key} onClick={() => setNewEvent({...newEvent, type: key})} className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-[10px] font-black uppercase transition-all ${newEvent.type === key ? config.color + ' border-current' : 'bg-white border-slate-50 text-slate-300'}`}>
                                  <config.icon size={16}/> {config.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-6 rounded-[30px] shadow-2xl mt-4 active:scale-95 transition-all disabled:opacity-50 uppercase text-xs tracking-[0.3em]">
                        {isUploading ? <Loader2 className="animate-spin mx-auto" size={24}/> : "Confirmar Actividad"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ALERTAS ACCIÓN */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[45px] p-10 shadow-2xl text-center">
            <div className={`w-20 h-20 rounded-[30px] mx-auto mb-6 flex items-center justify-center ${actionConfirm.type === 'delete' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertCircle size={40} strokeWidth={3}/>
            </div>
            <h4 className="font-black text-slate-900 text-xl mb-3 uppercase tracking-tighter">{actionConfirm.title}</h4>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-10 leading-relaxed">{actionConfirm.message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeConfirmedAction} className={`w-full py-5 rounded-2xl font-black text-xs uppercase shadow-xl ${actionConfirm.type === 'delete' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>Confirmar</button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-5 rounded-2xl font-black text-xs uppercase text-slate-400 bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[600] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <CheckCircle size={24}/>
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}