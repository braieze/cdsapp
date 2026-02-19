import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap, BarChart3, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Tooltip, 
  Legend 
} from 'chart.js';

// Registrar componentes de Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function FinanceOverview({ stats, finances }) {
  
  // ✅ FORMATEADOR DE MONEDA ARGENTINA
  const formatCurrency = (val) => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(val);

  // ✅ PROCESAMIENTO DE DATOS PARA EL GRÁFICO (Últimos 7 días)
  const chartData = useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const last7Days = [];
    const totals = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(days[d.getDay()]);
      
      // Filtrar finanzas de ese día específico
      const dailySum = finances
        .filter(m => {
          const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();
          return mDate.toDateString() === d.toDateString() && m.total > 0;
        })
        .reduce((sum, m) => sum + Number(m.total), 0);
      
      totals.push(dailySum);
    }

    return {
      labels: last7Days,
      datasets: [{
        label: 'Ingresos',
        data: totals,
        backgroundColor: '#3b82f6', // Azul Eléctrico Crypzone
        borderRadius: 12,
        borderSkipped: false,
        hoverBackgroundColor: '#60a5fa'
      }]
    };
  }, [finances]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { display: false },
      x: { 
        grid: { display: false }, 
        ticks: { color: '#64748b', font: { size: 10, weight: 'bold' } } 
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pt-4 pb-10"
    >
      {/* 💎 TARJETA DE BALANCE MAESTRA */}
      <section className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[45px] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[45px] p-8 overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 animate-pulse">
            <Zap size={100} className="text-blue-500" />
          </div>
          
          <header className="flex items-center gap-2 mb-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Balance Consolidado</span>
          </header>
          
          <h2 className="text-5xl font-black italic tracking-tighter text-white mb-8 text-left">
            {formatCurrency(stats.total)}
          </h2>

          <div className="flex gap-4">
            <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Crecimiento</p>
                <div className="flex items-center gap-1 text-emerald-400 font-black text-sm">
                    <TrendingUp size={14}/> +14.5%
                </div>
            </div>
            <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Diezmo Nacional</p>
                <div className="text-sm font-black text-blue-400">
                    {formatCurrency(stats.total * 0.10)}
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* 📊 MINI CARDS DE FLUJO MENSUAL */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-[35px] flex flex-col justify-between h-40">
            <div className="bg-emerald-500/10 text-emerald-500 p-2 rounded-xl w-fit shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <ArrowUpRight size={20}/>
            </div>
            <div className="text-left">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ingresos Mes</p>
                <p className="text-xl font-black text-white">{formatValue(stats.ingresos)}</p>
            </div>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-[35px] flex flex-col justify-between h-40">
            <div className="bg-rose-500/10 text-rose-500 p-2 rounded-xl w-fit shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <ArrowDownLeft size={20}/>
            </div>
            <div className="text-left">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Egresos Mes</p>
                <p className="text-xl font-black text-white">{formatValue(stats.egresos)}</p>
            </div>
        </div>
      </div>

      {/* 📈 GRÁFICO DE ESTADÍSTICAS REALES */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-[45px]">
        <header className="flex justify-between items-end mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Estadísticas Semanales</h3>
            <div className="flex gap-2">
                <span className="px-3 py-1 bg-blue-600 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-lg shadow-blue-500/20 text-white">Diario</span>
                <span className="px-3 py-1 bg-white/5 rounded-full text-[8px] font-black uppercase text-slate-500">Semanal</span>
            </div>
        </header>
        <div className="h-48">
            <Bar data={chartData} options={chartOptions} />
        </div>
      </section>
    </motion.div>
  );

  // Helper local para formatear sin repetir código
  function formatValue(val) {
     return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);
  }
}