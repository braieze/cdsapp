import { useState, useEffect } from 'react';
import { 
  X, Image as ImageIcon, Send, Loader2, Link as LinkIcon, 
  BarChart2, Plus, Trash2, Save, Archive, HandHeart, 
  Anchor, Sun, CloudRain, Smile, Layers, Eye, Lock, Globe 
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { db, auth } from '../firebase'; 
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner'; 
import { ONESIGNAL_CONFIG } from '../oneSignalConfig'; 

const MOOD_OPTIONS = [
  { id: 'Fortaleza', icon: Anchor, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100' },
  { id: 'Gozo', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-100' },
  { id: 'Necesidad', icon: CloudRain, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
  { id: 'Paz', icon: Smile, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-100' },
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
  const [existingSeries, setExistingSeries] = useState([]); 

  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']); 

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  let setLoadingAction = () => {};

  useEffect(() => {
    const fetchSeriesMetadata = async () => {
      try {
        const seriesRef = doc(db, 'metadata', 'devotional_series');
        const seriesSnap = await getDoc(seriesRef);
        if (seriesSnap.exists()) {
          setExistingSeries(seriesSnap.data().list || []);
        }
      } catch (e) { console.error("Error cargando series:", e); }
    };
    if (isOpen) fetchSeriesMetadata();
  }, [isOpen]);

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

  const updateGlobalSeriesMetadata = async (name) => {
    if (!name.trim()) return;
    try {
      const seriesRef = doc(db, 'metadata', 'devotional_series');
      const seriesSnap = await getDoc(seriesRef);
      
      let updatedList = [name];
      if (seriesSnap.exists()) {
        const currentList = seriesSnap.data().list || [];
        const alreadyExists = currentList.some(s => s.toLowerCase() === name.toLowerCase());
        if (alreadyExists) return;
        updatedList = [...currentList, name];
      }
      await setDoc(seriesRef, { list: updatedList }, { merge: true });
    } catch (e) { console.error("Error actualizando metadatos de serie:", e); }
  };

  const sendPushNotification = async (notifTitle, notifContent, postUrl) => {
    try {
      const APP_ID = ONESIGNAL_CONFIG.APP_ID;
      const REST_API_KEY = ONESIGNAL_CONFIG.REST_API_KEY;
      
      if (!REST_API_KEY) return;
      if (visibility === 'servidores') return;

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
          data: { route: postUrl }, 
          large_icon: "https://cdsapp.vercel.app/logo.png",
          priority: 10,
          android_visibility: 1,
          android_accent_color: "FF0000"
        })
      });
    } catch (error) { console.error("Error notif:", error); }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const options = { maxSizeMB: 0.4, maxWidthOrHeight: 1200, useWebWorker: true };
    try {
      setLoading(true); 
      const compressedFile = await imageCompression(file, options);
      
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onloadend = () => {
        const base64String = reader.result;
        setImage(base64String); 
        setPreview(base64String); 
      };
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
        if (type === 'Devocional' && seriesName) await updateGlobalSeriesMetadata(seriesName);

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

        if (type === 'Devocional' && seriesName) await updateGlobalSeriesMetadata(seriesName);

        if (!isArchived) {
            const cleanContent = text.length > 80 ? text.substring(0, 80) + "..." : text;
            await sendPushNotification(commonData.title, cleanContent, `/post/${docRef.id}`);
        }
      }
      resetForm(); setLoading(false); onClose();
      toast.success("Publicación lanzada con éxito");
    } catch (error) { 
      console.error("Error al publicar:", error); 
      setLoadingAction(false); 
      setLoading(false);
      toast.error("Hubo un problema al publicar");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm font-sans text-left transition-all duration-300 animate-fade-in">
      <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-8 shadow-2xl relative max-h-[95vh] overflow-y-auto flex flex-col no-scrollbar animate-slide-up border border-slate-100">
        
        {/* INDICADOR DE ARRASTRE PARA MOBILE */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden shrink-0"></div>

        {/* HEADER MODERNO PREMIUM */}
        <div className="flex justify-between items-center mb-5 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-xl tracking-tight leading-none">
              {postToEdit ? 'Editar Publicación' : 'Crear Contenido'}
            </h3>
            <p className="text-xs font-semibold text-blue-600 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Panel de Edición
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* CUERPO DEL PANEL */}
        <div className="flex-1 space-y-6 pb-24">
          
          {/* TABS TIPO PASTILLERO (SEGMENTED CONTROL SOCIALYO) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1">Tipo de contenido</label>
            <div className="flex bg-slate-100/80 p-1 rounded-full overflow-x-auto no-scrollbar border border-slate-200/50">
              {['Noticia', 'Devocional', 'Oración', 'Urgente'].map(t => {
                const isActive = type === t;
                return (
                  <button 
                    key={t} onClick={() => { setType(t); if(t !== 'Devocional') setMood(''); }}
                    className={`flex-1 min-w-fit px-3 py-2 text-xs font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 ${
                      isActive 
                        ? (t === 'Urgente' ? 'bg-red-500 text-white shadow-sm' : 'bg-blue-500 text-white shadow-sm') 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t === 'Oración' && <HandHeart size={14} className={isActive ? 'text-white' : 'text-purple-500'} />}
                    {t === 'Urgente' && !isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>}
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* CONTROL DE VISIBILIDAD (Pills Limpios) */}
          <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1.5"><Eye size={14}/> Destinatarios</label>
             <div className="flex gap-2">
                <button 
                  onClick={() => setVisibility('publico')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${visibility === 'publico' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                >
                  <Globe size={14}/> Toda la Iglesia
                </button>
                <button 
                  onClick={() => setVisibility('servidores')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${visibility === 'servidores' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                >
                  <Lock size={14}/> Solo Servidores
                </button>
             </div>
          </div>

          {/* ENTRADAS PRINCIPALES */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 ml-1">Título</label>
              <input 
                type="text" placeholder="Escribe un título llamativo..." value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
              />
            </div>

            {/* SECCIÓN ESPECIAL DE DEVOCIONALES */}
            {type === 'Devocional' && (
              <div className="space-y-4 animate-fade-in p-4 bg-slate-50 border border-slate-100 rounded-3xl">
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-indigo-600 flex items-center gap-1.5 ml-1"><Layers size={14}/> Serie Activa</label>
                    <input 
                      list="series-suggestions"
                      placeholder="Ej: El Sermón del Monte"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                      value={seriesName} 
                      onChange={e => setSeriesName(e.target.value)}
                    />
                    <datalist id="series-suggestions">
                      {existingSeries.map((s, idx) => (
                        <option key={idx} value={s} />
                      ))}
                    </datalist>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 ml-1">Estado Espiritual</label>
                    <div className="grid grid-cols-4 gap-2">
                       {MOOD_OPTIONS.map(m => (
                         <button 
                           key={m.id} onClick={() => setMood(m.id)}
                           className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${mood === m.id ? `border-blue-300 bg-blue-50 shadow-sm` : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                         >
                           <m.icon size={20} className={mood === m.id ? m.color : 'text-slate-400'} />
                           <span className={`text-[10px] font-bold ${mood === m.id ? 'text-slate-800' : 'text-slate-400'}`}>{m.id}</span>
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 ml-1">Mensaje principal</label>
              <textarea
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder={type === 'Devocional' ? "Desarrolla la palabra inspirada por Dios hoy..." : type === 'Oración' ? "Describe la causa del clamor..." : "¿Qué novedades hay en la congregación?"}
                className="w-full h-36 p-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 leading-relaxed placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm resize-none"
              />
            </div>

            {/* INTERRUPTOR ARCHIVAR (Estilo Toggle Limpio) */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm cursor-pointer" onClick={() => setIsArchived(!isArchived)}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isArchived ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Archive size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">Archivar Post</span>
                      <span className="text-xs text-slate-500">Ocultar del muro principal</span>
                    </div>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isArchived ? 'bg-amber-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${isArchived ? 'right-1' : 'left-1'}`}></div>
                </div>
            </div>

            {/* ENCUESTAS DINÁMICAS */}
            {type !== 'Oración' && !postToEdit && (
              <button 
                onClick={() => setShowPoll(!showPoll)} 
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border ${showPoll ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
              >
                <BarChart2 size={16} /> {showPoll ? 'Quitar Encuesta' : 'Añadir Encuesta'}
              </button>
            )}

            {showPoll && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 animate-slide-up text-left">
                <p className="text-xs font-bold text-slate-500 ml-1">Opciones de votación</p>
                {pollOptions.map((opt, idx) => (
                  <input 
                    key={idx} type="text" placeholder={`Opción ${idx + 1}`} value={opt} onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[idx] = e.target.value;
                        setPollOptions(newOptions);
                    }}
                    className="w-full p-3 bg-white rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-blue-400 transition-colors shadow-sm"
                  />
                ))}
                {pollOptions.length < 5 && (
                  <button onClick={() => setPollOptions([...pollOptions, ''])} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500 font-bold hover:bg-white transition-colors">+ Añadir Alternativa</button>
                )}
              </div>
            )}

            {/* ENLACES EXTERNOS COMPONENT */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-sm">
              <p className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1.5"><LinkIcon size={14}/> Botón de Enlace Externo</p>
              <div className="flex gap-2 text-left">
                <input type="text" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs outline-none font-semibold text-blue-600 focus:border-blue-400" />
                <input type="text" placeholder="Texto botón" value={linkText} onChange={e => setLinkText(e.target.value)} className="w-1/3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs outline-none font-bold text-center focus:border-blue-400" />
              </div>
            </div>

            {/* PREVIEW DE FOTO SOCIAL */}
            {preview && (
              <div className="relative rounded-[24px] overflow-hidden border border-slate-200 shadow-sm animate-scale-in">
                <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
                <button onClick={() => { setImage(null); setPreview(null); }} className="absolute top-3 right-3 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-md active:scale-75 transition-all">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ACCIONES DEL FOOTER FIJO SOCIALYO */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex items-center gap-3 shrink-0 rounded-b-[32px] sm:rounded-b-[32px]">
          <label className="w-14 h-14 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-500 cursor-pointer active:scale-95 transition-colors border border-slate-200">
            {loading ? <Loader2 size={24} className="animate-spin text-slate-400" /> : <ImageIcon size={24} />}
            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={loading} />
          </label>

          <button 
            onClick={handleSubmit} 
            disabled={loading || (!text && !image && !preview && !title)} 
            className="flex-1 h-14 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} 
            {postToEdit ? 'Guardar Cambios' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}