import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { Bell, X, Calendar, MessageCircle, ChevronRight, Briefcase, ShieldAlert, Sparkles, Megaphone, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TopBar({ title, subtitle }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState('miembro');
  
  const currentUser = auth.currentUser;

  // 1. Obtener Rol
  useEffect(() => {
    if (!currentUser) return;
    const fetchRole = async () => {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) setUserRole(userSnap.data().role);
    };
    fetchRole();
  }, [currentUser]);

  // 2. ESCUCHA EN TIEMPO REAL
  useEffect(() => {
    if (!currentUser) return;

    // Recuperamos la última vez que el usuario limpió las notificaciones
    const lastSeen = localStorage.getItem(`lastSeenNotifs_${currentUser.uid}`) || 0;

    const unsubscribes = [];
    const sources = { posts: [], events: [], assignments: [] };

    const updateAll = () => {
        // Combinar todas las fuentes
        const combined = [...sources.posts, ...sources.events, ...sources.assignments]
            .sort((a, b) => b.timestamp - a.timestamp); // Ordenar por lo más nuevo arriba

        setNotifications(combined);

        // Contar cuántas son posteriores a "lastSeen"
        const unread = combined.filter(n => n.timestamp > lastSeen).length;
        setUnreadCount(unread);
    };

    // --- ESCUCHAR POSTS ---
    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(10));
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
                link: '/', // Los posts se ven en el Home
                icon: data.type === 'Devocional' ? BookOpen : Megaphone,
                color: data.type === 'Urgente' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600',
                isUrgent: data.type === 'Urgente'
            };
        });
        updateAll();
    }));

    // --- ESCUCHAR EVENTOS Y ASIGNACIONES ---
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));
    unsubscribes.push(onSnapshot(qEvents, (snap) => {
        const evs = [];
        const asgs = [];
        const nowTs = Date.now();

        snap.docs.forEach(d => {
            const data = d.data();
            const eventDate = new Date(data.date + 'T00:00:00');
            const eventTs = eventDate.getTime();

            if (eventTs < nowTs - 86400000) return; // Ignorar eventos de hace más de un día

            // 1. Notificación de Asignación Personal
            const isMyTask = data.assignments && Object.values(data.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
            if (isMyTask && (!data.confirmations || !data.confirmations[currentUser.displayName])) {
                asgs.push({
                    id: `asg-${d.id}`,
                    type: 'assignment',
                    title: 'Tienes un servicio pendiente',
                    subtitle: `${data.title} - Confirmar asistencia`,
                    timestamp: eventTs,
                    link: `/calendario/${d.id}`,
                    icon: Briefcase,
                    color: 'bg-amber-100 text-amber-600',
                    isUrgent: true
                });
            }

            // 2. Notificación de Nuevo Evento General
            evs.push({
                id: `ev-${d.id}`,
                type: 'event',
                title: 'Evento en agenda',
                subtitle: data.title,
                timestamp: eventTs,
                link: `/calendario/${d.id}`,
                icon: Calendar,
                color: 'bg-purple-100 text-purple-600'
            });

            // 3. Alertas para Líderes (Bajas)
            if (['pastor', 'lider'].includes(userRole) && data.confirmations) {
                Object.entries(data.confirmations).forEach(([name, status]) => {
                    if (status === 'declined') {
                        asgs.push({
                            id: `declined-${d.id}-${name}`,
                            type: 'alert',
                            title: 'Baja en el equipo',
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

  // Función para marcar como leído
  const markAsRead = () => {
    const now = Date.now();
    localStorage.setItem(`lastSeenNotifs_${currentUser.uid}`, now);
    setUnreadCount(0);
    setIsOpen(false);
  };

  return (
    <>
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-2 flex justify-between items-center">
        <div>
            {title ? (
                <h1 className="text-xl font-black text-slate-800">{title}</h1>
            ) : (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">C</div>
                        <span className="text-sm font-bold text-slate-800 tracking-tight">Conquistadores</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium ml-8">Hola, {currentUser?.displayName?.split(' ')[0]}</p>
                </div>
            )}
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>

        <button onClick={() => setIsOpen(true)} className="relative p-2.5 bg-white rounded-full border border-slate-100 shadow-sm text-slate-600 active:scale-95 transition-all">
            <Bell size={20} />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                    {unreadCount}
                </span>
            )}
        </button>
      </div>

      {/* MODAL BOTTOM SHEET */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={markAsRead}>
            <div className="bg-white w-full h-[92vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        Notificaciones 
                        {unreadCount > 0 && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-tighter">{unreadCount} nuevas</span>}
                    </h3>
                    <button onClick={markAsRead} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={20} className="text-slate-500"/></button>
                </div>

                <div className="overflow-y-auto p-4 flex-1 bg-slate-50/30">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                            <Sparkles size={48} className="mb-4 opacity-10 text-brand-500"/>
                            <p className="text-sm font-medium">Todo está al día</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notifications.map((notif, idx) => (
                                <div 
                                    key={notif.id} 
                                    onClick={() => {
                                        markAsRead();
                                        navigate(notif.link);
                                    }}
                                    className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border shadow-sm ${notif.isUrgent ? 'bg-white border-red-100' : 'bg-white border-slate-100'}`}
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${notif.color}`}>
                                        <notif.icon size={22}/>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-sm font-bold truncate ${notif.isUrgent ? 'text-red-700' : 'text-slate-800'}`}>{notif.title}</h4>
                                        <p className="text-xs text-slate-500 truncate font-medium">{notif.subtitle}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 capitalize">
                                            {format(notif.timestamp, "EEEE d 'de' MMMM", {locale: es})}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300 shrink-0"/>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-50 bg-white text-center">
                    <button onClick={markAsRead} className="text-xs font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest">
                        Marcar todo como leído
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}