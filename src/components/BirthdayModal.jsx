import { X, MessageCircle, Cake, Megaphone } from 'lucide-react';

export default function BirthdayModal({ isOpen, onClose, users, dbUser }) { // Agregamos dbUser
  if (!isOpen) return null;

  const isModerator = dbUser?.role === 'pastor' || dbUser?.role === 'lider';

  const manualNotify = async () => {
    if (!window.confirm("¿Quieres enviar una notificación global saludando a los cumpleañeros?")) return;
    // ... aquí iría el fetch de OneSignal que te pasé arriba ...
    alert("Notificación enviada");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-xs rounded-[40px] shadow-2xl p-6 relative animate-scale-in" onClick={e => e.stopPropagation()}>
        
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400 active:scale-90 transition-transform">
            <X size={20} />
        </button>

        <div className="text-center mb-6 pt-2">
            <div className="w-20 h-20 bg-gradient-to-tr from-brand-500 to-brand-400 text-white rounded-[30px] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brand-100 animate-bounce">
                <Cake size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">¡Felicidades!</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-4 mt-1">Hermanos que cumplen hoy</p>
        </div>

        <div className="space-y-3 max-h-[40vh] overflow-y-auto no-scrollbar pr-1">
            {users.map((user, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt={user.displayName} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm" />
                        <div className="text-left">
                            <p className="font-black text-xs text-slate-800 uppercase tracking-tighter">{user.displayName}</p>
                            <p className="text-[9px] text-brand-600 font-bold uppercase">¡Bendícelo hoy! 🎉</p>
                        </div>
                    </div>
                    
                    {user.phone && (
                        <a 
                            href={`https://wa.me/${user.phone.replace(/\D/g,'')}?text=¡Feliz cumpleaños ${user.displayName.split(' ')[0]}! 🎉🎂 Que Dios te bendiga mucho.`}
                            target="_blank" rel="noreferrer"
                            className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-100 active:scale-90 transition-transform"
                        >
                            <MessageCircle size={18} fill="white" />
                        </a>
                    )}
                </div>
            ))}
        </div>

        {/* 📢 BOTÓN PARA EL PASTOR */}
        {isModerator && (
            <button 
              onClick={manualNotify}
              className="w-full mt-6 py-4 bg-slate-900 text-white rounded-[22px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <Megaphone size={16} className="text-brand-400"/> Notificar a la Iglesia
            </button>
        )}
      </div>
    </div>
  );
}