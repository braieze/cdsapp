import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Heart, Copy, Check, ChevronLeft, Wallet, ArrowRight, Loader2, Sparkles, Smartphone, Instagram, Facebook, MessageCircle, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Ofrendar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState('ofrenda');
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
      await addDoc(collection(db, 'offerings'), {
        fullName: formData.name,
        type: type,
        prayerRequest: formData.prayer,
        amount: Number(formData.amount.replace(/\D/g, '')),
        uid: user?.uid || 'guest',
        date: serverTimestamp(),
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
    navigator.clipboard.writeText("cds.iglesia");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ✅ Función para resetear y hacer otra ofrenda
  const resetForm = () => {
    setFormData({ ...formData, amount: '', prayer: '' });
    setStep(1);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-[150] font-outfit overflow-hidden">
      
      {/* 🚀 CABECERA: Se adapta según el paso */}
      <header className="bg-slate-900 text-white pt-12 pb-10 px-8 rounded-b-[50px] shadow-2xl flex-shrink-0 relative overflow-hidden transition-all duration-500">
        <div className="absolute top-0 right-0 p-10 opacity-10 animate-pulse">
            <Sparkles size={120} />
        </div>
        <div className="flex items-center justify-between mb-8 relative z-10">
          <button 
            onClick={() => user ? navigate('/apps') : (window.location.href = "https://instagram.com/conquistadoresdesuenosok")} 
            className="p-3 bg-white/10 rounded-2xl active:scale-90 transition-all border border-white/10"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="text-right">
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-none italic">
                {step === 1 ? 'Ofrendar' : 'Enviado'}
            </h1>
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.3em]">Ministerio CDS</p>
          </div>
        </div>
        
        {/* Solo mostramos el selector en el Paso 1 */}
        {step === 1 && (
            <div className="flex bg-white/5 p-1.5 rounded-[22px] border border-white/10 relative z-10 animate-fade-in">
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
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50">
        {step === 1 ? (
          <div className="space-y-6 animate-fade-in pb-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-5 tracking-[0.2em]">Dador</label>
              <input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-6 bg-white border-2 border-slate-100 rounded-[32px] font-bold text-slate-800 focus:border-slate-900 outline-none transition-all shadow-sm"
                placeholder="Nombre completo"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-5 tracking-[0.2em]">Monto $</label>
              <input 
                type="text"
                value={formatVisualAmount(formData.amount)}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                className="w-full p-6 bg-white border-2 border-slate-100 rounded-[32px] font-black text-3xl text-slate-900 focus:border-slate-900 outline-none shadow-sm"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-5 tracking-[0.2em]">Pedido de Oración</label>
              <textarea 
                value={formData.prayer}
                onChange={(e) => setFormData({...formData, prayer: e.target.value})}
                className="w-full p-6 bg-white border-2 border-slate-100 rounded-[32px] font-bold text-slate-700 text-sm h-36 resize-none focus:border-slate-900 outline-none shadow-sm"
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
                <> Finalizar Registro <ArrowRight size={22}/> </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-slide-up pb-10">
            <div className="text-center space-y-2 pt-4">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[30px] flex items-center justify-center mx-auto shadow-inner mb-4 animate-bounce-slow">
                    <Heart size={40} fill="currentColor"/>
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">¡Gracias por sembrar!</h2>
                <p className="text-[10px] font-bold text-slate-400 px-10 uppercase tracking-widest leading-relaxed">Tus datos ya están con nosotros. Completá la transferencia:</p>
            </div>

            {/* BOTÓN ALIAS MAGNÍFICO */}
            <div 
              onClick={copyAlias}
              className="bg-slate-900 text-white p-8 rounded-[45px] relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer shadow-2xl border-b-8 border-slate-800"
            >
              <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] mb-4">Alias de la Iglesia</p>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono font-black text-2xl tracking-tight uppercase">cds.iglesia</span>
                <div className={`p-4 rounded-2xl transition-all ${copied ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    {copied ? <Check size={24}/> : <Copy size={24}/>}
                </div>
              </div>
              <div className={`w-full py-5 rounded-[25px] font-black text-xs uppercase flex items-center justify-center gap-3 transition-all ${copied ? 'bg-emerald-500 shadow-lg' : 'bg-white text-slate-900'}`}>
                {copied ? "¡Alias Copiado!" : "Toca para Copiar"}
              </div>
            </div>

            {/* BOTONES SOCIALES PREMIUM */}
            <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">Sigamos conectados</p>
                <div className="grid grid-cols-3 gap-3">
                    <a href="https://wa.me/tu_numero" className="bg-[#25D366] text-white p-5 rounded-[30px] flex flex-col items-center gap-2 active:scale-90 transition-all shadow-lg shadow-green-100">
                        <MessageCircle size={24}/>
                        <span className="text-[8px] font-black uppercase">WhatsApp</span>
                    </a>
                    <a href="https://instagram.com/conquistadoresdesuenosok" className="bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white p-5 rounded-[30px] flex flex-col items-center gap-2 active:scale-90 transition-all shadow-lg shadow-pink-100">
                        <Instagram size={24}/>
                        <span className="text-[8px] font-black uppercase">Instagram</span>
                    </a>
                    <a href="https://facebook.com/tu_iglesia" className="bg-[#1877F2] text-white p-5 rounded-[30px] flex flex-col items-center gap-2 active:scale-90 transition-all shadow-lg shadow-blue-100">
                        <Facebook size={24}/>
                        <span className="text-[8px] font-black uppercase">Facebook</span>
                    </a>
                </div>
            </div>

            {/* ✅ NUEVO BOTÓN: REALIZAR OTRA OFRENDA */}
            <button 
                onClick={resetForm}
                className="w-full py-5 border-2 border-slate-200 text-slate-400 rounded-[35px] font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 active:bg-slate-100 transition-all"
            >
                <RefreshCcw size={14}/> Realizar otra ofrenda
            </button>

            <div className="pt-6 text-center">
                <p className="text-[11px] font-bold text-slate-300 leading-relaxed italic px-6 uppercase tracking-tight">
                    "Oramos para que Dios multiplique tu semilla al ciento por uno."
                </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}