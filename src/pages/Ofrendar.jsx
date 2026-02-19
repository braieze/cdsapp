import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Heart, Copy, Check, ChevronLeft, Wallet, Smartphone, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Ofrendar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Estado para el icono de carga
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

  // ✅ 1. Formateo automático de miles (Ej: 20000 -> 20.000)
  const formatVisualAmount = (val) => {
    if (!val) return '';
    const numeric = val.replace(/\D/g, '');
    return new Intl.NumberFormat('es-AR').format(numeric);
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.amount) return;
    setIsSubmitting(true); // 🚀 Mostrar cargando

    try {
      // Guardamos en Firebase con el monto limpio (sin puntos)
      await addDoc(collection(db, 'offerings'), {
        fullName: formData.name,
        prayerRequest: formData.prayer,
        amount: Number(formData.amount.replace(/\D/g, '')),
        uid: user?.uid || 'guest',
        date: serverTimestamp(), // 🔥 Registro de fecha automático
        status: 'intent'
      });
      
      // Simulamos un pequeño delay para que se vea el proceso
      setTimeout(() => {
        setIsSubmitting(false);
        setStep(2);
      }, 800);
    } catch (e) { 
      console.error(e); 
      setIsSubmitting(false);
    }
  };

  const copyAlias = () => {
    navigator.clipboard.writeText("CASA.DE.DIOS.OK");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-[150] font-outfit overflow-hidden">
      {/* 🚀 CABECERA ESTILO CDS */}
      <header className="bg-slate-900 text-white pt-12 pb-8 px-6 rounded-b-[40px] shadow-2xl flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/apps')} className="p-2 bg-white/10 rounded-full active:scale-90 transition-all">
            <ChevronLeft size={24} />
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none italic">Ofrendar</h1>
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.2em]">Ministerio CDS</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-4">
          <div className="bg-brand-500/20 p-3 rounded-2xl text-brand-400">
            <Heart size={24} fill="currentColor" />
          </div>
          <p className="text-[11px] font-medium text-slate-300 leading-snug">
            "Honra al Señor con tus bienes y con las primicias de tus frutos."
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {step === 1 ? (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Dador</label>
              <input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-bold text-slate-800 focus:border-brand-500 outline-none transition-all shadow-inner"
                placeholder="Nombre completo"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Monto $</label>
              <input 
                type="text"
                value={formatVisualAmount(formData.amount)}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-black text-3xl text-slate-900 focus:border-brand-500 outline-none shadow-inner"
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Motivo de Oración</label>
              <textarea 
                value={formData.prayer}
                onChange={(e) => setFormData({...formData, prayer: e.target.value})}
                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-bold text-slate-700 text-sm h-32 resize-none focus:border-brand-500 outline-none shadow-inner"
                placeholder="Escribí aquí tu pedido..."
              />
            </div>

            {/* ✅ BOTÓN CON ICONO DE CARGA */}
            <button 
              onClick={handleRegister}
              disabled={isSubmitting || !formData.amount}
              className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black uppercase text-sm shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <> <Loader2 size={20} className="animate-spin" /> Procesando... </>
              ) : (
                <> Continuar <ArrowRight size={20}/> </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-slide-up">
            <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100">
               <p className="text-[10px] font-black text-emerald-600 text-center uppercase">Datos registrados correctamente</p>
            </div>

            {/* CARD: ALIAS (100% PARA LA IGLESIA) */}
            <div 
              onClick={copyAlias}
              className="bg-slate-900 text-white p-6 rounded-[40px] relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer shadow-xl shadow-slate-200"
            >
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-5 py-1.5 rounded-bl-2xl uppercase tracking-tighter">Sin comisiones</div>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-white/10 p-3 rounded-2xl"><Wallet className="text-brand-400" size={24}/></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transferir al Alias</p>
                  <p className="font-mono font-black text-lg">CASA.DE.DIOS.OK</p>
                </div>
              </div>
              <div className={`w-full py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all ${copied ? 'bg-emerald-500' : 'bg-white/10'}`}>
                {copied ? <><Check size={16}/> Copiado</> : <><Copy size={16}/> Copiar para transferir</>}
              </div>
            </div>

            {/* ✅ BOTÓN CORREGIDO: SE AGREGÓ HTTPS:// */}
            <a 
              href="https://link.mercadopago.com.ar/proyectbro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-5 p-6 bg-[#009EE3] text-white rounded-[40px] shadow-lg shadow-blue-100 active:scale-95 transition-all"
            >
              <div className="bg-white/20 p-4 rounded-2xl"><Smartphone size={28}/></div>
              <div className="text-left">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest">Pagar con</p>
                <p className="font-black text-xl leading-none">Mercado Pago</p>
              </div>
            </a>

            <button onClick={() => setStep(1)} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest">← Modificar información</button>
          </div>
        )}
      </main>
    </div>
  );
}