import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { 
  Heart, Copy, Check, ChevronLeft, Wallet, ArrowRight, 
  Loader2, Sparkles, Smartphone, Instagram, Facebook, 
  MessageCircle, RefreshCcw, ExternalLink 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Ofrendar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState('ofrenda');
  const [formData, setFormData] = useState({ name: '', prayer: '', amount: '' });

  const IGLESIA_ALIAS = "cds.iglesia";

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

  // ✅ ACCIÓN MAESTRA: Copia y Abre MP
  const handleSmartPay = () => {
    navigator.clipboard.writeText(IGLESIA_ALIAS);
    setCopied(true);
    
    // Pequeño aviso visual antes de redirigir
    setTimeout(() => {
        setCopied(false);
        // Intenta abrir la sección de transferencias de Mercado Pago
        window.location.href = "https://www.mercadopago.com.ar/as/p2p-transfer-ui/";
    }, 1200);
  };

  const copyAlias = () => {
    navigator.clipboard.writeText(IGLESIA_ALIAS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setFormData({ ...formData, amount: '', prayer: '' });
    setStep(1);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-[150] font-outfit overflow-hidden">
      
      {/* 🚀 CABECERA */}
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
                {step === 1 ? 'Ofrendar' : 'Confirmar'}
            </h1>
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.3em]">Ministerio CDS</p>
          </div>
        </div>
        
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
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[30px] flex items-center justify-center mx-auto shadow-inner mb-4">
                    <Heart size={40} fill="currentColor"/>
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">¡Registro Exitoso!</h2>
                <p className="text-[10px] font-bold text-slate-400 px-10 uppercase tracking-widest leading-relaxed">Solo falta enviar el dinero por Mercado Pago:</p>
            </div>

            {/* ✅ BOTÓN DE ACCIÓN RÁPIDA (CONTRA LA FIACA) */}
            <div className="space-y-3">
                <button 
                    onClick={handleSmartPay}
                    className="w-full bg-sky-500 text-white p-7 rounded-[35px] font-black uppercase text-xs flex items-center justify-center gap-4 shadow-xl shadow-sky-100 active:scale-95 transition-all"
                >
                    <Smartphone size={24} />
                    <span>{copied ? "Copiando Alias..." : "Abrir Mercado Pago"}</span>
                </button>
                <p className="text-[9px] font-black text-slate-300 text-center uppercase tracking-[0.2em]">Copia el alias y abre la App automáticamente</p>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 border-dashed"></div></div>
                <div className="relative flex justify-center text-[10px] font-black text-slate-300 uppercase bg-slate-50/50 px-4">O copia manualmente</div>
            </div>

            {/* ALIAS MANUAL */}
            <div 
              onClick={copyAlias}
              className="bg-white border-2 border-slate-100 p-8 rounded-[45px] relative active:scale-[0.98] transition-all cursor-pointer shadow-sm group"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono font-black text-xl tracking-tight uppercase text-slate-800">{IGLESIA_ALIAS}</span>
                <div className={`p-3 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {copied ? <Check size={18}/> : <Copy size={18}/>}
                </div>
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{copied ? "¡Alias en el portapapeles!" : "Toca para copiar alias"}</div>
            </div>

            {/* BOTONES SOCIALES */}
            <div className="grid grid-cols-3 gap-3 pt-4">
                <a href="https://wa.me/tu_numero" className="bg-emerald-50 text-emerald-600 p-5 rounded-[30px] flex flex-col items-center gap-2 active:scale-90 transition-all border border-emerald-100">
                    <MessageCircle size={24}/>
                    <span className="text-[8px] font-black uppercase">Soporte</span>
                </a>
                <a href="https://instagram.com/conquistadoresdesuenosok" className="bg-pink-50 text-pink-600 p-5 rounded-[30px] flex flex-col items-center gap-2 active:scale-90 transition-all border border-pink-100">
                    <Instagram size={24}/>
                    <span className="text-[8px] font-black uppercase">Instagram</span>
                </a>
                <a href="https://facebook.com/tu_iglesia" className="bg-blue-50 text-blue-600 p-5 rounded-[30px] flex flex-col items-center gap-2 active:scale-90 transition-all border border-blue-100">
                    <Facebook size={24}/>
                    <span className="text-[8px] font-black uppercase">Facebook</span>
                </a>
            </div>

            <button 
                onClick={resetForm}
                className="w-full py-5 border-2 border-slate-200 text-slate-400 rounded-[35px] font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 active:bg-slate-100 transition-all"
            >
                <RefreshCcw size={14}/> Realizar otra ofrenda
            </button>
          </div>
        )}
      </main>
    </div>
  );
}