import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  Music, Calendar, Clock, BookOpen, PlusCircle, 
  Search, Filter, ChevronRight, Mic2, Guitar, 
  Settings, Play, LayoutGrid, ListChecks, Sparkles, Lock
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';

export default function Alabanza() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const [activeTab, setActiveTab] = useState('semanal');
  const [loading, setLoading] = useState(true);

  // 🛡️ CONTROL DE ACCESO
  const isPastor = dbUser?.role === 'pastor';
  const isAlabanza = dbUser?.area?.toLowerCase() === 'alabanza';
  const hasAccess = isPastor || isAlabanza;

  useEffect(() => {
    // Simulamos carga inicial de datos si fuera necesario
    if (dbUser) setLoading(false);
  }, [dbUser]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-10 text-center bg-slate-50">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-[30px] flex items-center justify-center mb-6 shadow-xl shadow-rose-100/50">
          <Lock size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Acceso Restringido</h2>
        <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">
          Este módulo es exclusivo para el equipo de Alabanza y el Pastorado.
        </p>
        <button onClick={() => navigate('/')} className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-outfit relative">
      {/* HEADER DEL MÓDULO */}
      <div className="px-5 pt-8 pb-4 bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-6">
          <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Alabanza</h1>
            <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-2 flex items-center gap-2">
              <Sparkles size={12} /> Gestión del Equipo
            </p>
          </div>
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <Music size={24} />
          </div>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
          {['semanal', 'mensual', 'cancionero'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                ? 'bg-white text-slate-900 shadow-md scale-[1.02]' 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-8">
        {/* PESTAÑA: SEMANAL */}
        {activeTab === 'semanal' && (
          <div className="animate-slide-up space-y-6">
            <div className="bg-slate-900 rounded-[35px] p-8 text-white shadow-2xl relative overflow-hidden">
               <div className="relative z-10 text-left">
                  <span className="bg-brand-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Próxima Actividad</span>
                  <h3 className="text-3xl font-black mt-4 uppercase tracking-tighter leading-none italic">Ensayo General</h3>
                  <div className="flex flex-col gap-2 mt-6 text-slate-300 font-bold text-sm">
                    <div className="flex items-center gap-2"><Calendar size={16} className="text-brand-400"/> Miércoles 22 de Abril</div>
                    <div className="flex items-center gap-2"><Clock size={16} className="text-brand-400"/> 19:30 hs</div>
                  </div>
               </div>
               <div className="absolute top-0 right-0 p-6 opacity-10 text-white"><Music size={120}/></div>
            </div>

            <div className="space-y-4">
               <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 text-left">Resumen de la semana</h2>
               <div className="grid grid-cols-1 gap-3">
                  <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center"><Mic2 size={24}/></div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">Culto de Martes</h4>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">4 Canciones asignadas</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300"/>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: MENSUAL */}
        {activeTab === 'mensual' && (
          <div className="animate-slide-up text-center py-20 opacity-30">
            <Calendar size={64} className="mx-auto mb-4 text-slate-300"/>
            <p className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400">Organización Mensual en construcción</p>
          </div>
        )}

        {/* PESTAÑA: CANCIONERO */}
        {activeTab === 'cancionero' && (
          <div className="animate-slide-up space-y-6">
            <div className="flex gap-2">
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 flex items-center px-4 gap-3 shadow-sm">
                <Search size={18} className="text-slate-400" />
                <input type="text" placeholder="Buscar canción..." className="w-full py-4 text-sm font-bold bg-transparent outline-none text-slate-800" />
              </div>
              <button className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl active:scale-90 transition-all">
                <Filter size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
               <div className="text-center py-20 opacity-30">
                 <BookOpen size={64} className="mx-auto mb-4 text-slate-300"/>
                 <p className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400">Carga tus primeras canciones</p>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE PARA ACCIONES RÁPIDAS */}
      <button 
        className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[26px] shadow-2xl flex items-center justify-center active:scale-90 z-40 transition-all border-4 border-white"
        onClick={() => {
          if (activeTab === 'cancionero') console.log("Nueva Canción");
          if (activeTab === 'mensual') console.log("Generar Mes");
        }}
      >
        <PlusCircle size={32} />
      </button>
    </div>
  );
}