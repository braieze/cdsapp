import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Zap } from 'lucide-react';

export default function FinanceOverview({ stats = { total: 0, incomes: 0, expenses: 0 } }) {
  
  // ✅ Formateador profesional para moneda
  const formatValue = (val) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0
  }).format(val);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pt-4"
    >
      {/* 💳 BALANCE GIGANTE (ESTILO CRYPZONE) */}
      <section className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[40px] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-20"><Zap size={100} className="text-blue-500" /></div>
          
          <header className="flex items-center gap-2 mb-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Total Balance</span>
          </header>
          
          <h2 className="text-5xl font-black italic tracking-tighter text-white mb-6">
            {formatValue(stats.total)}
          </h2>

          <div className="flex gap-4">
            <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Weekly Growth</p>
                <div className="flex items-center gap-1 text-emerald-400 font-black text-sm">
                    <TrendingUp size={14}/> +14.5%
                </div>
            </div>
            <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Monthly Tithe</p>
                <div className="text-sm font-black text-blue-400">
                    {formatValue(stats.total * 0.10)}
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* 📊 MINI GRÁFICO Y STATS RÁPIDAS */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-[35px] flex flex-col justify-between h-40">
            <div className="bg-emerald-500/20 text-emerald-500 p-2 rounded-xl w-fit"><ArrowUpRight size={20}/></div>
            <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Incomes</p>
                <p className="text-xl font-black text-white">{formatValue(stats.incomes)}</p>
            </div>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-[35px] flex flex-col justify-between h-40">
            <div className="bg-rose-500/20 text-rose-500 p-2 rounded-xl w-fit"><ArrowDownLeft size={20}/></div>
            <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Expenses</p>
                <p className="text-xl font-black text-white">{formatValue(stats.expenses)}</p>
            </div>
        </div>
      </div>

      {/* 📉 GRÁFICO DE BARRAS (PLACEHOLDER VISUAL) */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-[40px]">
        <div className="flex justify-between items-end mb-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Statistics</h3>
            <div className="flex gap-2 text-[8px] font-black uppercase">
                <span className="px-3 py-1 bg-blue-600 rounded-full">Daily</span>
                <span className="px-3 py-1 bg-white/5 rounded-full text-slate-500">Weekly</span>
            </div>
        </div>
        <div className="flex items-end justify-between gap-2 h-32">
            {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} className="flex-1 group relative">
                    <motion.div 
                        initial={{ height: 0 }} animate={{ height: `${h}%` }}
                        className={`w-full rounded-t-lg transition-all ${i === 3 ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 group-hover:bg-slate-700'}`}
                    />
                </div>
            ))}
        </div>
      </section>
    </motion.div>
  );
}