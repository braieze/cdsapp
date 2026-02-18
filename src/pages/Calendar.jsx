import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  Timestamp, deleteDoc, doc, getDoc, serverTimestamp,
  getDocs, where, writeBatch, updateDoc
} from 'firebase/firestore';
import {
  Plus, Calendar as CalIcon, List, Clock, Trash2, X,
  ChevronLeft, ChevronRight, Loader2, Megaphone,
  Send, EyeOff, CheckCircle, XCircle, ImageIcon,
  Check, Info, AlertCircle, Users, Search, UserCheck
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, addMonths, subMonths, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [events, setEvents] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // ✅ Para el Directorio del Blindaje
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null); // ✅ Paso 2: Detalles/Equipo
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

  // ✅ PASO 1: CREACIÓN SIMPLE
  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '',
    published: false
  });

  const [activeAssignRole, setActiveAssignRole] = useState(null); // Para el sub-modal de selección
  const [assignSearch, setAssignSearch] = useState('');

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // ✅ 1. SISTEMA DE NOTIFICACIONES (MANTENIDO)
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

  const sendBulkNotification = async (monthName) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      let tokens = [];
      usersSnap.forEach(d => { if (d.data().fcmTokens) tokens.push(...d.data().fcmTokens); });
      const uniqueTokens = [...new Set(tokens)].filter(t => t && t.length > 10);
      if (uniqueTokens.length === 0) return;

      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `📅 Agenda de ${monthName} lista`,
          body: "Se publicaron las nuevas actividades. ¡Revisa tus turnos!",
          tokens: uniqueTokens,
          url: "/servicios"
        })
      });
    } catch (e) { console.error(e); }
  };

  // ✅ 2. EJECUCIÓN DE ACCIONES CONFIRMADAS
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
        setToast({ message: "Evento y avisos eliminados", type: "info" });
        if (selectedEvent?.id === id) setSelectedEvent(null);
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
        await sendBulkNotification(format(currentDate, 'MMMM', { locale: es }));
        setToast({ message: "¡Todo el mes publicado!", type: "success" });
      } catch (e) { setToast({ message: "Error al publicar", type: "error" }); }
      finally { setIsPublishing(false); }
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) setUserRole(userSnap.data().role);
      }
      // ✅ Carga de usuarios para el Blindaje y Filtro
      const usersSnap = await getDocs(collection(db, 'users'));
      setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchInitialData();

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
            assignments: { predica: [], alabanza: [], multimedia: [], recepcion: [] }, // Estructura inicial
            createdBy: auth.currentUser?.uid
        });

        if (newEvent.published) {
            const dateStr = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es });
            await sendEventNotification(newEvent.title, dateStr, `/calendario/${eventDocRef.id}`, newEvent.type);
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
        setToast({ message: "Evento agendado", type: "success" });
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); }
    finally { setIsUploading(false); }
  };

  // ✅ FUNCIONALIDAD DE BLINDAJE Y EQUIPO
  const toggleMember = async (role, userName) => {
    if (!selectedEvent) return;
    const currentAssignments = selectedEvent.assignments || {};
    const roleList = currentAssignments[role] || [];
    
    let newList;
    if (roleList.includes(userName)) {
      newList = roleList.filter(n => n !== userName);
    } else {
      newList = [...roleList, userName];
    }

    const updated = { ...currentAssignments, [role]: newList };
    try {
      await updateDoc(doc(db, 'events', selectedEvent.id), { assignments: updated });
      setSelectedEvent({ ...selectedEvent, assignments: updated });
    } catch (e) { setToast({ message: "Error al asignar", type: "error" }); }
  };

  const isUserTaken = (name) => {
    if (!selectedEvent?.assignments) return false;
    return Object.values(selectedEvent.assignments).flat().includes(name);
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
              <div key={event.id} onClick={() => setSelectedEvent(event)} className={`bg-white p-4 rounded-2xl border flex gap-4 transition-all cursor-pointer relative ${!event.published ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 shadow-sm'}`}>
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

  // ✅ SELECTOR TÁCTICO CON BLINDAJE
  const renderTeamPicker = () => {
    if (!activeAssignRole) return null;
    const candidates = allUsers.filter(u => {
        const matchesSearch = u.displayName?.toLowerCase().includes(assignSearch.toLowerCase());
        // Filtro por ministerio estricto según rol
        let matchesMinistry = u.ministerio?.toLowerCase() === activeAssignRole.toLowerCase() || u.area?.toLowerCase() === activeAssignRole.toLowerCase();
        if (activeAssignRole === 'predica') matchesMinistry = u.role === 'pastor' || u.role === 'lider';
        return matchesSearch && matchesMinistry;
    });

    return (
      <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-xl flex items-end justify-center animate-fade-in" onClick={() => setActiveAssignRole(null)}>
        <div className="bg-white w-full max-w-sm rounded-t-[45px] p-8 shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">Asignar a {activeAssignRole}</h3>
            <button onClick={() => setActiveAssignRole(null)} className="p-2 bg-slate-50 rounded-full"><X size={20}/></button>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
            <input placeholder="Buscar..." className="w-full pl-12 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" value={assignSearch} onChange={e => setAssignSearch(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pb-8">
            {candidates.map(user => {
              const isHere = selectedEvent.assignments?.[activeAssignRole]?.includes(user.displayName);
              const isElsewhere = isUserTaken(user.displayName) && !isHere;
              return (
                <button key={user.id} disabled={isElsewhere} onClick={() => toggleMember(activeAssignRole, user.displayName)}
                  className={`w-full flex items-center gap-4 p-4 rounded-[30px] border-2 transition-all ${isHere ? 'bg-brand-50 border-brand-500' : isElsewhere ? 'bg-slate-50 border-transparent opacity-40 grayscale cursor-not-allowed' : 'bg-white border-slate-50 active:scale-95'}`}>
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-12 h-12 rounded-[22px] object-cover" alt="User"/>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-800 text-sm uppercase">{user.displayName}</p>
                    <p className={`text-[8px] font-black uppercase tracking-widest ${isElsewhere ? 'text-rose-500' : 'text-slate-400'}`}>
                      {isElsewhere ? 'Ya tiene un servicio asignado' : user.role}
                    </p>
                  </div>
                  {isHere && <CheckCircle size={24} className="text-brand-600"/>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit">
      {/* HEADER (MANTENIDO) */}
      <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2">
        <h1 className="text-2xl font-black text-slate-800">Agenda</h1>
        <div className="flex bg-white p-1 rounded-xl border shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg ${viewMode === 'month' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}><CalIcon size={18}/></button>
        </div>
      </div>

      {['pastor', 'lider'].includes(userRole) && filteredEvents.some(e => !e.published) && (
          <div className="bg-amber-100 border border-amber-200 p-4 rounded-2xl mb-6 flex items-center justify-between animate-pulse shadow-sm">
             <div className="flex items-center gap-3 text-amber-800"><Megaphone size={20}/><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-tighter">Cronograma Oculto</p><p className="text-[10px] font-bold opacity-70">Hay eventos que el equipo aún no ve.</p></div></div>
             <button onClick={() => setActionConfirm({ type: 'publish', title: '¿Publicar cronograma?', message: 'Se notificará a todo el equipo sobre las nuevas actividades.' })} disabled={isPublishing} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md">
                {isPublishing ? <Loader2 size={12} className="animate-spin"/> : <><Send size={12}/> PUBLICAR</>}
             </button>
          </div>
      )}

      {/* SELECTOR DE MES (MANTENIDO) */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
         <button onClick={prevMonth} className="p-2 text-slate-400"><ChevronLeft size={24} /></button>
         <h2 className="text-lg font-black text-slate-800 capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
         <button onClick={nextMonth} className="p-2 text-slate-400"><ChevronRight size={24} /></button>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32}/></div> : (viewMode === 'list' ? renderListView() : renderMonthView())}

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-4 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 border-4 border-white transition-all"><Plus size={32} /></button>
      )}

      {/* MODAL PASO 1: CREACIÓN SIMPLE (DISEÑO MANTENIDO) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[45px] p-8 shadow-2xl max-h-[92vh] overflow-y-auto animate-scale-in">
                <div className="flex justify-between items-center mb-8"><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Nuevo Evento</h2><button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button></div>
                <div className="space-y-5">
                    <input type="text" placeholder="TÍTULO DEL CULTO" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[25px] font-black outline-none uppercase text-sm focus:ring-2 focus:ring-brand-500/20" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" className="p-4 bg-slate-50 border border-slate-100 rounded-[25px] outline-none text-xs font-black uppercase" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        <input type="time" className="p-4 bg-slate-50 border border-slate-100 rounded-[25px] outline-none text-xs font-black" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                    </div>
                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-5 rounded-[30px] border-2 flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-inner' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                       <span className="text-[10px] font-black uppercase tracking-widest">¿Notificar al equipo ahora?</span>
                       {newEvent.published ? <Send size={20}/> : <EyeOff size={20}/>}
                    </button>
                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-5 rounded-[30px] shadow-2xl mt-4 active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-[0.2em]">
                        {isUploading ? <Loader2 className="animate-spin mx-auto" size={20}/> : "GUARDAR EVENTO"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ✅ PASO 2: VISTA DETALLADA Y EQUIPO */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-xl flex flex-col p-0 animate-fade-in overflow-y-auto">
            <div className="flex items-center justify-between p-6 sticky top-0 bg-transparent z-10">
               <button onClick={() => setSelectedEvent(null)} className="p-3 bg-white/10 text-white rounded-full"><X size={24}/></button>
               <h2 className="text-white font-black uppercase text-center flex-1 pr-12">Asignar Equipo</h2>
            </div>
            <div className="px-6 pb-20 space-y-8">
               <div className="text-center space-y-2">
                  <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-4"><CalIcon size={40} className="text-slate-900"/></div>
                  <h3 className="text-3xl font-black text-white uppercase leading-none tracking-tighter">{selectedEvent.title}</h3>
                  <p className="text-brand-500 font-black text-xs uppercase tracking-[0.3em]">{format(new Date(selectedEvent.date + 'T00:00:00'), 'EEEE d MMMM', {locale: es})}</p>
               </div>

               {['predica', 'alabanza', 'multimedia', 'recepcion'].map(role => (
                 <div key={role} className="bg-white rounded-[40px] p-8 shadow-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-4 mb-6 flex items-center gap-3">
                       <Users size={16} className="text-brand-500"/> Equipo {role}
                    </p>
                    <div className="space-y-3">
                       {selectedEvent.assignments?.[role]?.map(name => (
                         <div key={name} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="font-black text-slate-800 text-sm uppercase tracking-tight">{name}</span>
                            <button onClick={() => toggleMember(role, name)} className="text-rose-500 bg-rose-50 p-1.5 rounded-lg"><X size={14}/></button>
                         </div>
                       ))}
                       <button onClick={() => { setActiveAssignRole(role); setAssignSearch(''); }} className="w-full py-5 border-2 border-dashed border-slate-100 rounded-3xl flex items-center justify-center gap-2 text-slate-300 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                          <Plus size={16}/> AÑADIR A {role.toUpperCase()}
                       </button>
                    </div>
                 </div>
               ))}
               <button onClick={() => setSelectedEvent(null)} className="w-full py-6 bg-brand-600 text-slate-900 font-black rounded-[35px] shadow-2xl text-xs uppercase tracking-[0.2em] mt-8">FINALIZAR GESTIÓN</button>
            </div>
        </div>
      )}

      {renderTeamPicker()}

      {/* MODALES EXTRAS (CONFIRMACIÓN, TOASTS, DÍAS) */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedDayEvents(null)}>
            <div className="bg-white w-full max-w-sm rounded-t-[40px] p-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6"><h3 className="font-black text-xl text-slate-800 capitalize tracking-tighter">{format(selectedDayEvents.date, 'EEEE d MMMM', {locale: es})}</h3><button onClick={() => setSelectedDayEvents(null)}><X size={20}/></button></div>
                <div className="space-y-3">{selectedDayEvents.events.map(ev => (
                    <div key={ev.id} onClick={() => { setSelectedEvent(ev); setSelectedDayEvents(null); }} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors"><div className="p-2.5 rounded-2xl bg-brand-50 text-brand-600 shadow-sm"><CalIcon size={20}/></div><div className="flex-1 overflow-hidden"><h4 className="font-black text-sm text-slate-800 truncate uppercase">{ev.title}</h4><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{ev.time} hs</p></div><ChevronRight size={16} className="text-slate-300"/></div>
                ))}</div>
            </div>
        </div>
      )}

      {actionConfirm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[35px] p-10 shadow-2xl text-center">
            <AlertCircle size={40} className="mx-auto mb-6 text-amber-500"/>
            <h4 className="font-black text-slate-800 text-lg mb-2 uppercase tracking-tighter">{actionConfirm.title}</h4>
            <p className="text-xs text-slate-400 font-bold mb-10 uppercase tracking-widest leading-relaxed">{actionConfirm.message}</p>
            <div className="space-y-3">
              <button onClick={executeConfirmedAction} className={`w-full py-5 rounded-[25px] font-black text-[10px] uppercase shadow-lg ${actionConfirm.type === 'delete' ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-amber-600 text-white shadow-amber-200'}`}>Confirmar Acción</button>
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