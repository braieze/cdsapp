import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  Timestamp, deleteDoc, doc, getDoc, serverTimestamp, 
  getDocs, where, writeBatch 
} from 'firebase/firestore'; 
import { 
  Plus, Calendar as CalIcon, List, Clock, Trash2, X, 
  Calendar, ChevronLeft, ChevronRight, Loader2, 
  Send, EyeOff, CheckCircle, Megaphone
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

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '',
    published: false // ✅ POR DEFECTO ES BORRADOR
  });

  // ✅ FUNCIÓN: NOTIFICACIÓN GLOBAL (Para el botón Publicar Mes)
  const sendBulkNotification = async (monthName) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      let tokens = [];
      usersSnap.forEach(d => { if (d.data().fcmTokens) tokens.push(...d.data().fcmTokens); });
      const uniqueTokens = [...new Set(tokens)].filter(t => t?.length > 10);
      if (uniqueTokens.length === 0) return;

      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `📅 Cronograma de ${monthName} listo`,
          body: "Se han publicado las nuevas actividades. ¡Revisá tus turnos!",
          tokens: uniqueTokens,
          url: "/servicios"
        })
      });
    } catch (e) { console.error(e); }
  };

  // ✅ FUNCIÓN: BORRADO EN CASCADA (Punto 1)
  const handleDeleteEvent = async (id) => {
    if(!window.confirm("¿Borrar evento? Se eliminarán también las notificaciones de los servidores.")) return;
    try {
        // 1. Borrar evento
        await deleteDoc(doc(db, 'events', id));

        // 2. Buscar y borrar notificaciones asociadas en todos los usuarios
        const usersSnap = await getDocs(collection(db, "users"));
        const batch = writeBatch(db);
        
        for (const userDoc of usersSnap.docs) {
            const notifRef = collection(db, `users/${userDoc.id}/notifications`);
            const q = query(notifRef, where("eventId", "==", id));
            const notifs = await getDocs(q);
            notifs.forEach(n => batch.delete(n.ref));
        }
        await batch.commit();
        alert("Evento y notificaciones eliminadas.");
    } catch (e) { console.error(e); }
  };

  // ✅ FUNCIÓN: PUBLICAR TODO EL MES (Punto 3)
  const handlePublishMonth = async () => {
    const monthEvents = filteredEvents.filter(e => !e.published);
    if (monthEvents.length === 0) return alert("No hay borradores para publicar en este mes.");
    if (!window.confirm(`¿Publicar ${monthEvents.length} eventos y notificar a todo el equipo?`)) return;

    setIsPublishing(true);
    try {
      const batch = writeBatch(db);
      monthEvents.forEach(e => {
        batch.update(doc(db, 'events', e.id), { published: true, updatedAt: serverTimestamp() });
        // Aquí podrías crear un documento de notificación en la DB de cada servidor si usas In-App alerts
      });
      await batch.commit();
      
      const monthName = format(currentDate, 'MMMM', { locale: es });
      await sendBulkNotification(monthName);
      alert("¡Cronograma publicado con éxito!");
    } catch (e) { console.error(e); } finally { setIsPublishing(false); }
  };

  const sendEventNotification = async (eventTitle, eventDate, eventUrl, eventType) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      let tokens = [];
      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.fcmTokens) tokens.push(...data.fcmTokens);
      });
      const uniqueTokens = [...new Set(tokens)].filter(t => t && t.length > 10);
      if (uniqueTokens.length === 0) return;

      const typeLabel = EVENT_TYPES[eventType]?.label || eventType;
      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Nuevo evento: ${typeLabel}`, 
          body: `${eventTitle} - 📅 ${eventDate}`,
          tokens: uniqueTokens,
          url: eventUrl 
        })
      });
    } catch (error) { console.error(error); }
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
    if (!newEvent.title || !newEvent.date) return alert("Falta título o fecha");
    setIsUploading(true);
    let uploadedImageUrl = null;

    try {
        if (imageFile && newEvent.type === 'ayuno') {
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressedFile = await imageCompression(imageFile, options);
            const formData = new FormData();
            formData.append("file", compressedFile);
            formData.append("upload_preset", UPLOAD_PRESET); 
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
            const data = await response.json();
            if (data.secure_url) uploadedImageUrl = data.secure_url;
        }

        const finalEndDate = newEvent.type === 'ayuno' && newEvent.endDate ? newEvent.endDate : newEvent.date;

        const eventDocRef = await addDoc(collection(db, 'events'), {
            ...newEvent,
            endDate: finalEndDate,
            image: uploadedImageUrl,
            createdAt: serverTimestamp(), // ✅ IMPORTANTE: Ordenar notis por esto
            assignments: {}, 
            published: newEvent.published, // Puede venir marcado desde el modal
            checklist: (newEvent.type === 'limpieza' || newEvent.type === 'mantenimiento') 
                ? [{text: 'Limpieza General', completed: false}, {text: 'Baños', completed: false}] 
                : [],
            createdBy: auth.currentUser?.uid
        });

        // ✅ SOLO NOTIFICA AL INSTANTE SI SE MARCA "PUBLICAR AHORA"
        if (newEvent.published) {
            const dateForNotif = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es });
            await sendEventNotification(newEvent.title, dateForNotif, `/calendario/${eventDocRef.id}`, newEvent.type);
        }

        if (newEvent.type === 'ayuno') {
            await addDoc(collection(db, 'posts'), {
                type: 'Devocional',
                title: `🔥 Ayuno: ${newEvent.title}`,
                content: `${newEvent.description || 'Únete a este tiempo especial.'}`,
                image: uploadedImageUrl,
                eventId: eventDocRef.id, // ✅ Vínculo para borrado en cascada
                createdAt: serverTimestamp(),
            });
        }

        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '', published: false });
        setImageFile(null); setImagePreview(null);
    } catch (error) { console.error(error); } finally { setIsUploading(false); }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const filteredEvents = events.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), currentDate));

  const renderListView = () => {
    if (filteredEvents.length === 0) return <div className="text-center py-12"><CalIcon size={48} className="mx-auto text-slate-200 mb-4"/><p className="text-slate-500 font-medium">Sin eventos este mes.</p></div>;
    return (
      <div className="space-y-4 animate-fade-in">
          {filteredEvents.map(event => {
            const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            return (
              <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className={`bg-white p-4 rounded-2xl border flex gap-4 transition-all cursor-pointer relative ${!event.published ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
                <div className={`flex flex-col items-center justify-center px-3 rounded-xl border min-w-[60px] ${event.type === 'ayuno' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] font-bold uppercase ${event.type === 'ayuno' ? 'text-rose-400' : 'text-slate-400'}`}>{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className={`text-xl font-black ${event.type === 'ayuno' ? 'text-rose-600' : 'text-slate-800'}`}>{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2">
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${TypeConfig.color}`}>{TypeConfig.label}</span>
                       {!event.published && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase bg-amber-500 text-white flex items-center gap-1"><EyeOff size={10}/> Borrador</span>}
                    </div>
                    {['pastor', 'lider'].includes(userRole) && <button onClick={(e) => {e.stopPropagation(); handleDeleteEvent(event.id)}} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>}
                  </div>
                  <h4 className="font-bold text-slate-800 text-base leading-tight mt-1">{event.title}</h4>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium"><div className="flex items-center gap-1"><Clock size={14} className="text-slate-400"/> {event.time} hs</div></div>
                </div>
              </div>
            )
          })}
      </div>
    );
  };

  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in relative">
      <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2 border-b border-slate-200/50">
        <h1 className="text-2xl font-black text-slate-800">Agenda</h1>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg transition-all ${viewMode === 'month' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'}`}><CalIcon size={18}/></button>
        </div>
      </div>

      {/* ✅ BARRA DE PUBLICACIÓN (Punto 3) */}
      {['pastor', 'lider'].includes(userRole) && filteredEvents.some(e => !e.published) && (
          <div className="bg-amber-100 border border-amber-200 p-4 rounded-2xl mb-6 flex items-center justify-between shadow-sm animate-pulse">
             <div className="flex items-center gap-3 text-amber-800">
                <Megaphone size={20}/>
                <div className="min-w-0"><p className="text-xs font-black uppercase">Cronograma en preparación</p><p className="text-[10px] font-bold opacity-70">Hay eventos ocultos para el equipo.</p></div>
             </div>
             <button onClick={handlePublishMonth} disabled={isPublishing} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-2 active:scale-95 transition-all">
                {isPublishing ? <Loader2 size={14} className="animate-spin"/> : <><Send size={14}/> PUBLICAR</>}
             </button>
          </div>
      )}

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
         <button onClick={prevMonth} className="p-2 text-slate-400"><ChevronLeft size={24} /></button>
         <h2 className="text-lg font-black text-slate-800 capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
         <button onClick={nextMonth} className="p-2 text-slate-400"><ChevronRight size={24} /></button>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32}/></div> : (viewMode === 'list' ? renderListView() : renderListView())}

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-4 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center z-40">
            <Plus size={28} />
        </button>
      )}

      {/* MODAL CREACIÓN CON TOGGLE DE PUBLICACIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black text-slate-800">Nuevo Evento</h2><button onClick={() => setIsModalOpen(false)}><X size={20}/></button></div>
                <div className="space-y-4">
                    <input type="text" placeholder="Título" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" className="p-3 bg-slate-50 border border-slate-200 rounded-xl" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        <input type="time" className="p-3 bg-slate-50 border border-slate-200 rounded-xl" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                    </div>
                    {/* TOGGLE PUBLICAR AHORA */}
                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                       <span className="text-xs font-bold uppercase tracking-wider">¿Notificar al instante?</span>
                       {newEvent.published ? <CheckCircle size={20}/> : <XCircle size={20}/>}
                    </button>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {Object.entries(EVENT_TYPES).map(([key, config]) => (
                            <button key={key} onClick={() => setNewEvent({...newEvent, type: key})} className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold ${newEvent.type === key ? config.color : 'bg-white border-slate-100 text-slate-500'}`}><config.icon size={16}/> {config.label}</button>
                        ))}
                    </div>
                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2">
                        {isUploading ? <Loader2 className="animate-spin" size={20}/> : "Guardar en Agenda"}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}