import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

// 🚀 IMPORTAMOS HEROICONS (OUTLINE = Inactivo, SOLID = Activo)
import { 
  HomeIcon as HomeOutline, CalendarIcon as CalendarOutline, BriefcaseIcon as BriefcaseOutline, 
  Squares2X2Icon as GridOutline, UserIcon as UserOutline, BookOpenIcon as BookOutline, HeartIcon as HeartOutline 
} from '@heroicons/react/24/outline';

import { 
  HomeIcon as HomeSolid, CalendarIcon as CalendarSolid, BriefcaseIcon as BriefcaseSolid, 
  Squares2X2Icon as GridSolid, UserIcon as UserSolid, BookOpenIcon as BookSolid, HeartIcon as HeartSolid 
} from '@heroicons/react/24/solid';

export default function BottomNavigation({ dbUser }) {
  const location = useLocation();
  const path = location.pathname;
  const currentUser = auth.currentUser;

  const [badges, setBadges] = useState({ agenda: 0, servicios: 0, apps: 0, perfil: 0 });

  // ✅ DEFINICIÓN DE ROLES SEGÚN TU REGLA
  const isPastor = dbUser?.role === 'pastor';
  const isLider = dbUser?.role === 'lider';
  const isServidor = isPastor || isLider; // Staff
  const isMiembro = dbUser?.role === 'miembro';

  // 1. DETECCIÓN PWA
  useEffect(() => {
    const checkUpdate = () => { if (window.swUpdateAvailable) setBadges(prev => ({ ...prev, apps: 1 })); };
    window.addEventListener('swUpdated', checkUpdate);
    checkUpdate();
    return () => window.removeEventListener('swUpdated', checkUpdate);
  }, []);

  // 2. LÓGICA DE SERVICIOS Y AGENDA
  useEffect(() => {
    if (!currentUser || !dbUser || !isServidor) return;

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
          if (isServidor && event.published === false) agendaAlerts++;
          const isPublished = event.published !== false;
          if (isPublished && !readIds.includes(`ev-${eventId}`) && !readIds.includes(`asg-${eventId}`)) agendaAlerts++;
        }

        if (eventDate >= now) {
          const isAssigned = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
          const myStatus = event.confirmations?.[currentUser.displayName];
          if (isAssigned && !myStatus) pendingTasks++;
          if (isServidor && event.confirmations) {
            teamIssues += Object.values(event.confirmations).filter(s => s === 'declined').length;
          }
        }
      });
      
      setBadges(prev => ({ ...prev, servicios: pendingTasks + teamIssues, agenda: agendaAlerts }));
    });
    unsubscribes.push(unsubEvents);

    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser, dbUser, isServidor]);

  useEffect(() => {
    if (!dbUser) return;
    const isIncomplete = !dbUser.photoURL || !dbUser.phone || !dbUser.ministerio ? 1 : 0;
    setBadges(prev => ({ ...prev, perfil: isIncomplete }));
  }, [dbUser]);

  // 3. 🎯 EL FILTRO MAESTRO DE NAVEGACIÓN
  const navItems = isMiembro ? [
    // 🏠 VISTA MIEMBRO (Solo 4 cosas)
    { path: '/', outline: HomeOutline, solid: HomeSolid },
    { path: '/ofrendar', outline: HeartOutline, solid: HeartSolid },
    { path: '/estudio', outline: BookOutline, solid: BookSolid },
    { path: '/perfil', outline: UserOutline, solid: UserSolid, badge: badges.perfil }
  ] : [
    // 🛠️ VISTA SERVIDOR / PASTOR (Los 5 originales)
    { path: '/', outline: HomeOutline, solid: HomeSolid },
    { path: '/calendario', outline: CalendarOutline, solid: CalendarSolid, badge: badges.agenda },
    { path: '/servicios', outline: BriefcaseOutline, solid: BriefcaseSolid, badge: badges.servicios },
    { path: '/apps', outline: GridOutline, solid: GridSolid, badge: badges.apps },
    { path: '/perfil', outline: UserOutline, solid: UserSolid, badge: badges.perfil }
  ];

  return (
    // DISEÑO SOCIALYO: Fondo blanco sólido, anclado al fondo, punta a punta.
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-100 z-50 h-[80px]">
      <div className="max-w-md mx-auto flex justify-around items-center h-full px-4 pb-2">
        {navItems.map((item) => {
          const isActive = path === item.path;
          const Icon = isActive ? item.solid : item.outline; // Alterna entre relleno y línea
          
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className="flex items-center justify-center w-14 h-14 active:scale-90 transition-transform duration-200"
            >
              <div className="relative flex items-center justify-center">
                <Icon 
                  className={`transition-all duration-300 ${isActive ? 'w-8 h-8 text-slate-900' : 'w-7 h-7 text-slate-400'}`} 
                />
                
                {/* Badge rediseñado: Limpio, pequeño y sin rebote */}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}