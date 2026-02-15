import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // <--- Importante para redirigir
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Calendar, MessageSquare, Briefcase, ChevronRight, Flame, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate(); // Hook de navegación
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(false); // Estado de carga

  const features = [
    {
      id: 0,
      icon: Calendar,
      title: 'Agenda Global',
      desc: 'Visualiza en tiempo real los próximos cultos, ensayos y eventos ministeriales.',
      color: 'from-emerald-500 to-green-700',
      glow: 'bg-emerald-500/20'
    },
    {
      id: 1,
      icon: MessageSquare,
      title: 'Muro Social',
      desc: 'Conéctate con la iglesia, lee devocionales y entérate de los anuncios urgentes.',
      color: 'from-blue-500 to-indigo-700',
      glow: 'bg-blue-500/20'
    },
    {
      id: 2,
      icon: Briefcase,
      title: 'Tus Servicios',
      desc: 'Revisa tus asignaciones, confirma tu asistencia y organiza tu ministerio.',
      color: 'from-rose-500 to-red-700',
      glow: 'bg-rose-500/20'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === features.length - 1 ? 0 : prev + 1));
    }, 3500);
    return () => clearInterval(timer);
  }, [features.length]);

  // 🔥 LA LÓGICA DE REGISTRO BLINDADA 🔥
  const handleGoogleLogin = async () => {
    setLoading(true); // Bloqueamos botón
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // 1. Referencia al usuario
      const userRef = doc(db, 'users', user.uid);

      // 🔥 CAMBIO CLAVE: Usamos setDoc con merge: true
      // Esto fuerza a guardar/actualizar los datos SIEMPRE que entres.
      // Si faltaba el nombre o la foto, esto lo arregla al instante.
      await setDoc(userRef, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        // Estos campos solo se ponen si no existen (para no borrar roles viejos)
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp() // Nuevo: para saber cuándo entró
      }, { merge: true });

      // Verificamos si tiene campos "vitales" para el directorio, si no, los rellenamos
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      
      if (!userData.role) await setDoc(userRef, { role: 'miembro' }, { merge: true });
      if (!userData.area) await setDoc(userRef, { area: 'ninguna' }, { merge: true });

      console.log("✅ Datos de usuario actualizados/verificados");

      // 3. Redirigimos al Home
      navigate('/');
      
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      alert("Hubo un error al intentar ingresar.");
    } finally {
      setLoading(false); // Desbloqueamos botón
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>

      <div className="fixed inset-0 bg-[#0a0f0d] flex flex-col items-center justify-between py-10 px-6 overflow-hidden font-outfit text-white">
        
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${features[currentSlide].glow}`}></div>

        <div className="flex flex-col items-center z-10 mt-2">
          <div className="w-12 h-12 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-xl mb-3">
            <Flame size={24} className="text-white/90" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">
            Plataforma Interna
          </span>
        </div>

        <div className="relative w-full max-w-[280px] h-[320px] flex items-center justify-center z-10">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className={`absolute inset-0 rounded-[32px] flex flex-col items-center justify-center p-8 text-center border border-white/10 transition-all duration-700 ease-in-out ${
                currentSlide === index ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0'
              }`}
              style={{
                backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))`
              }}
            >
              <div className={`absolute inset-0 rounded-[32px] bg-gradient-to-br ${feature.color} opacity-90`}></div>
              
              <div className="relative z-10 flex flex-col items-center w-full">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <feature.icon size={28} className="text-white" strokeWidth={2} />
                </div>
                <h3 className="text-2xl font-extrabold mb-3 tracking-wide">{feature.title}</h3>
                <p className="text-[14px] text-white/90 font-medium leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm flex flex-col items-center z-10 text-center mb-2 animate-slide-up">
          
          <div className="flex gap-2 mb-8">
            {features.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-500 ${currentSlide === idx ? 'w-8 bg-white' : 'w-2 bg-white/20'}`}
              />
            ))}
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            Servidores CDS
          </h1>
          <p className="text-[14px] font-medium text-slate-300 mb-8 max-w-[260px] leading-relaxed">
            La unción de esta casa te da la bienvenida
          </p>

          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-[#0a0f0d] font-bold py-4 px-6 rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all shadow-[0_0_40px_-15px_rgba(255,255,255,0.3)] hover:bg-slate-50 disabled:opacity-80 disabled:scale-100 group"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-[#0a0f0d]" />
                <span className="text-[15px]">Ingresando...</span>
              </>
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                <span className="text-[15px]">Continuar con Google</span>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-[#0a0f0d] transition-colors absolute right-6" />
              </>
            )}
          </button>
        </div>

      </div>
    </>
  );
}