import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Bell, X, Calendar, MessageCircle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TopBar({ title, subtitle }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    setUserData({
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
    });

    const unsubscribes = [];

    // 1. Posts (Noticias)
    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(5));
    unsubscribes.push(onSnapshot(qPosts, (snap) => {
        const posts = snap.docs.map(d => ({
            id: d.id,
            type: 'post',
            title: d.data().title || 'Nueva publicación',
            subtitle: 'Noticias',
            date: d.data().createdAt?.toDate(),
            link: '/', // Lleva al feed (Home)
            icon: MessageCircle,
            color: 'bg-blue-100 text-blue-600'
        }));
        updateNotifications(posts, 'posts');
    }));

    // 2. Asignaciones (Eventos donde me citaron)
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));
    unsubscribes.push(onSnapshot(qEvents, (snap) => {
        const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const myAssignments = events
            .filter(e => {
                const isFuture = new Date(e.date + 'T00:00:00') >= new Date();
                const isAssigned = e.assignments && Object.values(e.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
                // Solo mostramos si NO he confirmado/rechazado aún (Pendiente)
                const isPending = !e.confirmations || !e.confirmations[currentUser.displayName];
                return isFuture && isAssigned && isPending;
            })
            .map(e => ({
                id: e.id,
                type: 'assignment',
                title: `Te asignaron: ${e.title}`,
                subtitle: 'Confirmación pendiente',
                date: new Date(e.date + 'T00:00:00'),
                link: `/calendario/${e.id}`, // ✅ LINK CORREGIDO: Lleva al detalle del evento
                icon: Calendar,
                color: 'bg-amber-100 text-amber-600',
                isUrgent: true
            }));
            
        updateNotifications(myAssignments, 'assignments');
    }));

    return () => unsubscribes.forEach(u => u());
  }, [currentUser]);

  const [rawSource, setRawSource] = useState({ posts: [], assignments: [] });
  
  const updateNotifications = (newData, source) => {
      setRawSource(prev => {
          const updated = { ...prev, [source]: newData };
          // Combinar y ordenar por fecha (más reciente primero)
          const combined = [...updated.posts, ...updated.assignments].sort((a, b) => b.date - a.date);
          setNotifications(combined);
          
          // Contamos solo las asignaciones pendientes como "no leídas" prioritarias + posts nuevos
          const urgents = updated.assignments.length; 
          setUnreadCount(urgents + (updated.posts.length > 0 ? 1 : 0)); 
          
          return updated;
      });
  };

  return (
    <>
      {/* HEADER FIJO */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-2 flex justify-between items-center transition-all">
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

        <button onClick={() => setIsOpen(true)} className="relative p-2.5 bg-white rounded-full border border-slate-100 shadow-sm text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
            <Bell size={20} />
            {unreadCount > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white animate-bounce">{unreadCount}</span>}
        </button>
      </div>

      {/* MODAL DE NOTIFICACIONES (Estilo Bottom Sheet Grande) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
            
            {/* Contenedor del Modal */}
            <div className="bg-white w-full h-[92vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
                
                {/* Cabecera del Modal */}
                <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        Notificaciones 
                        {unreadCount > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{unreadCount} nuevas</span>}
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={20} className="text-slate-500"/></button>
                </div>

                {/* Lista de Notificaciones */}
                <div className="overflow-y-auto p-4 flex-1">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                            <Bell size={48} className="mb-4 opacity-10"/>
                            <p className="text-sm font-medium">Estás al día.</p>
                            <p className="text-xs mt-1">No hay notificaciones nuevas.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {notifications.map((notif, idx) => (
                                <div 
                                    key={`${notif.type}-${notif.id}-${idx}`} 
                                    onClick={() => {
                                        setIsOpen(false); // Cierra modal
                                        navigate(notif.link); // Navega al destino
                                    }}
                                    className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border ${notif.isUrgent ? 'bg-amber-50/50 border-amber-100' : 'bg-white border-slate-50 hover:border-slate-200 hover:shadow-sm'}`}
                                >
                                    {/* Icono */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notif.color}`}>
                                        <notif.icon size={18}/>
                                    </div>
                                    
                                    {/* Texto */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <h4 className={`text-sm font-bold truncate ${notif.isUrgent ? 'text-amber-900' : 'text-slate-800'}`}>{notif.title}</h4>
                                            {notif.isUrgent && <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 ml-2 mt-1.5"></div>}
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{notif.subtitle || format(notif.date, "d 'de' MMMM", {locale: es})}</p>
                                    </div>
                                    
                                    <ChevronRight size={16} className="text-slate-300 shrink-0"/>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pie del Modal */}
                <div className="p-4 border-t border-slate-50 bg-slate-50/30 text-center">
                    <button onClick={() => setUnreadCount(0)} className="text-xs font-bold text-brand-600 hover:text-brand-700 uppercase tracking-wide">
                        Marcar todo como leído
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}