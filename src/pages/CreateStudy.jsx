import { useState, useEffect } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, addDoc, serverTimestamp, doc, getDoc, 
  updateDoc, deleteDoc, getDocs, query, orderBy 
} from 'firebase/firestore';
import { 
  X, Save, Camera, Loader2, User, Search,
  Check, ChevronLeft, Trash2, GraduationCap,
  Tag, Eye, Lock // ✅ Iconos para visibilidad
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';

export default function CreateStudy() {
  const { id } = useParams(); // Si hay ID, estamos editando
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // ✅ CONFIGURACIÓN ONESIGNAL
  const ONESIGNAL_APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
  const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

  const categories = [
    "Estudios Bíblicos", 
    "Colaboradores", 
    "Profético", 
    "Jóvenes", 
    "Matrimonios", 
    "Liderazgo"
  ];

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Estudios Bíblicos',
    visibility: 'publico', // ✅ Nuevo: 'publico' o 'servidores'
    instructorName: '',
    instructorId: '',
    instructorPhoto: '',
    coverImage: '',
    lessonCount: 0,
    isNew: true
  });

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  // 🛡️ SEGURIDAD: Solo Pastores
  useEffect(() => {
    if (dbUser && dbUser.role !== 'pastor') {
      toast.error("Acceso restringido solo a Pastores");
      navigate('/estudio');
    }
  }, [dbUser, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      const uSnap = await getDocs(query(collection(db, 'users'), orderBy('displayName')));
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (id) {
        const docSnap = await getDoc(doc(db, 'studies', id));
        if (docSnap.exists()) {
          setFormData(prev => ({ ...prev, ...docSnap.data() }));
        }
      } else {
        setFormData(prev => ({
          ...prev,
          instructorName: dbUser?.displayName || '',
          instructorId: auth.currentUser?.uid || '',
          instructorPhoto: dbUser?.photoURL || ''
        }));
      }
    };
    fetchData();
  }, [id, dbUser]);

  // ✅ FUNCIÓN NOTIFICACIÓN (Ajustada para evitar Error 400)
  const sendNewStudyNotification = async (newId) => {
    try {
      if (formData.visibility !== 'publico') return; // Solo avisar si es pública

      const payload = {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Total Subscriptions"],
        headings: { 
          en: "📖 ¡Nueva Serie disponible!", 
          es: "📖 ¡Nueva Serie disponible!" 
        },
        contents: { 
          en: `${formData.title}. Dictado por ${formData.instructorName}. ¡Inscríbete ahora!`,
          es: `${formData.title}. Dictado por ${formData.instructorName}. ¡Inscríbete ahora!`,
        },
        data: { route: `/estudio/${newId}` },
        large_icon: "https://cdsapp.vercel.app/logo.png"
      };

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json; charset=utf-8", 
          "Authorization": `Basic ${REST_API_KEY}` 
        },
        body: JSON.stringify(payload)
      });
    } catch (e) { console.error("Push Error:", e); }
  };

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
      toast.success("Portada cargada");
    } catch (error) { toast.error("Error al subir imagen"); } finally { setUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.coverImage) return toast.warning("Falta título o portada");
    
    setLoading(true);
    try {
      if (id) {
        await updateDoc(doc(db, 'studies', id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success("Serie actualizada");
      } else {
        const docRef = await addDoc(collection(db, 'studies'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        // Enviar notificación solo si es nueva serie
        await sendNewStudyNotification(docRef.id);
        toast.success("Serie creada y enviada");
      }
      navigate('/estudio');
    } catch (error) { toast.error("Error al guardar"); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Seguro que quieres borrar toda esta serie? Se perderá todo.")) return;
    try {
      await deleteDoc(doc(db, 'studies', id));
      toast.success("Serie eliminada");
      navigate('/estudio');
    } catch (e) { toast.error("Error al eliminar"); }
  };

  const selectInstructor = (user) => {
    setFormData({
      ...formData,
      instructorName: user.displayName,
      instructorId: user.id,
      instructorPhoto: user.photoURL || ''
    });
    setIsSelectorOpen(false);
  };

  return (
    <div className="pb-40 pt-4 bg-slate-50 min-h-screen animate-fade-in font-outfit text-left">
      <div className="px-6 mb-8 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 active:scale-90 transition-all">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">{id ? 'Editar Serie' : 'Nueva Serie'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-6">
        {/* CARGA DE PORTADA */}
        <div className="relative h-56 w-full rounded-[45px] overflow-hidden bg-slate-200 border-4 border-white shadow-xl group">
          {formData.coverImage ? (
            <img src={formData.coverImage} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <Camera size={40} />
              <p className="text-[10px] font-black uppercase tracking-widest">Subir Portada</p>
            </div>
          )}
          <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all">
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading}/>
          </label>
          {uploading && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={32} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 space-y-5">
            
            {/* ✅ SELECTOR DE VISIBILIDAD */}
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                 <Eye size={12}/> ¿Quién puede ver esta serie?
               </label>
               <div className="flex gap-2">
                 <button
                  type="button"
                  onClick={() => setFormData({...formData, visibility: 'publico'})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 flex items-center justify-center gap-2
                    ${formData.visibility === 'publico' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white border-slate-50 text-slate-400'}`}
                 >
                   <Check size={14}/> Toda la Iglesia
                 </button>
                 <button
                  type="button"
                  onClick={() => setFormData({...formData, visibility: 'servidores'})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 flex items-center justify-center gap-2
                    ${formData.visibility === 'servidores' ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white border-slate-50 text-slate-400'}`}
                 >
                   <Lock size={14}/> Solo Servidores
                 </button>
               </div>
            </div>

            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-2">Título de la Serie</label>
               <input 
                 required className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-800 outline-none"
                 placeholder="Ej: A través de la Biblia"
                 value={formData.title}
                 onChange={e => setFormData({...formData, title: e.target.value})}
               />
            </div>
            
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-2">Descripción</label>
               <textarea 
                 required rows="3"
                 className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-800 outline-none"
                 placeholder="De qué trata esta serie..."
                 value={formData.description}
                 onChange={e => setFormData({...formData, description: e.target.value})}
               />
            </div>

            {/* SELECTOR DE CATEGORÍA */}
            <div className="space-y-2 pt-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                 <Tag size={12}/> Categoría de la Serie
               </label>
               <div className="flex flex-wrap gap-2">
                 {categories.map((cat) => (
                   <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({...formData, category: cat})}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border-2
                      ${formData.category === cat 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                        : 'bg-white border-slate-100 text-slate-400'}`}
                   >
                     {cat}
                   </button>
                 ))}
               </div>
            </div>
          </div>

          {/* SELECTOR DE DOCENTE */}
          <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 space-y-4">
             <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Docente de la Serie</h3>
                <button type="button" onClick={() => setIsSelectorOpen(true)} className="text-brand-600 font-black text-[9px] uppercase bg-brand-50 px-3 py-1.5 rounded-lg">Cambiar</button>
             </div>
             <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-slate-200">
                   <img src={formData.instructorPhoto || `https://ui-avatars.com/api/?name=${formData.instructorName}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-800 uppercase truncate">{formData.instructorName || 'No asignado'}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Instructor Oficial</p>
                </div>
                <Check className="text-emerald-500" size={18} />
             </div>
          </div>
        </div>

        <div className="flex gap-3">
          {id && (
            <button type="button" onClick={handleDelete} className="p-6 bg-rose-50 text-rose-500 rounded-[30px] active:scale-95 transition-all">
              <Trash2 size={24} />
            </button>
          )}
          <button 
            type="submit"
            disabled={loading || uploading}
            className="flex-1 bg-slate-900 text-white font-black py-6 rounded-[30px] shadow-2xl flex items-center justify-center gap-3 uppercase text-xs tracking-[0.3em] active:scale-95 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> {id ? 'Guardar Cambios' : 'Crear Serie'}</>}
          </button>
        </div>
      </form>

      {/* SELECTOR DE DOCENTE (MODAL) */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-900/90 backdrop-blur-md flex items-end justify-center" onClick={() => setIsSelectorOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[50px] h-[80vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b flex justify-between items-center text-left">
               <div><h3 className="font-black text-slate-900 text-sm uppercase">Seleccionar Docente</h3><p className="text-[9px] font-bold text-slate-400 uppercase">Directorio de la Iglesia</p></div>
               <button onClick={() => setIsSelectorOpen(false)} className="p-2 bg-slate-50 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-5">
              <div className="bg-slate-50 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-inner">
                <Search size={18} className="text-slate-300"/><input autoFocus placeholder="Buscar docente..." className="w-full text-sm font-bold outline-none bg-transparent" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2 no-scrollbar pb-20">
              {users.filter(u => u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                <button key={u.id} onClick={() => selectInstructor(u)} className="w-full flex items-center gap-4 p-4 rounded-3xl border-2 border-slate-50 hover:border-brand-500 transition-all text-left">
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-full h-full object-cover" /></div>
                  <div className="flex-1 min-w-0"><p className="font-black text-xs uppercase truncate text-slate-800">{u.displayName}</p><p className="text-[9px] font-bold uppercase text-slate-400">{u.role} - {u.area || 'Miembro'}</p></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}