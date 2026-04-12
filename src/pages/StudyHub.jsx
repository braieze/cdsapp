import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, query, onSnapshot, orderBy, where, getDocs // ✅ Añadido getDocs para el conteo real
} from 'firebase/firestore';
import { 
  BookOpen, Play, CheckCircle, TrendingUp, Plus, 
  ChevronRight, GraduationCap, Loader2, Star, Clock, User,
  Search, Filter, Tag, X 
} from 'lucide-react';

export default function StudyHub() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const [studies, setStudies] = useState([]);
  const [userProgress, setUserProgress] = useState({}); // ✅ Progreso real
  const [loading, setLoading] = useState(true);
  
  // ✅ ESTADOS DE FILTRADO (Fase 2 y 3)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const currentUser = auth.currentUser;

  const categories = ["Todas", "Estudios Bíblicos", "Colaboradores", "Profético", "Jóvenes", "Matrimonios", "Liderazgo"];

  // 1. CARGAR LAS SERIES CON CONTEO REAL (Fix Punto 1)
  useEffect(() => {
    const q = query(collection(db, 'studies'), orderBy('createdAt', 'desc'));
    
    // Escuchamos las series
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const studiesData = [];
      
      // 🎯 FIX: En lugar de confiar en study.lessonCount, contamos los docs reales en 'lessons'
      for (const docSnap of snapshot.docs) {
        const study = { id: docSnap.id, ...docSnap.data() };
        const lessonsQ = query(collection(db, 'lessons'), where('studyId', '==', study.id));
        const lessonsSnap = await getDocs(lessonsQ);
        studiesData.push({ 
          ...study, 
          realLessonCount: lessonsSnap.size // Este es el número real infalible
        });
      }
      
      setStudies(studiesData);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // 2. CARGAR PROGRESO REAL DEL USUARIO
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'userProgress'), where('userId', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const progressData = {};
      snapshot.docs.forEach(doc => {
        progressData[doc.data().studyId] = doc.data();
      });
      setUserProgress(progressData);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 3. LÓGICA DE FILTRADO DINÁMICO
  const filteredStudies = useMemo(() => {
    return studies.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.instructorName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todas' || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [studies, searchTerm, selectedCategory]);

  // 4. CÁLCULO DE PROGRESO REAL (Sincronizado con conteo real)
  const calculateProgress = (studyId, totalLessons) => {
    const progress = userProgress[studyId];
    if (!progress || !totalLessons || totalLessons === 0) return 0;
    // Solo contamos las clases que tienen nota registrada
    const completed = progress.completedLessons?.length || 0;
    return Math.round((completed / totalLessons) * 100);
  };

  // 5. ENCONTRAR ÚLTIMA SERIE VISTA
  const lastStudy = useMemo(() => {
    const active = Object.values(userProgress).sort((a,b) => b.updatedAt?.seconds - a.updatedAt?.seconds)[0];
    return active ? studies.find(s => s.id === active.studyId) : null;
  }, [userProgress, studies]);

  return (
    <div className="pb-40 pt-6 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left relative overflow-x-hidden">
      
      {/* HEADER */}
      <div className="px-6 flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Series</h1>
          <p className="text-[10px] text-brand-600 uppercase font-black tracking-[0.2em] mt-2">Academia Bíblica Digital</p>
        </div>
        <div className="p-4 bg-white rounded-[22px] shadow-sm text-brand-600 border-2 border-slate-50">
          <GraduationCap size={28} />
        </div>
      </div>

      {/* BANNER DINÁMICO: CONTINUAR ESTUDIANDO */}
      <div className="px-6 mb-8">
        <div className="bg-slate-900 rounded-[35px] p-6 text-white shadow-2xl flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">
              {lastStudy ? 'Mi Aprendizaje' : 'Bienvenido'}
            </p>
            <h3 className="text-xl font-black uppercase tracking-tighter max-w-[180px] leading-tight">
              {lastStudy ? `Continuar con ${lastStudy.title}` : 'Empieza tu primera serie'}
            </h3>
          </div>
          <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 rotate-12 group-hover:scale-110 transition-transform" />
          {lastStudy && (
            <button 
              onClick={() => navigate(`/estudio/${lastStudy.id}`)}
              className="bg-brand-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg relative z-10 active:scale-90 transition-all"
            >
              Ir a clase
            </button>
          )}
        </div>
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div className="px-6 mb-8 space-y-4">
         <div className="relative group">
            <Search className="absolute left-5 top-5 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={20}/>
            <input 
              type="text"
              placeholder="Buscar serie o docente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white p-5 pl-14 rounded-[25px] shadow-sm border-2 border-transparent focus:border-brand-100 outline-none font-bold text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-5 top-5 text-slate-300"><X size={20}/></button>
            )}
         </div>

         {/* Pills de Categorías */}
         <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all border-2
                ${selectedCategory === cat ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20' : 'bg-white border-white text-slate-400'}`}
              >
                {cat}
              </button>
            ))}
         </div>
      </div>

      <div className="px-6">
        <div className="flex justify-between items-center mb-6 px-2">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Explorar Enseñanzas</h2>
          <span className="text-[9px] font-black text-brand-600 bg-brand-50 px-2 py-1 rounded-lg uppercase">{filteredStudies.length} Resultados</span>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center py-20 opacity-20">
             <GraduationCap size={48} className="animate-bounce" />
             <p className="font-black text-xs uppercase mt-4">Cargando Academia...</p>
          </div>
        ) : filteredStudies.length === 0 ? (
          <div className="py-20 text-center space-y-4 opacity-40">
             <Filter size={40} className="mx-auto text-slate-300"/>
             <p className="font-black text-xs uppercase">No hay series que coincidan</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredStudies.map((study) => {
              // 🎯 Usamos el conteo real aquí
              const progress = calculateProgress(study.id, study.realLessonCount);
              return (
                <div 
                  key={study.id}
                  onClick={() => navigate(`/estudio/${study.id}`)}
                  className="bg-white rounded-[45px] border-2 border-white shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="h-48 w-full bg-slate-200 relative overflow-hidden">
                    <img 
                      src={study.coverImage || "https://images.unsplash.com/photo-1504052434139-441ae7420e92?auto=format&fit=crop"} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      alt="Cover"
                    />
                    <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl text-white text-[9px] font-black uppercase flex items-center gap-2">
                      <BookOpen size={12} className="text-brand-400" /> {study.realLessonCount || 0} Capítulos
                    </div>
                    {study.category && (
                      <div className="absolute bottom-4 left-4 bg-brand-500/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-[8px] font-black uppercase flex items-center gap-1 shadow-lg">
                        <Tag size={10} /> {study.category}
                      </div>
                    )}
                    {study.isNew && (
                      <div className="absolute top-4 right-4 bg-emerald-500 px-4 py-2 rounded-2xl text-white text-[9px] font-black uppercase shadow-lg">Nuevo</div>
                    )}
                  </div>

                  <div className="p-8">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2 group-hover:text-brand-600 transition-colors">
                      {study.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 line-clamp-2 italic">
                      "{study.description}"
                    </p>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden">
                          <img src={study.instructorPhoto || `https://ui-avatars.com/api/?name=${study.instructorName}`} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dictado por</p>
                          <p className="text-[11px] font-black text-slate-800 uppercase">{study.instructorName}</p>
                        </div>
                      </div>
                      <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase flex items-center gap-1">
                        <CheckCircle size={10} fill="currentColor" className="text-white" /> Oficial
                      </div>
                    </div>

                    <div className="mt-8 space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mi Avance Académico</span>
                        <span className="text-[11px] font-black text-brand-600">{progress}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner">
                        <div 
                          className="h-full bg-brand-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(234,179,8,0.4)]" 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ BOTÓN PASTOR CORREGIDO (Z-Index y posición) */}
      {(dbUser?.role === 'pastor' || dbUser?.role === 'lider') && (
        <button 
          onClick={() => navigate('/estudio/crear')}
          className="fixed bottom-10 right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center active:scale-90 transition-all z-[60] border-4 border-white"
        >
          <Plus size={32} />
        </button>
      )}

    </div>
  );
}