import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { Plus, Calendar as CalIcon, List, Clock, Trash2, X, Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, addMonths, subMonths, isSameMonth, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado para controlar el mes actual que se ve
  const [currentDate, setCurrentDate] = useState(new Date());

  // Estado para el rol del usuario (Seguridad)
  const [userRole, setUserRole] = useState(null);

  // Formulario Nuevo Evento
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'culto',
    date: '',      
    endDate: '',   
    time: '19:30',
    description: ''
  });

  // 1. Cargar Rol del Usuario y Eventos
  useEffect(() => {
    // A. Obtener Rol
    const fetchUserRole = async () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role); // 'pastor', 'lider', 'miembro'
        }
      }
    };
    fetchUserRole();

    // B. Cargar Eventos
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);
      setLoading(false);
    });
    return () => unsubscribeEvents();
  }, []);

  // Helpers de Navegación de Mes
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const isCurrentMonth = isSameMonth(new Date(), currentDate);

  // Filtrar eventos solo del mes seleccionado
  const filteredEvents = events.filter(event => {
    // Convertir string 'YYYY-MM-DD' a Date con hora local para evitar problemas de zona horaria
    const eventDate = new Date(event.date + 'T00:00:00'); 
    return isSameMonth(eventDate, currentDate);
  });

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return alert("Falta título o fecha");
    const finalEndDate = newEvent.type === 'ayuno' && newEvent.endDate ? newEvent.endDate : newEvent.date;

    try {
      await addDoc(collection(db, 'events'), {
        ...newEvent,
        endDate: finalEndDate,
        createdAt: Timestamp.now(),
        assignments: {}, 
        createdBy: auth.currentUser?.uid
      });
      setIsModalOpen(false);
      setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '' });
      alert("Evento creado exitosamente");
    } catch (error) {
      console.error(error);
      alert("Error al crear evento");
    }
  };

  const handleDeleteEvent = async (id) => {
    if(window.confirm("¿Borrar evento?")) await deleteDoc(doc(db, 'events', id));
  }

  // --- VISTA LISTA (Filtrada por mes) ---
  const renderListView = () => {
    if (filteredEvents.length === 0) {
      return (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Calendar size={48} className="mx-auto text-slate-200 mb-4"/>
          <p className="text-slate-500 font-medium">No hay eventos en este mes.</p>
          {['pastor', 'lider'].includes(userRole) && (
            <button onClick={() => setIsModalOpen(true)} className="mt-4 text-brand-600 font-bold text-sm hover:underline">
              + Crear el primero
            </button>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-4 animate-fade-in">
          {filteredEvents.map(event => {
            const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            const isAyuno = event.type === 'ayuno';
            
            return (
              <div 
                key={event.id} 
                onClick={() => navigate(`/calendario/${event.id}`)} 
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 hover:shadow-md transition-shadow cursor-pointer relative group"
              >
                {/* Columna Fecha */}
                <div className={`flex flex-col items-center justify-center px-3 rounded-xl border min-w-[60px] ${isAyuno ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-xs font-bold uppercase ${isAyuno ? 'text-rose-400' : 'text-slate-400'}`}>
                    {format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}
                  </span>
                  <span className={`text-xl font-black ${isAyuno ? 'text-rose-600' : 'text-slate-800'}`}>
                    {format(new Date(event.date + 'T00:00:00'), 'dd')}
                  </span>
                </div>

                {/* Info Evento */}
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase mb-1 inline-block ${TypeConfig.color}`}>
                        {TypeConfig.label}
                    </span>
                    
                    {/* Botón borrar (Solo Admin) */}
                    {['pastor', 'lider'].includes(userRole) && (
                       <button onClick={(e) => {e.stopPropagation(); handleDeleteEvent(event.id)}} className="text-slate-300 hover:text-red-500 p-1 rounded-full hover:bg-slate-50 transition-colors"><Trash2 size={16}/></button>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-base leading-tight">{event.title}</h4>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                    {isAyuno && event.endDate && event.endDate !== event.date ? (
                        <div className="flex items-center gap-1 text-rose-600 font-bold">
                            <Calendar size={14}/> Hasta el {format(new Date(event.endDate + 'T00:00:00'), 'dd MMM', { locale: es })}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <Clock size={14} className="text-slate-400"/> {event.time} hs
                        </div>
                    )}
                  </div>
                </div>
                <div className={`absolute right-0 top-4 bottom-4 w-1 rounded-l-full ${TypeConfig.dot}`}></div>
              </div>
            )
          })}
      </div>
    );
  };

  const renderMonthView = () => (
    <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
        <CalIcon size={48} className="mx-auto text-slate-200 mb-4"/>
        <p className="text-slate-500 font-medium">Vista mensual próximamente.</p>
        <button onClick={() => setViewMode('list')} className="mt-4 text-brand-600 font-bold text-sm">Volver a lista</button>
    </div>
  );

  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in relative">
      
      {/* HEADER FIJO */}
      <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2 border-b border-slate-200/50">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Agenda</h1>
        </div>
        
        {/* Switch Vista */}
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg transition-all ${viewMode === 'month' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}><CalIcon size={18}/></button>
        </div>
      </div>

      {/* NAVEGADOR DE MESES */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
         <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-brand-600 transition-colors">
            <ChevronLeft size={24} />
         </button>
         
         <div className="text-center">
             <h2 className="text-lg font-black text-slate-800 capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
             </h2>
             {isCurrentMonth && <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Mes Actual</span>}
         </div>

         <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-brand-600 transition-colors">
            <ChevronRight size={24} />
         </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32}/></div>
      ) : (
        viewMode === 'list' ? renderListView() : renderMonthView()
      )}

      {/* Botón Crear (SOLO SI ES PASTOR O LIDER) */}
      {['pastor', 'lider'].includes(userRole) && (
        <button 
            onClick={() => setIsModalOpen(true)} 
            className="fixed bottom-24 right-4 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg shadow-slate-900/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
        >
            <Plus size={28} />
        </button>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 animate-slide-up relative shadow-2xl max-h-[90vh] overflow-y-auto">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                <h2 className="text-xl font-black text-slate-800 mb-6">Nuevo Evento</h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Título</label>
                        <input type="text" placeholder="Ej: Culto de Santa Cena" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                            value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className={newEvent.type === 'ayuno' ? 'col-span-1' : 'col-span-1'}>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                                {newEvent.type === 'ayuno' ? 'Inicio' : 'Fecha'}
                            </label>
                            <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                                value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
                        
                        {newEvent.type === 'ayuno' ? (
                             <div className="col-span-1">
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Fin</label>
                                <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                                    value={newEvent.endDate} onChange={e => setNewEvent({...newEvent, endDate: e.target.value})} />
                             </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Hora</label>
                                <input type="time" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                                    value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Tipo</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                            {Object.entries(EVENT_TYPES).map(([key, config]) => (
                                <button key={key} onClick={() => setNewEvent({...newEvent, type: key})}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold text-left ${newEvent.type === key ? config.color + ' ring-2 ring-slate-200' : 'bg-white border-slate-100 text-slate-500'}`}>
                                    <config.icon size={16}/> {config.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                         <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Descripción</label>
                         <textarea placeholder="Detalles..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm min-h-[80px]"
                            value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} />
                    </div>

                    <button onClick={handleCreateEvent} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2">Crear en Agenda</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}