import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, updateDoc, 
  getDoc, serverTimestamp, getDocs
} from 'firebase/firestore';
import { 
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, 
  History, Loader2, Users, ShieldAlert, MessageSquare, HelpCircle, X, BellRing
} from 'lucide-react';
import { format, isSameMonth, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ONESIGNAL_CONFIG } from '../oneSignalConfig';

// ============================================================================
// 1. COMPONENTE PRINCIPAL (Contenedor de Lógica y Estado)
// ============================================================================
export default function MyServices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('me');
  
  const [myEvents, setMyEvents] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  const [allUsers, setAllUsers] = useState([]); 
  const [alerts, setAlerts] = useState({ me: 0, team: 0 });
  const [userRole, setUserRole] = useState(null); 
  const [stats, setStats] = useState({ monthCount: 0, lastServiceDate: null, nextServiceDays: null });
  const [unreadCounts, setUnreadCounts] = useState({}); 
  
  const [showAttendanceEvent, setShowAttendanceEvent] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); 
  const [loadingAction, setLoadingAction] = useState(false);

  const currentUser = auth.currentUser;

  // Utilidad centralizada para enviar Pushes
  const sendOneSignalPush = async (targetUIDs, title, body, route) => {
    const KEY = ONESIGNAL_CONFIG.REST_API_KEY;
    const APP_ID = ONESIGNAL_CONFIG.APP_ID;
    if (!KEY || targetUIDs.length === 0) return;

    try {
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${KEY}` },
        body: JSON.stringify({
          app_id: APP_ID,
          include_external_user_ids: targetUIDs,
          headings: { en: title, es: title },
          contents: { en: body, es: body },
          data: { route: route },
          priority: 10,
          android_accent_color: "FF0000",
          android_visibility: 1
        })
      });
    } catch (e) { console.error("Error en Push:", e); }
  };

  // Escuchar mensajes no leídos
  useEffect(() => {
    if (!currentUser || myEvents.length === 0) return;
    const unsubscribes = myEvents.map(event => {
      const notesRef = collection(db, `events/${event.id}/notes`);
      return onSnapshot(notesRef, (snapshot) => {
        const unread = snapshot.docs.filter(d => !d.data().readBy?.includes(currentUser.uid)).length;
        setUnreadCounts(prev => ({ ...prev, [event.id]: unread }));
      });
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [myEvents, currentUser]);

  // Marcar panel pastoral como visto
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

  // LÓGICA PRINCIPAL DE EXTRACCIÓN DE DATOS
  useEffect(() => {
    const fetchData = async () => {
        if (!currentUser) return;
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            const usersCol = await getDocs(collection(db, 'users'));
            setAllUsers(usersCol.docs.map(d => ({ id: d.id, ...d.data() })));

            let role = 'miembro';
            let lastSeenDate = new Date(0);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                role = userData.role;
                lastSeenDate = userData.lastViewedTeam?.toDate() || new Date(0); 
                setUserRole(role);
            }

            const q = query(collection(db, 'events'), orderBy('date', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // ✅ FIX BUG DE CONFIRMACIÓN: Usamos startOfDay de date-fns consistentemente
                const today = startOfDay(new Date());

                const myAssignments = eventsData.filter(event => {
                    if (!event.assignments) return false;
                    const eventDate = startOfDay(new Date(event.date + 'T00:00:00'));
                    const belongs = Object.values(event.assignments).some(p => Array.isArray(p) && p.includes(currentUser.displayName));
                    return belongs && eventDate >= today;
                });

                setMyEvents(myAssignments);
                calculateStats(myAssignments, currentUser.displayName, today);

                let futureEvents = [];
                if (role === 'pastor' || role === 'lider') {
                    futureEvents = eventsData.filter(event => {
                      const eventDate = startOfDay(new Date(event.date + 'T00:00:00'));
                      return eventDate >= today;
                    });
                    setTeamEvents(futureEvents);
                }

                // ✅ FIX: Cálculo exacto de alertas. Si NO hay registro de mi nombre en confirmations, o es false/null, es una alerta.
                const myPendingCount = myAssignments.filter(e => {
                  const myStatus = e.confirmations?.[currentUser.displayName];
                  return !myStatus; // Será true si es undefined, null, o false (no confirmó ni declinó)
                }).length;
                
                const totalUnreadMessages = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

                let teamIssuesCount = 0;
                if ((role === 'pastor' || role === 'lider') && activeTab !== 'team') {
                    teamIssuesCount = futureEvents.filter(event => event.updatedAt && event.updatedAt.toDate() > lastSeenDate).length;
                }
                
                setAlerts({ me: myPendingCount + totalUnreadMessages, team: teamIssuesCount });
                setLoading(false);
            });
            return () => unsubscribe();
        } catch (error) { setLoading(false); }
    };
    fetchData();
  }, [currentUser, activeTab, unreadCounts]);

  const calculateStats = (events, myName, today) => {
    const active = events.filter(e => e.confirmations?.[myName] !== 'declined');
    const thisMonth = active.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), today));
    const next = active.length > 0 ? active[0] : null;
    let days = null;
    if (next) {
      const diff = Math.ceil((new Date(next.date + 'T00:00:00') - startOfDay(today)) / (1000 * 60 * 60 * 24));
      days = diff === 0 ? "HOY" : diff;
    }
    setStats({ monthCount: thisMonth.length, lastServiceDate: '-', nextServiceDays: days });
  };

  const executeResponse = async () => {
    if (!confirmAction) return;
    setLoadingAction(true);
    const { eventId, status, title } = confirmAction;
    try {
        await updateDoc(doc(db, 'events', eventId), { 
            [`confirmations.${currentUser.displayName}`]: status, 
            updatedAt: serverTimestamp() 
        });
        
        const adminPastors = allUsers.filter(u => u.role === 'pastor').map(u => u.id);
        if (adminPastors.length > 0) {
          const body = status === 'confirmed' ? `${currentUser.displayName} confirmó para ${title}` : `${currentUser.displayName} notificó baja a ${title}`;
          await sendOneSignalPush(adminPastors, status === 'confirmed' ? "✅ Nueva Confirmación" : "🚨 Baja de Servicio", body, '/servicios');
        }
        toast.success(status === 'confirmed' ? "Asistencia confirmada" : "Baja notificada");
    } catch (error) { toast.error("Error al actualizar"); }
    finally { setConfirmAction(null); setLoadingAction(false); }
  };

  if (loading) return <div className="flex justify-center py-24 bg-[#ebedf0] min-h-screen"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;

  return (
    // ✅ UI UPDATE: Fondo gris estilo FB
    <div className="pb-28 pt-8 bg-[#ebedf0] min-h-screen animate-fade-in relative font-sans text-left">
      <div className="mb-4 max-w-md mx-auto px-4">
        <h1 className="text-[22px] font-bold text-slate-900 mb-1 leading-none tracking-tight">Hola, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
        <p className="text-[13px] font-medium text-slate-500">Gestión de servicios</p>

        {(userRole === 'pastor' || userRole === 'lider') && (
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl mt-4 shadow-sm relative">
                <button onClick={() => setActiveTab('me')} className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all relative ${activeTab === 'me' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                    Mis Turnos {alerts.me > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white flex items-center justify-center rounded-full text-[10px] border-2 border-white animate-pulse font-bold">{alerts.me}</span>}
                </button>
                <button onClick={() => setActiveTab('team')} className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${activeTab === 'team' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Users size={14}/> Mi Equipo {alerts.team > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-white flex items-center justify-center rounded-full text-[10px] border-2 border-white font-bold">{alerts.team}</span>}
                </button>
            </div>
        )}
      </div>

      <div className="w-full max-w-md mx-auto">
        {activeTab === 'me' ? (
          <MyTurnsTab 
            myEvents={myEvents} 
            currentUser={currentUser} 
            stats={stats} 
            setConfirmAction={setConfirmAction} 
            unreadCounts={unreadCounts} 
            navigate={navigate} 
          />
        ) : (
          <TeamSupervisionTab 
            teamEvents={teamEvents} 
            allUsers={allUsers}
            unreadCounts={unreadCounts}
            setShowAttendanceEvent={setShowAttendanceEvent}
            sendOneSignalPush={sendOneSignalPush}
            navigate={navigate}
          />
        )}
      </div>

      <div className="pb-10 pt-4 flex justify-center max-w-md mx-auto">
        <button onClick={() => navigate('/historial')} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors active:scale-95 px-4 py-2 rounded-full"><History size={16}/> Ver historial completo</button>
      </div>

      {confirmAction && <ConfirmationModal confirmAction={confirmAction} executeResponse={executeResponse} setConfirmAction={setConfirmAction} loadingAction={loadingAction} />}
      {showAttendanceEvent && <AttendanceModal event={showAttendanceEvent} allUsers={allUsers} onClose={() => setShowAttendanceEvent(null)} />}
    </div>
  );
}

// ============================================================================
// 2. SUB-COMPONENTE: MIS TURNOS
// ============================================================================
function MyTurnsTab({ myEvents, currentUser, stats, setConfirmAction, unreadCounts, navigate }) {
  
  const getMyRole = (event) => {
    if (!event || !event.assignments) return 'Equipo';
    const roleKey = Object.keys(event.assignments).find(key => event.assignments[key].includes(currentUser.displayName));
    return roleKey ? roleKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Equipo';
  };

  return (
    <div className="animate-fade-in space-y-4 px-4">
      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="bg-white p-4 rounded-[16px] shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden h-28">
          <div className="absolute -right-2 -top-2 w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center"><TrendingUp size={20} className="text-blue-200"/></div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider relative z-10">Este Mes</span>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-3xl font-black text-slate-900 leading-none">{stats.monthCount}</span>
            <span className="text-[11px] font-semibold text-slate-500">turnos</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-[16px] shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden h-28">
          <div className="absolute -right-2 -top-2 w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center"><Clock size={20} className="text-amber-200"/></div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider relative z-10">{stats.nextServiceDays === 'HOY' ? 'Atención' : 'Faltan'}</span>
          <div className="relative z-10">
            <span className="text-3xl font-black text-slate-900 leading-none">{stats.nextServiceDays || '-'}</span>
            {stats.nextServiceDays !== 'HOY' && <span className="text-[11px] font-semibold text-slate-500 ml-1">días</span>}
          </div>
        </div>
      </div>

      {/* TURNOS SIN CONFIRMAR */}
      {myEvents.filter(e => (!e.confirmations || !e.confirmations[currentUser.displayName])).map(event => (
          // ✅ UI UPDATE: Tarjeta sin redondez excesiva
          <div key={event.id} className="bg-white rounded-[16px] p-5 shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="relative z-10">
                  <span className="inline-block px-2.5 py-1 rounded border border-blue-100 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-3">{getMyRole(event)}</span>
                  <h3 className="text-[18px] font-bold text-slate-900 mb-1.5 leading-tight">{event.title}</h3>
                  <div className="flex flex-col gap-1 text-[13px] text-slate-500 font-medium mb-5">
                      <div className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400"/> <span className="capitalize">{format(new Date(event.date + 'T00:00:00'), 'EEEE d, MMMM', { locale: es })}</span></div>
                      <div className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400"/> {event.time} hs</div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => setConfirmAction({ eventId: event.id, status: 'confirmed', title: event.title })} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-[13px] font-bold active:scale-95 transition-transform">Confirmar</button>
                      <button onClick={() => setConfirmAction({ eventId: event.id, status: 'declined', title: event.title })} className="flex-1 bg-[#f0f2f5] text-slate-600 border border-slate-200 py-2.5 rounded-lg text-[13px] font-bold active:scale-95 transition-transform">No puedo</button>
                  </div>
              </div>
          </div>
      ))}

      {/* AGENDA CONFIRMADA */}
      {myEvents.some(e => e.confirmations && e.confirmations[currentUser.displayName] === 'confirmed') && (
        <div className="mt-6">
          <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Próximos Turnos Confirmados</h2>
          <div className="space-y-3">
            {myEvents.filter(e => e.confirmations && e.confirmations[currentUser.displayName] === 'confirmed').map(event => (
                <div key={event.id} className="bg-white p-4 rounded-[16px] border border-slate-200 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-[12px] text-slate-500 border border-slate-200 shrink-0">
                          <span className="text-[9px] font-bold uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                          <span className="text-base font-bold leading-none mt-0.5">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-[14px] truncate">{event.title}</h4>
                          <p className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5 truncate">{getMyRole(event)}</p>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-bold uppercase tracking-wider"><CheckCircle size={10}/> Servicio Confirmado</div>
                        </div>
                    </div>
                    <button onClick={() => navigate(`/servicios/${event.id}`)} className="w-full bg-[#f0f2f5] text-blue-600 font-bold py-2.5 rounded-lg text-[13px] flex items-center justify-center gap-1.5 active:scale-95 transition-transform relative">
                        <MessageSquare size={16}/> Abrir Chat de Servicio
                        {unreadCounts[event.id] > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-sm font-bold">{unreadCounts[event.id]}</span>}
                    </button>
                </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. SUB-COMPONENTE: SUPERVISIÓN PASTORAL
// ============================================================================
function TeamSupervisionTab({ teamEvents, allUsers, unreadCounts, setShowAttendanceEvent, sendOneSignalPush, navigate }) {
  
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

  const handleRemindPending = async (event) => {
    if (!window.confirm("¿Avisar a todos los pendientes?")) return;
    
    let pendingNames = [];
    if (event.assignments) {
      Object.values(event.assignments).flat().forEach(name => {
        if (event.confirmations?.[name] !== 'confirmed' && event.confirmations?.[name] !== 'declined') {
          pendingNames.push(name);
        }
      });
    }
    if (pendingNames.length === 0) return;

    const pendingUIDs = allUsers.filter(u => pendingNames.includes(u.displayName)).map(u => u.id);
    toast.info("Enviando recordatorios...");
    await sendOneSignalPush(pendingUIDs, "⚠️ Recordatorio de Servicio", `Tenés un servicio sin confirmar para ${event.title}.`, '/servicios');
    toast.success("Recordatorios enviados");
  };

  const handleNotifyUnreadChat = async (event) => {
    const assignedNames = Object.values(event.assignments || {}).flat();
    const targetUIDs = allUsers.filter(u => assignedNames.includes(u.displayName) && u.id !== auth.currentUser?.uid).map(u => u.id);
    if (targetUIDs.length === 0) return;
    
    toast.info("Avisando al equipo...");
    await sendOneSignalPush(targetUIDs, "💬 Mensajes en el Chat", `Hay novedades en el chat de servicio para ${event.title}.`, `/servicios/${event.id}`);
    toast.success("Aviso enviado");
  };

  return (
    <div className="animate-fade-in space-y-4 px-4">
        <div className="bg-white p-5 rounded-[16px] shadow-sm border border-slate-200 flex flex-col gap-1">
            <h3 className="font-bold text-[18px] text-slate-900 leading-none">Supervisión</h3>
            <p className="text-[12px] text-blue-600 font-semibold uppercase tracking-wider mt-0.5">Panel de Liderazgo</p>
        </div>
        
        <div className="space-y-3">
            {teamEvents.map(event => {
                const status = getTeamStatus(event);
                if (status.total === 0) return null; 
                const hasIssues = status.declined > 0;
                const progress = Math.round(((status.confirmed + status.declined) / status.total) * 100) || 0;
                const pendingCount = status.total - status.confirmed - status.declined;
                const hasUnreadChat = unreadCounts[event.id] > 0;

                return (
                    <div key={event.id} className="bg-white p-4 rounded-[16px] border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-slate-900 text-[15px] truncate">{event.title}</h4>
                              <p className="text-[11px] text-slate-400 font-semibold mt-0.5 capitalize">{format(new Date(event.date + 'T00:00:00'), 'EEEE d, MMMM', { locale: es })}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {pendingCount > 0 && (
                                <button onClick={() => handleRemindPending(event)} className="w-7 h-7 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-full flex items-center justify-center active:scale-90 transition-colors" title="Avisar a Pendientes">
                                  <BellRing size={14}/>
                                </button>
                              )}
                              <button onClick={() => handleNotifyUnreadChat(event)} className="w-7 h-7 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-full flex items-center justify-center active:scale-90 transition-colors" title="Avisar Chat">
                                <MessageSquare size={14}/>
                              </button>
                            </div>
                        </div>
                        
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3 relative">
                          <div className={`h-full rounded-full transition-all duration-1000 ${hasIssues ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${progress}%` }}></div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          {hasIssues ? (
                            <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><ShieldAlert size={10}/> {status.declined} Bajas</span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{status.confirmed} de {status.total} Confirmados</span>
                          )}
                          
                          <div className="flex gap-2">
                            <button onClick={() => setShowAttendanceEvent(event)} className="text-[12px] font-bold text-slate-500 hover:text-slate-800 transition-colors mr-2 py-1">Detalles</button>
                            <button onClick={() => navigate(`/servicios/${event.id}`)} className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center relative active:scale-90 transition-transform">
                                <MessageSquare size={12}/>
                                {hasUnreadChat && <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full flex items-center justify-center text-[8px] text-white font-bold border-2 border-white">{unreadCounts[event.id]}</span>}
                            </button>
                          </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
}

// ============================================================================
// 4. SUB-COMPONENTES MODALES (Detalles y Confirmación)
// ============================================================================
function ConfirmationModal({ confirmAction, executeResponse, setConfirmAction, loadingAction }) {
  return (
    <div className="fixed inset-0 z-[500] bg-slate-900/40 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-t-[24px] sm:rounded-[24px] p-6 shadow-2xl animate-slide-up text-center border border-slate-200">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5 sm:hidden shrink-0"></div>
        <div className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center ${confirmAction.status === 'confirmed' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
          {confirmAction.status === 'confirmed' ? <CheckCircle size={28} strokeWidth={2.5}/> : <AlertCircle size={28} strokeWidth={2.5}/>}
        </div>
        <h4 className="font-bold text-slate-900 text-[18px] mb-1">{confirmAction.status === 'confirmed' ? 'Confirmar Asistencia' : 'Informar Baja'}</h4>
        <p className="text-[14px] text-slate-500 font-medium mb-6 leading-relaxed">Para el servicio: <span className="font-bold text-slate-800">{confirmAction.title}</span></p>
        <div className="flex flex-col gap-2">
          <button onClick={executeResponse} disabled={loadingAction} className={`w-full py-3.5 rounded-xl font-bold text-[14px] shadow-sm flex items-center justify-center gap-2 ${confirmAction.status === 'confirmed' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'} disabled:opacity-50 active:scale-95 transition-transform`}>
            {loadingAction ? <Loader2 className="animate-spin" size={18}/> : 'Sí, confirmar'}
          </button>
          <button onClick={() => setConfirmAction(null)} disabled={loadingAction} className="w-full py-3.5 rounded-xl font-bold text-[14px] text-slate-600 bg-[#f0f2f5] hover:bg-slate-200 disabled:opacity-50 transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function AttendanceModal({ event, allUsers, onClose }) {
  const getGroupedAttendance = () => {
    const grouped = { confirmed: [], declined: [], pending: [] };
    if (!event.assignments) return grouped;
    Object.entries(event.assignments).forEach(([role, people]) => {
      (Array.isArray(people) ? people : [people]).forEach(name => {
        const status = event.confirmations?.[name];
        const userData = allUsers.find(u => u.displayName === name);
        const item = { name, role: role.replace(/_/g, ' '), photo: userData?.photoURL };
        if (status === 'confirmed') grouped.confirmed.push(item);
        else if (status === 'declined') grouped.declined.push(item);
        else grouped.pending.push(item);
      });
    });
    return grouped;
  };

  const grouped = getGroupedAttendance();

  return (
    <div className="fixed inset-0 z-[600] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-[24px] sm:rounded-[24px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white flex-shrink-0">
          <div className="text-left flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-[16px] leading-tight truncate pr-2">{event.title}</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5 capitalize">{format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM yyyy', {locale: es})}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 active:scale-90 transition-transform"><X size={18}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-8 no-scrollbar bg-slate-50">
          {grouped.confirmed.length > 0 && (
            <div className="text-left">
              <h4 className="text-[12px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"><CheckCircle size={14}/> Confirmados ({grouped.confirmed.length})</h4>
              <div className="space-y-2">
                {grouped.confirmed.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-[12px] border border-slate-200 shadow-sm">
                    <img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=EBF4FF&color=2563EB`} className="w-9 h-9 rounded-full object-cover shrink-0" alt={item.name} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-[13px] truncate">{item.name}</h4>
                      <p className="text-[11px] font-semibold text-slate-500 capitalize truncate">{item.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {grouped.declined.length > 0 && (
            <div className="text-left">
              <h4 className="text-[12px] font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><XCircle size={14}/> Bajas ({grouped.declined.length})</h4>
              <div className="space-y-2">
                {grouped.declined.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-[12px] border border-red-200 shadow-sm">
                    <img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=fee2e2&color=ef4444`} className="w-9 h-9 rounded-full object-cover shrink-0 grayscale" alt={item.name} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-500 text-[13px] truncate line-through">{item.name}</h4>
                      <p className="text-[11px] font-semibold text-red-500 capitalize truncate">{item.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {grouped.pending.length > 0 && (
            <div className="text-left">
              <h4 className="text-[12px] font-bold text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><HelpCircle size={14}/> Pendientes ({grouped.pending.length})</h4>
              <div className="space-y-2">
                {grouped.pending.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-[12px] border border-slate-200 shadow-sm opacity-60">
                    <img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=f1f5f9&color=94a3b8`} className="w-9 h-9 rounded-full object-cover shrink-0" alt={item.name} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-700 text-[13px] truncate">{item.name}</h4>
                      <p className="text-[11px] font-semibold text-slate-500 capitalize truncate">{item.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}