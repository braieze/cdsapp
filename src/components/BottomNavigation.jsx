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
  const [isVisible, setIsVisible] = useState(true); // ✅ ESTADO PARA MENÚ FLOTANTE

  const isPastor = dbUser?.role === 'pastor';
  const isLider = dbUser?.role === 'lider';
  const isStaff = isPastor || isLider; 
  const isMiembro = dbUser?.role === 'miembro';
  const isServidor = !isMiembro; 

  // --- 1. LÓGICA DE MENÚ FLOTANTE (ESTILO INSTAGRAM/FACEBOOK) ---
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Si bajamos más de 50px, ocultamos el menú. Si subimos, lo mostramos.
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- 2. DETECCIÓN PWA ---
  useEffect(() => {
    const checkUpdate = () => { if (window.swUpdateAvailable) setBadges(prev => ({ ...prev, apps: 1 })); };
    window.addEventListener('swUpdated', checkUpdate);
    checkUpdate();
    return () => window.removeEventListener('swUpdated', checkUpdate);
  }, []);

  // --- 3. LÓGICA DE SERVICIOS Y AGENDA (BUG DE BADGES RESUELTO) ---
  useEffect(() => {
    if (!currentUser || !dbUser || !isServidor) return;

    const unsubscribes = [];
    const readIds = dbUser.readNotifications || [];
    
    // Extraemos la fecha de la última vez que el líder vio el panel
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
          
          // Alertas de Agenda
          if (isStaff && event.published === false) agendaAlerts++;
          const isPublished = event.published !== false;
          if (isPublished && !readIds.includes(`ev-${eventId}`) && !readIds.includes(`asg-${eventId}`)) {
            agendaAlerts++;
          }

          // Tareas Pendientes
          const isAssigned = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
          const myStatus = event.confirmations?.[currentUser.displayName];
          if (isAssigned && !myStatus) pendingTasks++;
          
          // Problemas de Equipo (✅ AQUÍ ESTABA EL BUG: Faltaba validar la fecha de última vista)
          if (isStaff && event.confirmations) {
            const eventUpdatedAt = event.updatedAt?.toDate() || new Date(0);
            
            // Solo sumamos el badge si la baja ocurrió DESPUÉS de la última vez que el líder vio el panel
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
    // ✅ CLASES CLAVE AÑADIDAS: fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300
    // Si isVisible es false, aplicamos translate-y-full para ocultarlo hacia abajo
    <nav className={`fixed bottom-0 left-0 right-0 z-50 w-full bg-white/95 backdrop-blur-2xl border-t border-slate-100/80 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.04)] transform transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="flex justify-around items-center h-[76px] px-4">
        {navItems.map((item) => {
          const isActive = path === item.path;
          const Icon = isActive ? item.solid : item.outline; 
          
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className="group relative flex flex-col items-center justify-center w-full h-full active:scale-[0.88] transition-transform duration-200 ease-out"
            >
              <div className="relative flex items-center justify-center p-2 rounded-2xl group-hover:bg-slate-50 transition-colors">
                <Icon 
                  className={`w-[26px] h-[26px] transition-colors duration-300 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} 
                />
                
                {item.badge > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-rose-500 text-white text-[10px] font-black h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full ring-[2.5px] ring-white shadow-sm transform translate-x-1/4 -translate-y-1/4">
                    {item.badge}
                  </span>
                )}
              </div>
              
              <span className={`absolute bottom-2 w-1.5 h-1.5 rounded-full bg-blue-600 transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}></span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}