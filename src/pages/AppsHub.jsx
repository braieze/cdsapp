import { useState, useEffect } from 'react'; 
import { 
  Users, Heart, History, GraduationCap, Video, 
  Calendar, RefreshCw, Music, HeartHandshake,
  Wallet, ShieldCheck, Settings
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';

export default function AppsHub() {
  const { dbUser } = useOutletContext();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener('swUpdated', handleUpdate);
    if (window.swUpdateAvailable) setUpdateAvailable(true);
    return () => window.removeEventListener('swUpdated', handleUpdate);
  }, []);

  const handleRefresh = () => {
    setUpdateAvailable(false);
    window.location.reload(true);
  };

  // ✅ DEFINICIÓN DE APPS CON SEGMENTACIÓN ESTRICTA (Punto 2 y 3)
  const allApps = [
    // 📅 Agenda: Solo para el Staff (Pastores y Líderes/Servidores)
    { id: 'calendario', name: 'Agenda', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', path: '/calendario', roles: ['pastor', 'lider'] },
    
    // 👥 Directorio: Solo para el Staff
    { id: 'directorio', name: 'Directorio', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', path: '/directorio', roles: ['pastor', 'lider'] },
    
    // 💝 Ofrendar: Para todos
    { id: 'ofrendar_user', name: 'Ofrendar', icon: HeartHandshake, color: 'text-brand-600', bg: 'bg-brand-50', path: '/ofrendar', roles: ['todos'] },
    
    // 🔐 Tesorería: Solo Pastor y área específica
    { id: 'tesoreria_admin', name: 'Tesorería', icon: Wallet, color: 'text-slate-900', bg: 'bg-slate-200', path: '/tesoreria', roles: ['pastor', 'tesorero'] },
    
    // 📜 Historial: Solo para el Staff
    { id: 'historial', name: 'Historial', icon: History, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/historial', roles: ['pastor', 'lider'] },
    
    // 🔄 Actualizar: Para todos
    { 
      id: 'refresh', 
      name: updateAvailable ? '¡Nueva Versión!' : 'Actualizar', 
      icon: RefreshCw, 
      color: updateAvailable ? 'text-white' : 'text-slate-600', 
      bg: updateAvailable ? 'bg-red-500' : 'bg-slate-100', 
      isAction: true,
      hasBadge: updateAvailable,
      roles: ['todos']
    },

    // 🎓 Academia: Para todos
    { id: 'classroom', name: 'Series', icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/estudio', roles: ['todos'] },

    // 🎵 Cancionero: Solo Pastor o Área Alabanza
    { id: 'alabanza', name: 'Cancionero', icon: Music, color: 'text-pink-600', bg: 'bg-pink-50', path: '#', roles: ['pastor', 'alabanza'] },
    
    // 🎬 Multimedia: Solo Pastor o Área Multimedia
    { id: 'multimedia', name: 'Multimedia', icon: Video, color: 'text-cyan-600', bg: 'bg-cyan-50', path: '#', roles: ['pastor', 'multimedia'] },
  ];

  // 🕵️‍♂️ FILTRADO LÓGICO MEJORADO
  const visibleApps = allApps.filter(app => {
    const userRole = dbUser?.role?.toLowerCase();
    const userArea = dbUser?.area?.toLowerCase();

    return (
      app.roles.includes('todos') || 
      app.roles.includes(userRole) ||
      app.roles.includes(userArea)
    );
  });

  return (
    <div className="pb-32 pt-4 px-4 animate-fade-in bg-slate-50 min-h-screen font-outfit text-left">
      <div className="mb-8 flex justify-between items-end px-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Aplicaciones</h2>
          <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mt-1 font-black">Panel de Control</p>
        </div>
        <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 font-black uppercase mb-1">Acceso: {dbUser?.area || dbUser?.role || 'Miembro'}</span>
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">v1.3.0</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-10 gap-x-4">
        {visibleApps.map((app) => {
          const InnerContent = () => (
            <>
              <div className={`w-16 h-16 rounded-[22px] ${app.bg} flex items-center justify-center mb-3 shadow-sm border-2 border-white group-hover:shadow-md transition-all group-hover:-translate-y-1 relative`}>
                <app.icon className={`${app.color} transition-transform group-hover:scale-110 ${app.id === 'refresh' && updateAvailable ? 'animate-spin' : ''}`} size={28} strokeWidth={2.5} />
                {app.hasBadge && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-black text-center leading-tight px-1 uppercase tracking-tight ${app.hasBadge ? 'text-red-600 animate-pulse' : 'text-slate-500'}`}>
                {app.name}
              </span>
            </>
          );

          if (app.isAction) {
            return (
              <button key={app.id} onClick={handleRefresh} className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform">
                <InnerContent />
              </button>
            );
          }

          return (
            <Link key={app.id} to={app.path} className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform">
              <InnerContent />
            </Link>
          );
        })}
      </div>

      {/* BANNER DE SOPORTE (Visible para todos) */}
      <div className="mt-12 bg-slate-900 rounded-[35px] p-6 text-white shadow-2xl relative overflow-hidden border-b-4 border-brand-600">
        <div className="relative z-10">
          <div className="bg-brand-500 w-10 h-1 rounded-full mb-3"></div>
          <h3 className="font-black text-xl tracking-tighter uppercase mb-1">Centro de Ayuda</h3>
          <p className="text-[10px] text-slate-400 mb-6 max-w-[200px] font-bold uppercase tracking-widest leading-relaxed text-left">
            ¿Tienes problemas con la App o necesitas acompañamiento espiritual?
          </p>
          <a 
            href="https://wa.me/1167200352" 
            target="_blank" 
            className="inline-block bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            Contactar Soporte
          </a>
        </div>
        <Heart className="absolute -right-6 -bottom-6 text-brand-600 opacity-20 rotate-12" size={140} />
      </div>
      
      {/* SELLO DE SEGURIDAD (Solo Staff) */}
      {['pastor', 'lider'].includes(dbUser?.role) && (
          <div className="mt-8 flex items-center justify-center gap-2 opacity-30">
              <ShieldCheck size={14} className="text-slate-400"/>
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">Panel de Administración Protegido</span>
          </div>
      )}
    </div>
  );
}