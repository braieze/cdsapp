import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, messaging } from '../firebase'; 
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, where, getDoc } from 'firebase/firestore'; 
import { getToken, deleteToken } from 'firebase/messaging'; 
import { 
  Bell, BellOff, X, Calendar, MessageCircle, ChevronRight, Briefcase, 
  ShieldAlert, Sparkles, Megaphone, BookOpen, Clock, Settings, Loader2, 
  Send, Link as LinkIcon, Activity, Heart, Users, PrayingHand 
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';

const VAPID_KEY = "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk";

export default function TopBar({ title, subtitle }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState([]); 
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isPastorPanelOpen, setIsPastorPanelOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [userRole, setUserRole] = useState('miembro');
  const [loadingAction, setLoadingAction] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const [pushData, setPushData] = useState({ title: '', body: '', link: '' });

  const currentUser = auth.currentUser;
  const isNative = Capacitor.isNativePlatform(); 

  // --- LÓGICA DE SUSCRIPCIÓN (BOTÓN RECUPERADO) ---
  useEffect(() => {
    if (isNative) {
      setIsSupported(true);
      const localFlag = localStorage.getItem('fcm_active');
      setIsSubscribed(localFlag === 'true');
      return;
    }
    if (!('Notification' in window)) { setIsSupported(false); return; }
    const localFlag = localStorage.getItem('fcm_active');
    const browserPerm = Notification.permission;
    setIsSubscribed(browserPerm === 'granted' && localFlag === 'true');
  }, [isOpen, isNative]); 

  const enableNotifications = async () => {
    if (!isSupported) { toast.error("No soportado en este dispositivo"); return; }
    setLoadingAction(true);
    try {
        if (isNative) {
            await OneSignal.Notifications.requestPermission(true);
            if (currentUser?.uid) OneSignal.login(currentUser.uid);
            localStorage.setItem('fcm_active', 'true');
            setIsSubscribed(true);
            toast.success("¡Notificaciones activadas!");
        } else {
            const result = await Notification.requestPermission();
            if (result === 'granted' && messaging) {
                const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                if (token) {
                    await updateDoc(doc(db, 'users', currentUser.uid), { fcmTokens: arrayUnion(token) });
                    localStorage.setItem('fcm_active', 'true');
                    setIsSubscribed(true);
                    toast.success("¡Notificaciones activadas!");
                }
            }
        }
    } catch (error) { toast.error("Error al activar avisos"); } 
    finally { setLoadingAction(false); }
  };

  const disableNotifications = async () => {
    if (!window.confirm("¿Desactivar avisos en este dispositivo?")) return;
    setLoadingAction(true);
    try {
        if (isNative) OneSignal.logout();
        else if (messaging) {
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
                await updateDoc(doc(db, 'users', currentUser.uid), { fcmTokens: arrayRemove(token) });
                await deleteToken(messaging);
            }
        }
        localStorage.removeItem('fcm_active');
        setIsSubscribed(false);
        toast.success("Notificaciones desactivadas.");
    } catch (error) { console.error(error); } 
    finally { setLoadingAction(false); }
  };

  // --- PLANTILLA DE ORACIÓN (Punto 3) ---
  const setPrayerTemplate = () => {
    setPushData({
      title: "🙏 ¡Estamos en Oración!",
      body: "Hacé clic acá para unirte a la oración virtual por Google Meet.",
      link: "https://meet.google.com/your-fixed-link" // Sustituir por el link real
    });
    toast.info("Plantilla de oración cargada");
  };

  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setUserRole(data.role || 'miembro');
            setReadIds(data.readNotifications || []); 
        }
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribes = [];
    const sources = { posts: [], events: [], assignments: [], smart: [] };

    const updateAll = () => {
        const combined = [...sources.posts, ...sources.events, ...sources.assignments, ...sources.smart]
            .sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(combined);
    };

    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(15));
    unsubscribes.push(onSnapshot(qPosts, (snap) => {
        sources.posts = snap.docs.map(d => {
            const data = d.data();
            if (['pastor', 'lider'].includes(userRole) && data.commentsCount >= 5) {
              sources.smart.push({
                id: `smart-comm-${d.id}`,
                type: 'smart',
                title: 'Tendencia en el Muro',
                subtitle: `Más de ${data.commentsCount} personas comentaron: "${data.title}"`,
                timestamp: Date.now(),
                link: `/post/${d.id}`,
                icon: Activity,
                color: 'bg-indigo-100 text-indigo-600',
                isUrgent: true
              });
            }
            return {
                id: d.id,
                type: 'post',
                title: data.title || 'Nueva publicación',
                subtitle: data.type,
                timestamp: data.createdAt?.toMillis() || Date.now(),
                link: `/post/${d.id}`,
                icon: data.type === 'Devocional' ? BookOpen : Megaphone,
                color: data.type === 'Urgente' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600',
                isUrgent: data.type === 'Urgente'
            };
        });
        updateAll();
    }));

    const todayStr = new Date().toISOString().split('T')[0];
    const qEvents = query(collection(db, 'events'), where('date', '>=', todayStr)); 
    
    unsubscribes.push(onSnapshot(qEvents, (snap) => {
        const evs = [];
        const asgs = [];
        snap.docs.forEach(d => {
            const data = d.data();
            if (data.published === false) return; 
            const creationTs = data.createdAt?.toMillis() || new Date(data.date + 'T00:00:00').getTime();
            const isMyTask = data.assignments && Object.values(data.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
            
            if (isMyTask && (!data.confirmations || !data.confirmations[currentUser.displayName])) {
                asgs.push({ id: `asg-${d.id}`, type: 'assignment', title: '¡Te han asignado!', subtitle: `${data.title} - Toca para confirmar`, timestamp: creationTs, link: `/calendario/${d.id}`, icon: Briefcase, color: 'bg-amber-100 text-amber-600', isUrgent: true });
            }
            if (!isMyTask) {
                evs.push({ id: `ev-${d.id}`, type: 'event', title: 'Nuevo Evento', subtitle: data.title, timestamp: creationTs, link: `/calendario/${d.id}`, icon: Calendar, color: 'bg-purple-100 text-purple-600' });
            }
            if (['pastor', 'lider'].includes(userRole) && data.confirmations) {
                const declines = Object.entries(data.confirmations).filter(([_, s]) => s === 'declined');
                if (declines.length > 0) {
                  asgs.push({ id: `dec-group-${d.id}`, type: 'alert', title: 'Bajas en el Equipo', subtitle: `Hay ${declines.length} servidores que no asisten a: ${data.title}`, timestamp: Date.now(), link: `/calendario/${d.id}`, icon: ShieldAlert, color: 'bg-red-50 text-red-500', isUrgent: true });
                }
            }
        });
        sources.events = evs;
        sources.assignments = asgs;
        updateAll();
    }));
    return () => unsubscribes.forEach(u => u());
  }, [currentUser, userRole]);

  useEffect(() => {
      const unread = notifications.filter(n => !readIds.includes(n.id)).length;
      setUnreadCount(unread);
  }, [notifications, readIds]);

  const sendManualPush = async () => {
    if (!pushData.title || !pushData.body) return toast.error("Completa título y mensaje");
    setLoadingAction(true);
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
          included_segments: ["Total Subscriptions"],
          headings: { en: pushData.title, es: pushData.title },
          contents: { en: pushData.body, es: pushData.body },
          data: { url: pushData.link || null },
          large_icon: "https://cdsapp.vercel.app/logo.png",
          priority: 10
        })
      });
      toast.success("¡Notificación enviada!");
      setPushData({ title: '', body: '', link: '' });
      setIsPastorPanelOpen(false);
    } catch (e) { toast.error("Error al enviar"); }
    finally { setLoadingAction(false); }
  };

  const markAllAsRead = async () => {
      const allIds = notifications.map(n => n.id);
      setReadIds(allIds);
      await updateDoc(doc(db, 'users', currentUser.uid), { readNotifications: allIds });
      toast.success("Todo leído");
  };

  const formatNotifTime = (ts) => {
    const date = new Date(ts);
    if (isToday(date)) return `Hoy, ${format(date, 'HH:mm')}`;
    if (isYesterday(date)) return `Ayer, ${format(date, 'HH:mm')}`;
    return format(date, "d MMM, HH:mm", { locale: es });
  };

  return (
    <>
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md px-5 pt-5 pb-3 flex justify-between items-center font-outfit">
        <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200 overflow-hidden border-2 border-white">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-white font-black">C</span>'; }} />
            </div>
            <div className="flex flex-col text-left">
                <span className="text-xl font-black text-slate-900 tracking-tighter leading-none">CDS APP</span>
                <p className="text-[9px] text-brand-600 font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
                  <Activity size={10}/> {userRole}
                </p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          {userRole === 'pastor' && (
            <button onClick={() => setIsPastorPanelOpen(true)} className="p-2.5 bg-brand-50 text-brand-600 rounded-xl active:scale-90 transition-all border border-brand-100">
              <Megaphone size={22} />
            </button>
          )}
          <button onClick={() => setIsOpen(true)} className="relative p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-800 active:scale-90 transition-all">
              <Bell size={22} />
              {unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-lg animate-bounce">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-white animate-fade-in flex flex-col font-outfit">
            <div className="px-6 pt-14 pb-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0">
                <div className="text-left">
                  <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tighter">Notificaciones</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestión de avisos</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 active:scale-75 transition-all"><X size={24}/></button>
            </div>

            {/* 🔥 BOTÓN RECUPERADO: ACTIVAR / DESACTIVAR NOTIS 🔥 */}
            <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100">
                {!isSupported ? (
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl text-[10px] text-center font-black uppercase tracking-widest">Dispositivo no compatible</div>
                ) : isSubscribed ? (
                    <button onClick={disableNotifications} disabled={loadingAction} className={`w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest ${loadingAction ? 'bg-slate-100 text-slate-400' : 'bg-white border border-slate-200 text-slate-500 hover:text-red-500'}`}>
                        {loadingAction ? <Loader2 size={16} className="animate-spin"/> : <BellOff size={16} />} Silenciar notificaciones
                    </button>
                ) : (
                    <button onClick={enableNotifications} disabled={loadingAction} className={`w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest ${loadingAction ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white'}`}>
                        {loadingAction ? <Loader2 size={16} className="animate-spin"/> : <Bell size={16} className="animate-pulse"/>} ACTIVAR NOTIFICACIONES 🔔
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 no-scrollbar">
                {notifications.length === 0 ? (
                    <div className="py-32 text-center flex flex-col items-center opacity-20">
                        <Sparkles size={64} className="mb-4 text-slate-300"/>
                        <p className="text-xs font-black uppercase tracking-[0.3em]">Todo al día</p>
                    </div>
                ) : (
                    notifications.slice(0, displayLimit).map((notif) => (
                        <div key={notif.id} onClick={() => { setIsOpen(false); navigate(notif.link); }} 
                             className={`p-5 rounded-[28px] flex items-start gap-4 transition-all border-2 mb-2 relative ${!readIds.includes(notif.id) ? 'bg-white border-brand-50 shadow-md shadow-brand-100/20' : 'bg-slate-50 border-transparent opacity-60'}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${notif.color}`}><notif.icon size={24}/></div>
                            <div className="flex-1 min-w-0 text-left pt-1">
                                <h4 className={`text-sm font-black uppercase tracking-tight leading-tight ${notif.isUrgent ? 'text-red-600' : 'text-slate-800'}`}>{notif.title}</h4>
                                <p className="text-[11px] text-slate-500 font-semibold mt-1 leading-snug">{notif.subtitle}</p>
                                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest"><Clock size={10}/> {formatNotifTime(notif.timestamp)}</div>
                            </div>
                            {!readIds.includes(notif.id) && <div className="w-2 h-2 bg-brand-500 rounded-full mt-2 shrink-0"></div>}
                        </div>
                    ))
                )}
            </div>

            <div className="p-8 border-t border-slate-50 bg-white flex gap-3 pb-12">
                <button onClick={markAllAsRead} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl">Limpiar todas</button>
                <button onClick={() => setIsOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]">Cerrar</button>
            </div>
        </div>
      )}

      {isPastorPanelOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-5 font-outfit animate-fade-in text-left">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-scale-in flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Lanzar Aviso Push</h3>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1">Llega a toda la iglesia</p>
              </div>
              <button onClick={() => setIsPastorPanelOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
            </div>

            {/* 🔥 BOTÓN MODO ORACIÓN 🔥 */}
            <button 
              onClick={setPrayerTemplate}
              className="w-full flex items-center justify-between p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-indigo-700 active:scale-95 transition-all group"
            >
              <div className="flex items-center gap-3">
                <PrayingHand size={24} className="group-hover:animate-bounce" />
                <span className="text-[11px] font-black uppercase tracking-widest">Activar Modo Oración</span>
              </div>
              <ChevronRight size={18} />
            </button>

            <div className="space-y-4">
              <input 
                placeholder="Título..." 
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-brand-500 transition-all"
                value={pushData.title} onChange={e => setPushData({...pushData, title: e.target.value})}
              />
              <textarea 
                placeholder="Contenido..." 
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-semibold text-sm h-24 resize-none outline-none focus:border-brand-500 transition-all"
                value={pushData.body} onChange={e => setPushData({...pushData, body: e.target.value})}
              />
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2"><LinkIcon size={12}/> Link externo (Opcional)</p>
                <input 
                  placeholder="https://..." 
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[11px] outline-none text-brand-600"
                  value={pushData.link} onChange={e => setPushData({...pushData, link: e.target.value})}
                />
              </div>
            </div>

            <button 
              onClick={sendManualPush} 
              disabled={loadingAction}
              className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingAction ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
              Enviar a la Iglesia
            </button>
          </div>
        </div>
      )}
    </>
  );
}