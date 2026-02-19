import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Heart, Copy, Check, Wallet, Smartphone, Info, ArrowRight } from 'lucide-react';

export default function Ofrendar() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({ name: '', prayer: '', amount: '' });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        setFormData(prev => ({ ...prev, name: u.displayName || '' }));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRegister = async () => {
    if (!formData.name || !formData.amount) return alert("Completá nombre y monto");
    try {
      // ✅ REGISTRO AUTOMÁTICO EN FIREBASE
      await addDoc(collection(db, 'offerings'), {
        fullName: formData.name,
        prayerRequest: formData.prayer,
        amount: Number(formData.amount),
        uid: user?.uid || 'guest',
        date: serverTimestamp(), // 🔥 Fecha y hora automática
        status: 'intent'
      });
      setStep(2);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="max-w-md mx-auto p-4 font-outfit min-h-screen bg-white">
      {step === 1 ? (
        <div className="space-y-6 pt-10">
          <div className="text-center">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Ofrendar</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ministerio Casa de Dios</p>
          </div>

          <div className="space-y-4">
            <input 
              placeholder="Nombre y Apellido" 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
            <input 
              type="number" 
              placeholder="Monto $ 0.00" 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-2xl"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
            <textarea 
              placeholder="Pedido de oración (Opcional)" 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl h-32 resize-none"
              value={formData.prayer}
              onChange={(e) => setFormData({...formData, prayer: e.target.value})}
            />
            <button onClick={handleRegister} className="w-full bg-slate-900 text-white py-5 rounded-[30px] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2">
              Confirmar y Ofrendar <ArrowRight size={16}/>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-slide-up pt-10">
          <div className="bg-emerald-50 p-6 rounded-[35px] border-2 border-emerald-100 text-center">
             <h2 className="text-xl font-black text-emerald-700">¡Casi listo!</h2>
             <p className="text-xs font-bold text-emerald-600/70">Elegí cómo completar tu ofrenda:</p>
          </div>

          {/* OPCIÓN 1: ABRIR MERCADO PAGO DIRECTO */}
          <a 
            href="https://link.mercadopago.com.ar/TU_LINK" // 🔥 ACÁ VA EL LINK
            className="flex items-center gap-4 p-5 bg-blue-600 text-white rounded-[30px] shadow-lg shadow-blue-100 active:scale-95 transition-all"
          >
            <div className="bg-white/20 p-3 rounded-2xl"><Smartphone size={24}/></div>
            <div className="text-left">
              <p className="font-black text-sm">Abrir Mercado Pago</p>
              <p className="text-[9px] font-bold opacity-70 uppercase">Ideal para pagar ahora mismo</p>
            </div>
          </a>

          {/* OPCIÓN 2: COPIAR ALIAS (PARA CUALQUIER BANCO) */}
          <div className="p-6 bg-slate-50 rounded-[35px] border-2 border-slate-100 space-y-3">
             <div className="flex items-center gap-2 text-slate-400 mb-1">
               <Wallet size={16}/>
               <span className="text-[10px] font-black uppercase tracking-widest">Transferencia Bancaria</span>
             </div>
             <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm">
               <span className="font-mono font-black text-slate-700">braigomez</span>
               <button 
                onClick={() => {
                  navigator.clipboard.writeText("braigomez");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`p-2 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}
               >
                 {copied ? <Check size={18}/> : <Copy size={18}/>}
               </button>
             </div>
             <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-100">
               <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0"/>
               <p className="text-[9px] font-bold text-amber-700 leading-tight">
                 Copiá el alias, abrí tu App de banco y pegalo. Con este método el 100% de tu ofrenda llega a la iglesia.
               </p>
             </div>
          </div>

          <button onClick={() => setStep(1)} className="w-full py-4 text-slate-300 font-black text-[10px] uppercase tracking-[0.2em]">← Modificar datos</button>
        </div>
      )}
    </div>
  );
}