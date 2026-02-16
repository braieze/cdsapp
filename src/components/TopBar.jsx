import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, messaging } from '../firebase'; // ✅ IMPORTANTE: Agregamos messaging
import { collection, query, orderBy, limit, onSnapshot, getDoc, doc, updateDoc, arrayUnion, where } from 'firebase/firestore';
import { getToken } from 'firebase/messaging'; // ✅ IMPORTANTE: Importamos getToken
import { Bell, X, Calendar, MessageCircle, ChevronRight, Briefcase, ShieldAlert, Sparkles, Megaphone, BookOpen, Clock, Settings } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

// ⚠️ TU CLAVE VAPID (La misma que pusiste en App.jsx)
const VAPID_KEY = "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk";

export default function TopBar({ title, subtitle }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState([]); 
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [userRole, setUserRole] = useState('miembro');
  const [permission, setPermission] = useState(Notification.permission); 
  
  const currentUser = auth.currentUser;

  // 1. Obtener Datos y LEÍDOS
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

  // 2. Generar Notificaciones
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribes = [];
    const sources = { posts: [], events: [], assignments: [] };

    const updateAll = () => {
        const combined = [...sources.posts, ...sources.events, ...sources.assignments]
            .sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(combined);
    };

    // A. POSTS
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
                link: '/',
                icon: data.type === 'Devocional' ? BookOpen : Megaphone,
                color: data.type === 'Urgente' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600',
                isUrgent: data.type === 'Urgente'
            };
        });
        updateAll();
    }));

    // B. EVENTOS
    const todayStr = new Date().toISOString().split('T')[0];
    const qEvents = query(collection(db, 'events'), where('date', '>=', todayStr), orderBy('date', 'asc')); 
    unsubscribes.push(onSnapshot(qEvents, (snap) => {
        const evs = [];
        const asgs = [];
        snap.docs.forEach(d => {
            const data = d.data();
            const eventTs = new Date(data.date + 'T00:00:00').getTime();
            const isMyTask = data.assignments && Object.values(data.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
            
            if (isMyTask && (!data.confirmations || !data.confirmations[currentUser.displayName])) {
                asgs.push({
                    id: `asg-${d.id}`,
                    type: 'assignment',
                    title: '¡Te han asignado!',
                    subtitle: `${data.title} - Toca para confirmar`,
                    timestamp: eventTs,
                    link: `/calendario/${d.id}`,
                    icon: Briefcase,
                    color: 'bg-amber-100 text-amber-600',
                    isUrgent: true
                });
            }
            if (!isMyTask) {
                evs.push({
                    id: `ev-${d.id}`,
                    type: 'event',
                    title: 'Evento Próximo',
                    subtitle: data.title,
                    timestamp: eventTs,
                    link: `/calendario/${d.id}`,
                    icon: Calendar,
                    color: 'bg-purple-100 text-purple-600'
                });
            }
            if (['pastor', 'lider'].includes(userRole) && data.confirmations) {
                Object.entries(data.confirmations).forEach(([name, status]) => {
                    if (status === 'declined') {
                        asgs.push({
                            id: `dec-${d.id}-${name}`,
                            type: 'alert',
                            title: 'Baja de Equipo',
                            subtitle: `${name} no asiste a ${data.title}`,
                            timestamp: Date.now(),
                            link: `/calendario/${d.id}`,
                            icon: ShieldAlert,
                            color: 'bg-red-50 text-red-500',
                            isUrgent: true
                        });
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

  // 3. BADGE DEL CELULAR
  useEffect(() => {
      const unread = notifications.filter(n => !readIds.includes(n.id)).length;
      setUnreadCount(unread);
      if ('setAppBadge' in navigator && permission === 'granted') {
          if (unread > 0) navigator.setAppBadge(unread).catch(() => {});
          else navigator.clearAppBadge().catch(() => {});
      }
  }, [notifications, readIds, permission]);

  // 🔥 4. FUNCIÓN POTENTE: PIDE PERMISO + GUARDA TOKEN EN BD
  const activateNotifications = async () => {
      if (!('Notification' in window)) {
          alert("Tu dispositivo no soporta notificaciones.");
          return;
      }
      
      try {
          // A. Pedir Permiso al Sistema Operativo
          const result = await Notification.requestPermission();
          setPermission(result);
          
          if (result === 'granted') {
              console.log("Permiso concedido. Generando token...");
              
              // B. Actualizar Badge visualmente
              if ('setAppBadge' in navigator && unreadCount > 0) {
                  navigator.setAppBadge(unreadCount);
              }

              // C. Generar Token de Firebase (El "número de teléfono" del celular)
              const token = await getToken(messaging, { vapidKey: VAPID_KEY });
              
              if (token) {
                  console.log("Token generado:", token);
                  // D. Guardar en la Base de Datos
                  const userRef = doc(db, 'users', currentUser.uid);
                  await updateDoc(userRef, {
                      fcmTokens: arrayUnion(token)
                  });
                  alert("¡Listo! Notificaciones activadas y conectadas.");
              } else {
                  console.log("No se pudo generar el token.");
              }
          }
      } catch (error) {
          console.error("Error activando notificaciones:", error);
          // Si falla por falta de HTTPS o entorno local, avisar
          if (window.location.hostname !== 'localhost' && window.location.protocol !== 'https:') {
             alert("Las notificaciones requieren HTTPS.");
          }
      }
  };

  // --- HANDLERS ---
  const handleNotifClick = async (notif) => {
    if (!readIds.includes(notif.id)) {
        setReadIds(prev => [...prev, notif.id]);
        try { await updateDoc(doc(db, 'users', currentUser.uid), { readNotifications: arrayUnion(notif.id) }); } catch (e) {}
    }
    setIsOpen(false);
    navigate(notif.link);
  };

  const markAllAsRead = async () => {
      const allIds = notifications.map(n => n.id);
      setReadIds(allIds);
      setIsOpen(false);
      await updateDoc(doc(db, 'users', currentUser.uid), { readNotifications: allIds });
      if ('clearAppBadge' in navigator) navigator.clearAppBadge();
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
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            {isToday(new Date(notif.timestamp)) ? 'Hoy' : isYesterday(new Date(notif.timestamp)) ? 'Ayer' : format(new Date(notif.timestamp), 'd MMMM', {locale: es})}
                        </span>
                        <div className="h-[1px] flex-1 bg-slate-200"></div>
                    </div>
                )}
                <div onClick={() => handleNotifClick(notif)} className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border mb-2 relative ${!readIds.includes(notif.id) ? 'bg-white border-brand-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-70'}`}>
                    {!readIds.includes(notif.id) && <div className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full shadow-sm shadow-red-200 ring-2 ring-white"></div>}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${notif.color}`}><notif.icon size={24}/></div>
                    <div className="flex-1 min-w-0">
                        <h4 className={`text-base font-bold truncate ${notif.isUrgent ? 'text-red-700' : 'text-slate-800'}`}>{notif.title}</h4>
                        <p className="text-sm text-slate-600 truncate font-medium">{notif.subtitle}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1"><Clock size={12}/> {formatNotifTime(notif.timestamp)}</div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 shrink-0"/>
                </div>
            </div>
        );
    });
  };

  return (
    <>
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-2 flex justify-between items-center">
        <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-base">C</div>
                <span className="text-lg font-black text-slate-800 tracking-tight">Conquistadores</span>
            </div>
            <p className="text-sm text-slate-500 font-medium ml-10">Hola, {currentUser?.displayName?.split(' ')[0]}</p>
        </div>
        <button onClick={() => setIsOpen(true)} className="relative p-3 bg-white rounded-full border border-slate-100 shadow-sm text-slate-600 active:scale-95 transition-all">
            <Bell size={26} />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[22px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">{unreadCount}</span>}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
            <div className="bg-white w-full h-[92vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-5 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                        Notificaciones {unreadCount > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-bold">{unreadCount} nuevas</span>}
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={24} className="text-slate-500"/></button>
                </div>

                {/* 🔥 BOTÓN DE ACTIVACIÓN MANUAL */}
                {permission !== 'granted' && (
                    <div className="px-4 pt-4 pb-2">
                        <button onClick={activateNotifications} className="w-full bg-slate-900 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                            <Bell size={18} className="fill-white animate-pulse"/>
                            <span className="text-sm font-bold">Activar globo en icono 🔴</span>
                        </button>
                        <p className="text-[10px] text-center text-slate-400 mt-2 px-2">Toca aquí y dale a "Permitir" para que funcione.</p>
                    </div>
                )}

                <div className="overflow-y-auto p-4 flex-1 bg-slate-50/20">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                            <Sparkles size={60} className="mb-4 opacity-20 text-brand-500"/>
                            <p className="text-lg font-bold">Todo está tranquilo</p>
                            <p className="text-sm mt-1">No tienes notificaciones pendientes.</p>
                        </div>
                    ) : (
                        <>
                            {renderNotifications()}
                            {notifications.length > displayLimit && (
                                <button onClick={() => setDisplayLimit(prev => prev + 10)} className="w-full py-4 mt-4 text-sm font-black text-brand-600 bg-white rounded-2xl border border-brand-100 shadow-sm hover:bg-brand-50 transition-colors">
                                    MOSTRAR MÁS NOTIFICACIONES
                                </button>
                            )}
                        </>
                    )}
                </div>
                <div className="p-5 border-t border-slate-50 bg-white text-center">
                    <button onClick={markAllAsRead} className="text-sm font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest">Marcar todo como leído</button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}