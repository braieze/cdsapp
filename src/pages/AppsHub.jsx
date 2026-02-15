import { Users, BookOpen, Heart, Music, DollarSign, History, ShieldAlert, GraduationCap, Video, Calendar, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AppsHub() {
  // Aquí definimos todas las "Mini Apps".
  // He conectado las rutas reales a Directorio, Calendario y Servicios.
  const apps = [
    // ✅ FUNCIONALES (Ya las creamos)
    { id: 'directorio', name: 'Directorio', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', path: '/directorio' },
    { id: 'calendario', name: 'Calendario', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', path: '/calendario' },
    { id: 'servicios', name: 'Mis Servicios', icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50', path: '/servicios' },
    
    // 🚧 FUTURAS (Visualmente listas, pero aún no tienen página)
    { id: 'classroom', name: 'Escuela', icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '#' },
    { id: 'visitacion', name: 'Visitación', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', path: '#' },
    { id: 'alabanza', name: 'Cancionero', icon: Music, color: 'text-pink-600', bg: 'bg-pink-50', path: '#' },
    { id: 'tesoreria', name: 'Ofrendar', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50', path: '#' },
    { id: 'multimedia', name: 'Multimedia', icon: Video, color: 'text-cyan-600', bg: 'bg-cyan-50', path: '#' },
  ];

  return (
    <div className="pb-24 pt-4 px-4 animate-fade-in bg-slate-50 min-h-screen">
      
      <div className="mb-6">
        <h2 className="text-xl font-black text-slate-800">Aplicaciones</h2>
        <p className="text-sm text-slate-500 mt-1 font-medium">Todas las herramientas del ministerio</p>
      </div>

      {/* 📱 Cuadrícula de Apps (Grid) */}
      <div className="grid grid-cols-3 gap-y-8 gap-x-4">
        {apps.map((app) => (
          <Link 
            key={app.id} 
            to={app.path}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
          >
            {/* Ícono de la App */}
            <div className={`w-16 h-16 rounded-2xl ${app.bg} flex items-center justify-center mb-2 shadow-sm border border-white group-hover:shadow-md transition-all group-hover:-translate-y-1`}>
              <app.icon className={`${app.color} transition-transform group-hover:scale-110`} size={28} strokeWidth={2} />
            </div>
            {/* Nombre de la App */}
            <span className="text-[11px] font-bold text-slate-600 text-center leading-tight px-1">
              {app.name}
            </span>
          </Link>
        ))}
      </div>

      {/* Banner promocional (Tu diseño original) */}
      <div className="mt-10 bg-gradient-to-r from-brand-600 to-brand-500 rounded-2xl p-5 text-white shadow-lg shadow-brand-200 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="font-bold mb-1 text-lg">¿Necesitas ayuda?</h3>
          <p className="text-xs text-brand-50 mb-4 max-w-[200px] font-medium leading-relaxed">
            El equipo pastoral está aquí para orar por ti y acompañarte.
          </p>
          <button className="bg-white text-brand-700 text-xs font-bold px-5 py-2.5 rounded-full shadow-sm hover:bg-brand-50 transition-colors">
            Contactar ahora
          </button>
        </div>
        {/* Decoración de fondo */}
        <Heart className="absolute -right-4 -bottom-4 text-white opacity-20 rotate-12" size={120} />
      </div>

    </div>
  );
}