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
import { ONESIGNAL_CONFIG } from '../oneSignalConfig';

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

  const sendOneSignalNotification = async (notifTitle, notifBody, path) => {
    try {
      const REST_API_KEY = ONESIGNAL_CONFIG.REST_API_KEY;
      const APP_ID = ONESIGNAL_CONFIG.APP_ID;
      
      if (!REST_API_KEY) return;

      const payload = {
        app_id: APP_ID,
        included_segments: ["Total Subscriptions"],
        headings: { en: notifTitle, es: notifTitle },
        contents: { en: notifBody, es: notifBody },
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
           className={`flex bg-white rounded-[28px] overflow-hidden transition-all active:scale-[0.98] cursor-pointer mb-5
           ${isPast ? 'grayscale-[0.6] opacity-70 shadow-sm border border-slate-200' : 'shadow-[0_8px_30px_rgb(0,0,0,0.06)] border-0'} 
           ${ev.isCena ? 'ring-4 ring-rose-500/20' : ''}`}>
        
        {/* BLOQUE DE COLOR FUERTE (ESTILO DISEÑO GRÁFICO) */}
        <div className={`w-24 ${config.color} text-white flex flex-col items-center justify-center p-4 relative overflow-hidden shrink-0`}>
            {/* Ícono de fondo sutil para dar textura */}
            {(() => { const Icon = config.icon; return <Icon className="absolute -bottom-3 -left-3 w-16 h-16 opacity-20" /> })()}
            <span className="text-[10px] font-black uppercase tracking-widest opacity-90 relative z-10">{format(new Date(ev.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
            <span className="text-3xl font-black leading-none mt-1 relative z-10">{format(new Date(ev.date + 'T00:00:00'), 'dd')}</span>
        </div>

        <div className="flex-1 p-5 relative min-w-0 bg-white">
          {/* ETIQUETAS ABSOLUTAS */}
          {isMyTask && !isPast && (
            <div className="absolute top-4 right-4 bg-slate-900 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-widest shadow-sm">MI TURNO</div>
          )}
          {!ev.published && (
            <div className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-widest shadow-sm flex items-center gap-1"><EyeOff size={10}/> BORRADOR</div>
          )}

          <div className="flex items-center gap-2 mb-2 flex-wrap pr-16">
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest ${config.light} ${config.text}`}>
                {config.label}
              </span>
              {config.private && <Lock size={12} className="text-slate-400"/>}
          </div>
          
          <h4 className="font-black text-slate-900 text-[17px] leading-tight uppercase tracking-tighter truncate mt-1">
            {ev.type === 'ayuno' ? 'Semana de Ayuno' : ev.title}
          </h4>

          <div className="mt-3 flex items-center justify-between">
            {ev.type === 'ayuno' && fastingInfo ? (
               <div className="flex flex-col gap-1.5 w-full">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Día {fastingInfo.currentDayNum} de {fastingInfo.totalDays}</span>
                  <div className="flex -space-x-1.5">
                    {fastingInfo.signups.slice(0, 3).map((s, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 overflow-hidden shadow-sm"><img src={`https://ui-avatars.com/api/?name=${s}&background=random&color=fff`} alt={s}/></div>
                    ))}
                  </div>
               </div>
            ) : (
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={14} className={config.text}/> {ev.time} HS
              </span>
            )}

            {/* BOTONES ADMINISTRATIVOS */}
            {['pastor', 'lider'].includes(userRole) && (
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); setEditingId(ev.id); setNewEvent(ev); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-slate-50 rounded-full transition-colors"><Edit3 size={16}/></button>
                <button onClick={(e) => { e.stopPropagation(); setActionConfirm({ type: 'delete', id: ev.id, title: '¿Borrar Evento?', message: 'Esta acción no se puede deshacer.' }); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={16}/></button>
              </div>
            )}
          </div>
          
          {progress !== null && (
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex mt-3">
              <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${progress}%` }}></div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate)), end: endOfWeek(endOfMonth(currentDate)) });
    return (
        <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 mx-4 mb-20 text-left relative overflow-hidden border-0">
            <div className="grid grid-cols-7 mb-4 border-b border-slate-100 pb-4">
                {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(day => <div key={day} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">{day}</div>)}
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
                                ${!isCurrentMonthDay ? 'opacity-20' : 'text-slate-800'}
                                ${isToday ? 'bg-slate-900 text-white shadow-lg scale-105 z-10' : 'hover:bg-slate-50'}`}>
                            <span className="text-xs font-black">{format(day, 'd')}</span>
                            {hasEvents && !isToday && (
                              <div className="flex gap-1 mt-1">
                                {dayEvents.slice(0, 3).map(e => <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${OPERATIVE_EVENT_TYPES[e.type]?.color || 'bg-slate-300'}`}></div>)}
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
    <div className="pb-24 pt-4 bg-slate-50 min-h-screen relative font-sans">
      
      {/* 🚀 HEADER PREMIUM Y VIBRANTE */}
      <div className="px-5 flex justify-between items-center mb-6 max-w-md mx-auto">
        <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Agenda</h1>
            <div className="h-1.5 w-10 bg-blue-600 rounded-full mt-2"></div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="w-12 h-12 bg-white rounded-[18px] shadow-sm text-slate-600 flex items-center justify-center active:scale-90 transition-all hover:bg-slate-50 border border-slate-100">
             {viewMode === 'list' ? <CalIcon size={20} strokeWidth={2.5}/> : <List size={20} strokeWidth={2.5}/>}
           </button>
        </div>
      </div>

      {/* 🚀 PESTAÑAS TIPO PASTILLERO */}
      <div className="px-5 mb-8 max-w-md mx-auto">
        <div className="bg-white p-1.5 rounded-[20px] flex shadow-sm border border-slate-100">
          <button onClick={() => setFilterType('mine')} 
            className={`flex-1 py-3 rounded-[14px] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2
            ${filterType === 'mine' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-700'}`}>
            <UserCheck size={16}/> Mis Turnos
          </button>
          <button onClick={() => setFilterType('all')} 
            className={`flex-1 py-3 rounded-[14px] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2
            ${filterType === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-700'}`}>
            <Globe size={16}/> Global
          </button>
        </div>
      </div>

      {/* 🚀 AVISO BORRADORES */}
      {['pastor', 'lider'].includes(userRole) && events.some(e => !e.published && isSameMonth(new Date(e.date + 'T00:00:00'), currentDate)) && (
          <div className="mx-5 max-w-md md:mx-auto bg-amber-500 p-5 rounded-[24px] mb-8 flex items-center justify-between shadow-lg shadow-amber-500/30">
            <div className="flex items-center gap-3 text-white text-left">
              <Megaphone size={24}/>
              <div><p className="text-[11px] font-black uppercase tracking-widest">Borradores</p><p className="text-[9px] font-bold opacity-90 uppercase">Listos para lanzar</p></div>
            </div>
            <button onClick={() => setActionConfirm({ type: 'publish', title: '¿Publicar Agenda?', message: 'Se notificará a toda la iglesia.' })} disabled={isPublishing} className="bg-white text-amber-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all">
              {isPublishing ? <Loader2 size={14} className="animate-spin"/> : 'Publicar'}
            </button>
          </div>
      )}

      {/* 🚀 SELECTOR DE MES */}
      <div className="px-5 flex items-center justify-between mb-8 max-w-md mx-auto">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="w-12 h-12 bg-white rounded-[18px] flex items-center justify-center text-slate-500 hover:bg-slate-50 shadow-sm active:scale-90 transition-transform border border-slate-100"><ChevronLeft size={24} /></button>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="w-12 h-12 bg-white rounded-[18px] flex items-center justify-center text-slate-500 hover:bg-slate-50 shadow-sm active:scale-90 transition-transform border border-slate-100"><ChevronRight size={24} /></button>
      </div>

      <div className="flex-1 max-w-md mx-auto w-full px-5">
        {loading ? <div className="py-24 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={40}/></div> : (viewMode === 'calendar' ? renderMonthView() : (
          <div className="space-y-10 pb-8">
            {processedEvents.upcoming.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1 mb-2">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Lo que viene</span>
                  <div className="h-[2px] flex-1 bg-blue-100 rounded-full"></div>
                </div>
                {processedEvents.upcoming.map(ev => renderEventCard(ev, false))}
              </div>
            )}
            {processedEvents.past.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1 mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anteriormente</span>
                  <div className="h-[2px] flex-1 bg-slate-200 rounded-full"></div>
                </div>
                {processedEvents.past.map(ev => renderEventCard(ev, true))}
              </div>
            )}
            
            {processedEvents.upcoming.length === 0 && processedEvents.past.length === 0 && (
              <div className="text-center py-16 px-6 bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] mx-2">
                <div className="w-20 h-20 bg-slate-50 rounded-[24px] flex items-center justify-center mx-auto mb-4">
                   <CalIcon size={32} className="text-slate-300" strokeWidth={2.5} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">No hay actividades</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 🚀 BOTÓN FLOTANTE CREAR */}
      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => { setEditingId(null); setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', published: false }); setIsModalOpen(true); }} className="fixed bottom-24 right-5 w-16 h-16 bg-slate-900 text-white rounded-[22px] shadow-[0_10px_25px_rgba(0,0,0,0.3)] flex items-center justify-center z-40 active:scale-90 transition-transform"><Plus size={32} strokeWidth={2.5}/></button>
      )}

      {/* 🚀 MODAL EVENTOS DEL DÍA (CALENDARIO) */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-[600] bg-slate-900/40 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedDayEvents(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[40px] p-8 shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 shrink-0"></div>
            <div className="flex justify-between items-center mb-8 text-left">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{format(selectedDayEvents.date, "EEEE d", { locale: es })}</h3>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{format(selectedDayEvents.date, "MMMM", { locale: es })}</p>
              </div>
              <button onClick={() => setSelectedDayEvents(null)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={20}/></button>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar pb-6 text-left">
              {selectedDayEvents.events.map(ev => (
                <button key={ev.id} onClick={() => { setSelectedDayEvents(null); navigate(`/calendario/${ev.id}`); }} className="w-full flex items-center justify-between p-5 bg-white rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.04)] active:scale-95 transition-all border border-slate-50">
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-[18px] ${OPERATIVE_EVENT_TYPES[ev.type]?.color || 'bg-slate-200'} text-white shadow-md`}>
                      {(() => { const Icon = OPERATIVE_EVENT_TYPES[ev.type]?.icon || Church; return <Icon size={24}/> })()}
                    </div>
                    <div><p className="font-black text-slate-900 text-[15px] uppercase tracking-tighter truncate">{ev.title}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{ev.time} hs</p></div>
                  </div>
                  <ArrowRight size={20} className="text-slate-300" strokeWidth={3} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL CREAR/EDITAR (BOTTOM SHEET PREMIUM) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative text-left">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>
                
                <div className="flex justify-between items-center mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{editingId ? 'Editar' : 'Planificar'}</h2>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">Actividad Ministerial</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={20}/></button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Título del Evento</label>
                      <input placeholder="Ej. Culto General..." className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] font-black text-slate-900 outline-none focus:border-blue-500 text-[15px] uppercase transition-all" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2 sm:col-span-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Inicio</label>
                          <input type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase outline-none focus:border-blue-500" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
                        {newEvent.type === 'ayuno' && (
                          <div className="space-y-2 col-span-2 sm:col-span-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Fin</label>
                            <input type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase outline-none focus:border-blue-500" value={newEvent.endDate} onChange={e => setNewEvent({...newEvent, endDate: e.target.value})} />
                          </div>
                        )}
                        <div className="space-y-2 col-span-2 sm:col-span-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Horario</label>
                          <input type="time" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase outline-none focus:border-blue-500" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Categoría</label>
                      <div className="grid grid-cols-2 gap-3">
                          {Object.entries(OPERATIVE_EVENT_TYPES).map(([key, config]) => (
                              <button key={key} onClick={() => setNewEvent({...newEvent, type: key})} className={`flex items-center gap-3 p-4 rounded-[20px] border-2 text-[10px] font-black uppercase tracking-wider transition-all ${newEvent.type === key ? config.color + ' border-transparent text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
                                <config.icon size={18}/> {config.label}
                              </button>
                          ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-[24px] border-2 cursor-pointer mt-4 transition-all duration-300 ${newEvent.published ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}" onClick={() => setNewEvent({...newEvent, published: !newEvent.published})}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${newEvent.published ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                              {newEvent.published ? <CheckCircle size={20} /> : <EyeOff size={20} />}
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-[13px] font-black uppercase tracking-tight ${newEvent.published ? 'text-emerald-700' : 'text-slate-700'}`}>Publicar al guardar</span>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Visible para todos</span>
                            </div>
                        </div>
                        <div className={`w-14 h-7 rounded-full relative transition-all duration-300 ${newEvent.published ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${newEvent.published ? 'right-1' : 'left-1'}`}></div>
                        </div>
                    </div>

                    <button onClick={handleSaveEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-5 rounded-[24px] shadow-xl mt-6 active:scale-95 transition-all disabled:opacity-50 text-[11px] uppercase tracking-widest flex items-center justify-center gap-3">
                        {isUploading ? <Loader2 className="animate-spin" size={20}/> : (editingId ? "Guardar Cambios" : "Confirmar Actividad")}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 🚀 MODAL CONFIRMAR */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
              <AlertCircle size={40} className="text-rose-500" strokeWidth={2.5}/>
            </div>
            <h4 className="font-black text-slate-900 text-xl mb-3 uppercase tracking-tighter">{actionConfirm.title}</h4>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-8 leading-relaxed">{actionConfirm.message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeConfirmedAction} className="w-full py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest bg-rose-600 text-white shadow-xl active:scale-95 transition-transform">Confirmar</button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest text-slate-400 bg-slate-50 active:scale-95 transition-transform">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 TOAST */}
      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[600]">
          <div className={`flex items-center gap-4 px-6 py-4 rounded-[24px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-900 border-slate-700'} text-white`}>
            {toast.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}