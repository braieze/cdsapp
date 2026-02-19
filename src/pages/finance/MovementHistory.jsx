import { motion } from 'framer-motion';
import { db } from '../../firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { 
  TrendingUp, TrendingDown, Edit3, Trash2, 
  Download, FileText, Calendar, Tag, MoreHorizontal 
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function MovementHistory({ movements = [] }) {
  
  // ✅ 1. ELIMINAR REGISTRO (CRUD)
  const handleDelete = async (id) => {
    if (window.confirm("¿Eliminar este registro permanentemente? Esta acción restará el monto del balance total.")) {
      try {
        await deleteDoc(doc(db, 'finances', id));
      } catch (e) { console.error("Error al borrar:", e); }
    }
  };

  // ✅ 2. GENERAR REPORTE PDF PROFESIONAL
  const descargarPDF = () => {
    const doc = new jsPDF();
    
    // Estilo del encabezado
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("BÓVEDA CDS", 14, 25);
    doc.setFontSize(10);
    doc.text("REPORTE FINANCIERO OFICIAL", 14, 32);

    // Datos de la tabla
    const tablaData = movements.map(m => [
      m.date?.seconds ? new Date(m.date.seconds * 1000).toLocaleDateString() : 'S/D',
      m.concept || 'Movimiento General',
      m.method || 'Bancos',
      m.total > 0 ? 'Ingreso' : 'Egreso',
      `$${Math.abs(m.total).toLocaleString('es-AR')}`
    ]);

    doc.autoTable({
      head: [['Fecha', 'Detalle', 'Método', 'Tipo', 'Monto']],
      body: tablaData,
      startY: 50,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, // Blue 600
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Reporte_Caja_CDS_${new Date().toLocaleDateString()}.pdf`);
  };

  return (
    <div className="space-y-6 pt-4 pb-24">
      {/* HEADER DEL HISTORIAL */}
      <header className="flex justify-between items-end px-2">
        <div className="text-left">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Registro de Actividad
          </h3>
          <p className="text-[10px] font-bold text-blue-400 uppercase">
            Libro diario de bóveda
          </p>
        </div>
        <button 
          onClick={descargarPDF}
          className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/20 flex items-center gap-2 text-[10px] font-black uppercase transition-all active:scale-95 shadow-lg shadow-blue-500/10"
        >
          <Download size={14}/> Reporte PDF
        </button>
      </header>

      {/* LISTA DE MOVIMIENTOS */}
      <div className="space-y-3">
        {movements.map((m) => (
          <motion.div 
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-slate-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-[35px] flex justify-between items-center hover:bg-slate-900/60 transition-all shadow-sm"
          >
            <div className="flex items-center gap-4 text-left">
              <div className={`p-3 rounded-2xl ${m.total > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {m.total > 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
              </div>
              <div>
                <p className="text-[11px] font-black text-white italic uppercase tracking-tight leading-none mb-1">
                  {m.concept}
                </p>
                <div className="flex items-center gap-2">
                   <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{m.type || 'Movimiento'}</p>
                   <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                   <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{m.method}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <p className={`font-black italic ${m.total > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {m.total > 0 ? '+' : '-'}${Math.abs(m.total).toLocaleString('es-AR')}
                </p>
                <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">
                  {m.date?.seconds ? new Date(m.date.seconds * 1000).toLocaleDateString() : 'Hoy'}
                </p>
              </div>
              
              {/* ACCIONES CRUD (Aparecen al pasar el mouse o tocar) */}
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