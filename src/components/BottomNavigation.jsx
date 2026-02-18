import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Briefcase, LayoutGrid, UserCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function BottomNavigation({ dbUser }) {
  const location = useLocation();
  const path = location.pathname;
  const currentUser = auth.currentUser;

  // Estados para los globitos
  const [badges, setBadges] = useState({
    agenda: 0,
    servicios: 0,
    apps: 0,
    perfil: 0
  });

  // ✅ 1. DETECCIÓN DE ACTUALIZACIÓN DE APP (PWA)
  useEffect(() => {
    const checkUpdate = () => {
      if (window.swUpdateAvailable) {
        setBadges(prev => ({ ...prev, apps: 1 }));
      }
    };

    window.addEventListener('swUpdated', checkUpdate);
    checkUpdate(); // Verificar al montar

    return () => window.removeEventListener('swUpdated', checkUpdate);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribes = [];

    // --- 2. LÓGICA DE SERVICIOS Y AGENDA ---
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      let pendingTasks = 0;
      let teamIssues = 0;
      let agendaAlerts = 0; 
      const now = new Date();
      const readIds = dbUser?.readNotifications || [];

      snapshot.docs.forEach(docSnap => {
        const event = docSnap.data();
        const eventId = docSnap.id;
        const eventDate = new Date(event.date + 'T00:00:00');
        
        // 📅 LÓGICA DE AGENDA EXIGENTE (Punto solicitado)
        if (eventDate >= now) {
          // A. Líderes: Borradores
          if ((dbUser?.role === 'pastor' || dbUser?.role === 'lider') && event.published === false) {
            agendaAlerts++;
          }

          // B. Servidores: No abiertos
          const isPublished = event.published !== false;
          const hasNotReadEv = !readIds.includes(`ev-${eventId}`);
          const hasNotReadAsg = !readIds.includes(`asg-${eventId}`);
          
          if (isPublished && (hasNotReadEv && hasNotReadAsg)) {
            agendaAlerts++;
          }
        }

        // 💼 LÓGICA DE SERVICIOS
        if (eventDate >= now) {
          const isAssigned = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
          const myStatus = event.confirmations?.[currentUser.displayName];
          
          if (isAssigned && !myStatus) pendingTasks++;
          
          if ((dbUser?.role === 'lider' || dbUser?.role === 'pastor') && event.confirmations) {
            teamIssues += Object.values(event.confirmations).filter(s => s === 'declined').length;
          }

          // 💬 CHATS SIN LEER
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

    // --- 3. LÓGICA DE PERFIL (Datos faltantes) ---
    if (dbUser) {
      const isIncomplete = !dbUser.photoURL || !dbUser.phone || !dbUser.ministerio ? 1 : 0;
      setBadges(prev => ({ ...prev, perfil: isIncomplete }));
    }

    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser, dbUser]);

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/calendario', icon: CalendarDays, label: 'Agenda', badge: badges.agenda },
    { path: '/servicios', icon: Briefcase, label: 'Servicios', badge: badges.servicios },
    { path: '/apps', icon: LayoutGrid, label: 'Apps', badge: badges.apps },
    { path: '/perfil', icon: UserCircle, label: 'Perfil', badge: badges.perfil }
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-slate-100 z-50 h-24 pb-6 shadow-[0_-4px_30px_-10px_rgba(0,0,0,0.1)] flex items-center">
      <div className="max-w-md mx-auto flex justify-between w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = path === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex-1 flex flex-col items-center justify-center transition-transform active:scale-95 relative group"
            >
              {isActive && <div className="absolute -top-5 w-12 h-1.5 bg-brand-600 rounded-b-full shadow-sm"></div>}
              
              <div className="relative p-1.5">
                <Icon 
                  size={30} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={`transition-all duration-300 ${isActive ? 'text-brand-600 -translate-y-1' : 'text-slate-400'}`} 
                />
                {/* 🔴 GLOBITO ROJO ANIMADO */}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black px-1.5 h-5 min-w-[20px] flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-md">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-bold tracking-wide ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}