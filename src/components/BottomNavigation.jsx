import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Briefcase, LayoutGrid, UserCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function BottomNavigation({ dbUser }) {
  const location = useLocation();
  const path = location.pathname;
  const [servicesAlertCount, setServicesAlertCount] = useState(0);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      const now = new Date();

      snapshot.docs.forEach(doc => {
        const event = doc.data();
        const eventDate = new Date(event.date + 'T00:00:00');
        if (eventDate < now) return;

        const isAssigned = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
        const myStatus = event.confirmations?.[currentUser.displayName];
        
        if (isAssigned && !myStatus) count++;

        if (dbUser?.role === 'lider' || dbUser?.role === 'pastor') {
           if (event.confirmations) {
             count += Object.values(event.confirmations).filter(status => status === 'declined').length;
           }
        }
      });
      setServicesAlertCount(count);
    });
    return () => unsubscribe();
  }, [currentUser, dbUser]);

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/calendario', icon: CalendarDays, label: 'Agenda' },
    { path: '/servicios', icon: Briefcase, label: 'Servicios', badge: servicesAlertCount },
    { path: '/apps', icon: LayoutGrid, label: 'Apps' },
    { path: '/perfil', icon: UserCircle, label: 'Perfil' }
  ];

  return (
    // ✅ CAMBIOS VISUALES: h-24 (más alto), pb-safe/pb-5 (más aire abajo)
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
              {isActive && (
                <div className="absolute -top-5 w-12 h-1.5 bg-brand-600 rounded-b-full shadow-sm"></div>
              )}
              
              <div className="relative p-1.5">
                {/* ✅ ICONOS MÁS GRANDES (30px) */}
                <Icon 
                  size={30} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={`transition-all duration-300 ${
                    isActive ? 'text-brand-600 -translate-y-1 drop-shadow-sm' : 'text-slate-400 group-hover:text-brand-400'
                  }`} 
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold px-1.5 h-5 min-w-[20px] flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* ✅ TEXTO MÁS GRANDE (text-xs grande casi sm) */}
              <span className={`text-[11px] font-bold tracking-wide transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-400'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}