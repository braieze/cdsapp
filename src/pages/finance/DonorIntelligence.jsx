import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Heart, Calendar, Search, 
  User, Copy, Check, Filter, Sparkles, ClipboardList, Trash2
} from 'lucide-react';
import { db } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export default function DonorIntelligence({ movements = [], setCustomAlert }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState('week'); // week, month, year, all
  const [copied, setCopied] = useState(false);

  // ✅ 1. PROCESAMIENTO INTELIGENTE DE DATOS (REPETADO AL 100%)
  const donors = useMemo(() => {
    const map = {};
    const now = new Date();
    
    // Calcular inicio de semana (domingo pasado)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    movements
      .filter(m => m.total > 0) // Solo ingresos
      .forEach(m => {
        const name = m.fullName || m.concept?.replace("Transferencia: ", "") || "Dador Anónimo";
        const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();

        // Lógica de Filtros Pro
        let passFilter = false;
        if (filter === 'week') passFilter = mDate >= startOfWeek;
        if (filter === 'month') passFilter = mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
        if (filter === 'year') passFilter = mDate.getFullYear() === now.getFullYear();
        if (filter === 'all') passFilter = true;

        if (passFilter) {
          if (!map[name]) {
            map[name] = { 
              name, 
              count: 0, 
              total: 0, 
              lastDate: mDate, 
              prayers: [],
              transactionIds: [] // ✅ Agregado para permitir eliminación
            };
          }
          map[name].count++;
          map[name].total += m.total;
          map[name].transactionIds.push(m.id); // ✅ Guardamos el ID real de Firestore
          if (mDate > map[name].lastDate) map[name].lastDate = mDate;
          if (m.prayer) map[name].prayers.push({ date: mDate, text: m.prayer });
        }
      });

    return Object.values(map)
      .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [movements, searchTerm, filter]);

  // ✅ 2. FUNCIÓN: ELIMINAR REGISTROS DE FAMILIA (NUEVO)
  const handleDeleteFamily = (donor) => {
    if (typeof setCustomAlert !== 'function') return;

    setCustomAlert({
      title: "Eliminar registros",
      message: `¿Estás seguro de borrar los ingresos de "${donor.name}" en este periodo? Se restará del balance total.`,
      type: "confirm",
      onConfirm: async () => {
        try {
          // Borra cada transacción asociada a este dador en el periodo filtrado
          const promises = donor.transactionIds.map(id => deleteDoc(doc(db, 'finances', id)));
          await Promise.all(promises);
        } catch (e) {
          console.error("Error al eliminar dador:", e);
        }
      }
    });
  };

  // ✅ 3. FUNCIÓN: COPIAR TODOS LOS PEDIDOS DE LA SEMANA (REPETADO)
  const handleCopyWeeklyPrayers = () => {
    const weeklyPrayers = donors
      .filter(d => d.prayers.length > 0)
      .map(d => `🙏 ${d.name.toUpperCase()}:\n"${d.prayers[d.prayers.length - 1].text}"`)
      .join('\n\n');

    if (!weeklyPrayers) return;

    navigator.clipboard.writeText(`📖 MOTIVOS DE ORACIÓN - CDS\nPeriodo: ${filter.toUpperCase()}\n\n${weeklyPrayers}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pt-4 pb-24 animate-fade-in text-left">
      
      {/* 🔍 HEADER CON BUSCADOR Y ACCIÓN DE COPIADO */}
      <header className="space-y-4 px-2">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none">Inteligencia</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1 text-left">Gestión Pastoral</p>
          </div>
          
          <button 
            onClick={handleCopyWeeklyPrayers}
            className={`p-4 rounded-2xl border transition-all flex items-center gap-2 active:scale-90 ${copied ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-blue-600/20 border-blue-500/30 text-blue-400'}`}
          >
            {copied ? <Check size={18} /> : <ClipboardList size={18} />}
            <span className="text-[10px] font-black uppercase tracking-tighter">Copiar Clamor</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o familia..."
              className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all shadow-inner"
            />
          </div>
          
          <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
            {[
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mes' },
              { id: 'year', label: 'Año' },
              { id: 'all', label: 'Todo' }
            ].map((f) => (
              <button 
                key={f.id} onClick={() => setFilter(f.id)}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filter === f.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 📋 LISTA DE DIEZMANTES (CRYPZONE STYLE) */}
      <div className="space-y-4 px-1">
        <AnimatePresence>
          {donors.map((d, i) => (
            <motion.div 
              key={d.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05 }}
              className="bg-slate-900/60 backdrop-blur-xl border border-white/5 p-6 rounded-[40px] shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-active:opacity-100 transition-opacity" />

              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex gap-4 items-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-400 rounded-[22px] flex items-center justify-center text-white font-black text-xl italic shadow-lg shadow-blue-500/30">
                    {d.name[0]}
                  </div>
                  <div className="text-left">
                    <h4 className="text-lg font-black text-white italic tracking-tight leading-none mb-1">{d.name}</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-tighter border border-emerald-500/10">
                        {d.count} Siembras
                      </span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Calendar size={10}/> {d.lastDate.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <p className="text-xl font-black text-blue-400 italic leading-none">${d.total.toLocaleString('es-AR')}</p>
                    {/* ✅ BOTÓN ELIMINAR (CRUD) */}
                    <button 
                      onClick={() => handleDeleteFamily(d)}
                      className="p-2 text-slate-700 hover:text-rose-500 transition-colors active:scale-90"
                    >
                      <Trash2 size={16}/>
                    </button>
                </div>
              </div>

              {/* 🕊️ HISTORIAL DE CLAMOR INTERACTIVO */}
              <div className="space-y-3 pt-4 border-t border-white/5 relative z-10">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={12} className="text-blue-500" />
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-left">Muro de Clamor</p>
                  </div>
                  <Sparkles size={12} className="text-blue-500/40 animate-pulse" />
                </div>
                
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {d.prayers.length > 0 ? (
                    d.prayers.map((p, idx) => (
                      <div key={idx} className="bg-slate-950/50 p-4 rounded-[28px] border border-white/5 group/prayer transition-all hover:border-blue-500/30 text-left">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[8px] font-black text-blue-500 uppercase italic bg-blue-500/10 px-2 py-1 rounded-md">
                            {new Date(p.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-300 italic leading-relaxed text-left">
                          "{p.text}"
                        </p>
                      </div>
                    )).reverse()
                  ) : (
                    <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-[28px]">
                        <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest text-center">Sin peticiones registradas</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {donors.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 opacity-20">
                <User size={32} />
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] text-center">Sin registros hallados</p>
          </div>
        )}
      </div>
    </div>
  );
}