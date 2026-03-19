import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  deleteDoc, doc, getDoc, serverTimestamp,
  getDocs, where, writeBatch
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

  // ✅ FUNCIÓN DE NOTIFICACIÓN CORREGIDA
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
          included_segments: ["Subscribed Users"], 
          headings: { en: notifTitle, es: notifTitle },
          contents: { en: notifBody, es: notifBody },
          url: webUrl,
          data: { route: path },
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
        // ✅ Llamada corregida
        await sendOneSignalNotification(
          `📅 Agenda de ${monthName} lista`,
          "Se publicaron las nuevas actividades. ¡Revisa las fechas!",
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

        if (newEvent.published) {
            const dateStr = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es });
            const typeLabel = EVENT_TYPES[newEvent.type]?.label || "Evento";
            // ✅ Llamada corregida con los nombres de variables nuevos
            await sendOneSignalNotification(
              `Nuevo evento: ${typeLabel}`,
              `${newEvent.title} - 📅 ${dateStr}`,
              `/calendario/${eventDocRef.id}`
            );
        }

        if (newEvent.type === 'ayuno') {
            await addDoc(collection(db, 'posts'), {
                type: 'Devocional', title: `🔥 Ayuno: ${newEvent.title}`,
                content: newEvent.description || 'Únete a este tiempo.',
                image: uploadedImageUrl, eventId: eventDocRef.id,
                createdAt: serverTimestamp(), authorId: auth.currentUser.uid,
                authorName: auth.currentUser.displayName
            });
        }
        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '', published: false });
        setImageFile(null); setImagePreview(null);
        setToast({ message: "Evento guardado en agenda", type: "success" });
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
    if (filteredEvents.length === 0) return <div className="text-center py-12"><CalIcon size={48} className="mx-auto text-slate-200 mb-4"/><p className="text-slate-500 font-medium">Sin eventos.</p></div>;
    return (
      <div className="space-y-4 animate-fade-in">
          {filteredEvents.map(event => {
            const config = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            return (
              <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className={`bg-white p-4 rounded-2xl border flex gap-4 transition-all cursor-pointer relative ${!event.published ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 shadow-sm'}`}>
                <div className={`flex flex-col items-center justify-center px-3 rounded-xl border min-w-[60px] ${event.type === 'ayuno' ? 'bg-rose-50' : 'bg-slate-50'}`}>
                  <span className="text-[10px] font-bold uppercase text-slate-400">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className="text-xl font-black text-slate-800">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2">
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${config.color}`}>{config.label}</span>
                       {!event.published && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase bg-amber-500 text-white flex items-center gap-1"><EyeOff size={10}/> Borrador</span>}
                    </div>
                    {['pastor', 'lider'].includes(userRole) && (
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setActionConfirm({ type: 'delete', id: event.id, title: '¿Borrar evento?', message: `Se eliminará "${event.title}" y todos sus avisos.` });
                      }} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={16}/>
                      </button>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 text-base leading-tight mt-1">{event.title}</h4>
                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-500"><Clock size={14}/> {event.time} hs</div>
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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-fade-in">
            <div className="grid grid-cols-7 mb-2 border-b border-slate-50 pb-2">
                {weekDays.map(day => <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonthDay = isSameMonth(day, currentDate);
                    const dayEvents = events.filter(e => isSameDay(new Date(e.date + 'T00:00:00'), day));
                    const hasEvents = dayEvents.length > 0;
                    return (
                        <div key={day.toString()} onClick={() => hasEvents && setSelectedDayEvents({ date: day, events: dayEvents })}
                            className={`aspect-square rounded-xl flex flex-col items-center justify-center relative cursor-pointer transition-all
                                ${!isCurrentMonthDay ? 'text-slate-200' : 'text-slate-700'}
                                ${isToday ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}
                                ${hasEvents && !isToday && isCurrentMonthDay ? 'bg-brand-50 font-bold text-brand-700' : ''}`}>
                            <span className="text-xs">{format(day, 'd')}</span>
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
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in relative">
      <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2">
        <h1 className="text-2xl font-black text-slate-800">Agenda</h1>
        <div className="flex bg-white p-1 rounded-xl border shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg ${viewMode === 'month' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}><CalIcon size={18}/></button>
        </div>
      </div>

      {['pastor', 'lider'].includes(userRole) && filteredEvents.some(e => !e.published) && (
          <div className="bg-amber-100 border border-amber-200 p-4 rounded-2xl mb-6 flex items-center justify-between animate-pulse">
             <div className="flex items-center gap-3 text-amber-800"><Megaphone size={20}/><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-tighter">Cronograma Oculto</p><p className="text-[10px] font-bold opacity-70">Hay eventos que el equipo aún no ve.</p></div></div>
             <button
                onClick={() => setActionConfirm({ type: 'publish', title: '¿Publicar cronograma?', message: 'Se notificará a todo el equipo sobre las nuevas actividades.' })}
                disabled={isPublishing}
                className="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md flex items-center gap-2 active:scale-95 transition-all"
             >
                {isPublishing ? <Loader2 size={12} className="animate-spin"/> : <><Send size={12}/> PUBLICAR</>}
             </button>
          </div>
      )}

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
         <button onClick={prevMonth} className="p-2 text-slate-400"><ChevronLeft size={24} /></button>
         <h2 className="text-lg font-black text-slate-800 capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
         <button onClick={nextMonth} className="p-2 text-slate-400"><ChevronRight size={24} /></button>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32}/></div> : (viewMode === 'list' ? renderListView() : renderMonthView())}

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-4 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center z-40 active:scale-90"><Plus size={28} /></button>
      )}

      {actionConfirm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xs rounded-[35px] p-8 shadow-2xl text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center ${actionConfirm.type === 'delete' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertCircle size={32}/>
            </div>
            <h4 className="font-black text-slate-800 text-lg mb-2">{actionConfirm.title}</h4>
            <p className="text-xs text-slate-500 font-bold mb-8 uppercase tracking-widest leading-relaxed">{actionConfirm.message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeConfirmedAction} className={`w-full py-4 rounded-2xl font-black text-xs uppercase shadow-lg ${actionConfirm.type === 'delete' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>
                Confirmar Acción
              </button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-4 rounded-2xl font-black text-xs uppercase text-slate-400 bg-slate-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-6 right-6 z-[150] animate-slide-up">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-[22px] shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-rose-600 text-white'}`}>
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[35px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-slate-800">Nuevo Evento</h2><button onClick={() => setIsModalOpen(false)}><X size={20}/></button></div>
                <div className="space-y-4">
                    <input type="text" placeholder="Título" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" className="p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        <input type="time" className="p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                    </div>
                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-inner' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                       <span className="text-[10px] font-black uppercase tracking-wider">¿Notificar ya mismo?</span>
                       {newEvent.published ? <CheckCircle size={20}/> : <XCircle size={20}/>}
                    </button>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {Object.entries(EVENT_TYPES).map(([key, config]) => (
                            <button key={key} onClick={() => setNewEvent({...newEvent, type: key})} className={`flex items-center gap-2 p-2.5 rounded-xl border text-[10px] font-black uppercase transition-all ${newEvent.type === key ? config.color : 'bg-white border-slate-100 text-slate-400'}`}><config.icon size={16}/> {config.label}</button>
                        ))}
                    </div>
                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl mt-2 active:scale-95 transition-transform disabled:opacity-50">
                        {isUploading ? <Loader2 className="animate-spin" size={20}/> : "GUARDAR EN AGENDA"}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}