import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Send, Loader2, Link as LinkIcon, Tag, BarChart2, Plus, Trash2, Save } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { db, auth } from '../firebase'; 
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

export default function CreatePostModal({ isOpen, onClose, postToEdit }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [linkText, setLinkText] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('Noticia');
  
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']); 

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  useEffect(() => {
    if (postToEdit) {
      setText(postToEdit.content || '');
      setTitle(postToEdit.title || '');
      setLink(postToEdit.link || '');
      setLinkText(postToEdit.linkText || '');
      setTagInput(postToEdit.tags ? postToEdit.tags.join(', ') : '');
      setType(postToEdit.type || 'Noticia');
      setPreview(postToEdit.image || null);
      setShowPoll(false);
    } else {
      resetForm();
    }
  }, [postToEdit, isOpen]);

  const resetForm = () => {
    setText(''); setTitle(''); setLink(''); setLinkText(''); setTagInput('');
    setImage(null); setPreview(null); setShowPoll(false); setPollOptions(['', '']);
  };

  // ✅ FUNCIÓN DE NOTIFICACIÓN BLINDADA
  const sendPushNotification = async (notifTitle, notifContent, postUrl) => {
    try {
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

      if (!REST_API_KEY) {
        console.error("❌ Error: Falta API KEY en variables de entorno");
        return;
      }

      const webUrl = `https://cdsapp.vercel.app/#${postUrl}`;

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          // 🎯 SEGMENTO DE FUERZA BRUTA PARA QUE LLEGUE A TODOS
          included_segments: ["Total Subscriptions"], 
          headings: { en: notifTitle, es: notifTitle },
          contents: { en: notifContent, es: notifContent },
          url: webUrl,
          data: { route: postUrl },
          isAnyWeb: true,
          isAndroid: true,
          isIos: true,
          priority: 10
        })
      });

      const data = await response.json();
      console.log("✅ OneSignal Post dice:", data);
    } catch (error) {
      console.error("❌ Error disparando notificación:", error);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1280, useWebWorker: true, initialQuality: 0.8 };
    try {
      setLoading(true); 
      const compressedFile = await imageCompression(file, options);
      setImage(compressedFile);
      setPreview(URL.createObjectURL(compressedFile));
    } catch (error) { console.log(error); } finally { setLoading(false); }
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 5) setPollOptions([...pollOptions, '']);
  };

  const handlePollChange = (index, value) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !image && !preview && !title.trim()) return;
    setLoading(true);

    try {
      let imageUrl = postToEdit ? postToEdit.image : null;

      if (image) {
        const formData = new FormData();
        formData.append("file", image);
        formData.append("upload_preset", UPLOAD_PRESET); 
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const data = await response.json();
        if (data.secure_url) imageUrl = data.secure_url; 
      }

      const commonData = {
        content: text,
        title: title || (type === 'Devocional' ? 'Devocional del día' : 'Nueva Noticia'), 
        link: link,   
        linkText: linkText || 'Ver más', 
        tags: tagInput ? tagInput.split(',').map(tag => tag.trim()) : [], 
        image: imageUrl, 
        type: type,
      };

      if (postToEdit) {
        const postRef = doc(db, 'posts', postToEdit.id);
        await updateDoc(postRef, { ...commonData, updatedAt: serverTimestamp() });
      } else {
        let finalPoll = null;
        if (showPoll) {
          const validOptions = pollOptions.filter(opt => opt.trim() !== '');
          if (validOptions.length >= 2) {
            finalPoll = {
              options: validOptions.map(opt => ({ text: opt, votes: 0 })),
              voters: [] 
            };
          }
        }

        const docRef = await addDoc(collection(db, 'posts'), {
          ...commonData,
          authorId: auth.currentUser.uid,
          authorName: auth.currentUser.displayName,
          authorPhoto: auth.currentUser.photoURL,
          role: 'Pastor / Equipo', 
          poll: finalPoll,
          isPinned: false,
          createdAt: serverTimestamp(),
          likes: [],
          commentsCount: 0
        });

        // ✅ DISPARO DE NOTIFICACIÓN AL CREAR
        const cleanContent = text.length > 80 ? text.substring(0, 80) + "..." : text;
        await sendPushNotification(
            commonData.title, 
            cleanContent || "Toca para ver la nueva publicación.",
            `/post/${docRef.id}` 
        );
      }

      resetForm();
      setLoading(false);
      onClose();

    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
      alert('Error al guardar.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow-2xl relative max-h-[85vh] overflow-y-auto flex flex-col no-scrollbar">
        
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="font-black text-slate-800 text-lg uppercase tracking-tighter">
            {postToEdit ? 'Editar Publicación' : 'Crear Publicación'}
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1">
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
            {['Noticia', 'Devocional', 'Urgente'].map(t => (
              <button 
                key={t} onClick={() => setType(t)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all ${
                  type === t ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <input 
              type="text" placeholder="Título de la publicación..." value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-800 focus:outline-none focus:border-brand-500 text-sm"
            />

            <textarea
              value={text} onChange={(e) => setText(e.target.value)}
              placeholder={type === 'Devocional' ? "Escribe la reflexión del día..." : "¿Qué quieres compartir con la iglesia?"}
              className="w-full h-40 p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:outline-none focus:border-brand-500 resize-none text-sm font-medium"
            />

            {!postToEdit && (
              <button 
                onClick={() => setShowPoll(!showPoll)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showPoll ? 'bg-brand-50 text-brand-600 border border-brand-200' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
              >
                <BarChart2 size={16} /> {showPoll ? 'Quitar Encuesta' : 'Añadir Encuesta'}
              </button>
            )}

            {showPoll && !postToEdit && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 animate-slide-down">
                {pollOptions.map((opt, idx) => (
                  <input 
                    key={idx} type="text" placeholder={`Opción ${idx + 1}`} value={opt} onChange={(e) => handlePollChange(idx, e.target.value)}
                    className="w-full p-3 bg-white rounded-xl border border-slate-100 text-xs font-bold outline-none focus:border-brand-300"
                  />
                ))}
                {pollOptions.length < 5 && (
                  <button onClick={handleAddPollOption} className="text-[10px] text-brand-600 font-black uppercase tracking-widest mt-1">+ Agregar opción</button>
                )}
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Link Externo</label>
                  <input type="text" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} className="w-full p-3 bg-white rounded-xl border border-slate-100 text-xs outline-none font-bold text-brand-600" />
                </div>
                <div className="w-1/3 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Texto Botón</label>
                  <input type="text" placeholder="Ver..." value={linkText} onChange={e => setLinkText(e.target.value)} className="w-full p-3 bg-white rounded-xl border border-slate-100 text-xs outline-none font-bold" />
                </div>
              </div>
            </div>

            {preview && (
              <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-lg animate-scale-in">
                <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
                <button onClick={() => { setImage(null); setPreview(null); }} className="absolute top-2 right-2 bg-slate-900/80 text-white p-2 rounded-full backdrop-blur-md"><X size={16} /></button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 mt-6 border-t border-slate-100">
          <label className="flex items-center gap-2 bg-slate-100 px-4 py-2.5 rounded-2xl text-slate-600 cursor-pointer active:scale-95 transition-all">
            {loading ? <Loader2 size={18} className="animate-spin text-brand-600" /> : <ImageIcon size={18} />}
            <span className="text-[10px] font-black uppercase tracking-widest">Imagen</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={loading} />
          </label>

          <button 
            onClick={handleSubmit} 
            disabled={loading || (!text && !image && !preview && !title)} 
            className="bg-brand-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-brand-200 flex items-center gap-3 disabled:opacity-50 active:scale-95 transition-all"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (postToEdit ? <Save size={18}/> : <Send size={18} />)} 
            {postToEdit ? 'Guardar' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}