import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
// ✅ Añadimos 'Heart' a las importaciones
import { Home, CalendarDays, Briefcase, LayoutGrid, UserCircle, Heart } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function BottomNavigation({ dbUser }) {
  const location = useLocation();
  const path = location.pathname;
  const currentUser = auth.currentUser;

  const [badges, setBadges] = useState({ agenda: 0, servicios: 0, apps: 0, perfil: 0 });

  // 1. DETECCIÓN PWA (Se mantiene igual)
  useEffect(() => {
    const checkUpdate = () => { if (window.swUpdateAvailable) setBadges(prev => ({ ...prev, apps: 1 })); };
    window.addEventListener('swUpdated', checkUpdate);
    checkUpdate();
    return () => window.removeEventListener('swUpdated', checkUpdate);
  }, []);

  // 2. LÓGICA DE SERVICIOS Y AGENDA (Se mantiene igual)
  useEffect(() => {
    if (!currentUser || !dbUser) return;

    const unsubscribes = [];
    const readIds = dbUser.readNotifications || [];

    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      let pendingTasks = 0;
      let teamIssues = 0;
      let agendaAlerts = 0; 
      const now = new Date();

      snapshot.docs.forEach(docSnap => {
        const event = docSnap.data();
        const eventId = docSnap.id;
        const eventDate = new Date(event.date + 'T00:00:00');
        
        if (eventDate >= now) {
          if ((dbUser.role === 'pastor' || dbUser.role === 'lider') && event.published === false) {
            agendaAlerts++;
          }
          const isPublished = event.published !== false;
          if (isPublished && !readIds.includes(`ev-${eventId}`) && !readIds.includes(`asg-${eventId}`)) {
            agendaAlerts++;
          }
        }

        if (eventDate >= now) {
          const isAssigned = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
          const myStatus = event.confirmations?.[currentUser.displayName];
          
          if (isAssigned && !myStatus) pendingTasks++;
          if ((dbUser.role === 'lider' || dbUser.role === 'pastor') && event.confirmations) {
            teamIssues += Object.values(event.confirmations).filter(s => s === 'declined').length;
          }

          if (isAssigned) {
            const unsubChat = onSnapshot(collection(db, `events/${eventId}/notes`), (chatSnap) => {
              const unreadMsg = chatSnap.docs.filter(d => !d.data().readBy?.includes(currentUser.uid)).length;
              setBadges(prev => ({ 
                ...prev, 
                servicios: pendingTasks + teamIssues + unreadMsg 
              }));
            });
            unsubscribes.push(unsubChat);
          }
        }
      });
      
      setBadges(prev => ({ 
        ...prev, 
        servicios: pendingTasks + teamIssues,
        agenda: agendaAlerts 
      }));
    });
    unsubscribes.push(unsubEvents);

    const isIncomplete = !dbUser.photoURL || !dbUser.phone || !dbUser.ministerio ? 1 : 0;
    setBadges(prev => ({ ...prev, perfil: isIncomplete }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser, dbUser]);

  // 🚀 ACTUALIZAMOS navItems con Ofrendar
  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/calendario', icon: CalendarDays, label: 'Agenda', badge: badges.agenda },
    { path: '/servicios', icon: Briefcase, label: 'Servicios', badge: badges.servicios },
    { path: '/ofrendar', icon: Heart, label: 'Ofrendar' }, // 🔥 NUEVA SECCIÓN
    { path: '/apps', icon: LayoutGrid, label: 'Apps', badge: badges.apps },
    { path: '/perfil', icon: UserCircle, label: 'Perfil', badge: badges.perfil }
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-slate-100 z-50 h-24 pb-6 shadow-[0_-4px_30px_-10px_rgba(0,0,0,0.1)] flex items-center">
      <div className="max-w-md mx-auto flex justify-between w-full px-1"> {/* Bajamos el px-2 a px-1 para ganar espacio */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = path === item.path;
          return (
            <Link key={item.path} to={item.path} className="flex-1 flex flex-col items-center justify-center transition-transform active:scale-95 relative group">
              {isActive && <div className="absolute -top-5 w-10 h-1 bg-brand-600 rounded-b-full shadow-sm"></div>}
              <div className="relative p-1">
                {/* Bajamos el size de 30 a 26 para que entren bien los 6 items */}
                <Icon size={26} strokeWidth={isActive ? 2.5 : 2} className={`transition-all duration-300 ${isActive ? 'text-brand-600 -translate-y-1' : 'text-slate-400'}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.2 h-4.5 min-w-[18px] flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-md">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-bold tracking-tight ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}