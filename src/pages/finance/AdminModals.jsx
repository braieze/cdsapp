import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, User, DollarSign, MessageSquare, Save, Zap } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AdminModals({ type, onClose }) {
  const [formData, setFormData] = useState({
    concept: '',
    looseCash: 0,
    looseTransfer: 0,
    envelopes: []
  });

  const addEnvelope = () => {
    setFormData({
      ...formData,
      envelopes: [...formData.envelopes, { id: Date.now(), name: '', amount: '', prayer: '' }]
    });
  };

  const handleSave = async () => {
    const total = Number(formData.looseCash) + Number(formData.looseTransfer) + 
                  formData.envelopes.reduce((sum, e) => sum + Number(e.amount), 0);
    
    try {
      await addDoc(collection(db, 'finances'), {
        concept: formData.concept || (type === 'income' ? 'Ingreso General' : 'Gasto General'),
        total: type === 'income' ? total : -Math.abs(total),
        date: serverTimestamp(),
        method: 'Mixed',
        envelopes: formData.envelopes,
        type: type
      });
      onClose();
    } catch (e) { console.error(e); }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[400] flex flex-col p-6 font-outfit"
    >
      <header className="flex justify-between items-center mb-8 pt-6">
        <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">
          {type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
        </h2>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-400"><X/></button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pb-10">
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[35px] space-y-4">
          <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2">Detalles Generales</label>
          <input 
            placeholder="Concepto del movimiento"
            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500"
            onChange={(e) => setFormData({...formData, concept: e.target.value})}
          />
          <div className="grid grid-cols-2 gap-4">
             <input type="number" placeholder="Efectivo $" className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseCash: e.target.value})}/>
             <input type="number" placeholder="Transf. $" className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseTransfer: e.target.value})}/>
          </div>
        </div>

        {/* SECCIÓN SOBRES (ESTILO CDS) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sobres / Diezmos</h4>
            <button onClick={addEnvelope} className="p-2 bg-blue-600/20 text-blue-400 rounded-xl flex items-center gap-1 text-[10px] font-black uppercase"><Plus size={14}/> Agregar</button>
          </div>
          
          {formData.envelopes.map((env, index) => (
            <div key={env.id} className="bg-slate-900/40 border border-white/5 p-5 rounded-[30px] space-y-3 relative">
              <div className="flex gap-3">
                 <input placeholder="Familia / Nombre" className="flex-[2] bg-slate-950/50 border border-white/5 rounded-xl p-3 text-xs text-white font-bold" />
                 <input type="number" placeholder="$ 0" className="flex-1 bg-slate-950/50 border border-white/5 rounded-xl p-3 text-xs text-emerald-400 font-black" />
              </div>
              <textarea placeholder="Petición de oración..." className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-3 text-[10px] text-slate-400 h-16 resize-none" />
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={handleSave}
        className="w-full bg-blue-600 text-white py-6 rounded-[30px] font-black uppercase text-sm shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all mb-6"
      >
        <Save size={20}/> Guardar en Bóveda
      </button>
    </motion.div>
  );
}