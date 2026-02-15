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

    // Escuchar eventos futuros para calcular alertas en el icono de Servicios
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      const now = new Date();

      snapshot.docs.forEach(doc => {
        const event = doc.data();
        const eventDate = new Date(event.date + 'T00:00:00');
        if (eventDate < now) return; // Ignorar pasados

        // 1. ALERTA PERSONAL: Estoy asignado y NO he confirmado
        const isAssigned = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
        const myStatus = event.confirmations?.[currentUser.displayName];
        
        if (isAssigned && !myStatus) {
          count++;
        }

        // 2. ALERTA DE LÍDER: Alguien rechazó (Solo si soy líder/pastor)
        if (dbUser?.role === 'lider' || dbUser?.role === 'pastor') {
           if (event.confirmations) {
             const declines = Object.values(event.confirmations).filter(status => status === 'declined').length;
             count += declines;
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
    { 
      path: '/servicios', 
      icon: Briefcase, 
      label: 'Mis Servicios',
      badge: servicesAlertCount // Pasamos el contador
    },
    { path: '/apps', icon: LayoutGrid, label: 'Apps' },
    { path: '/perfil', icon: UserCircle, label: 'Perfil' }
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-slate-100 z-50 pb-safe shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)]">
      <div className="max-w-md mx-auto flex justify-between px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = path === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex-1 flex flex-col items-center py-2 pt-3 transition-colors relative group"
            >
              {isActive && (
                <div className="absolute top-0 w-8 h-1 bg-brand-600 rounded-b-full"></div>
              )}
              
              <div className="relative">
                <Icon 
                  size={24} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={`mb-1 transition-all duration-200 ${
                    isActive ? 'text-brand-600 scale-110 -translate-y-0.5' : 'text-slate-400 group-hover:text-brand-500'
                  }`} 
                />
                {/* 🔴 EL GLOBITO ROJO */}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 h-4 min-w-[16px] flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] font-bold tracking-wide ${
                isActive ? 'text-brand-600' : 'text-slate-500 group-hover:text-brand-500'
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