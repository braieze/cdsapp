import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

// 🚀 NUEVOS ICONOS MÁS CLAROS E INTUITIVOS
import { 
  HomeIcon as HomeOutline, 
  CalendarDaysIcon as CalendarOutline, // Más representativo de una agenda
  ClipboardDocumentCheckIcon as BriefcaseOutline, // Ideal para Tareas/Servicios
  SquaresPlusIcon as GridOutline, // Perfecto para un Hub de Apps
  UserCircleIcon as UserOutline, // Perfil más premium
  BookOpenIcon as BookOutline, 
  GiftIcon as HeartOutline // Mejor representación para Ofrendas
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

  // ✅ CORRECCIÓN DE ROLES (Solución del Bug)
  const isPastor = dbUser?.role === 'pastor';
  const isLider = dbUser?.role === 'lider';
  const isStaff = isPastor || isLider; // Líderes y pastores
  const isMiembro = dbUser?.role === 'miembro';
  const isServidor = !isMiembro; // ¡Cualquiera que no sea miembro es servidor! Esto reactiva el useEffect para todos.

  // 1. DETECCIÓN PWA
  useEffect(() => {
    const checkUpdate = () => { if (window.swUpdateAvailable) setBadges(prev => ({ ...prev, apps: 1 })); };
    window.addEventListener('swUpdated', checkUpdate);
    checkUpdate();
    return () => window.removeEventListener('swUpdated', checkUpdate);
  }, []);

  // 2. LÓGICA DE SERVICIOS Y AGENDA MEJORADA
  useEffect(() => {
    // Si no es servidor, no necesita escuchar estos cambios
    if (!currentUser || !dbUser || !isServidor) return;

    const unsubscribes = [];
    const readIds = dbUser.readNotifications || [];
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));

    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      let pendingTasks = 0;
      let teamIssues = 0;
      let agendaAlerts = 0; 
      
      // ✅ Normalizamos 'hoy' a la medianoche exacta para evitar desfases de horario
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      snapshot.docs.forEach(docSnap => {
        const event = docSnap.data();
        const eventId = docSnap.id;
        
        const eventDate = new Date(event.date + 'T00:00:00');
        eventDate.setHours(0, 0, 0, 0);
        
        // Solo evaluamos eventos de hoy en adelante
        if (eventDate >= today) {
          
          // --- ALERTAS DE AGENDA (Solo para Staff general) ---
          if (isStaff && event.published === false) agendaAlerts++;
          const isPublished = event.published !== false;
          if (isPublished && !readIds.includes(`ev-${eventId}`) && !readIds.includes(`asg-${eventId}`)) {
            agendaAlerts++;
          }

          // --- TAREAS PENDIENTES (Para todos los servidores) ---
          const isAssigned = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
          const myStatus = event.confirmations?.[currentUser.displayName];
          
          // Si está asignado y NO hay status, suma tarea. (Al confirmar, !myStatus se vuelve false y se descuenta el badge instantáneamente).
          if (isAssigned && !myStatus) pendingTasks++;
          
          // --- PROBLEMAS DE EQUIPO (Exclusivo para Staff) ---
          if (isStaff && event.confirmations) {
            teamIssues += Object.values(event.confirmations).filter(s => s === 'declined').length;
          }
        }
      });
      
      // Actualizamos el estado con la suma real
      setBadges(prev => ({ ...prev, servicios: pendingTasks + teamIssues, agenda: agendaAlerts }));
    });
    
    unsubscribes.push(unsubEvents);
    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser, dbUser, isServidor, isStaff]);

  // 3. BADGE DEL PERFIL INCOMPLETO
  useEffect(() => {
    if (!dbUser) return;
    const isIncomplete = !dbUser.photoURL || !dbUser.phone || !dbUser.ministerio ? 1 : 0;
    setBadges(prev => ({ ...prev, perfil: isIncomplete }));
  }, [dbUser]);

  // 4. EL FILTRO MAESTRO DE NAVEGACIÓN
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
    <nav className="w-full bg-white/95 backdrop-blur-2xl border-t border-slate-100/80 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
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