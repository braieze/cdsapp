import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, User, DollarSign, MessageSquare, Save, 
  Zap, ArrowUpCircle, ArrowDownCircle, Tag, Wallet, 
  Lightbulb, Home, Heart, MoreHorizontal, Trash2,
  Calendar, FileText, CreditCard, Banknote
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export default function AdminModals({ type, onClose, setCustomAlert }) {
  const [formData, setFormData] = useState({
    concept: '',
    category: 'General',
    method: 'Efectivo',
    amount: '',
    date: new Date().toISOString().split('T')[0], // Fecha por defecto hoy
    notes: '',
    looseCash: '',
    looseTransfer: '',
    envelopes: []
  });

  const categories = [
    { id: 'Alquiler', icon: Home, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'Servicios', icon: Lightbulb, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { id: 'Ayuda Social', icon: Heart, color: 'text-rose-400', bg: 'bg-rose-400/10' },
    { id: 'Misiones', icon: Zap, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 'Otros', icon: MoreHorizontal, color: 'text-slate-400', bg: 'bg-slate-400/10' },
  ];

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
      return setCustomAlert({
        title: "Error de Monto",
        message: "Debes ingresar un valor numérico válido antes de guardar.",
        type: "error"
      });
    }

    try {
      await addDoc(collection(db, 'finances'), {
        concept: formData.concept || (type === 'income' ? 'Ingreso General' : 'Gasto General'),
        category: formData.category,
        total: total,
        // Convertimos la fecha del input a Timestamp de Firebase
        date: Timestamp.fromDate(new Date(formData.date + "T12:00:00")), 
        created_at: serverTimestamp(),
        method: type === 'income' ? 'Mixto' : formData.method,
        notes: formData.notes,
        envelopes: type === 'income' ? formData.envelopes : [],
        type: type
      });

      setCustomAlert({
        title: "¡Bóveda Actualizada!",
        message: "El movimiento ha sido registrado exitosamente en el sistema.",
        type: "success",
        onConfirm: onClose
      });

    } catch (e) { 
      console.error(e);
      setCustomAlert({
        title: "Error Crítico",
        message: "No se pudo conectar con la base de datos. Reintente.",
        type: "error"
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[400] flex flex-col p-6 font-outfit"
    >
      {/* 🚀 HEADER PREMIUM */}
      <header className="flex justify-between items-center mb-8 pt-6">
        <div className="flex items-center gap-4 text-left">
            <div className={`p-4 rounded-[22px] ${type === 'income' ? 'bg-emerald-500/20 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-rose-500/20 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]'}`}>
                {type === 'income' ? <ArrowUpCircle size={28}/> : <ArrowDownCircle size={28}/>}
            </div>
            <div>
                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none">
                  {type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
                </h2>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Transacción de Seguridad</p>
            </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-400 active:scale-90 transition-all border border-white/5"><X/></button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pb-32">
        
        {/* 1. SECCIÓN: DATOS DE TIEMPO Y CONCEPTO */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-5 shadow-xl">
          <div className="flex flex-col gap-2 text-left">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2 italic">Fecha del Movimiento</label>
            <div className="relative">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" />
                <input 
                    type="date"
                    value={formData.date}
                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-white font-bold outline-none focus:border-blue-500"
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
            </div>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2 italic">Concepto / Referencia</label>
            <input 
              value={formData.concept}
              placeholder={type === 'income' ? "Ej: Culto de Jóvenes" : "Ej: Pago de Alquiler Central"}
              className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
              onChange={(e) => setFormData({...formData, concept: e.target.value})}
            />
          </div>
        </div>

        {/* 2. DETALLE DE GASTO (LÓGICA MEJORADA) */}
        {type === 'expense' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-4 shadow-xl">
                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-2 italic text-left block">Monto a Egresar</label>
                <input 
                    type="number"
                    value={formData.amount}
                    placeholder="$ 0.00"
                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-6 text-rose-400 text-3xl font-black outline-none focus:border-rose-500 transition-all text-center"
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 text-left">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 italic">Categoría del Gasto</label>
                <div className="grid grid-cols-2 gap-2">
                    {categories.map(c => (
                        <button 
                            key={c.id}
                            onClick={() => setFormData({...formData, category: c.id})}
                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${formData.category === c.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-white/5 text-slate-500'}`}
                        >
                            <c.icon size={16} className={formData.category === c.id ? 'text-white' : c.color}/>
                            <span className="text-[10px] font-bold uppercase">{c.id}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2 text-left px-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 italic">Método de Pago</label>
                <div className="flex gap-2">
                    {[
                        {id: 'Efectivo', icon: Banknote},
                        {id: 'Transferencia', icon: CreditCard},
                        {id: 'Tarjeta', icon: Wallet}
                    ].map(m => (
                        <button 
                            key={m.id}
                            onClick={() => setFormData({...formData, method: m.id})}
                            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${formData.method === m.id ? 'bg-slate-800 border-blue-500 text-blue-400' : 'bg-slate-900/50 border-white/5 text-slate-600'}`}
                        >
                            <m.icon size={18}/>
                            <span className="text-[8px] font-black uppercase">{m.id}</span>
                        </button>
                    ))}
                </div>
            </div>
          </div>
        )}

        {/* 3. DETALLE DE INGRESOS (SOBRES PRO) */}
        {type === 'income' && (
          <div className="space-y-6 animate-slide-up">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-4 shadow-xl">
                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-2 italic text-left block">Efectivo / Transferencias Sueltas</label>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14}/>
                        <input type="number" value={formData.looseCash} placeholder="Efectivo" className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseCash: e.target.value})}/>
                    </div>
                    <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14}/>
                        <input type="number" value={formData.looseTransfer} placeholder="Transf." className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseTransfer: e.target.value})}/>
                    </div>
                </div>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center px-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carga de Sobres Individuales</h4>
                <button onClick={addEnvelope} className="p-3 bg-blue-600 text-white rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95"><Plus size={16}/> Agregar</button>
              </div>
              
              <AnimatePresence>
                {formData.envelopes.map((env) => (
                  <motion.div 
                    key={env.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-900/60 border border-white/10 p-5 rounded-[35px] space-y-4 relative group"
                  >
                    <div className="flex gap-3">
                       <input 
                        value={env.name} onChange={(e) => updateEnvelope(env.id, 'name', e.target.value)}
                        placeholder="Familia / Nombre" 
                        className="flex-[2] bg-slate-950/50 border border-white/5 rounded-xl p-4 text-xs text-white font-bold outline-none focus:border-blue-500" 
                       />
                       <input 
                        type="number" value={env.amount} onChange={(e) => updateEnvelope(env.id, 'amount', e.target.value)}
                        placeholder="$ 0" 
                        className="flex-1 bg-slate-950/50 border border-white/5 rounded-xl p-4 text-xs text-emerald-400 font-black outline-none" 
                       />
                    </div>
                    <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 text-slate-700" size={12}/>
                        <textarea 
                            value={env.prayer} onChange={(e) => updateEnvelope(env.id, 'prayer', e.target.value)}
                            placeholder="Pedido de oración del hermano..." 
                            className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-4 pl-9 text-[10px] text-slate-400 h-20 resize-none outline-none italic" 
                        />
                    </div>
                    <button 
                        onClick={() => setFormData({...formData, envelopes: formData.envelopes.filter(e => e.id !== env.id)})}
                        className="absolute -top-2 -right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg active:scale-90"
                    >
                        <Trash2 size={14}/>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* 4. NOTAS DE AUDITORÍA */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-4 shadow-xl text-left">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 italic">Notas de Auditoría / N° Ticket</label>
            <div className="relative">
                <FileText className="absolute left-4 top-4 text-slate-700" size={16}/>
                <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Información adicional para tesorería nacional..."
                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-xs text-slate-300 h-24 resize-none outline-none focus:border-blue-500 transition-all"
                />
            </div>
        </div>
      </div>

      {/* 💳 RESUMEN FINAL Y GUARDADO */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-950/80 backdrop-blur-3xl border-t border-white/5 z-[410]">
        <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-slate-900 p-6 rounded-[35px] flex justify-between items-center shadow-2xl border border-white/5">
                <div className="text-left">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Total Confirmado</span>
                    <p className="text-[8px] font-bold text-slate-700 uppercase mt-1">Sujeto a auditoría</p>
                </div>
                <span className={`text-3xl font-black italic tracking-tighter ${type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${(type === 'income' ? 
                        (Number(formData.looseCash) + Number(formData.looseTransfer) + formData.envelopes.reduce((sum, e) => sum + Number(e.amount), 0)) : 
                        Number(formData.amount)).toLocaleString('es-AR')}
                </span>
            </div>
            <button 
                onClick={handleSave}
                className={`w-full py-6 rounded-[30px] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-white ${type === 'income' ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-rose-600 shadow-rose-600/20'}`}
            >
                <Save size={20}/> Guardar en Bóveda
            </button>
        </div>
      </div>
    </motion.div>
  );
}