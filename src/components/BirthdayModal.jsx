import { X, MessageCircle, Cake } from 'lucide-react';

export default function BirthdayModal({ isOpen, onClose, users }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl p-5 relative animate-scale-in" onClick={e => e.stopPropagation()}>
        
        {/* Botón Cerrar */}
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition-colors">
            <X size={18} />
        </button>

        {/* Encabezado Festivo */}
        <div className="text-center mb-6 pt-2">
            <div className="w-16 h-16 bg-gradient-to-tr from-brand-100 to-white text-brand-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-brand-50">
                <Cake size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800">¡Feliz Cumpleaños!</h3>
            <p className="text-xs text-slate-500 px-4">Celebremos la vida de nuestros hermanos en su día.</p>
        </div>

        {/* Lista de Cumpleañeros */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {users.map((user, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 transition-transform hover:scale-[1.02]">
                    <div className="flex items-center gap-3">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">
                                {user.displayName?.charAt(0)}
                            </div>
                        )}
                        <div className="text-left">
                            <p className="font-bold text-sm text-slate-800 leading-tight">{user.displayName}</p>
                            <p className="text-[10px] text-brand-600 font-medium">¡Salúdalo hoy! 🎉</p>
                        </div>
                    </div>
                    
                    {/* Botón WhatsApp (Solo si tiene teléfono) */}
                    {user.phone ? (
                        <a 
                            href={`https://wa.me/${user.phone.replace(/\D/g,'')}?text=¡Feliz cumpleaños ${user.displayName.split(' ')[0]}! 🎉🎂 Que Dios te bendiga mucho hoy.`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2.5 bg-green-500 text-white rounded-full shadow-md hover:bg-green-600 transition-all active:scale-90"
                        >
                            <MessageCircle size={18} fill="white" />
                        </a>
                    ) : (
                        <span className="text-[10px] text-slate-300 italic">Sin tel</span>
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}