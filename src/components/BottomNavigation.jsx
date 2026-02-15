import { Link, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Briefcase, LayoutGrid, UserCircle } from 'lucide-react';

export default function BottomNavigation() {
  const location = useLocation();
  const path = location.pathname;

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/calendario', icon: CalendarDays, label: 'Agenda' },
    { path: '/servicios', icon: Briefcase, label: 'Mis Servicios' },
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
              <Icon 
                size={24} 
                strokeWidth={isActive ? 2.5 : 2} 
                className={`mb-1 transition-all duration-200 ${
                  isActive ? 'text-brand-600 scale-110 -translate-y-0.5' : 'text-slate-400 group-hover:text-brand-500'
                }`} 
              />
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