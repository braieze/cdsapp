import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { 
  Shield, Wallet, ArrowUp, ArrowRight, List, Users, Briefcase, 
  Trash, Plus, Check, X, ChevronLeft, Loader2, TrendingUp, TrendingDown 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Tesoreria() {
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState('overview'); // overview, pending, movements, donors
  const [finances, setFinances] = useState([]);
  const [pendingOfferings, setPendingOfferings] = useState([]);

  // --- 1. CARGA DE DATOS EN VIVO ---
  useEffect(() => {
    // Escuchar movimientos de tesorería generales
    const qFin = query(collection(db, 'finances'), orderBy('date', 'desc'));
    const unsubFin = onSnapshot(qFin, (snap) => {
      setFinances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // ✅ NUEVO: Escuchar ofrendas pendientes del QR/App
    const qPend = query(collection(db, 'offerings'), orderBy('date', 'desc'));
    const unsubPend = onSnapshot(qPend, (snap) => {
      setPendingOfferings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubFin(); unsubPend(); };
  }, []);

  // --- 2. LÓGICA DE SEGURIDAD ---
  const handleUnlock = () => {
    if (pin === "2367") setIsLocked(false);
    else { alert("PIN Incorrecto"); setPin(""); }
  };

  // --- 3. PROCESAMIENTO DE ESTADÍSTICAS ---
  const stats = useMemo(() => {
    let total = 0, incomes = 0, expenses = 0;
    const now = new Date();
    finances.forEach(m => {
      const amt = parseFloat(m.total || 0);
      total += amt;
      if (new Date(m.date?.seconds * 1000).getMonth() === now.getMonth()) {
        if (amt > 0) incomes += amt;
        else expenses += Math.abs(amt);
      }
    });
    return { total, incomes, expenses, tithe: incomes * 0.10 };
  }, [finances]);

  // --- 4. ACCIONES DE TESORERÍA ---
  const confirmTransfer = async (offering) => {
    try {
      // 1. Mover a la colección de finanzas oficial
      await addDoc(collection(db, 'finances'), {
        concept: `Transferencia: ${offering.fullName}`,
        total: offering.amount,
        type: offering.type,
        date: offering.date,
        method: 'Banco',
        uid: offering.uid,
        prayer: offering.prayerRequest
      });
      // 2. Borrar de pendientes
      await deleteDoc(doc(db, 'offerings', offering.id));
    } catch (e) { console.error(e); }
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 z-[200] font-outfit">
        <header className="text-center mb-10">
            <div className="w-20 h-20 bg-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-brand-500/20">
                <Shield className="text-white" size={40} />
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Tesorería</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Ministerio CDS</p>
        </header>
        <div className="w-full max-w-xs space-y-6">
            <div className="flex justify-center gap-4">
                {[1, 2, 3, 4].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-brand-500 scale-125 shadow-glow' : 'bg-slate-700'}`}></div>
                ))}
            </div>
            <input 
                type="password" value={pin} maxLength={4} onChange={(e) => setPin(e.target.value)}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-[30px] p-6 text-center text-3xl tracking-[0.5em] text-white font-black outline-none focus:border-brand-500 transition-all"
                placeholder="••••" autoFocus
            />
            <button onClick={handleUnlock} className="w-full bg-brand-600 text-white py-6 rounded-[30px] font-black uppercase text-sm shadow-xl active:scale-95 transition-all">
                Desbloquear
            </button>
            <button onClick={() => navigate('/apps')} className="w-full text-slate-500 text-[10px] font-black uppercase tracking-widest py-2">← Volver al Inicio</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-outfit">
      {/* 🚀 HEADER DASHBOARD */}
      <header className="bg-slate-900 text-white pt-14 pb-8 px-6 rounded-b-[45px] shadow-2xl">
        <div className="flex justify-between items-start mb-8">
            <div>
                <h2 className="text-2xl font-black tracking-tighter uppercase italic leading-none">Gestión</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Financiera CDS</p>
            </div>
            <button onClick={() => setIsLocked(true)} className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 active:scale-90 transition-all">
                <Shield size={20} />
            </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[35px] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={80}/></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Balance Total</p>
            <h3 className="text-4xl font-black text-white leading-none">${stats.total.toLocaleString('es-AR')}</h3>
            <div className="mt-6 flex gap-4">
                <div className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-emerald-400 uppercase mb-1">Ingresos Mes</p>
                    <p className="text-sm font-black text-white">+${stats.incomes.toLocaleString('es-AR')}</p>
                </div>
                <div className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-rose-400 uppercase mb-1">Gastos Mes</p>
                    <p className="text-sm font-black text-white">-${stats.expenses.toLocaleString('es-AR')}</p>
                </div>
            </div>
        </div>
      </header>

      {/* TABS DE NAVEGACIÓN */}
      <nav className="flex p-4 gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Resumen', icon: List },
          { id: 'pending', label: 'Por Confirmar', icon: Wallet, badge: pendingOfferings.length },
          { id: 'movements', label: 'Movimientos', icon: TrendingUp },
          { id: 'donors', label: 'Diezmantes', icon: Users }
        ].map(t => (
          <button 
            key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 transition-all ${tab === t.id ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-white text-slate-400 shadow-sm border border-slate-100'}`}
          >
            <t.icon size={14} /> {t.label}
            {t.badge > 0 && <span className="bg-brand-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{t.badge}</span>}
          </button>
        ))}
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto px-6 pb-24 space-y-6">
        
        {/* --- VISTA: OFRENDAS PENDIENTES DEL QR --- */}
        {tab === 'pending' && (
          <div className="space-y-4 animate-slide-up">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Transferencias a validar</h4>
            {pendingOfferings.length === 0 ? (
                <div className="text-center py-20 opacity-30 italic text-sm">No hay transferencias pendientes</div>
            ) : (
                pendingOfferings.map(p => (
                    <div key={p.id} className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 flex justify-between items-center group">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center">
                                <Wallet size={24} />
                            </div>
                            <div>
                                <p className="font-black text-slate-900 leading-tight">{p.fullName}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{p.type} • {p.prayerRequest?.slice(0, 20)}...</p>
                                <p className="text-[14px] font-black text-brand-600 mt-1">${p.amount.toLocaleString('es-AR')}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => confirmTransfer(p)}
                            className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg active:scale-90 transition-all"
                        >
                            <Check size={20} />
                        </button>
                    </div>
                ))
            )}
          </div>
        )}

        {/* --- VISTA: ÚLTIMOS MOVIMIENTOS --- */}
        {tab === 'movements' && (
            <div className="space-y-4 animate-slide-up">
                {finances.map(m => (
                    <div key={m.id} className="bg-white p-5 rounded-[30px] border border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl ${m.total > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {m.total > 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-800 leading-none">{m.concept}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{m.method}</p>
                            </div>
                        </div>
                        <p className={`font-black ${m.total > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {m.total > 0 ? '+' : ''}${Math.abs(m.total).toLocaleString('es-AR')}
                        </p>
                    </div>
                ))}
            </div>
        )}
      </main>
    </div>
  );
}