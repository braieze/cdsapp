import { useState, useEffect } from 'react';
import { 
  Users, Heart, History, GraduationCap, Video, 
  Calendar, RefreshCw, Music, HeartHandshake,
  Wallet // ✅ Ícono para Tesorería
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AppsHub() {
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

  const apps = [
    { id: 'directorio', name: 'Directorio', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', path: '/directorio' },
    { id: 'calendario', name: 'Calendario', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', path: '/calendario' },
    { id: 'historial', name: 'Historial', icon: History, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/historial' },
    { 
      id: 'refresh', 
      name: updateAvailable ? '¡Nueva Versión!' : 'Actualizar App', 
      icon: RefreshCw, 
      color: updateAvailable ? 'text-white' : 'text-slate-600', 
      bg: updateAvailable ? 'bg-red-500' : 'bg-slate-100', 
      isAction: true,
      hasBadge: updateAvailable 
    },
    { id: 'classroom', name: 'Escuela', icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '#' },
    { id: 'visitacion', name: 'Visitación', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', path: '#' },
    { id: 'alabanza', name: 'Cancionero', icon: Music, color: 'text-pink-600', bg: 'bg-pink-50', path: '#' },
    { id: 'ofrendar_user', name: 'Ofrendar', icon: HeartHandshake, color: 'text-brand-600', bg: 'bg-brand-50', path: '/ofrendar' },
    
    // ✅ NUEVO: Acceso a la Tesorería (Admin)
    { id: 'tesoreria_admin', name: 'Tesorería', icon: Wallet, color: 'text-slate-900', bg: 'bg-slate-200', path: '/tesoreria' },
    
    { id: 'multimedia', name: 'Multimedia', icon: Video, color: 'text-cyan-600', bg: 'bg-cyan-50', path: '#' },
  ];

  return (
    <div className="pb-32 pt-4 px-4 animate-fade-in bg-slate-50 min-h-screen font-outfit">
      <div className="mb-8 flex justify-between items-end px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Aplicaciones</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ministerio CDS</p>
        </div>
        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">v1.2</span>
      </div>

      <div className="grid grid-cols-3 gap-y-10 gap-x-4">
        {apps.map((app) => {
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

      <div className="mt-12 bg-slate-900 rounded-[35px] p-6 text-white shadow-2xl relative overflow-hidden border-b-4 border-brand-600">
        <div className="relative z-10">
          <div className="bg-brand-500 w-10 h-1 rounded-full mb-3"></div>
          <h3 className="font-black text-xl tracking-tighter uppercase mb-1">¿Necesitas ayuda?</h3>
          <p className="text-[10px] text-slate-400 mb-6 max-w-[200px] font-bold uppercase tracking-widest leading-relaxed">
            El equipo pastoral está para orar por ti y acompañarte.
          </p>
          <button className="bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg active:scale-95 transition-all">
            Contactar ahora
          </button>
        </div>
        <Heart className="absolute -right-6 -bottom-6 text-brand-600 opacity-20 rotate-12" size={140} />
      </div>
    </div>
  );
}