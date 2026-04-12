import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, CalendarDays, Briefcase, LayoutGrid, UserCircle, 
  BookOpen, HandHeart // ✅ Iconos para la vista de Miembro
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

  // 1. DETECCIÓN PWA (Mantenida)
  useEffect(() => {
    const checkUpdate = () => { if (window.swUpdateAvailable) setBadges(prev => ({ ...prev, apps: 1 })); };
    window.addEventListener('swUpdated', checkUpdate);
    checkUpdate();
    return () => window.removeEventListener('swUpdated', checkUpdate);
  }, []);

  // 2. LÓGICA DE SERVICIOS Y AGENDA (Mantenida e intacta)
  useEffect(() => {
    if (!currentUser || !dbUser || !isServidor) return; // Solo el staff procesa badges de servicio

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
  // Definimos qué ve cada uno según tu esquema exacto
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
    <nav className="fixed bottom-0 w-full bg-white border-t border-slate-100 z-50 h-24 pb-6 shadow-[0_-4px_30px_-10px_rgba(0,0,0,0.1)] flex items-center">
      <div className="max-w-md mx-auto flex justify-between w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = path === item.path;
          return (
            <Link key={item.path} to={item.path} className="flex-1 flex flex-col items-center justify-center transition-transform active:scale-95 relative group">
              {isActive && <div className="absolute -top-5 w-10 h-1.5 bg-brand-600 rounded-b-full shadow-sm"></div>}
              <div className="relative p-1.5">
                <Icon size={28} strokeWidth={isActive ? 2.5 : 2} className={`transition-all duration-300 ${isActive ? 'text-brand-600 -translate-y-1' : 'text-slate-400'}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black px-1.5 h-5 min-w-[20px] flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-md">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}