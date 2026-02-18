// MyServices.jsx mejorado con Asistencia Detallada y Acceso al Chat
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, History, ChevronRight, Loader2, RefreshCcw, Users, ShieldAlert, MessageSquare, HelpCircle } from 'lucide-react';
import { format, isSameMonth, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MyServices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('me');
  const [myEvents, setMyEvents] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  const [alerts, setAlerts] = useState({ me: 0, team: 0 });
  const [userRole, setUserRole] = useState(null); 
  const [stats, setStats] = useState({ monthCount: 0, lastServiceDate: null, nextServiceDays: null });

  const currentUser = auth.currentUser;

  // ✅ EFECTO 1: LIMPIAR GLOBITOS AL ENTRAR A "MI EQUIPO"
  useEffect(() => {
    const markAsSeen = async () => {
      if (activeTab === 'team' && currentUser && (userRole === 'pastor' || userRole === 'lider')) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, { lastViewedTeam: serverTimestamp() });
          setAlerts(prev => ({ ...prev, team: 0 })); 
        } catch (e) { console.error(e); }
      }
    };
    markAsSeen();
  }, [activeTab, userRole, currentUser]);

  useEffect(() => {
    const fetchData = async () => {
        if (!currentUser) return;
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            let role = 'miembro';
            let lastSeenDate = null;

            if (userSnap.exists()) {
                const userData = userSnap.data();
                role = userData.role;
                lastSeenDate = userData.lastViewedTeam?.toDate() || new Date(0); 
                setUserRole(role);
            }

            const q = query(collection(db, 'events'), orderBy('date', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const myAssignments = eventsData.filter(event => {
                    if (!event.assignments) return false;
                    return Object.values(event.assignments).some(peopleArray => 
                        Array.isArray(peopleArray) && peopleArray.includes(currentUser.displayName)
                    );
                });
                setMyEvents(myAssignments);
                calculateStats(myAssignments, currentUser.displayName);

                let futureEvents = [];
                if (role === 'pastor' || role === 'lider') {
                    futureEvents = eventsData.filter(event => isFuture(new Date(event.date + 'T00:00:00')));
                    setTeamEvents(futureEvents);
                }

                const myPendingCount = myAssignments.filter(e => 
                    !isPast(new Date(e.date + 'T00:00:00')) && 
                    (!e.confirmations || !e.confirmations[currentUser.displayName])
                ).length;

                let teamIssuesCount = 0;
                if (role === 'pastor' || role === 'lider' && activeTab !== 'team') {
                    teamIssuesCount = futureEvents.reduce((total, event) => {
                        const hasDeclined = event.confirmations && Object.values(event.confirmations).includes('declined');
                        const isNewIssue = hasDeclined && (!event.updatedAt || event.updatedAt.toDate() > lastSeenDate);
                        return isNewIssue ? total + 1 : total;
                    }, 0);
                }

                setAlerts({ me: myPendingCount, team: teamIssuesCount });
                setLoading(false);
            });
            return () => unsubscribe();
        } catch (error) { setLoading(false); }
    };
    fetchData();
  }, [currentUser, activeTab]);

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
        const diffTime = Math.abs(new Date(nextEvent.date + 'T00:00:00') - now);
        daysToNext = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    }
    setStats({
        monthCount: thisMonth.length,
        lastServiceDate: lastEvent ? format(new Date(lastEvent.date + 'T00:00:00'), 'd MMM', { locale: es }) : '-',
        nextServiceDays: daysToNext
    });
  };

  const handleResponse = async (eventId, status) => {
    if(!window.confirm(status === 'declined' ? "¿Seguro que no puedes asistir?" : "¿Confirmar asistencia?")) return;
    try {
        await updateDoc(doc(db, 'events', eventId), { 
          [`confirmations.${currentUser.displayName}`]: status,
          updatedAt: serverTimestamp() 
        });
    } catch (error) { alert("Error al actualizar."); }
  };

  const handleUndo = async (eventId) => {
    try { await updateDoc(doc(db, 'events', eventId), { [`confirmations.${currentUser.displayName}`]: null });
    } catch (error) { console.error(error); }
  }

  const getMyRole = (event) => {
      if (!event.assignments) return 'Servidor';
      const roleKey = Object.keys(event.assignments).find(key => event.assignments[key].includes(currentUser.displayName));
      return roleKey ? roleKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Equipo';
  };

  const getTeamStatus = (event) => {
      let totalAssigned = 0, totalDeclined = 0, totalConfirmed = 0;
      if (!event.assignments) return { total: 0, confirmed: 0, declined: 0 };
      Object.values(event.assignments).flat().forEach(personName => {
          totalAssigned++;
          const status = event.confirmations?.[personName];
          if (status === 'confirmed') totalConfirmed++;
          if (status === 'declined') totalDeclined++;
      });
      return { total: totalAssigned, confirmed: totalConfirmed, declined: totalDeclined };
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  return (
    <div className="pb-24 pt-6 px-4 bg-slate-50 min-h-screen animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800 mb-1">Hola, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
        {(userRole === 'pastor' || userRole === 'lider') && (
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl mt-4 shadow-sm relative">
                <button onClick={() => setActiveTab('me')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all relative ${activeTab === 'me' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500'}`}>
                    Mis Turnos {alerts.me > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full text-[9px] border-2 border-white">{alerts.me}</span>}
                </button>
                <button onClick={() => setActiveTab('team')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 relative ${activeTab === 'team' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500'}`}>
                    <Users size={14}/> Mi Equipo {alerts.team > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white flex items-center justify-center rounded-full text-[9px] border-2 border-white">{alerts.team}</span>}
                </button>
            </div>
        )}
      </div>

      {activeTab === 'me' && (
          <div className="animate-fade-in">
              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden"><div className="absolute top-0 right-0 p-3 opacity-10 text-brand-600"><TrendingUp size={60}/></div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Este Mes</span><div className="flex items-baseline gap-1"><span className="text-4xl font-black text-slate-800">{stats.monthCount}</span><span className="text-xs font-medium text-slate-500">servicios</span></div></div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden"><div className="absolute top-0 right-0 p-3 opacity-10 text-purple-600"><Clock size={60}/></div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stats.nextServiceDays ? 'Próximo' : 'Último'}</span><div>{stats.nextServiceDays ? <><span className="text-4xl font-black text-slate-800">{stats.nextServiceDays}</span><span className="text-xs font-medium text-slate-500"> días</span></> : <span className="text-lg font-bold text-slate-700">{stats.lastServiceDate || '-'}</span>}</div></div>
              </div>

              {/* Pendientes de Respuesta */}
              {myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')) && (!e.confirmations || !e.confirmations[currentUser.displayName])).length > 0 && (
                  <div className="mb-8">
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2"><AlertCircle size={16} className="text-amber-500"/> Requiere atención</h2>
                      <div className="space-y-3">
                          {myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')) && (!e.confirmations || !e.confirmations[currentUser.displayName])).map(event => (
                              <div key={event.id} className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                                  <div className="relative z-10">
                                      <span className="inline-block px-2 py-1 rounded bg-white/10 text-[10px] font-bold uppercase mb-2 border border-white/10">{getMyRole(event)}</span>
                                      <h3 className="text-xl font-bold mb-1">{event.title}</h3>
                                      <div className="flex flex-col gap-1 text-sm text-slate-300 mb-5">
                                          <div className="flex items-center gap-2"><Calendar size={14}/> {format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</div>
                                          <div className="flex items-center gap-2"><Clock size={14}/> {event.time} hs</div>
                                      </div>
                                      <div className="flex gap-3">
                                          <button onClick={() => handleResponse(event.id, 'confirmed')} className="flex-1 bg-brand-500 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"><CheckCircle size={16}/> Confirmar</button>
                                          <button onClick={() => handleResponse(event.id, 'declined')} className="flex-1 bg-white/10 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-white/10"><XCircle size={16}/> No puedo</button>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Agenda Confirmada + Botón Ir al Chat */}
              <div className="mb-6">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Agenda Confirmada</h2>
                  <div className="space-y-3">
                    {myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')) && e.confirmations && e.confirmations[currentUser.displayName] === 'confirmed').map(event => (
                        <div key={event.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-green-50 rounded-xl border border-green-100 text-green-600">
                                    <span className="text-[10px] font-bold uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                                    <span className="text-lg font-black">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                                    <p className="text-xs text-slate-500">{getMyRole(event)}</p>
                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-green-600 font-bold"><CheckCircle size={10}/> Confirmado</div>
                                </div>
                            </div>
                            {/* ✅ BOTÓN IR AL CHAT */}
                            <button 
                                onClick={() => navigate(`/servicios/${event.id}`)}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-2.5 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                            >
                                <MessageSquare size={14}/> IR AL CHAT DEL SERVICIO
                            </button>
                        </div>
                    ))}
                  </div>
              </div>

              {/* Rechazados */}
              {myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')) && e.confirmations && e.confirmations[currentUser.displayName] === 'declined').length > 0 && (
                  <div className="mb-6 opacity-75">
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">No podré asistir</h2>
                      <div className="space-y-2">
                        {myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')) && e.confirmations && e.confirmations[currentUser.displayName] === 'declined').map(event => (
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

      {activeTab === 'team' && (
          <div className="animate-slide-up">
              <div className="bg-slate-900 text-white p-4 rounded-2xl mb-6 shadow-lg">
                  <h3 className="font-bold text-lg mb-1">Panel de Liderazgo</h3>
                  <p className="text-sm text-slate-300">Supervisión de asistencia del equipo técnico.</p>
              </div>

              <div className="space-y-4">
                  {teamEvents.map(event => {
                      const status = getTeamStatus(event);
                      if (status.total === 0) return null; 
                      const hasIssues = status.declined > 0;
                      const progress = Math.round(((status.confirmed + status.declined) / status.total) * 100);

                      return (
                          <div key={event.id} className={`bg-white p-5 rounded-[32px] border shadow-sm transition-all ${hasIssues ? 'border-red-100 bg-red-50/20' : 'border-slate-100'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</p>
                                  </div>
                                  <button onClick={() => navigate(`/servicios/${event.id}`)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-brand-50 hover:text-brand-600 transition-colors"><MessageSquare size={16}/></button>
                              </div>

                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
                                  <div className={`h-full rounded-full transition-all duration-500 ${hasIssues ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: `${progress}%` }}></div>
                              </div>

                              {/* ✅ LISTA DE ASISTENCIA DETALLADA PARA LÍDERES */}
                              <div className="mt-4 pt-4 border-t border-slate-50">
                                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-widest">Asistencia Detallada</p>
                                  <div className="flex flex-wrap gap-2">
                                      {Object.values(event.assignments).flat().map((name, i) => {
                                          const userStatus = event.confirmations?.[name];
                                          return (
                                              <div key={i} className="flex items-center gap-1.5 bg-white border border-slate-100 px-2 py-1.5 rounded-lg shadow-sm">
                                                  {userStatus === 'confirmed' ? <CheckCircle size={12} className="text-green-500"/> : 
                                                   userStatus === 'declined' ? <XCircle size={12} className="text-red-500"/> : 
                                                   <HelpCircle size={12} className="text-slate-300 animate-pulse"/>}
                                                  <span className="text-[10px] font-bold text-slate-600">{name.split(' ')[0]}</span>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}
      <button onClick={() => navigate('/historial')} className="w-full py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-brand-600 flex items-center justify-center gap-2"><History size={14}/> Ver historial completo</button>
    </div>
  );
}