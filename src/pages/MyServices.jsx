// MyServices.jsx - Versión con Detalle de Asistencia Pro
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { 
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, 
  History, ChevronRight, Loader2, RefreshCcw, Users, ShieldAlert, 
  MessageSquare, HelpCircle, User, X
} from 'lucide-react';
import { format, isSameMonth, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MyServices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('me');
  const [myEvents, setMyEvents] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // ✅ Para obtener fotos y roles
  const [alerts, setAlerts] = useState({ me: 0, team: 0 });
  const [userRole, setUserRole] = useState(null); 
  const [stats, setStats] = useState({ monthCount: 0, lastServiceDate: null, nextServiceDays: null });
  
  // Estado para el Modal de Asistencia
  const [showAttendanceEvent, setShowAttendanceEvent] = useState(null);

  const currentUser = auth.currentUser;

  // ✅ LIMPIAR GLOBITOS
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

  // ✅ CARGA DE DATOS COMPLETA
  useEffect(() => {
    const fetchData = async () => {
        if (!currentUser) return;
        try {
            const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
            const usersCol = await getDocs(collection(db, 'users'));
            setAllUsers(usersCol.docs.map(d => ({ id: d.id, ...d.data() })));

            let role = 'miembro';
            let lastSeenDate = null;
            if (userSnap.exists()) {
                role = userSnap.data().role;
                lastSeenDate = userSnap.data().lastViewedTeam?.toDate() || new Date(0); 
                setUserRole(role);
            }

            const q = query(collection(db, 'events'), orderBy('date', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const myAssignments = eventsData.filter(event => {
                    if (!event.assignments) return false;
                    return Object.values(event.assignments).some(p => Array.isArray(p) && p.includes(currentUser.displayName));
                });
                setMyEvents(myAssignments);
                calculateStats(myAssignments, currentUser.displayName);

                let futureEvents = [];
                if (role === 'pastor' || role === 'lider') {
                    futureEvents = eventsData.filter(event => isFuture(new Date(event.date + 'T00:00:00')));
                    setTeamEvents(futureEvents);
                }

                const myPendingCount = myAssignments.filter(e => !isPast(new Date(e.date + 'T00:00:00')) && (!e.confirmations || !e.confirmations[currentUser.displayName])).length;
                let teamIssuesCount = 0;
                if (role === 'pastor' || role === 'lider' && activeTab !== 'team') {
                    teamIssuesCount = futureEvents.reduce((total, event) => {
                        const hasDeclined = event.confirmations && Object.values(event.confirmations).includes('declined');
                        const isNew = hasDeclined && (!event.updatedAt || event.updatedAt.toDate() > lastSeenDate);
                        return isNew ? total + 1 : total;
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
    const active = events.filter(e => e.confirmations?.[myName] !== 'declined');
    const thisMonth = active.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), now));
    const past = active.filter(e => isPast(new Date(e.date + 'T00:00:00')));
    const last = past.length > 0 ? past[past.length - 1] : null;
    const future = active.filter(e => isFuture(new Date(e.date + 'T00:00:00')));
    const next = future.length > 0 ? future[0] : null;
    let days = null;
    if (next) days = Math.ceil(Math.abs(new Date(next.date + 'T00:00:00') - now) / (1000 * 60 * 60 * 24));
    setStats({ monthCount: thisMonth.length, lastServiceDate: last ? format(new Date(last.date + 'T00:00:00'), 'd MMM', { locale: es }) : '-', nextServiceDays: days });
  };

  const handleResponse = async (eventId, status) => {
    if(!window.confirm(status === 'declined' ? "¿Seguro que no puedes asistir?" : "¿Confirmar asistencia?")) return;
    try {
        await updateDoc(doc(db, 'events', eventId), { [`confirmations.${currentUser.displayName}`]: status, updatedAt: serverTimestamp() });
    } catch (error) { alert("Error"); }
  };

  const handleUndo = async (eventId) => {
    try { await updateDoc(doc(db, 'events', eventId), { [`confirmations.${currentUser.displayName}`]: null }); } catch (e) {}
  };

  const getMyRole = (event) => {
      const roleKey = Object.keys(event.assignments || {}).find(key => event.assignments[key].includes(currentUser.displayName));
      return roleKey ? roleKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Equipo';
  };

  const getTeamStatus = (event) => {
      let total = 0, declined = 0, confirmed = 0;
      if (!event.assignments) return { total, confirmed, declined };
      Object.values(event.assignments).flat().forEach(name => {
          total++;
          if (event.confirmations?.[name] === 'confirmed') confirmed++;
          if (event.confirmations?.[name] === 'declined') declined++;
      });
      return { total, confirmed, declined };
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  return (
    <div className="pb-24 pt-6 px-4 bg-slate-50 min-h-screen animate-fade-in relative">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800 mb-1">Hola, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
        {(userRole === 'pastor' || userRole === 'lider') && (
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl mt-4 shadow-sm relative">
                <button onClick={() => setActiveTab('me')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all relative ${activeTab === 'me' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500'}`}>Mis Turnos {alerts.me > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full text-[9px] border-2 border-white shadow-sm animate-pulse">{alerts.me}</span>}</button>
                <button onClick={() => setActiveTab('team')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 relative ${activeTab === 'team' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500'}`}><Users size={14}/> Mi Equipo {alerts.team > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white flex items-center justify-center rounded-full text-[9px] border-2 border-white shadow-sm">{alerts.team}</span>}</button>
            </div>
        )}
      </div>

      {/* --- TAB: MIS TURNOS --- */}
      {activeTab === 'me' && (
          <div className="animate-fade-in">
              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden"><div className="absolute top-0 right-0 p-3 opacity-10 text-brand-600"><TrendingUp size={60}/></div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Este Mes</span><div className="flex items-baseline gap-1"><span className="text-4xl font-black text-slate-800">{stats.monthCount}</span><span className="text-xs font-medium text-slate-500">servicios</span></div></div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden"><div className="absolute top-0 right-0 p-3 opacity-10 text-purple-600"><Clock size={60}/></div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stats.nextServiceDays ? 'Próximo' : 'Último'}</span><div>{stats.nextServiceDays ? <><span className="text-4xl font-black text-slate-800">{stats.nextServiceDays}</span><span className="text-xs font-medium text-slate-500"> días</span></> : <span className="text-lg font-bold text-slate-700">{stats.lastServiceDate || '-'}</span>}</div></div>
              </div>

              {/* Pendientes */}
              {myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')) && (!e.confirmations || !e.confirmations[currentUser.displayName])).map(event => (
                  <div key={event.id} className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
                      <div className="relative z-10">
                          <span className="inline-block px-2 py-1 rounded bg-white/10 text-[10px] font-black uppercase mb-3 border border-white/10">{getMyRole(event)}</span>
                          <h3 className="text-2xl font-black mb-1">{event.title}</h3>
                          <div className="flex flex-col gap-1 text-sm text-slate-300 mb-6 font-bold">
                              <div className="flex items-center gap-2"><Calendar size={14} className="text-brand-400"/> {format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</div>
                              <div className="flex items-center gap-2"><Clock size={14} className="text-brand-400"/> {event.time} hs</div>
                          </div>
                          <div className="flex gap-3">
                              <button onClick={() => handleResponse(event.id, 'confirmed')} className="flex-1 bg-brand-500 hover:bg-brand-400 text-white py-3 rounded-2xl text-xs font-black uppercase shadow-lg">Confirmar ✓</button>
                              <button onClick={() => handleResponse(event.id, 'declined')} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-2xl text-xs font-black uppercase border border-white/10">No puedo</button>
                          </div>
                      </div>
                  </div>
              ))}

              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Agenda Confirmada</h2>
              <div className="space-y-4">
                {myEvents.filter(e => !isPast(new Date(e.date + 'T00:00:00')) && e.confirmations && e.confirmations[currentUser.displayName] === 'confirmed').map(event => (
                    <div key={event.id} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-green-50 rounded-xl text-green-600 border border-green-100">
                                <span className="text-[10px] font-bold uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                                <span className="text-lg font-black">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                                <p className="text-xs text-slate-500 font-medium">{getMyRole(event)}</p>
                            </div>
                        </div>
                        {/* ✅ BOTÓN ESPECÍFICO IR AL CHAT */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                            <div className="flex items-center gap-1 text-[10px] text-green-600 font-black uppercase"><CheckCircle size={12}/> Confirmado</div>
                            <button 
                                onClick={() => navigate(`/servicios/${event.id}`)}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-brand-200 active:scale-95 transition-all"
                            >
                                <MessageSquare size={14}/> IR AL CHAT
                            </button>
                        </div>
                    </div>
                ))}
              </div>
          </div>
      )}

      {/* --- TAB: MI EQUIPO --- */}
      {activeTab === 'team' && (
          <div className="animate-slide-up">
              <div className="bg-slate-900 text-white p-6 rounded-[35px] mb-8 shadow-xl">
                  <h3 className="font-black text-xl mb-1">Panel de Liderazgo</h3>
                  <p className="text-sm text-slate-400 font-medium tracking-tight">Supervisión técnica de asistencia.</p>
              </div>

              <div className="space-y-5">
                  {teamEvents.map(event => {
                      const status = getTeamStatus(event);
                      if (status.total === 0) return null; 
                      const hasIssues = status.declined > 0;
                      const progress = Math.round(((status.confirmed + status.declined) / status.total) * 100);

                      return (
                          <div key={event.id} className={`bg-white p-6 rounded-[35px] border shadow-sm transition-all ${hasIssues ? 'border-red-100 bg-red-50/20' : 'border-slate-50'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <h4 className="font-black text-slate-800 text-base">{event.title}</h4>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</p>
                                  </div>
                                  {hasIssues && <div className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 uppercase tracking-tighter"><ShieldAlert size={12}/> {status.declined} Baja(s)</div>}
                              </div>

                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
                                  <div className={`h-full rounded-full transition-all duration-700 ${hasIssues ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: `${progress}%` }}></div>
                              </div>
                              
                              {/* ✅ NUEVO BOTÓN: VER ASISTENCIA DETALLADA */}
                              <div className="flex gap-2 mt-4">
                                <button 
                                  onClick={() => setShowAttendanceEvent(event)}
                                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 border border-slate-100 transition-all active:scale-95"
                                >
                                  <Users size={14}/> DETALLE ASISTENCIA
                                </button>
                                <button onClick={() => navigate(`/servicios/${event.id}`)} className="p-3 bg-brand-50 text-brand-600 rounded-2xl hover:bg-brand-100 transition-colors"><MessageSquare size={18}/></button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* ✅ MODAL DE ASISTENCIA DETALLADA (PUNTO 1) */}
      {showAttendanceEvent && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setShowAttendanceEvent(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-[40px] sm:rounded-[40px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-800 text-lg leading-tight">{showAttendanceEvent.title}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(showAttendanceEvent.date + 'T00:00:00'), 'd MMMM yyyy', {locale: es})}</p>
              </div>
              <button onClick={() => setShowAttendanceEvent(null)} className="p-2 bg-white rounded-full shadow-sm text-slate-400"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {Object.entries(showAttendanceEvent.assignments).map(([roleKey, people]) => {
                return (Array.isArray(people) ? people : [people]).map((name, i) => {
                  const userData = allUsers.find(u => u.displayName === name);
                  const status = showAttendanceEvent.confirmations?.[name];
                  
                  return (
                    <div key={`${roleKey}-${i}`} className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-3xl border border-slate-50 hover:border-slate-100 transition-colors">
                      <div className="w-12 h-12 rounded-2xl bg-white overflow-hidden shadow-sm flex items-center justify-center border-2 border-white">
                        {userData?.photoURL ? (
                          <img src={userData.photoURL} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 font-black"><User size={20}/></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-800 text-sm truncate">{name}</h4>
                        <p className="text-[10px] font-bold text-brand-600 uppercase tracking-tighter truncate">{roleKey.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {status === 'confirmed' ? (
                          <div className="bg-green-100 text-green-600 p-2 rounded-xl shadow-inner"><CheckCircle size={18} /></div>
                        ) : status === 'declined' ? (
                          <div className="bg-red-100 text-red-600 p-2 rounded-xl shadow-inner"><XCircle size={18} /></div>
                        ) : (
                          <div className="bg-slate-100 text-slate-300 p-2 rounded-xl shadow-inner animate-pulse"><HelpCircle size={18} /></div>
                        )}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
            
            <div className="p-6 bg-slate-50/30 border-t border-slate-50 text-center">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{getTeamStatus(showAttendanceEvent).confirmed} Confirmados de {getTeamStatus(showAttendanceEvent).total}</p>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => navigate('/historial')} className="w-full py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-brand-600 flex items-center justify-center gap-2"><History size={14}/> Ver historial completo</button>
    </div>
  );
}