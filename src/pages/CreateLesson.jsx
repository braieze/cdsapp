import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { 
  X, Save, Play, FileText, Plus, Trash2, 
  ChevronLeft, Loader2, HelpCircle, CheckCircle2 
} from 'lucide-react';

export default function CreateLesson() {
  const { id } = useParams(); // ID de la Serie
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [lessonData, setLessonData] = useState({
    title: '',
    videoUrl: '',
    pdfUrl: '',
    duration: '',
    order: 1,
    quiz: {
      questions: [
        { text: '', options: ['', '', '', ''], correctAnswer: 0 }
      ],
      passingScore: 7
    }
  });

  const handleAddQuestion = () => {
    setLessonData({
      ...lessonData,
      quiz: {
        ...lessonData.quiz,
        questions: [...lessonData.quiz.questions, { text: '', options: ['', '', '', ''], correctAnswer: 0 }]
      }
    });
  };

  const handleRemoveQuestion = (index) => {
    const newQuestions = lessonData.quiz.questions.filter((_, i) => i !== index);
    setLessonData({ ...lessonData, quiz: { ...lessonData.quiz, questions: newQuestions } });
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...lessonData.quiz.questions];
    newQuestions[index][field] = value;
    setLessonData({ ...lessonData, quiz: { ...lessonData.quiz, questions: newQuestions } });
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const newQuestions = [...lessonData.quiz.questions];
    newQuestions[qIndex].options[oIndex] = value;
    setLessonData({ ...lessonData, quiz: { ...lessonData.quiz, questions: newQuestions } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lessonData.title || !lessonData.videoUrl) return alert("Título y Video son obligatorios");
    
    setLoading(true);
    try {
      // 1. Crear la clase
      await addDoc(collection(db, 'lessons'), {
        ...lessonData,
        studyId: id,
        createdAt: serverTimestamp()
      });

      // 2. Actualizar el contador de clases de la Serie
      const studyRef = doc(db, 'studies', id);
      await updateDoc(studyRef, { lessonCount: increment(1) });

      navigate(`/estudio/${id}`);
    } catch (error) {
      console.error(error);
      alert("Error al guardar clase");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-40 pt-4 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left">
      <div className="px-6 mb-8 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 active:scale-90 transition-all">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Nueva Clase</h2>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-6">
        {/* INFO BASICA */}
        <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-2">Título de la Clase</label>
            <input required className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" placeholder="Ej: Introducción al Génesis" value={lessonData.title} onChange={e => setLessonData({...lessonData, title: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Orden</label>
              <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" value={lessonData.order} onChange={e => setLessonData({...lessonData, order: parseInt(e.target.value)})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Duración (min)</label>
              <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" placeholder="Ej: 15 min" value={lessonData.duration} onChange={e => setLessonData({...lessonData, duration: e.target.value})} />
            </div>
          </div>
        </div>

        {/* LINKS */}
        <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-2 flex items-center gap-2"><Play size={12}/> Link Video (YouTube)</label>
            <input required className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none" placeholder="https://www.youtube.com/watch?v=..." value={lessonData.videoUrl} onChange={e => setLessonData({...lessonData, videoUrl: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2 flex items-center gap-2"><FileText size={12}/> Link PDF (Opcional)</label>
            <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none" placeholder="Link de Drive o Dropbox..." value={lessonData.pdfUrl} onChange={e => setLessonData({...lessonData, pdfUrl: e.target.value})} />
          </div>
        </div>

        {/* CONSTRUCTOR DE EXAMEN (QUIZ) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Constructor de Examen</h3>
            <button type="button" onClick={handleAddQuestion} className="text-brand-600 bg-brand-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
              <Plus size={14}/> Pregunta
            </button>
          </div>

          {lessonData.quiz.questions.map((q, qIdx) => (
            <div key={qIdx} className="bg-white p-6 rounded-[35px] border-2 border-slate-100 space-y-4 relative">
              <button type="button" onClick={() => handleRemoveQuestion(qIdx)} className="absolute top-4 right-4 text-rose-300 hover:text-rose-500"><Trash2 size={18}/></button>
              
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-300 uppercase">Pregunta {qIdx + 1}</p>
                <input className="w-full p-4 bg-slate-900 text-white rounded-2xl font-bold text-sm outline-none" placeholder="Escribe la pregunta..." value={q.text} onChange={e => handleQuestionChange(qIdx, 'text', e.target.value)} />
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Opciones (Marca la correcta)</p>
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => handleQuestionChange(qIdx, 'correctAnswer', oIdx)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all
                      ${q.correctAnswer === oIdx ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-300'}`}
                    >
                      {q.correctAnswer === oIdx ? <CheckCircle2 size={20}/> : <div className="w-3 h-3 rounded-full border-2 border-slate-200"></div>}
                    </button>
                    <input className="flex-1 p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none" placeholder={`Opción ${oIdx + 1}`} value={opt} onChange={e => handleOptionChange(qIdx, oIdx, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white font-black py-6 rounded-[30px] shadow-2xl flex items-center justify-center gap-3 uppercase text-xs tracking-[0.3em] active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> Guardar Clase</>}
        </button>
      </form>
    </div>
  );
}