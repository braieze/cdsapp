import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, query, onSnapshot, orderBy, doc, getDoc 
} from 'firebase/firestore';
import { 
  BookOpen, Play, CheckCircle, TrendingUp, Plus, 
  ChevronRight, GraduationCap, Star, Clock, User 
} from 'lucide-react';

export default function StudyHub() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  // 1. Cargar las Series de Estudio
  useEffect(() => {
    const q = query(collection(db, 'studies'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudies(studiesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Simulación de progreso (Luego lo conectaremos a la colección userProgress)
  const getProgress = (studyId) => {
    return Math.floor(Math.random() * 100); // Temporal para diseño
  };

  return (
    <div className="pb-40 pt-6 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left">
      
      {/* HEADER ELEGANTE */}
      <div className="px-6 flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Series</h1>
          <p className="text-[10px] text-brand-600 uppercase font-black tracking-[0.2em] mt-2">Academia Bíblica Digital</p>
        </div>
        <div className="p-4 bg-white rounded-[22px] shadow-sm text-brand-600 border-2 border-slate-50">
          <GraduationCap size={28} />
        </div>
      </div>

      {/* ESTADISTICAS RÁPIDAS DEL ALUMNO */}
      <div className="px-6 mb-10">
        <div className="bg-slate-900 rounded-[35px] p-6 text-white shadow-2xl flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Mi Aprendizaje</p>
            <h3 className="text-xl font-black uppercase tracking-tighter">Continuar Estudiando</h3>
          </div>
          <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 rotate-12" />
          <button className="bg-brand-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg relative z-10 active:scale-90 transition-all">
            Ir a clase
          </button>
        </div>
      </div>

      <div className="px-6">
        <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-2">Explorar Enseñanzas</h2>
        
        {loading ? (
          <div className="flex flex-col items-center py-20 opacity-20">
             <GraduationCap size={48} className="animate-bounce" />
             <p className="font-black text-xs uppercase mt-4">Cargando Academia...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {studies.map((study) => (
              <div 
                key={study.id}
                onClick={() => navigate(`/estudio/${study.id}`)}
                className="bg-white rounded-[45px] border-2 border-white shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer group"
              >
                {/* Imagen de Portada de la Serie */}
                <div className="h-48 w-full bg-slate-200 relative overflow-hidden">
                  <img 
                    src={study.coverImage || "https://images.unsplash.com/photo-1504052434139-441ae7420e92?q=80&w=1000&auto=format&fit=crop"} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    alt="Cover"
                  />
                  <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl text-white text-[9px] font-black uppercase flex items-center gap-2">
                    <BookOpen size={12} className="text-brand-400" /> {study.lessonCount || 0} Clases
                  </div>
                  {study.isNew && (
                    <div className="absolute top-4 right-4 bg-brand-500 px-4 py-2 rounded-2xl text-white text-[9px] font-black uppercase shadow-lg animate-pulse">
                      Nuevo
                    </div>
                  )}
                </div>

                {/* Contenido de la Tarjeta */}
                <div className="p-8">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2 group-hover:text-brand-600 transition-colors">
                    {study.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 line-clamp-2">
                    {study.description}
                  </p>

                  {/* BLOQUE: DICTADO POR (Tu papá) */}
                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden">
                        <img 
                          src={study.instructorPhoto || "https://ui-avatars.com/api/?name=Pastor&background=0f172a&color=fff"} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dictado por</p>
                        <p className="text-[11px] font-black text-slate-800 uppercase">{study.instructorName}</p>
                      </div>
                    </div>
                    
                    {/* Badge de Verificado */}
                    <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase flex items-center gap-1">
                      <CheckCircle size={10} fill="currentColor" className="text-white" />
                      Oficial
                    </div>
                  </div>

                  {/* Barra de Progreso Personal */}
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Mi Progreso</span>
                      <span className="text-[11px] font-black text-brand-600">{getProgress(study.id)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                      <div 
                        className="h-full bg-brand-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(234,179,8,0.3)]" 
                        style={{ width: `${getProgress(study.id)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTÓN MÁGICO PARA EL PASTOR (CREAR SERIE) */}
      {(dbUser?.role === 'pastor' || dbUser?.role === 'lider') && (
        <button 
          onClick={() => navigate('/estudio/crear')}
          className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white"
        >
          <Plus size={32} />
        </button>
      )}

    </div>
  );
}