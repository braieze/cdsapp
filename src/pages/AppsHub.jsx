import { useState, useEffect } from 'react';
import { Users, Heart, History, GraduationCap, Video, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AppsHub() {
  // ✅ ESTADO DE ACTUALIZACIÓN DISPONIBLE
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Escuchamos el evento que dispararemos desde el registro del Service Worker
    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener('swUpdated', handleUpdate);
    
    // Verificamos si ya había una actualización marcada en el estado global
    if (window.swUpdateAvailable) setUpdateAvailable(true);

    return () => window.removeEventListener('swUpdated', handleUpdate);
  }, []);

  const handleRefresh = () => {
    // Si hay actualización, limpiamos el estado y recargamos
    setUpdateAvailable(false);
    window.location.reload(true); // Fuerza la recarga desde el servidor
  };

  const apps = [
    { id: 'directorio', name: 'Directorio', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', path: '/directorio' },
    { id: 'calendario', name: 'Calendario', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', path: '/calendario' },
    { id: 'historial', name: 'Historial', icon: History, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/historial' },
    
    // 🔄 BOTÓN DE ACTUALIZAR (CON INTELIGENCIA)
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
    { id: 'tesoreria', name: 'Ofrendar', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50', path: '#' },
    { id: 'multimedia', name: 'Multimedia', icon: Video, color: 'text-cyan-600', bg: 'bg-cyan-50', path: '#' },
  ];

  return (
    <div className="pb-24 pt-4 px-4 animate-fade-in bg-slate-50 min-h-screen">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-black text-slate-800">Aplicaciones</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Todas las herramientas</p>
        </div>
        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">v1.2</span>
      </div>

      <div className="grid grid-cols-3 gap-y-8 gap-x-4">
        {apps.map((app) => {
          const InnerContent = () => (
            <>
              <div className={`w-16 h-16 rounded-2xl ${app.bg} flex items-center justify-center mb-2 shadow-sm border border-white group-hover:shadow-md transition-all group-hover:-translate-y-1 relative`}>
                <app.icon className={`${app.color} transition-transform group-hover:scale-110 ${app.id === 'refresh' && updateAvailable ? 'animate-spin-slow' : ''}`} size={28} strokeWidth={2} />
                
                {/* 🔴 PUNTO ROJO DE ALERTA DE ACTUALIZACIÓN */}
                {app.hasBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-bold text-center leading-tight px-1 ${app.hasBadge ? 'text-red-600 animate-pulse' : 'text-slate-600'}`}>
                {app.name}
              </span>
            </>
          );

          if (app.isAction) {
            return (
              <button key={app.id} onClick={handleRefresh} className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform">
                <InnerContent />
              </button>
            );
          }

          return (
            <Link key={app.id} to={app.path} className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform">
              <InnerContent />
            </Link>
          );
        })}
      </div>

      <div className="mt-10 bg-gradient-to-r from-brand-600 to-brand-500 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="font-bold mb-1 text-lg">¿Necesitas ayuda?</h3>
          <p className="text-xs text-brand-50 mb-4 max-w-[200px] font-medium">El equipo pastoral está aquí para acompañarte.</p>
          <button className="bg-white text-brand-700 text-xs font-bold px-5 py-2.5 rounded-full shadow-sm hover:bg-brand-50 transition-colors">Contactar ahora</button>
        </div>
        <Heart className="absolute -right-4 -bottom-4 text-white opacity-20 rotate-12" size={120} />
      </div>
    </div>
  );
}