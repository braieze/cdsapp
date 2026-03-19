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

  // ✅ FUNCIÓN DE NOTIFICACIÓN FORZADA A LA APP (SIN LINKS EXTERNOS)
  const sendPushNotification = async (notifTitle, notifContent, postUrl) => {
    try {
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

      if (!REST_API_KEY) return;

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          included_segments: ["Total Subscriptions"], 
          headings: { en: notifTitle, es: notifTitle },
          contents: { en: notifContent, es: notifContent },
          // 🎯 ELIMINAMOS URL PARA QUE NO ABRA CHROME
          // Pasamos solo data para que App.jsx capture la ruta internamente
          data: { route: postUrl },
          isAndroid: true,
          isIos: true,
          priority: 10
        })
      });
    } catch (error) {
      console.error("Error disparando notificación:", error);
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
              voters: [],
              votesDetails: [] 
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
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md font-outfit">
      <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col no-scrollbar border-2 border-slate-50">
        
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h3 className="font-black text-slate-900 text-xl uppercase tracking-tighter">
              {postToEdit ? 'Editar Post' : 'Nueva Publicación'}
            </h3>
            <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Comunicación Iglesia CDS</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-full active:scale-90 transition-transform">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 space-y-5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['Noticia', 'Devocional', 'Urgente'].map(t => (
              <button 
                key={t} onClick={() => setType(t)}
                className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border-2 transition-all ${
                  type === t ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-white text-slate-300 border-slate-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <input 
              type="text" placeholder="Título impactante..." value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full p-5 bg-slate-50 rounded-[22px] border-2 border-slate-50 font-black text-slate-800 focus:outline-none focus:border-brand-500 uppercase text-sm"
            />

            <textarea
              value={text} onChange={(e) => setText(e.target.value)}
              placeholder={type === 'Devocional' ? "Escribe la palabra de Dios hoy..." : "¿Qué está pasando en la iglesia?"}
              className="w-full h-44 p-5 bg-slate-50 rounded-[22px] border-2 border-slate-50 focus:outline-none focus:border-brand-500 resize-none text-sm font-semibold text-slate-700"
            />

            {!postToEdit && (
              <button 
                onClick={() => setShowPoll(!showPoll)} 
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${showPoll ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
              >
                <BarChart2 size={18} /> {showPoll ? 'Quitar Encuesta' : 'Añadir Encuesta'}
              </button>
            )}

            {showPoll && !postToEdit && (
              <div className="bg-slate-50 p-5 rounded-[28px] border-2 border-slate-100 space-y-3 animate-slide-up">
                <p className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2">Opciones de respuesta</p>
                {pollOptions.map((opt, idx) => (
                  <input 
                    key={idx} type="text" placeholder={`Respuesta ${idx + 1}`} value={opt} onChange={(e) => handlePollChange(idx, e.target.value)}
                    className="w-full p-4 bg-white rounded-xl border-2 border-slate-50 text-xs font-black uppercase outline-none focus:border-brand-200"
                  />
                ))}
                {pollOptions.length < 5 && (
                  <button onClick={handleAddPollOption} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[9px] text-slate-400 font-black uppercase tracking-widest">+ Agregar opción</button>
                )}
              </div>
            )}

            <div className="p-5 bg-slate-50 rounded-[28px] border-2 border-slate-100 space-y-4">
              <p className="text-[9px] font-black text-slate-400 uppercase ml-2">Acción en el post</p>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <input type="text" placeholder="https://link.com" value={link} onChange={e => setLink(e.target.value)} className="w-full p-4 bg-white rounded-xl border-2 border-slate-50 text-[10px] outline-none font-bold text-brand-600" />
                </div>
                <div className="w-1/3 space-y-1">
                  <input type="text" placeholder="Texto botón" value={linkText} onChange={e => setLinkText(e.target.value)} className="w-full p-4 bg-white rounded-xl border-2 border-slate-50 text-[10px] outline-none font-black uppercase" />
                </div>
              </div>
            </div>

            {preview && (
              <div className="relative rounded-[28px] overflow-hidden border-4 border-white shadow-2xl animate-scale-in">
                <img src={preview} alt="Preview" className="w-full h-52 object-cover" />
                <button onClick={() => { setImage(null); setPreview(null); }} className="absolute top-3 right-3 bg-slate-900/90 text-white p-2.5 rounded-full backdrop-blur-md active:scale-75 transition-all"><X size={18} /></button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-6 mt-8 border-t border-slate-50 shrink-0">
          <label className="flex-1 flex items-center justify-center gap-3 bg-slate-50 p-4 rounded-2xl text-slate-500 cursor-pointer active:scale-95 transition-all border-2 border-slate-100">
            {loading ? <Loader2 size={20} className="animate-spin text-brand-600" /> : <ImageIcon size={20} />}
            <span className="text-[10px] font-black uppercase tracking-widest">Subir Foto</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={loading} />
          </label>

          <button 
            onClick={handleSubmit} 
            disabled={loading || (!text && !image && !preview && !title)} 
            className="flex-[2] bg-brand-600 text-white p-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl shadow-brand-100 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} 
            {postToEdit ? 'Guardar' : 'Lanzar Post'}
          </button>
        </div>
      </div>
    </div>
  );
}