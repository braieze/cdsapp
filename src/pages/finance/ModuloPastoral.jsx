import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Unlock, Eye, EyeOff, Save, History, 
  TrendingUp, Wallet, X, ShieldCheck, Loader2,
  Banknote, CalendarDays, ArrowRight
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where } from 'firebase/firestore';

export default function ModuloPastoral({ onClose, setCustomAlert, finances }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState([]);
  
  const [amount, setAmount] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // ✅ 1. CARGAR HISTORIAL PRIVADO DE SUELDOS
  useEffect(() => {
    if (!isUnlocked) return;
    const q = query(collection(db, 'pastoral_salary'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSalaryHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [isUnlocked]);

  // ✅ 2. CÁLCULO DE DISPONIBILIDAD (Basado en ingresos del mes)
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const ingresos = finances
      .filter(m => {
        const mDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date();
        return mDate.getMonth() === selectedMonth && m.total > 0;
      })
      .reduce((sum, m) => sum + m.total, 0);
    
    return {
      ingresos,
      sugerido: ingresos * 0.10 // Sugerencia basada en el 10% ministerial
    };
  }, [finances, selectedMonth]);

  const handleUnlock = () => {
    // Contraseña única para el sueldo (puedes cambiarla aquí o traerla de un perfil)
    if (password === "7777") {
      setIsUnlocked(true);
    } else {
      setPassword("");
      if (setCustomAlert) setCustomAlert({ title: "Acceso Denegado", message: "Contraseña pastoral incorrecta.", type: "error" });
    }
  };

  const handleSaveSalary = async () => {
    if (!amount || amount <= 0) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'pastoral_salary'), {
        amount: Number(amount),
        month: selectedMonth,
        year: new Date().getFullYear(),
        created_at: serverTimestamp(),
        status: 'liquidado'
      });
      setAmount("");
      if (setCustomAlert) setCustomAlert({ title: "Registro Exitoso", message: "Honorarios mensuales guardados.", type: "success" });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[500] flex flex-col font-outfit text-left"
    >
      {/* HEADER PRIVADO */}
      <header className="p-8 pt-12 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/20 rounded-2xl text-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.2)]">
                <ShieldCheck size={24} />
            </div>
            <div>
                <h2 className="text-xl font-black italic text-white uppercase tracking-tighter leading-none">Gestión de Honorarios</h2>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Nivel de Seguridad: Pastoral</p>
            </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors"><X/></button>
      </header>

      {!isUnlocked ? (
        /* 🔒 PANTALLA DE BLOQUEO INTERNA */
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
            <div className="text-center space-y-2">
                <Lock className="mx-auto text-blue-500/30 animate-pulse" size={60} />
                <h3 className="text-white font-black uppercase italic tracking-widest">Contraseña Requerida</h3>
                <p className="text-[9px] text-slate-600 font-bold uppercase">Este módulo contiene información de sueldos privada</p>
            </div>
            
            <div className="w-full max-w-xs relative">
                <input 
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña Pastoral"
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl p-5 text-center text-white font-black tracking-[0.5em] outline-none focus:border-blue-500 transition-all"
                    onKeyUp={(e) => e.key === 'Enter' && handleUnlock()}
                />
                <button 
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"
                >
                    {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
            </div>

            <button onClick={handleUnlock} className="w-full max-w-xs bg-blue-600 text-white py-5 rounded-[25px] font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                Validar Identidad
            </button>
        </div>
      ) : (
        /* 🔓 PANEL DE GESTIÓN ACTIVO */
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* ESTADÍSTICAS DE APOYO */}
            <section className="bg-slate-900/40 border border-white/5 p-8 rounded-[45px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12"><TrendingUp size={100} /></div>
                <div className="relative z-10 flex flex-col gap-6">
                    <header className="flex justify-between items-center">
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-blue-400 outline-none"
                        >
                            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Análisis Mensual</span>
                    </header>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Ingreso Total Ministerio</p>
                            <h4 className="text-3xl font-black text-white italic tracking-tighter">${currentMonthStats.ingresos.toLocaleString('es-AR')}</h4>
                        </div>
                        <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-[25px]">
                            <p className="text-[8px] font-black text-blue-400 uppercase mb-1 tracking-widest italic">Asignación Sugerida (10%)</p>
                            <h4 className="text-xl font-black text-blue-400 italic">${currentMonthStats.sugerido.toLocaleString('es-AR')}</h4>
                        </div>
                    </div>
                </div>
            </section>

            {/* FORMULARIO DE REGISTRO */}
            <section className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 italic">Liquidar Honorarios</h4>
                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[40px] space-y-6">
                    <div className="relative">
                        <Banknote className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input 
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Monto a percibir $"
                            className="w-full bg-slate-950/50 border border-white/5 rounded-3xl p-6 pl-14 text-white text-2xl font-black outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    <button 
                        onClick={handleSaveSalary}
                        disabled={loading}
                        className="w-full bg-emerald-600 py-6 rounded-[30px] font-black uppercase text-xs tracking-widest shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all text-white"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Save size={18}/>}
                        Confirmar Liquidación
                    </button>
                </div>
            </section>

            {/* HISTORIAL PRIVADO */}
            <section className="space-y-4 pb-20">
                <div className="flex items-center gap-2 ml-4">
                    <History size={14} className="text-slate-500" />
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Historial de Honorarios</h4>
                </div>
                <div className="space-y-3">
                    {salaryHistory.map((s, i) => (
                        <div key={i} className="bg-slate-900/60 border border-white/5 p-5 rounded-[30px] flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/5 rounded-2xl text-slate-400">
                                    <CalendarDays size={18} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-white uppercase italic">Honorarios del Periodo</p>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                        {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][s.month]} {s.year}
                                    </p>
                                </div>
                            </div>
                            <p className="text-lg font-black italic text-emerald-400">${s.amount.toLocaleString('es-AR')}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
      )}
    </motion.div>
  );
}