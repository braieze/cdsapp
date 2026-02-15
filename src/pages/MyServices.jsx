import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle, TrendingUp, History, ChevronRight, Loader2 } from 'lucide-react';
import { format, isSameMonth, isPast, isFuture, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MyServices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myEvents, setMyEvents] = useState([]);
  const [stats, setStats] = useState({ monthCount: 0, lastServiceDate: null, nextServiceDays: null });
  
  const currentUser = auth.currentUser;
  const userName = currentUser?.displayName; // Usamos el nombre porque así guardas las asignaciones

  useEffect(() => {
    if (!currentUser) return;

    // Traemos los eventos (idealmente filtraríamos por fecha en backend, pero por ahora traemos y filtramos en cliente por la estructura de assignments)
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 1. FILTRAR: Solo eventos donde yo estoy asignado
      const myAssignments = allEvents.filter(event => {
        if (!event.assignments) return false;
        // Buscamos si mi nombre está en algún array de roles
        return Object.values(event.assignments).some(peopleArray => 
          Array.isArray(peopleArray) && peopleArray.includes(userName)
        );
      });

      setMyEvents(myAssignments);
      calculateStats(myAssignments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, userName]);

  // --- CÁLCULOS DEL DASHBOARD ---
  const calculateStats = (events) => {
    const now = new Date();
    
    // 1. Servicios del Mes Actual
    const thisMonth = events.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), now));
    
    // 2. Último Servicio (Pasado más reciente)
    const pastEvents = events.filter(e => isPast(new Date(e.date + 'T00:00:00')));
    const lastEvent = pastEvents.length > 0 ? pastEvents[pastEvents.length - 1] : null;

    // 3. Próximo Servicio (Futuro más cercano)
    const futureEvents = events.filter(e => isFuture(new Date(e.date + 'T00:00:00')));
    const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;
    
    let daysToNext = null;
    if (nextEvent) {
        const diffTime = Math.abs(new Date(nextEvent.date) - now);
        daysToNext = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    }

    setStats({
        monthCount: thisMonth.length,
        lastServiceDate: lastEvent ? format(new Date(lastEvent.date + 'T00:00:00'), 'd MMM', { locale: es }) : '-',
        nextServiceDays: daysToNext
    });
  };

  // --- MANEJAR CONFIRMACIÓN ---
  const handleResponse = async (eventId, status) => {
    try {
        const eventRef = doc(db, 'events', eventId);
        // Guardamos la respuesta en un objeto map: { "Nombre Persona": "confirmed" | "declined" }
        // Usamos notación de punto para actualizar solo mi clave dentro del mapa 'confirmations'
        await updateDoc(eventRef, {
            [`confirmations.${userName}`]: status
        });
    } catch (error) {
        console.error("Error al responder:", error);
        alert("No se pudo actualizar tu asistencia.");
    }
  };

  // Separar pendientes y confirmados (SOLO FUTUROS)
  const futureAssignments = myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')));
  
  const pending = futureAssignments.filter(e => !e.confirmations || !e.confirmations[userName]);
  const confirmed = futureAssignments.filter(e => e.confirmations && e.confirmations[userName] === 'confirmed');
  const declined = futureAssignments.filter(e => e.confirmations && e.confirmations[userName] === 'declined');

  // Función auxiliar para encontrar MI ROL en el evento
  const getMyRole = (event) => {
      if (!event.assignments) return 'Servidor';
      // Buscamos la key donde está mi nombre
      const roleKey = Object.keys(event.assignments).find(key => 
          event.assignments[key].includes(userName)
      );
      // Formateamos bonito (ej: 'guitarra_electrica' -> 'Guitarra Eléctrica')
      return roleKey ? roleKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Equipo';
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600"/></div>;

  return (
    <div className="pb-24 pt-6 px-4 bg-slate-50 min-h-screen animate-fade-in">
      
      {/* 1. HEADER & DASHBOARD (Estilo Humand) */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-800 mb-1">Hola, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500 mb-6">Tus asignaciones ministeriales</p>

        <div className="grid grid-cols-2 gap-3">
            {/* Card 1: Servicios del Mes */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 text-brand-600"><TrendingUp size={60}/></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Este Mes</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-800">{stats.monthCount}</span>
                    <span className="text-xs font-medium text-slate-500">servicios</span>
                </div>
            </div>

            {/* Card 2: Próximo o Último */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 text-purple-600"><Clock size={60}/></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {stats.nextServiceDays ? 'Próximo' : 'Último'}
                </span>
                <div>
                    {stats.nextServiceDays ? (
                        <>
                            <span className="text-4xl font-black text-slate-800">{stats.nextServiceDays}</span>
                            <span className="text-xs font-medium text-slate-500"> días faltan</span>
                        </>
                    ) : (
                        <span className="text-lg font-bold text-slate-700">{stats.lastServiceDate || 'N/A'}</span>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* 2. CONFIRMACIÓN PENDIENTE (Prioridad Alta) */}
      {pending.length > 0 && (
          <div className="mb-8 animate-slide-up">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-500"/> Requiere tu atención
              </h2>
              <div className="space-y-3">
                  {pending.map(event => (
                      <div key={event.id} className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                          {/* Fondo decorativo */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                          
                          <div className="relative z-10">
                              <span className="inline-block px-2 py-1 rounded bg-white/10 text-[10px] font-bold uppercase mb-2 border border-white/10">
                                  {getMyRole(event)}
                              </span>
                              <h3 className="text-xl font-bold mb-1">{event.title}</h3>
                              
                              <div className="flex flex-col gap-1 text-sm text-slate-300 mb-5">
                                  <div className="flex items-center gap-2">
                                      <Calendar size={14}/> {format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <Clock size={14}/> {event.time} hs
                                  </div>
                              </div>

                              <div className="flex gap-3">
                                  <button 
                                    onClick={() => handleResponse(event.id, 'confirmed')}
                                    className="flex-1 bg-brand-500 hover:bg-brand-400 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-900/50"
                                  >
                                      <CheckCircle size={16}/> Confirmar
                                  </button>
                                  <button 
                                    onClick={() => handleResponse(event.id, 'declined')}
                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-white/10"
                                  >
                                      <XCircle size={16}/> No puedo
                                  </button>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* 3. PRÓXIMOS SERVICIOS CONFIRMADOS */}
      <div className="mb-6">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Tu Agenda Confirmada</h2>
          
          {confirmed.length === 0 && pending.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 border-dashed">
                  <p className="text-slate-400 text-sm">No tienes servicios asignados próximamente.</p>
              </div>
          ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                  {confirmed.map(event => (
                      <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                          {/* Fecha Box */}
                          <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-xl border border-slate-100 group-hover:border-brand-200 group-hover:bg-brand-50 transition-colors">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                              <span className="text-lg font-black text-slate-800">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                          </div>
                          
                          <div className="flex-1">
                              <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                              <p className="text-xs text-brand-600 font-bold mt-0.5">{getMyRole(event)}</p>
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-medium">
                                  <CheckCircle size={10} className="text-green-500"/> Confirmado
                              </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-300"/>
                      </div>
                  ))}
                  {confirmed.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-400">
                          No tienes servicios confirmados (revisa los pendientes).
                      </div>
                  )}
              </div>
          )}
      </div>

      {/* 4. Link al Historial (Futuro) */}
      <button className="w-full py-3 text-center text-xs font-bold text-slate-400 hover:text-brand-600 flex items-center justify-center gap-1 transition-colors">
          <History size={14}/> Ver historial completo
      </button>

    </div>
  );
}