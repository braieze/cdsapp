import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { Bell, X, Calendar, MessageCircle, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TopBar({ title, subtitle }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState(null);

  const currentUser = auth.currentUser;

  // 1. Cargar Usuario y Notificaciones
  useEffect(() => {
    if (!currentUser) return;

    // A. Leer datos básicos para el saludo
    // (Opcional: podrías traer esto de un contexto global para optimizar)
    setUserData({
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
    });

    // B. ESCUCHAR NOTIFICACIONES (Posts + Asignaciones)
    const unsubscribes = [];

    // --- 1. Últimos Posts (Noticias/Devocionales) ---
    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(5));
    unsubscribes.push(onSnapshot(qPosts, (snap) => {
        const posts = snap.docs.map(d => ({
            id: d.id,
            type: 'post',
            title: d.data().title,
            date: d.data().createdAt?.toDate(),
            link: '/inicio', // O a donde corresponda
            icon: MessageCircle,
            color: 'bg-blue-100 text-blue-600'
        }));
        updateNotifications(posts, 'posts');
    }));

    // --- 2. Mis Asignaciones Futuras ---
    // Nota: Firestore tiene limites en queries compuestas, traemos eventos futuros y filtramos en cliente
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));
    unsubscribes.push(onSnapshot(qEvents, (snap) => {
        const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const myAssignments = events
            .filter(e => {
                // Es futuro y estoy asignado
                const isFuture = new Date(e.date + 'T00:00:00') >= new Date();
                const isAssigned = e.assignments && Object.values(e.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
                // Y NO he respondido aún (Pendiente)
                const isPending = !e.confirmations || !e.confirmations[currentUser.displayName];
                return isFuture && isAssigned && isPending;
            })
            .map(e => ({
                id: e.id,
                type: 'assignment',
                title: `Te asignaron: ${e.title}`,
                subtitle: 'Confirmación pendiente',
                date: new Date(e.date + 'T00:00:00'),
                link: '/mis-servicios',
                icon: Calendar,
                color: 'bg-amber-100 text-amber-600',
                isUrgent: true
            }));
            
        updateNotifications(myAssignments, 'assignments');
    }));

    return () => unsubscribes.forEach(u => u());
  }, [currentUser]);

  // Función para mezclar notificaciones de distintas fuentes
  const [rawSource, setRawSource] = useState({ posts: [], assignments: [] });
  
  const updateNotifications = (newData, source) => {
      setRawSource(prev => {
          const updated = { ...prev, [source]: newData };
          // Combinar y ordenar por fecha
          const combined = [...updated.posts, ...updated.assignments].sort((a, b) => b.date - a.date);
          setNotifications(combined);
          
          // Calcular "No leídos" (Lógica simple: Todo lo urgente cuenta)
          // En una app real, guardarías "lastReadTime" en local storage
          const urgents = updated.assignments.length; 
          // Simulamos que los posts nuevos también suman si son muy recientes
          setUnreadCount(urgents + (updated.posts.length > 0 ? 1 : 0)); 
          
          return updated;
      });
  };

  return (
    <>
      {/* --- BARRA SUPERIOR --- */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-2 flex justify-between items-center transition-all">
        
        {/* Izquierda: Saludo o Título de Página */}
        <div>
            {title ? (
                <h1 className="text-xl font-black text-slate-800">{title}</h1>
            ) : (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">C</div>
                        <span className="text-sm font-bold text-slate-800 tracking-tight">Conquistadores</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium ml-8">Hola, {userData?.displayName?.split(' ')[0]}</p>
                </div>
            )}
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>

        {/* Derecha: Notificaciones (Reemplaza foto/QR) */}
        <button 
            onClick={() => setIsOpen(true)}
            className="relative p-2.5 bg-white rounded-full border border-slate-100 shadow-sm text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
        >
            <Bell size={20} />
            {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white animate-bounce">
                    {unreadCount}
                </span>
            )}
        </button>
      </div>

      {/* --- MODAL DE NOTIFICACIONES (Centrado) --- */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header Modal */}
                <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        Notificaciones 
                        {unreadCount > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{unreadCount} nuevas</span>}
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 bg-slate-50 rounded-full hover:bg-slate-100"><X size={18} className="text-slate-400"/></button>
                </div>

                {/* Lista */}
                <div className="overflow-y-auto p-2">
                    {notifications.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                            <Bell size={32} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-sm">Estás al día.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {notifications.map((notif, idx) => (
                                <div 
                                    key={`${notif.type}-${notif.id}-${idx}`} 
                                    onClick={() => {
                                        setIsOpen(false);
                                        navigate(notif.link);
                                    }}
                                    className={`p-3 rounded-2xl flex items-start gap-3 cursor-pointer transition-colors ${notif.isUrgent ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'hover:bg-slate-50'}`}
                                >
                                    <div className={`mt-1 min-w-[32px] h-8 rounded-full flex items-center justify-center ${notif.color}`}>
                                        <notif.icon size={14}/>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-sm font-bold leading-tight ${notif.isUrgent ? 'text-amber-900' : 'text-slate-700'}`}>{notif.title}</h4>
                                            {notif.isUrgent && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{notif.subtitle || format(notif.date, "d 'de' MMMM", {locale: es})}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 mt-2"/>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="p-3 border-t border-slate-50 bg-slate-50/50 text-center">
                    <button onClick={() => setUnreadCount(0)} className="text-xs font-bold text-brand-600 hover:text-brand-700">
                        Marcar todo como leído
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}