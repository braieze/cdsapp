import { useState, useEffect } from 'react';
import { 
  X, Image as ImageIcon, Send, Loader2, Link as LinkIcon, 
  BarChart2, Plus, Trash2, Save, Archive, HandHeart, 
  Anchor, Sun, CloudRain, Smile, Layers, Eye, Lock, Globe 
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { db, auth } from '../firebase'; 
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

const MOOD_OPTIONS = [
  { id: 'Fortaleza', icon: Anchor, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'Gozo', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'Necesidad', icon: CloudRain, color: 'text-slate-500', bg: 'bg-slate-50' },
  { id: 'Paz', icon: Smile, color: 'text-emerald-500', bg: 'bg-emerald-50' },
];

export default function CreatePostModal({ isOpen, onClose, postToEdit }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [linkText, setLinkText] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('Noticia');
  const [visibility, setVisibility] = useState('publico'); 
  const [isArchived, setIsArchived] = useState(false);
  const [mood, setMood] = useState(''); 
  const [seriesName, setSeriesName] = useState(''); 

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
      setType(postToEdit.type || 'Noticia');
      setVisibility(postToEdit.visibility || 'publico');
      setPreview(postToEdit.image || null);
      setIsArchived(postToEdit.isArchived || false);
      setMood(postToEdit.mood || '');
      setSeriesName(postToEdit.seriesName || '');
      setShowPoll(false);
    } else {
      resetForm();
    }
  }, [postToEdit, isOpen]);

  const resetForm = () => {
    setText(''); setTitle(''); setLink(''); setLinkText('');
    setImage(null); setPreview(null); setShowPoll(false); setPollOptions(['', '']);
    setIsArchived(false); setType('Noticia'); setVisibility('publico'); 
    setMood(''); setSeriesName('');
  };

  // ✅ MEJORA: Función de notificación alineada con TopBar
  const sendPushNotification = async (notifTitle, notifContent, postUrl) => {
    try {
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      
      if (!REST_API_KEY) {
        console.error("Falta REST API KEY de OneSignal");
        return;
      }

      // Estructura de payload idéntica a la manual que sí funciona
      const payload = {
        app_id: APP_ID,
        headings: { en: notifTitle, es: notifTitle },
        contents: { en: notifContent, es: notifContent },
        data: { route: postUrl }, // Deep linking al post
        large_icon: "https://cdsapp.vercel.app/logo.png",
        priority: 10,
        android_visibility: 1,
        android_accent_color: "FF0000"
      };

      // Lógica de segmentación según visibilidad
      if (visibility === 'servidores') {
        // Si tienes tags de "area" como en TopBar, se pueden usar aquí
        payload.filters = [{ field: "tag", key: "role", relation: "!=", value: "miembro" }];
      } else {
        payload.included_segments = ["Total Subscriptions"];
      }

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
        console.error("Error OneSignal API:", errorData);
      }
    } catch (error) { 
      console.error("Error en el proceso de notificación:", error); 
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1280, useWebWorker: true };
    try {
      setLoading(true); 
      const compressedFile = await imageCompression(file, options);
      setImage(compressedFile);
      setPreview(URL.createObjectURL(compressedFile));
    } catch (error) { console.log(error); } finally { setLoading(false); }
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
        title: title || (type === 'Devocional' ? 'Palabra del día' : type === 'Oración' ? 'Pedido de Oración' : 'Nueva Noticia'), 
        link: link,   
        linkText: linkText || 'Ver más', 
        image: imageUrl, 
        type: type,
        visibility: visibility,
        isArchived: isArchived,
        mood: (type === 'Devocional' || type === 'Oración') ? mood : '', 
        seriesName: type === 'Devocional' ? seriesName : '', 
      };

      if (postToEdit) {
        const postRef = doc(db, 'posts', postToEdit.id);
        await updateDoc(postRef, { ...commonData, updatedAt: serverTimestamp() });
        
        // Notificación si se desarchiva
        if (postToEdit.isArchived && !isArchived) {
            const cleanContent = text.length > 80 ? text.substring(0, 80) + "..." : text;
            await sendPushNotification(`📢 Actualización: ${commonData.title}`, cleanContent, `/post/${postToEdit.id}`);
        }
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
          updatedAt: serverTimestamp(),
          likes: [],
          commentsCount: 0
        });

        // ✅ ENVÍO DE NOTIFICACIÓN AUTOMÁTICA
        if (!isArchived) {
            const cleanContent = text.length > 80 ? text.substring(0, 80) + "..." : text;
            await sendPushNotification(commonData.title, cleanContent, `/post/${docRef.id}`);
        }
      }
      resetForm(); setLoading(false); onClose();
      toast.success("Publicación lanzada con éxito");
    } catch (error) { 
      console.error("Error al publicar:", error); 
      setLoading(false); 
      toast.error("Hubo un problema al publicar");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md font-outfit text-left">
      <div className="bg-white w-full max-w-md rounded-[45px] p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto flex flex-col no-scrollbar border-t-8 border-brand-600">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter leading-none">
              {postToEdit ? 'Editar Post' : 'Crear Post'}
            </h3>
            <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1 text-left">Panel de Comunicación</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-full active:scale-75 transition-all text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 space-y-6">
          {/* SELECTOR DE TIPO */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['Noticia', 'Devocional', 'Oración', 'Urgente'].map(t => (
              <button 
                key={t} onClick={() => { setType(t); if(t !== 'Devocional') setMood(''); }}
                className={`px-5 py-3 text-[9px] font-black uppercase tracking-widest rounded-2xl border-2 transition-all shrink-0 ${
                  type === t ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-white text-slate-300 border-slate-100'
                }`}
              >
                {t === 'Oración' && <HandHeart size={12} className="inline mr-1" />}
                {t}
              </button>
            ))}
          </div>

          {/* VISIBILIDAD */}
          <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Eye size={12}/> Visibilidad del post</label>
             <div className="flex gap-2">
                <button 
                  onClick={() => setVisibility('publico')}
                  className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase transition-all border-2 flex items-center justify-center gap-2 ${visibility === 'publico' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white text-slate-300 border-slate-100'}`}
                >
                  <Globe size={12}/> Toda la Iglesia
                </button>
                <button 
                  onClick={() => setVisibility('servidores')}
                  className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase transition-all border-2 flex items-center justify-center gap-2 ${visibility === 'servidores' ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white text-slate-300 border-slate-100'}`}
                >
                  <Lock size={12}/> Solo Servidores
                </button>
             </div>
          </div>

          <div className="space-y-4">
            <input 
              type="text" placeholder="Título del mensaje..." value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full p-5 bg-slate-50 rounded-[24px] border-2 border-slate-50 font-black text-slate-800 focus:outline-none focus:border-brand-500 uppercase text-sm"
            />

            {type === 'Devocional' && (
              <div className="space-y-4 animate-fade-in">
                 <div className="p-5 bg-indigo-50/50 rounded-[30px] border-2 border-indigo-100/50">
                    <p className="text-[9px] font-black text-indigo-600 uppercase mb-4 ml-2 flex items-center gap-2"><Layers size={12}/> Serie (Opcional)</p>
                    <input 
                      placeholder="Ej: El Sermón del Monte"
                      className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs font-bold outline-none"
                      value={seriesName} onChange={e => setSeriesName(e.target.value)}
                    />
                 </div>
                 <div className="p-5 bg-slate-50 rounded-[30px] border-2 border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-4 ml-2 text-left">¿Ánimo del devocional?</p>
                    <div className="grid grid-cols-4 gap-2">
                       {MOOD_OPTIONS.map(m => (
                         <button 
                           key={m.id} onClick={() => setMood(m.id)}
                           className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all ${mood === m.id ? 'border-brand-500 bg-white shadow-md' : 'border-transparent opacity-40 grayscale'}`}
                         >
                           <m.icon size={20} className={m.color} />
                           <span className="text-[8px] font-black uppercase">{m.id}</span>
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            <textarea
              value={text} onChange={(e) => setText(e.target.value)}
              placeholder={type === 'Devocional' ? "Escribe la palabra de Dios hoy..." : type === 'Oración' ? "¿Por qué necesitamos orar?" : "¿Qué quieres compartir?"}
              className="w-full h-48 p-6 bg-slate-50 rounded-[30px] border-2 border-slate-50 focus:outline-none focus:border-brand-500 resize-none text-base font-medium text-slate-700 leading-relaxed shadow-inner"
            />

            <button 
                onClick={() => setIsArchived(!isArchived)}
                className={`w-full flex items-center justify-between p-5 rounded-3xl border-2 transition-all ${isArchived ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
            >
                <div className="flex items-center gap-3">
                    <Archive size={20}/>
                    <span className="text-[11px] font-black uppercase tracking-widest">Archivar Publicación</span>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-all ${isArchived ? 'bg-amber-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isArchived ? 'right-1' : 'left-1'}`}></div>
                </div>
            </button>

            {type !== 'Oración' && !postToEdit && (
              <button 
                onClick={() => setShowPoll(!showPoll)} 
                className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${showPoll ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
              >
                <BarChart2 size={18} /> {showPoll ? 'Quitar Encuesta' : 'Añadir Encuesta'}
              </button>
            )}

            {showPoll && (
              <div className="bg-slate-50 p-6 rounded-[35px] border-2 border-slate-100 space-y-3 animate-slide-up">
                {pollOptions.map((opt, idx) => (
                  <input 
                    key={idx} type="text" placeholder={`Opción ${idx + 1}`} value={opt} onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[idx] = e.target.value;
                        setPollOptions(newOptions);
                    }}
                    className="w-full p-4 bg-white rounded-xl border-2 border-slate-50 text-xs font-black uppercase outline-none"
                  />
                ))}
                {pollOptions.length < 5 && (
                  <button onClick={() => setPollOptions([...pollOptions, ''])} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[9px] text-slate-400 font-black uppercase tracking-widest">+ Opción</button>
                )}
              </div>
            )}

            <div className="p-6 bg-slate-50 rounded-[35px] border-2 border-slate-100 space-y-4">
              <p className="text-[9px] font-black text-slate-400 uppercase ml-2">Enlace Externo</p>
              <div className="flex gap-3 text-left">
                <input type="text" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} className="flex-1 p-4 bg-white rounded-2xl border-2 border-slate-50 text-[10px] outline-none font-bold text-brand-600 shadow-sm" />
                <input type="text" placeholder="Botón" value={linkText} onChange={e => setLinkText(e.target.value)} className="w-1/3 p-4 bg-white rounded-2xl border-2 border-slate-50 text-[10px] outline-none font-black uppercase shadow-sm" />
              </div>
            </div>

            {preview && (
              <div className="relative rounded-[35px] overflow-hidden border-4 border-white shadow-2xl animate-scale-in">
                <img src={preview} alt="Preview" className="w-full h-56 object-cover" />
                <button onClick={() => { setImage(null); setPreview(null); }} className="absolute top-4 right-4 bg-slate-900/90 text-white p-3 rounded-full backdrop-blur-md active:scale-75 transition-all"><X size={20} /></button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 pt-8 mt-8 border-t border-slate-50 shrink-0">
          <label className="flex-1 flex items-center justify-center gap-3 bg-slate-50 p-5 rounded-[24px] text-slate-500 cursor-pointer active:scale-95 transition-all border-2 border-slate-100">
            {loading ? <Loader2 size={22} className="animate-spin text-brand-600" /> : <ImageIcon size={22} />}
            <span className="text-[11px] font-black uppercase tracking-widest">Foto</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={loading} />
          </label>

          <button 
            onClick={handleSubmit} 
            disabled={loading || (!text && !image && !preview && !title)} 
            className="flex-[2] bg-brand-600 text-white p-5 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-brand-100 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30"
          >
            {loading ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />} 
            {postToEdit ? 'Guardar' : 'Lanzar'}
          </button>
        </div>
      </div>
    </div>
  );
}