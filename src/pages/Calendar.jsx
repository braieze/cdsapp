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
           className={`bg-white p-5 rounded-[24px] border border-slate-100 transition-all active:scale-[0.98] cursor-pointer relative shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex gap-4
           ${isPast ? 'grayscale-[0.6] opacity-70 bg-slate-50/50 shadow-none border-slate-200' : ''} 
           ${ev.isCena ? 'border-rose-200 bg-rose-50/10' : ''}
           ${isMyTask && !isPast ? 'border-blue-200 bg-blue-50/10 shadow-[0_4px_15px_rgba(37,99,235,0.05)]' : ''}`}>
        
        {isMyTask && !isPast && (
          <div className="absolute -top-2 right-6 bg-blue-600 text-white px-3 py-0.5 rounded-full text-[9px] font-bold tracking-wider shadow-sm border border-white">MI TURNO</div>
        )}

        {!ev.published && (
           <div className="absolute -top-2 left-6 bg-amber-500 text-white px-3 py-0.5 rounded-full text-[9px] font-bold tracking-wider shadow-sm border border-white flex items-center gap-1"><EyeOff size={10}/> BORRADOR</div>
        )}

        <div className={`flex flex-col items-center justify-center px-4 w-16 rounded-[20px] shrink-0 border border-slate-100/50 ${config.light} ${config.text}`}>
          <span className="text-[10px] font-bold uppercase">{format(new Date(ev.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
          <span className="text-xl font-bold leading-none mt-0.5">{format(new Date(ev.date + 'T00:00:00'), 'dd')}</span>
        </div>

        <div className="flex-1 min-w-0 text-left py-0.5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${config.color} text-white`}>{config.label}</span>
                {config.private && <Lock size={12} className="text-slate-400"/>}
            </div>
            {['pastor', 'lider'].includes(userRole) && (
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); setEditingId(ev.id); setNewEvent(ev); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-full transition-colors"><Edit3 size={14}/></button>
                <button onClick={(e) => { e.stopPropagation(); setActionConfirm({ type: 'delete', id: ev.id, title: '¿Borrar?', message: 'Se borrará permanentemente.' }); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={14}/></button>
              </div>
            )}
          </div>
          
          <h4 className="font-bold text-slate-900 text-[15px] leading-tight mt-1.5 truncate">
            {ev.type === 'ayuno' ? 'Semana de Ayuno Congregacional' : ev.title}
          </h4>

          <div className="mt-2 space-y-2">
            {ev.type === 'ayuno' && fastingInfo ? (
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-600 uppercase">Día {fastingInfo.currentDayNum} de {fastingInfo.totalDays}</span>
                  <div className="flex -space-x-1.5">
                    {fastingInfo.signups.slice(0, 3).map((s, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border border-white bg-slate-100 overflow-hidden shadow-sm"><img src={`https://ui-avatars.com/api/?name=${s}&background=random&color=fff`} /></div>
                    ))}
                  </div>
               </div>
            ) : (
              <span className="text-[12px] font-semibold text-slate-500 flex items-center gap-1.5"><Clock size={12} className="text-slate-400"/> {ev.time} hs</span>
            )}
            
            {progress !== null && (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-50 shadow-inner mt-1">
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
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 animate-fade-in text-left relative overflow-hidden">
            <div className="grid grid-cols-7 mb-4 border-b border-slate-100 pb-3">
                {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(day => <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">{day}</div>)}
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
                            className={`aspect-square rounded-full flex flex-col items-center justify-center relative cursor-pointer transition-all active:scale-95
                                ${!isCurrentMonthDay ? 'opacity-20' : 'text-slate-700'}
                                ${isToday ? 'bg-blue-600 text-white shadow-md z-10' : 'hover:bg-slate-50'}`}>
                            <span className="text-sm font-semibold">{format(day, 'd')}</span>
                            {hasEvents && !isToday && (
                              <div className="flex gap-0.5 mt-0.5">
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
    <div className="pb-24 pt-4 bg-slate-50 min-h-screen animate-fade-in relative font-sans">
      
      {/* 🚀 HEADER ESTILO SOCIALYO */}
      <div className="px-4 flex justify-between items-center mb-5 max-w-md mx-auto">
        <div className="text-left">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">Agenda</h1>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="w-10 h-10 bg-white rounded-full border border-slate-200 shadow-sm text-slate-600 flex items-center justify-center active:scale-90 transition-all hover:bg-slate-50">
             {viewMode === 'list' ? <CalIcon size={18}/> : <List size={18}/>}
           </button>
        </div>
      </div>

      {/* 🚀 PESTAÑAS TIPO PASTILLERO SOCIALYO */}
      <div className="px-4 mb-6 max-w-md mx-auto">
        <div className="bg-white p-1 rounded-full border border-slate-100 flex shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <button onClick={() => setFilterType('mine')} 
            className={`flex-1 py-2.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2
            ${filterType === 'mine' ? 'bg-blue-600 text-white shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}>
            <UserCheck size={14}/> Mis Turnos
          </button>
          <button onClick={() => setFilterType('all')} 
            className={`flex-1 py-2.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2
            ${filterType === 'all' ? 'bg-slate-900 text-white shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}>
            <Globe size={14}/> Toda la agenda
          </button>
        </div>
      </div>

      {/* 🚀 AVISO BORRADORES SUAVIZADO */}
      {['pastor', 'lider'].includes(userRole) && events.some(e => !e.published && isSameMonth(new Date(e.date + 'T00:00:00'), currentDate)) && (
          <div className="mx-4 max-w-md md:mx-auto bg-amber-50 p-5 rounded-[24px] mb-6 flex items-center justify-between border border-amber-200">
            <div className="flex items-center gap-3 text-amber-700 text-left">
              <Megaphone size={20}/>
              <div><p className="text-[13px] font-bold tracking-tight">Borradores</p><p className="text-[10px] font-semibold opacity-80">Listos para lanzar</p></div>
            </div>
            <button onClick={() => setActionConfirm({ type: 'publish', title: '¿Publicar Agenda?', message: 'Se notificará a toda la iglesia.' })} disabled={isPublishing} className="bg-amber-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all">
              {isPublishing ? <Loader2 size={14} className="animate-spin"/> : 'Publicar'}
            </button>
          </div>
      )}

      {/* 🚀 SELECTOR DE MES LIMPIO */}
      <div className="px-4 flex items-center justify-between mb-6 max-w-md mx-auto">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-50 shadow-sm active:scale-90 transition-transform"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-bold text-slate-900 capitalize tracking-tight">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-50 shadow-sm active:scale-90 transition-transform"><ChevronRight size={20} /></button>
      </div>

      <div className="flex-1 max-w-md mx-auto w-full px-4">
        {loading ? <div className="py-24 text-center opacity-40"><Loader2 className="animate-spin mx-auto text-slate-400" size={32}/></div> : (viewMode === 'calendar' ? renderMonthView() : (
          <div className="space-y-6 pb-8">
            {processedEvents.upcoming.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Próximamente</span>
                  <div className="h-[1px] flex-1 bg-blue-100"></div>
                </div>
                {processedEvents.upcoming.map(ev => renderEventCard(ev, false))}
              </div>
            )}
            {processedEvents.past.length > 0 && (
              <div className="space-y-3 mt-6">
                <div className="flex items-center gap-3 px-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Anteriores</span>
                  <div className="h-[1px] flex-1 bg-slate-200"></div>
                </div>
                {processedEvents.past.map(ev => renderEventCard(ev, true))}
              </div>
            )}
            
            {processedEvents.upcoming.length === 0 && processedEvents.past.length === 0 && (
              <div className="text-center py-12 px-4 bg-white rounded-[32px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mx-4">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                   <CalIcon size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-500">No hay actividades para mostrar.</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 🚀 BOTÓN FLOTANTE CREAR */}
      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => { setEditingId(null); setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', published: false }); setIsModalOpen(true); }} className="fixed bottom-24 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center z-40 active:scale-90 transition-all"><Plus size={28} strokeWidth={2.5}/></button>
      )}

      {/* 🚀 MODAL EVENTOS DEL DÍA (CALENDARIO) */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-[600] bg-slate-900/40 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setSelectedDayEvents(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 sm:p-8 shadow-2xl animate-slide-up border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>
            <div className="flex justify-between items-center mb-6 text-left">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight capitalize">{format(selectedDayEvents.date, "EEEE d", { locale: es })}</h3>
                <p className="text-xs font-semibold text-blue-600 capitalize mt-0.5">{format(selectedDayEvents.date, "MMMM", { locale: es })}</p>
              </div>
              <button onClick={() => setSelectedDayEvents(null)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={18}/></button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar pb-6 text-left">
              {selectedDayEvents.events.map(ev => (
                <button key={ev.id} onClick={() => { setSelectedDayEvents(null); navigate(`/calendario/${ev.id}`); }} className="w-full flex items-center justify-between p-4 bg-white rounded-[20px] border border-slate-100 shadow-sm active:scale-95 transition-all hover:border-blue-200">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${OPERATIVE_EVENT_TYPES[ev.type]?.color || 'bg-slate-200'} text-white shadow-sm`}>
                      {(() => { const Icon = OPERATIVE_EVENT_TYPES[ev.type]?.icon || Church; return <Icon size={20}/> })()}
                    </div>
                    <div><p className="font-bold text-slate-900 text-sm tracking-tight truncate">{ev.title}</p><p className="text-[11px] font-semibold text-slate-500 mt-0.5">{ev.time} hs</p></div>
                  </div>
                  <ArrowRight size={18} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL CREAR/EDITAR (BOTTOM SHEET PREMIUM) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative animate-slide-up text-left border border-slate-100">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden shrink-0"></div>
                
                <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none">{editingId ? 'Editar Actividad' : 'Nueva Actividad'}</h2>
                      <p className="text-xs font-semibold text-blue-600 mt-1">Agenda Ministerial</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={18}/></button>
                </div>

                <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 ml-1">Título del Evento</label>
                      <input placeholder="Ej. Culto General..." className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm shadow-sm transition-all" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                          <label className="text-xs font-bold text-slate-500 ml-1">Fecha de Inicio</label>
                          <input type="date" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 shadow-sm" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
                        {newEvent.type === 'ayuno' && (
                          <div className="space-y-1.5 col-span-2 sm:col-span-1 animate-fade-in">
                            <label className="text-xs font-bold text-slate-500 ml-1">Fecha de Fin</label>
                            <input type="date" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 shadow-sm" value={newEvent.endDate} onChange={e => setNewEvent({...newEvent, endDate: e.target.value})} />
                          </div>
                        )}
                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                          <label className="text-xs font-bold text-slate-500 ml-1">Horario</label>
                          <input type="time" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 shadow-sm" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 ml-1">Categoría</label>
                      <div className="grid grid-cols-2 gap-2">
                          {Object.entries(OPERATIVE_EVENT_TYPES).map(([key, config]) => (
                              <button key={key} onClick={() => setNewEvent({...newEvent, type: key})} className={`flex items-center gap-2 p-3 rounded-xl border text-[11px] font-bold transition-all ${newEvent.type === key ? config.color + ' border-transparent text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                <config.icon size={14}/> {config.label}
                              </button>
                          ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm cursor-pointer mt-2" onClick={() => setNewEvent({...newEvent, published: !newEvent.published})}>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${newEvent.published ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                              {newEvent.published ? <CheckCircle size={16} /> : <EyeOff size={16} />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">Publicar al guardar</span>
                              <span className="text-[10px] text-slate-500">Visible para toda la iglesia</span>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${newEvent.published ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${newEvent.published ? 'right-1' : 'left-1'}`}></div>
                        </div>
                    </div>

                    <button onClick={handleSaveEvent} disabled={isUploading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-sm shadow-blue-600/30 mt-4 active:scale-95 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                        {isUploading ? <Loader2 className="animate-spin" size={18}/> : (editingId ? "Guardar Cambios" : "Confirmar Actividad")}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 🚀 MODAL CONFIRMACIÓN REDISEÑADO */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl text-center border border-slate-100 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-500" strokeWidth={2.5}/>
            </div>
            <h4 className="font-bold text-slate-900 text-lg mb-2 leading-tight">{actionConfirm.title}</h4>
            <p className="text-xs text-slate-500 font-medium mb-8 leading-relaxed">{actionConfirm.message}</p>
            <div className="flex flex-col gap-2">
              <button onClick={executeConfirmedAction} className="w-full py-3.5 rounded-xl font-bold text-sm bg-red-600 text-white shadow-sm active:scale-95 transition-all">Confirmar</button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-3.5 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 TOAST SUAVE */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[600] animate-slide-up w-max max-w-[90vw]">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-full shadow-lg border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-900 text-white border-slate-700'}`}>
            {toast.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
            <span className="text-xs font-bold tracking-wide">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}