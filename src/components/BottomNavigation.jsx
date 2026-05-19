import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, CalendarDays, Briefcase, LayoutGrid, UserCircle, 
  BookOpen, HandHeart, Plus, Play, Search, User
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function BottomNavigation({ dbUser }) {
  const location = useLocation();
  const path = location.pathname;
  const currentUser = auth.currentUser;

  const [badges, setBadges] = useState({ agenda: 0, servicios: 0, apps: 0, perfil: 0 });

  // DEFINICION DE ROLES SEGUN TU REGLA
  const isPastor = dbUser?.role === 'pastor';
  const isLider = dbUser?.role === 'lider';
  const isServidor = isPastor || isLider; // Staff
  const isMiembro = dbUser?.role === 'miembro';

  // 1. DETECCION PWA
  useEffect(() => {
    const checkUpdate = () => { if (window.swUpdateAvailable) setBadges(prev => ({ ...prev, apps: 1 })); };
    window.addEventListener('swUpdated', checkUpdate);
    checkUpdate();
    return () => window.removeEventListener('swUpdated', checkUpdate);
  }, []);

  // 2. LOGICA DE SERVICIOS Y AGENDA
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

  // 3. EL FILTRO MAESTRO DE NAVEGACION
  const navItems = isMiembro ? [
    // VISTA MIEMBRO (Solo 4 cosas)
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/ofrendar', icon: HandHeart, label: 'Ofrendar' },
    { path: '/estudio', icon: BookOpen, label: 'Series' },
    { path: '/perfil', icon: UserCircle, label: 'Perfil', badge: badges.perfil }
  ] : [
    // VISTA SERVIDOR / PASTOR (Los 5 originales)
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/calendario', icon: CalendarDays, label: 'Agenda', badge: badges.agenda },
    { path: '/servicios', icon: Briefcase, label: 'Servicios', badge: badges.servicios },
    { path: '/apps', icon: LayoutGrid, label: 'Apps', badge: badges.apps },
    { path: '/perfil', icon: UserCircle, label: 'Perfil', badge: badges.perfil }
  ];

  // Dividir items para el layout estilo SocialYo (2 izquierda, boton central, 2 derecha)
  const leftItems = navItems.slice(0, 2);
  const rightItems = navItems.slice(2, 4);
  const centerAction = navItems.length > 4 ? navItems[4] : null;

  return (
    // Contenedor fijo en la parte inferior
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Fondo blanco con sombra superior sutil */}
      <nav className="bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto px-6 py-2">
          <div className="flex items-center justify-between relative">
            
            {/* Items izquierda */}
            <div className="flex items-center gap-8">
              {leftItems.map((item) => {
                const Icon = item.icon;
                const isActive = path === item.path;
                
                return (
                  <Link 
                    key={item.path} 
                    to={item.path} 
                    className="relative flex flex-col items-center py-2 active:scale-90 transition-transform duration-200"
                  >
                    <div className={`relative transition-colors duration-300 ${isActive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                      <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
                      
                      {/* Badge */}
                      {item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border-2 border-white">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Boton central flotante estilo SocialYo */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-6">
              <Link 
                to={centerAction?.path || '/crear'}
                className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-600 active:scale-95 transition-all duration-200"
              >
                <Plus size={28} className="text-white" strokeWidth={2.5} />
              </Link>
            </div>

            {/* Items derecha */}
            <div className="flex items-center gap-8">
              {rightItems.map((item) => {
                const Icon = item.icon;
                const isActive = path === item.path;
                
                return (
                  <Link 
                    key={item.path} 
                    to={item.path} 
                    className="relative flex flex-col items-center py-2 active:scale-90 transition-transform duration-200"
                  >
                    <div className={`relative transition-colors duration-300 ${isActive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                      <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
                      
                      {/* Badge */}
                      {item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border-2 border-white">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

          </div>
        </div>
      </nav>
    </div>
  );
}
