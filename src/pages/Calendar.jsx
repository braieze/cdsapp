import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  deleteDoc, doc, getDoc, serverTimestamp,
  writeBatch, updateDoc, setDoc
} from 'firebase/firestore';
import {
  Plus, Calendar as CalIcon, List, Clock, Trash2, X,
  ChevronLeft, ChevronRight, Loader2, Megaphone,
  Send, EyeOff, CheckCircle, XCircle, Edit3,
  AlertCircle, ChevronRight as ArrowRight, LayoutGrid, Sparkles, Heart, UserCheck, Globe,
  Church, Users, Music, Eraser, Wrench, Flame, Lock, Info, CheckSquare, MessageSquare, ChevronDown
} from 'lucide-react';
import { 
  format, addMonths, subMonths, isSameMonth, startOfMonth, 
  endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, 
  isSameDay, isWithinInterval, parseISO, isAfter, startOfDay, isBefore, differenceInDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

export const OPERATIVE_EVENT_TYPES = {
  culto: { label: 'Culto', icon: Church, color: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50' },
  jovenes: { label: 'Jóvenes', icon: Users, color: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-50' },
  mujeres: { label: 'Mujeres', icon: Heart, color: 'bg-pink-500', text: 'text-pink-500', light: 'bg-pink-50' },
  varones: { label: 'Varones', icon: UserCheck, color: 'bg-indigo-500', text: 'text-indigo-500', light: 'bg-indigo-50' },
  ensayo: { label: 'Ensayo', icon: Music, color: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50', private: true },
  limpieza: { label: 'Limpieza', icon: Eraser, color: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-50' },
  mantenimiento: { label: 'Mantenimiento', icon: Wrench, color: 'bg-slate-600', text: 'text-slate-600', light: 'bg-slate-100' },
  ayuno: { label: 'Ayuno', icon: Flame, color: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-50' }
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  
  const [viewMode, setViewMode] = useState('list'); 
  const [filterType, setFilterType] = useState(() => localStorage.getItem('cds_filter') || 'mine');
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionConfirm, setActionConfirm] = useState(null);

  const currentUser = auth.currentUser;

  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '',
    published: false, isCena: false
  });

  useEffect(() => {
    localStorage.setItem('cds_filter', filterType);
  }, [filterType]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
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

  // ✅ MEJORA: Función de notificación con Deep Linking (route)
  const sendOneSignalNotification = async (notifTitle, notifBody, path) => {
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      if (!REST_API_KEY) {
        console.error("Falta REST API KEY de OneSignal");
        return;
      }

      const payload = {
        app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
        included_segments: ["Total Subscriptions"],
        headings: { en: notifTitle, es: notifTitle },
        contents: { en: notifBody, es: notifBody },
        // ✅ DEEP LINK: Esto asocia la notificación con la ruta interna
        data: { route: path }, 
        large_icon: "https://cdsapp.vercel.app/logo.png",
        priority: 10,
        android_visibility: 1,
        android_accent_color: "FF0000"
      };

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json; charset=utf-8", 
          "Authorization": `Basic ${REST_API_KEY}` 
        },
        body: JSON.stringify(payload)
      });

      // Registro en historial de notificaciones
      await addDoc(collection(db, 'notificaciones_globales'), {
        titulo: notifTitle,
        mensaje: notifBody,
        fecha: new Date().toISOString(),
        destino: 'TODA LA IGLESIA',
        link: path
      });

    } catch (error) { console.error("Error en notificación:", error); }
  };

  const executeConfirmedAction = async () => {
    if (!actionConfirm) return;
    const { type, id } = actionConfirm;
    setActionConfirm(null);
    if (type === 'delete') {
      try {
        await deleteDoc(doc(db, 'events', id));
        setToast({ message: "Evento eliminado", type: "info" });
      } catch (e) { setToast({ message: "Error", type: "error" }); }
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
        
        // ✅ DEEP LINK: Lleva a la vista principal del calendario
        await sendOneSignalNotification(
          `📅 Agenda lista`, 
          "Se publicaron las actividades del mes. ¡Miralas ahora!", 
          "/calendario"
        );
        
        setToast({ message: "¡Todo publicado!", type: "success" });
      } catch (e) { setToast({ message: "Error", type: "error" }); }
      finally { setIsPublishing(false); }
    }
  };

  const processedEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const isPastor = ['pastor', 'lider'].includes(userRole);

    const filtered = events.filter(ev => {
      const eventDate = new Date(ev.date + 'T00:00:00');
      const isMyTask = ev.assignments && Object.values(ev.assignments).flat().includes(currentUser?.displayName);
      if (!isSameMonth(eventDate, currentDate)) return false;
      if (!ev.published && !isPastor && !isMyTask) return false;
      if (filterType === 'mine' && !isMyTask) return false;
      return true;
    });

    return {
      past: filtered.filter(ev => isBefore(new Date(ev.date + 'T00:00:00'), today)),
      upcoming: filtered.filter(ev => !isBefore(new Date(ev.date + 'T00:00:00'), today))
    };
  }, [events, filterType, currentDate, userRole, currentUser]);

  const handleSaveEvent = async () => {
    if (!newEvent.title || !newEvent.date) return setToast({ message: "Falta título o fecha", type: "error" });
    setIsUploading(true);
    try {
        const eventData = { ...newEvent, updatedAt: serverTimestamp(), endDate: newEvent.endDate || newEvent.date };
        if (editingId) {
            await updateDoc(doc(db, 'events', editingId), eventData);
            setToast({ message: "Actualizado", type: "success" });
        } else {
            const docRef = await addDoc(collection(db, 'events'), { ...eventData, createdAt: serverTimestamp(), assignments: {} });
            
            // ✅ DEEP LINK: Lleva al detalle del evento recién creado
            if (newEvent.published) {
              await sendOneSignalNotification(
                "Nueva actividad", 
                `${newEvent.title} - ${format(parseISO(newEvent.date), "d 'de' MMMM", {locale: es})}`, 
                `/calendario/${docRef.id}`
              );
            }
            
            setToast({ message: "Evento creado", type: "success" });
        }
        setIsModalOpen(false);
        setEditingId(null);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', published: false, isCena: false });
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); }
    finally { setIsUploading(false); }
  };

  const renderEventCard = (ev, isPast) => {
    const config = OPERATIVE_EVENT_TYPES[ev.type] || OPERATIVE_EVENT_TYPES.culto;
    const isMyTask = ev.assignments && Object.values(ev.assignments).flat().includes(currentUser?.displayName);
    const today = startOfDay(new Date());

    const canAccess = !config.private || (['pastor', 'lider'].includes(userRole) || dbUser?.area?.toLowerCase() === 'alabanza');
    
    let progress = null;
    if (ev.type === 'limpieza' || ev.type === 'mantenimiento') {
      const sectors = ev.checklist ? Object.values(ev.checklist) : [];
      const done = sectors.filter(s => s.done).length;
      if (sectors.length > 0) progress = Math.round((done / sectors.length) * 100);
    }

    let fastingInfo = null;
    if (ev.type === 'ayuno') {
      const start = parseISO(ev.date);
      const end = parseISO(ev.endDate || ev.date);
      const totalDays = differenceInDays(end, start) + 1;
      const currentDayNum = (isWithinInterval(today, { start, end }) || isSameDay(today, start)) ? differenceInDays(today, start) + 1 : 1;
      const todaySignups = ev.fastingSignups?.[format(today, 'yyyy-MM-dd')] || [];
      fastingInfo = { totalDays, currentDayNum, signups: todaySignups };
    }

    return (
      <div key={ev.id} 
           onClick={() => canAccess ? navigate(`/calendario/${ev.id}`) : setToast({message: "Acceso Privado", type: "error"})}
           className={`bg-white p-6 rounded-[35px] border-2 transition-all active:scale-95 cursor-pointer relative shadow-sm flex gap-5
           ${isPast ? 'grayscale-[0.6] opacity-70 border-dashed border-slate-200 bg-slate-50/40 shadow-none' : 'border-slate-50'} 
           ${ev.isCena ? 'border-rose-500 shadow-rose-100 ring-4 ring-rose-500/10' : ''}
           ${isMyTask && !isPast ? 'border-brand-500 shadow-brand-100' : ''}`}>
        
        {isMyTask && !isPast && (
          <div className="absolute -top-3 right-8 bg-brand-600 text-white px-3 py-1 rounded-full text-[8px] font-black tracking-widest shadow-lg border-2 border-white">MI TURNO</div>
        )}

        {!ev.published && (
           <div className="absolute -top-3 left-8 bg-amber-500 text-white px-3 py-1 rounded-full text-[8px] font-black tracking-widest shadow-lg border-2 border-white flex items-center gap-1"><EyeOff size={10}/> BORRADOR</div>
        )}

        <div className={`flex flex-col items-center justify-center px-4 rounded-3xl border-2 min-w-[75px] ${config.light} ${config.text} border-current opacity-80 h-20`}>
          <span className="text-[10px] font-black uppercase opacity-60">{format(new Date(ev.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
          <span className="text-2xl font-black">{format(new Date(ev.date + 'T00:00:00'), 'dd')}</span>
        </div>

        <div className="flex-1 min-w-0 text-left py-1">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
                <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${config.color} text-white`}>{config.label}</span>
                {config.private && <Lock size={10} className="text-slate-400"/>}
            </div>
            {['pastor', 'lider'].includes(userRole) && (
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); setEditingId(ev.id); setNewEvent(ev); setIsModalOpen(true); }} className="p-1 text-slate-300 hover:text-brand-600"><Edit3 size={16}/></button>
                <button onClick={(e) => { e.stopPropagation(); setActionConfirm({ type: 'delete', id: ev.id, title: '¿Borrar?', message: 'Se borrará permanentemente.' }); }} className="p-1 text-slate-200 hover:text-rose-500"><Trash2 size={16}/></button>
              </div>
            )}
          </div>
          
          <h4 className="font-black text-slate-800 text-lg leading-tight mt-2 uppercase truncate">
            {ev.type === 'ayuno' ? 'Semana de Ayuno Congregacional' : ev.title}
          </h4>

          <div className="mt-3 space-y-2">
            {ev.type === 'ayuno' && fastingInfo ? (
               <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Día {fastingInfo.currentDayNum} de {fastingInfo.totalDays}</span>
                  <div className="flex -space-x-2">
                    {fastingInfo.signups.slice(0, 3).map((s, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm"><img src={`https://ui-avatars.com/api/?name=${s}&background=random&color=fff`} /></div>
                    ))}
                  </div>
               </div>
            ) : (
              <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Clock size={12} className="text-brand-500"/> {ev.time} hs</span>
            )}
            
            {progress !== null && (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-50 shadow-inner">
                <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate)), end: endOfWeek(endOfMonth(currentDate)) });
    return (
        <div className="bg-white rounded-[50px] border-2 border-slate-50 shadow-xl p-8 animate-fade-in mx-6 mb-20 text-left relative overflow-hidden">
            <div className="grid grid-cols-7 mb-6 border-b border-slate-50 pb-4">
                {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(day => <div key={day} className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonthDay = isSameMonth(day, currentDate);
                    const dayEvents = events.filter(e => isSameDay(parseISO(e.date), day));
                    const hasEvents = dayEvents.length > 0;
                    return (
                        <div key={day.toString()} 
                            onClick={() => hasEvents && setSelectedDayEvents({ date: day, events: dayEvents })}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all active:scale-90
                                ${!isCurrentMonthDay ? 'opacity-10' : 'text-slate-700'}
                                ${isToday ? 'bg-slate-900 text-white shadow-xl scale-110 z-10' : 'hover:bg-slate-50'}`}>
                            <span className="text-xs font-black">{format(day, 'd')}</span>
                            {hasEvents && !isToday && (
                              <div className="flex gap-0.5 mt-1">
                                {dayEvents.slice(0, 3).map(e => <div key={e.id} className={`w-1 h-1 rounded-full ${OPERATIVE_EVENT_TYPES[e.type]?.color || 'bg-slate-300'}`}></div>)}
                              </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="pb-36 pt-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit">
      
      {/* HEADER PRINCIPAL */}
      <div className="px-6 flex justify-between items-center mb-8">
        <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Agenda</h1>
            <div className="h-1.5 w-10 bg-brand-500 rounded-full mt-2"></div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="p-4 bg-white rounded-[22px] border-2 border-slate-50 shadow-sm text-slate-400 active:scale-90 transition-all">
             {viewMode === 'list' ? <CalIcon size={24}/> : <List size={24}/>}
           </button>
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="px-6 mb-10">
        <div className="bg-white p-1.5 rounded-[30px] shadow-sm border-2 border-slate-50 flex gap-1">
          <button onClick={() => setFilterType('mine')} 
            className={`flex-1 py-4 rounded-[25px] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
            ${filterType === 'mine' ? 'bg-brand-600 text-white shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-50'}`}>
            <UserCheck size={18}/> Mis Turnos
          </button>
          <button onClick={() => setFilterType('all')} 
            className={`flex-1 py-4 rounded-[25px] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
            ${filterType === 'all' ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Globe size={18}/> Global
          </button>
        </div>
      </div>

      {['pastor', 'lider'].includes(userRole) && events.some(e => !e.published && isSameMonth(new Date(e.date + 'T00:00:00'), currentDate)) && (
          <div className="mx-6 bg-amber-500 p-6 rounded-[35px] mb-8 flex items-center justify-between shadow-xl shadow-amber-200/40 animate-pulse">
            <div className="flex items-center gap-4 text-white text-left">
              <Megaphone size={26}/>
              <div><p className="text-xs font-black uppercase tracking-tighter">Borradores</p><p className="text-[9px] font-bold opacity-90 uppercase">Listos para lanzar</p></div>
            </div>
            <button onClick={() => setActionConfirm({ type: 'publish', title: '¿Publicar Agenda?', message: 'Se notificará a toda la iglesia.' })} disabled={isPublishing} className="bg-white text-amber-600 px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg">
              {isPublishing ? <Loader2 size={12} className="animate-spin"/> : 'Publicar'}
            </button>
          </div>
      )}

      {/* SELECTOR DE MES */}
      <div className="px-6 flex items-center justify-between bg-white mx-5 p-5 rounded-[30px] border border-slate-100 mb-10 shadow-sm">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-3 text-slate-300 bg-slate-50 rounded-2xl active:scale-75 transition-transform"><ChevronLeft size={24} /></button>
        <h2 className="text-lg font-black text-slate-900 capitalize tracking-tighter">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-3 text-slate-300 bg-slate-50 rounded-2xl active:scale-75 transition-transform"><ChevronRight size={24} /></button>
      </div>

      <div className="flex-1">
        {loading ? <div className="py-24 text-center opacity-20"><Loader2 className="animate-spin mx-auto" size={48}/></div> : (viewMode === 'calendar' ? renderMonthView() : (
          <div className="space-y-12 px-6 pb-20">
            {processedEvents.upcoming.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest whitespace-nowrap">Lo que viene</span>
                  <div className="h-[1px] flex-1 bg-brand-100"></div>
                </div>
                {processedEvents.upcoming.map(ev => renderEventCard(ev, false))}
              </div>
            )}
            {processedEvents.past.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">Anteriormente</span>
                  <div className="h-[1px] flex-1 bg-slate-100"></div>
                </div>
                {processedEvents.past.map(ev => renderEventCard(ev, true))}
              </div>
            )}
          </div>
        ))}
      </div>

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => { setEditingId(null); setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', published: false }); setIsModalOpen(true); }} className="fixed bottom-28 right-6 w-18 h-18 bg-slate-900 text-white rounded-[30px] shadow-2xl flex items-center justify-center z-40 border-4 border-white active:scale-90 transition-all"><Plus size={36}/></button>
      )}

      {selectedDayEvents && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setSelectedDayEvents(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[50px] p-10 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 text-left">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{format(selectedDayEvents.date, "EEEE d", { locale: es })}</h3>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{format(selectedDayEvents.date, "MMMM", { locale: es })}</p>
              </div>
              <button onClick={() => setSelectedDayEvents(null)} className="p-3 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar pb-6 text-left">
              {selectedDayEvents.events.map(ev => (
                <button key={ev.id} onClick={() => { setSelectedDayEvents(null); navigate(`/calendario/${ev.id}`); }} className="w-full flex items-center justify-between p-6 bg-slate-50 rounded-[30px] border-2 border-slate-100 active:scale-95 transition-all">
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${OPERATIVE_EVENT_TYPES[ev.type]?.color || 'bg-slate-200'} text-white shadow-sm`}>
                      {(() => { const Icon = OPERATIVE_EVENT_TYPES[ev.type]?.icon || Church; return <Icon size={24}/> })()}
                    </div>
                    <div><p className="font-black text-slate-900 text-sm uppercase tracking-tight">{ev.title}</p><p className="text-[11px] font-bold text-slate-400 uppercase">{ev.time} hs</p></div>
                  </div>
                  <ArrowRight size={20} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white w-full max-w-sm rounded-[50px] p-10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative animate-slide-up text-left">
                <div className="flex justify-between items-center mb-8 border-b pb-5 border-slate-50">
                    <div><h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingId ? 'Editar' : 'Planificar'}</h2><p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Actividad Ministerial</p></div>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400"><X size={24}/></button>
                </div>
                <div className="space-y-6">
                    <input placeholder="Título..." className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] font-black text-slate-800 outline-none focus:border-brand-500 uppercase text-sm" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Inicio</label>
                          <input type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase outline-none" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
                        {newEvent.type === 'ayuno' && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Finalización</label>
                            <input type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase outline-none" value={newEvent.endDate} onChange={e => setNewEvent({...newEvent, endDate: e.target.value})} />
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Hora</label>
                          <input type="time" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase outline-none" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(OPERATIVE_EVENT_TYPES).map(([key, config]) => (
                            <button key={key} onClick={() => setNewEvent({...newEvent, type: key})} className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-[8px] font-black uppercase transition-all ${newEvent.type === key ? config.color + ' border-current text-white shadow-md' : 'bg-white border-slate-50 text-slate-300'}`}>
                              <config.icon size={14}/> {config.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-5 rounded-[28px] border-2 flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">¿Notificar Iglesia?</span>
                        {newEvent.published ? <CheckCircle size={24}/> : <EyeOff size={24}/>}
                    </button>
                    <button onClick={handleSaveEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-6 rounded-[35px] shadow-2xl mt-4 active:scale-95 transition-all disabled:opacity-50 uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-3">
                        {isUploading ? <Loader2 className="animate-spin" size={24}/> : (editingId ? "Guardar Cambios" : "Confirmar Actividad")}
                    </button>
                </div>
            </div>
        </div>
      )}

      {actionConfirm && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[45px] p-10 shadow-2xl text-center">
            <AlertCircle size={44} className="mx-auto text-rose-500 mb-6" strokeWidth={3}/>
            <h4 className="font-black text-slate-900 text-xl mb-3 uppercase tracking-tighter">{actionConfirm.title}</h4>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-10 leading-relaxed">{actionConfirm.message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeConfirmedAction} className="w-full py-5 rounded-2xl font-black text-xs uppercase bg-rose-600 text-white shadow-xl">Confirmar</button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-5 rounded-2xl font-black text-xs uppercase text-slate-400 bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[600] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <CheckCircle size={24}/><span className="text-[11px] font-black uppercase tracking-widest leading-none">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}