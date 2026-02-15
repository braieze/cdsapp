import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Bell, X, Calendar, MessageCircle, ChevronRight, Briefcase, ShieldAlert, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TopBar({ title, subtitle }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState('miembro');
  
  const currentUser = auth.currentUser;

  // 1. Obtener Rol del Usuario (para saber si es Líder/Pastor)
  useEffect(() => {
    if (!currentUser) return;
    const fetchRole = async () => {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) setUserRole(userSnap.data().role);
    };
    fetchRole();
  }, [currentUser]);

  // 2. ESCUCHAR TODO (Posts + Eventos + Asignaciones)
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribes = [];

    // --- A. NOTICIAS Y DEVOCIONALES ---
    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(3));
    unsubscribes.push(onSnapshot(qPosts, (snap) => {
        const posts = snap.docs.map(d => ({
            id: d.id,
            source: 'post',
            title: d.data().title || 'Nueva publicación',
            subtitle: d.data().type || 'Noticia',
            date: d.data().createdAt?.toDate() || new Date(),
            link: '/', // Lleva al Home
            icon: MessageCircle,
            color: 'bg-blue-100 text-blue-600',
            isUrgent: d.data().type === 'Urgente'
        }));
        updateNotifications(prev => mergeAndSort(prev, posts, 'post'));
    }));

    // --- B. EVENTOS (Asignaciones, Creaciones y Alertas de Liderazgo) ---
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc')); // Traemos futuros
    unsubscribes.push(onSnapshot(qEvents, (snap) => {
        const now = new Date();
        const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const generatedNotifs = [];

        events.forEach(event => {
            const eventDate = new Date(event.date + 'T00:00:00');
            if (eventDate < now) return; // Ignorar pasados

            // 1. ASIGNACIÓN PERSONAL (Me toca servir)
            const isAssignedToMe = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
            const myConfirmation = event.confirmations?.[currentUser.displayName];

            if (isAssignedToMe && !myConfirmation) {
                generatedNotifs.push({
                    id: `assign-${event.id}`,
                    source: 'assignment',
                    title: 'Tienes una asignación',
                    subtitle: `${event.title} - Requiere confirmar`,
                    date: eventDate, // Ordenar por fecha del evento (urgencia)
                    link: `/calendario/${event.id}`, // ✅ Lleva al evento
                    icon: Briefcase,
                    color: 'bg-amber-100 text-amber-600',
                    isUrgent: true
                });
            }

            // 2. ALERTA DE LIDERAZGO (Alguien rechazó)
            // Solo si soy Pastor o Líder
            if (['pastor', 'lider'].includes(userRole)) {
                if (event.confirmations) {
                    const declines = Object.entries(event.confirmations).filter(([_, status]) => status === 'declined');
                    declines.forEach(([name, _]) => {
                        generatedNotifs.push({
                            id: `decline-${event.id}-${name}`,
                            source: 'alert',
                            title: 'Baja en el equipo',
                            subtitle: `${name} no podrá estar en ${event.title}`,
                            date: new Date(), // Fecha actual (alerta reciente)
                            link: `/calendario/${event.id}`, // ✅ Lleva al evento para gestionar
                            icon: ShieldAlert,
                            color: 'bg-red-100 text-red-600',
                            isUrgent: true
                        });
                    });
                }
            }

            // 3. NUEVO EVENTO CREADO (General)
            // Lógica simple: Si el evento fue creado hace menos de 3 días (requiere campo createdAt en evento, si no, usamos la fecha del evento como recordatorio)
            // Por ahora, mostraremos "Próximo Evento" si no estoy asignado
            if (!isAssignedToMe) {
                 generatedNotifs.push({
                    id: `new-${event.id}`,
                    source: 'event',
                    title: 'Nuevo Evento',
                    subtitle: event.title,
                    date: eventDate,
                    link: `/calendario/${event.id}`, // ✅ Lleva al evento
                    icon: Calendar,
                    color: 'bg-purple-100 text-purple-600',
                    isUrgent: false
                });
            }
        });

        updateNotifications(prev => mergeAndSort(prev, generatedNotifs, 'calendar'));
    }));

    return () => unsubscribes.forEach(u => u());
  }, [currentUser, userRole]);

  // Helper para mezclar fuentes sin duplicados y ordenar
  const [sources, setSources] = useState({});
  
  const mergeAndSort = (prevNotifications, newData, sourceType) => {
      // 1. Actualizamos la fuente específica en el estado local (hack para manejar múltiples listeners)
      setSources(prev => {
          const newSources = { ...prev, [sourceType]: newData };
          
          // 2. Aplanamos todo en un solo array
          const all = Object.values(newSources).flat();
          
          // 3. Ordenamos: Urgentes primero, luego por fecha más reciente
          const sorted = all.sort((a, b) => {
              if (a.isUrgent && !b.isUrgent) return -1;
              if (!a.isUrgent && b.isUrgent) return 1;
              return b.date - a.date;
          });

          // 4. Actualizamos el estado principal y el contador
          setNotifications(sorted);
          setUnreadCount(sorted.length); // Podríamos filtrar solo los no vistos si tuviéramos persistencia
          return sorted; // No usamos esto, pero React pide devolver algo en setStates funcionales complejos
      });
      return newData; // Dummy return
  };

  return (
    <>
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
                    <p className="text-xs text-slate-500 font-medium ml-8">Hola, {currentUser?.displayName?.split(' ')[0]}</p>
                </div>
            )}
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>

        <button onClick={() => setIsOpen(true)} className="relative p-2.5 bg-white rounded-full border border-slate-100 shadow-sm text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
            <Bell size={20} />
            {unreadCount > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white animate-bounce">{unreadCount}</span>}
        </button>
      </div>

      {/* --- MODAL DE NOTIFICACIONES (Bottom Sheet) --- */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
            <div className="bg-white w-full h-[92vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        Notificaciones 
                        {unreadCount > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{unreadCount} nuevas</span>}
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={20} className="text-slate-500"/></button>
                </div>

                <div className="overflow-y-auto p-4 flex-1">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                            <Sparkles size={48} className="mb-4 opacity-20 text-brand-500"/>
                            <p className="text-sm font-medium">Todo está tranquilo.</p>
                            <p className="text-xs mt-1">No tienes notificaciones pendientes.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {notifications.map((notif, idx) => (
                                <div 
                                    key={`${notif.id}-${idx}`} 
                                    onClick={() => {
                                        setIsOpen(false);
                                        navigate(notif.link);
                                    }}
                                    className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border relative ${notif.isUrgent ? 'bg-amber-50/50 border-amber-100' : 'bg-white border-slate-50 hover:border-slate-200 hover:shadow-sm'}`}
                                >
                                    {notif.isUrgent && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                                    
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${notif.color}`}>
                                        <notif.icon size={20}/>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-sm font-bold truncate ${notif.isUrgent ? 'text-amber-900' : 'text-slate-800'}`}>{notif.title}</h4>
                                        <p className="text-xs text-slate-600 truncate font-medium">{notif.subtitle}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 capitalize">{format(notif.date, "EEEE d 'de' MMMM", {locale: es})}</p>
                                    </div>
                                    
                                    <ChevronRight size={16} className="text-slate-300 shrink-0"/>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

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