import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, messaging } from '../firebase'; 
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore'; 
import { getToken, deleteToken } from 'firebase/messaging'; 
import { Bell, BellOff, X, Calendar, MessageCircle, ChevronRight, Briefcase, ShieldAlert, Sparkles, Megaphone, BookOpen, Clock, Settings, Loader2 } from 'lucide-react';
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
  const [displayLimit, setDisplayLimit] = useState(10);
  const [userRole, setUserRole] = useState('miembro');
  const [loadingAction, setLoadingAction] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const currentUser = auth.currentUser;
  const isNative = Capacitor.isNativePlatform(); 

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
    const sources = { posts: [], events: [], assignments: [] };

    const updateAll = () => {
        const combined = [...sources.posts, ...sources.events, ...sources.assignments]
            .sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(combined);
    };

    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20));
    unsubscribes.push(onSnapshot(qPosts, (snap) => {
        sources.posts = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                type: 'post',
                title: data.title || 'Nueva publicación',
                subtitle: data.type,
                timestamp: data.createdAt?.toMillis() || Date.now(),
                // ✅ PUNTO #3 CORREGIDO: Ahora el link lleva al post específico
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
                Object.entries(data.confirmations).forEach(([name, status]) => {
                    if (status === 'declined') {
                        asgs.push({ id: `dec-${d.id}-${name}`, type: 'alert', title: 'Baja de Equipo', subtitle: `${name} no asiste a ${data.title}`, timestamp: data.updatedAt?.toMillis() || Date.now(), link: `/calendario/${d.id}`, icon: ShieldAlert, color: 'bg-red-50 text-red-500', isUrgent: true });
                    }
                });
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
      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator && isSubscribed) {
          if (unread > 0) navigator.setAppBadge(unread).catch(() => {});
          else navigator.clearAppBadge().catch(() => {});
      }
  }, [notifications, readIds, isSubscribed]);

  const enableNotifications = async () => {
      if (!isSupported) { toast.error("No soportado en este dispositivo"); return; }
      if (loadingAction) return;
      setLoadingAction(true);
      try {
          if (isNative) {
              await OneSignal.Notifications.requestPermission(true);
              if (currentUser?.uid) { OneSignal.login(currentUser.uid); }
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
      } catch (error) { 
          console.error(error);
          toast.error("Error al activar avisos"); 
      } finally { setLoadingAction(false); }
  };

  const disableNotifications = async () => {
      if (loadingAction) return;
      if (!window.confirm("¿Desactivar avisos en este dispositivo?")) return;
      setLoadingAction(true);
      try {
          if (isNative) { OneSignal.logout(); }
          else if (messaging) {
              const token = await getToken(messaging, { vapidKey: VAPID_KEY });
              if (token) {
                  await updateDoc(doc(db, 'users', currentUser.uid), { fcmTokens: arrayRemove(token) });
                  await deleteToken(messaging);
              }
          }
      } catch (error) { console.error(error); } finally {
          localStorage.removeItem('fcm_active');
          setIsSubscribed(false); 
          setLoadingAction(false);
          toast.success("Notificaciones desactivadas.");
      }
  };

  const handleNotifClick = async (notif) => {
    if (!readIds.includes(notif.id)) {
        setReadIds(prev => [...prev, notif.id]);
        try { await updateDoc(doc(db, 'users', currentUser.uid), { readNotifications: arrayUnion(notif.id) }); } catch (e) {}
    }
    setIsOpen(false);
    // ✅ PUNTO #3: Ahora navegará a /post/ID o /calendario/ID correctamente
    navigate(notif.link);
  };

  const markAllAsRead = async () => {
      const allIds = notifications.map(n => n.id);
      setReadIds(allIds);
      setIsOpen(false);
      await updateDoc(doc(db, 'users', currentUser.uid), { readNotifications: allIds });
      toast.success("Todo leído");
  };

  const formatNotifTime = (ts) => {
    const date = new Date(ts);
    if (isToday(date)) return `Hoy, ${format(date, 'HH:mm')}`;
    if (isYesterday(date)) return `Ayer, ${format(date, 'HH:mm')}`;
    return format(date, "d MMM, HH:mm", { locale: es });
  };

  const renderNotifications = () => {
    const visibleNotifs = notifications.slice(0, displayLimit);
    let lastDate = '';
    return visibleNotifs.map((notif) => {
        const currentDate = format(new Date(notif.timestamp), 'yyyy-MM-dd');
        const showSeparator = currentDate !== lastDate;
        lastDate = currentDate;
        return (
            <div key={notif.id}>
                {showSeparator && (
                    <div className="flex items-center gap-3 my-4 px-2">
                        <div className="h-[1px] flex-1 bg-slate-200"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {isToday(new Date(notif.timestamp)) ? 'Hoy' : isYesterday(new Date(notif.timestamp)) ? 'Ayer' : format(new Date(notif.timestamp), 'd MMMM', {locale: es})}
                        </span>
                        <div className="h-[1px] flex-1 bg-slate-200"></div>
                    </div>
                )}
                <div onClick={() => handleNotifClick(notif)} className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border mb-2 relative ${!readIds.includes(notif.id) ? 'bg-white border-brand-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-70'}`}>
                    {!readIds.includes(notif.id) && <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></div>}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${notif.color}`}><notif.icon size={20}/></div>
                    <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-black truncate ${notif.isUrgent ? 'text-red-700' : 'text-slate-800'}`}>{notif.title}</h4>
                        <p className="text-xs text-slate-500 truncate font-bold">{notif.subtitle}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-bold"><Clock size={10}/> {formatNotifTime(notif.timestamp)}</div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 shrink-0"/>
                </div>
            </div>
        );
    });
  };

  return (
    <>
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-2 flex justify-between items-center">
        <div className="flex items-center gap-3">
            {/* ✅ PUNTO #4: ICONO Y NOMBRE PERSONALIZADOS */}
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-100 overflow-hidden">
                {/* Cambia '/logo-conquistadores.png' por la ruta real de tu imagen */}
                <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-white font-bold">C</span>'; }}
                />
            </div>
            <div className="flex flex-col">
                <span className="text-lg font-black text-slate-800 tracking-tight leading-none">CD SAPP</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Hola, {currentUser?.displayName?.split(' ')[0]}</p>
            </div>
        </div>
        <button onClick={() => setIsOpen(true)} className="relative p-2.5 bg-white rounded-full border border-slate-100 shadow-sm text-slate-600 active:scale-90 transition-all">
            <Bell size={24} />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md">{unreadCount}</span>}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
            <div className="bg-white w-full h-[92vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-t-[40px] sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="px-6 py-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-black text-xl text-slate-800">Notificaciones</h3>
                    <button onClick={() => setIsOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
                </div>

                <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100">
                    {!isSupported ? (
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl text-[10px] text-center font-black uppercase tracking-widest">Dispositivo no compatible</div>
                    ) : isSubscribed ? (
                        <button onClick={disableNotifications} disabled={loadingAction} className={`w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest ${loadingAction ? 'bg-slate-100 text-slate-400' : 'bg-white border border-slate-200 text-slate-500 hover:text-red-500'}`}>
                            {loadingAction ? <Loader2 size={16} className="animate-spin"/> : <BellOff size={16} />} Silenciar avisos
                        </button>
                    ) : (
                        <button onClick={enableNotifications} disabled={loadingAction} className={`w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest ${loadingAction ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white'}`}>
                            {loadingAction ? <Loader2 size={16} className="animate-spin"/> : <Bell size={16} className="animate-pulse"/>} ACTIVAR NOTIFICACIONES 🔔
                        </button>
                    )}
                </div>

                <div className="overflow-y-auto p-4 flex-1 bg-white">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center">
                            <Sparkles size={48} className="mb-4 opacity-10 text-brand-500"/>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin novedades por ahora</p>
                        </div>
                    ) : (
                        <>
                            {renderNotifications()}
                            {notifications.length > displayLimit && (
                                <button onClick={() => setDisplayLimit(prev => prev + 10)} className="w-full py-4 text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] opacity-60">Cargar más</button>
                            )}
                        </>
                    )}
                </div>
                <div className="p-6 border-t border-slate-50 bg-slate-50/30 text-center">
                    <button onClick={markAllAsRead} className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Limpiar todas</button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}