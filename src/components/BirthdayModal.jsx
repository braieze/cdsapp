import { useState } from 'react';
import { X, MessageCircle, Cake, Megaphone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { ONESIGNAL_CONFIG } from '../oneSignalConfig';

export default function BirthdayModal({ isOpen, onClose, users, dbUser }) {
  const [isNotifying, setIsNotifying] = useState(false);

  if (!isOpen) return null;

  const isModerator = dbUser?.role === 'pastor' || dbUser?.role === 'lider';

  // 🚀 LÓGICA DE NOTIFICACIÓN COMPLETA Y CONECTADA
  const manualNotify = async () => {
    if (!window.confirm("¿Quieres enviar un aviso global a toda la iglesia para saludar a los cumpleañeros?")) return;
    setIsNotifying(true);

    try {
      // Extraemos solo el primer nombre de los cumpleañeros
      const names = users.map(u => u.displayName?.split(' ')[0]).join(', ');
      const title = "¡Día de Cumpleaños! 🎂";
      const body = `Hoy celebramos la vida de ${names}. ¡Entra a la app para dejarles un saludo!`;

      // 1. Guardar en Firestore para que aparezca en la Campanita
      const notifRef = doc(collection(db, 'notificaciones_globales'));
      await setDoc(notifRef, {
        titulo: title,
        mensaje: body,
        fecha: new Date().toISOString(),
        destino: 'TODOS',
        link: '/'
      });

      // 2. Enviar Push Notification real vía OneSignal
      const REST_API_KEY = ONESIGNAL_CONFIG.REST_API_KEY;
      if (REST_API_KEY) {
        const payload = {
          app_id: ONESIGNAL_CONFIG.APP_ID,
          included_segments: ["Total Subscriptions"],
          headings: { en: title, es: title },
          contents: { en: body, es: body },
          data: { route: '/' },
          large_icon: "https://cdsapp.vercel.app/logo.png",
          priority: 10,
          android_visibility: 1
        };

        await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json; charset=utf-8", 
            "Authorization": `Basic ${REST_API_KEY}` 
          },
          body: JSON.stringify(payload)
        });
      }

      toast.success("¡Aviso enviado a toda la iglesia!");
      onClose(); // Cierra el modal al terminar
    } catch (error) {
      console.error("Error enviando push:", error);
      toast.error("Hubo un error al enviar el aviso.");
    } finally {
      setIsNotifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-6 relative animate-scale-in border border-slate-100" onClick={e => e.stopPropagation()}>
        
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
            <X size={18} />
        </button>

        {/* HEADER MODERNO */}
        <div className="text-center mb-6 pt-2">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-100 shadow-sm">
                <Cake size={32} strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">¡Felicidades!</h3>
            <p className="text-xs font-semibold text-slate-500 mt-2">Hermanos que cumplen hoy</p>
        </div>

        {/* LISTA DE CUMPLEAÑEROS */}
        <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar pb-2">
            {users.map((user, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=f8fafc&color=0f172a`} alt={user.displayName} className="w-11 h-11 rounded-full object-cover border border-slate-100 bg-slate-50" />
                        <div className="text-left">
                            <p className="font-bold text-sm text-slate-900 leading-tight">{user.displayName}</p>
                            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">¡Bendícelo hoy! 🎉</p>
                        </div>
                    </div>
                    
                    {user.phone && (
                        <a 
                            href={`https://wa.me/${user.phone.replace(/\D/g,'')}?text=¡Feliz cumpleaños ${user.displayName.split(' ')[0]}! 🎉🎂 Que Dios te bendiga mucho.`}
                            target="_blank" rel="noreferrer"
                            className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center active:scale-90 transition-transform hover:bg-green-100"
                        >
                            <MessageCircle size={18} strokeWidth={2.5} />
                        </a>
                    )}
                </div>
            ))}
        </div>

        {/* 📢 BOTÓN PARA EL PASTOR */}
        {isModerator && (
            <button 
              onClick={manualNotify}
              disabled={isNotifying}
              className="w-full mt-4 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {isNotifying ? <Loader2 size={18} className="animate-spin" /> : <Megaphone size={18} />} 
              {isNotifying ? 'Notificando...' : 'Avisar a la Iglesia'}
            </button>
        )}
      </div>
    </div>
  );
}