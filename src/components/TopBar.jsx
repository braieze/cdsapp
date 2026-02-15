import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { Bell, X, Calendar, MessageCircle, ChevronRight, Briefcase, ShieldAlert, Sparkles, Megaphone, BookOpen, Clock } from 'lucide-react';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TopBar({ title, subtitle }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState([]); // IDs de notificaciones ya abiertas
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10); // Límite inicial de carga
  const [userRole, setUserRole] = useState('miembro');
  
  const currentUser = auth.currentUser;

  // 1. Cargar IDs leídos desde localStorage al iniciar
  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`readNotifs_${currentUser.uid}`);
      if (saved) setReadIds(JSON.parse(saved));
    }
  }, [currentUser]);

  // 2. Obtener Rol
  useEffect(() => {
    if (!currentUser) return;
    const fetchRole = async () => {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) setUserRole(userSnap.data().role);
    };
    fetchRole();
  }, [currentUser]);

  // 3. Escucha en tiempo real
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribes = [];
    const sources = { posts: [], events: [], assignments: [] };

    const updateAll = () => {
        const combined = [...sources.posts, ...sources.events, ...sources.assignments]
            .sort((a, b) => b.timestamp - a.timestamp);

        setNotifications(combined);
        
        // Contar las que NO están en el array de leídas
        const unread = combined.filter(n => !readIds.includes(n.id)).length;
        setUnreadCount(unread);
    };

    // --- ESCUCHAR POSTS ---
    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20));
    unsubscribes.push(onSnapshot(qPosts, (snap) => {
        sources.posts = snap.docs.map(d => {
            const data = d.data();
            const ts = data.createdAt?.toMillis() || Date.now();
            return {
                id: d.id,
                type: 'post',
                title: data.title || 'Nueva publicación',
                subtitle: data.type,
                timestamp: ts,
                link: '/',
                icon: data.type === 'Devocional' ? BookOpen : Megaphone,
                color: data.type === 'Urgente' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600',
                isUrgent: data.type === 'Urgente'
            };
        });
        updateAll();
    }));

    // --- ESCUCHAR EVENTOS ---
    const qEvents = query(collection(db, 'events'), orderBy('date', 'desc'), limit(20));
    unsubscribes.push(onSnapshot(qEvents, (snap) => {
        const evs = [];
        const asgs = [];
        snap.docs.forEach(d => {
            const data = d.data();
            const eventDate = new Date(data.date + 'T00:00:00');
            const eventTs = eventDate.getTime();

            // 1. Asignación Personal
            const isMyTask = data.assignments && Object.values(data.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
            if (isMyTask && (!data.confirmations || !data.confirmations[currentUser.displayName])) {
                asgs.push({
                    id: `asg-${d.id}`,
                    type: 'assignment',
                    title: 'Servicio Pendiente',
                    subtitle: `${data.title} - Confirmar`,
                    timestamp: eventTs,
                    link: `/calendario/${d.id}`,
                    icon: Briefcase,
                    color: 'bg-amber-100 text-amber-600',
                    isUrgent: true
                });
            }

            // 2. Nuevo Evento
            evs.push({
                id: `ev-${d.id}`,
                type: 'event',
                title: 'Nuevo Evento',
                subtitle: data.title,
                timestamp: eventTs,
                link: `/calendario/${d.id}`,
                icon: Calendar,
                color: 'bg-purple-100 text-purple-600'
            });

            // 3. Alertas Líderes
            if (['pastor', 'lider'].includes(userRole) && data.confirmations) {
                Object.entries(data.confirmations).forEach(([name, status]) => {
                    if (status === 'declined') {
                        asgs.push({
                            id: `declined-${d.id}-${name}`,
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
  }, [currentUser, userRole, readIds]);

  // Función para manejar el clic en una notificación
  const handleNotifClick = (notif) => {
    if (!readIds.includes(notif.id)) {
        const newReadIds = [...readIds, notif.id];
        setReadIds(newReadIds);
        localStorage.setItem(`readNotifs_${currentUser.uid}`, JSON.stringify(newReadIds));
    }
    setIsOpen(false);
    navigate(notif.link);
  };

  // Formateador de fecha profesional
  const formatNotifTime = (ts) => {
    const date = new Date(ts);
    if (isToday(date)) return `Hoy a las ${format(date, 'HH:mm')}`;
    if (isYesterday(date)) return `Ayer a las ${format(date, 'HH:mm')}`;
    return format(date, "d 'de' MMM 'a las' HH:mm", { locale: es });
  };

  // Lógica para agrupar por días
  const renderNotifications = () => {
    const visibleNotifs = notifications.slice(0, displayLimit);
    let lastDate = '';

    return visibleNotifs.map((notif, idx) => {
        const currentDate = format(new Date(notif.timestamp), 'yyyy-MM-dd');
        const showSeparator = currentDate !== lastDate;
        lastDate = currentDate;

        return (
            <div key={notif.id}>
                {showSeparator && (
                    <div className="flex items-center gap-3 my-4 px-2">
                        <div className="h-[1px] flex-1 bg-slate-200"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {isToday(new Date(notif.timestamp)) ? 'Hoy' : 
                             isYesterday(new Date(notif.timestamp)) ? 'Ayer' : 
                             format(new Date(notif.timestamp), 'd MMMM', {locale: es})}
                        </span>
                        <div className="h-[1px] flex-1 bg-slate-200"></div>
                    </div>
                )}
                <div 
                    onClick={() => handleNotifClick(notif)}
                    className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border mb-2 relative ${!readIds.includes(notif.id) ? 'bg-white border-brand-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-70'}`}
                >
                    {/* Puntito rojo de no leído */}
                    {!readIds.includes(notif.id) && (
                        <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full shadow-sm shadow-red-200"></div>
                    )}

                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${notif.color}`}>
                        <notif.icon size={22}/>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-bold truncate ${notif.isUrgent ? 'text-red-700' : 'text-slate-800'}`}>{notif.title}</h4>
                        <p className="text-xs text-slate-600 truncate font-medium">{notif.subtitle}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                            <Clock size={10}/> {formatNotifTime(notif.timestamp)}
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 shrink-0"/>
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
                <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">C</div>
                <span className="text-sm font-bold text-slate-800 tracking-tight">Conquistadores</span>
            </div>
            <p className="text-xs text-slate-500 font-medium ml-8">Hola, {currentUser?.displayName?.split(' ')[0]}</p>
        </div>

        <button onClick={() => setIsOpen(true)} className="relative p-2.5 bg-white rounded-full border border-slate-100 shadow-sm text-slate-600 active:scale-95 transition-all">
            <Bell size={20} />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                    {unreadCount}
                </span>
            )}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
            <div className="bg-white w-full h-[92vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        Notificaciones 
                        {unreadCount > 0 && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-tighter">{unreadCount} nuevas</span>}
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={20} className="text-slate-500"/></button>
                </div>

                <div className="overflow-y-auto p-4 flex-1 bg-slate-50/20">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                            <Sparkles size={48} className="mb-4 opacity-10 text-brand-500"/>
                            <p className="text-sm font-medium">Todo está al día</p>
                        </div>
                    ) : (
                        <>
                            {renderNotifications()}
                            
                            {notifications.length > displayLimit && (
                                <button 
                                    onClick={() => setDisplayLimit(prev => prev + 10)}
                                    className="w-full py-4 mt-2 text-xs font-black text-brand-600 bg-white rounded-2xl border border-brand-100 shadow-sm hover:bg-brand-50 transition-colors"
                                >
                                    MOSTRAR MÁS NOTIFICACIONES
                                </button>
                            )}
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-slate-50 bg-white text-center">
                    <button 
                        onClick={() => {
                            const allIds = notifications.map(n => n.id);
                            setReadIds(allIds);
                            localStorage.setItem(`readNotifs_${currentUser.uid}`, JSON.stringify(allIds));
                        }} 
                        className="text-xs font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest"
                    >
                        Marcar todo como leído
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}