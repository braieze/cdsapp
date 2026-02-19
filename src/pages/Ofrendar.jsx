import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Heart, Copy, Check, ChevronLeft, Wallet, Smartphone, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Ofrendar() {
  const navigate = useNavigate();
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
    if (!formData.name || !formData.amount) return;
    try {
      await addDoc(collection(db, 'offerings'), {
        fullName: formData.name,
        prayerRequest: formData.prayer,
        amount: Number(formData.amount),
        uid: user?.uid || 'guest',
        date: serverTimestamp(), // 🔥 Registro automático
        status: 'intent'
      });
      setStep(2);
    } catch (e) { console.error(e); }
  };

  const copyAlias = () => {
    navigator.clipboard.writeText("CASA.DE.DIOS.OK");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-[100] font-outfit">
      {/* 🚀 CABECERA ESTILO CDS */}
      <header className="bg-slate-900 text-white pt-12 pb-8 px-6 rounded-b-[40px] shadow-2xl flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/apps')} className="p-2 bg-white/10 rounded-full active:scale-90 transition-all">
            <ChevronLeft size={24} />
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">Ofrendar</h1>
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.2em]">Ministerio CDS</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-4">
          <div className="bg-brand-500/20 p-3 rounded-2xl text-brand-400 animate-pulse">
            <Heart size={24} fill="currentColor" />
          </div>
          <p className="text-[11px] font-medium text-slate-300 leading-snug">
            "Cada uno dé como propuso en su corazón, no con tristeza, sino con alegría."
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {step === 1 ? (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nombre del Dador</label>
              <input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-bold text-slate-800 focus:border-brand-500 outline-none transition-all shadow-inner"
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Monto a Sembrar</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xl">$</span>
                <input 
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full p-5 pl-10 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-black text-2xl text-slate-900 focus:border-brand-500 outline-none shadow-inner"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Pedido de Oración</label>
              <textarea 
                value={formData.prayer}
                onChange={(e) => setFormData({...formData, prayer: e.target.value})}
                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-bold text-slate-700 text-sm h-32 resize-none focus:border-brand-500 outline-none shadow-inner"
                placeholder="¿Por qué te gustaría que oremos?"
              />
            </div>

            <button 
              onClick={handleRegister}
              className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black uppercase text-sm shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95 transition-all mt-4"
            >
              Confirmar Datos <ArrowRight size={20}/>
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-slide-up">
            {/* CARD: TRANSFERENCIA (ALIAS) */}
            <div className="bg-slate-50 border-2 border-slate-100 p-6 rounded-[40px] relative overflow-hidden group active:bg-slate-100 transition-colors cursor-pointer" onClick={copyAlias}>
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-5 py-1.5 rounded-bl-2xl uppercase tracking-tighter">100% para la obra</div>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-white p-3 rounded-2xl shadow-sm"><Wallet className="text-slate-900" size={24}/></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alias Bancario</p>
                  <p className="font-mono font-black text-lg text-slate-800">CASA.DE.DIOS.OK</p>
                </div>
              </div>
              <button 
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}
              >
                {copied ? <><Check size={16}/> Copiado</> : <><Copy size={16}/> Copiar Alias</>}
              </button>
              <p className="text-[9px] text-slate-400 font-bold mt-4 text-center">Ideal para transferir desde cualquier Banco o Billetera.</p>
            </div>

            {/* CARD: MERCADO PAGO */}
            <a 
              href="link.mercadopago.com.ar/proyectbro"
              target="_blank"
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