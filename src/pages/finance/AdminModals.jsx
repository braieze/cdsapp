import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, User, DollarSign, MessageSquare, Save, 
  Zap, ArrowUpCircle, ArrowDownCircle, Tag, Wallet, 
  Lightbulb, Home, Heart, MoreHorizontal, Trash2,
  Calendar, FileText, CreditCard, Banknote, Loader2,
  Ticket, Check
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, query, where, onSnapshot } from 'firebase/firestore';

export default function AdminModals({ type, onClose, setCustomAlert, editData }) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]); 
  const [formData, setFormData] = useState({
    concept: '',
    category: 'General',
    method: 'Efectivo',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    eventId: '', 
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

  // ✅ 1. CÁLCULO DE TOTAL EN TIEMPO REAL (Resuelve el error de Scope)
  const totalInput = useMemo(() => {
    if (type === 'income') {
      return (Number(formData.looseCash) || 0) + 
             (Number(formData.looseTransfer) || 0) + 
             formData.envelopes.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    }
    return Number(formData.amount) || 0;
  }, [formData, type]);

  // ✅ 2. CARGAR DATOS PARA EDICIÓN (Si existen)
  useEffect(() => {
    if (editData) {
      setFormData({
        concept: editData.concept || '',
        category: editData.category || 'General',
        method: editData.method || 'Efectivo',
        amount: editData.total ? Math.abs(editData.total) : '',
        date: editData.date?.seconds 
          ? new Date(editData.date.seconds * 1000).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0],
        eventId: editData.eventId || '',
        notes: editData.notes || '',
        looseCash: '',
        looseTransfer: '',
        // Si editamos un ingreso que viene de un sobre, lo cargamos en la lista de sobres
        envelopes: editData.fullName ? [{
            id: Date.now(),
            name: editData.fullName,
            amount: Math.abs(editData.total),
            prayer: editData.prayer || '',
            type: editData.subType || 'diezmo',
            method: editData.method || 'Efectivo'
        }] : []
      });
    }
  }, [editData]);

  // ✅ 3. CARGAR EVENTOS DE HOY
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'events'), where('date', '==', today));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const safeAlert = (config) => {
    if (typeof setCustomAlert === 'function') setCustomAlert(config);
    else console.warn("Aviso:", config.message);
  };

  const addEnvelope = () => {
    setFormData({
      ...formData,
      envelopes: [...formData.envelopes, { 
        id: Date.now(), 
        name: '', 
        amount: '', 
        prayer: '', 
        type: 'diezmo', 
        method: 'Efectivo' 
      }]
    });
  };

  const updateEnvelope = (id, field, value) => {
    setFormData({
      ...formData,
      envelopes: formData.envelopes.map(e => e.id === id ? { ...e, [field]: value } : e)
    });
  };

  // ✅ 4. LÓGICA DE GUARDADO (Soporta Crear y Actualizar)
  const handleSave = async () => {
    if (!totalInput || totalInput === 0) return safeAlert({ title: "Error", message: "Monto inválido.", type: "error" });

    setLoading(true);
    const timestampDate = Timestamp.fromDate(new Date(formData.date + "T12:00:00"));

    try {
      if (editData) {
        // MODO EDICIÓN: Actualizar el documento específico
        const docRef = doc(db, 'finances', editData.id);
        const updateData = {
          concept: formData.concept,
          total: type === 'expense' ? -Math.abs(totalInput) : totalInput,
          date: timestampDate,
          method: formData.method,
          updated_at: serverTimestamp(),
        };

        if (type === 'expense') {
            updateData.category = formData.category;
            updateData.notes = formData.notes;
        } else if (formData.envelopes.length > 0) {
            updateData.fullName = formData.envelopes[0].name;
            updateData.subType = formData.envelopes[0].type;
            updateData.prayer = formData.envelopes[0].prayer;
            updateData.method = formData.envelopes[0].method;
        }

        await updateDoc(docRef, updateData);
      } else {
        // MODO CREACIÓN: Individualizar registros
        const entries = [];
        if (type === 'income') {
          if (formData.looseCash > 0) {
            entries.push(addDoc(collection(db, 'finances'), { concept: formData.concept || "Ofrenda Billete", total: Number(formData.looseCash), date: timestampDate, eventId: formData.eventId, method: 'Efectivo', type: 'income', subType: 'ofrenda', created_at: serverTimestamp() }));
          }
          if (formData.looseTransfer > 0) {
            entries.push(addDoc(collection(db, 'finances'), { concept: formData.concept || "Ofrenda Virtual", total: Number(formData.looseTransfer), date: timestampDate, eventId: formData.eventId, method: 'Transferencia', type: 'income', subType: 'ofrenda', created_at: serverTimestamp() }));
          }
          formData.envelopes.forEach(env => {
            if (env.amount > 0) {
              entries.push(addDoc(collection(db, 'finances'), { fullName: env.name || "Dador Anónimo", concept: `${env.type === 'diezmo' ? 'Diezmo' : 'Ofrenda'}: ${env.name}`, total: Number(env.amount), date: timestampDate, eventId: formData.eventId, method: env.method, type: 'income', subType: env.type, prayer: env.prayer, created_at: serverTimestamp() }));
            }
          });
        } else {
          entries.push(addDoc(collection(db, 'finances'), { concept: formData.concept || "Gasto General", category: formData.category, total: -Math.abs(Number(formData.amount)), date: timestampDate, method: formData.method, notes: formData.notes, type: 'expense', created_at: serverTimestamp() }));
        }
        await Promise.all(entries);
      }

      safeAlert({
        title: editData ? "Actualizado" : "Bóveda Actualizada",
        message: "Registro procesado correctamente.",
        type: "success",
        onConfirm: () => { if (onClose) onClose(); }
      });
    } catch (e) {
      console.error(e);
      safeAlert({ title: "Error", message: "Fallo en la operación.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[400] flex flex-col font-outfit overflow-hidden box-border"
    >
      {/* 🛰️ HEADER FIJO */}
      <header className="flex-none flex justify-between items-center p-6 pt-12 border-b border-white/5 w-full box-border">
        <div className="flex items-center gap-4 text-left">
            <div className={`p-4 rounded-[22px] ${type === 'income' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                {type === 'income' ? <ArrowUpCircle size={28}/> : <ArrowDownCircle size={28}/>}
            </div>
            <div>
                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none">
                  {editData ? 'Editar Registro' : (type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto')}
                </h2>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Ministerio CDS</p>
            </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-400 active:scale-90 transition-all border border-white/5"><X/></button>
      </header>

      {/* 📋 CUERPO CON SCROLL (CORREGIDO DESBORDE LATERAL) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 custom-scrollbar pb-10 w-full box-border">
        
        {/* ASOCIAR EVENTO (Deshabilitado en edición) */}
        {type === 'income' && !editData && (
          <div className="bg-slate-900/50 border border-blue-500/20 p-6 rounded-[40px] space-y-4 shadow-xl text-left w-full box-border">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-2 italic">Asociar a Culto/Evento</label>
              <div className="relative">
                  <Ticket size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" />
                  <select 
                      value={formData.eventId}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-white font-bold outline-none appearance-none"
                      onChange={(e) => {
                          const event = events.find(ev => ev.id === e.target.value);
                          setFormData({...formData, eventId: e.target.value, concept: event ? `Cierre: ${event.title}` : formData.concept });
                      }}
                  >
                      <option value="">Selección manual de fecha</option>
                      {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
              </div>
          </div>
        )}

        {/* FECHA Y CONCEPTO */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-5 shadow-xl text-left w-full box-border">
          <div className="flex flex-col gap-4">
            <div className="relative w-full">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="date" value={formData.date} className="w-full box-border bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-white font-bold outline-none" onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <input value={formData.concept} placeholder="Detalle general..." className="w-full box-border bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" onChange={(e) => setFormData({...formData, concept: e.target.value})} />
          </div>
        </div>

        {/* GASTOS */}
        {type === 'expense' && (
          <div className="space-y-6 animate-fade-in text-left w-full box-border">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-2">
                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-2 italic">Monto a Egresar</label>
                <input type="number" value={formData.amount} placeholder="$ 0.00" className="w-full box-border bg-slate-950/50 border border-white/5 rounded-2xl p-6 text-rose-400 text-3xl font-black outline-none text-center" onChange={(e) => setFormData({...formData, amount: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                {categories.map(c => (
                    <button key={c.id} onClick={() => setFormData({...formData, category: c.id})} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${formData.category === c.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-white/5 text-slate-500'}`}>
                        <c.icon size={16} className={formData.category === c.id ? 'text-white' : c.color}/>
                        <span className="text-[10px] font-bold uppercase">{c.id}</span>
                    </button>
                ))}
            </div>
          </div>
        )}

        {/* INGRESOS */}
        {type === 'income' && (
          <div className="space-y-6 animate-slide-up text-left w-full box-border">
            {!editData && (
                <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-4">
                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-2 italic text-left block">Ofrendas Sueltas</label>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" value={formData.looseCash} placeholder="Billete $" className="w-full box-border bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseCash: e.target.value})}/>
                        <input type="number" value={formData.looseTransfer} placeholder="Virtual $" className="w-full box-border bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" onChange={e => setFormData({...formData, looseTransfer: e.target.value})}/>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{editData ? 'Detalle del Sobre' : 'Carga de Sobres'}</h4>
                    {!editData && <button onClick={addEnvelope} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all"><Plus size={16}/></button>}
                </div>
                {formData.envelopes.map((env) => (
                  <div key={env.id} className="bg-slate-900/60 border border-white/10 p-5 rounded-[35px] space-y-4 relative group w-full box-border shadow-xl">
                    <div className="flex gap-2">
                        <button onClick={() => updateEnvelope(env.id, 'type', env.type === 'diezmo' ? 'ofrenda' : 'diezmo')} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase transition-all ${env.type === 'diezmo' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-500 border border-blue-500/30'}`}>
                            {env.type}
                        </button>
                        <button onClick={() => updateEnvelope(env.id, 'method', env.method === 'Efectivo' ? 'Transferencia' : 'Efectivo')} className="flex-1 py-2 rounded-xl text-[8px] font-black uppercase bg-slate-950 text-slate-400 border border-white/5">
                            {env.method}
                        </button>
                    </div>
                    <div className="flex gap-3">
                       <input value={env.name} onChange={(e) => updateEnvelope(env.id, 'name', e.target.value)} placeholder="Nombre / Familia" className="flex-[2] box-border bg-slate-950/50 border border-white/5 rounded-xl p-4 text-xs text-white font-bold outline-none focus:border-blue-500" />
                       <input type="number" value={env.amount} onChange={(e) => updateEnvelope(env.id, 'amount', e.target.value)} placeholder="$" className="flex-1 box-border bg-slate-950/50 border border-white/5 rounded-xl p-4 text-xs text-emerald-400 font-black outline-none" />
                    </div>
                    <textarea value={env.prayer} onChange={(e) => updateEnvelope(env.id, 'prayer', e.target.value)} placeholder="Petición de oración..." className="w-full box-border bg-slate-950/50 border border-white/5 rounded-xl p-4 text-[10px] text-slate-400 h-20 resize-none italic outline-none" />
                    {!editData && <button onClick={() => setFormData({...formData, envelopes: formData.envelopes.filter(e => e.id !== env.id)})} className="absolute -top-2 -right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* NOTAS AUDITORÍA */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[40px] space-y-4 text-left w-full box-border shadow-xl">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 italic">Notas Contables / Auditoría</label>
            <div className="relative w-full">
                <FileText className="absolute left-4 top-4 text-slate-700" size={16}/>
                <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="N° de comprobante o referencia..." className="w-full box-border bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-12 text-xs text-slate-300 h-24 resize-none outline-none focus:border-blue-500" />
            </div>
        </div>
      </div>

      {/* 💳 FOOTER */}
      <div className="flex-none p-6 bg-slate-950 border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] w-full box-border">
        <div className="bg-slate-900 p-6 rounded-[35px] flex justify-between items-center border border-white/5 mb-4 shadow-2xl">
            <div className="text-left">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Monto Confirmado</span>
                <p className="text-[7px] font-bold text-slate-700 uppercase mt-1 italic">{editData ? 'Modificando registro...' : 'Individualizando...'}</p>
            </div>
            <span className={`text-3xl font-black italic tracking-tighter ${type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${totalInput.toLocaleString('es-AR')}
            </span>
        </div>
        <button 
          onClick={handleSave} disabled={loading}
          className={`w-full py-6 rounded-[30px] font-black uppercase text-xs tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 text-white ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} ${type === 'income' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-600 shadow-rose-500/20'}`}
        >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {loading ? 'Procesando Bóveda...' : (editData ? 'Guardar Cambios' : 'Confirmar en Bóveda')}
        </button>
      </div>
    </motion.div>
  );
}