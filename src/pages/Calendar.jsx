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
  Check, Info, AlertCircle, Users, ChevronDown, Search, UserCheck
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, addMonths, subMonths, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [events, setEvents] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // ✅ Base de datos de servidores para el blindaje
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

  // ✅ ESTADO DE NUEVO EVENTO CON ASIGNACIONES INTEGRADAS
  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '',
    published: false,
    assignments: { predica: [], alabanza: [], multimedia: [], recepcion: [] }
  });

  const [activeAssignRole, setActiveAssignRole] = useState(null); 
  const [assignSearch, setAssignSearch] = useState('');

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ✅ 1. CARGA DE DATOS (MANTENIDA + DIRECTORIO)
  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) setUserRole(userSnap.data().role);
      }
      
      // Traemos todos los usuarios para filtrar por ministerio y validar disponibilidad
      const usersSnap = await getDocs(collection(db, 'users'));
      setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchData();

    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribeEvents();
  }, []);

  // ✅ 2. LÓGICA DE BLINDAJE: NO REPETIR PERSONAS
  const isUserSelectedSomewhere = (name) => {
    return Object.values(newEvent.assignments).flat().includes(name);
  };

  const toggleAssignment = (role, name) => {
    const current = newEvent.assignments[role] || [];
    if (current.includes(name)) {
      setNewEvent({ ...newEvent, assignments: { ...newEvent.assignments, [role]: current.filter(n => n !== name) } });
    } else {
      setNewEvent({ ...newEvent, assignments: { ...newEvent.assignments, [role]: [...current, name] } });
    }
  };

  // ✅ 3. SISTEMA DE NOTIFICACIONES (MANTENIDO)
  const sendEventNotification = async (eventTitle, eventDate, eventUrl, eventType) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      let tokens = [];
      usersSnap.forEach((doc) => { if (doc.data().fcmTokens) tokens.push(...doc.data().fcmTokens); });
      const uniqueTokens = [...new Set(tokens)].filter(t => t && t.length > 10);
      if (uniqueTokens.length === 0) return;

      const typeLabel = EVENT_TYPES[eventType]?.label || eventType;
      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Nuevo evento: ${typeLabel}`, body: `${eventTitle} - 📅 ${eventDate}`, tokens: uniqueTokens, url: eventUrl })
      });
    } catch (error) { console.error(error); }
  };

  const sendBulkNotification = async (monthName) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      let tokens = [];
      usersSnap.forEach(d => { if (d.data().fcmTokens) tokens.push(...d.data().fcmTokens); });
      const uniqueTokens = [...new Set(tokens)].filter(t => t && t.length > 10);
      if (uniqueTokens.length === 0) return;

      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `📅 Agenda de ${monthName} lista`, body: "Se publicaron las nuevas actividades.", tokens: uniqueTokens, url: "/servicios" })
      });
    } catch (e) { console.error(e); }
  };

  // ✅ 4. ACCIONES DE BORRADO Y PUBLICACIÓN (MANTENIDAS)
  const executeConfirmedAction = async () => {
    if (!actionConfirm) return;
    const { type, id } = actionConfirm;
    setActionConfirm(null);

    if (type === 'delete') {
      try {
        await deleteDoc(doc(db, 'events', id));
        const batch = writeBatch(db);
        const usersSnap = await getDocs(collection(db, "users"));
        for (const userDoc of usersSnap.docs) {
          const notifs = await getDocs(query(collection(db, `users/${userDoc.id}/notifications`), where("eventId", "==", id)));
          notifs.forEach(n => batch.delete(n.ref));
        }
        const postsSnap = await getDocs(query(collection(db, "posts"), where("eventId", "==", id)));
        postsSnap.forEach(p => batch.delete(p.ref));
        await batch.commit();
        setToast({ message: "Evento eliminado", type: "info" });
      } catch (e) { setToast({ message: "Error al borrar", type: "error" }); }
    }

    if (type === 'publish') {
      setIsPublishing(true);
      try {
        const batch = writeBatch(db);
        filteredEvents.filter(e => !e.published).forEach(e => {
          batch.update(doc(db, 'events', e.id), { published: true, updatedAt: serverTimestamp() });
        });
        await batch.commit();
        await sendBulkNotification(format(currentDate, 'MMMM', { locale: es }));
        setToast({ message: "¡Mes publicado!", type: "success" });
      } catch (e) { setToast({ message: "Error al publicar", type: "error" }); }
      finally { setIsPublishing(false); }
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  // ✅ 5. CREACIÓN DE EVENTO (MANTENIDA + EQUIPO)
  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return setToast({ message: "Título y fecha obligatorios", type: "error" });
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
            updatedAt: serverTimestamp(),
            createdBy: auth.currentUser?.uid
        });

        if (newEvent.published) {
            const dateStr = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es });
            await sendEventNotification(newEvent.title, dateStr, `/calendario/${eventDocRef.id}`, newEvent.type);
        }

        if (newEvent.type === 'ayuno') {
            await addDoc(collection(db, 'posts'), {
                type: 'Devocional', title: `🔥 Ayuno: ${newEvent.title}`,
                content: newEvent.description || 'Súmate a este tiempo.',
                image: uploadedImageUrl, eventId: eventDocRef.id,
                createdAt: serverTimestamp(), authorId: auth.currentUser.uid, authorName: auth.currentUser.displayName
            });
        }
        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '', published: false, assignments: { predica: [], alabanza: [], multimedia: [], recepcion: [] } });
        setImageFile(null); setImagePreview(null);
        setToast({ message: "Servicio agendado", type: "success" });
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); } 
    finally { setIsUploading(false); }
  };

  // ✅ 6. FUNCIONES DE NAVEGACIÓN Y RENDER (MANTENIDAS)
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const renderListView = () => {
    if (filteredEvents.length === 0) return <div className="text-center py-12"><CalIcon size={48} className="mx-auto text-slate-200 mb-4"/><p className="text-slate-500 font-medium">No hay eventos para este mes.</p></div>;
    return (
      <div className="space-y-4 animate-fade-in">
          {filteredEvents.map(event => {
            const config = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            return (
              <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className={`bg-white p-4 rounded-2xl border flex gap-4 transition-all cursor-pointer relative ${!event.published ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 shadow-sm'}`}>
                <div className={`flex flex-col items-center justify-center px-3 rounded-xl border min-w-[60px] ${event.type === 'ayuno' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-[10px] font-bold uppercase text-slate-400">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className="text-xl font-black text-slate-800">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${config.color}`}>{config.label}</span>
                    {['pastor', 'lider'].includes(userRole) && (
                      <button onClick={(e) => { e.stopPropagation(); setActionConfirm({ type: 'delete', id: event.id, title: '¿Borrar evento?', message: `Se eliminará "${event.title}".` }); }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 text-base leading-tight mt-1 uppercase truncate">{event.title}</h4>
                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-500 font-bold"><Clock size={14} className="text-brand-500"/> {event.time} hs</div>
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
        <div className="bg-white rounded-[30px] border border-slate-100 shadow-sm p-5 animate-fade-in">
            <div className="grid grid-cols-7 mb-4 border-b border-slate-50 pb-3">
                {weekDays.map(day => <div key={day} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonthDay = isSameMonth(day, currentDate);
                    const dayEvents = events.filter(e => isSameDay(new Date(e.date + 'T00:00:00'), day));
                    const hasEvents = dayEvents.length > 0;
                    return (
                        <div key={day.toString()} onClick={() => hasEvents && setSelectedDayEvents({ date: day, events: dayEvents })}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all ${!isCurrentMonthDay ? 'text-slate-200' : 'text-slate-700'} ${isToday ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50'} ${hasEvents && !isToday && isCurrentMonthDay ? 'bg-brand-50 font-black text-brand-700' : ''}`}>
                            <span className="text-xs font-bold">{format(day, 'd')}</span>
                            <div className="flex gap-0.5 mt-1 h-1">{dayEvents.slice(0, 3).map((ev, i) => <div key={i} className={`w-1 h-1 rounded-full ${EVENT_TYPES[ev.type]?.dot || 'bg-slate-400'}`}></div>)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  // ✅ 7. SELECTOR DE EQUIPO CON FILTRO Y BLINDAJE REAL
  const renderTeamPicker = () => {
    if (!activeAssignRole) return null;
    
    // Filtro por ministerio/rol específico
    const candidates = allUsers.filter(u => {
      const nameMatch = u.displayName?.toLowerCase().includes(assignSearch.toLowerCase());
      if (activeAssignRole === 'predica') return (u.role === 'pastor' || u.role === 'lider') && nameMatch;
      return (u.ministerio?.toLowerCase() === activeAssignRole.toLowerCase() || u.area?.toLowerCase() === activeAssignRole.toLowerCase()) && nameMatch;
    });

    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-xl flex items-end justify-center animate-fade-in" onClick={() => setActiveAssignRole(null)}>
        <div className="bg-white w-full max-w-md rounded-t-[45px] p-8 animate-slide-up max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Users size={16} className="text-brand-500"/> EQUIPO {activeAssignRole}</h3>
            <button onClick={() => setActiveAssignRole(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
            <input placeholder="Buscar servidor..." className="w-full pl-10 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" value={assignSearch} onChange={e => setAssignSearch(e.target.value)} />
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pb-6 no-scrollbar">
            {candidates.map(user => {
              const isSelectedHere = newEvent.assignments[activeAssignRole].includes(user.displayName);
              const isBlocked = isUserSelectedSomewhere(user.displayName) && !isSelectedHere;
              
              return (
                <button 
                  key={user.id} disabled={isBlocked}
                  onClick={() => toggleAssignment(activeAssignRole, user.displayName)}
                  className={`w-full flex items-center gap-4 p-3 rounded-[28px] border-2 transition-all ${isSelectedHere ? 'bg-brand-50 border-brand-500' : isBlocked ? 'bg-slate-50 border-transparent opacity-40 grayscale cursor-not-allowed' : 'bg-white border-slate-100 active:scale-95'}`}
                >
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{user.displayName}</p>
                    <p className={`text-[8px] font-black uppercase tracking-widest ${isBlocked ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
                      {isBlocked ? 'Ya seleccionado en otra área' : user.role}
                    </p>
                  </div>
                  {isSelectedHere && <CheckCircle size={22} className="text-brand-600"/>}
                </button>
              );
            })}
          </div>
          <button onClick={() => setActiveAssignRole(null)} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl">Confirmar Equipo</button>
        </div>
      </div>
    );
  };

  const filteredEvents = events.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), currentDate));

  // ✅ RENDERIZADO PRINCIPAL
  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit">
      
      <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2">
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Agenda</h1>
        <div className="flex bg-white p-1 rounded-xl border shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg ${viewMode === 'month' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'}`}><CalIcon size={18}/></button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-6">
         <button onClick={prevMonth} className="p-2 text-slate-400"><ChevronLeft size={24} /></button>
         <h2 className="text-lg font-black text-slate-800 capitalize tracking-tighter">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
         <button onClick={nextMonth} className="p-2 text-slate-400"><ChevronRight size={24} /></button>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32}/></div> : (viewMode === 'list' ? renderListView() : renderMonthView())}

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-4 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 border-4 border-white transition-transform shadow-slate-900/40"><Plus size={32} /></button>
      )}

      {/* ✅ MODAL DE CREACIÓN CON BLINDAJE INTEGRADO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[45px] p-8 shadow-2xl max-h-[92vh] overflow-y-auto animate-scale-in">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Nuevo Evento</h2><button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button></div>
                <div className="space-y-4">
                    <input type="text" placeholder="TÍTULO DEL SERVICIO" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-3xl font-black outline-none uppercase text-sm focus:ring-2 focus:ring-brand-500/20" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-black uppercase" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        <input type="time" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-black" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                    </div>

                    {/* ✅ EQUIPO CON VISUALIZACIÓN DE ASIGNADOS */}
                    <div className="bg-slate-900 p-6 rounded-[35px] shadow-xl space-y-3">
                       <p className="text-[9px] font-black text-brand-400 uppercase tracking-[0.2em] border-b border-white/10 pb-2">Asignar Equipo</p>
                       {['predica', 'alabanza', 'multimedia', 'recepcion'].map(role => (
                         <div key={role}>
                            <button onClick={() => setActiveAssignRole(role)} className="w-full flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 text-white text-[10px] font-black uppercase active:scale-95 transition-all">
                               <div className="flex items-center gap-2"><Users size={14} className="text-brand-500"/> {role}</div>
                               <ChevronDown size={14} className="opacity-40"/>
                            </button>
                            <div className="flex flex-wrap gap-1 mt-1">
                               {newEvent.assignments[role]?.map(n => <span key={n} className="bg-brand-500 text-slate-900 text-[7px] font-black px-2 py-0.5 rounded-md uppercase flex items-center gap-1"><UserCheck size={8}/> {n}</span>)}
                            </div>
                         </div>
                       ))}
                    </div>

                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-4 rounded-[28px] border flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-inner' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                       <span className="text-[10px] font-black uppercase tracking-wider">¿Notificar al equipo ahora?</span>
                       {newEvent.published ? <CheckCircle size={20}/> : <XCircle size={20}/>}
                    </button>

                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-brand-600 text-white font-black py-5 rounded-[30px] shadow-xl mt-2 active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-widest">
                        {isUploading ? <Loader2 className="animate-spin mx-auto" size={20}/> : "CREAR EVENTO Y EQUIPO"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {renderTeamPicker()}
      
      {/* RESTO DE MODALES Y TOASTS (RESPETADOS) */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedDayEvents(null)}>
            <div className="bg-white w-full max-w-sm rounded-t-[40px] p-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6"><h3 className="font-black text-xl text-slate-800 capitalize tracking-tighter">{format(selectedDayEvents.date, 'EEEE d MMMM', {locale: es})}</h3><button onClick={() => setSelectedDayEvents(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button></div>
                <div className="space-y-3">{selectedDayEvents.events.map(event => (
                    <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors"><div className="p-2.5 rounded-2xl bg-brand-50 text-brand-600 shadow-sm"><CalIcon size={20}/></div><div className="flex-1 overflow-hidden"><h4 className="font-black text-sm text-slate-800 truncate uppercase">{event.title}</h4><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{event.time} hs</p></div><ChevronRightIcon size={16} className="text-slate-300"/></div>
                ))}</div>
            </div>
        </div>
      )}

      {actionConfirm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xs rounded-[35px] p-8 shadow-2xl text-center">
            <AlertCircle size={32} className="mx-auto mb-6 text-amber-500"/>
            <h4 className="font-black text-slate-800 text-lg mb-2 uppercase tracking-tighter">{actionConfirm.title}</h4>
            <p className="text-xs text-slate-500 font-bold mb-8 uppercase tracking-widest">{actionConfirm.message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeConfirmedAction} className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg ${actionConfirm.type === 'delete' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>Confirmar</button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-4 rounded-2xl font-black text-[10px] uppercase text-slate-400 bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-6 right-6 z-[400] animate-slide-up">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-[25px] shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <Check size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}