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
    // 🛠️ FIX: Quitamos 'fixed' y 'left/right' porque el MainLayout ya controla la posición.
    // Damos un fondo blanco puro con desenfoque y una sombra superior muy sutil.
    <nav className="w-full bg-white/95 backdrop-blur-2xl border-t border-slate-100/80 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
      {/* Aumentamos la altura a 76px para dar más "aire" y confort nativo */}
      <div className="flex justify-around items-center h-[76px] px-4">
        {navItems.map((item) => {
          const isActive = path === item.path;
          const Icon = isActive ? item.solid : item.outline; 
          
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              // Convertimos toda la columna en un área táctil gigante para los pulgares
              className="group relative flex flex-col items-center justify-center w-full h-full active:scale-[0.88] transition-transform duration-200 ease-out"
            >
              {/* Contenedor del ícono para manejar la animación de color y los badges */}
              <div className="relative flex items-center justify-center p-2 rounded-2xl group-hover:bg-slate-50 transition-colors">
                <Icon 
                  // Tamaño constante, colores suaves si está inactivo, vibrantes si está activo
                  className={`w-[26px] h-[26px] transition-colors duration-300 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} 
                />
                
                {/* Badge NATIVO: Más pequeño, con borde grueso blanco para que "muerda" el ícono */}
                {item.badge > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-rose-500 text-white text-[10px] font-black h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full ring-[2.5px] ring-white shadow-sm transform translate-x-1/4 -translate-y-1/4">
                    {item.badge}
                  </span>
                )}
              </div>
              
              {/* MICRO-INTERACCIÓN: El punto azul que marca la pestaña activa (Estilo iOS) */}
              <span 
                className={`absolute bottom-2 w-1.5 h-1.5 rounded-full bg-blue-600 transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
              ></span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}