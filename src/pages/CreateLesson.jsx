import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { 
  collection, addDoc, serverTimestamp, doc, getDoc, 
  updateDoc, increment, getDocs, query, where, orderBy 
} from 'firebase/firestore';
import { 
  X, Save, Play, FileText, Plus, Trash2, 
  ChevronLeft, Loader2, HelpCircle, CheckCircle2,
  Image as ImageIcon, Link as LinkIcon, AlignLeft,
  ArrowUpCircle, Info
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';

export default function CreateLesson() {
  const { id, lessonId } = useParams(); // id = studyId
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [lessonData, setLessonData] = useState({
    title: '',
    videoUrl: '',
    pdfUrl: '',
    introduction: '', 
    duration: '',
    order: 1, 
    externalLink: { name: '', url: '', description: '' }, 
    gallery: [], 
    quiz: {
      questions: [
        { text: '', options: ['', '', '', ''], correctAnswer: 0 }
      ],
      passingScore: 7
    }
  });

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  // ✅ CLAVES DE ONESIGNAL
  const ONESIGNAL_APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
  const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

  useEffect(() => {
    const fetchData = async () => {
      if (lessonId) {
        const lSnap = await getDoc(doc(db, 'lessons', lessonId));
        if (lSnap.exists()) setLessonData({ ...lSnap.data() });
      } else {
        const q = query(collection(db, 'lessons'), where('studyId', '==', id));
        const snap = await getDocs(q);
        setLessonData(prev => ({ ...prev, order: snap.size + 1 }));
      }
    };
    fetchData();
  }, [id, lessonId]);

  // ✅ FUNCIÓN DE NOTIFICACIÓN CORREGIDA (Deep Linking Fix)
  const sendLessonNotification = async (studyTitle) => {
    try {
      // 🎯 IMPORTANTE: La ruta DEBE empezar con / y ser un string limpio
      const targetRoute = `/estudio/${id}`; 

      const payload = {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Total Subscriptions"],
        headings: { 
          en: "🎬 ¡Nuevo Capítulo Disponible!", 
          es: "🎬 ¡Nuevo Capítulo Disponible!" 
        },
        contents: { 
          en: `${lessonData.title} - Se creó un nuevo capítulo de la serie: ${studyTitle}`,
          es: `${lessonData.title} - Se creó un nuevo capítulo de la serie: ${studyTitle}`
        },
        // ✅ DATA corregido para sincronizar con App.jsx
        data: { 
          route: targetRoute 
        },
        large_icon: "https://cdsapp.vercel.app/logo.png",
        priority: 10,
        android_accent_color: "FF0000",
        android_visibility: 1
      };

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json; charset=utf-8", 
          "Authorization": `Basic ${REST_API_KEY}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error OneSignal:", errorData);
      }
    } catch (e) {
      console.error("Error enviando push:", e);
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    const newImages = [];
    try {
      for (const file of files) {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1000, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const data = new FormData();
        data.append("file", compressedFile);
        data.append("upload_preset", UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: data });
        const fileData = await res.json();
        newImages.push(fileData.secure_url);
      }
      setLessonData(prev => ({ ...prev, gallery: [...prev.gallery, ...newImages] }));
      toast.success(`${newImages.length} fotos añadidas`);
    } catch (error) { toast.error("Error al subir imágenes"); } finally { setUploading(false); }
  };

  const removeGalleryImage = (idx) => {
    const filtered = lessonData.gallery.filter((_, i) => i !== idx);
    setLessonData({ ...lessonData, gallery: filtered });
  };

  const handleAddQuestion = () => {
    setLessonData({ ...lessonData, quiz: { ...lessonData.quiz, questions: [...lessonData.quiz.questions, { text: '', options: ['', '', '', ''], correctAnswer: 0 }] } });
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
    if (!lessonData.title || !lessonData.videoUrl) return toast.warning("Título y Video obligatorios");
    
    setLoading(true);
    try {
      if (lessonId) {
        await updateDoc(doc(db, 'lessons', lessonId), { ...lessonData, updatedAt: serverTimestamp() });
        toast.success("Clase actualizada");
      } else {
        await addDoc(collection(db, 'lessons'), { ...lessonData, studyId: id, createdAt: serverTimestamp() });
        await updateDoc(doc(db, 'studies', id), { lessonCount: increment(1) });

        const studySnap = await getDoc(doc(db, 'studies', id));
        const studyTitle = studySnap.exists() ? studySnap.data().title : "la Academia";

        // ✅ Notificación disparada con la ruta corregida
        await sendLessonNotification(studyTitle);
        
        toast.success("Clase publicada y notificación enviada");
      }
      navigate(`/estudio/${id}`);
    } catch (error) { toast.error("Error al guardar"); } finally { setLoading(false); }
  };

  return (
    <div className="pb-40 pt-4 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left overflow-y-auto">
      <div className="px-6 mb-8 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 active:scale-90 transition-all">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">{lessonId ? 'Editar Clase' : 'Nueva Clase'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-6">
        <div className="bg-white p-7 rounded-[40px] shadow-sm border border-slate-100 space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-2">Título de la Clase</label>
            <input required className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border-2 border-transparent focus:border-brand-200 transition-all" placeholder="Ej: Las promesas de Dios" value={lessonData.title} onChange={e => setLessonData({...lessonData, title: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><AlignLeft size={12}/> Introducción / Apuntes de la Clase</label>
            <textarea rows="6" className="w-full p-4 bg-slate-50 rounded-2xl font-medium text-sm outline-none border-2 border-transparent focus:border-brand-200 transition-all" placeholder="Escribe aquí el resumen o introducción que verán los hermanos..." value={lessonData.introduction} onChange={e => setLessonData({...lessonData, introduction: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Orden de Clase</label>
              <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm outline-none" value={lessonData.order} onChange={e => setLessonData({...lessonData, order: parseInt(e.target.value)})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Duración aprox.</label>
              <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" placeholder="20 min" value={lessonData.duration} onChange={e => setLessonData({...lessonData, duration: e.target.value})} />
            </div>
          </div>
        </div>

        {/* ... Resto del formulario (Video, PDF, Galería, Quiz) se mantiene idéntico ... */}
        <div className="bg-white p-7 rounded-[40px] shadow-sm border border-slate-100 space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-2 flex items-center gap-2"><Play size={12}/> Link Video (YouTube)</label>
            <input required className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none" placeholder="https://www.youtube.com/watch?v=..." value={lessonData.videoUrl} onChange={e => setLessonData({...lessonData, videoUrl: e.target.value})} />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2 flex items-center gap-2"><FileText size={12}/> Link PDF de Estudio</label>
            <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none" placeholder="Pega el link del PDF (Drive/Dropbox)..." value={lessonData.pdfUrl} onChange={e => setLessonData({...lessonData, pdfUrl: e.target.value})} />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-2 flex items-center gap-2"><ImageIcon size={12}/> Galería de Imágenes Extras</label>
            <div className="flex flex-wrap gap-3">
              {lessonData.gallery.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden shadow-md">
                  <img src={img} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeGalleryImage(idx)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 shadow-lg"><X size={10}/></button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 cursor-pointer hover:bg-slate-50 transition-all">
                {uploading ? <Loader2 className="animate-spin" size={20}/> : <Plus size={24}/>}
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={uploading}/>
              </label>
            </div>
          </div>
        </div>

        {/* ... Constructor de Examen (Igual al anterior) ... */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Evaluación de la Clase</h3>
            <button type="button" onClick={handleAddQuestion} className="text-brand-600 bg-brand-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 active:scale-95 transition-all shadow-sm">
              <Plus size={14}/> Pregunta
            </button>
          </div>

          {lessonData.quiz.questions.map((q, qIdx) => (
            <div key={qIdx} className="bg-white p-7 rounded-[40px] border-2 border-white shadow-sm space-y-5 relative animate-scale-in">
              <button type="button" onClick={() => handleRemoveQuestion(qIdx)} className="absolute top-6 right-6 text-rose-300 hover:text-rose-500 transition-colors"><Trash2 size={20}/></button>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-900 text-white text-[10px] rounded-full flex items-center justify-center font-black">{qIdx + 1}</span>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Pregunta</p>
                </div>
                <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border-2 border-transparent focus:border-slate-200" placeholder="Escribe la pregunta..." value={q.text} onChange={e => handleQuestionChange(qIdx, 'text', e.target.value)} />
              </div>
              <div className="space-y-3">
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-3">
                    <button type="button" onClick={() => handleQuestionChange(qIdx, 'correctAnswer', oIdx)} className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${q.correctAnswer === oIdx ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                      {q.correctAnswer === oIdx ? <CheckCircle2 size={20}/> : <div className="w-3 h-3 rounded-full border-2 border-slate-200"></div>}
                    </button>
                    <input className="flex-1 p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none" placeholder={`Opción ${oIdx + 1}`} value={opt} onChange={e => handleOptionChange(qIdx, oIdx, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button type="submit" disabled={loading || uploading} className="w-full bg-slate-900 text-white font-black py-6 rounded-[35px] shadow-2xl flex items-center justify-center gap-3 uppercase text-xs tracking-[0.3em] active:scale-95 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> {lessonId ? 'Guardar Cambios' : 'Publicar Clase'}</>}
        </button>
      </form>
    </div>
  );
}