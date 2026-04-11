import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, setDoc, serverTimestamp, updateDoc, arrayUnion 
} from 'firebase/firestore';
import { 
  ChevronLeft, Play, FileText, CheckCircle, GraduationCap, 
  Award, HelpCircle, ArrowRight, Loader2, RefreshCcw, Send, ExternalLink
} from 'lucide-react';

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
        const lessonData = lessonSnap.data();
        setLesson({ id: lessonSnap.id, ...lessonData });
        
        // Cargar contexto de la serie
        const studySnap = await getDoc(doc(db, 'studies', lessonData.studyId));
        if (studySnap.exists()) setStudy(studySnap.data());
      } else {
        navigate('/estudios');
      }
      setLoading(false);
    };
    fetchLessonData();
  }, [lessonId, navigate]);

  // Función para extraer ID de Youtube
  const getYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url?.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleAnswer = (questionIdx, optionIdx) => {
    setAnswers({ ...answers, [questionIdx]: optionIdx });
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
      // Guardar progreso en Firebase para que el Pastor lo vea
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
        completedLessons: arrayUnion(lessonId)
      }, { merge: true });

      setQuizResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !lesson) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-brand-600" size={40}/></div>;

  return (
    <div className="pb-40 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left">
      
      {/* HEADER DE CLASE */}
      <div className="px-6 pt-4 mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 active:scale-90 transition-all">
          <ChevronLeft size={24} />
        </button>
        <div className="text-right">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estás viendo</p>
          <p className="text-[10px] font-black text-brand-600 uppercase truncate max-w-[200px]">{study?.title}</p>
        </div>
      </div>

      {/* REPRODUCTOR DE VIDEO */}
      <div className="px-4 mb-8">
        <div className="aspect-video bg-slate-900 rounded-[35px] overflow-hidden shadow-2xl border-4 border-white relative">
          {lesson.videoUrl ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${getYoutubeId(lesson.videoUrl)}?rel=0&modestbranding=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              <Play size={60} />
            </div>
          )}
        </div>
      </div>

      <div className="px-8 space-y-8">
        {/* TÍTULO Y RECURSOS */}
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-4">
            {lesson.title}
          </h1>
          <div className="flex gap-3">
            {lesson.pdfUrl && (
              <a 
                href={lesson.pdfUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 bg-brand-50 text-brand-600 p-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-brand-100 shadow-sm"
              >
                <FileText size={16}/> Descargar Guía PDF
              </a>
            )}
            <div className="bg-white text-slate-400 p-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-slate-100 shadow-sm">
              <Clock size={16}/> {lesson.duration || '20 min'}
            </div>
          </div>
        </div>

        {/* BLOQUE MAESTRO: DICTADO POR */}
        <div className="bg-slate-900 rounded-[40px] p-6 text-white flex items-center gap-5 relative overflow-hidden shadow-xl">
           <div className="w-16 h-16 rounded-[22px] overflow-hidden border-2 border-white/20 shrink-0">
              <img src={study?.instructorPhoto || `https://ui-avatars.com/api/?name=${study?.instructorName}`} className="w-full h-full object-cover" />
           </div>
           <div className="flex-1">
              <p className="text-[8px] font-black text-brand-400 uppercase tracking-[0.2em] mb-1">Dictado por</p>
              <h4 className="text-xl font-black uppercase tracking-tighter">{study?.instructorName}</h4>
              <p className="text-[10px] font-medium text-slate-400">Docente de Academia CDS</p>
           </div>
           <Award className="absolute -right-4 -bottom-4 w-20 h-20 text-white/5 -rotate-12" />
        </div>

        {/* SISTEMA DE QUIZ / EVALUACIÓN */}
        <div className="pt-4 pb-20">
          {!quizStarted && !quizResult && (
            <div className="bg-white p-8 rounded-[45px] border-2 border-dashed border-slate-200 text-center space-y-6">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <HelpCircle size={32} />
               </div>
               <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xl">¿Estás listo para el examen?</h4>
                  <p className="text-xs text-slate-500 font-medium px-4 mt-2">Pon a prueba lo aprendido en esta clase para poder avanzar a la siguiente.</p>
               </div>
               <button 
                 onClick={() => setQuizStarted(true)}
                 className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] tracking-widest active:scale-95 transition-all"
               >
                 Comenzar Evaluación
               </button>
            </div>
          )}

          {quizStarted && !quizResult && (
            <div className="bg-white p-8 rounded-[45px] border-2 border-white shadow-xl space-y-8 animate-slide-up">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Pregunta {currentQuestion + 1} de {lesson.quiz.questions.length}</span>
                  <div className="flex gap-1">
                    {lesson.quiz.questions.map((_, i) => (
                      <div key={i} className={`h-1 w-4 rounded-full ${i <= currentQuestion ? 'bg-brand-500' : 'bg-slate-100'}`}></div>
                    ))}
                  </div>
               </div>

               <h3 className="text-xl font-black text-slate-900 leading-tight">
                  {lesson.quiz.questions[currentQuestion].text}
               </h3>

               <div className="space-y-3">
                  {lesson.quiz.questions[currentQuestion].options.map((opt, i) => (
                    <button 
                      key={i}
                      onClick={() => handleAnswer(currentQuestion, i)}
                      className={`w-full p-5 rounded-[25px] border-2 text-left transition-all flex items-center justify-between
                      ${answers[currentQuestion] === i ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-600'}`}
                    >
                      <span className="text-sm font-bold">{opt}</span>
                      {answers[currentQuestion] === i && <CheckCircle size={20} className="text-brand-600" />}
                    </button>
                  ))}
               </div>

               <div className="pt-4 flex gap-3">
                  {currentQuestion > 0 && (
                    <button onClick={() => setCurrentQuestion(prev => prev - 1)} className="p-5 bg-slate-100 text-slate-400 rounded-3xl active:scale-90 transition-all">
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  {currentQuestion < lesson.quiz.questions.length - 1 ? (
                    <button 
                      disabled={answers[currentQuestion] === undefined}
                      onClick={() => setCurrentQuestion(prev => prev + 1)}
                      className="flex-1 bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] flex items-center justify-center gap-2 disabled:opacity-30"
                    >
                      Siguiente Pregunta <ArrowRight size={18}/>
                    </button>
                  ) : (
                    <button 
                      disabled={answers[currentQuestion] === undefined || isSubmitting}
                      onClick={submitQuiz}
                      className="flex-1 bg-brand-500 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] flex items-center justify-center gap-2 disabled:opacity-30"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <><Send size={18}/> Finalizar y Calificar</>}
                    </button>
                  )}
               </div>
            </div>
          )}

          {quizResult && (
            <div className="bg-white p-10 rounded-[50px] border-2 border-white shadow-2xl text-center space-y-6 animate-scale-in">
               <div className={`w-24 h-24 rounded-[35px] mx-auto flex items-center justify-center shadow-lg
                 ${quizResult.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  {quizResult.passed ? <CheckCircle size={48} /> : <RefreshCcw size={48} />}
               </div>
               <div>
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                    {quizResult.passed ? '¡Aprobado!' : 'Sigue Intentando'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Calificación Obtenida</p>
                  <div className="text-5xl font-black text-slate-900 mt-4">{quizResult.score}<span className="text-xl text-slate-300">/10</span></div>
               </div>
               
               <p className="text-xs text-slate-500 font-medium px-4 leading-relaxed">
                 {quizResult.passed 
                   ? 'Felicidades, has comprendido perfectamente los conceptos de esta clase. Ya puedes continuar.' 
                   : 'No te desanimes, puedes volver a ver el video y realizar el examen nuevamente.'}
               </p>

               <div className="pt-4 space-y-3">
                  {quizResult.passed ? (
                    <button 
                      onClick={() => navigate(-1)}
                      className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] tracking-widest"
                    >
                      Volver al Plan de Estudio
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setQuizResult(null); setQuizStarted(true); setCurrentQuestion(0); setAnswers({}); }}
                      className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl uppercase text-[11px] tracking-widest flex items-center justify-center gap-2"
                    >
                      <RefreshCcw size={16}/> Reintentar Examen
                    </button>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}