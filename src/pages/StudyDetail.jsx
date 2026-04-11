import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, collection, query, where, onSnapshot, orderBy, deleteDoc 
} from 'firebase/firestore';
import { 
  ChevronLeft, Play, FileText, CheckCircle, Lock, Users, 
  BarChart3, Award, Clock, Search, ArrowRight, Loader2, GraduationCap,
  MessageSquare, User, Star, Edit3, Trash2, Plus, X, ChevronRight, HelpCircle,
  AlertCircle // ✅ Icono para Reprobados
} from 'lucide-react';
import { toast } from 'sonner';

export default function StudyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  
  const [study, setStudy] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [studentsProgress, setStudentsProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('lessons'); 
  const [selectedStudent, setSelectedStudent] = useState(null);

  const isPastor = dbUser?.role === 'pastor';
  const isInstructor = isPastor || dbUser?.role === 'lider';

  useEffect(() => {
    const fetchStudyData = async () => {
      const studySnap = await getDoc(doc(db, 'studies', id));
      if (studySnap.exists()) {
        setStudy({ id: studySnap.id, ...studySnap.data() });
      } else {
        navigate('/estudio');
      }

      const lessonsQ = query(
        collection(db, 'lessons'), 
        where('studyId', '==', id),
        orderBy('order', 'asc')
      );
      
      const unsubLessons = onSnapshot(lessonsQ, (snap) => {
        setLessons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      const progressQ = query(collection(db, 'userProgress'), where('studyId', '==', id));
      const unsubProgress = onSnapshot(progressQ, (snap) => {
        setStudentsProgress(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      setLoading(false);
      return () => { unsubLessons(); unsubProgress(); };
    };
    fetchStudyData();
  }, [id, navigate]);

  // ✅ CÁLCULO DE ESTADÍSTICAS (Actualizado a tiempo real)
  const stats = useMemo(() => {
    if (studentsProgress.length === 0) return { avg: 0, completed: 0 };
    let totalSum = 0;
    let count = 0;
    let completed = 0;

    studentsProgress.forEach(p => {
      if (p.grades) {
        Object.values(p.grades).forEach(val => {
          totalSum += Number(val);
          count++;
        });
      }
      if (p.completedLessons?.length >= lessons.length && lessons.length > 0) completed++;
    });

    return {
      avg: count > 0 ? (totalSum / count).toFixed(1) : 0,
      completed
    };
  }, [studentsProgress, lessons]);

  const handleDeleteLesson = async (lessonId, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Eliminar clase?")) return;
    try {
      await deleteDoc(doc(db, 'lessons', lessonId));
      toast.success("Clase eliminada");
    } catch (e) { toast.error("Error"); }
  };

  if (loading || !study) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-brand-600" size={40}/></div>;

  return (
    <div className="pb-40 pt-4 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left relative">
      
      {/* HEADER */}
      <div className="px-6 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/estudio')} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 active:scale-90 transition-all">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Serie Académica</h2>
        </div>
        {isPastor && (
          <button onClick={() => navigate(`/estudio/crear/${id}`)} className="p-3 bg-white text-brand-600 rounded-2xl shadow-sm border border-brand-50 active:scale-90 transition-all"><Edit3 size={20} /></button>
        )}
      </div>

      {/* CARD DE SERIE */}
      <div className="px-6 mb-8">
        <div className="bg-white rounded-[45px] p-8 shadow-sm border-2 border-white relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-4">{study.title}</h1>
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-[30px] border border-slate-100">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-200">
                <img src={study.instructorPhoto || `https://ui-avatars.com/api/?name=${study.instructorName}`} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Docente</p>
                <p className="text-sm font-black text-slate-800 uppercase">{study.instructorName}</p>
              </div>
            </div>
          </div>
          <GraduationCap className="absolute -right-6 -top-6 w-32 h-32 text-slate-50 -rotate-12" />
        </div>
      </div>

      {/* SELECTOR DE VISTA (ADMIN) */}
      {isInstructor && (
        <div className="px-6 mb-8">
          <div className="bg-white p-1.5 rounded-[25px] shadow-sm border-2 border-slate-50 flex gap-1">
            <button onClick={() => setViewMode('lessons')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'lessons' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Play size={14}/> Clases</button>
            <button onClick={() => setViewMode('analytics')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'analytics' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}><BarChart3 size={14}/> Analíticas</button>
          </div>
        </div>
      )}

      {/* VISTA 1: LISTADO DE CLASES */}
      {viewMode === 'lessons' ? (
        <div className="px-6 space-y-4 animate-slide-up">
          {lessons.map((lesson, index) => {
            const userProg = studentsProgress.find(p => p.userId === auth.currentUser?.uid);
            const lessonGrade = userProg?.grades?.[lesson.id];
            const isCompleted = userProg?.completedLessons?.includes(lesson.id);
            const isPassed = lessonGrade >= 7;
            const isLocked = index > 0 && !isInstructor && !userProg?.completedLessons?.includes(lessons[index-1]?.id);

            return (
              <div key={lesson.id} onClick={() => !isLocked && navigate(`/estudio/clase/${lesson.id}`)} className={`bg-white p-6 rounded-[35px] border-2 transition-all flex items-center gap-5 relative ${isLocked ? 'opacity-50 grayscale' : 'active:scale-95 cursor-pointer border-white shadow-sm'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 
                  ${isLocked ? 'bg-slate-100 text-slate-300' : 
                    isCompleted ? (isPassed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100') : 
                    'bg-brand-50 text-brand-600 border-brand-100'}`}>
                  {isLocked ? <Lock size={20}/> : 
                   isCompleted ? (isPassed ? <CheckCircle size={22} /> : <AlertCircle size={22} />) : 
                   <span className="font-black text-lg">{lesson.order}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-sm uppercase truncate mb-1">{lesson.title}</h4>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {isCompleted ? (isPassed ? 'Aprobada' : 'Reprobada') : (isLocked ? 'Bloqueada' : 'Pendiente')}
                  </p>
                </div>
                {isInstructor && (
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/estudio/${id}/editar-clase/${lesson.id}`); }} className="p-2 text-slate-300 hover:text-brand-600"><Edit3 size={18}/></button>
                    <button onClick={(e) => handleDeleteLesson(lesson.id, e)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 size={18}/></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA 2: ANALÍTICAS */
        <div className="px-6 space-y-6 animate-slide-up">
           <div className="bg-slate-900 rounded-[35px] p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10 flex flex-col gap-6">
               <div className="flex items-center gap-4">
                  <div className="p-4 bg-brand-500 rounded-[20px] shadow-lg shadow-brand-500/20"><Users size={24}/></div>
                  <div><p className="text-[10px] font-black uppercase opacity-50 tracking-widest">Alumnos Activos</p><h4 className="text-3xl font-black">{studentsProgress.length}</h4></div>
               </div>
               <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Nota Promedio</p><p className="text-xl font-black text-brand-400">{stats.avg}</p></div>
                  <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Finalizados</p><p className="text-xl font-black text-emerald-400">{stats.completed}</p></div>
               </div>
            </div>
            <BarChart3 className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 rotate-12" />
          </div>

          <div className="space-y-3">
            {studentsProgress.map((p) => (
              <div key={p.id} onClick={() => setSelectedStudent(p)} className="bg-white p-5 rounded-[30px] border-2 border-white shadow-sm flex items-center gap-4 active:scale-95 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border-2 border-slate-50 bg-slate-100">
                  <img src={p.userPhoto || `https://ui-avatars.com/api/?name=${p.userName}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-xs uppercase truncate">{p.userName}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-1 flex-1 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div className="h-full bg-brand-500" style={{width: `${(p.completedLessons?.length / (lessons.length || 1)) * 100}%`}}></div>
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-200" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DEL ALUMNO (Ojo del Pastor Pro) */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[50px] animate-slide-up max-h-[90vh] flex flex-col relative">
             <button onClick={() => setSelectedStudent(null)} className="absolute top-6 right-6 p-2.5 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
             
             <div className="p-8 border-b border-slate-50 flex flex-col items-center">
                <div className="w-20 h-20 rounded-[30px] overflow-hidden border-4 border-slate-50 shadow-xl mb-4">
                   <img src={selectedStudent.userPhoto || `https://ui-avatars.com/api/?name=${selectedStudent.userName}`} className="w-full h-full object-cover" />
                </div>
                <h3 className="font-black text-slate-900 uppercase text-lg text-center leading-none">{selectedStudent.userName}</h3>
                <div className="flex gap-2 mt-3">
                  <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black rounded-full uppercase">Alumni</span>
                  <span className="px-3 py-1 bg-brand-50 text-brand-600 text-[9px] font-black rounded-full uppercase tracking-tighter">
                    {Object.keys(selectedStudent.grades || {}).length} Clases hechas
                  </span>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {lessons.map((l) => {
                  const grade = selectedStudent.grades?.[l.id];
                  const details = selectedStudent.details?.[l.id];
                  const hasGrade = grade !== undefined;
                  const isAprobada = hasGrade && grade >= 7;

                  return (
                    <div key={l.id} className={`p-6 rounded-[35px] border-2 transition-all ${hasGrade ? (isAprobada ? 'bg-emerald-50/30 border-emerald-50' : 'bg-rose-50/30 border-rose-50') : 'bg-slate-50 border-slate-50'}`}>
                       <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Capítulo {l.order}</p>
                             <h4 className="text-xs font-black text-slate-800 uppercase leading-tight">{l.title}</h4>
                          </div>
                          <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${!hasGrade ? 'bg-slate-200 text-slate-400' : (isAprobada ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}`}>
                             {hasGrade ? `${grade}/10` : 'Pendiente'}
                          </div>
                       </div>
                       
                       {/* DETALLE DE RESPUESTAS (Fase 4: Auditoría) */}
                       {details && (
                         <div className="space-y-3 mt-4 pt-4 border-t border-slate-200/50">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Auditoría de respuestas:</p>
                            {l.quiz.questions.map((q, qIdx) => {
                              const userAnswerIdx = details[qIdx];
                              const isCorrect = userAnswerIdx === q.correctAnswer;
                              return (
                                <div key={qIdx} className="bg-white/50 p-3 rounded-2xl border border-slate-100">
                                   <div className="flex gap-2 items-start mb-1">
                                      {isCorrect ? <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5"/> : <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5"/>}
                                      <p className="text-[10px] font-bold text-slate-700 leading-snug">{q.text}</p>
                                   </div>
                                   <div className="pl-6 flex flex-col gap-0.5">
                                      <p className={`text-[9px] font-black uppercase ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        Respuesta: {q.options[userAnswerIdx] || 'Sin respuesta'}
                                      </p>
                                      {!isCorrect && (
                                        <p className="text-[9px] font-black text-slate-400 uppercase">
                                          Correcta: {q.options[q.correctAnswer]}
                                        </p>
                                      )}
                                   </div>
                                </div>
                              );
                            })}
                         </div>
                       )}
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE */}
      {isInstructor && viewMode === 'lessons' && (
        <button onClick={() => navigate(`/estudio/${id}/nueva-clase`)} className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white">
          <Plus size={28} />
        </button>
      )}

    </div>
  );
}