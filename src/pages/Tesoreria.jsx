import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  Shield, Home, Plus, ChevronLeft, 
  Activity, BarChart3, Users, Settings2, List
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Importación de sub-componentes (asegurate de que las rutas sean correctas)
import FinanceOverview from './finance/FinanceOverview';
import PendingList from './finance/PendingList';
import MovementHistory from './finance/MovementHistory';
import AdminModals from './finance/AdminModals';

export default function Tesoreria() {
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [activeTab, setActiveTab] = useState('resumen');
  const [showModal, setShowModal] = useState(false); // ✅ Control del modal de carga
  
  // Estados de datos
  const [finances, setFinances] = useState([]);
  const [pendingOfferings, setPendingOfferings] = useState([]);

  // --- 1. ESCUCHA DE DATOS EN TIEMPO REAL ---
  useEffect(() => {
    if (isLocked) return;

    // Movimientos confirmados
    const qFin = query(collection(db, 'finances'), orderBy('date', 'desc'));
    const unsubFin = onSnapshot(qFin, (snap) => {
      setFinances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Ofrendas pendientes (QR)
    const qPend = query(collection(db, 'offerings'), orderBy('date', 'desc'));
    const unsubPend = onSnapshot(qPend, (snap) => {
      setPendingOfferings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubFin(); unsubPend(); };
  }, [isLocked]);

  // --- 2. CÁLCULO DE ESTADÍSTICAS (CRYPZONE STATS) ---
  const stats = useMemo(() => {
    let total = 0, incomes = 0, expenses = 0;
    const now = new Date();
    
    finances.forEach(m => {
      const amt = Number(m.total || 0);
      total += amt;

      // Lógica de mes actual para las tarjetas rápidas
      const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();
      if (mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear()) {
        if (amt > 0) incomes += amt;
        else expenses += Math.abs(amt);
      }
    });

    return { total, incomes, expenses };
  }, [finances]);

  // --- 3. GESTIÓN DE SEGURIDAD ---
  const handleUnlock = () => {
    if (pin === "2367") {
      setIsLocked(false);
    } else {
      setPin("");
      alert("Acceso Denegado: PIN Incorrecto");
    }
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-[300] flex flex-col items-center justify-center p-8 font-outfit">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-slate-900/50 backdrop-blur-xl border border-white/10 p-10 rounded-[40px] text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
            <Shield className="text-blue-500" size={40} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2 italic">Vault Access</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">Ministerio CDS • Tesorería</p>
          
          <input 
            type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={4}
            className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-3xl p-6 text-center text-4xl tracking-[0.5em] text-white font-black mb-6 focus:border-blue-500 transition-all outline-none"
            placeholder="••••" autoFocus
            onKeyUp={(e) => e.key === 'Enter' && handleUnlock()}
          />
          
          <button 
            onClick={handleUnlock}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            Desbloquear Bóveda
          </button>
          
          <button onClick={() => navigate('/apps')} className="mt-8 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
             <Home size={14}/> Salir a Menú Principal
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-[250] flex flex-col font-outfit text-white overflow-hidden">
      {/* 🌌 EFECTO DE LUZ DE FONDO */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.12),transparent)] pointer-events-none" />

      {/* 🛰️ HEADER PREMIUM */}
      <header className="flex items-center justify-between px-6 pt-12 pb-6 relative z-10">
        <button onClick={() => navigate('/apps')} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">Caja CDS</h1>
          <p className="text-[8px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-1">Gestión Centralizada</p>
        </div>
        <button className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all">
          <Settings2 size={24} />
        </button>
      </header>

      {/* 📊 ÁREA DE CONTENIDO DINÁMICO */}
      <main className="flex-1 overflow-y-auto px-6 pb-40 relative z-10 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'resumen' && (
            <FinanceOverview key="resumen" stats={stats} movements={finances} />
          )}
          {activeTab === 'pendientes' && (
            <PendingList key="pendientes" items={pendingOfferings} />
          )}
          {activeTab === 'historial' && (
            <MovementHistory key="historial" movements={finances} />
          )}
        </AnimatePresence>
      </main>

      {/* 🛸 CUSTOM BOTTOM NAVIGATION */}
      <nav className="absolute bottom-8 left-6 right-6 h-20 bg-slate-900/80 backdrop-blur-2xl rounded-[35px] border border-white/10 flex items-center justify-around px-2 shadow-2xl z-20">
        {[
          { id: 'resumen', icon: BarChart3, label: 'Resumen' },
          { id: 'pendientes', icon: Activity, label: 'Pendientes', badge: pendingOfferings.length },
          { id: 'historial', icon: List, label: 'Historial' },
          { id: 'pastoral', icon: Users, label: 'Pastoral' }
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button 
              key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all relative ${isActive ? 'text-blue-400' : 'text-slate-500'}`}
            >
              <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-blue-500/10 scale-110' : ''}`}>
                <Icon size={isActive ? 28 : 24} />
              </div>
              {t.badge > 0 && (
                <span className="absolute top-4 right-4 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
        
        {/* BOTÓN FLOTANTE: REGISTRAR INGRESO/EGRESO */}
        <button 
          onClick={() => setShowModal(true)}
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-16 h-16 bg-blue-600 text-white rounded-[22px] shadow-[0_10px_30px_rgba(37,99,235,0.4)] flex items-center justify-center active:scale-90 transition-all border-4 border-slate-950"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      </nav>

      {/* ✅ MODAL DE CARGA MANUAL INTEGRADO */}
      <AnimatePresence>
        {showModal && (
          <AdminModals 
            type="income" 
            onClose={() => setShowModal(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}