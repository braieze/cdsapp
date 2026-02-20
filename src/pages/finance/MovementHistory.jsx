import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { 
  TrendingUp, TrendingDown, Edit3, Trash2, 
  Download, Filter, Search, ArrowUpCircle, 
  ArrowDownCircle, ListFilter, ChevronDown, ChevronUp,
  Ticket, MessageSquare, Banknote, CreditCard, Info
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function MovementHistory({ movements = [], setCustomAlert, onEdit }) { 
  const [filter, setFilter] = useState('all'); 
  const [search, setSearch] = useState("");
  const [expandedClosures, setExpandedClosures] = useState({}); // ✅ Control de acordeones

  // ✅ 1. AGRUPACIÓN INTELIGENTE POR CIERRE DE CAJA (FASE 2)
  const processedMovements = useMemo(() => {
    const groups = {};
    const standalones = [];

    // Primero filtramos por búsqueda y tipo (Ingreso/Egreso)
    const baseFilter = movements.filter(m => {
      const matchSearch = m.concept?.toLowerCase().includes(search.toLowerCase()) || 
                          m.fullName?.toLowerCase().includes(search.toLowerCase());
      if (filter === 'income') return matchSearch && m.total > 0;
      if (filter === 'expense') return matchSearch && m.total < 0;
      return matchSearch;
    });

    baseFilter.forEach(m => {
      // Si tiene eventId o el concepto indica un cierre, lo agrupamos
      if (m.eventId) {
        if (!groups[m.eventId]) {
          groups[m.eventId] = {
            id: m.eventId,
            isGroup: true,
            title: m.eventName || m.concept.replace("Cierre: ", "").replace("Cierre de Caja: ", ""),
            date: m.date,
            total: 0,
            items: [],
            tithesCount: 0,
            offeringsCount: 0
          };
        }
        groups[m.eventId].items.push(m);
        groups[m.eventId].total += Number(m.total);
        if (m.subType === 'diezmo') groups[m.eventId].tithesCount++;
        else groups[m.eventId].offeringsCount++;
      } else {
        // Gastos o ingresos sueltos sin evento
        standalones.push({ ...m, isGroup: false });
      }
    });

    // Combinamos grupos y sueltos, ordenando por fecha
    return [...Object.values(groups), ...standalones].sort((a, b) => {
      const dateA = a.date?.seconds || 0;
      const dateB = b.date?.seconds || 0;
      return dateB - dateA;
    });
  }, [movements, filter, search]);

  // ✅ 2. CÁLCULO DE TOTALES (RESPETADO)
  const totals = useMemo(() => {
    return movements
      .filter(m => {
        const matchSearch = m.concept?.toLowerCase().includes(search.toLowerCase());
        if (filter === 'income') return matchSearch && m.total > 0;
        if (filter === 'expense') return matchSearch && m.total < 0;
        return matchSearch;
      })
      .reduce((acc, m) => acc + Number(m.total), 0);
  }, [movements, filter, search]);

  const triggerAlert = (config) => {
    if (typeof setCustomAlert === 'function') setCustomAlert(config);
    else console.warn("Alerta:", config.message);
  };

  const handleDeleteRequest = (id) => {
    triggerAlert({
      title: "Eliminar Registro",
      message: "¿Estás seguro de borrar este movimiento? El balance se actualizará.",
      type: "confirm",
      onConfirm: async () => {
        try { await deleteDoc(doc(db, 'finances', id)); } 
        catch (e) { console.error("Error:", e); }
      }
    });
  };

  const toggleClosure = (id) => {
    setExpandedClosures(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 pt-4 pb-24 text-left">
      
      {/* RESUMEN DEL FILTRO */}
      <section className="px-2">
        <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[40px] flex justify-between items-center backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none mb-2">
                    {filter === 'all' ? 'Balance Filtrado' : filter === 'income' ? 'Total Ingresos' : 'Total Gastos'}
                </p>
                <h3 className={`text-4xl font-black italic tracking-tighter leading-none ${totals >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    ${Math.abs(totals).toLocaleString('es-AR')}
                </h3>
            </div>
            <div className={`p-4 rounded-2xl relative z-10 ${totals >= 0 ? 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]'}`}>
                {totals >= 0 ? <ArrowUpCircle size={28}/> : <ArrowDownCircle size={28}/>}
            </div>
        </div>
      </section>

      {/* BUSCADOR Y TABS */}
      <header className="space-y-4 px-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por concepto o dador..." className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all shadow-inner" />
        </div>
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 shadow-inner">
            {[{ id: 'all', label: 'Todo', icon: ListFilter }, { id: 'income', label: 'Ingresos', icon: TrendingUp }, { id: 'expense', label: 'Egresos', icon: TrendingDown }].map(t => (
                <button key={t.id} onClick={() => setFilter(t.id)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${filter === t.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}><t.icon size={12}/> {t.label}</button>
            ))}
        </div>
      </header>

      {/* 📋 LISTA DINÁMICA (CIERRES + STANDALONES) */}
      <div className="space-y-4 px-1">
        <AnimatePresence mode="popLayout">
          {processedMovements.map((m) => (
            <motion.div key={m.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 20 }} className="w-full">
              
              {m.isGroup ? (
                /* 📦 TARJETA DE CIERRE DE CAJA (EXPANDIBLE) */
                <div className="bg-slate-900/60 border border-blue-500/20 rounded-[40px] overflow-hidden shadow-2xl">
                    <button onClick={() => toggleClosure(m.id)} className="w-full p-6 flex justify-between items-center bg-blue-600/5 hover:bg-blue-600/10 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                                <Ticket size={24} />
                            </div>
                            <div className="text-left">
                                <h4 className="text-sm font-black text-white italic uppercase tracking-tight leading-none mb-1">Cierre: {m.title}</h4>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                    {m.tithesCount} Sobres • {m.offeringsCount} Ofrendas • {new Date(m.date.seconds * 1000).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <p className="text-xl font-black italic text-emerald-400">${m.total.toLocaleString('es-AR')}</p>
                            {expandedClosures[m.id] ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
                        </div>
                    </button>

                    <AnimatePresence>
                        {expandedClosures[m.id] && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="px-4 pb-6 space-y-2 bg-slate-950/30">
                                <div className="h-px bg-white/5 mb-4 mx-2" />
                                {m.items.map((sub) => (
                                    <div key={sub.id} className="bg-white/5 p-4 rounded-3xl flex justify-between items-center group/sub border border-transparent hover:border-white/10 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${sub.subType === 'diezmo' ? 'text-emerald-400 bg-emerald-400/5' : 'text-blue-400 bg-blue-400/5'}`}>
                                                {sub.method === 'Efectivo' ? <Banknote size={14}/> : <CreditCard size={14}/>}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-[10px] font-black text-white uppercase italic">{sub.fullName || sub.concept}</p>
                                                <p className="text-[7px] font-bold text-slate-500 uppercase">{sub.subType} • {sub.method}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="text-xs font-black text-white">${Number(sub.total).toLocaleString('es-AR')}</p>
                                            <div className="flex gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                                <button onClick={() => onEdit && onEdit(sub)} className="p-1.5 bg-white/5 text-slate-400 hover:text-blue-400 rounded-lg"><Edit3 size={12}/></button>
                                                <button onClick={() => handleDeleteRequest(sub.id)} className="p-1.5 bg-white/5 text-slate-400 hover:text-rose-500 rounded-lg"><Trash2 size={12}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
              ) : (
                /* 📄 REGISTRO INDIVIDUAL (GASTOS O SUELTOS) */
                <div className="group relative bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-[35px] flex justify-between items-center transition-all hover:bg-slate-800/50">
                  <div className="flex items-center gap-4 text-left">
                    <div className={`p-3 rounded-2xl ${m.total > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'}`}>
                      {m.total > 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white italic uppercase tracking-tight leading-none mb-1">{m.concept}</p>
                      <div className="flex items-center gap-2">
                         <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${m.total > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
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
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                      <button onClick={() => onEdit && onEdit(m)} className="p-2 bg-white/5 text-slate-500 hover:text-blue-400 rounded-xl transition-colors"><Edit3 size={14}/></button>
                      <button onClick={() => handleDeleteRequest(m.id)} className="p-2 bg-white/5 text-slate-500 hover:text-rose-500 rounded-xl transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {processedMovements.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 opacity-10">
                <Filter size={32} />
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] text-center">Sin registros hallados</p>
          </div>
        )}
      </div>
    </div>
  );
}