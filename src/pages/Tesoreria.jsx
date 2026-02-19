import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, query, onSnapshot, orderBy, addDoc, 
  updateDoc, doc, serverTimestamp, deleteDoc 
} from 'firebase/firestore';
import { 
  Shield, Wallet, ArrowUpCircle, ArrowDownCircle, List, Users, 
  Trash2, Plus, Check, X, ChevronLeft, Edit3, 
  TrendingUp, TrendingDown, PieChart, MessageSquare, Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Tesoreria() {
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState('overview'); 
  const [finances, setFinances] = useState([]);
  const [pendingOfferings, setPendingOfferings] = useState([]);
  const [showModal, setShowModal] = useState(null); // 'income', 'expense', 'edit'
  const [selectedItem, setSelectedItem] = useState(null);

  // --- 1. CARGA DE DATOS ---
  useEffect(() => {
    const unsubFin = onSnapshot(query(collection(db, 'finances'), orderBy('date', 'desc')), (snap) => {
      setFinances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPend = onSnapshot(query(collection(db, 'offerings'), orderBy('date', 'desc')), (snap) => {
      setPendingOfferings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubFin(); unsubPend(); };
  }, []);

  // --- 2. LÓGICA DE NEGOCIO ---
  const stats = useMemo(() => {
    let total = 0, incomes = 0, expenses = 0;
    finances.forEach(m => {
      const amt = Number(m.total || m.amount || 0);
      total += amt;
      if (amt > 0) incomes += amt; else expenses += Math.abs(amt);
    });
    return { total, incomes, expenses, tithe: incomes * 0.10 };
  }, [finances]);

  const donors = useMemo(() => {
    const map = {};
    finances.filter(m => m.total > 0).forEach(m => {
      const name = m.fullName || m.concept?.replace("Transferencia: ", "") || "Anónimo";
      if (!map[name]) map[name] = { name, count: 0, total: 0, lastDate: m.date, prayers: [] };
      map[name].count++;
      map[name].total += m.total;
      if (m.prayer) map[name].prayers.push(m.prayer);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [finances]);

  // --- 3. ACCIONES ---
  const handleConfirm = async (item) => {
    await addDoc(collection(db, 'finances'), {
      concept: `Transferencia: ${item.fullName}`,
      total: item.amount,
      type: item.type,
      date: item.date || serverTimestamp(),
      method: 'Banco',
      uid: item.uid,
      prayer: item.prayerRequest
    });
    await deleteDoc(doc(db, 'offerings', item.id));
  };

  const handleReject = async (id) => {
    if(confirm("¿Rechazar y eliminar esta intención de ofrenda?")) {
      await deleteDoc(doc(db, 'offerings', id));
    }
  };

  const handleDelete = async (id) => {
    if(confirm("¿Eliminar este registro permanente de finanzas?")) {
      await deleteDoc(doc(db, 'finances', id));
    }
  };

  const unlock = () => { if (pin === "2367") setIsLocked(false); else setPin(""); };

  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center p-8 z-[200] font-outfit">
        <div className="bg-slate-800/50 p-10 rounded-[50px] border border-white/5 backdrop-blur-xl w-full max-w-sm text-center shadow-2xl">
          <Shield size={48} className="text-brand-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Acceso Restringido</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-8">Tesorería Ministerial</p>
          <input 
            type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={4}
            className="w-full bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 text-center text-3xl tracking-[0.5em] text-white font-black mb-6"
            placeholder="••••" autoFocus
          />
          <button onClick={unlock} className="w-full bg-brand-600 text-white py-5 rounded-3xl font-black uppercase text-sm shadow-xl active:scale-95 transition-all">Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-outfit pb-24">
      {/* 🚀 DASHBOARD HEADER */}
      <header className="bg-slate-900 text-white pt-14 pb-12 px-8 rounded-b-[60px] shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <button onClick={() => navigate('/apps')} className="p-3 bg-white/10 rounded-2xl"><ChevronLeft size={24}/></button>
          <div className="text-right">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Caja CDS</h1>
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mt-1">Gestión Centralizada</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white/5 border border-white/10 p-6 rounded-[40px] backdrop-blur-md">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Balance Consolidado</p>
            <h3 className="text-5xl font-black italic leading-none">${stats.total.toLocaleString('es-AR')}</h3>
            <div className="mt-8 flex justify-between items-center border-t border-white/5 pt-4">
              <span className="text-[10px] font-black text-slate-500 uppercase">Diezmo Nac. (10%)</span>
              <span className="text-brand-400 font-black">${stats.tithe.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 📱 NAVIGATION TABS */}
      <nav className="flex px-6 -mt-6 gap-2 overflow-x-auto no-scrollbar relative z-20">
        {[
          { id: 'overview', label: 'Resumen', icon: PieChart },
          { id: 'pending', label: 'Pendientes', icon: Wallet, count: pendingOfferings.length },
          { id: 'movements', label: 'Historial', icon: List },
          { id: 'donors', label: 'Pastoral', icon: Users }
        ].map(t => (
          <button 
            key={t.id} onClick={() => setTab(t.id)}
            className={`px-6 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 shadow-xl transition-all ${tab === t.id ? 'bg-slate-900 text-white scale-105' : 'bg-white text-slate-400'}`}
          >
            <t.icon size={16} /> {t.label}
            {t.count > 0 && <span className="bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[8px] animate-pulse">{t.count}</span>}
          </button>
        ))}
      </nav>

      <main className="flex-1 p-6 space-y-6">
        {/* --- PENDIENTES (DEL QR) --- */}
        {tab === 'pending' && (
          <div className="space-y-4 animate-slide-up">
            {pendingOfferings.map(p => (
              <div key={p.id} className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <div className="w-14 h-14 bg-brand-50 text-brand-600 rounded-3xl flex items-center justify-center font-black">
                    {p.fullName[0]}
                  </div>
                  <div>
                    <p className="font-black text-slate-900">{p.fullName}</p>
                    <p className="text-[14px] font-black text-emerald-600">${p.amount.toLocaleString('es-AR')}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 italic">"{p.prayerRequest}"</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleReject(p.id)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl active:scale-90 transition-all"><X size={20}/></button>
                  <button onClick={() => handleConfirm(p)} className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg active:scale-90 transition-all shadow-emerald-200"><Check size={20}/></button>
                </div>
              </div>
            ))}
            {pendingOfferings.length === 0 && <p className="text-center py-20 text-slate-300 font-bold italic">Todo al día por aquí</p>}
          </div>
        )}

        {/* --- HISTORIAL (CRUD) --- */}
        {tab === 'movements' && (
          <div className="space-y-3 animate-slide-up">
            {finances.map(m => (
              <div key={m.id} className="bg-white p-5 rounded-[30px] shadow-sm border border-slate-100 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${m.total > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {m.total > 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800 leading-none">{m.concept}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{m.method} • {m.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`font-black ${m.total > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.total > 0 ? '+' : ''}${Math.abs(m.total).toLocaleString('es-AR')}
                  </p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button className="p-2 text-slate-300 hover:text-brand-500"><Edit3 size={16}/></button>
                    <button onClick={() => handleDelete(m.id)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- PASTORAL (INTELIGENCIA) --- */}
        {tab === 'donors' && (
          <div className="space-y-4 animate-slide-up">
            {donors.map((d, i) => (
              <div key={i} className="bg-slate-900 text-white p-6 rounded-[45px] shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-xl font-black italic tracking-tighter">{d.name}</h4>
                    <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Fidelidad: {d.count} veces</p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl"><Users size={20}/></div>
                </div>
                <div className="space-y-2 mb-6">
                  {d.prayers.slice(-1).map((p, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-white/5 p-3 rounded-2xl border border-white/5">
                      <MessageSquare size={14} className="text-slate-500 mt-1 flex-shrink-0"/>
                      <p className="text-[11px] font-medium text-slate-300 italic leading-tight">"{p}"</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-[20px] font-black text-emerald-400">${d.total.toLocaleString('es-AR')}</p>
                  <button className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Ver Historial →</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ➕ BOTONES DE ACCIÓN RÁPIDA */}
      <div className="fixed bottom-10 right-6 flex flex-col gap-3">
        <button className="w-14 h-14 bg-rose-500 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all shadow-rose-200">
          <ArrowDownCircle size={24} />
        </button>
        <button className="w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center active:scale-90 transition-all shadow-slate-300">
          <Plus size={32} />
        </button>
      </div>
    </div>
  );
}