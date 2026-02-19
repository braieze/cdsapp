import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Heart, Calendar, Search, 
  TrendingUp, User, ChevronRight, Filter 
} from 'lucide-react';

export default function DonorIntelligence({ movements = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState('year'); // month, year, all

  // ✅ PROCESAMIENTO PASTORAL: Agrupar por nombre y acumular oraciones
  const donors = useMemo(() => {
    const map = {};
    const now = new Date();

    movements
      .filter(m => m.total > 0) // Solo ingresos (siembras/diezmos)
      .forEach(m => {
        const name = m.fullName || m.concept?.replace("Transferencia: ", "") || "Dador Anónimo";
        const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();

        // Aplicar filtro de tiempo
        let passFilter = true;
        if (filter === 'month') passFilter = mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
        if (filter === 'year') passFilter = mDate.getFullYear() === now.getFullYear();

        if (passFilter) {
          if (!map[name]) {
            map[name] = { 
              name, 
              count: 0, 
              total: 0, 
              lastDate: mDate,
              prayers: [] 
            };
          }
          map[name].count++;
          map[name].total += m.total;
          if (mDate > map[name].lastDate) map[name].lastDate = mDate;
          if (m.prayer) map[name].prayers.push({ date: mDate, text: m.prayer });
        }
      });

    return Object.values(map)
      .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [movements, searchTerm, filter]);

  return (
    <div className="space-y-6 pt-4 pb-24 animate-fade-in">
      {/* 🔍 BARRA DE BÚSQUEDA Y FILTROS */}
      <header className="space-y-4 px-2">
        <div className="flex justify-between items-end">
          <div className="text-left">
            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">Inteligencia</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Seguimiento de Fidelidad</p>
          </div>
          <div className="bg-blue-600/20 px-4 py-2 rounded-2xl border border-blue-500/20 text-blue-400 font-black text-[10px] uppercase">
            {donors.length} Familias Activas
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar diezmante..."
              className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5">
            {['month', 'year', 'all'].map((f) => (
              <button 
                key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all ${filter === f ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                {f === 'month' ? 'Mes' : f === 'year' ? 'Año' : 'Todo'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 📋 LISTA DE DADORES (PASTORAL) */}
      <div className="space-y-4">
        {donors.map((d, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 backdrop-blur-xl border border-white/5 p-6 rounded-[45px] shadow-xl relative overflow-hidden"
          >
            {/* Header del Dador */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-400 rounded-[22px] flex items-center justify-center text-white font-black text-xl italic shadow-lg shadow-blue-500/20">
                  {d.name[0]}
                </div>
                <div className="text-left">
                  <h4 className="text-lg font-black text-white italic tracking-tight leading-none mb-1">{d.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[8px] font-black uppercase tracking-tighter">
                      Frecuencia: {d.count} veces
                    </span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Última: {d.lastDate.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <p className="text-xl font-black text-blue-400 italic">${d.total.toLocaleString('es-AR')}</p>
            </div>

            {/* 🕊️ MURO DE CLAMOR (Historial de Oración) */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 px-2">
                <MessageSquare size={12} className="text-slate-500" />
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Historial de Clamor</p>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {d.prayers.length > 0 ? (
                  d.prayers.map((p, idx) => (
                    <div key={idx} className="bg-slate-950/50 p-4 rounded-[25px] border border-white/5 text-left">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[8px] font-black text-blue-500 uppercase italic">
                          {new Date(p.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-300 italic leading-relaxed">"{p.text}"</p>
                    </div>
                  )).reverse()
                ) : (
                  <p className="text-[10px] text-slate-700 italic py-2 text-center">Sin pedidos registrados</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {donors.length === 0 && (
          <div className="py-20 text-center opacity-30 italic text-sm text-white uppercase tracking-widest">
            Sin datos para este periodo
          </div>
        )}
      </div>
    </div>
  );
}