import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, CalendarDays, Briefcase, LayoutGrid, UserCircle, 
  BookOpen, HandHeart 
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

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
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/ofrendar', icon: HandHeart, label: 'Ofrendar' },
    { path: '/estudio', icon: BookOpen, label: 'Series' },
    { path: '/perfil', icon: UserCircle, label: 'Perfil', badge: badges.perfil }
  ] : [
    // 🛠️ VISTA SERVIDOR / PASTOR (Los 5 originales)
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/calendario', icon: CalendarDays, label: 'Agenda', badge: badges.agenda },
    { path: '/servicios', icon: Briefcase, label: 'Servicios', badge: badges.servicios },
    { path: '/apps', icon: LayoutGrid, label: 'Apps', badge: badges.apps },
    { path: '/perfil', icon: UserCircle, label: 'Perfil', badge: badges.perfil }
  ];

  return (
    // Contenedor invisible que centra la píldora y la mantiene abajo
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      
      {/* Píldora de navegación estilo SocialYo */}
      <nav className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-around h-16 px-2 pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = path === item.path;
          
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className="relative flex flex-col items-center justify-center w-full h-full active:scale-90 transition-transform duration-200"
            >
              <div className={`relative p-1.5 transition-colors duration-300 ${isActive ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                
                {/* Badge rediseñado: Limpio, pequeño y sin rebote */}
                {item.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>
              
              {/* Etiqueta de texto sutil */}
              <span className={`text-[9px] font-semibold tracking-tight mt-0.5 transition-colors duration-300 ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}