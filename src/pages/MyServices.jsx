import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, updateDoc, 
  getDoc, serverTimestamp, getDocs, addDoc 
} from 'firebase/firestore';
import { 
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, 
  History, ChevronRight, Loader2, RefreshCcw, Users, ShieldAlert, 
  MessageSquare, HelpCircle, User, X, ArrowRightCircle, Check, Info, Lock, BellRing
} from 'lucide-react';
import { format, isSameMonth, isPast, isFuture, subDays, startOfDay, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ONESIGNAL_CONFIG } from '../oneSignalConfig';

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
  const ayer = useMemo(() => subDays(startOfDay(new Date()), 1), []);

  // ✅ FUNCIÓN BASE PARA ENVÍO (ONESIGNAL APK FIX)
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

  useEffect(() => {
    if (!currentUser || myEvents.length === 0) return;
    const unsubscribes = myEvents.map(event => {
      const notesRef = collection(db, `events/${event.id}/notes`);
      return onSnapshot(notesRef, (snapshot) => {
        const unread = snapshot.docs.filter(d => {
          const data = d.data();
          return !data.readBy?.includes(currentUser.uid);
        }).length;
        setUnreadCounts(prev => ({ ...prev, [event.id]: unread }));
      });
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [myEvents, currentUser]);

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
                
                const myAssignments = eventsData.filter(event => {
                    if (!event.assignments) return false;
                    const eventDate = new Date(event.date + 'T00:00:00');
                    const belongs = Object.values(event.assignments).some(p => Array.isArray(p) && p.includes(currentUser.displayName));
                    return belongs && isAfter(eventDate, ayer);
                });

                setMyEvents(myAssignments);
                calculateStats(myAssignments, currentUser.displayName);

                let futureEvents = [];
                if (role === 'pastor' || role === 'lider') {
                    futureEvents = eventsData.filter(event => isAfter(new Date(event.date + 'T00:00:00'), ayer));
                    setTeamEvents(futureEvents);
                }

                const myPendingCount = myAssignments.filter(e => (!e.confirmations || !e.confirmations[currentUser.displayName])).length;
                const totalUnreadMessages = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

                let teamIssuesCount = 0;
                if ((role === 'pastor' || role === 'lider') && activeTab !== 'team') {
                    teamIssuesCount = futureEvents.filter(event => 
                        event.updatedAt && event.updatedAt.toDate() > lastSeenDate
                    ).length;
                }
                setAlerts({ me: myPendingCount + totalUnreadMessages, team: teamIssuesCount });
                setLoading(false);
            });
            return () => unsubscribe();
        } catch (error) { setLoading(false); }
    };
    fetchData();
  }, [currentUser, activeTab, unreadCounts, ayer]);

  const calculateStats = (events, myName) => {
    const now = new Date();
    const active = events.filter(e => e.confirmations?.[myName] !== 'declined');
    const thisMonth = active.filter(e => isSameMonth(new Date(e.date + 'T00:00:00'), now));
    const future = active.filter(e => isAfter(new Date(e.date + 'T00:00:00'), subDays(now, 1)));
    const next = future.length > 0 ? future[0] : null;
    let days = null;
    if (next) {
      const diff = Math.ceil((new Date(next.date + 'T00:00:00') - startOfDay(now)) / (1000 * 60 * 60 * 24));
      days = diff === 0 ? "HOY" : diff;
    }
    setStats({ monthCount: thisMonth.length, lastServiceDate: '-', nextServiceDays: days });
  };

  const notifyPastorsOfResponse = async (status, eventTitle) => {
    const adminPastors = allUsers.filter(u => u.role === 'pastor').map(u => u.id);
    if (adminPastors.length === 0) return;

    const title = status === 'confirmed' ? "✅ Nueva Confirmación" : "🚨 Alerta: Baja de Servicio";
    const body = status === 'confirmed' 
      ? `${currentUser.displayName} confirmó para ${eventTitle}`
      : `${currentUser.displayName} notificó que NO PUEDE asistir a ${eventTitle}`;

    await sendOneSignalPush(adminPastors, title, body, '/servicios');
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
        
        await notifyPastorsOfResponse(status, title);
        
        toast.success(status === 'confirmed' ? "Asistencia confirmada" : "Baja notificada");
    } catch (error) { toast.error("Error al actualizar"); }
    finally { 
      setConfirmAction(null); 
      setLoadingAction(false); 
    }
  };

  const handleUndo = async (eventId) => {
    setLoadingAction(true);
    try { 
        await updateDoc(doc(db, 'events', eventId), { 
            [`confirmations.${currentUser.displayName}`]: null,
            updatedAt: serverTimestamp()
        }); 
        toast.info("Estado restablecido");
    } catch (e) { toast.error("Error"); }
    finally { setLoadingAction(false); }
  };

  const handleRemindPending = async (event) => {
    if (!window.confirm("¿Avisar a todos los pendientes?")) return;
    const pendingNames = getGroupedAttendance(event).pending.map(p => p.name);
    if (pendingNames.length === 0) return;

    const pendingUIDs = allUsers.filter(u => pendingNames.includes(u.displayName)).map(u => u.id);
    toast.info("Enviando recordatorios...");
    
    await sendOneSignalPush(
      pendingUIDs, 
      "⚠️ Recordatorio de Servicio", 
      `Tenés un servicio sin confirmar para ${event.title}. Por favor, responde en la App.`,
      '/servicios'
    );
    toast.success("Recordatorios enviados");
  };

  const handleNotifyUnreadChat = async (event) => {
    const assignedNames = Object.values(event.assignments || {}).flat();
    const targetUIDs = allUsers.filter(u => assignedNames.includes(u.displayName) && u.id !== currentUser.uid).map(u => u.id);
    
    if (targetUIDs.length === 0) return;
    
    toast.info("Avisando al equipo sobre el chat...");
    await sendOneSignalPush(
      targetUIDs,
      "💬 Mensajes en el Chat",
      `Hay novedades en el chat de servicio para ${event.title}. ¡No te las pierdas!`,
      `/servicios/${event.id}`
    );
    toast.success("Aviso enviado");
  };

  const getMyRole = (event) => {
      if (!event || !event.assignments) return 'Equipo';
      const roleKey = Object.keys(event.assignments).find(key => event.assignments[key].includes(currentUser.displayName));
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

  const getGroupedAttendance = (event) => {
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

  if (loading) return <div className="flex justify-center py-24 bg-[#F8F9FE] min-h-screen"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;

  return (
    <div className="pb-28 pt-8 px-5 bg-[#F8F9FE] min-h-screen animate-fade-in relative font-sans text-left">
      <div className="mb-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1 leading-none tracking-tight">Hola, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
        <p className="text-xs font-semibold text-slate-500">Gestión de servicios</p>

        {/* 🚀 TABS ESTILO SOCIALYO */}
        {(userRole === 'pastor' || userRole === 'lider') && (
            <div className="flex p-1 bg-white border border-slate-100 rounded-full mt-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative">
                <button onClick={() => setActiveTab('me')} className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all relative ${activeTab === 'me' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                    Mis Turnos {alerts.me > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white flex items-center justify-center rounded-full text-[10px] border-2 border-white animate-pulse font-bold">{alerts.me}</span>}
                </button>
                <button onClick={() => setActiveTab('team')} className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 relative ${activeTab === 'team' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Users size={14}/> Mi Equipo {alerts.team > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white flex items-center justify-center rounded-full text-[10px] border-2 border-white font-bold">{alerts.team}</span>}
                </button>
            </div>
        )}
      </div>

      <div className="max-w-md mx-auto">
        {/* ==============================
            PESTAÑA: MIS TURNOS
        ============================== */}
        {activeTab === 'me' && (
            <div className="animate-fade-in space-y-6">
                
                {/* 🚀 TARJETAS DE ESTADÍSTICAS LUMINOSAS */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between relative overflow-hidden h-32">
                    <div className="absolute -right-3 -top-3 w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center"><TrendingUp size={24} className="text-blue-200"/></div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider relative z-10">Este Mes</span>
                    <div className="flex items-baseline gap-1 relative z-10">
                      <span className="text-4xl font-black text-slate-900 leading-none">{stats.monthCount}</span>
                      <span className="text-xs font-semibold text-slate-500">turnos</span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-5 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between relative overflow-hidden h-32">
                    <div className="absolute -right-3 -top-3 w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center"><Clock size={24} className="text-amber-200"/></div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider relative z-10">{stats.nextServiceDays === 'HOY' ? 'Atención' : 'Faltan'}</span>
                    <div className="relative z-10">
                      <span className="text-4xl font-black text-slate-900 leading-none">{stats.nextServiceDays || '-'}</span>
                      {stats.nextServiceDays !== 'HOY' && <span className="text-xs font-semibold text-slate-500 ml-1">días</span>}
                    </div>
                  </div>
                </div>

                {/* 🚀 TURNOS SIN CONFIRMAR */}
                {myEvents.filter(e => (!e.confirmations || !e.confirmations[currentUser.displayName])).map(event => (
                    <div key={event.id} className="bg-white rounded-[32px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)] border border-slate-100 relative overflow-hidden">
                        <div className="relative z-10">
                            <span className="inline-block px-3 py-1 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-4">{getMyRole(event)}</span>
                            <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight">{event.title}</h3>
                            <div className="flex flex-col gap-1.5 text-sm text-slate-500 font-medium mb-6">
                                <div className="flex items-center gap-2"><Calendar size={16} className="text-slate-400"/> {format(new Date(event.date + 'T00:00:00'), 'EEEE d, MMMM', { locale: es })}</div>
                                <div className="flex items-center gap-2"><Clock size={16} className="text-slate-400"/> {event.time} hs</div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmAction({ eventId: event.id, status: 'confirmed', title: event.title })} className="flex-1 bg-blue-600 text-white py-3.5 rounded-full text-xs font-bold shadow-md shadow-blue-600/20 active:scale-95 transition-transform">Confirmar</button>
                                <button onClick={() => setConfirmAction({ eventId: event.id, status: 'declined', title: event.title })} className="flex-1 bg-slate-50 text-slate-600 border border-slate-200 py-3.5 rounded-full text-xs font-bold active:scale-95 transition-transform">No puedo</button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* 🚀 AGENDA CONFIRMADA */}
                {myEvents.some(e => e.confirmations && e.confirmations[currentUser.displayName] === 'confirmed') && (
                  <div className="mt-8">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Próximos Turnos Confirmados</h2>
                    <div className="space-y-4">
                      {myEvents.filter(e => e.confirmations && e.confirmations[currentUser.displayName] === 'confirmed').map(event => (
                          <div key={event.id} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col gap-4">
                              <div className="flex items-center gap-4">
                                  <div className="flex flex-col items-center justify-center w-14 h-14 bg-slate-50 rounded-[16px] text-slate-500 border border-slate-100 shrink-0">
                                    <span className="text-[10px] font-bold uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span>
                                    <span className="text-lg font-bold leading-none mt-0.5">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-900 text-sm truncate">{event.title}</h4>
                                    <p className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5">{getMyRole(event)}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-emerald-600 font-bold uppercase tracking-wider"><CheckCircle size={12}/> Servicio Confirmado</div>
                                  </div>
                              </div>
                              <button onClick={() => navigate(`/servicios/${event.id}`)} className="w-full bg-slate-50 text-blue-600 border border-slate-100 font-bold py-3 rounded-full text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform relative">
                                  <MessageSquare size={16}/> Abrir Chat de Servicio
                                  {unreadCounts[event.id] > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white shadow-sm font-bold">{unreadCounts[event.id]}</span>}
                              </button>
                          </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
        )}

        {/* ==============================
            PESTAÑA: SUPERVISIÓN (PASTORES)
        ============================== */}
        {activeTab === 'team' && (
            <div className="animate-fade-in space-y-6">
                <div className="bg-white p-6 rounded-[32px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-1">
                    <h3 className="font-bold text-xl text-slate-900 leading-none">Supervisión</h3>
                    <p className="text-[11px] text-blue-600 font-semibold uppercase tracking-wider mt-1">Panel de Liderazgo</p>
                </div>
                
                <div className="space-y-4">
                    {teamEvents.map(event => {
                        const status = getTeamStatus(event);
                        if (status.total === 0) return null; 
                        const hasIssues = status.declined > 0;
                        const progress = Math.round(((status.confirmed + status.declined) / status.total) * 100);
                        const pendingCount = status.total - status.confirmed - status.declined;
                        const hasUnreadChat = unreadCounts[event.id] > 0;

                        return (
                            <div key={event.id} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="min-w-0 flex-1">
                                      <h4 className="font-bold text-slate-900 text-[15px] truncate">{event.title}</h4>
                                      <p className="text-[11px] text-slate-400 font-semibold mt-1 capitalize">{format(new Date(event.date + 'T00:00:00'), 'EEEE d, MMMM', { locale: es })}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {/* BOTONES CIRCULARES */}
                                      {pendingCount > 0 && (
                                        <button onClick={() => handleRemindPending(event)} className="w-8 h-8 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-full flex items-center justify-center active:scale-90 transition-colors" title="Avisar a Pendientes">
                                          <BellRing size={14}/>
                                        </button>
                                      )}
                                      <button onClick={() => handleNotifyUnreadChat(event)} className="w-8 h-8 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-full flex items-center justify-center active:scale-90 transition-colors" title="Avisar Chat">
                                        <MessageSquare size={14}/>
                                      </button>
                                    </div>
                                </div>
                                
                                {/* BARRA DE PROGRESO SUAVE */}
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4 relative">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${hasIssues ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${progress}%` }}></div>
                                </div>
                                
                                <div className="flex items-center justify-between mt-2">
                                  {hasIssues ? (
                                    <span className="bg-red-50 text-red-600 px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1"><ShieldAlert size={12}/> {status.declined} Bajas</span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{status.confirmed} de {status.total} Confirmados</span>
                                  )}
                                  
                                  <div className="flex gap-2">
                                    <button onClick={() => setShowAttendanceEvent(event)} className="text-[11px] font-bold text-slate-500 underline underline-offset-2 hover:text-slate-800 transition-colors mr-2">Detalles</button>
                                    <button onClick={() => navigate(`/servicios/${event.id}`)} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center relative active:scale-90 transition-transform">
                                        <MessageSquare size={14}/>
                                        {hasUnreadChat && <span className="absolute -top-1 -right-1 bg-red-500 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] text-white font-bold border-2 border-white">{unreadCounts[event.id]}</span>}
                                    </button>
                                  </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      {/* 🚀 MODAL DE CONFIRMACIÓN SOCIALYO (BOTTOM SHEET) */}
      {confirmAction && (
        <div className="fixed inset-0 z-[500] bg-slate-900/40 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl animate-slide-up text-center border border-slate-100">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>
            
            <div className={`w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center ${confirmAction.status === 'confirmed' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
              {confirmAction.status === 'confirmed' ? <CheckCircle size={32} strokeWidth={2.5}/> : <AlertCircle size={32} strokeWidth={2.5}/>}
            </div>
            
            <h4 className="font-bold text-slate-900 text-xl mb-2">
              {confirmAction.status === 'confirmed' ? 'Confirmar Asistencia' : 'Informar Baja'}
            </h4>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed px-2">Para el servicio: <span className="font-bold text-slate-700">{confirmAction.title}</span></p>
            
            <div className="flex flex-col gap-3">
              <button onClick={executeResponse} disabled={loadingAction} className={`w-full py-4 rounded-full font-bold text-sm shadow-sm flex items-center justify-center gap-2 ${confirmAction.status === 'confirmed' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'} disabled:opacity-50 active:scale-95 transition-transform`}>
                {loadingAction ? <Loader2 className="animate-spin" size={18}/> : 'Sí, confirmar'}
              </button>
              <button onClick={() => setConfirmAction(null)} disabled={loadingAction} className="w-full py-4 rounded-full font-bold text-sm text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL DETALLE DE ASISTENCIA (LÍDERES) */}
      {showAttendanceEvent && (() => {
        const grouped = getGroupedAttendance(showAttendanceEvent);
        return (
          <div className="fixed inset-0 z-[600] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setShowAttendanceEvent(null)}>
            <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up border border-slate-100" onClick={e => e.stopPropagation()}>
              
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
                <div className="text-left">
                  <h3 className="font-bold text-slate-900 text-lg leading-none truncate pr-4">{showAttendanceEvent.title}</h3>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1 capitalize">{format(new Date(showAttendanceEvent.date + 'T00:00:00'), 'EEEE d MMMM yyyy', {locale: es})}</p>
                </div>
                <button onClick={() => setShowAttendanceEvent(null)} className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full text-slate-500 active:scale-90 transition-transform"><X size={18}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-12 no-scrollbar bg-slate-50">
                
                {grouped.confirmed.length > 0 && (
                  <div className="text-left">
                    <h4 className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2"><CheckCircle size={14}/> Confirmados ({grouped.confirmed.length})</h4>
                    <div className="space-y-2.5">
                      {grouped.confirmed.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-[20px] border border-slate-100 shadow-sm">
                          <img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=EBF4FF&color=2563EB`} className="w-10 h-10 rounded-full object-cover shrink-0" alt={item.name} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-[13px] truncate">{item.name}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 capitalize truncate">{item.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {grouped.declined.length > 0 && (
                  <div className="text-left">
                    <h4 className="text-[11px] font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2"><XCircle size={14}/> Bajas ({grouped.declined.length})</h4>
                    <div className="space-y-2.5">
                      {grouped.declined.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-[20px] border border-red-100 shadow-sm">
                          <img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=fee2e2&color=ef4444`} className="w-10 h-10 rounded-full object-cover shrink-0 grayscale" alt={item.name} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-500 text-[13px] truncate line-through">{item.name}</h4>
                            <p className="text-[10px] font-semibold text-red-500 capitalize truncate">{item.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {grouped.pending.length > 0 && (
                  <div className="text-left">
                    <h4 className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2"><HelpCircle size={14}/> Pendientes ({grouped.pending.length})</h4>
                    <div className="space-y-2.5">
                      {grouped.pending.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-[20px] border border-slate-100 shadow-sm opacity-60">
                          <img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=f1f5f9&color=94a3b8`} className="w-10 h-10 rounded-full object-cover shrink-0" alt={item.name} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-700 text-[13px] truncate">{item.name}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 capitalize truncate">{item.role}</p>
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
      })()}

      <div className="pb-10 pt-4 flex justify-center">
        <button onClick={() => navigate('/historial')} className="text-xs font-bold text-slate-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors active:scale-95 px-4 py-2 rounded-full"><History size={16}/> Ver historial completo</button>
      </div>
    </div>
  );
}