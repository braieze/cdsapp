import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Calendar as CalIcon, List, Clock, Trash2, X, Calendar } from 'lucide-react'; // Agregamos Calendar icon
import { EVENT_TYPES } from '../utils/eventTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario Nuevo Evento (Ahora con endDate)
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'culto',
    date: '',      // Fecha Inicio
    endDate: '',   // Fecha Fin (Solo para Ayunos)
    time: '19:30',
    description: ''
  });

  // 1. Cargar Eventos
  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);
      setLoading(false);
    });
    return () => unsubscribeEvents();
  }, []);

  // Guardar Evento
  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return alert("Falta título o fecha");
    
    // Si es ayuno usa la fecha fin del form, si no, usa la misma de inicio
    const finalEndDate = newEvent.type === 'ayuno' && newEvent.endDate ? newEvent.endDate : newEvent.date;

    try {
      await addDoc(collection(db, 'events'), {
        ...newEvent,
        endDate: finalEndDate, // Guardamos fecha fin
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

  // --- VISTA LISTA ---
  const renderListView = () => {
    const grouped = events.reduce((acc, event) => {
      const dateObj = new Date(event.date + 'T00:00:00');
      const monthKey = format(dateObj, 'MMMM yyyy', { locale: es }); 
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(event);
      return acc;
    }, {});

    return Object.entries(grouped).map(([month, monthEvents]) => (
      <div key={month} className="mb-6 animate-fade-in">
        <h3 className="text-lg font-black text-slate-800 capitalize mb-3 sticky top-16 bg-slate-50 py-2 z-10">{month}</h3>
        <div className="space-y-3">
          {monthEvents.map(event => {
            const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
            const isAyuno = event.type === 'ayuno';
            
            return (
              <div 
                key={event.id} 
                onClick={() => navigate(`/calendario/${event.id}`)} 
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 hover:shadow-md transition-shadow cursor-pointer relative group"
              >
                {/* Columna Fecha (Diferente color si es ayuno) */}
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
                     <button onClick={(e) => {e.stopPropagation(); handleDeleteEvent(event.id)}} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-base leading-tight">{event.title}</h4>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                    {/* LÓGICA VISUAL: Si es Ayuno mostramos "Hasta tal fecha", si no la Hora */}
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
      </div>
    ));
  };

  const renderMonthView = () => (
    <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
        <CalIcon size={48} className="mx-auto text-slate-200 mb-4"/>
        <p className="text-slate-500 font-medium">La vista mensual estará lista pronto.</p>
        <button onClick={() => setViewMode('list')} className="mt-4 text-brand-600 font-bold text-sm">Volver a la lista</button>
    </div>
  );

  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in">
      <div className="flex justify-between items-end mb-6 sticky top-0 z-20 bg-slate-50/90 backdrop-blur-sm py-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Agenda</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Planificación 2026</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}><List size={20}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg transition-all ${viewMode === 'month' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}><CalIcon size={20}/></button>
        </div>
      </div>

      {loading ? <div className="text-center py-10">Cargando...</div> : (viewMode === 'list' ? renderListView() : renderMonthView())}

      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-4 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"><Plus size={28} /></button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 animate-slide-up relative shadow-2xl max-h-[90vh] overflow-y-auto">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                <h2 className="text-xl font-black text-slate-800 mb-6">Nuevo Evento</h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Título</label>
                        <input type="text" placeholder="Ej: Ayuno de Daniel" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                            value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    </div>

                    {/* Lógica de Fechas Dinámica (Inicio y Fin si es Ayuno) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={newEvent.type === 'ayuno' ? 'col-span-1' : 'col-span-1'}>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                                {newEvent.type === 'ayuno' ? 'Inicio' : 'Fecha'}
                            </label>
                            <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                                value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        </div>
                        
                        {/* Campo EXTRA solo para Ayuno */}
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

                    <button onClick={handleCreateEvent} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2">Crear</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}