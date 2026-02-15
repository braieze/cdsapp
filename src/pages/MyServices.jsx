import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, History, ChevronRight, Loader2, RefreshCcw, Users, ShieldAlert } from 'lucide-react';
import { format, isSameMonth, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MyServices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('me'); // 'me' | 'team'
  
  // Datos
  const [myEvents, setMyEvents] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  
  // Usuario
  const currentUser = auth.currentUser;
  const [userRole, setUserRole] = useState(null); // Guardamos solo el rol para simplificar
  const [stats, setStats] = useState({ monthCount: 0, lastServiceDate: null, nextServiceDays: null });

  // 1. CARGAR USUARIO Y EVENTOS
  useEffect(() => {
    const fetchData = async () => {
        if (!currentUser) return;

        try {
            // A. Cargar Rol del Usuario
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            let role = 'miembro';
            if (userSnap.exists()) {
                role = userSnap.data().role;
                setUserRole(role);
                console.log("Rol detectado:", role); // DEBUG
            }

            // B. Cargar Eventos
            const q = query(collection(db, 'events'), orderBy('date', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // FILTRO 1: MIS SERVICIOS (Personal)
                const myAssignments = eventsData.filter(event => {
                    if (!event.assignments) return false;
                    return Object.values(event.assignments).some(peopleArray => 
                        Array.isArray(peopleArray) && peopleArray.includes(currentUser.displayName)
                    );
                });
                setMyEvents(myAssignments);
                calculateStats(myAssignments, currentUser.displayName);

                // FILTRO 2: MI EQUIPO (Liderazgo)
                // Si es Pastor o Lider, cargamos eventos futuros para monitorear
                if (role === 'pastor' || role === 'lider') {
                    const futureEvents = eventsData.filter(event => isFuture(new Date(event.date + 'T00:00:00')));
                    setTeamEvents(futureEvents);
                }

                setLoading(false);
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Error cargando datos:", error);
            setLoading(false);
        }
    };
    fetchData();
  }, [currentUser]);

  // --- CÁLCULOS ESTADÍSTICAS ---
  const calculateStats = (events, myName) => {
    const now = new Date();
    const activeEvents = events.filter(e => e.confirmations?.[myName] !== 'declined');
    const thisMonth = activeEvents.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), now));
    const pastEvents = activeEvents.filter(e => isPast(new Date(e.date + 'T00:00:00')));
    const lastEvent = pastEvents.length > 0 ? pastEvents[pastEvents.length - 1] : null;
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
        await updateDoc(eventRef, { [`confirmations.${currentUser.displayName}`]: status });
    } catch (error) { alert("Error al actualizar."); }
  };

  const handleUndo = async (eventId) => {
      try {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, { [`confirmations.${currentUser.displayName}`]: null });
    } catch (error) { console.error(error); }
  }

  // Helpers
  const getMyRole = (event) => {
      if (!event.assignments) return 'Servidor';
      const roleKey = Object.keys(event.assignments).find(key => event.assignments[key].includes(currentUser.displayName));
      return roleKey ? roleKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Equipo';
  };

  const getTeamStatus = (event) => {
      let totalAssigned = 0;
      let totalDeclined = 0;
      let totalConfirmed = 0;

      if (!event.assignments) return { total: 0, confirmed: 0, declined: 0 };

      Object.values(event.assignments).flat().forEach(personName => {
          totalAssigned++;
          const status = event.confirmations?.[personName];
          if (status === 'confirmed') totalConfirmed++;
          if (status === 'declined') totalDeclined++;
      });

      return { total: totalAssigned, confirmed: totalConfirmed, declined: totalDeclined };
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600"/></div>;

  const isLeader = userRole === 'pastor' || userRole === 'lider';

  return (
    <div className="pb-24 pt-6 px-4 bg-slate-50 min-h-screen animate-fade-in">
      
      {/* HEADER + TABS */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800 mb-1">Hola, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
        
        {isLeader ? (
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl mt-4 shadow-sm">
                <button 
                    onClick={() => setActiveTab('me')} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'me' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    Mis Turnos
                </button>
                <button 
                    onClick={() => setActiveTab('team')} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'team' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Users size={14}/> Mi Equipo
                </button>
            </div>
        ) : (
            <p className="text-sm text-slate-500">Tus asignaciones ministeriales</p>
        )}
      </div>

      {/* --- PESTAÑA: MIS TURNOS (PERSONAL) --- */}
      {activeTab === 'me' && (
          <div className="animate-fade-in">
              {/* Dashboard Stats */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 text-brand-600"><TrendingUp size={60}/></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Este Mes</span>
                    <div className="flex items-baseline gap-1"><span className="text-4xl font-black text-slate-800">{stats.monthCount}</span><span className="text-xs font-medium text-slate-500">servicios</span></div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 text-purple-600"><Clock size={60}/></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stats.nextServiceDays ? 'Próximo' : 'Último'}</span>
                    <div>
                        {stats.nextServiceDays ? (
                            <><span className="text-4xl font-black text-slate-800">{stats.nextServiceDays}</span><span className="text-xs font-medium text-slate-500"> días faltan</span></>
                        ) : (<span className="text-lg font-bold text-slate-700">{stats.lastServiceDate || '-'}</span>)}
                    </div>
                </div>
              </div>

              {/* Pendientes */}
              {myEvents.filter(e => !isPast(new Date(e.date)) && (!e.confirmations || !e.confirmations[currentUser.displayName])).length > 0 && (
                  <div className="mb-8">
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2"><AlertCircle size={16} className="text-amber-500"/> Requiere tu atención</h2>
                      <div className="space-y-3">
                          {myEvents.filter(e => !isPast(new Date(e.date)) && (!e.confirmations || !e.confirmations[currentUser.displayName])).map(event => (
                              <div key={event.id} className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl opacity-10"></div>
                                  <div className="relative z-10">
                                      <span className="inline-block px-2 py-1 rounded bg-white/10 text-[10px] font-bold uppercase mb-2 border border-white/10">{getMyRole(event)}</span>
                                      <h3 className="text-xl font-bold mb-1">{event.title}</h3>
                                      <div className="flex flex-col gap-1 text-sm text-slate-300 mb-5">
                                          <div className="flex items-center gap-2"><Calendar size={14}/> {format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</div>
                                          <div className="flex items-center gap-2"><Clock size={14}/> {event.time} hs</div>
                                      </div>
                                      <div className="flex gap-3">
                                          <button onClick={() => handleResponse(event.id, 'confirmed')} className="flex-1 bg-brand-500 hover:bg-brand-400 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"><CheckCircle size={16}/> Confirmar</button>
                                          <button onClick={() => handleResponse(event.id, 'declined')} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-white/10"><XCircle size={16}/> No puedo</button>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Confirmados */}
              <div className="mb-6">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Agenda Confirmada</h2>
                  <div className="space-y-3">
                    {myEvents.filter(e => !isPast(new Date(e.date)) && e.confirmations && e.confirmations[currentUser.displayName] === 'confirmed').map(event => (
                        <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-green-50 rounded-xl border border-green-100 text-green-600">
                                <span className="text-[10px] font-bold uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                                <span className="text-lg font-black">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                                <p className="text-xs text-slate-500">{getMyRole(event)}</p>
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-green-600 font-bold"><CheckCircle size={10}/> Confirmado</div>
                            </div>
                            <ChevronRight size={16} className="text-slate-300"/>
                        </div>
                    ))}
                  </div>
              </div>

              {/* Rechazados */}
              {myEvents.filter(e => !isPast(new Date(e.date)) && e.confirmations && e.confirmations[currentUser.displayName] === 'declined').length > 0 && (
                  <div className="mb-6 opacity-75">
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">No puedo asistir</h2>
                      <div className="space-y-2">
                        {myEvents.filter(e => !isPast(new Date(e.date)) && e.confirmations && e.confirmations[currentUser.displayName] === 'declined').map(event => (
                            <div key={event.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3 opacity-60">
                                    <XCircle size={20} className="text-slate-400"/>
                                    <div><h4 className="font-bold text-slate-600 text-xs line-through">{event.title}</h4><p className="text-[10px] text-slate-400">{format(new Date(event.date + 'T00:00:00'), 'dd/MM', { locale: es })}</p></div>
                                </div>
                                <button onClick={() => handleUndo(event.id)} className="text-[10px] font-bold text-brand-600 flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200"><RefreshCcw size={10}/> Reconsiderar</button>
                            </div>
                        ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* --- PESTAÑA: MI EQUIPO (LIDERAZGO) --- */}
      {activeTab === 'team' && (
          <div className="animate-slide-up">
              <div className="bg-slate-900 text-white p-4 rounded-2xl mb-6 shadow-lg">
                  <h3 className="font-bold text-lg mb-1">Panel de Liderazgo</h3>
                  <p className="text-sm text-slate-300">Supervisa la asistencia de tu equipo.</p>
              </div>

              <div className="space-y-4">
                  {teamEvents.length === 0 ? <p className="text-center text-slate-400 text-sm">No hay eventos futuros programados.</p> : teamEvents.map(event => {
                      const status = getTeamStatus(event);
                      if (!status || status.total === 0) return null; 

                      const hasIssues = status.declined > 0;
                      const progress = status.total > 0 ? Math.round(((status.confirmed + status.declined) / status.total) * 100) : 0;

                      return (
                          <div key={event.id} onClick={() => navigate(`/calendario/${event.id}`)} className={`bg-white p-4 rounded-2xl border shadow-sm cursor-pointer transition-all hover:shadow-md ${hasIssues ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
                              <div className="flex justify-between items-start mb-3">
                                  <div>
                                      <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                                      <p className="text-xs text-slate-500 capitalize">{format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</p>
                                  </div>
                                  {hasIssues && <div className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"><ShieldAlert size={12}/> {status.declined} Baja(s)</div>}
                              </div>

                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                                  <div className={`h-full rounded-full transition-all duration-500 ${hasIssues ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: `${progress}%` }}></div>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                  <span>{status.confirmed} Confirmados</span>
                                  <span>{status.total} Total Equipo</span>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* ✅ BOTÓN DE HISTORIAL FUNCIONAL */}
      <button 
        onClick={() => navigate('/historial')} 
        className="w-full py-4 text-center text-xs font-bold text-slate-400 hover:text-brand-600 flex items-center justify-center gap-1"
      >
          <History size={14}/> Ver historial completo
      </button>
    </div>
  );
}