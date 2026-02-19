import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, User, DollarSign, MessageSquare, Save, 
  Zap, ArrowUpCircle, ArrowDownCircle, Tag, Wallet, 
  Lightbulb, Home, Heart, MoreHorizontal, Trash2
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AdminModals({ type, onClose }) {
  const [formData, setFormData] = useState({
    concept: '',
    category: 'General',
    method: 'Efectivo',
    amount: '', // Para gastos simples
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
    
    if (!total || total === 0) return alert("El monto debe ser distinto de 0");

    try {
      await addDoc(collection(db, 'finances'), {
        concept: formData.concept || (type === 'income' ? 'Ingreso General' : 'Gasto General'),
        category: formData.category,
        total: total,
        date: serverTimestamp(),
        method: type === 'income' ? 'Mixto' : formData.method,
        envelopes: type === 'income' ? formData.envelopes : [],
        type: type
      });
      onClose();
    } catch (e) { console.error(e); }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl z-[400] flex flex-col p-6 font-outfit"
    >
      <header className="flex justify-between items-center mb-8 pt-6">
        <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${type === 'income' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                {type === 'income' ? <ArrowUpCircle size={24}/> : <ArrowDownCircle size={24}/>}
            </div>
            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">
            {type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
            </h2>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-400 active:scale-90 transition-all"><X/></button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pb-10">
        
        {/* 1. SECCIÓN COMÚN: CONCEPTO */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[35px] space-y-4 shadow-xl">
          <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2 italic">Detalles Principales</label>
          <input 
            value={formData.concept}
            placeholder={type === 'income' ? "Ej: Culto de Jóvenes" : "Ej: Pago de Energía Eléctrica"}
            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
            onChange={(e) => setFormData({...formData, concept: e.target.value})}
          />
          
          {type === 'expense' && (
            <div className="space-y-4 animate-fade-in">
                <input 
                    type="number"
                    value={formData.amount}
                    placeholder="Monto Total $ 0.00"
                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-rose-400 text-2xl font-black outline-none focus:border-rose-500 transition-all"
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-3">
                    <select 
                        className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-xs font-bold text-slate-400 outline-none"
                        value={formData.method}
                        onChange={(e) => setFormData({...formData, method: e.target.value})}
                    >
                        <option>Efectivo</option>
                        <option>Transferencia</option>
                        <option>Tarjeta</option>
                    </select>
                    <select 
                        className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-xs font-bold text-slate-400 outline-none"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                </div>
            </div>
          )}
        </div>

        {/* 2. SECCIÓN ESPECÍFICA DE INGRESOS (SOBRES) */}
        {type === 'income' && (
          <div className="space-y-6 animate-slide-up">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[35px] space-y-4 shadow-xl">
                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-2 italic">Ofrendas Sueltas</label>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" value={formData.looseCash} placeholder="Efectivo $" className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseCash: e.target.value})}/>
                    <input type="number" value={formData.looseTransfer} placeholder="Transf. $" className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseTransfer: e.target.value})}/>
                </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Desglose de Sobres</h4>
                <button onClick={addEnvelope} className="p-2 bg-blue-600/20 text-blue-400 rounded-xl flex items-center gap-1 text-[9px] font-black uppercase border border-blue-500/20"><Plus size={14}/> Agregar Sobre</button>
              </div>
              
              <AnimatePresence>
                {formData.envelopes.map((env) => (
                  <motion.div 
                    key={env.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-900/40 border border-white/5 p-5 rounded-[30px] space-y-3 relative group"
                  >
                    <div className="flex gap-3">
                       <input 
                        value={env.name}
                        onChange={(e) => updateEnvelope(env.id, 'name', e.target.value)}
                        placeholder="Familia / Nombre" 
                        className="flex-[2] bg-slate-950/50 border border-white/5 rounded-xl p-3 text-xs text-white font-bold outline-none focus:border-blue-500" 
                       />
                       <input 
                        type="number" 
                        value={env.amount}
                        onChange={(e) => updateEnvelope(env.id, 'amount', e.target.value)}
                        placeholder="$ 0" 
                        className="flex-1 bg-slate-950/50 border border-white/5 rounded-xl p-3 text-xs text-emerald-400 font-black outline-none" 
                       />
                    </div>
                    <textarea 
                        value={env.prayer}
                        onChange={(e) => updateEnvelope(env.id, 'prayer', e.target.value)}
                        placeholder="Pedido de oración..." 
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-3 text-[10px] text-slate-400 h-16 resize-none outline-none" 
                    />
                    <button 
                        onClick={() => setFormData({...formData, envelopes: formData.envelopes.filter(e => e.id !== env.id)})}
                        className="absolute -top-2 -right-2 p-2 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 size={12}/>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* 3. RESUMEN Y GUARDADO */}
      <div className="mt-auto space-y-4">
        <div className="bg-slate-900 border-t border-white/10 p-5 rounded-[30px] flex justify-between items-center shadow-2xl">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Monto Final en Bóveda</span>
            <span className={`text-2xl font-black italic ${type === 'income' ? 'text-emerald-400' : 'text-rose-500'}`}>
                ${(type === 'income' ? 
                    (Number(formData.looseCash) + Number(formData.looseTransfer) + formData.envelopes.reduce((sum, e) => sum + Number(e.amount), 0)) : 
                    Number(formData.amount)).toLocaleString('es-AR')}
            </span>
        </div>
        <button 
            onClick={handleSave}
            className="w-full bg-blue-600 text-white py-6 rounded-[30px] font-black uppercase text-sm shadow-[0_10px_30px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all mb-4"
        >
            <Save size={20}/> Confirmar Registro
        </button>
      </div>
    </motion.div>
  );
}