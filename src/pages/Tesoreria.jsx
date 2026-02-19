import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  Shield, Home, Plus, ChevronLeft, 
  Activity, BarChart3, Users, List, Download, UserCircle,
  ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Sub-componentesss
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
  
  // ✅ MODIFICADO: modalType ahora controla qué tipo de registro abrir
  const [modalType, setModalType] = useState(null); // 'income', 'expense' o null
  
  const [finances, setFinances] = useState([]);
  const [pendingOfferings, setPendingOfferings] = useState([]);

  // --- 1. ESCUCHA DE DATOS EN TIEMPO REAL ---
  useEffect(() => {
    if (isLocked) return;

    const qFin = query(collection(db, 'finances'), orderBy('date', 'desc'));
    const unsubFin = onSnapshot(qFin, (snap) => {
      setFinances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qPend = query(collection(db, 'offerings'), orderBy('date', 'desc'));
    const unsubPend = onSnapshot(qPend, (snap) => {
      setPendingOfferings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubFin(); unsubPend(); };
  }, [isLocked]);

  // --- 2. CÁLCULO DE ESTADÍSTICAS ---
  const stats = useMemo(() => {
    let total = 0, ingresos = 0, egresos = 0;
    const now = new Date();
    
    finances.forEach(m => {
      const amt = Number(m.total || 0);
      total += amt;

      const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();
      if (mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear()) {
        if (amt > 0) ingresos += amt;
        else egresos += Math.abs(amt);
      }
    });

    return { total, ingresos, egresos };
  }, [finances]);

  // --- 3. LÓGICA DE SEGURIDAD Y REPORTES ---
  const handleUnlock = () => {
    if (pin === "2367") setIsLocked(false);
    else { setPin(""); alert("PIN Incorrecto"); }
  };

  const exportarReporte = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("REPORTE FINANCIERO - MINISTERIO CDS", 14, 20);
    const tablaData = finances.map(m => [
      m.date?.seconds ? new Date(m.date.seconds * 1000).toLocaleDateString() : 'S/D',
      m.concept || 'Sin concepto',
      m.total > 0 ? 'Ingreso' : 'Egreso',
      `$${Math.abs(m.total).toLocaleString('es-AR')}`
    ]);
    doc.autoTable({
      head: [['Fecha', 'Detalle', 'Tipo', 'Monto']],
      body: tablaData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });
    doc.save(`Reporte_CDS_${new Date().toLocaleDateString()}.pdf`);
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-[300] flex flex-col items-center justify-center p-8 font-outfit">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-slate-900/50 backdrop-blur-xl border border-white/10 p-10 rounded-[40px] text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
            <Shield className="text-blue-500" size={40} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Acceso Protegido</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">Bóveda Ministerial CDS</p>
          
          <input 
            type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={4}
            className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-3xl p-6 text-center text-4xl tracking-[0.5em] text-white font-black mb-6 focus:border-blue-500 outline-none"
            placeholder="••••" autoFocus onKeyUp={(e) => e.key === 'Enter' && handleUnlock()}
          />
          
          <button 
            onClick={handleUnlock}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            Desbloquear
          </button>
          
          <button onClick={() => navigate('/apps')} className="mt-8 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
             <Home size={14}/> Volver al Inicio
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-[250] flex flex-col font-outfit text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.12),transparent)] pointer-events-none" />

      {/* 🛰️ HEADER PREMIUM */}
      <header className="flex items-center justify-between px-6 pt-12 pb-6 relative z-10">
        <button onClick={() => navigate('/apps')} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all flex items-center gap-2">
          <ChevronLeft size={20} className="text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-widest">Atrás</span>
        </button>
        <div className="text-center">
          <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">Caja CDS</h1>
          <p className="text-[8px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-1">Gestión Centralizada</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarReporte} className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30 text-blue-400 active:scale-90 transition-all">
            <Download size={20} />
          </button>
          <button className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 active:scale-90 transition-all">
            <UserCircle size={20} />
          </button>
        </div>
      </header>

      {/* 📊 ÁREA DE CONTENIDO */}
      <main className="flex-1 overflow-y-auto px-6 pb-40 relative z-10 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'resumen' && <FinanceOverview key="resumen" stats={stats} finances={finances} />}
          {activeTab === 'pendientes' && <PendingList key="pendientes" items={pendingOfferings} />}
          {activeTab === 'historial' && <MovementHistory key="historial" movements={finances} />}
          {activeTab === 'pastoral' && <DonorIntelligence key="pastoral" movements={finances} />}
        </AnimatePresence>
      </main>

      {/* 🛸 BARRA DE NAVEGACIÓN CRYPZONE */}
      <nav className="absolute bottom-8 left-6 right-6 h-20 bg-slate-900/80 backdrop-blur-2xl rounded-[35px] border border-white/10 flex items-center justify-around px-2 shadow-2xl z-20">
        {[
          { id: 'resumen', icon: BarChart3 },
          { id: 'pendientes', icon: Activity, badge: pendingOfferings.length },
          { id: 'historial', icon: List },
          { id: 'pastoral', icon: Users }
        ].map(t => (
          <button 
            key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all relative ${activeTab === t.id ? 'text-blue-400' : 'text-slate-500'}`}
          >
            <div className={`p-2 rounded-xl ${activeTab === t.id ? 'bg-blue-500/10 scale-110' : ''}`}>
              <t.icon size={24} />
            </div>
            {t.badge > 0 && (
              <span className="absolute top-4 right-4 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                {t.badge}
              </span>
            )}
          </button>
        ))}
        
        {/* ✅ BOTÓN FLOTANTE: Ahora permite elegir entre Ingreso o Egreso */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="flex gap-2 mb-2 scale-90">
                <button onClick={() => setModalType('expense')} className="w-12 h-12 bg-rose-500 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all border-4 border-slate-950">
                    <ArrowDownCircle size={20} />
                </button>
                <button onClick={() => setModalType('income')} className="w-12 h-12 bg-emerald-500 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all border-4 border-slate-950">
                    <ArrowUpCircle size={20} />
                </button>
            </div>
            <div className="w-16 h-1 bg-blue-500/20 rounded-full blur-sm" />
        </div>
      </nav>

      {/* ✅ MODAL DE CARGA DUAL */}
      <AnimatePresence>
        {modalType && (
          <AdminModals 
            type={modalType} 
            onClose={() => setModalType(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}