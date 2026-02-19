import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, User, DollarSign, MessageSquare, Save, 
  Zap, ArrowUpCircle, ArrowDownCircle, Tag, Wallet, 
  Lightbulb, Home, Heart, MoreHorizontal, Trash2,
  Calendar, FileText, CreditCard, Banknote, Loader2
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export default function AdminModals({ type, onClose, setCustomAlert }) {
  const [loading, setLoading] = useState(false); // ✅ Estado para el icono de carga
  const [formData, setFormData] = useState({
    concept: '',
    category: 'General',
    method: 'Efectivo',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    looseCash: '',
    looseTransfer: '',
    envelopes: []
  });

  const categories = [
    { id: 'Alquiler', icon: Home, color: 'text-blue-400' },
    { id: 'Servicios', icon: Lightbulb, color: 'text-yellow-400' },
    { id: 'Ayuda Social', icon: Heart, color: 'text-rose-400' },
    { id: 'Misiones', icon: Zap, color: 'text-purple-400' },
    { id: 'Otros', icon: MoreHorizontal, color: 'text-slate-400' },
  ];

  // ✅ Función segura para llamar a las alertas y evitar errores de "n is not a function"
  const safeAlert = (config) => {
    if (typeof setCustomAlert === 'function') {
      setCustomAlert(config);
    } else {
      console.warn("setCustomAlert no está definida:", config.message);
      alert(config.message);
    }
  };

  const addEnvelope = () => {
    setFormData({
      ...formData,
      envelopes: [...formData.envelopes, { id: Date.now(), name: '', amount: '', prayer: '' }]
    });
  };

  const updateEnvelope = (id, field, value) => {
    setFormData({
      ...formData,
      envelopes: formData.envelopes.map(e => e.id === id ? { ...e, [field]: value } : e)
    });
  };

  const handleSave = async () => {
    let total = 0;
    if (type === 'income') {
      total = Number(formData.looseCash) + Number(formData.looseTransfer) + 
              formData.envelopes.reduce((sum, e) => sum + Number(e.amount), 0);
    } else {
      total = -Math.abs(Number(formData.amount));
    }
    
    if (!total || total === 0) {
      return safeAlert({
        title: "Error de Monto",
        message: "Debes ingresar un valor válido antes de guardar.",
        type: "error"
      });
    }

    setLoading(true); // 🚀 Iniciar carga

    try {
      await addDoc(collection(db, 'finances'), {
        concept: formData.concept || (type === 'income' ? 'Ingreso General' : 'Gasto General'),
        category: formData.category,
        total: total,
        date: Timestamp.fromDate(new Date(formData.date + "T12:00:00")), 
        created_at: serverTimestamp(),
        method: type === 'income' ? 'Mixto' : formData.method,
        notes: formData.notes,
        envelopes: type === 'income' ? formData.envelopes : [],
        type: type
      });

      safeAlert({
        title: "¡Bóveda Actualizada!",
        message: "El movimiento ha sido registrado exitosamente.",
        type: "success",
        onConfirm: () => { if (typeof onClose === 'function') onClose(); }
      });

    } catch (e) { 
      console.error(e);
      safeAlert({
        title: "Error Crítico",
        message: "Error al conectar con la base de datos.",
        type: "error"
      });
    } finally {
      setLoading(false); // 🏁 Finalizar carga
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[400] flex flex-col font-outfit"
    >
      {/* 🛰️ HEADER FIJO */}
      <header className="flex-none flex justify-between items-center p-6 pt-12 border-b border-white/5">
        <div className="flex items-center gap-4 text-left">
            <div className={`p-4 rounded-[22px] ${type === 'income' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                {type === 'income' ? <ArrowUpCircle size={28}/> : <ArrowDownCircle size={28}/>}
            </div>
            <div>
                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none">
                  {type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
                </h2>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1 italic">Seguridad Bóveda</p>
            </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-400 active:scale-90 transition-all border border-white/5"><X/></button>
      </header>

      {/* 📋 CUERPO SCROLLABLE (Notas de auditoría incluidas aquí) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-10">
        
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-5 shadow-xl text-left">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2 italic">Fecha</label>
            <div className="relative">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" />
                <input type="date" value={formData.date} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-white font-bold outline-none focus:border-blue-500" onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2 italic">Concepto</label>
            <input value={formData.concept} placeholder="Detalle del movimiento..." className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" onChange={(e) => setFormData({...formData, concept: e.target.value})} />
          </div>
        </div>

        {type === 'expense' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-2 shadow-inner">
                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-2 italic">Monto Gasto</label>
                <input type="number" value={formData.amount} placeholder="$ 0.00" className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-6 text-rose-400 text-3xl font-black outline-none text-center" onChange={(e) => setFormData({...formData, amount: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                {categories.map(c => (
                    <button key={c.id} onClick={() => setFormData({...formData, category: c.id})} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${formData.category === c.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-900/50 border-white/5 text-slate-500'}`}>
                        <c.icon size={16} className={formData.category === c.id ? 'text-white' : c.color}/>
                        <span className="text-[10px] font-bold uppercase">{c.id}</span>
                    </button>
                ))}
            </div>
          </div>
        )}

        {type === 'income' && (
          <div className="space-y-6 animate-slide-up text-left">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-4">
                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-2 italic">Siembras Sueltas</label>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" value={formData.looseCash} placeholder="Efectivo" className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseCash: e.target.value})}/>
                    <input type="number" value={formData.looseTransfer} placeholder="Transf." className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseTransfer: e.target.value})}/>
                </div>
            </div>
            <div className="flex justify-between items-center px-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sobres Individuales</h4>
                <button onClick={addEnvelope} className="p-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase active:scale-90 transition-all"><Plus size={16}/></button>
            </div>
            {formData.envelopes.map((env) => (
              <div key={env.id} className="bg-slate-900/60 border border-white/10 p-5 rounded-[35px] space-y-4 relative group">
                <div className="flex gap-3">
                   <input value={env.name} onChange={(e) => updateEnvelope(env.id, 'name', e.target.value)} placeholder="Nombre" className="flex-[2] bg-slate-950/50 border border-white/5 rounded-xl p-4 text-xs text-white font-bold outline-none focus:border-blue-500" />
                   <input type="number" value={env.amount} onChange={(e) => updateEnvelope(env.id, 'amount', e.target.value)} placeholder="$" className="flex-1 bg-slate-950/50 border border-white/5 rounded-xl p-4 text-xs text-emerald-400 font-black outline-none" />
                </div>
                <textarea value={env.prayer} onChange={(e) => updateEnvelope(env.id, 'prayer', e.target.value)} placeholder="Pedido de oración..." className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-4 text-[10px] text-slate-400 h-20 resize-none outline-none italic" />
                <button onClick={() => setFormData({...formData, envelopes: formData.envelopes.filter(e => e.id !== env.id)})} className="absolute -top-2 -right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        )}

        {/* ✅ NOTAS DE AUDITORÍA: Ahora dentro del área de scroll para no tapar el total */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-4 text-left">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 italic">Notas de Auditoría / Comprobante</label>
            <div className="relative">
                <FileText className="absolute left-4 top-4 text-slate-700" size={16}/>
                <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="N° de ticket o notas internas..." className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-xs text-slate-300 h-24 resize-none outline-none focus:border-blue-500" />
            </div>
        </div>
      </div>

      {/* 💳 FOOTER FIJO (Total y Guardado siempre visibles) */}
      <div className="flex-none p-6 bg-slate-950 border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="bg-slate-900 p-6 rounded-[35px] flex justify-between items-center border border-white/5 mb-4 shadow-2xl">
            <div className="text-left">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Total Confirmado</span>
                <p className="text-[7px] font-bold text-slate-700 uppercase mt-1 italic">Sujeto a Auditoría CDS</p>
            </div>
            <span className={`text-3xl font-black italic tracking-tighter ${type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${(type === 'income' ? 
                    (Number(formData.looseCash) + Number(formData.looseTransfer) + formData.envelopes.reduce((sum, e) => sum + Number(e.amount), 0)) : 
                    Number(formData.amount)).toLocaleString('es-AR')}
            </span>
        </div>
        <button 
          onClick={handleSave} 
          disabled={loading}
          className={`w-full py-6 rounded-[30px] font-black uppercase text-xs tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 text-white ${loading ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${type === 'income' ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-rose-600 shadow-rose-600/20'}`}
        >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {loading ? 'Procesando Bóveda...' : 'Confirmar en Bóveda'}
        </button>
      </div>
    </motion.div>
  );
}