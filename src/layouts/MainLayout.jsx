import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Briefcase, LayoutGrid, UserCircle, QrCode, LogOut, ShieldCheck } from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function MainLayout() {
  const location = useLocation();
  const path = location.pathname;
  
  const user = auth.currentUser;
  const [dbUser, setDbUser] = useState(null); // Aquí guardaremos tu Ficha de Firestore

  // Este efecto busca tu rol en la base de datos apenas entras
  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setDbUser(userSnap.data());
        }
      }
    };
    fetchUserRole();
  }, [user]);

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/calendario', icon: CalendarDays, label: 'Agenda' },
    { path: '/servicios', icon: Briefcase, label: 'Mis Servicios' },
    { path: '/apps', icon: LayoutGrid, label: 'Apps' },
    { path: '/perfil', icon: UserCircle, label: 'Perfil' }
  ];

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-20 font-outfit text-slate-800">
      
      {/* Cabecera Superior (Fija) */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-slate-100">
        <div className="max-w-md mx-auto px-4 h-16 flex justify-between items-center">
          
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-lg leading-none">C</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 leading-none">Conquistadores</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">
                  Hola, {user?.displayName?.split(' ')[0]}
                </span>
                {/* 🔥 LA INSIGNIA DE PODER 🔥 */}
                {(dbUser?.role === 'pastor' || dbUser?.role === 'admin') && (
                  <span className="bg-brand-100 text-brand-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest flex items-center gap-0.5 border border-brand-200 shadow-sm animate-fade-in">
                    <ShieldCheck size={10} strokeWidth={3} /> Pastor
                  </span>
                )}
              </div>
            </div>
          </Link>
          
          <div className="flex items-center gap-3">
            <button className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors">
              <QrCode size={22} strokeWidth={2} />
            </button>
            
            <div className="relative group cursor-pointer" onClick={handleLogout}>
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Perfil" 
                  className={`w-9 h-9 rounded-full object-cover border-2 shadow-sm transition-colors ${dbUser?.role === 'pastor' ? 'border-brand-500' : 'border-slate-200'}`}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold shadow-sm border border-brand-200">
                  {user?.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <div className="absolute right-0 top-12 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap flex items-center gap-2">
                <LogOut size={12} /> Cerrar Sesión
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto animate-fade-in relative bg-slate-50">
        <Outlet context={{ dbUser }} /> {/* Pasamos el usuario a todas las pantallas */}
      </main>

      {/* Navegación Inferior */}
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
    </div>
  );
}