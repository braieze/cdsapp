import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, collection, query, where, onSnapshot, orderBy 
} from 'firebase/firestore';
import { 
  ChevronLeft, Play, FileText, CheckCircle, Lock, Users, 
  BarChart3, Award, clock, Search, ArrowRight, Loader2, GraduationCap,
  MessageSquare, User, Star
} from 'lucide-react';

export default function StudyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const [study, setStudy] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [studentsProgress, setStudentsProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('lessons'); // 'lessons' o 'analytics'

  const isInstructor = dbUser?.role === 'pastor' || dbUser?.role === 'lider';

  useEffect(() => {
    const fetchStudyData = async () => {
      // 1. Cargar datos de la Serie
      const studySnap = await getDoc(doc(db, 'studies', id));
      if (studySnap.exists()) {
        setStudy({ id: studySnap.id, ...studySnap.data() });
      } else {
        navigate('/estudios');
      }

      // 2. Cargar clases de esta serie
      const lessonsQ = query(
        collection(db, 'lessons'), 
        where('studyId', '==', id),
        orderBy('order', 'asc')
      );
      
      const unsubLessons = onSnapshot(lessonsQ, (snap) => {
        setLessons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      // 3. Si es Admin, cargar progreso de todos los alumnos
      if (isInstructor) {
        const progressQ = query(collection(db, 'userProgress'), where('studyId', '==', id));
        onSnapshot(progressQ, (snap) => {
          setStudentsProgress(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }

      setLoading(false);
      return () => unsubLessons();
    };

    fetchStudyData();
  }, [id, isInstructor, navigate]);

  if (loading || !study) return <div className="min-h-screen flex items-center justify-center"><GraduationCap className="animate-bounce text-brand-600" size={40}/></div>;

  return (
    <div className="pb-40 pt-4 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left">
      
      {/* HEADER DINÁMICO */}
      <div className="px-6 mb-6 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 active:scale-90 transition-all">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Detalle de Serie</h2>
      </div>

      {/* PORTADA Y AUTORÍA */}
      <div className="px-6 mb-8">
        <div className="bg-white rounded-[45px] p-8 shadow-sm border-2 border-white relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-4">
              {study.title}
            </h1>
            
            {/* CREADO Y DICTADO POR */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-[30px] border border-slate-100">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-200">
                <img src={study.instructorPhoto || `https://ui-avatars.com/api/?name=${study.instructorName}`} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Creado y Dictado por</p>
                <p className="text-sm font-black text-slate-800 uppercase flex items-center gap-1">
                  {study.instructorName} <Award size={14} className="text-brand-500" />
                </p>
              </div>
            </div>
          </div>
          <GraduationCap className="absolute -right-6 -top-6 w-32 h-32 text-slate-50 -rotate-12" />
        </div>
      </div>

      {/* TABS DE VISTA (Solo Admin) */}
      {isInstructor && (
        <div className="px-6 mb-8">
          <div className="bg-white p-1.5 rounded-[25px] shadow-sm border-2 border-slate-50 flex gap-1">
            <button 
              onClick={() => setViewMode('lessons')}
              className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
              ${viewMode === 'lessons' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
            >
              <Play size={14}/> Clases
            </button>
            <button 
              onClick={() => setViewMode('analytics')}
              className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
              ${viewMode === 'analytics' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}
            >
              <BarChart3 size={14}/> El Ojo del Pastor
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO: LISTA DE CLASES */}
      {viewMode === 'lessons' ? (
        <div className="px-6 space-y-4">
          <div className="flex justify-between items-center px-2 mb-4">
             <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Plan de Estudio</h3>
             <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full uppercase">{lessons.length} Clases</span>
          </div>
          
          {lessons.map((lesson, index) => {
            const isLocked = index > 0 && !isInstructor; // Lógica de bloqueo temporal
            return (
              <div 
                key={lesson.id}
                onClick={() => !isLocked && navigate(`/estudio/clase/${lesson.id}`)}
                className={`bg-white p-6 rounded-[35px] border-2 transition-all flex items-center gap-5 relative
                ${isLocked ? 'opacity-50 grayscale' : 'active:scale-95 cursor-pointer border-white shadow-sm'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2
                  ${isLocked ? 'bg-slate-100 text-slate-300 border-slate-50' : 'bg-brand-50 text-brand-600 border-brand-100'}`}>
                  {isLocked ? <Lock size={20}/> : <span className="font-black text-lg">{index + 1}</span>}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-sm uppercase truncate mb-1">{lesson.title}</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Play size={10} fill="currentColor"/> Video
                    </span>
                    {lesson.hasPdf && (
                      <span className="text-[9px] font-bold text-brand-600 uppercase flex items-center gap-1">
                        <FileText size={10}/> PDF
                      </span>
                    )}
                  </div>
                </div>
                
                {!isLocked && <ArrowRight size={20} className="text-slate-200" />}
              </div>
            );
          })}
        </div>
      ) : (
        /* ✅ CONTENIDO: EL OJO DEL PASTOR (ANALYTICS) */
        <div className="px-6 space-y-6 animate-slide-up">
          <div className="bg-slate-900 rounded-[35px] p-6 text-white mb-8">
            <div className="flex items-center gap-4 mb-6">
              <Users className="text-brand-500" size={32} />
              <div>
                <p className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em]">Total Alumnos</p>
                <h4 className="text-3xl font-black">{studentsProgress.length}</h4>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Promedio Serie</p>
                  <p className="text-lg font-black text-brand-400">8.5 / 10</p>
               </div>
               <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Completados</p>
                  <p className="text-lg font-black text-emerald-400">12</p>
               </div>
            </div>
          </div>

          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-2 mb-4">Seguimiento de Alumnos</h3>
          
          <div className="space-y-3">
            {studentsProgress.map((progress) => (
              <div key={progress.id} className="bg-white p-5 rounded-[30px] border-2 border-white shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white shadow-sm">
                  <img src={progress.userPhoto || `https://ui-avatars.com/api/?name=${progress.userName}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-xs uppercase truncate">{progress.userName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500" style={{ width: `${progress.percentage}%` }}></div>
                    </div>
                    <span className="text-[9px] font-black text-slate-400">{progress.completedLessons}/{lessons.length}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Promedio</p>
                  <p className="text-sm font-black text-slate-900">{progress.averageGrade || 'N/A'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTÓN AGREGAR CLASE (Solo para el instructor) */}
      {isInstructor && viewMode === 'lessons' && (
        <button 
          onClick={() => navigate(`/estudio/${study.id}/nueva-clase`)}
          className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white"
        >
          <Play size={24} fill="currentColor" />
        </button>
      )}

    </div>
  );
}