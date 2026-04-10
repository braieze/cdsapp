import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  deleteDoc, doc, getDoc, serverTimestamp,
  writeBatch, updateDoc
} from 'firebase/firestore';
import {
  Plus, Calendar as CalIcon, List, Clock, Trash2, X,
  ChevronLeft, ChevronRight, Loader2, Megaphone,
  Send, EyeOff, CheckCircle, XCircle,
  AlertCircle, ChevronRight as ArrowRight, Sparkles, Heart, UserCheck, Globe, 
  Edit3, Music, Users, Eraser, Wrench, Flame, Church, Lock, Save
} from 'lucide-react';
import { 
  format, addMonths, subMonths, isSameMonth, startOfMonth, 
  endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, 
  isSameDay, isWithinInterval, isAfter, subDays, startOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';

// ✅ 1. CONFIGURACIÓN DE IDENTIDAD VISUAL (Punto 1)
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
  
  // --- ESTADOS DE VISTA Y FILTROS ---
  const [viewMode, setViewMode] = useState('list'); // list, month
  const [filterType, setFilterType] = useState('mine'); // mine, all
  const [timeFilter, setTimeFilter] = useState('upcoming'); // upcoming, past
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [actionConfirm, setActionConfirm] = useState(null);

  const currentUser = auth.currentUser;
  const CLOUD_NAME = "djmkggzjp";
  const UPLOAD_PRESET = "ml_default";

  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '',
    published: false, isCena: false
  });

  // --- EFECTOS: CARGA DE DATOS ---
  useEffect(() => {
    const fetchUserRole = async () => {
      if (currentUser) {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
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

  // ✅ NOTIFICACIÓN UNIVERSAL (REST API - Punto 1)
  const sendOneSignalNotification = async (notifTitle, notifBody, path) => {
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
          included_segments: ["Total Subscriptions"],
          headings: { en: notifTitle, es: notifTitle },
          contents: { en: notifBody, es: notifBody },
          data: { route: path }, 
          priority: 10
        })
      });
    } catch (error) { console.error(error); }
  };

  // ✅ FILTRADO PRÓXIMOS/PASADOS + MIS SERVICIOS (Punto 2 y 3)
  const filteredEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const isPastor = ['pastor', 'lider'].includes(userRole);

    return events.filter(ev => {
      const eventDate = new Date(ev.date + 'T00:00:00');
      const isMyTask = ev.assignments && Object.values(ev.assignments).flat().includes(currentUser?.displayName);
      
      // Privacidad Borradores
      if (!ev.published && !isPastor && !isMyTask) return false;
      
      // Lógica Próximos/Pasados
      const isPast = eventDate < today;
      if (timeFilter === 'upcoming' && isPast) return false;
      if (timeFilter === 'past' && !isPast) return false;

      // Filtro Mis Turnos
      if (filterType === 'mine' && !isMyTask) return false;
      
      // Si estamos en modo mes, solo los del mes actual
      if (viewMode === 'month') return isSameMonth(eventDate, currentDate);
      
      return true;
    });
  }, [events, filterType, timeFilter, viewMode, currentDate, userRole, currentUser]);

  // ✅ ACCIÓN: CREAR O EDITAR (Punto Extra)
  const handleSaveEvent = async () => {
    if (!newEvent.title || !newEvent.date) return toast.error("Falta título o fecha");
    setIsUploading(true);
    let uploadedImageUrl = newEvent.image || null;

    try {
        if (imageFile) {
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressed = await imageCompression(imageFile, options);
            const formData = new FormData();
            formData.append("file", compressed); formData.append("upload_preset", UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
            const data = await res.json();
            uploadedImageUrl = data.secure_url;
        }

        const eventData = {
          ...newEvent,
          image: uploadedImageUrl,
          updatedAt: serverTimestamp(),
          endDate: newEvent.endDate || newEvent.date
        };

        if (editingEventId) {
          await updateDoc(doc(db, 'events', editingEventId), eventData);
          toast.success("Evento actualizado");
        } else {
          const docRef = await addDoc(collection(db, 'events'), {
            ...eventData,
            createdAt: serverTimestamp(),
            assignments: {}
          });
          if (newEvent.published) {
            await sendOneSignalNotification("Nueva actividad", newEvent.title, `/calendario/${docRef.id}`);
          }
          toast.success("Evento planificado");
        }

        setIsModalOpen(false);
        setEditingEventId(null);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '', published: false });
        setImageFile(null);
    } catch (error) { toast.error("Error al guardar"); }
    finally { setIsUploading(false); }
  };

  const executeConfirmedAction = async () => {
    if (!actionConfirm) return;
    const { type, id } = actionConfirm;
    setActionConfirm(null);
    if (type === 'delete') {
      await deleteDoc(doc(db, 'events', id));
      toast.info("Evento eliminado");
    }
  };

  // ✅ VISTA DE LISTA (Punto 1 y 2)
  const renderListView = () => {
    if (filteredEvents.length === 0) return (
      <div className="py-24 text-center opacity-30 flex flex-col items-center">
        <CalIcon size={48} className="mb-4 text-slate-300"/>
        <p className="text-[10px] font-black uppercase tracking-widest text-center">Sin actividades para mostrar</p>
      </div>
    );

    return (
      <div className="space-y-4 px-4 pb-24">
          {filteredEvents.map(event => {
            const config = OPERATIVE_EVENT_TYPES[event.type] || OPERATIVE_EVENT_TYPES.culto;
            const isMyTask = event.assignments && Object.values(event.assignments).flat().includes(currentUser?.displayName);
            const isEnsayo = event.type === 'ensayo';
            const canSeeDetails = !isEnsayo || (['pastor', 'lider'].includes(userRole) || (dbUser?.area?.toLowerCase() === 'alabanza'));

            return (
              <div key={event.id} 
                   onClick={() => canSeeDetails ? navigate(`/calendario/${event.id}`) : toast.error("Acceso privado a Alabanza")}
                   className={`bg-white p-5 rounded-[35px] border-2 flex gap-5 transition-all active:scale-95 cursor-pointer relative ${isMyTask ? 'border-brand-500 shadow-lg shadow-brand-100/20' : 'border-slate-50'}`}>
                
                {isMyTask && <div className="absolute -top-2.5 right-8 bg-brand-600 text-white px-3 py-1 rounded-full text-[8px] font-black tracking-widest shadow-lg border-2 border-white">MI TURNO</div>}

                <div className={`flex flex-col items-center justify-center px-4 rounded-3xl border-2 min-w-[75px] ${config.light} ${config.text} border-current opacity-80`}>
                  <span className="text-[10px] font-black uppercase opacity-60">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className="text-2xl font-black">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2">
                       <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${config.color} text-white`}>{config.label}</span>
                       {isEnsayo && <span className="bg-slate-900 text-white p-1 rounded-md"><Lock size={8}/></span>}
                    </div>
                    {['pastor', 'lider'].includes(userRole) && (
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingEventId(event.id); setNewEvent(event); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-brand-600"><Edit3 size={16}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setActionConfirm({ type: 'delete', id: event.id, title: '¿Eliminar?', message: 'Se borrará permanentemente.' }); }} className="p-2 text-slate-200 hover:text-rose-500"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </div>
                  <h4 className="font-black text-slate-800 text-base leading-tight mt-2 uppercase tracking-tighter truncate">{event.title}</h4>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock size={12}/> {event.time}hs</span>
                    {event.isCena && <span className="text-[9px] font-black text-rose-500 uppercase tracking-tighter flex items-center gap-1">🍷 Cena del Señor</span>}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    );
  };

  // ✅ VISTA DE CALENDARIO (Mes)
  const renderMonthView = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="bg-white rounded-[45px] border-2 border-slate-50 shadow-xl p-7 animate-fade-in mx-4 mb-20 text-left">
            <div className="grid grid-cols-7 mb-4 border-b border-slate-50 pb-4">
                {weekDays.map(day => <div key={day} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonthDay = isSameMonth(day, currentDate);
                    const dayEvents = events.filter(e => {
                        const eventStart = new Date(e.date + 'T00:00:00');
                        const eventEnd = new Date((e.endDate || e.date) + 'T23:59:59');
                        return isWithinInterval(day, { start: eventStart, end: eventEnd });
                    });
                    const hasEvents = dayEvents.length > 0;
                    return (
                        <div key={day.toString()} 
                            onClick={() => hasEvents && setSelectedDayEvents({ date: day, events: dayEvents })}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all active:scale-90
                                ${!isCurrentMonthDay ? 'opacity-20' : 'text-slate-700'}
                                ${isToday ? 'bg-slate-900 text-white shadow-xl scale-110 z-10' : 'hover:bg-slate-50'}
                                ${hasEvents && isCurrentMonthDay && !isToday ? 'bg-brand-50 font-black text-brand-700' : ''}`}>
                            <span className="text-xs font-black">{format(day, 'd')}</span>
                            {hasEvents && !isToday && <div className="w-1 h-1 bg-brand-500 rounded-full mt-1"></div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="pb-36 pt-4 bg-slate-50 min-h-screen animate-fade-in font-outfit relative">
      
      {/* HEADER DINÁMICO */}
      <div className="px-6 flex justify-between items-center mb-6 sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md py-4">
        <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Agenda</h1>
            <div className="h-1.5 w-10 bg-brand-500 rounded-full mt-2"></div>
        </div>
        <div className="flex bg-white p-1.5 rounded-[22px] border-2 border-slate-50 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300'}`}><List size={20}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'month' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300'}`}><CalIcon size={20}/></button>
        </div>
      </div>

      {/* ✅ FILTROS PRO (PRÓXIMOS/PASADOS - Punto 3) */}
      <div className="px-6 mb-8 flex flex-col gap-4">
          <div className="flex gap-2">
            <button onClick={() => setFilterType('mine')} className={`flex-1 py-4 rounded-3xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 ${filterType === 'mine' ? 'bg-brand-600 border-brand-600 text-white shadow-xl scale-105' : 'bg-white text-slate-400 border-white'}`}><UserCheck size={16}/> Mis Turnos</button>
            <button onClick={() => setFilterType('all')} className={`flex-1 py-4 rounded-3xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 ${filterType === 'all' ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 border-white'}`}><Globe size={16}/> Agenda Global</button>
          </div>
          
          {viewMode === 'list' && (
            <div className="flex bg-slate-200/40 p-1.5 rounded-2xl border border-slate-100">
              <button onClick={() => setTimeFilter('upcoming')} className={`flex-1 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] transition-all ${timeFilter === 'upcoming' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Próximos</button>
              <button onClick={() => setTimeFilter('past')} className={`flex-1 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] transition-all ${timeFilter === 'past' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Pasados</button>
            </div>
          )}
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1">
        {loading ? <div className="py-24 text-center opacity-20"><Loader2 className="animate-spin mx-auto" size={48}/></div> : (viewMode === 'month' ? renderMonthView() : renderListView())}
      </div>

      {/* SELECTOR DE MES (Solo en calendario) */}
      {viewMode === 'month' && (
        <div className="fixed bottom-28 left-6 right-24 bg-white p-4 rounded-[30px] border-2 border-slate-50 shadow-2xl flex items-center justify-between z-40">
           <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 text-slate-400"><ChevronLeft size={20}/></button>
           <span className="text-[10px] font-black uppercase tracking-tighter">{format(currentDate, 'MMMM yyyy', { locale: es })}</span>
           <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 text-slate-400"><ChevronRight size={20}/></button>
        </div>
      )}

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => { setEditingEventId(null); setNewEvent({ title: '', type: 'culto', date: '', time: '19:30', published: false }); setIsModalOpen(true); }} className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center z-40 border-4 border-white active:scale-90 transition-all"><Plus size={32}/></button>
      )}

      {/* MODAL CREAR/EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white w-full max-w-sm rounded-[45px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative animate-slide-up text-left">
                <div className="flex justify-between items-center mb-8 border-b pb-5 border-slate-50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingEventId ? 'Editar' : 'Planificar'}</h2>
                        <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Actividad Ministerial</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400"><X size={24}/></button>
                </div>
                
                <div className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Nombre del Evento</label>
                      <input placeholder="Título..." className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] font-black text-slate-800 outline-none focus:border-brand-500 uppercase text-sm" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Fecha</label>
                          <input type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase outline-none" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
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

                    {newEvent.type === 'culto' && (
                      <button onClick={() => setNewEvent({...newEvent, isCena: !newEvent.isCena})} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${newEvent.isCena ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <span className="text-[9px] font-black uppercase">🍷 Cena del Señor</span>
                        {newEvent.isCena ? <CheckCircle size={18}/> : <div className="w-4 h-4 rounded-full border-2 border-slate-200"></div>}
                      </button>
                    )}

                    <button onClick={() => setNewEvent({...newEvent, published: !newEvent.published})} className={`w-full p-5 rounded-[28px] border-2 flex items-center justify-between transition-all ${newEvent.published ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">¿Notificar a la Iglesia?</span>
                        {newEvent.published ? <CheckCircle size={24}/> : <EyeOff size={24}/>}
                    </button>

                    <button onClick={handleSaveEvent} disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-6 rounded-[35px] shadow-2xl mt-4 active:scale-95 transition-all disabled:opacity-50 uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-3">
                        {isUploading ? <Loader2 className="animate-spin" size={24}/> : (editingEventId ? "Guardar Cambios" : "Lanzar Actividad")}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN BORRADO */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[45px] p-10 shadow-2xl text-center">
            <AlertCircle size={44} className="mx-auto text-rose-500 mb-6" strokeWidth={3}/>
            <h4 className="font-black text-slate-900 text-xl mb-3 uppercase tracking-tighter">¿Eliminar actividad?</h4>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-10 leading-relaxed">Esta acción borrará todas las asignaciones y confirmaciones de este evento.</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeConfirmedAction} className="w-full py-5 rounded-2xl font-black text-xs uppercase bg-rose-600 text-white shadow-xl">Confirmar eliminación</button>
              <button onClick={() => setActionConfirm(null)} className="w-full py-5 rounded-2xl font-black text-xs uppercase text-slate-400 bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLES DEL DÍA (CALENDARIO) */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setSelectedDayEvents(null)}>
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
                    <div className={`p-4 rounded-2xl ${OPERATIVE_EVENT_TYPES[ev.type]?.color || 'bg-slate-200'} text-white`}>
                      {(() => { const Icon = OPERATIVE_EVENT_TYPES[ev.type]?.icon || Church; return <Icon size={24}/> })()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{ev.title}</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">{ev.time} hs</p>
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}