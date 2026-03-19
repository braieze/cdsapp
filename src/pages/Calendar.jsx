import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  deleteDoc, doc, getDoc, serverTimestamp,
  getDocs, where, writeBatch, updateDoc
} from 'firebase/firestore';
import {
  Plus, Calendar as CalIcon, List, Clock, Trash2, X,
  ChevronLeft, ChevronRight, Loader2, Megaphone,
  Send, EyeOff, CheckCircle, XCircle, ImageIcon,
  Check, Info, AlertCircle 
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, addMonths, subMonths, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
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
  const [imagePreview, setImagePreview] = useState(null);
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

  // ✅ 1. FUNCIÓN DE NOTIFICACIÓN (Sincronizada con el éxito de Home)
  const sendOneSignalNotification = async (notifTitle, notifBody, path) => {
    try {
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

      if (!REST_API_KEY) {
        console.error("❌ No se encontró la REST_API_KEY");
        return;
      }

      const webUrl = `https://cdsapp.vercel.app/#${path}`;

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          included_segments: ["Total Subscriptions"], // 🎯 Segmento verificado
          headings: { en: notifTitle, es: notifTitle },
          contents: { en: notifBody, es: notifBody },
          url: webUrl,
          data: { route: path },
          isAnyWeb: true,
          isAndroid: true,
          isIos: true,
          priority: 10
        })
      });

      const data = await response.json();
      console.log("✅ Respuesta Calendario OneSignal:", data);
    } catch (error) { 
      console.error("❌ Error OneSignal Calendario:", error); 
    }
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
        
        // ✅ Notificación masiva de mes publicado
        await sendOneSignalNotification(
          `📅 Agenda de ${monthName} lista`,
          "Se publicaron las nuevas actividades. ¡Revisa las fechas en la app!",
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
        if (imageFile && newEvent.type === 'ayuno') {
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressed = await imageCompression(imageFile, options);
            const formData = new FormData();
            formData.append("file", compressed); formData.append("upload_preset", UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
            const data = await res.json();
            uploadedImageUrl = data.secure_url;
        }

        const finalEndDate = newEvent.type === 'ayuno' && newEvent.endDate ? newEvent.endDate : newEvent.date;
        const eventDocRef = await addDoc(collection(db, 'events'), {
            ...newEvent,
            endDate: finalEndDate,
            image: uploadedImageUrl,
            createdAt: serverTimestamp(),
            assignments: {},
            createdBy: auth.currentUser?.uid
        });

        // ✅ Notificación individual (si se marca como publicar ahora)
        if (newEvent.published) {
            const dateStr = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es });
            const typeLabel = EVENT_TYPES[newEvent.type]?.label || "Evento";
            
            await sendOneSignalNotification(
              `Nuevo evento: ${typeLabel}`,
              `${newEvent.title} - 📅 ${dateStr} a las ${newEvent.time}hs`,
              `/calendario/${eventDocRef.id}`
            );
        }

        if (newEvent.type === 'ayuno') {
            await addDoc(collection(db, 'posts'), {
                type: 'Devocional', title: `🔥 Ayuno: ${newEvent.title}`,
                content: newEvent.description || 'Únete a este tiempo especial de búsqueda.',
                image: uploadedImageUrl, eventId: eventDocRef.id,
                createdAt: serverTimestamp(), authorId: auth.currentUser.uid,
                authorName: auth.currentUser.displayName
            });
        }
        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '', published: false });
        setImageFile(null); setImagePreview(null);
        setToast({ message: "Evento guardado correctamente", type: "success" });
    } catch (error) { 
        console.error(error);
        setToast({ message: "Error al guardar", type: "error" }); 
    }
    finally { setIsUploading(false); }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const filteredEvents = events.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), currentDate));

  const renderListView = () => {
    if (filteredEvents.length === 0) return <div className="text-center py-12"><CalIcon size={48} className="mx-auto text-slate-200 mb-4"/><p className="text-slate-500 font-medium tracking-tight">No hay actividades programadas este mes.</p></div>;
    return (
      <div className="space-y-4 animate-fade-in">
          {filteredEvents.map(event => {
            const config = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            return (
              <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className={`bg-white p-4 rounded-3xl border flex gap-4 transition-all cursor-pointer relative ${!event.published ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 shadow-sm'}`}>
                <div className={`flex flex-col items-center justify-center px-3 rounded-2xl border min-w-[65px] ${event.type === 'ayuno' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-[10px] font-black uppercase text-slate-400">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className="text-2xl font-black text-slate-900">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-wrap gap-1.5">
                       <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${config.color}`}>{config.label}</span>
                       {!event.published && <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-amber-500 text-white flex items-center gap-1 shadow-sm"><EyeOff size={10}/> Borrador</span>}
                    </div>
                    {['pastor', 'lider'].includes(userRole) && (
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setActionConfirm({ type: 'delete', id: event.id, title: '¿Borrar evento?', message: `Se eliminará "${event.title}" de la agenda permanentemente.` });
                      }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={18}/>
                      </button>
                    )}
                  </div>
                  <h4 className="font-black text-slate-800 text-base leading-tight mt-2 uppercase tracking-tighter">{event.title}</h4>
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-slate-400 uppercase"><Clock size={14} className="text-brand-500"/> {event.time} hs</div>
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
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-5 animate-fade-in">
            <div className="grid grid-cols-7 mb-4 border-b border-slate-50 pb-3">
                {weekDays.map(day => <div key={day} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonthDay = isSameMonth(day, currentDate);
                    const dayEvents = events.filter(e => isSameDay(new Date(e.date + 'T00:00:00'), day));
                    const hasEvents = dayEvents.length > 0;
                    return (
                        <div key={day.toString()} onClick={() => hasEvents && setSelectedDayEvents({ date: day, events: dayEvents })}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all
                                ${!isCurrentMonthDay ? 'text-slate-200' : 'text-slate-700'}
                                ${isToday ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50'}
                                ${hasEvents && !isToday && isCurrentMonthDay ? 'bg-brand-50 font-black text-brand-700' : ''}`}>
                            <span className="text-xs font-bold">{format(day, 'd')}</span>
                            <div className="flex gap-0.5 mt-1 h-1">
                                {dayEvents.slice(0, 3).map((ev, i) => <div key={i} className={`w-1 h-1 rounded-full ${EVENT_TYPES[ev.type]?.dot || 'bg-slate-400'}`}></div>)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="pb-32 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit">
      <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md py-2 px-1">
        <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Agenda</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cronograma de actividades</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}><List size={20}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'month' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}><CalIcon size={20}/></button>
        </div>
      </div>

      {['pastor', 'lider'].includes(userRole) && filteredEvents.some(e => !e.published) && (
          <div className="bg-amber-600 p-5 rounded-[30px] mb-6 flex items-center justify-between shadow-xl shadow-amber-200/50 animate-pulse border-2 border-amber-400">
             <div className="flex items-center gap-3 text-white">
                <Megaphone size={24}/>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-tighter">Eventos Ocultos</p>
                    <p className="text-[9px] font-bold opacity-80 uppercase tracking-widest">Toca para avisar al equipo</p>
                </div>
             </div>
             <button
                onClick={() => setActionConfirm({ type: 'publish', title: '¿Publicar cronograma?', message: 'Se enviará una notificación a toda la iglesia con las nuevas fechas.' })}
                disabled={isPublishing}
                className="bg-white text-amber-600 px-5 py-2.5 rounded-2xl text-[10px] font-black shadow-lg flex items-center gap-2 active:scale-95 transition-all"
             >
                {isPublishing ? <Loader2 size={12} className="animate-spin"/> : <><Send size={14}/> PUBLICAR</>}
             </button>
          </div>
      )}

      <div className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-6">
         <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><ChevronLeft size={28} /></button>
         <h2 className="text-lg font-black text-slate-800 capitalize tracking-tight">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
         <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><ChevronRight size={28} /></button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
            <Loader2 className="animate-spin text-slate-900 mb-4" size={40}/>
            <span className="text-[10px] font-black uppercase tracking-widest">Cargando Agenda...</span>
        </div>
      ) : (viewMode === 'list' ? renderListView() : renderMonthView())}

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 right-6 w-16 h-16 bg-brand-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 border-4 border-white"><Plus size={32} /></button>
      )}

      {/* CONFIRMACIÓN DE ACCIONES */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center animate-scale-in">
            <div className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center ${actionConfirm.type === 'delete' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertCircle size={32}/>
            </div>
            <h4 className="font-black text-slate-900 text-xl mb-2 uppercase tracking-tighter">{actionConfirm.title}</h4>
            <p className="text-[10px] text-slate-500 font-bold mb-8 uppercase tracking-widest leading-relaxed">{actionConfirm.message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeConfirmedAction} className={`w-full py-4 rounded-2xl font-black text-xs uppercase shadow-xl transition-all active:scale-95 ${actionConfirm.type === 'delete' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>
                Confirmar
              </button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-4 rounded-2xl font-black text-xs uppercase text-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EVENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[45px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative animate-slide-up">
                <div className="flex justify-between items-center mb-8 border-b pb-4 border-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Nuevo Evento</h2>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Planifica las actividades</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="space-y-5">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Título del evento</label>
                        <input type="text" placeholder="Ej: Escuela Bíblica" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-brand-500 transition-all" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Fecha</label>
                            <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-black uppercase" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Hora</label>
                            <input type="time" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-black uppercase" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                    </div>

                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-5 rounded-3xl border-2 flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl shadow-emerald-100' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                       <span className="text-[10px] font-black uppercase tracking-[0.2em]">¿Notificar al crear?</span>
                       {newEvent.published ? <CheckCircle size={24} fill="white" className="text-emerald-600"/> : <XCircle size={24}/>}
                    </button>

                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Tipo de Actividad</label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                            {Object.entries(EVENT_TYPES).map(([key, config]) => (
                                <button key={key} onClick={() => setNewEvent({...newEvent, type: key})} className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-[9px] font-black uppercase tracking-widest transition-all ${newEvent.type === key ? config.color + ' shadow-md scale-[0.98]' : 'bg-white border-slate-50 text-slate-300'}`}><config.icon size={16}/> {config.label}</button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-5 rounded-[28px] shadow-2xl mt-4 active:scale-95 transition-all disabled:opacity-50 uppercase text-[11px] tracking-[0.3em]">
                        {isUploading ? <Loader2 className="animate-spin mx-auto" size={24}/> : "Confirmar Evento"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[400] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            {toast.type === 'success' ? <CheckCircle size={24}/> : <AlertCircle size={24}/>}
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}