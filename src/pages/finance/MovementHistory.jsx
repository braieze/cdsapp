import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { 
  TrendingUp, TrendingDown, Edit3, Trash2, 
  Download, Filter, Search, ArrowUpCircle, 
  ArrowDownCircle, ListFilter
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function MovementHistory({ movements = [], setCustomAlert }) {
  const [filter, setFilter] = useState('all'); // all, income, expense
  const [search, setSearch] = useState("");

  // ✅ 1. FILTRADO INTELIGENTE
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const matchSearch = m.concept?.toLowerCase().includes(search.toLowerCase());
      if (filter === 'income') return matchSearch && m.total > 0;
      if (filter === 'expense') return matchSearch && m.total < 0;
      return matchSearch;
    });
  }, [movements, filter, search]);

  // ✅ 2. CÁLCULO DE TOTALES FILTRADOS
  const totals = useMemo(() => {
    return filteredMovements.reduce((acc, m) => acc + Number(m.total), 0);
  }, [filteredMovements]);

  // ✅ 3. ELIMINAR CON ALERTA PREMIUM (REEMPLAZA WINDOW.CONFIRM)
  const handleDeleteRequest = (id) => {
    setCustomAlert({
      title: "Eliminar Registro",
      message: "¿Estás seguro de borrar este movimiento? El balance total se actualizará automáticamente.",
      type: "confirm",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'finances', id));
        } catch (e) { console.error("Error:", e); }
      }
    });
  };

  return (
    <div className="space-y-6 pt-4 pb-24 text-left">
      
      {/* 📊 RESUMEN DINÁMICO DEL FILTRO */}
      <section className="px-2">
        <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[40px] flex justify-between items-center backdrop-blur-xl">
            <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                    {filter === 'all' ? 'Balance Filtrado' : filter === 'income' ? 'Total Ingresos' : 'Total Gastos'}
                </p>
                <h3 className={`text-3xl font-black italic tracking-tighter ${totals >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    ${Math.abs(totals).toLocaleString('es-AR')}
                </h3>
            </div>
            <div className={`p-4 rounded-2xl ${totals >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {totals >= 0 ? <ArrowUpCircle size={28}/> : <ArrowDownCircle size={28}/>}
            </div>
        </div>
      </section>

      {/* 🔍 BUSCADOR Y SELECTOR DE TABS */}
      <header className="space-y-4 px-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            value={search}
            onChange={(e) => setSearch(e.search)}
            placeholder="Buscar por concepto o detalle..."
            className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all shadow-inner"
          />
        </div>

        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
            {[
                { id: 'all', label: 'Todo', icon: ListFilter },
                { id: 'income', label: 'Ingresos', icon: TrendingUp },
                { id: 'expense', label: 'Egresos', icon: TrendingDown }
            ].map(t => (
                <button 
                    key={t.id} onClick={() => setFilter(t.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${filter === t.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}
                >
                    <t.icon size={12}/> {t.label}
                </button>
            ))}
        </div>
      </header>

      {/* 📋 LISTA DE MOVIMIENTOS FILTRADA */}
      <div className="space-y-3 px-1">
        <AnimatePresence mode="popLayout">
          {filteredMovements.map((m) => (
            <motion.div 
              key={m.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: 20 }}
              className="group relative bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-[35px] flex justify-between items-center transition-all hover:bg-slate-900/60"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${m.total > 0 ? 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'}`}>
                  {m.total > 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                </div>
                <div>
                  <p className="text-[11px] font-black text-white italic uppercase tracking-tight leading-none mb-1">
                    {m.concept}
                  </p>
                  <div className="flex items-center gap-2">
                     <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${m.total > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {m.category || (m.total > 0 ? 'Ingreso' : 'Gasto')}
                     </span>
                     <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                     <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{m.method}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className={`text-lg font-black italic leading-none ${m.total > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {m.total > 0 ? '+' : '-'}${Math.abs(m.total).toLocaleString('es-AR')}
                  </p>
                  <p className="text-[8px] font-black text-slate-600 uppercase mt-1">
                    {m.date?.seconds ? new Date(m.date.seconds * 1000).toLocaleDateString() : 'Hoy'}
                  </p>
                </div>
                
                {/* BOTONES DE ACCIÓN (Aparecen al interacción) */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                  <button className="p-2 bg-white/5 text-slate-500 hover:text-blue-400 rounded-xl transition-colors">
                    <Edit3 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteRequest(m.id)}
                    className="p-2 bg-white/5 text-slate-500 hover:text-rose-500 rounded-xl transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredMovements.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 opacity-10">
                <Filter size={32} />
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">Sin registros que coincidan</p>
          </div>
        )}
      </div>
    </div>
  );
}