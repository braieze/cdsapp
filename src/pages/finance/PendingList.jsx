import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { doc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Check, X, Clock, MessageSquare, User, Wallet, Trash2 } from 'lucide-react';

export default function PendingList({ items = [] }) {
  
  // ✅ 1. CONFIRMAR TRANSFERENCIA (Mover a Finanzas Oficiales)
  const handleConfirm = async (item) => {
    try {
      await addDoc(collection(db, 'finances'), {
        concept: `Transferencia: ${item.fullName}`,
        total: Number(item.amount),
        type: item.type || 'ofrenda',
        date: item.date || serverTimestamp(),
        method: 'Banco',
        uid: item.uid,
        prayer: item.prayerRequest,
        status: 'received'
      });
      // Borramos de la lista de pendientes
      await deleteDoc(doc(db, 'offerings', item.id));
    } catch (e) { console.error("Error al confirmar:", e); }
  };

  // ✅ 2. RECHAZAR/ELIMINAR
  const handleReject = async (id) => {
    if (window.confirm("¿Deseas eliminar esta intención de ofrenda?")) {
      await deleteDoc(doc(db, 'offerings', id));
    }
  };

  return (
    <div className="space-y-6 pt-4 pb-20">
      <header className="flex justify-between items-center px-2">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Pending Vault
          </h3>
          <p className="text-[10px] font-bold text-blue-400 uppercase">
            {items.length} Transferencias por validar
          </p>
        </div>
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 animate-pulse">
          <Clock size={18} />
        </div>
      </header>

      <div className="space-y-4">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 50 }}
              className="relative group"
            >
              {/* CARD GLASSMORPHISM */}
              <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-6 rounded-[35px] shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <User className="text-white" size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-white italic tracking-tight uppercase">
                        {item.fullName}
                      </h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        {item.type || 'Ofrenda'} • {new Date(item.date?.seconds * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-black text-blue-400 italic">
                    ${Number(item.amount).toLocaleString('es-AR')}
                  </p>
                </div>

                {/* PEDIDO DE ORACIÓN (ESTILO BURBUJA) */}
                {item.prayerRequest && (
                  <div className="flex gap-3 items-start bg-white/5 p-4 rounded-2xl border border-white/5 mb-6">
                    <MessageSquare size={14} className="text-blue-500 mt-1 flex-shrink-0" />
                    <p className="text-[11px] font-medium text-slate-300 leading-relaxed italic">
                      "{item.prayerRequest}"
                    </p>
                  </div>
                )}

                {/* ACCIONES */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleReject(item.id)}
                    className="flex-1 py-4 bg-white/5 hover:bg-rose-500/10 border border-white/5 rounded-2xl text-slate-500 hover:text-rose-500 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase"
                  >
                    <Trash2 size={16} /> Reject
                  </button>
                  <button 
                    onClick={() => handleConfirm(item)}
                    className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest"
                  >
                    <Check size={16} strokeWidth={3} /> Confirm Vault
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-32 space-y-4"
          >
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-white/5">
              <Wallet className="text-slate-700" size={32} />
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-[0.3em]">
              Bóveda en orden
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}