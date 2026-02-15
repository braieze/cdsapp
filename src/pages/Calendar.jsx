import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc } from 'firebase/firestore'; // Importamos deleteDoc
import { Plus, Calendar as CalIcon, List, Clock, MapPin, X, Trash2 } from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Instalar date-fns si no lo tienes: npm install date-fns

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'month'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado para el usuario actual (para permisos)
  const [currentUserRole, setCurrentUserRole] = useState(null);

  // Formulario Nuevo Evento
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'culto',
    date: '', // YYYY-MM-DD
    time: '19:30',
    description: ''
  });

  // 1. Cargar Eventos y Rol
  useEffect(() => {
    // A. Eventos
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);
      setLoading(false);
    });

    // B. Rol del Usuario (leemos de localStorage o esperamos auth, simplificado aquí)
    // En una app real, deberías usar un Context o leer de tu colección 'users'
    // Por ahora asumimos que si puedes ver el botón flotante en Directorio, puedes aquí.
    // (Implementación rápida: leeremos role de la base de datos si es necesario, 
    // pero por ahora usaremos una validación simple en el render).

    return () => unsubscribeEvents();
  }, []);

  // Función Guardar Evento
  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return alert("Falta título o fecha");
    
    try {
      await addDoc(collection(db, 'events'), {
        ...newEvent,
        createdAt: Timestamp.now(),
        participants: [], // Aquí irán los asignados luego
        createdBy: auth.currentUser.uid
      });
      setIsModalOpen(false);
      setNewEvent({ title: '', type: 'culto', date: '', time: '19:30', description: '' });
      alert("Evento creado exitosamente");
    } catch (error) {
      console.error(error);
      alert("Error al crear evento");
    }
  };

  // Función Borrar Evento (Solo para limpiar pruebas)
  const handleDeleteEvent = async (id) => {
    if(confirm("¿Borrar evento?")) {
        await deleteDoc(doc(db, 'events', id));
    }
  }

  // --- VISTA LISTA: Agrupada por Meses ---
  const renderListView = () => {
    // Agrupar eventos por "Mes Año"
    const grouped = events.reduce((acc, event) => {
      const dateObj = new Date(event.date + 'T00:00:00');
      const monthKey = format(dateObj, 'MMMM yyyy', { locale: es }); // Ej: "febrero 2024"
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
            const Icon = TypeConfig.icon;
            
            return (
              <div key={event.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 hover:shadow-md transition-shadow cursor-pointer relative group">
                {/* Columna Fecha */}
                <div className="flex flex-col items-center justify-center bg-slate-50 px-3 rounded-xl border border-slate-200 min-w-[60px]">
                  <span className="text-xs font-bold text-slate-400 uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                  <span className="text-xl font-black text-slate-800">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                </div>

                {/* Info Evento */}
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase mb-1 inline-block ${TypeConfig.color}`}>
                        {TypeConfig.label}
                    </span>
                    {/* Botón borrar oculto (aparece al hover) - Solo para testear rápido */}
                     <button onClick={(e) => {e.stopPropagation(); handleDeleteEvent(event.id)}} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-base leading-tight">{event.title}</h4>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1">
                        <Clock size={14} className="text-slate-400"/> {event.time} hs
                    </div>
                    {/* Aquí pondremos "Faltan 3 servidores" más adelante */}
                  </div>
                </div>

                {/* Indicador visual tipo */}
                <div className={`absolute right-0 top-4 bottom-4 w-1 rounded-l-full ${TypeConfig.dot}`}></div>
              </div>
            )
          })}
        </div>
      </div>
    ));
  };

  // --- VISTA CALENDARIO (Simple) ---
  const renderMonthView = () => {
    // Un calendario real es complejo de hacer a mano. 
    // Por ahora, mostraremos una lista visualmente simplificada o "Próximamente"
    // para no sobrecargar este paso. 
    // (Opcional: Instalar 'react-calendar' después si te gusta la vista de grilla)
    return (
        <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
            <CalIcon size={48} className="mx-auto text-slate-200 mb-4"/>
            <p className="text-slate-500 font-medium">La vista de grilla mensual estará lista en la próxima actualización.</p>
            <button onClick={() => setViewMode('list')} className="mt-4 text-brand-600 font-bold text-sm">Volver a la lista</button>
        </div>
    );
  };

  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in">
      
      {/* Cabecera y Switch */}
      <div className="flex justify-between items-end mb-6 sticky top-0 z-20 bg-slate-50/90 backdrop-blur-sm py-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Agenda</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Planificación 2026</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                <List size={20} strokeWidth={2.5}/>
            </button>
            <button 
                onClick={() => setViewMode('month')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'month' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                <CalIcon size={20} strokeWidth={2.5}/>
            </button>
        </div>
      </div>

      {/* Contenido */}
      {loading ? <div className="text-center py-10">Cargando agenda...</div> : (
          viewMode === 'list' ? renderListView() : renderMonthView()
      )}

      {/* Botón Crear (Solo pastores, por ahora lo dejamos abierto para que pruebes) */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg shadow-slate-900/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
      >
        <Plus size={28} />
      </button>

      {/* MODAL CREAR EVENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 animate-slide-up relative shadow-2xl max-h-[90vh] overflow-y-auto">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                <h2 className="text-xl font-black text-slate-800 mb-6">Nuevo Evento</h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Título</label>
                        <input type="text" placeholder="Ej: Culto de Santa Cena" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                            value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Fecha</label>
                            <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                                value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Hora</label>
                            <input type="time" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                                value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Tipo de Evento</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                            {Object.entries(EVENT_TYPES).map(([key, config]) => (
                                <button 
                                    key={key}
                                    onClick={() => setNewEvent({...newEvent, type: key})}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold transition-all text-left ${
                                        newEvent.type === key 
                                        ? config.color + ' ring-2 ring-offset-1 ring-slate-200' 
                                        : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    <config.icon size={16}/> {config.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                         <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Descripción (Opcional)</label>
                         <textarea placeholder="Detalles generales..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm min-h-[80px]"
                            value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                         />
                    </div>

                    <button onClick={handleCreateEvent} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-200 hover:bg-black active:scale-95 transition-all mt-2">
                        Crear en Agenda
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}