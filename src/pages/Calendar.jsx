import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, messaging } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc, getDoc, serverTimestamp, getDocs } from 'firebase/firestore'; // ✅ getDocs agregado
import { Plus, Calendar as CalIcon, List, Clock, Trash2, X, Calendar, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon } from 'lucide-react';
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

  // Estados para subida de imagen
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: ''
  });

  // --- 🔥 FUNCIÓN DE NOTIFICACIONES (NUEVA) ---
  const sendEventNotification = async (eventTitle, eventDate, eventUrl, eventType) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      let tokens = [];
      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
          tokens.push(...data.fcmTokens);
        }
      });

      const uniqueTokens = [...new Set(tokens)];
      if (uniqueTokens.length === 0) return;

      const BACKEND_URL = "https://backend-notificaciones-mceh.onrender.com/send-notification";
      const typeLabel = EVENT_TYPES[eventType]?.label || eventType;

      await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Se creó un nuevo ${typeLabel}`, 
          body: `${eventTitle} - 📅 ${eventDate}`,
          tokens: uniqueTokens,
          url: eventUrl 
        })
      });
      console.log("✅ Notificación de Agenda enviada");
    } catch (error) {
      console.error("❌ Error notificando evento:", error);
    }
  };

  useEffect(() => {
    const fetchUserRole = async () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setUserRole(userSnap.data().role);
      }
    };
    fetchUserRole();

    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);
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
            const formData = new FormData();
            formData.append("file", imageFile);
            formData.append("upload_preset", UPLOAD_PRESET); 
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
            const data = await response.json();
            if (data.secure_url) uploadedImageUrl = data.secure_url;
        }

        const finalEndDate = newEvent.type === 'ayuno' && newEvent.endDate ? newEvent.endDate : newEvent.date;

        // 1. Guardar Evento en Firestore
        const eventDocRef = await addDoc(collection(db, 'events'), {
            ...newEvent,
            endDate: finalEndDate,
            image: uploadedImageUrl,
            createdAt: Timestamp.now(),
            assignments: {}, 
            checklist: (newEvent.type === 'limpieza' || newEvent.type === 'mantenimiento') 
                ? [{text: 'Limpieza General', completed: false}, {text: 'Baños', completed: false}] 
                : [],
            createdBy: auth.currentUser?.uid
        });

        // 2. 🔥 Enviar Notificación con fecha formateada
        const dateForNotif = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es });
        const capitalizedDate = dateForNotif.charAt(0).toUpperCase() + dateForNotif.slice(1);

        await sendEventNotification(
          newEvent.title,
          capitalizedDate,
          `/calendario/${eventDocRef.id}`,
          newEvent.type
        );

        // Lógica de Ayuno (Mantiene tu código original)
        if (newEvent.type === 'ayuno') {
            const startDateStr = format(new Date(newEvent.date + 'T00:00:00'), 'd MMMM', { locale: es });
            const endDateStr = finalEndDate ? format(new Date(finalEndDate + 'T00:00:00'), 'd MMMM', { locale: es }) : startDateStr;
            
            await addDoc(collection(db, 'posts'), {
                type: 'Devocional',
                title: `🔥 Ayuno: ${newEvent.title}`,
                content: `${newEvent.description || 'Únete a este tiempo especial.'}\n\n📅 Fecha: Del ${startDateStr} al ${endDateStr}.\n👉 Ve a la Agenda para sumarte.`,
                image: uploadedImageUrl,
                link: `/calendario/${eventDocRef.id}`,
                linkText: 'Anotarme ahora',
                tags: ['Ayuno', 'Congregacional'],
                authorId: auth.currentUser.uid,
                authorName: auth.currentUser.displayName || 'Iglesia',
                authorPhoto: auth.currentUser.photoURL,
                role: 'Pastor / Equipo',
                isPinned: true,
                createdAt: serverTimestamp(),
                likes: [],
                commentsCount: 0
            });
        }

        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '' });
        setImageFile(null); setImagePreview(null);
        alert("Evento creado exitosamente");

    } catch (error) { console.error(error); alert("Error al crear evento"); } finally { setIsUploading(false); }
  };

  // --- MANTIENE TUS RENDERERS ORIGINALES ---
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const isCurrentMonth = isSameMonth(new Date(), currentDate);
  
  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.date + 'T00:00:00'); 
    return isSameMonth(eventDate, currentDate);
  });

  const handleDeleteEvent = async (id) => {
    if(window.confirm("¿Borrar evento?")) await deleteDoc(doc(db, 'events', id));
  }

  const renderListView = () => {
    if (filteredEvents.length === 0) return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <Calendar size={48} className="mx-auto text-slate-200 mb-4"/>
        <p className="text-slate-500 font-medium">No hay eventos en este mes.</p>
      </div>
    );
    return (
      <div className="space-y-4 animate-fade-in">
          {filteredEvents.map(event => {
            const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            return (
              <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 hover:shadow-md transition-shadow cursor-pointer relative group">
                <div className={`flex flex-col items-center justify-center px-3 rounded-xl border min-w-[60px] ${event.type === 'ayuno' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-xs font-bold uppercase ${event.type === 'ayuno' ? 'text-rose-400' : 'text-slate-400'}`}>{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className={`text-xl font-black ${event.type === 'ayuno' ? 'text-rose-600' : 'text-slate-800'}`}>{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase mb-1 inline-block ${TypeConfig.color}`}>{TypeConfig.label}</span>
                    {['pastor', 'lider'].includes(userRole) && <button onClick={(e) => {e.stopPropagation(); handleDeleteEvent(event.id)}} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>}
                  </div>
                  <h4 className="font-bold text-slate-800 text-base leading-tight">{event.title}</h4>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1"><Clock size={14} className="text-slate-400"/> {event.time} hs</div>
                  </div>
                </div>
                <div className={`absolute right-0 top-4 bottom-4 w-1 rounded-l-full ${TypeConfig.dot}`}></div>
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
                            className={`aspect-square rounded-xl flex flex-col items-center justify-center relative cursor-pointer transition-all border border-transparent
                                ${!isCurrentMonthDay ? 'text-slate-200' : 'text-slate-700'}
                                ${isToday ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50'}
                                ${hasEvents && !isToday && isCurrentMonthDay ? 'bg-brand-50 font-bold text-brand-700' : ''}`}>
                            <span className="text-xs font-medium">{format(day, 'd')}</span>
                            <div className="flex gap-0.5 mt-1 h-1.5">
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
      {/* Header, Controles de mes y Vistas se mantienen igual */}
      <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2 border-b border-slate-200/50">
        <h1 className="text-2xl font-black text-slate-800">Agenda</h1>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg transition-all ${viewMode === 'month' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'}`}><CalIcon size={18}/></button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
         <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-brand-600"><ChevronLeft size={24} /></button>
         <div className="text-center">
             <h2 className="text-lg font-black text-slate-800 capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
         </div>
         <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-brand-600"><ChevronRight size={24} /></button>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32}/></div> : (viewMode === 'list' ? renderListView() : renderMonthView())}

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-4 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center z-40">
            <Plus size={28} />
        </button>
      )}

      {/* Modal de Día y Modal de Creación se mantienen igual */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedDayEvents(null)}>
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 animate-slide-up relative shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800 capitalize">{format(selectedDayEvents.date, 'EEEE d MMMM', {locale: es})}</h3>
                    <button onClick={() => setSelectedDayEvents(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <div className="space-y-3">
                    {selectedDayEvents.events.map(event => (
                        <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 cursor-pointer">
                            <div className={`p-2 rounded-lg bg-brand-50 text-brand-600`}><CalIcon size={20}/></div>
                            <div><h4 className="font-bold text-sm text-slate-800">{event.title}</h4><p className="text-xs text-slate-500">{event.time} hs</p></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 animate-slide-up relative shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black text-slate-800">Nuevo Evento</h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    <input type="text" placeholder="Título" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
                        value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" className="p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                            value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        <input type="time" className="p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                            value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {Object.entries(EVENT_TYPES).map(([key, config]) => (
                            <button key={key} onClick={() => setNewEvent({...newEvent, type: key})}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold ${newEvent.type === key ? config.color : 'bg-white border-slate-100 text-slate-500'}`}>
                                <config.icon size={16}/> {config.label}
                            </button>
                        ))}
                    </div>

                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 disabled:opacity-50">
                        {isUploading ? <Loader2 className="animate-spin" size={20}/> : "Crear en Agenda"}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}