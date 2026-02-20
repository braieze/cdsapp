import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, Zap, ArrowUpRight, ArrowDownLeft, 
  PieChart, BarChart3, Ticket, Target, LayoutDashboard 
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, 
  Tooltip, Legend, ArcElement, PointElement, LineElement 
} from 'chart.js';

// Registrar componentes necesarios de Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, PointElement, LineElement);

export default function FinanceOverview({ stats, finances }) {
  const [timeframe, setTimeframe] = useState('semana'); // semana, mes, año

  // ✅ Formateador de Moneda
  const formatValue = (val) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0
  }).format(val);

  // --- 1. LÓGICA DEL GRÁFICO DE BARRAS (INGRESOS POR PERIODO) - RESPETADO ---
  const barChartData = useMemo(() => {
    let labels = [];
    let dataPoints = [];
    const now = new Date();

    if (timeframe === 'semana') {
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(days[d.getDay()]);
        const sum = finances
          .filter(m => new Date(m.date?.seconds * 1000).toDateString() === d.toDateString() && m.total > 0)
          .reduce((acc, m) => acc + Number(m.total), 0);
        dataPoints.push(sum);
      }
    } else if (timeframe === 'mes') {
      labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
      dataPoints = [stats.ingresos * 0.2, stats.ingresos * 0.3, stats.ingresos * 0.25, stats.ingresos * 0.25];
    } else {
      labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      dataPoints = labels.map((_, i) => finances
        .filter(m => new Date(m.date?.seconds * 1000).getMonth() === i && m.total > 0)
        .reduce((acc, m) => acc + Number(m.total), 0)
      );
    }

    return {
      labels,
      datasets: [{
        label: 'Ingresos',
        data: dataPoints,
        backgroundColor: '#3b82f6',
        borderRadius: 10,
        hoverBackgroundColor: '#60a5fa'
      }]
    };
  }, [finances, timeframe, stats]);

  // --- 2. LÓGICA DE GRÁFICOS DE TORTA (CATEGORÍAS) - RESPETADO ---
  const categoryData = useMemo(() => {
    const expenseMap = {};
    finances.filter(m => m.total < 0).forEach(m => {
      const cat = m.category || 'Otros';
      expenseMap[cat] = (expenseMap[cat] || 0) + Math.abs(m.total);
    });

    return {
      labels: Object.keys(expenseMap),
      datasets: [{
        data: Object.values(expenseMap),
        backgroundColor: ['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6'],
        borderWidth: 0,
        hoverOffset: 15
      }]
    };
  }, [finances]);

  // --- 🆕 3. LÓGICA DE RENDIMIENTO POR EVENTO (NUEVO) ---
  const eventPerformanceData = useMemo(() => {
    const eventMap = {};
    // Filtramos solo los ingresos que tengan un concepto relacionado a un cierre o evento
    finances
      .filter(m => m.total > 0 && (m.eventId || m.concept.includes("Cierre")))
      .forEach(m => {
        const title = m.concept.replace("Cierre de Caja: ", "");
        eventMap[title] = (eventMap[title] || 0) + m.total;
      });

    return {
      labels: Object.keys(eventMap).slice(0, 5), // Top 5 eventos
      datasets: [{
        label: 'Ingresos por Culto',
        data: Object.values(eventMap).slice(0, 5),
        backgroundColor: 'rgba(34, 211, 238, 0.6)', // Cian Crypzone
        borderColor: '#22d3ee',
        borderWidth: 2,
        borderRadius: 8,
      }]
    };
  }, [finances]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { display: false },
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9, weight: 'bold' } } }
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pt-4 pb-20">
      
      {/* 💳 BALANCE MAESTRO - RESPETADO */}
      <section className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[45px] blur opacity-20 transition duration-1000"></div>
        <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[45px] p-8">
          <div className="absolute top-0 right-0 p-6 opacity-10"><Zap size={80} className="text-blue-500" /></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 text-left">Balance Consolidado</p>
          <h2 className="text-5xl font-black italic tracking-tighter text-white mb-8 text-left">{formatValue(stats.total)}</h2>
          <div className="flex gap-4">
            <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5 text-left">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Diezmo Nac.</p>
                <p className="text-sm font-black text-blue-400">{formatValue(stats.total * 0.10)}</p>
            </div>
            <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5 text-left">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Crecimiento</p>
                <div className="flex items-center gap-1 text-emerald-400 font-black text-sm"><TrendingUp size={14}/> +14.5%</div>
            </div>
          </div>
        </div>
      </section>

      {/* 📊 DISTRIBUCIÓN DE GASTOS - RESPETADO */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-[45px]">
        <header className="flex justify-between items-center mb-6">
            <div className="text-left">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Distribución de Gastos</h3>
                <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">Por categorías registradas</p>
            </div>
            <PieChart size={18} className="text-rose-500" />
        </header>
        <div className="flex items-center gap-8 h-40">
            <div className="w-1/2 h-full"><Doughnut data={categoryData} options={{ cutout: '70%', plugins: { legend: { display: false } } }} /></div>
            <div className="w-1/2 space-y-2">
                {categoryData.labels.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-[8px] font-black uppercase text-left">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoryData.datasets[0].backgroundColor[i] }} />
                            <span className="text-slate-400">{l}</span>
                        </div>
                        <span className="text-white">{Math.round((categoryData.datasets[0].data[i] / Math.abs(stats.egresos)) * 100) || 0}%</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* 🆕 GRÁFICO DE RENDIMIENTO POR EVENTO (NUEVO) */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-[45px] shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Ticket size={60} className="text-cyan-400"/></div>
        <header className="flex justify-between items-center mb-6 relative z-10">
            <div className="text-left">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-cyan-400 italic">Analítica de Cultos</h3>
                <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">Comparativa de cierres de caja</p>
            </div>
            <BarChart3 size={18} className="text-cyan-500" />
        </header>
        <div className="h-44">
            <Bar 
              data={eventPerformanceData} 
              options={{
                indexAxis: 'y', // Barra horizontal para nombres de eventos largos
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 8, weight: 'bold' } } }
                }
              }} 
            />
        </div>
      </section>

      {/* 📈 ACTIVIDAD DE INGRESOS - RESPETADO */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-[45px]">
        <header className="flex justify-between items-end mb-8">
            <div className="text-left">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic text-left">Flujo de Ingresos</h3>
                <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">Comparativa temporal</p>
            </div>
            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
                {['semana', 'mes', 'año'].map(t => (
                    <button key={t} onClick={() => setTimeframe(t)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${timeframe === t ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
                        {t}
                    </button>
                ))}
            </div>
        </header>
        <div className="h-48">
            <Bar data={barChartData} options={chartOptions} />
        </div>
      </section>

    </motion.div>
  );
}