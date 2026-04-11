import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, setDoc, serverTimestamp, updateDoc, arrayUnion 
} from 'firebase/firestore';
import { 
  ChevronLeft, Play, FileText, CheckCircle, GraduationCap, 
  Award, HelpCircle, ArrowRight, Loader2, RefreshCcw, Send, ExternalLink,
  Clock, AlignLeft, Image as ImageIcon, Link as LinkIcon, Info
} from 'lucide-react';
import { toast } from 'sonner';

export default function LessonView() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  
  const [lesson, setLesson] = useState(null);
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados del Quiz
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchLessonData = async () => {
      const lessonSnap = await getDoc(doc(db, 'lessons', lessonId));
      if (lessonSnap.exists()) {
        const data = lessonSnap.data();
        setLesson({ id: lessonSnap.id, ...data });
        
        // Cargar contexto de la serie
        const studySnap = await getDoc(doc(db, 'studies', data.studyId));
        if (studySnap.exists()) setStudy(studySnap.data());

        // 🎯 PERSISTENCIA: Cargar respuestas guardadas si el usuario salió y volvió
        const savedAnswers = localStorage.getItem(`quiz_progress_${lessonId}`);
        if (savedAnswers) setAnswers(JSON.parse(savedAnswers));

        // 🎯 UNA SOLA VEZ: Verificar si ya completó esta clase
        const progressRef = doc(db, 'userProgress', `${currentUser.uid}_${data.studyId}`);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists()) {
          const progData = progressSnap.data();
          if (progData.completedLessons?.includes(lessonId)) {
            setQuizResult({
              passed: true,
              score: progData.grades?.[lessonId] || 10,
              alreadyDone: true
            });
          }
        }
      } else {
        navigate('/estudio');
      }
      setLoading(false);
    };
    fetchLessonData();
  }, [lessonId, currentUser.uid, navigate]);

  const getYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url?.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleAnswer = (questionIdx, optionIdx) => {
    const newAnswers = { ...answers, [questionIdx]: optionIdx };
    setAnswers(newAnswers);
    // Guardar en local para no perder progreso
    localStorage.setItem(`quiz_progress_${lessonId}`, JSON.stringify(newAnswers));
  };

  const submitQuiz = async () => {
    setIsSubmitting(true);
    let correctOnes = 0;
    lesson.quiz.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) correctOnes++;
    });

    const score = Math.round((correctOnes / lesson.quiz.questions.length) * 10);
    const passed = score >= (lesson.quiz.passingScore || 7);

    const result = {
      score,
      total: lesson.quiz.questions.length,
      correct: correctOnes,
      passed,
      date: new Date()
    };

    try {
      const progressRef = doc(db, 'userProgress', `${currentUser.uid}_${lesson.studyId}`);
      await setDoc(progressRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName,
        userPhoto: currentUser.photoURL,
        studyId: lesson.studyId,
        studyTitle: study?.title,
        lastLessonCompleted: lesson.title,
        updatedAt: serverTimestamp(),
        [`grades.${lessonId}`]: score,
        [`details.${lessonId}`]: answers, // Guardamos qué respondió para el Pastor
        completedLessons: arrayUnion(lessonId)
      }, { merge: true });

      localStorage.removeItem(`quiz_progress_${lessonId}`);
      setQuizResult(result);
      toast.success(passed ? "¡Clase aprobada!" : "Examen finalizado");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar progreso");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !lesson) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-brand-600" size={40}/></div>;

  return (
    <div className="pb-40 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left overflow-y-auto">
      
      {/* HEADER */}
      <div className="px-6 pt-4 mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 active:scale-90 transition-all">
          <ChevronLeft size={24} />
        </button>
        <div className="text-right">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Capítulo {lesson.order}</p>
          <p className="text-[10px] font-black text-brand-600 uppercase truncate max-w-[200px]">{study?.title}</p>
        </div>
      </div>

      {/* VIDEO */}
      <div className="px-4 mb-8">
        <div className="aspect-video bg-slate-900 rounded-[35px] overflow-hidden shadow-2xl border-4 border-white relative">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${getYoutubeId(lesson.videoUrl)}?rel=0&modestbranding=1`}
            frameBorder="0"
            allowFullScreen
          ></iframe>
        </div>
      </div>

      <div className="px-8 space-y-10">
        {/* TÍTULO E INTRODUCCIÓN */}
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-4">{lesson.title}</h1>
          {lesson.introduction && (
             <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm relative overflow-hidden">
                <AlignLeft className="text-slate-100 absolute -right-2 -bottom-2" size={80}/>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-3 flex items-center gap-2"><Info size={12}/> Introducción</p>
                <p className="text-sm font-medium text-slate-600 leading-relaxed relative z-10 whitespace-pre-wrap">{lesson.introduction}</p>
             </div>
          )}
        </div>

        {/* GALERÍA DE IMÁGENES */}
        {lesson.gallery?.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><ImageIcon size={14}/> Material de apoyo</h3>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
               {lesson.gallery.map((img, idx) => (
                 <img 
                    key={idx} src={img} 
                    className="h-48 rounded-[30px] border-4 border-white shadow-lg shrink-0 object-cover" 
                    onClick={() => window.open(img, '_blank')} 
                 />
               ))}
            </div>
          </div>
        )}

        {/* RECURSOS: PDF Y LINKS EXTERNOS */}
        <div className="grid gap-4">
           {lesson.pdfUrl && (
             <div className="space-y-4">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Guía de Estudio</p>
                <div className="w-full h-96 bg-slate-100 rounded-[35px] overflow-hidden border-2 border-white shadow-inner">
                   <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(lesson.pdfUrl)}&embedded=true`} className="w-full h-full"></iframe>
                </div>
                <a href={lesson.pdfUrl} target="_blank" rel="noreferrer" className="w-full bg-white p-5 rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm active:scale-95 transition-all">
                   <div className="flex items-center gap-3"><FileText size={20} className="text-brand-600"/><span className="text-[11px] font-black uppercase">Descargar PDF</span></div>
                   <ExternalLink size={16} className="text-slate-300"/>
                </a>
             </div>
           )}

           {lesson.externalLink?.url && (
              <a href={lesson.externalLink.url} target="_blank" rel="noreferrer" className="bg-slate-900 p-6 rounded-[35px] text-white flex items-center justify-between group active:scale-95 transition-all">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-2xl"><LinkIcon size={20} className="text-brand-400"/></div>
                    <div className="text-left">
                       <p className="text-[8px] font-black uppercase tracking-widest text-brand-400">Recurso Adicional</p>
                       <h4 className="text-sm font-black uppercase truncate">{lesson.externalLink.name || 'Ver más'}</h4>
                    </div>
                 </div>
                 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>
              </a>
           )}
        </div>

        {/* BLOQUE MAESTRO */}
        <div className="bg-white p-6 rounded-[40px] border border-slate-100 flex items-center gap-5 shadow-sm">
           <div className="w-16 h-16 rounded-[22px] overflow-hidden border-2 border-slate-100 shrink-0">
              <img src={study?.instructorPhoto || `https://ui-avatars.com/api/?name=${study?.instructorName}`} className="w-full h-full object-cover" />
           </div>
           <div className="flex-1">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Dictado por</p>
              <h4 className="text-lg font-black uppercase tracking-tighter text-slate-900">{study?.instructorName}</h4>
              <p className="text-[10px] font-medium text-slate-400 italic">"A través de la Biblia"</p>
           </div>
           <Award className="text-brand-500" size={24} />
        </div>

        {/* EVALUACIÓN FINAL */}
        <div className="pt-4 pb-40">
           {quizResult?.alreadyDone ? (
             <div className="bg-emerald-50 p-10 rounded-[45px] border-2 border-emerald-100 text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-[30px] flex items-center justify-center mx-auto shadow-lg shadow-emerald-200"><CheckCircle size={40} /></div>
                <h3 className="text-2xl font-black text-emerald-900 uppercase tracking-tighter">Clase Completada</h3>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">Puntaje: {quizResult.score} / 10</p>
                <button onClick={() => navigate(-1)} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest mt-4">Volver al plan</button>
             </div>
           ) : !quizStarted && !quizResult ? (
             <div className="bg-white p-10 rounded-[45px] border-2 border-dashed border-slate-200 text-center space-y-6 shadow-sm">
                <HelpCircle size={40} className="text-slate-200 mx-auto" />
                <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xl">¿Listo para el examen?</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-4">Pon a prueba lo aprendido en este capítulo</p>
                <button onClick={() => setQuizStarted(true)} className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] tracking-widest active:scale-95 transition-all">Comenzar Evaluación</button>
             </div>
           ) : quizStarted && !quizResult ? (
             <div className="bg-white p-8 rounded-[45px] border-2 border-white shadow-xl space-y-8 animate-slide-up">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-brand-600 uppercase">Pregunta {currentQuestion + 1} de {lesson.quiz.questions.length}</span></div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">{lesson.quiz.questions[currentQuestion].text}</h3>
                <div className="space-y-3">
                   {lesson.quiz.questions[currentQuestion].options.map((opt, i) => (
                     <button key={i} onClick={() => handleAnswer(currentQuestion, i)} className={`w-full p-5 rounded-[25px] border-2 text-left transition-all flex items-center justify-between ${answers[currentQuestion] === i ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-600'}`}>
                       <span className="text-sm font-bold">{opt}</span>
                       {answers[currentQuestion] === i && <CheckCircle size={20} className="text-brand-600" />}
                     </button>
                  ))}
                </div>
                <div className="pt-4 flex gap-3">
                   {currentQuestion > 0 && <button onClick={() => setCurrentQuestion(prev => prev - 1)} className="p-5 bg-slate-100 rounded-3xl active:scale-90 transition-all"><ChevronLeft size={24}/></button>}
                   {currentQuestion < lesson.quiz.questions.length - 1 ? (
                     <button disabled={answers[currentQuestion] === undefined} onClick={() => setCurrentQuestion(prev => prev + 1)} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] disabled:opacity-30">Siguiente</button>
                   ) : (
                     <button disabled={answers[currentQuestion] === undefined || isSubmitting} onClick={submitQuiz} className="flex-1 bg-brand-500 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] disabled:opacity-30 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={20}/> : 'Finalizar'}</button>
                   )}
                </div>
             </div>
           ) : (
             /* 🎯 FEEDBACK DETALLADO: Correctas vs Incorrectas */
             <div className="bg-white p-10 rounded-[50px] border-2 border-white shadow-2xl text-center space-y-8 animate-scale-in">
                <div className={`w-24 h-24 rounded-[35px] mx-auto flex items-center justify-center shadow-lg ${quizResult.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                   {quizResult.passed ? <CheckCircle size={48} /> : <RefreshCcw size={48} />}
                </div>
                <div>
                   <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{quizResult.passed ? '¡Aprobado!' : 'No alcanzado'}</h3>
                   <div className="text-5xl font-black text-slate-900 mt-4">{quizResult.score}<span className="text-xl text-slate-300">/10</span></div>
                </div>

                <div className="text-left space-y-4 pt-4 border-t border-slate-50">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Resumen del examen</p>
                   {lesson.quiz.questions.map((q, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border-2 ${answers[idx] === q.correctAnswer ? 'border-emerald-50 bg-emerald-50/50' : 'border-rose-50 bg-rose-50/50'}`}>
                         <p className="text-[11px] font-black text-slate-800 uppercase mb-2 leading-tight">{q.text}</p>
                         <div className="flex justify-between items-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Tu respuesta: <span className={answers[idx] === q.correctAnswer ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{q.options[answers[idx]]}</span></p>
                            {answers[idx] === q.correctAnswer ? <CheckCircle size={14} className="text-emerald-500"/> : <X size={14} className="text-rose-500"/>}
                         </div>
                         {answers[idx] !== q.correctAnswer && <p className="text-[10px] font-black text-emerald-600 uppercase mt-1">La correcta era: {q.options[q.correctAnswer]}</p>}
                      </div>
                   ))}
                </div>

                <button onClick={() => quizResult.passed ? navigate(-1) : window.location.reload()} className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] tracking-widest">{quizResult.passed ? 'Continuar serie' : 'Reintentar examen'}</button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}