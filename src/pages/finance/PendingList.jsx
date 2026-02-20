import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { doc, deleteDoc, addDoc, collection, serverTimestamp, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { 
  Check, X, Clock, MessageSquare, User, Wallet, 
  Trash2, Ticket, ChevronDown, AlertCircle, Banknote, CreditCard 
} from 'lucide-react';

export default function PendingList({ items = [] }) {
  const [events, setEvents] = useState([]);
  const [validatingId, setValidatingId] = useState(null); // ✅ Para saber qué tarjeta está eligiendo culto
  const [selectedEventId, setSelectedEventId] = useState("");

  // ✅ 1. CARGAR EVENTOS DE HOY (Igual que en AdminModals)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'events'), where('date', '==', today));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // ✅ 2. VALIDAR TRANSFERENCIA: Ahora requiere un evento asociado
  const confirmarTransferencia = async (item) => {
    if (!selectedEventId && events.length > 0) {
      alert("Por favor, selecciona un evento para asociar este ingreso.");
      return;
    }

    try {
      const event = events.find(e => e.id === selectedEventId);
      
      await addDoc(collection(db, 'finances'), {
        fullName: item.fullName,
        concept: item.type === 'diezmo' ? `Diezmo Online: ${item.fullName}` : `Ofrenda Online: ${item.fullName}`,
        total: Number(item.amount),
        type: 'income',
        subType: item.type || 'ofrenda', // ✅ Usa el "type" de la base (image_19392d.png)
        date: item.date || serverTimestamp(),
        eventId: selectedEventId,
        eventName: event ? event.title : 'Validación Manual',
        method: 'Transferencia',
        uid: item.uid,
        prayer: item.prayerRequest,
        status: 'received',
        created_at: serverTimestamp()
      });
      
      await deleteDoc(doc(db, 'offerings', item.id));
      setValidatingId(null);
      setSelectedEventId("");
    } catch (e) { 
      console.error("Error al validar bóveda:", e); 
    }
  };

  const rechazarOfrenda = async (id) => {
    if (window.confirm("¿Deseas rechazar y eliminar esta intención de ofrenda?")) {
      await deleteDoc(doc(db, 'offerings', id));
    }
  };

  return (
    <div className="space-y-6 pt-4 pb-20">
      <header className="flex justify-between items-center px-2">
        <div className="text-left">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 italic">
            Bóveda de Espera
          </h3>
          <p className="text-[10px] font-bold text-blue-400 uppercase">
            {items.length} Validaciones en curso
          </p>
        </div>
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 animate-pulse">
          <Clock size={18} />
        </div>
      </header>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, x: 50 }}
              className="relative group"
            >
              <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-6 rounded-[40px] shadow-2xl relative overflow-hidden">
                
                {/* 🏷️ INDICADOR DE TIPO (NEÓN) */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center">
                    <div className="relative">
                        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                          <User className="text-blue-400" size={24} />
                        </div>
                        {/* Mini icono de método */}
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1 border-2 border-slate-900">
                            <CreditCard size={8} className="text-white"/>
                        </div>
                    </div>
                    <div className="text-left">
                      <h4 className="font-black text-white italic tracking-tight uppercase leading-none mb-1">
                        {item.fullName}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${item.type === 'diezmo' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'}`}>
                            {item.type || 'Siembra'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-600 uppercase">
                          {item.date?.seconds ? new Date(item.date.seconds * 1000).toLocaleDateString() : 'Hoy'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white italic tracking-tighter">
                    ${Number(item.amount).toLocaleString('es-AR')}
                  </p>
                </div>

                {item.prayerRequest && (
                  <div className="flex gap-3 items-start bg-slate-950/40 p-4 rounded-2xl border border-white/5 mb-6 text-left shadow-inner">
                    <MessageSquare size={14} className="text-blue-500 mt-1 flex-shrink-0" />
                    <p className="text-[11px] font-medium text-slate-400 leading-relaxed italic">
                      "{item.prayerRequest}"
                    </p>
                  </div>
                )}

                {/* ✅ SELECTOR DE EVENTO INTEGRADO (Aparece al intentar validar) */}
                <AnimatePresence>
                    {validatingId === item.id ? (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }} 
                            animate={{ height: 'auto', opacity: 1 }}
                            className="mb-6 space-y-3 overflow-hidden"
                        >
                            <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-[25px] space-y-3 text-left">
                                <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-2 italic flex items-center gap-2">
                                    <Ticket size={12}/> Seleccionar Culto de hoy
                                </label>
                                <div className="relative">
                                    <select 
                                        value={selectedEventId}
                                        onChange={(e) => setSelectedEventId(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-3 text-[10px] font-bold text-white outline-none appearance-none"
                                    >
                                        <option value="">-- ¿A qué evento pertenece? --</option>
                                        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                                        <option value="manual">Carga Manual (Sin Evento)</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => {setValidatingId(null); setSelectedEventId("");}} className="flex-1 py-3 bg-slate-800 rounded-xl text-[9px] font-black uppercase text-slate-400">Cancelar</button>
                                <button onClick={() => confirmarTransferencia(item)} className="flex-[2] py-3 bg-blue-600 rounded-xl text-[9px] font-black uppercase text-white shadow-lg shadow-blue-500/20">Confirmar en Bóveda</button>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex gap-3">
                            <button 
                                onClick={() => rechazarOfrenda(item.id)}
                                className="flex-1 py-4 bg-white/5 hover:bg-rose-500/10 border border-white/5 rounded-2xl text-slate-500 hover:text-rose-500 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest"
                            >
                                <X size={16} /> Rechazar
                            </button>
                            <button 
                                onClick={() => setValidatingId(item.id)}
                                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest"
                            >
                                <Check size={16} strokeWidth={3} /> Validar Bóveda
                            </button>
                        </div>
                    )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-32 space-y-4">
            <div className="w-16 h-16 bg-slate-900 rounded-[22px] flex items-center justify-center mx-auto border border-white/5 shadow-inner">
              <Wallet className="text-slate-800" size={32} />
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">
              Bóveda de espera vacía
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}