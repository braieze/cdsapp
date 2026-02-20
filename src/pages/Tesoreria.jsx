import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  Shield, Home, Plus, ChevronLeft, Activity, BarChart3, 
  Users, List, Download, UserCircle, X, FileText, 
  ArrowUpCircle, ArrowDownCircle, CheckCircle2, AlertCircle,
  CalendarDays, Ticket
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Sub-componentes
import FinanceOverview from './finance/FinanceOverview';
import PendingList from './finance/PendingList';
import MovementHistory from './finance/MovementHistory';
import DonorIntelligence from './finance/DonorIntelligence';
import AdminModals from './finance/AdminModals';

export default function Tesoreria() {
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [activeTab, setActiveTab] = useState('resumen');
  
  // ✅ Estados de Filtro de Tiempo Maestro (Nueva Idea)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // ✅ Estados de Control de Menús (Respetados)
  const [showRegMenu, setShowRegMenu] = useState(false); 
  const [showDownMenu, setShowDownMenu] = useState(false); 
  const [modalType, setModalType] = useState(null); 
  const [customAlert, setCustomAlert] = useState(null); 

  const [finances, setFinances] = useState([]);
  const [pendingOfferings, setPendingOfferings] = useState([]);

  // --- 1. ESCUCHA DE DATOS (Orden Cronológico Respetado) ---
  useEffect(() => {
    if (isLocked) return;
    // La consulta ya ordena por fecha descendente (más reciente primero)
    const unsubFin = onSnapshot(query(collection(db, 'finances'), orderBy('date', 'desc')), (snap) => {
      setFinances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPend = onSnapshot(query(collection(db, 'offerings'), orderBy('date', 'desc')), (snap) => {
      setPendingOfferings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubFin(); unsubPend(); };
  }, [isLocked]);

  // --- 2. ESTADÍSTICAS (Cálculo Corregido del Diezmo Nacional) ---
  const stats = useMemo(() => {
    let balanceNeto = 0; // Lo que hay en caja
    let ingresosBrutos = 0; // Acumulado de ingresos para el Diezmo Nacional
    let egresosMes = 0;

    finances.forEach(m => {
      const amt = Number(m.total || 0);
      const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();
      
      // Balance total histórico
      balanceNeto += amt;

      // Filtrar por Mes/Año seleccionado para el Diezmo Nacional e Ingresos/Egresos
      if (mDate.getMonth() === selectedMonth && mDate.getFullYear() === selectedYear) {
        if (amt > 0) ingresosBrutos += amt; 
        else egresosMes += Math.abs(amt);
      }
    });

    return { 
      total: balanceNeto, 
      ingresos: ingresosBrutos, 
      egresos: egresosMes,
      diezmoNacional: ingresosBrutos * 0.10 // ✅ Corregido: 10% del acumulado de ingresos
    };
  }, [finances, selectedMonth, selectedYear]);

  // --- 3. FUNCIONES DE EXPORTACIÓN (Con opción de eventos) ---
  const exportarPDF = (tipo, eventData = null) => {
    const doc = new jsPDF();
    const titulo = eventData ? `CIERRE: ${eventData.concept.toUpperCase()}` : `REPORTE ${tipo.toUpperCase()} - CDS`;
    doc.text(titulo, 14, 15);
    
    const dataFiltrada = eventData 
      ? finances.filter(m => m.eventId === eventData.eventId || m.concept === eventData.concept)
      : finances;

    const data = dataFiltrada.map(m => [
      new Date(m.date?.seconds * 1000).toLocaleDateString(),
      m.concept,
      m.total > 0 ? 'Ingreso' : 'Egreso',
      `$${Math.abs(m.total).toLocaleString('es-AR')}`
    ]);

    doc.autoTable({ head: [['Fecha', 'Detalle', 'Tipo', 'Monto']], body: data, startY: 20 });
    doc.save(`CDS_${tipo}_${Date.now()}.pdf`);
    setShowDownMenu(false);
  };

  const handleUnlock = () => {
    if (pin === "2367") setIsLocked(false);
    else { setPin(""); alert("PIN Incorrecto"); }
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-[300] flex flex-col items-center justify-center p-8 font-outfit text-white">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-slate-900/50 backdrop-blur-xl border border-white/10 p-10 rounded-[40px] text-center shadow-2xl">
          <Shield className="text-blue-500 mx-auto mb-6" size={48} />
          <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-8 text-white">Acceso Protegido</h2>
          <input 
            type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={4}
            className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-3xl p-6 text-center text-4xl tracking-[0.5em] font-black mb-6 outline-none focus:border-blue-500 text-white"
            placeholder="••••" autoFocus onKeyUp={(e) => e.key === 'Enter' && handleUnlock()}
          />
          <button onClick={handleUnlock} className="w-full bg-blue-600 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all text-white">Desbloquear</button>
          <button onClick={() => navigate('/apps')} className="mt-8 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"><Home size={14}/> Salir</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-[250] flex flex-col font-outfit text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.12),transparent)] pointer-events-none" />

      {/* 🛰️ HEADER DINÁMICO (Z-INDEX Corregido para Menú Descarga) */}
      <header className="flex items-center justify-between px-6 pt-12 pb-6 relative z-[60]">
        <button onClick={() => navigate('/apps')} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all text-white"><ChevronLeft size={24} /></button>
        
        <div className="text-center">
          <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none text-white">Caja CDS</h1>
          <p className="text-[8px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-1">Bóveda Digital</p>
        </div>

        <div className="flex gap-2 relative">
          {/* ✅ Menú de Descargas Profesional (Z-INDEX Alto) */}
          <button onClick={() => setShowDownMenu(!showDownMenu)} className={`p-3 rounded-2xl border transition-all z-10 ${showDownMenu ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-600/20 border-blue-500/30 text-blue-400'}`}>
            <Download size={20} />
          </button>
          
          <AnimatePresence>
            {showDownMenu && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-16 right-0 w-52 bg-slate-900 border border-white/10 rounded-[30px] p-3 shadow-2xl z-[100]">
                <p className="text-[8px] font-black text-slate-500 uppercase p-2 tracking-widest text-left">Descargar Auditoría</p>
                <button onClick={() => exportarPDF('semanal')} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-white border-b border-white/5"><FileText size={14} className="text-blue-500"/> Semanal</button>
                <button onClick={() => exportarPDF('mensual')} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-white border-b border-white/5"><CalendarDays size={14} className="text-emerald-500"/> Mensual</button>
                <button onClick={() => setActiveTab('historial')} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-white"><Ticket size={14} className="text-cyan-500"/> Por Evento</button>
              </motion.div>
            )}
          </AnimatePresence>

          <button className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 active:scale-90 transition-all"><UserCircle size={20} /></button>
        </div>
      </header>

      {/* 📅 SELECTOR DE PERIODO DE AUDITORÍA (Nueva Idea) */}
      <div className="px-6 pb-4 flex gap-2 relative z-50">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl p-3 text-[10px] font-black uppercase text-blue-400 outline-none"
          >
            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-24 bg-slate-900/50 border border-white/5 rounded-xl p-3 text-[10px] font-black uppercase text-blue-400 outline-none"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
      </div>

      {/* 📊 ÁREA DE CONTENIDO */}
      <main className="flex-1 overflow-y-auto px-6 pb-40 relative z-10 custom-scrollbar text-left">
        <AnimatePresence mode="wait">
          {activeTab === 'resumen' && <FinanceOverview key="resumen" stats={stats} finances={finances} />}
          {activeTab === 'pendientes' && <PendingList key="pendientes" items={pendingOfferings} />}
          {activeTab === 'historial' && <MovementHistory key="historial" movements={finances} setCustomAlert={setCustomAlert} />}
          {activeTab === 'pastoral' && <DonorIntelligence key="pastoral" movements={finances} setCustomAlert={setCustomAlert} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
        </AnimatePresence>
      </main>

      {/* 🛸 NAVEGACIÓN CRYPZONE (Respetada) */}
      <nav className="absolute bottom-8 left-6 right-6 h-20 bg-slate-900/80 backdrop-blur-2xl rounded-[35px] border border-white/10 flex items-center justify-around px-2 shadow-2xl z-20">
        {[
          { id: 'resumen', icon: BarChart3 },
          { id: 'pendientes', icon: Activity, badge: pendingOfferings.length },
          { id: 'historial', icon: List },
          { id: 'pastoral', icon: Users }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all relative ${activeTab === t.id ? 'text-blue-400' : 'text-slate-500'}`}>
            <div className={`p-2 rounded-xl ${activeTab === t.id ? 'bg-blue-500/10 scale-110' : ''}`}><t.icon size={24} /></div>
            {t.badge > 0 && <span className="absolute top-4 right-4 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">{t.badge}</span>}
          </button>
        ))}
        
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <AnimatePresence>
                {showRegMenu && (
                    <motion.div initial={{ opacity: 0, y: 20, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.5 }} className="flex gap-3 mb-4 bg-slate-900 p-2 rounded-[30px] border border-white/10 shadow-2xl">
                        <button onClick={() => {setModalType('expense'); setShowRegMenu(false)}} className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all"><ArrowDownCircle size={20}/></button>
                        <button onClick={() => {setModalType('income'); setShowRegMenu(false)}} className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all"><ArrowUpCircle size={20}/></button>
                    </motion.div>
                )}
            </AnimatePresence>
            <button onClick={() => setShowRegMenu(!showRegMenu)} className={`w-16 h-16 rounded-[22px] shadow-2xl flex items-center justify-center border-4 border-slate-950 transition-all ${showRegMenu ? 'bg-slate-800 text-blue-400 rotate-45' : 'bg-blue-600 text-white shadow-blue-500/40'}`}>
              <Plus size={32} strokeWidth={3} />
            </button>
        </div>
      </nav>

      {/* ✅ MODALES (Se pasa setCustomAlert correctamente) */}
      <AnimatePresence>
        {modalType && (
          <AdminModals 
            type={modalType} 
            onClose={() => setModalType(null)} 
            setCustomAlert={setCustomAlert} 
          />
        )}
      </AnimatePresence>

      {/* ✅ SISTEMA DE ALERTA (Respetado) */}
      <AnimatePresence>
        {customAlert && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-white/10 p-8 rounded-[40px] w-full max-w-xs text-center shadow-2xl">
              {customAlert.type === 'confirm' ? <AlertCircle className="mx-auto mb-4 text-rose-500" size={40}/> : <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={40}/>}
              <h4 className="text-white font-black uppercase italic tracking-tighter text-lg mb-2 text-center">{customAlert.title}</h4>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-8 leading-relaxed text-center">{customAlert.message}</p>
              <div className="flex gap-2">
                <button onClick={() => setCustomAlert(null)} className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-500">Cancelar</button>
                <button onClick={() => {customAlert.onConfirm(); setCustomAlert(null)}} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase text-white ${customAlert.type === 'confirm' ? 'bg-rose-500' : 'bg-emerald-500'}`}>Aceptar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}