import { useState, useEffect } from 'react'; 
import { 
  Users, Heart, History, GraduationCap, Video, 
  Calendar, RefreshCw, Music, HeartHandshake,
  Wallet, ShieldCheck, Settings, Phone
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

  // ✅ DEFINICIÓN DE APPS CON SEGMENTACIÓN ESTRICTA
  const allApps = [
    { id: 'calendario', name: 'Agenda', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', path: '/calendario', roles: ['pastor', 'lider', 'servidor'] },
    { id: 'directorio', name: 'Directorio', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', path: '/directorio', roles: ['pastor', 'lider', 'servidor'] },
    { id: 'ofrendar_user', name: 'Ofrendar', icon: HeartHandshake, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/ofrendar', roles: ['todos'] },
    { id: 'tesoreria_admin', name: 'Tesorería', icon: Wallet, color: 'text-slate-900', bg: 'bg-slate-100', path: '/tesoreria', roles: ['pastor', 'tesorero'] },
    { id: 'historial', name: 'Historial', icon: History, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/historial', roles: ['pastor', 'lider', 'servidor'] },
    
    // 🔄 Actualizar
    { 
      id: 'refresh', 
      name: updateAvailable ? '¡Nueva Versión!' : 'Actualizar', 
      icon: RefreshCw, 
      color: updateAvailable ? 'text-white' : 'text-slate-600', 
      bg: updateAvailable ? 'bg-red-500' : 'bg-white border border-slate-100 shadow-sm', 
      isAction: true,
      hasBadge: updateAvailable,
      roles: ['todos']
    },

    { id: 'classroom', name: 'Series', icon: GraduationCap, color: 'text-violet-600', bg: 'bg-violet-50', path: '/estudio', roles: ['todos'] },
    { id: 'alabanza', name: 'Alabanza', icon: Music, color: 'text-pink-600', bg: 'bg-pink-50', path: '/alabanza', roles: ['pastor', 'lider', 'alabanza', 'multimedia'] },
    { id: 'multimedia', name: 'Multimedia', icon: Video, color: 'text-cyan-600', bg: 'bg-cyan-50', path: '#', roles: ['pastor', 'lider', 'multimedia', 'alabanza'] },
  ];

  // 🕵️‍♂️ FILTRADO LÓGICO MEJORADO
  const visibleApps = allApps.filter(app => {
    const userRole = dbUser?.role?.toLowerCase();
    const userArea = dbUser?.area?.toLowerCase();

    // 1. REGLA PASTOR
    if (userRole === 'pastor') return true;

    // 2. REGLA MIEMBRO
    if (userRole === 'miembro') {
      return app.roles.includes('todos');
    }

    // 3. REGLA LIDER
    if (userRole === 'lider') {
      return app.roles.includes('lider') || app.roles.includes('todos') || app.roles.includes(userArea);
    }

    // 4. REGLA SERVIDOR GENERAL Y ÁREAS ESPECÍFICAS
    return (
      app.roles.includes('todos') || 
      app.roles.includes(userRole) ||
      app.roles.includes(userArea)
    );
  });

  return (
    <div className="pb-32 pt-8 px-5 animate-fade-in bg-[#F8F9FE] min-h-screen font-sans text-left relative">
      
      {/* 🚀 HEADER SOCIALYO */}
      <div className="mb-10 flex justify-between items-start max-w-md mx-auto">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">Aplicaciones</h2>
          <p className="text-xs font-semibold text-blue-600 mt-1">Panel de control</p>
        </div>
        <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Acceso: {dbUser?.area && dbUser.area !== 'ninguna' ? dbUser.area : dbUser?.role || 'Miembro'}</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">v1.4.0</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-8 gap-x-4 max-w-md mx-auto">
        {visibleApps.map((app) => {
          const InnerContent = () => (
            <>
              <div className={`w-16 h-16 rounded-[20px] ${app.bg} flex items-center justify-center mb-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] group-hover:shadow-md transition-all group-hover:-translate-y-1 relative border border-white`}>
                <app.icon className={`${app.color} transition-transform group-hover:scale-110 ${app.id === 'refresh' && updateAvailable ? 'animate-spin' : ''}`} size={28} strokeWidth={2.5} />
                {app.hasBadge && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-bold text-center leading-tight truncate w-full px-1 ${app.hasBadge ? 'text-red-500 animate-pulse' : 'text-slate-600'}`}>
                {app.name}
              </span>
            </>
          );

          if (app.isAction) {
            return (
              <button key={app.id} onClick={handleRefresh} className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform w-full">
                <InnerContent />
              </button>
            );
          }

          return (
            <Link key={app.id} to={app.path} className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform w-full">
              <InnerContent />
            </Link>
          );
        })}
      </div>

      {/* 🚀 BANNER DE SOPORTE AMIGABLE */}
      <div className="mt-16 bg-blue-600 rounded-[32px] p-8 text-white shadow-lg shadow-blue-600/20 relative overflow-hidden max-w-md mx-auto">
        <div className="relative z-10">
          <div className="w-12 h-12 bg-white/20 rounded-[18px] flex items-center justify-center mb-4 backdrop-blur-md">
             <Heart size={24} strokeWidth={2.5}/>
          </div>
          <h3 className="font-bold text-xl leading-tight mb-2">Centro de Ayuda</h3>
          <p className="text-xs text-blue-100 mb-6 font-medium leading-relaxed pr-6">
            ¿Tienes problemas con la App o necesitas acompañamiento espiritual? Estamos para ayudarte.
          </p>
          <a 
            href="https://wa.me/1167200352" 
            target="_blank" 
            className="inline-flex items-center gap-2 bg-white text-blue-600 text-xs font-bold px-6 py-3.5 rounded-full shadow-md active:scale-95 transition-all"
          >
            <Phone size={16}/> Contactar Soporte
          </a>
        </div>
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
      </div>
      
      {/* SELLO DE SEGURIDAD */}
      {['pastor', 'lider'].includes(dbUser?.role) && (
          <div className="mt-10 flex items-center justify-center gap-2 opacity-50 pb-8">
              <ShieldCheck size={14} className="text-slate-400"/>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Administración Protegida</span>
          </div>
      )}
    </div>
  );
}