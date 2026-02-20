import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Heart, Calendar, Search, 
  User, Copy, Check, Filter, Sparkles, ClipboardList, Trash2,
  Wallet, Banknote, CreditCard, ArrowRight, Users, Ticket, ChevronDown
} from 'lucide-react';
import { db } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export default function DonorIntelligence({ movements = [], setCustomAlert, selectedMonth, selectedYear }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState('month'); 
  const [subView, setSubView] = useState('diezmos'); 
  const [eventFilter, setEventFilter] = useState(''); 
  const [copied, setCopied] = useState(false);

  // ✅ 1. PROCESAMIENTO INTELIGENTE (SINCRONIZADO CON MES/AÑO)
  const donorsData = useMemo(() => {
    const map = {};
    const now = new Date();
    let totalARS = 0;
    const uniqueEvents = new Set();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    // Filtrado base por periodo maestro
    const filteredMovements = movements.filter(m => {
        const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();
        const mMonth = mDate.getMonth();
        const mYear = mDate.getFullYear();

        // Solo ingresos
        if (Number(m.total) <= 0) return false;

        // Filtro estricto por Mes/Año seleccionado en Tesoreria.jsx
        if (filter === 'month' && (mMonth !== Number(selectedMonth) || mYear !== Number(selectedYear))) return false;
        if (filter === 'year' && mYear !== Number(selectedYear)) return false;
        if (filter === 'week' && mDate < startOfWeek) return false;

        return true;
    });

    filteredMovements.forEach(m => {
        const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();
        
        // Registrar eventos disponibles en este periodo
        if (m.concept?.includes("Cierre") || m.eventId) {
            const eventName = m.concept.replace("Cierre: ", "").replace("Cierre de Caja: ", "").trim();
            uniqueEvents.add(eventName);
        }

        // Filtrado por Tipo (Diezmo/Ofrenda) y Filtro de Evento
        const currentSubType = m.subType || (m.fullName ? 'diezmo' : 'ofrenda');
        const matchesType = subView === 'diezmos' ? currentSubType === 'diezmo' : currentSubType === 'ofrenda';
        const matchesEvent = eventFilter === '' || m.concept?.toLowerCase().includes(eventFilter.toLowerCase());

        if (matchesType && matchesEvent) {
          const name = m.fullName || m.concept?.replace("Transferencia: ", "").replace("Diezmo: ", "").replace("Ofrenda: ", "") || "Dador Anónimo";
          
          if (!map[name]) {
            map[name] = { 
              name, count: 0, total: 0, lastDate: mDate, prayers: [], transactionIds: [],
              cash: 0, virtual: 0 
            };
          }
          map[name].count++;
          map[name].total += Number(m.total);
          map[name].transactionIds.push(m.id);
          
          if (m.method === 'Efectivo') map[name].cash += Number(m.total);
          else map[name].virtual += Number(m.total);

          if (mDate > map[name].lastDate) map[name].lastDate = mDate;
          if (m.prayer) map[name].prayers.push({ date: mDate, text: m.prayer });
          
          totalARS += Number(m.total);
        }
    });

    const list = Object.values(map)
      .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.total - a.total);

    return { list, totalARS, count: list.length, availableEvents: Array.from(uniqueEvents) };
  }, [movements, searchTerm, filter, subView, eventFilter, selectedMonth, selectedYear]);

  // ✅ 2. ELIMINAR (RESPETADO)
  const handleDeleteFamily = (donor) => {
    if (typeof setCustomAlert !== 'function') return;
    setCustomAlert({
      title: "Eliminar registros",
      message: `¿Borrar ingresos de "${donor.name}" en este periodo?`,
      type: "confirm",
      onConfirm: async () => {
        try {
          const promises = donor.transactionIds.map(id => deleteDoc(doc(db, 'finances', id)));
          await Promise.all(promises);
        } catch (e) { console.error("Error:", e); }
      }
    });
  };

  const handleCopyWeeklyPrayers = () => {
    const weeklyPrayers = donorsData.list
      .filter(d => d.prayers.length > 0)
      .map(d => `🙏 ${d.name.toUpperCase()}:\n"${d.prayers[d.prayers.length - 1].text}"`)
      .join('\n\n');
    if (!weeklyPrayers) return;
    navigator.clipboard.writeText(`📖 MOTIVOS DE ORACIÓN\nPeriodo: ${filter.toUpperCase()}\n\n${weeklyPrayers}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pt-4 pb-24 animate-fade-in text-left">
      
      {/* 📊 PANEL DE TOTALES (CIERRE DE CAJA DINÁMICO) */}
      <section className="px-2 grid grid-cols-2 gap-3">
        <div className="bg-slate-900/40 border border-white/5 p-5 rounded-[35px] backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><Banknote size={40}/></div>
            <div className="flex items-center gap-2 mb-1">
                <Wallet size={12} className="text-blue-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Total {subView}</span>
            </div>
            <p className="text-2xl font-black italic text-white tracking-tighter">${donorsData.totalARS.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-slate-900/40 border border-white/5 p-5 rounded-[35px] backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><Users size={40}/></div>
            <div className="flex items-center gap-2 mb-1">
                <Users size={12} className="text-emerald-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Personas</span>
            </div>
            <p className="text-2xl font-black italic text-white tracking-tighter">{donorsData.count}</p>
        </div>
      </section>

      {/* 🔍 HEADER Y FILTROS */}
      <header className="space-y-4 px-2">
        <div className="flex justify-between items-end">
          <div className="text-left">
            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none">Inteligencia</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1 italic">
                {eventFilter ? `Filtrando: ${eventFilter}` : 'Gestión Pastoral'}
            </p>
          </div>
          <button onClick={handleCopyWeeklyPrayers} className={`p-4 rounded-2xl border transition-all flex items-center gap-2 active:scale-90 ${copied ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-blue-600/20 border-blue-500/30 text-blue-400'}`}>
            {copied ? <Check size={18} /> : <ClipboardList size={18} />}
            <span className="text-[10px] font-black uppercase tracking-tighter">Copiar Clamor</span>
          </button>
        </div>

        {/* TABS DE SUB-VISTA */}
        <div className="flex bg-slate-900/50 p-1.5 rounded-[22px] border border-white/5 shadow-inner">
            {['diezmos', 'ofrendas'].map((v) => (
                <button key={v} onClick={() => { setSubView(v); setEventFilter(''); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${subView === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                    {v}
                </button>
            ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nombre..." className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all shadow-inner" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
                {[{ id: 'week', label: 'Sem' }, { id: 'month', label: 'Mes' }, { id: 'year', label: 'Año' }].map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} className={`flex-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filter === f.id ? 'bg-slate-800 text-blue-400 border border-blue-500/20 shadow-lg' : 'text-slate-600'}`}>{f.label}</button>
                ))}
            </div>
            
            {/* ✅ SELECTOR DE CULTO REDISEÑADO (MODERNO) */}
            <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/50 group-hover:text-blue-400 transition-colors pointer-events-none">
                    <Ticket size={14} />
                </div>
                <select 
                    value={eventFilter} 
                    onChange={(e) => setEventFilter(e.target.value)} 
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-9 pr-8 text-[9px] font-black uppercase text-blue-400 outline-none appearance-none hover:bg-slate-800 transition-all cursor-pointer"
                >
                    <option value="">Todos los Cultos</option>
                    {donorsData.availableEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">
                    <ChevronDown size={14} />
                </div>
            </div>
          </div>
        </div>
      </header>

      {/* 📋 LISTA DE DADORES (INDIVIDUALES) */}
      <div className="space-y-4 px-1">
        <AnimatePresence mode="popLayout">
          {donorsData.list.map((d, i) => (
            <motion.div key={d.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.05 }} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 p-6 rounded-[40px] shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-active:opacity-100 transition-opacity" />

              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex gap-4 items-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-400 rounded-[22px] flex items-center justify-center text-white font-black text-xl italic shadow-lg shadow-blue-500/30">{d.name[0]}</div>
                  <div className="text-left">
                    <h4 className="text-lg font-black text-white italic tracking-tight leading-none mb-1">{d.name}</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-tighter border border-emerald-500/10">{d.count} Siembras</span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1"><Calendar size={10}/> {d.lastDate.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <p className="text-2xl font-black text-blue-400 italic leading-none">${d.total.toLocaleString('es-AR')}</p>
                    <div className="flex gap-2 opacity-80">
                        {d.cash > 0 && <span className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/10"><Banknote size={10}/> ${d.cash.toLocaleString('es-AR')}</span>}
                        {d.virtual > 0 && <span className="flex items-center gap-1 text-[8px] font-black text-blue-400 uppercase bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/10"><CreditCard size={10}/> ${d.virtual.toLocaleString('es-AR')}</span>}
                    </div>
                    <button onClick={() => handleDeleteFamily(d)} className="p-2 text-slate-700 hover:text-rose-500 transition-colors active:scale-90"><Trash2 size={16}/></button>
                </div>
              </div>

              {/* 🕊️ MURO DE CLAMOR */}
              <div className="space-y-3 pt-4 border-t border-white/5 relative z-10">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={12} className="text-blue-500" />
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-left">Muro de Clamor</p>
                  </div>
                  <Sparkles size={12} className="text-blue-500/40 animate-pulse" />
                </div>
                
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {d.prayers.length > 0 ? d.prayers.map((p, idx) => (
                    <div key={idx} className="bg-slate-950/40 p-4 rounded-[28px] border border-white/5 group/prayer transition-all hover:border-blue-500/30 text-left shadow-inner">
                        <p className="text-[8px] font-black text-blue-500 uppercase italic mb-1">{new Date(p.date).toLocaleDateString()}</p>
                        <p className="text-xs font-medium text-slate-400 italic leading-relaxed text-left">"{p.text}"</p>
                    </div>
                  )).reverse() : (
                    <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-[28px]">
                        <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest text-center italic">Sin peticiones en este periodo</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {donorsData.list.length === 0 && (
          <div className="py-32 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center border border-white/5 opacity-20 shadow-inner"><Ticket size={40} className="text-slate-500" /></div>
            <div className="space-y-1">
                <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em]">Bóveda Vacía</p>
                <p className="text-[9px] font-bold text-slate-800 uppercase italic">Sin registros para {selectedMonth + 1}/{selectedYear}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}