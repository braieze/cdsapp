import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, updateDoc, 
  getDoc, serverTimestamp, getDocs 
} from 'firebase/firestore';
import { 
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, 
  History, ChevronRight, Loader2, RefreshCcw, Users, ShieldAlert, 
  MessageSquare, HelpCircle, User, X, ArrowRightCircle, Check, Info, Lock, BellRing
} from 'lucide-react';
import { format, isSameMonth, isPast, isFuture, subDays, startOfDay, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const [toast, setToast] = useState(null); 
  const [loadingAction, setLoadingAction] = useState(false);

  const currentUser = auth.currentUser;

  const ayer = useMemo(() => subDays(startOfDay(new Date()), 1), []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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

    setStats({ 
      monthCount: thisMonth.length, 
      lastServiceDate: '-', 
      nextServiceDays: days 
    });
  };

  // ✅ NUEVA FUNCIÓN: Envío silencioso a Pastores Designados
  const notifyPastors = async (title, body) => {
    const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
    if (!REST_API_KEY) return;
    
    // Obtenemos los pastores/lideres principales (Filtro anti-spam)
    const adminPastors = allUsers.filter(u => 
      u.role === 'pastor' && 
      (u.area?.toLowerCase() === 'general' || u.area?.toLowerCase() === 'recepcion')
    ).map(u => u.id); // Sus UIDs

    if (adminPastors.length === 0) return; // Nadie a quien avisar

    try {
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
          headings: { en: title, es: title },
          contents: { en: body, es: body },
          include_external_user_ids: adminPastors, // Solo les llega a estos UIDs
          priority: 10
        })
      });
    } catch (e) { console.error("Error notificando pastores", e); }
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
        
        // 🚀 FASE 3: Notificar a los pastores que respondió
        const eventoBase = myEvents.find(e => e.id === eventId);
        const myRoleForEvent = getMyRole(eventoBase);
        
        if (status === 'confirmed') {
          await notifyPastors("✅ Confirmación de Servicio", `${currentUser.displayName} confirmó asistencia en ${myRoleForEvent} para el culto de ${title}.`);
          setToast({ message: "¡Asistencia confirmada!", type: "success" });
        } else {
          await notifyPastors("🚨 ALERTA: Baja de Servicio", `${currentUser.displayName} acaba de notificar que NO PUEDE ASISTIR a ${myRoleForEvent} para el culto de ${title}.`);
          setToast({ message: "Baja notificada correctamente", type: "success" });
        }
    } catch (error) { setToast({ message: "Error al actualizar", type: "error" }); }
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
        setToast({ message: "Estado restablecido", type: "info" });
    } catch (e) { setToast({ message: "Error", type: "error" }); }
    finally { setLoadingAction(false); }
  };

  // ✅ NUEVA FUNCIÓN: Recordatorio Automático a Inactivos
  const handleRemindPending = async (event) => {
    if (!window.confirm("¿Avisar a todos los pendientes?")) return;
    
    const pendingNames = getGroupedAttendance(event).pending.map(p => p.name);
    if (pendingNames.length === 0) return;

    // Buscamos los UIDs de esas personas
    const pendingUIDs = allUsers.filter(u => pendingNames.includes(u.displayName)).map(u => u.id);
    
    setToast({ message: "Enviando recordatorios...", type: "info" });
    
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
          headings: { en: "⚠️ Recordatorio de Servicio", es: "⚠️ Recordatorio de Servicio" },
          contents: { en: `Tenés un servicio sin confirmar para ${event.title}. Por favor, entrá a la App a responder.`, es: `Tenés un servicio sin confirmar para ${event.title}. Por favor, entrá a la App a responder.` },
          include_external_user_ids: pendingUIDs, // Solo le llega a los pendientes
          data: { route: '/servicios' }
        })
      });
      setToast({ message: "Recordatorios enviados", type: "success" });
    } catch (e) {
      console.error(e);
      setToast({ message: "Error al enviar", type: "error" });
    }
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  return (
    <div className="pb-24 pt-6 px-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit text-left">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 mb-1">Hola, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
        {(userRole === 'pastor' || userRole === 'lider') && (
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl mt-4 shadow-sm relative">
                <button onClick={() => setActiveTab('me')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all relative ${activeTab === 'me' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>
                    Mis Turnos {alerts.me > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full text-[9px] border-2 border-white animate-pulse font-black">{alerts.me}</span>}
                </button>
                <button onClick={() => setActiveTab('team')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 relative ${activeTab === 'team' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>
                    <Users size={14}/> Mi Equipo {alerts.team > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white flex items-center justify-center rounded-full text-[9px] border-2 border-white font-black">{alerts.team}</span>}
                </button>
            </div>
        )}
      </div>

      {activeTab === 'me' && (
          <div className="animate-fade-in">
              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden"><div className="absolute top-0 right-0 p-3 opacity-10 text-brand-600"><TrendingUp size={60}/></div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Este Mes</span><div className="flex items-baseline gap-1"><span className="text-4xl font-black text-slate-800">{stats.monthCount}</span><span className="text-xs font-medium text-slate-500 uppercase">servicios</span></div></div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28 relative overflow-hidden"><div className="absolute top-0 right-0 p-3 opacity-10 text-purple-600"><Clock size={60}/></div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stats.nextServiceDays === 'HOY' ? 'Atención' : 'Faltan'}</span><div><span className="text-4xl font-black text-slate-800">{stats.nextServiceDays || '-'}</span>{stats.nextServiceDays !== 'HOY' && <span className="text-xs font-medium text-slate-500 uppercase"> días</span>}</div></div>
              </div>

              {/* SERVICIOS PENDIENTES DE RESPUESTA */}
              {myEvents.filter(e => (!e.confirmations || !e.confirmations[currentUser.displayName])).map(event => (
                  <div key={event.id} className="bg-slate-900 rounded-[35px] p-7 text-white shadow-xl mb-6 relative overflow-hidden">
                      <div className="relative z-10">
                          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-[9px] font-black uppercase mb-4 border border-white/10 tracking-widest">{getMyRole(event)}</span>
                          <h3 className="text-2xl font-black mb-2 tracking-tighter uppercase">{event.title}</h3>
                          <div className="flex flex-col gap-2 text-sm text-slate-300 mb-8 font-bold">
                              <div className="flex items-center gap-2"><Calendar size={14} className="text-brand-400"/> {format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</div>
                              <div className="flex items-center gap-2"><Clock size={14} className="text-brand-400"/> {event.time} hs</div>
                          </div>
                          <div className="flex gap-3">
                              <button onClick={() => setConfirmAction({ eventId: event.id, status: 'confirmed', title: event.title })} className="flex-1 bg-brand-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform tracking-widest">Confirmar ✓</button>
                              <button onClick={() => setConfirmAction({ eventId: event.id, status: 'declined', title: event.title })} className="flex-1 bg-white/10 text-white py-4 rounded-2xl text-[10px] font-black uppercase border border-white/10 active:scale-95 transition-transform tracking-widest">No puedo</button>
                          </div>
                      </div>
                  </div>
              ))}

              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-2">Agenda Confirmada</h2>
              <div className="space-y-4 mb-10">
                {myEvents.filter(e => e.confirmations && e.confirmations[currentUser.displayName] === 'confirmed').map(event => (
                    <div key={event.id} className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm flex flex-col gap-5">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-14 h-14 bg-green-50 rounded-2xl text-green-600 border border-green-100"><span className="text-[10px] font-black uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMM', { locale: es })}</span><span className="text-xl font-black">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span></div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{event.title}</h4>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{getMyRole(event)}</p>
                              <div className="flex items-center gap-1 mt-1 text-[9px] text-green-600 font-black uppercase tracking-widest"><CheckCircle size={10}/> Servicio Confirmado</div>
                            </div>
                        </div>
                        
                        <button onClick={() => navigate(`/servicios/${event.id}`)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 relative tracking-widest">
                            <MessageSquare size={16}/> 
                            CHAT DE SERVICIO
                            {unreadCounts[event.id] > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 border-white shadow-md animate-bounce font-black">
                                    {unreadCounts[event.id]}
                                </span>
                            )}
                        </button>
                    </div>
                ))}
              </div>

              {myEvents.filter(e => e.confirmations && e.confirmations[currentUser.displayName] === 'declined').length > 0 && (
                  <div className="mb-6">
                      <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-2">Bajas Notificadas</h2>
                      <div className="space-y-3">
                        {myEvents.filter(e => e.confirmations && e.confirmations[currentUser.displayName] === 'declined').map(event => (
                            <div key={event.id} className="bg-white/50 p-5 rounded-[28px] border border-slate-100 flex items-center justify-between opacity-60 grayscale-[0.5]">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="bg-slate-100 p-3 rounded-xl text-slate-400 shrink-0"><XCircle size={20}/></div>
                                    <div className="min-w-0"><h4 className="font-black text-slate-600 text-xs truncate uppercase">{event.title}</h4><p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{format(new Date(event.date + 'T00:00:00'), 'dd MMM', { locale: es })}</p></div>
                                </div>
                                <button onClick={() => handleUndo(event.id)} className="text-[9px] font-black text-brand-600 flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm active:scale-90 transition-all uppercase shrink-0"><RefreshCcw size={12}/> Reconsiderar</button>
                            </div>
                        ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'team' && (
          <div className="animate-slide-up">
              <div className="bg-slate-900 text-white p-7 rounded-[40px] mb-8 shadow-2xl flex flex-col gap-1">
                  <h3 className="font-black text-2xl uppercase tracking-tighter leading-none">Supervisión</h3>
                  <p className="text-[10px] text-brand-400 font-black uppercase tracking-[0.2em]">Panel de Control de Liderazgo</p>
              </div>
              <div className="space-y-5">
                  {teamEvents.map(event => {
                      const status = getTeamStatus(event);
                      if (status.total === 0) return null; 
                      const hasIssues = status.declined > 0;
                      const progress = Math.round(((status.confirmed + status.declined) / status.total) * 100);
                      const pendingCount = status.total - status.confirmed - status.declined;

                      return (
                          <div key={event.id} className={`bg-white p-6 rounded-[35px] border-2 shadow-sm transition-all ${hasIssues ? 'border-red-100 bg-red-50/10' : 'border-slate-50'}`}>
                              <div className="flex justify-between items-start mb-5">
                                  <div className="min-w-0 flex-1"><h4 className="font-black text-slate-900 text-base uppercase tracking-tight truncate leading-tight">{event.title}</h4><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}</p></div>
                                  <div className="flex gap-2">
                                    {pendingCount > 0 && (
                                      <button onClick={() => handleRemindPending(event)} className="bg-slate-100 hover:bg-brand-100 text-brand-600 px-2 py-1.5 rounded-xl transition-colors active:scale-90" title="Avisar a Pendientes">
                                        <BellRing size={16}/>
                                      </button>
                                    )}
                                    {hasIssues && <div className="bg-red-500 text-white px-3 py-1.5 rounded-full text-[9px] font-black flex items-center gap-1.5 uppercase shadow-lg shadow-red-100 shrink-0"><ShieldAlert size={12}/> {status.declined} Baja(s)</div>}
                                  </div>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-6 shadow-inner"><div className={`h-full rounded-full transition-all duration-1000 ${hasIssues ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div></div>
                              <div className="flex gap-2">
                                <button onClick={() => setShowAttendanceEvent(event)} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 border border-slate-100 transition-all active:scale-95 tracking-widest">DETALLES</button>
                                
                                <button onClick={() => navigate(`/servicios/${event.id}`)} className="p-4 bg-brand-50 text-brand-600 rounded-2xl hover:bg-brand-100 transition-colors relative active:scale-90">
                                    <MessageSquare size={20}/>
                                    {unreadCounts[event.id] > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white border-2 border-white font-black shadow-md">
                                            {unreadCounts[event.id]}
                                        </span>
                                    )}
                                </button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* CONFIRMACIÓN DE ACCIÓN */}
      {confirmAction && (
        <div className="fixed inset-0 z-[500] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[45px] p-10 shadow-2xl animate-scale-in text-center">
            <div className={`w-20 h-20 rounded-[28px] mx-auto mb-6 flex items-center justify-center ${confirmAction.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
              {confirmAction.status === 'confirmed' ? <CheckCircle size={40} strokeWidth={3}/> : <AlertCircle size={40} strokeWidth={3}/>}
            </div>
            <h4 className="font-black text-slate-900 text-xl mb-2 tracking-tighter uppercase leading-tight">
              {confirmAction.status === 'confirmed' ? 'Confirmar Asistencia' : 'Informar Ausencia'}
            </h4>
            <p className="text-[10px] text-slate-400 font-black mb-10 uppercase tracking-widest leading-relaxed px-2">{confirmAction.title}</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeResponse} disabled={loadingAction} className={`w-full py-5 rounded-[22px] font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2 ${confirmAction.status === 'confirmed' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'} disabled:opacity-50`}>
                {loadingAction ? <Loader2 className="animate-spin" size={16}/> : 'Sí, Confirmar'}
              </button>
              <button onClick={() => setConfirmAction(null)} disabled={loadingAction} className="w-full py-5 rounded-[22px] font-black text-xs uppercase text-slate-400 bg-slate-50 active:scale-95 transition-transform disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE ASISTENCIA (PUNTO 8: FIX IMÁGENES) */}
      {showAttendanceEvent && (() => {
        const grouped = getGroupedAttendance(showAttendanceEvent);
        return (
          <div className="fixed inset-0 z-[600] bg-slate-900/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setShowAttendanceEvent(null)}>
            <div className="bg-white w-full sm:max-w-md rounded-t-[50px] sm:rounded-[45px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white flex-shrink-0">
                <div className="text-left">
                  <h3 className="font-black text-slate-900 text-xl leading-none uppercase tracking-tighter">{showAttendanceEvent.title}</h3>
                  <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-2">{format(new Date(showAttendanceEvent.date + 'T00:00:00'), 'd MMMM yyyy', {locale: es})}</p>
                </div>
                <button onClick={() => setShowAttendanceEvent(null)} className="p-3 bg-slate-50 rounded-full text-slate-400 active:scale-75 transition-all"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-10 pb-12 no-scrollbar">
                {grouped.confirmed.length > 0 && (
                  <div className="text-left"><h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2 px-1"><CheckCircle size={16}/> Listos para servir ({grouped.confirmed.length})</h4><div className="space-y-4">{grouped.confirmed.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 bg-emerald-50/20 p-4 rounded-[24px] border border-emerald-100/50"><div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-emerald-100"><img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=10b981&color=fff`} className="w-full h-full object-cover" referrerPolicy="no-referrer"/></div><div className="flex-1 min-w-0"><h4 className="font-black text-slate-800 text-xs truncate uppercase">{item.name}</h4><p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest truncate">{item.role}</p></div><CheckCircle size={18} className="text-emerald-500 shrink-0" /></div>
                      ))}</div></div>
                )}
                {grouped.declined.length > 0 && (
                  <div className="text-left"><h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2 px-1"><XCircle size={16}/> Bajas confirmadas ({grouped.declined.length})</h4><div className="space-y-4">{grouped.declined.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 bg-rose-50/20 p-4 rounded-[24px] border border-rose-100/50 grayscale-[0.3]"><div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-rose-100"><img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=ef4444&color=fff`} className="w-full h-full object-cover" referrerPolicy="no-referrer"/></div><div className="flex-1 min-w-0"><h4 className="font-black text-slate-500 text-xs truncate uppercase line-through">{item.name}</h4><p className="text-[9px] font-black text-rose-600 uppercase tracking-widest truncate">{item.role}</p></div></div>
                      ))}</div></div>
                )}
                {grouped.pending.length > 0 && (
                  <div className="text-left"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2 px-1"><HelpCircle size={16}/> Pendientes ({grouped.pending.length})</h4><div className="space-y-4">{grouped.pending.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 bg-slate-50 p-4 rounded-[24px] border border-slate-100"><div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-200"><img src={item.photo || `https://ui-avatars.com/api/?name=${item.name}&background=94a3b8&color=fff`} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer"/></div><div className="flex-1 min-w-0"><h4 className="font-black text-slate-700 text-xs truncate uppercase">{item.name}</h4><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{item.role}</p></div><HelpCircle size={18} className="text-slate-200 animate-pulse" /></div>
                      ))}</div></div>
                )}
              </div>
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 rounded-t-[40px] shadow-2xl">
                  <div className="text-left"><p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">Estado General</p><p className="text-lg font-black tracking-widest">{grouped.confirmed.length} / {grouped.confirmed.length + grouped.declined.length + grouped.pending.length}</p></div>
                  <button onClick={() => setShowAttendanceEvent(null)} className="px-8 py-3 bg-white/10 rounded-2xl text-[10px] font-black uppercase border border-white/10 active:scale-95 transition-transform">Entendido</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TOASTS */}
      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[1000] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[28px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : toast.type === 'error' ? 'bg-rose-600 text-white border-rose-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            {toast.type === 'success' ? <CheckCircle size={24}/> : <AlertCircle size={24}/>}
            <span className="text-[11px] font-black uppercase tracking-widest leading-none">{toast.message}</span>
          </div>
        </div>
      )}

      <button onClick={() => navigate('/historial')} className="w-full py-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-brand-600 flex items-center justify-center gap-3 transition-all active:scale-95"><History size={16}/> Ver mi historial completo</button>
    </div>
  );
}