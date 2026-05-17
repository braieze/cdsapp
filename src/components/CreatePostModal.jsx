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
import { ONESIGNAL_CONFIG } from '../oneSignalConfig'; // ✅ IMPORTACIÓN PARA FIX APK

const MOOD_OPTIONS = [
  { id: 'Fortaleza', icon: Anchor, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'Gozo', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
  { id: 'Necesidad', icon: CloudRain, color: 'text-slate-500', bg: 'bg-slate-500/10 border-slate-500/20' },
  { id: 'Paz', icon: Smile, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
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

  // Variable de control por si venía declarada externamente
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

  // ✅ FIX NATIVO ANDROID/WEB: Compresión + Conversión limpia a Base64
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
        setImage(base64String); // Guardamos la cadena base64 directo
        setPreview(base64String); // Visualización instantánea libre de bugs de rutas
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
        formData.append("file", image); // Cloudinary recibe Base64 nativamente
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
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xl font-outfit text-left transition-all duration-300 animate-fade-in">
      <div className="bg-white w-full sm:max-w-md rounded-t-[40px] sm:rounded-[45px] p-6 sm:p-8 shadow-2xl relative max-h-[94vh] overflow-y-auto flex flex-col no-scrollbar border-t-[6px] border-slate-900 animate-slide-up">
        
        {/* INDICADOR DE ARRASTRE PARA MOBILE */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>

        {/* HEADER MODERNO */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter leading-none italic">
              {postToEdit ? 'Editar Palabra' : 'Nueva Publicación'}
            </h3>
            <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span> Panel de Edición Social
            </p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 active:scale-90 rounded-full transition-all text-slate-400 border border-slate-100/50 shadow-sm">
            <X size={20} />
          </button>
        </div>

        {/* CUERPO DEL PANEL */}
        <div className="flex-1 space-y-6 pb-24">
          
          {/* TABS TIPO BURBUJA RED SOCIAL */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estilo de Contenido</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
              {['Noticia', 'Devocional', 'Oración', 'Urgente'].map(t => (
                <button 
                  key={t} onClick={() => { setType(t); if(t !== 'Devocional') setMood(''); }}
                  className={`px-5 py-3 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all shrink-0 border shadow-sm ${
                    type === t 
                      ? 'bg-slate-950 text-white border-slate-950 scale-105 shadow-slate-950/20' 
                      : 'bg-slate-50/50 text-slate-400 border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  {t === 'Oración' && <HandHeart size={11} className="inline mr-1 text-purple-500" />}
                  {t === 'Urgente' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping mr-1"></span>}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* CONTROL DE VISIBILIDAD */}
          <div className="space-y-2 bg-slate-50/40 p-4 rounded-3xl border border-slate-100/50">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Eye size={12} className="text-slate-400"/> Destinatarios del Mensaje</label>
             <div className="flex gap-2">
                <button 
                  onClick={() => setVisibility('publico')}
                  className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all border flex items-center justify-center gap-2 shadow-sm ${visibility === 'publico' ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20 scale-[1.01]' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  <Globe size={12}/> Toda la Iglesia
                </button>
                <button 
                  onClick={() => setVisibility('servidores')}
                  className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all border flex items-center justify-center gap-2 shadow-sm ${visibility === 'servidores' ? 'bg-amber-500 border-amber-500 text-white shadow-amber-500/20 scale-[1.01]' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  <Lock size={12}/> Servidores
                </button>
             </div>
          </div>

          {/* ENTRADAS PRINCIPALES */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Encabezado Principal</label>
              <input 
                type="text" placeholder="Escribe un título llamativo..." value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 bg-slate-50/60 rounded-2xl border-2 border-slate-50 font-bold text-slate-800 focus:outline-none focus:border-slate-900 focus:bg-white transition-all uppercase text-xs tracking-tight shadow-inner"
              />
            </div>

            {/* SECCIÓN ESPECIAL DE DEVOCIONALES */}
            {type === 'Devocional' && (
              <div className="space-y-4 animate-fade-in">
                 <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 rounded-[30px] border border-indigo-100/40 shadow-inner text-left">
                    <p className="text-[9px] font-black text-indigo-600 uppercase mb-3 ml-1 flex items-center gap-2"><Layers size={12}/> Vincular a una Serie Activa</p>
                    <input 
                      list="series-suggestions"
                      placeholder="Ej: El Sermón del Monte o Serie Nueva"
                      className="w-full p-3.5 bg-white border border-indigo-100/70 rounded-xl text-xs font-bold outline-none shadow-sm focus:border-indigo-500 transition-colors"
                      value={seriesName} 
                      onChange={e => setSeriesName(e.target.value)}
                    />
                    <datalist id="series-suggestions">
                      {existingSeries.map((s, idx) => (
                        <option key={idx} value={s} />
                      ))}
                    </datalist>
                 </div>
                 
                 <div className="p-5 bg-slate-50/70 rounded-[30px] border border-slate-100/80">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-3 ml-1 text-left">Estado Espiritual / Enfoque</p>
                    <div className="grid grid-cols-4 gap-2">
                       {MOOD_OPTIONS.map(m => (
                         <button 
                           key={m.id} onClick={() => setMood(m.id)}
                           className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${mood === m.id ? 'border-slate-950 bg-white shadow-md scale-105 text-slate-950' : 'border-slate-100 opacity-30 grayscale bg-white/40'}`}
                         >
                           <div className={`p-2 rounded-xl ${m.bg}`}><m.icon size={18} className={m.color} /></div>
                           <span className="text-[7.5px] font-black uppercase tracking-tighter">{m.id}</span>
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mensaje / Cuerpo del Post</label>
              <textarea
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder={type === 'Devocional' ? "Desarrolla la palabra inspirada por Dios hoy..." : type === 'Oración' ? "Describe detalladamente la causa del clamor..." : "Escribe las novedades de la congregación aquí..."}
                className="w-full h-44 p-4 bg-slate-50/60 rounded-3xl border-2 border-slate-50 focus:outline-none focus:border-slate-900 focus:bg-white resize-none text-sm font-medium text-slate-700 leading-relaxed shadow-inner transition-all"
              />
            </div>

            {/* INTERRUPTOR ARCHIVAR */}
            <button 
                onClick={() => setIsArchived(!isArchived)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isArchived ? 'bg-amber-500/10 border-amber-500/20 text-amber-800' : 'bg-slate-50/40 border-slate-100 text-slate-400'}`}
            >
                <div className="flex items-center gap-2.5">
                    <Archive size={16} className={isArchived ? 'text-amber-600' : 'text-slate-400'}/>
                    <span className="text-[10px] font-black uppercase tracking-widest">Ocultar y Archivar Post</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-all duration-300 ${isArchived ? 'bg-amber-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${isArchived ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
            </button>

            {/* ENCUESTAS DINÁMICAS */}
            {type !== 'Oración' && !postToEdit && (
              <button 
                onClick={() => setShowPoll(!showPoll)} 
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${showPoll ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
              >
                <BarChart2 size={14} /> {showPoll ? 'Eliminar Encuesta' : 'Añadir Encuesta'}
              </button>
            )}

            {showPoll && (
              <div className="bg-slate-50/60 p-5 rounded-[30px] border border-slate-100 space-y-2.5 animate-slide-up text-left">
                <p className="text-[8px] font-black text-slate-400 uppercase ml-1">Opciones de votación</p>
                {pollOptions.map((opt, idx) => (
                  <input 
                    key={idx} type="text" placeholder={`Opción de respuesta ${idx + 1}`} value={opt} onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[idx] = e.target.value;
                        setPollOptions(newOptions);
                    }}
                    className="w-full p-3 bg-white rounded-xl border border-slate-100 text-xs font-bold uppercase outline-none shadow-sm focus:border-slate-400 transition-colors"
                  />
                ))}
                {pollOptions.length < 5 && (
                  <button onClick={() => setPollOptions([...pollOptions, ''])} className="w-full py-2.5 border border-dashed border-slate-200 rounded-xl text-[8px] text-slate-400 font-black uppercase tracking-widest hover:bg-white transition-colors">+ Añadir Alternativa</button>
                )}
              </div>
            )}

            {/* ENLACES EXTERNOS COMPONENT */}
            <div className="p-4 bg-slate-50/40 rounded-3xl border border-slate-100 space-y-3">
              <p className="text-[8px] font-black text-slate-400 uppercase ml-1 flex items-center gap-1"><LinkIcon size={10}/> Tarjeta de Enlace Externo</p>
              <div className="flex gap-2 text-left">
                <input type="text" placeholder="https://dirección-web-link" value={link} onChange={e => setLink(e.target.value)} className="flex-1 p-3 bg-white rounded-xl border border-slate-100 text-[10px] outline-none font-bold text-brand-600 shadow-sm focus:border-slate-300" />
                <input type="text" placeholder="Botón" value={linkText} onChange={e => setLinkText(e.target.value)} className="w-1/3 p-3 bg-white rounded-xl border border-slate-100 text-[10px] outline-none font-black uppercase shadow-sm text-center focus:border-slate-300" />
              </div>
            </div>

            {/* PREVIEW DE FOTO SOCIAL */}
            {preview && (
              <div className="relative rounded-3xl overflow-hidden border-[3px] border-slate-100 shadow-xl animate-scale-in">
                <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
                <button onClick={() => { setImage(null); setPreview(null); }} className="absolute top-3 right-3 bg-slate-900/90 text-white p-2.5 rounded-full backdrop-blur-md active:scale-75 transition-all border border-white/10 shadow-lg">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ACCIONES DEL FOOTER FLOTANTE */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/80 backdrop-blur-md border-t border-slate-50 flex gap-3 shrink-0 rounded-t-3xl shadow-xl z-30">
          <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 p-4 rounded-xl text-slate-600 cursor-pointer active:scale-95 transition-all border border-slate-200/50 shadow-sm">
            {loading ? <Loader2 size={16} className="animate-spin text-slate-600" /> : <ImageIcon size={16} className="text-slate-500" />}
            <span className="text-[10px] font-black uppercase tracking-widest">Multimedia</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={loading} />
          </label>

          <button 
            onClick={handleSubmit} 
            disabled={loading || (!text && !image && !preview && !title)} 
            className="flex-[2] bg-slate-950 text-white p-4 rounded-xl font-black text-[11px] uppercase tracking-[0.25em] shadow-lg shadow-slate-950/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-30"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />} 
            {postToEdit ? 'Guardar Cambios' : 'Lanzar Alerta'}
          </button>
        </div>
      </div>
    </div>
  );
}