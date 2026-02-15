import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, History, ChevronRight, Loader2, RefreshCcw } from 'lucide-react';
import { format, isSameMonth, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MyServices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myEvents, setMyEvents] = useState([]);
  const [stats, setStats] = useState({ monthCount: 0, lastServiceDate: null, nextServiceDays: null });
  
  const currentUser = auth.currentUser;
  const userName = currentUser?.displayName; 

  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 1. FILTRAR: Solo eventos donde estoy asignado
      const myAssignments = allEvents.filter(event => {
        if (!event.assignments) return false;
        return Object.values(event.assignments).some(peopleArray => 
          Array.isArray(peopleArray) && peopleArray.includes(userName)
        );
      });

      setMyEvents(myAssignments);
      calculateStats(myAssignments, userName);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, userName]);

  // --- CÁLCULOS DEL DASHBOARD (CORREGIDO) ---
  const calculateStats = (events, myName) => {
    const now = new Date();
    
    // 1. FILTRO PREVIO: Excluir los rechazados para las estadísticas
    const activeEvents = events.filter(e => {
        const myStatus = e.confirmations ? e.confirmations[myName] : null;
        return myStatus !== 'declined'; // Si rechacé, no cuenta para la estadística
    });

    // 2. Servicios del Mes Actual (Solo activos)
    const thisMonth = activeEvents.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), now));
    
    // 3. Último Servicio (Confirmado o Asistido en el pasado)
    const pastEvents = activeEvents.filter(e => isPast(new Date(e.date + 'T00:00:00')));
    const lastEvent = pastEvents.length > 0 ? pastEvents[pastEvents.length - 1] : null;

    // 4. Próximo Servicio
    const futureEvents = activeEvents.filter(e => isFuture(new Date(e.date + 'T00:00:00')));
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

  const handleResponse = async (eventId, status) => {
    if(!window.confirm(status === 'declined' ? "¿Seguro que no puedes asistir? Esto notificará a tu líder." : "¿Confirmar asistencia?")) return;

    try {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
            [`confirmations.${userName}`]: status
        });
    } catch (error) {
        console.error("Error:", error);
        alert("Error al actualizar.");
    }
  };

  const handleUndo = async (eventId) => {
      // Permitir arrepentirse y volver a estado pendiente
      try {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
            [`confirmations.${userName}`]: null // Borramos el estado
        });
    } catch (error) { console.error(error); }
  }

  // Separar pendientes, confirmados y rechazados
  const futureAssignments = myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')));
  
  const pending = futureAssignments.filter(e => !e.confirmations || !e.confirmations[userName]);
  const confirmed = futureAssignments.filter(e => e.confirmations && e.confirmations[userName] === 'confirmed');
  // ✅ AHORA FILTRAMOS LOS RECHAZADOS PARA MOSTRARLOS
  const declined = futureAssignments.filter(e => e.confirmations && e.confirmations[userName] === 'declined');

  const getMyRole = (event) => {
      if (!event.assignments) return 'Servidor';
      const roleKey = Object.keys(event.assignments).find(key => event.assignments[key].includes(userName));
      return roleKey ? roleKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Equipo';
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600"/></div>;

  return (
    <div className="pb-24 pt-6 px-4 bg-slate-50 min-h-screen animate-fade-in">
      
      {/* 1. DASHBOARD */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-800 mb-1">Hola, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500 mb-6">Tus asignaciones ministeriales</p>

        <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 text-brand-600"><TrendingUp size={60}/></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Este Mes</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-800">{stats.monthCount}</span>
                    <span className="text-xs font-medium text-slate-500">servicios</span>
                </div>
            </div>

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
                        <span className="text-lg font-bold text-slate-700">{stats.lastServiceDate || '-'}</span>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* 2. PENDIENTES */}
      {pending.length > 0 && (
          <div className="mb-8 animate-slide-up">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-500"/> Requiere tu atención
              </h2>
              <div className="space-y-3">
                  {pending.map(event => (
                      <div key={event.id} className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                          <div className="relative z-10">
                              <span className="inline-block px-2 py-1 rounded bg-white/10 text-[10px] font-bold uppercase mb-2 border border-white/10">
                                  {getMyRole(event)}
                              </span>
                              <h3 className="text-xl font-bold mb-1">{event.title}</h3>
                              <div className="flex flex-col gap-1 text-sm text-slate-300 mb-5">
                                  <div className="flex items-center gap-2"><Calendar size={14}/> {format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</div>
                                  <div className="flex items-center gap-2"><Clock size={14}/> {event.time} hs</div>
                              </div>
                              <div className="flex gap-3">
                                  <button onClick={() => handleResponse(event.id, 'confirmed')} className="flex-1 bg-brand-500 hover:bg-brand-400 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg">
                                      <CheckCircle size={16}/> Confirmar
                                  </button>
                                  <button onClick={() => handleResponse(event.id, 'declined')} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-white/10">
                                      <XCircle size={16}/> No puedo
                                  </button>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* 3. CONFIRMADOS */}
      <div className="mb-6">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Tu Agenda Confirmada</h2>
          {confirmed.length === 0 && pending.length === 0 && <div className="text-center py-6 bg-white rounded-2xl border border-slate-100"><p className="text-slate-400 text-sm">Nada por aquí.</p></div>}
          
          <div className="space-y-3">
            {confirmed.map(event => (
                <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-green-50 rounded-xl border border-green-100 text-green-600">
                        <span className="text-[10px] font-bold uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                        <span className="text-lg font-black">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                        <p className="text-xs text-slate-500">{getMyRole(event)} • {event.time} hs</p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-green-600 font-bold"><CheckCircle size={10}/> Asistencia Confirmada</div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300"/>
                </div>
            ))}
          </div>
      </div>

      {/* 4. RECHAZADOS (NUEVA SECCIÓN) */}
      {declined.length > 0 && (
          <div className="mb-6 opacity-75">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Servicios Declinados / No puedo</h2>
              <div className="space-y-2">
                {declined.map(event => (
                    <div key={event.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3 opacity-60">
                            <XCircle size={20} className="text-slate-400"/>
                            <div>
                                <h4 className="font-bold text-slate-600 text-xs line-through">{event.title}</h4>
                                <p className="text-[10px] text-slate-400">{format(new Date(event.date + 'T00:00:00'), 'dd/MM', { locale: es })}</p>
                            </div>
                        </div>
                        {/* Botón para arrepentirse */}
                        <button onClick={() => handleUndo(event.id)} className="text-[10px] font-bold text-brand-600 flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200">
                            <RefreshCcw size={10}/> Reconsiderar
                        </button>
                    </div>
                ))}
              </div>
          </div>
      )}

      <button className="w-full py-4 text-center text-xs font-bold text-slate-400 hover:text-brand-600 flex items-center justify-center gap-1">
          <History size={14}/> Ver historial completo
      </button>
    </div>
  );
}