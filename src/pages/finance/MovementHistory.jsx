import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { TrendingUp, TrendingDown, Edit3, Trash2, Calendar, Tag, MoreHorizontal } from 'lucide-react';

export default function MovementHistory({ movements = [] }) {
  
  const handleDelete = async (id) => {
    if (window.confirm("¿Eliminar este registro permanentemente? Esta acción no se puede deshacer.")) {
      await deleteDoc(doc(db, 'finances', id));
    }
  };

  return (
    <div className="space-y-6 pt-4 pb-20">
      <header className="flex justify-between items-center px-2">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 text-left">Activity Log</h3>
          <p className="text-[10px] font-bold text-blue-400 uppercase text-left">Historial completo de movimientos</p>
        </div>
      </header>

      <div className="space-y-3">
        {movements.map((m) => (
          <motion.div 
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-[30px] flex justify-between items-center hover:bg-slate-900/60 transition-all shadow-sm"
          >
            <div className="flex items-center gap-4 text-left">
              <div className={`p-3 rounded-2xl ${m.total > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {m.total > 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
              </div>
              <div>
                <p className="text-[11px] font-black text-white italic uppercase tracking-tight">{m.concept}</p>
                <div className="flex items-center gap-2 mt-1">
                   <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{m.type || 'Movimiento'}</p>
                   <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                   <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{m.method}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <p className={`font-black italic ${m.total > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {m.total > 0 ? '+' : ''}${Math.abs(m.total).toLocaleString('es-AR')}
                </p>
                <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">
                  {new Date(m.date?.seconds * 1000).toLocaleDateString()}
                </p>
              </div>
              
              {/* ACCIONES CRUD OCULTAS (Aparecen al hover) */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                <button className="p-2 bg-white/5 text-slate-400 hover:text-blue-400 rounded-xl transition-colors">
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(m.id)}
                  className="p-2 bg-white/5 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {movements.length === 0 && (
          <div className="py-20 text-center opacity-20 italic text-sm text-white">
            No hay registros en el historial
          </div>
        )}
      </div>
    </div>
  );
}