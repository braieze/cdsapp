import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  X, Save, Camera, Loader2, BookOpen, User, 
  AlignLeft, CheckCircle, ChevronLeft 
} from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function CreateStudy() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructorName: dbUser?.displayName || '',
    instructorPhoto: dbUser?.photoURL || '',
    coverImage: '',
    lessonCount: 0,
    isNew: true
  });

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const data = new FormData();
      data.append("file", compressedFile);
      data.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: data });
      const fileData = await res.json();
      setFormData({ ...formData, coverImage: fileData.secure_url });
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.coverImage) return alert("Falta título o imagen de portada");
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'studies'), {
        ...formData,
        instructorId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      navigate('/estudio');
    } catch (error) {
      console.error(error);
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
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Nueva Serie</h2>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-6">
        {/* CARGA DE PORTADA */}
        <div className="relative h-56 w-full rounded-[45px] overflow-hidden bg-slate-200 border-4 border-white shadow-xl">
          {formData.coverImage ? (
            <img src={formData.coverImage} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <Camera size={40} />
              <p className="text-[10px] font-black uppercase tracking-widest">Subir Portada</p>
            </div>
          )}
          <label className="absolute inset-0 cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading}/>
          </label>
          {uploading && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={32} />
            </div>
          )}
        </div>

        {/* INPUTS DE TEXTO */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 space-y-5">
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-2">Título de la Serie</label>
               <input 
                 required
                 className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 ring-brand-500/20"
                 placeholder="Ej: A través de la Biblia"
                 value={formData.title}
                 onChange={e => setFormData({...formData, title: e.target.value})}
               />
            </div>
            
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-2">Descripción Corta</label>
               <textarea 
                 required
                 rows="3"
                 className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 ring-brand-500/20"
                 placeholder="De qué trata esta serie..."
                 value={formData.description}
                 onChange={e => setFormData({...formData, description: e.target.value})}
               />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 space-y-4">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Datos del Docente</h3>
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-50">
                   <img src={formData.instructorPhoto || `https://ui-avatars.com/api/?name=${formData.instructorName}`} />
                </div>
                <input 
                  className="flex-1 p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none"
                  placeholder="Nombre del Docente"
                  value={formData.instructorName}
                  onChange={e => setFormData({...formData, instructorName: e.target.value})}
                />
             </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading || uploading}
          className="w-full bg-slate-900 text-white font-black py-6 rounded-[30px] shadow-2xl flex items-center justify-center gap-3 uppercase text-xs tracking-[0.3em] active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> Crear Serie</>}
        </button>
      </form>
    </div>
  );
}