import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

import { 
  HomeIcon as HomeOutline, 
  CalendarDaysIcon as CalendarOutline, 
  ClipboardDocumentCheckIcon as BriefcaseOutline, 
  SquaresPlusIcon as GridOutline, 
  UserCircleIcon as UserOutline, 
  BookOpenIcon as BookOutline, 
  GiftIcon as HeartOutline 
} from '@heroicons/react/24/outline';

import { 
  HomeIcon as HomeSolid, 
  CalendarDaysIcon as CalendarSolid, 
  ClipboardDocumentCheckIcon as BriefcaseSolid, 
  SquaresPlusIcon as GridSolid, 
  UserCircleIcon as UserSolid, 
  BookOpenIcon as BookSolid, 
  GiftIcon as HeartSolid 
} from '@heroicons/react/24/solid';

export default function BottomNavigation({ dbUser }) {
  const location = useLocation();
  const path = location.pathname;
  const currentUser = auth.currentUser;

  const [badges, setBadges] = useState({ agenda: 0, servicios: 0, apps: 0, perfil: 0 });
  const [isVisible, setIsVisible] = useState(true);

  const isPastor = dbUser?.role === 'pastor';
  const isLider = dbUser?.role === 'lider';
  const isStaff = isPastor || isLider; 
  const isMiembro = dbUser?.role === 'miembro';
  const isServidor = !isMiembro; 

  // --- 1. LÓGICA DE MENÚ FLOTANTE (SCROLL Y CLICK) ---
  useEffect(() => {
    let lastScrollY = window.scrollY;

    // Lógica 1: Aparecer/Ocultar con el Scroll
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false); // Ocultar al bajar
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);  // Mostrar al subir
      }
      lastScrollY = currentScrollY;
    };

    // Lógica 2: Aparecer al tocar la pantalla (click o touch)
    const handleInteraction = () => {
      setIsVisible(true);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // --- 2. DETECCIÓN PWA ---
  useEffect(() => {
    const checkUpdate = () => { if (window.swUpdateAvailable) setBadges(prev => ({ ...prev, apps: 1 })); };
    window.addEventListener('swUpdated', checkUpdate);
    checkUpdate();
    return () => window.removeEventListener('swUpdated', checkUpdate);
  }, []);

  // --- 3. LÓGICA DE SERVICIOS Y AGENDA ---
  useEffect(() => {
    if (!currentUser || !dbUser || !isServidor) return;

    const unsubscribes = [];
    const readIds = dbUser.readNotifications || [];
    const lastSeenTeam = dbUser.lastViewedTeam?.toDate() || new Date(0);
    
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));

    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      let pendingTasks = 0;
      let teamIssues = 0;
      let agendaAlerts = 0; 
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      snapshot.docs.forEach(docSnap => {
        const event = docSnap.data();
        const eventId = docSnap.id;
        
        const eventDate = new Date(event.date + 'T00:00:00');
        eventDate.setHours(0, 0, 0, 0);
        
        if (eventDate >= today) {
          
          if (isStaff && event.published === false) agendaAlerts++;
          const isPublished = event.published !== false;
          if (isPublished && !readIds.includes(`ev-${eventId}`) && !readIds.includes(`asg-${eventId}`)) {
            agendaAlerts++;
          }

          const isAssigned = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
          const myStatus = event.confirmations?.[currentUser.displayName];
          if (isAssigned && !myStatus) pendingTasks++;
          
          if (isStaff && event.confirmations) {
            const eventUpdatedAt = event.updatedAt?.toDate() || new Date(0);
            if (eventUpdatedAt > lastSeenTeam) {
              teamIssues += Object.values(event.confirmations).filter(s => s === 'declined').length;
            }
          }
        }
      });
      
      setBadges(prev => ({ ...prev, servicios: pendingTasks + teamIssues, agenda: agendaAlerts }));
    });
    
    unsubscribes.push(unsubEvents);
    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser, dbUser, isServidor, isStaff]);

  // --- 4. BADGE DEL PERFIL INCOMPLETO ---
  useEffect(() => {
    if (!dbUser) return;
    const isIncomplete = !dbUser.photoURL || !dbUser.phone || !dbUser.ministerio ? 1 : 0;
    setBadges(prev => ({ ...prev, perfil: isIncomplete }));
  }, [dbUser]);

  // --- 5. EL FILTRO MAESTRO DE NAVEGACIÓN ---
  const navItems = isMiembro ? [
    { path: '/', outline: HomeOutline, solid: HomeSolid },
    { path: '/ofrendar', outline: HeartOutline, solid: HeartSolid },
    { path: '/estudio', outline: BookOutline, solid: BookSolid },
    { path: '/perfil', outline: UserOutline, solid: UserSolid, badge: badges.perfil }
  ] : [
    { path: '/', outline: HomeOutline, solid: HomeSolid },
    { path: '/calendario', outline: CalendarOutline, solid: CalendarSolid, badge: badges.agenda },
    { path: '/servicios', outline: BriefcaseOutline, solid: BriefcaseSolid, badge: badges.servicios },
    { path: '/apps', outline: GridOutline, solid: GridSolid, badge: badges.apps },
    { path: '/perfil', outline: UserOutline, solid: UserSolid, badge: badges.perfil }
  ];

  return (
    // ✅ REDISEÑO VISUAL: Píldora flotante (rounded-full, mx-4, mb-4, shadow-lg)
    // El padding-bottom safe area asegura que no se pise con la barrita de inicio del iPhone
    <nav className={`fixed bottom-0 left-0 right-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pointer-events-none transform transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : 'translate-y-[150%]'}`}>
      <div className="flex justify-around items-center h-[60px] bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 px-2 pointer-events-auto max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = path === item.path;
          const Icon = isActive ? item.solid : item.outline; 
          
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className="group relative flex items-center justify-center w-full h-full active:scale-95 transition-transform duration-200"
            >
              {/* ✅ FONDO ACTIVO ESTILO FB: Fondo celeste redondeado cuando está seleccionado */}
              <div className={`relative flex items-center justify-center w-12 h-10 rounded-full transition-colors duration-300 ${isActive ? 'bg-blue-50' : 'bg-transparent hover:bg-slate-50'}`}>
                <Icon 
                  className={`w-[24px] h-[24px] transition-colors duration-300 ${isActive ? 'text-blue-600' : 'text-slate-600'}`} 
                />
                
                {item.badge > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full ring-2 ring-white transform translate-x-1/4 -translate-y-1/4 shadow-sm">
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