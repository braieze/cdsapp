import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  deleteDoc, doc, getDoc, serverTimestamp, updateDoc,
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
  const [allUsers, setAllUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null); // ✅ Para ver/editar equipo
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

  // ESTADO DE CREACIÓN SIMPLE
  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', time: '19:30', description: '',
    published: false // Por defecto es Borrador
  });

  const [activeAssignRole, setActiveAssignRole] = useState(null); 
  const [assignSearch, setAssignSearch] = useState('');

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 1. CARGA DE DATOS (MANTENIDA + DIRECTORIO)
  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) setUserRole(userSnap.data().role);
      }
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

  // 2. SISTEMA DE NOTIFICACIONES (RESPETADO)
  const sendEventNotification = async (eventTitle, eventDate, eventUrl, eventType) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      let tokens = [];
      usersSnap.forEach((doc) => { if (doc.data().fcmTokens) tokens.push(...doc.data().fcmTokens); });
      const uniqueTokens = [...new Set(tokens)].filter(t => t && t.length > 10);
      if (uniqueTokens.length === 0) return;
      const typeLabel = EVENT_TYPES[eventType]?.label || eventType;
      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST", headers: { "Content-Type": "application/json" },
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
        body: JSON.stringify({ title: `📅 Agenda de ${monthName} lista`, body: "Actividades publicadas.", tokens: uniqueTokens, url: "/servicios" })
      });
    } catch (e) { console.error(e); }
  };

  // 3. ACCIONES CONFIRMADAS
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
      } catch (e) { setToast({ message: "Error", type: "error" }); }
      finally { setIsPublishing(false); }
    }
  };

  // 4. CREACIÓN SIMPLE (PASO 1)
  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return setToast({ message: "Falta título o fecha", type: "error" });
    setIsUploading(true);
    try {
        const eventDocRef = await addDoc(collection(db, 'events'), {
            ...newEvent,
            endDate: newEvent.date,
            createdAt: serverTimestamp(),
            assignments: { predica: [], alabanza: [], multimedia: [], recepcion: [] } // Estructura vacía inicial
        });

        if (newEvent.published) {
            const dateStr = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es });
            await sendEventNotification(newEvent.title, dateStr, `/calendario/${eventDocRef.id}`, newEvent.type);
        }

        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', time: '19:30', description: '', published: false });
        setToast({ message: "Evento creado. Ahora asigna el equipo.", type: "success" });
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); } 
    finally { setIsUploading(false); }
  };

  // 5. ASIGNACIÓN BLINDADA (PASO 2)
  const toggleAssignment = async (role, name) => {
    if (!selectedEvent) return;
    const currentAssignments = selectedEvent.assignments || { predica: [], alabanza: [], multimedia: [], recepcion: [] };
    const currentList = currentAssignments[role] || [];
    
    let newList;
    if (currentList.includes(name)) {
      newList = currentList.filter(n => n !== name);
    } else {
      newList = [...currentList, name];
    }

    const updatedAssignments = { ...currentAssignments, [role]: newList };
    
    try {
      await updateDoc(doc(db, 'events', selectedEvent.id), { assignments: updatedAssignments });
      setSelectedEvent({ ...selectedEvent, assignments: updatedAssignments });
    } catch (e) { setToast({ message: "Error al asignar", type: "error" }); }
  };

  const isUserTaken = (name) => {
    if (!selectedEvent?.assignments) return false;
    return Object.values(selectedEvent.assignments).flat().includes(name);
  };

  // NAVEGACIÓN
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const renderListView = () => {
    if (filteredEvents.length === 0) return <div className="text-center py-12"><CalIcon size={48} className="mx-auto text-slate-200 mb-4"/><p className="text-slate-500 font-medium">Sin eventos.</p></div>;
    return (
      <div className="space-y-4 animate-fade-in">
          {filteredEvents.map(event => {
            const config = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            return (
              <div key={event.id} onClick={() => setSelectedEvent(event)} className={`bg-white p-4 rounded-3xl border flex gap-4 transition-all cursor-pointer relative shadow-sm border-slate-100 ${!event.published && 'bg-amber-50/20 border-amber-100'}`}>
                <div className={`flex flex-col items-center justify-center px-3 rounded-2xl border min-w-[65px] ${event.type === 'ayuno' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-[10px] font-black uppercase text-slate-400">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className="text-2xl font-black text-slate-800">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${config.color}`}>{config.label}</span>
                    {['pastor', 'lider'].includes(userRole) && (
                      <button onClick={(e) => { e.stopPropagation(); setActionConfirm({ type: 'delete', id: event.id, title: '¿Borrar evento?', message: 'Se eliminará de la agenda.' }); }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    )}
                  </div>
                  <h4 className="font-black text-slate-800 text-base leading-tight truncate uppercase tracking-tight">{event.title}</h4>
                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-400 font-bold uppercase tracking-widest"><Clock size={12}/> {event.time} hs</div>
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
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-6 animate-fade-in">
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
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all ${!isCurrentMonthDay ? 'text-slate-100' : 'text-slate-700'} ${isToday ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/40' : 'hover:bg-slate-50'} ${hasEvents && !isToday && isCurrentMonthDay ? 'bg-brand-50 font-black text-brand-700 border border-brand-100' : ''}`}>
                            <span className="text-xs font-black">{format(day, 'd')}</span>
                            <div className="flex gap-0.5 mt-1 h-1">{dayEvents.slice(0, 3).map((ev, i) => <div key={i} className={`w-1 h-1 rounded-full ${EVENT_TYPES[ev.type]?.dot || 'bg-slate-400'}`}></div>)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const filteredEvents = events.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), currentDate));

  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md py-2">
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Agenda</h1>
        <div className="flex bg-white p-1.5 rounded-[20px] border shadow-sm border-slate-100">
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'month' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><CalIcon size={18}/></button>
        </div>
      </div>

      {/* PUBLICAR AGENDA */}
      {['pastor', 'lider'].includes(userRole) && filteredEvents.some(e => !e.published) && (
          <div className="bg-amber-100 border-2 border-amber-200 p-5 rounded-[35px] mb-8 flex items-center justify-between shadow-xl shadow-amber-900/5">
             <div className="flex items-center gap-4 text-amber-900"><Megaphone size={24}/><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-tighter">Agenda en Borrador</p><p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Faltan notificaciones</p></div></div>
             <button onClick={() => setActionConfirm({ type: 'publish', title: '¿Publicar cronograma?', message: 'Se notificará a todo el equipo.' })} disabled={isPublishing} className="bg-amber-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black shadow-lg shadow-amber-200 active:scale-95 transition-all">
                {isPublishing ? <Loader2 size={12} className="animate-spin"/> : "PUBLICAR"}
             </button>
          </div>
      )}

      {/* SELECTOR DE MES */}
      <div className="flex items-center justify-between bg-white p-5 rounded-[30px] shadow-xl shadow-slate-200/50 border border-slate-100 mb-8">
         <button onClick={prevMonth} className="p-3 bg-slate-50 rounded-2xl text-slate-400"><ChevronLeft size={24} /></button>
         <h2 className="text-lg font-black text-slate-800 capitalize tracking-tighter">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
         <button onClick={nextMonth} className="p-3 bg-slate-50 rounded-2xl text-slate-400"><ChevronRight size={24} /></button>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={40}/></div> : (viewMode === 'list' ? renderListView() : renderMonthView())}

      {/* BOTÓN CREAR (LIMPIO) */}
      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-6 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 border-4 border-white transition-all shadow-slate-900/40"><Plus size={32} /></button>
      )}

      {/* ✅ PASO 1: MODAL DE CREACIÓN SIMPLE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[45px] p-8 shadow-2xl animate-scale-in">
                <div className="flex justify-between items-center mb-8"><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Nuevo Evento</h2><button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button></div>
                <div className="space-y-5">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Título</label><input type="text" placeholder="EJ: CULTO GENERAL" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[25px] font-black outline-none uppercase text-sm focus:ring-2 focus:ring-brand-500/20" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} /></div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Fecha</label><input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[25px] outline-none text-xs font-black uppercase" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Hora</label><input type="time" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[25px] outline-none text-xs font-black" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} /></div>
                    </div>

                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-5 rounded-[30px] border-2 flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-inner' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                       <span className="text-[10px] font-black uppercase tracking-widest">¿Notificar equipo?</span>
                       {newEvent.published ? <Send size={20}/> : <EyeOff size={20}/>}
                    </button>

                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-5 rounded-[30px] shadow-2xl mt-4 active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-[0.2em] shadow-slate-900/20">
                        {isUploading ? <Loader2 className="animate-spin mx-auto" size={20}/> : "GUARDAR EN AGENDA"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ✅ PASO 2: MODAL DETALLE Y ASIGNACIÓN (DESPUÉS DE CREAR) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex flex-col p-0 animate-fade-in overflow-y-auto">
            <div className="flex items-center justify-between p-6 sticky top-0 bg-transparent z-10">
               <button onClick={() => setSelectedEvent(null)} className="p-3 bg-white/10 text-white rounded-full"><X size={24}/></button>
               <h2 className="text-white font-black uppercase text-center flex-1 pr-12">Detalle de Equipo</h2>
            </div>

            <div className="px-6 pb-20 space-y-8">
               <div className="text-center space-y-2">
                  <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-4"><CalIcon size={40} className="text-slate-900"/></div>
                  <h3 className="text-3xl font-black text-white uppercase leading-none tracking-tighter">{selectedEvent.title}</h3>
                  <p className="text-brand-500 font-black text-xs uppercase tracking-[0.3em]">{format(new Date(selectedEvent.date + 'T00:00:00'), 'EEEE d MMMM', {locale: es})} • {selectedEvent.time} HS</p>
               </div>

               {/* CATEGORÍAS TÁCTICAS */}
               {['predica', 'alabanza', 'multimedia', 'recepcion'].map(role => (
                 <div key={role} className="bg-white rounded-[40px] p-8 shadow-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-4 mb-6 flex items-center gap-3">
                       <Users size={16} className="text-brand-500"/> Equipo {role}
                    </p>
                    
                    <div className="space-y-3">
                       {selectedEvent.assignments?.[role]?.map(name => (
                         <div key={name} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="font-black text-slate-800 text-sm uppercase tracking-tight">{name}</span>
                            <button onClick={() => toggleAssignment(role, name)} className="text-rose-500 bg-rose-50 p-1.5 rounded-lg"><X size={14}/></button>
                         </div>
                       ))}
                       
                       <button 
                         onClick={() => setActiveAssignRole(role)}
                         className="w-full py-5 border-2 border-dashed border-slate-100 rounded-3xl flex items-center justify-center gap-2 text-slate-300 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                       >
                          <Plus size={16}/> AÑADIR SERVIDOR
                       </button>
                    </div>
                 </div>
               ))}
               
               <button onClick={() => setSelectedEvent(null)} className="w-full py-6 bg-brand-600 text-slate-900 font-black rounded-[35px] shadow-2xl text-xs uppercase tracking-[0.2em] mt-8">FINALIZAR GESTIÓN</button>
            </div>
        </div>
      )}

      {/* ✅ SELECTOR DE EQUIPO CON BLINDAJE VISUAL */}
      {activeAssignRole && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-2xl flex items-end justify-center animate-fade-in" onClick={() => setActiveAssignRole(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[50px] p-10 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Asignar a {activeAssignRole}</h3>
              <button onClick={() => setActiveAssignRole(null)} className="p-3 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
              <input placeholder="Buscar hermano..." className="w-full pl-12 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" value={assignSearch} onChange={e => setAssignSearch(e.target.value)} />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pb-8 no-scrollbar">
              {allUsers
                .filter(u => {
                  const match = u.displayName?.toLowerCase().includes(assignSearch.toLowerCase());
                  if (activeAssignRole === 'predica') return (u.role === 'pastor' || u.role === 'lider') && match;
                  return (u.ministerio?.toLowerCase() === activeAssignRole || u.area?.toLowerCase() === activeAssignRole) && match;
                })
                .map(user => {
                  const isHere = selectedEvent.assignments?.[activeAssignRole]?.includes(user.displayName);
                  const isElsewhere = isUserTaken(user.displayName) && !isHere;
                  
                  return (
                    <button 
                      key={user.id} disabled={isElsewhere}
                      onClick={() => toggleAssignment(activeAssignRole, user.displayName)}
                      className={`w-full flex items-center gap-4 p-4 rounded-[30px] border-2 transition-all ${isHere ? 'bg-brand-50 border-brand-500 shadow-lg shadow-brand-200/20' : isElsewhere ? 'bg-slate-50 border-transparent opacity-40 grayscale cursor-not-allowed' : 'bg-white border-slate-50 active:scale-95'}`}
                    >
                      <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-14 h-14 rounded-[22px] object-cover border-2 border-white shadow-sm" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{user.displayName}</p>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${isElsewhere ? 'text-rose-500' : 'text-slate-400'}`}>
                          {isElsewhere ? 'Ya tiene un servicio asignado' : user.role}
                        </p>
                      </div>
                      {isHere && <CheckCircle size={24} className="text-brand-600"/>}
                    </button>
                  );
                })}
            </div>
            <button onClick={() => setActiveAssignRole(null)} className="w-full bg-slate-900 text-white py-6 rounded-[30px] font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-slate-900/20">CONFIRMAR EQUIPO</button>
          </div>
        </div>
      )}

      {/* TOASTS Y CONFIRMACIÓN */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[45px] p-10 shadow-2xl text-center">
            <AlertCircle size={40} className="mx-auto mb-6 text-amber-500"/>
            <h4 className="font-black text-slate-800 text-lg mb-2 uppercase tracking-tighter">{actionConfirm.title}</h4>
            <p className="text-xs text-slate-400 font-bold mb-10 uppercase tracking-widest leading-relaxed">{actionConfirm.message}</p>
            <div className="space-y-3">
              <button onClick={executeConfirmedAction} className={`w-full py-5 rounded-[25px] font-black text-[10px] uppercase shadow-lg ${actionConfirm.type === 'delete' ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-slate-900 text-white shadow-slate-900/20'}`}>Confirmar Acción</button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-5 rounded-[25px] font-black text-[10px] uppercase text-slate-400 bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-6 right-6 z-[400] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            {toast.type === 'success' ? <Check size={24}/> : <Info size={24}/>}
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}