import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Heart, Copy, Check, ChevronLeft, Wallet, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Ofrendar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState('ofrenda'); // 'diezmo' o 'ofrenda'
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

  const formatVisualAmount = (val) => {
    if (!val) return '';
    const numeric = val.replace(/\D/g, '');
    return new Intl.NumberFormat('es-AR').format(numeric);
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.amount) return;
    setIsSubmitting(true);

    try {
      // ✅ REGISTRO AUTOMÁTICO AL FINALIZAR FORMULARIO
      await addDoc(collection(db, 'offerings'), {
        fullName: formData.name,
        type: type, // 'diezmo' o 'ofrenda'
        prayerRequest: formData.prayer,
        amount: Number(formData.amount.replace(/\D/g, '')),
        uid: user?.uid || 'guest',
        date: serverTimestamp(), // 🔥 Fecha y hora automática del servidor
        status: 'pending_transfer'
      });
      
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
      {/* 🚀 CABECERA PREMIUM CDS */}
      <header className="bg-slate-900 text-white pt-12 pb-10 px-8 rounded-b-[50px] shadow-2xl flex-shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10">
            <Sparkles size={120} />
        </div>
        <div className="flex items-center justify-between mb-8 relative z-10">
          <button onClick={() => navigate('/apps')} className="p-3 bg-white/10 rounded-2xl active:scale-90 transition-all border border-white/10">
            <ChevronLeft size={24} />
          </button>
          <div className="text-right">
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-none italic">Ofrendar</h1>
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.3em]">Ministerio CDS</p>
          </div>
        </div>
        
        {/* Selector Diezmo / Ofrenda */}
        <div className="flex bg-white/5 p-1.5 rounded-[22px] border border-white/10 relative z-10">
            <button 
                onClick={() => setType('ofrenda')}
                className={`flex-1 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${type === 'ofrenda' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400'}`}
            >
                Ofrenda
            </button>
            <button 
                onClick={() => setType('diezmo')}
                className={`flex-1 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${type === 'diezmo' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400'}`}
            >
                Diezmo
            </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        {step === 1 ? (
          <div className="space-y-6 animate-fade-in pb-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-5 tracking-[0.2em]">Dador</label>
              <input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] font-bold text-slate-800 focus:border-slate-900 outline-none transition-all shadow-inner"
                placeholder="Nombre completo"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-5 tracking-[0.2em]">Monto {type === 'diezmo' ? 'del Diezmo' : 'de la Siembra'}</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 text-2xl">$</span>
                <input 
                  type="text"
                  value={formatVisualAmount(formData.amount)}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full p-6 pl-12 bg-slate-50 border-2 border-slate-100 rounded-[32px] font-black text-3xl text-slate-900 focus:border-slate-900 outline-none shadow-inner"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-5 tracking-[0.2em]">Pedido de Oración</label>
              <textarea 
                value={formData.prayer}
                onChange={(e) => setFormData({...formData, prayer: e.target.value})}
                className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] font-bold text-slate-700 text-sm h-36 resize-none focus:border-slate-900 outline-none shadow-inner"
                placeholder="Escribí tu pedido aquí..."
              />
            </div>

            <button 
              onClick={handleRegister}
              disabled={isSubmitting || !formData.amount}
              className="w-full bg-slate-900 text-white py-7 rounded-[35px] font-black uppercase text-sm shadow-2xl shadow-slate-300 flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <> <Loader2 size={22} className="animate-spin" /> Registrando... </>
              ) : (
                <> Finalizar {type === 'diezmo' ? 'Diezmo' : 'Ofrenda'} <ArrowRight size={22}/> </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-slide-up pb-10">
            <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[30px] flex items-center justify-center mx-auto shadow-inner mb-4">
                    <Heart size={40} fill="currentColor"/>
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">¡Gracias por tu siembra!</h2>
                <p className="text-xs font-bold text-slate-400 px-6">Tus datos han sido registrados. Ahora completá la transferencia:</p>
            </div>

            {/* BOTÓN ALIAS MAGNÍFICO */}
            <div 
              onClick={copyAlias}
              className="bg-slate-900 text-white p-8 rounded-[45px] relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer shadow-2xl shadow-slate-300 border-b-8 border-slate-800"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent"></div>
              <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] mb-4 relative z-10">Alias de la Iglesia</p>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <span className="font-mono font-black text-2xl tracking-tight">CASA.DE.DIOS.OK</span>
                <div className={`p-4 rounded-2xl transition-all ${copied ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    {copied ? <Check size={24}/> : <Copy size={24}/>}
                </div>
              </div>
              <div className={`w-full py-5 rounded-[25px] font-black text-xs uppercase flex items-center justify-center gap-3 transition-all ${copied ? 'bg-emerald-500 shadow-lg' : 'bg-white text-slate-900'}`}>
                {copied ? "¡Copiado con éxito!" : "Toca para Copiar Alias"}
              </div>
            </div>

            {/* PASO A PASO Y AGRADECIMIENTO */}
            <div className="space-y-6 pt-6">
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">Instrucciones</p>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center gap-4 text-slate-400">
                            <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black">1</span>
                            <p className="text-[11px] font-bold italic">Copiá el Alias de arriba haciendo un solo click.</p>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400">
                            <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black">2</span>
                            <p className="text-[11px] font-bold italic">Abrí tu App de Banco o Mercado Pago.</p>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400">
                            <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black">3</span>
                            <p className="text-[11px] font-bold italic">Pegá el alias y transferí el monto propuesto.</p>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-100 text-center">
                    <p className="text-xs font-medium text-slate-400 leading-relaxed italic">
                        Tu generosidad permite que el Ministerio CDS siga alcanzando familias y transformando vidas. Oramos para que Dios multiplique tu semilla al ciento por uno.
                    </p>
                </div>
            </div>

            <button onClick={() => setStep(1)} className="w-full py-6 text-slate-300 font-black text-[10px] uppercase tracking-[0.3em]">← Corregir información</button>
          </div>
        )}
      </main>
    </div>
  );
}