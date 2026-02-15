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
  
  // Estado para Encuestas
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']); 

  // TUS DATOS DE CLOUDINARY
  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  // EFECTO: Si llega un post para editar, rellenamos los campos
  useEffect(() => {
    if (postToEdit) {
      setText(postToEdit.content || '');
      setTitle(postToEdit.title || '');
      setLink(postToEdit.link || '');
      setLinkText(postToEdit.linkText || '');
      setTagInput(postToEdit.tags ? postToEdit.tags.join(', ') : '');
      setType(postToEdit.type || 'Noticia');
      setPreview(postToEdit.image || null);
      // Nota: Las encuestas no las editamos para no romper los votos ya hechos, así que ocultamos el panel
      setShowPoll(false);
    } else {
      // Si es nuevo, limpiar todo
      resetForm();
    }
  }, [postToEdit, isOpen]);

  const resetForm = () => {
    setText(''); setTitle(''); setLink(''); setLinkText(''); setTagInput('');
    setImage(null); setPreview(null); setShowPoll(false); setPollOptions(['', '']);
  };

  if (!isOpen) return null;

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
    try {
      const compressedFile = await imageCompression(file, options);
      setImage(compressedFile);
      setPreview(URL.createObjectURL(compressedFile));
    } catch (error) { console.log(error); }
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
    // Validación básica: que haya algo escrito o una imagen
    if (!text.trim() && !image && !preview && !title.trim()) return;
    setLoading(true);

    try {
      let imageUrl = postToEdit ? postToEdit.image : null; // Mantener imagen anterior si no se cambia

      // Si hay NUEVA imagen seleccionada, subirla a Cloudinary
      if (image) {
        const formData = new FormData();
        formData.append("file", image);
        formData.append("upload_preset", UPLOAD_PRESET); 
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const data = await response.json();
        if (data.secure_url) imageUrl = data.secure_url; 
      }

      // Datos comunes para crear o editar
      const commonData = {
        content: text,
        title: title, 
        link: link,   
        linkText: linkText || 'Ver más', 
        tags: tagInput ? tagInput.split(',').map(tag => tag.trim()) : [], 
        image: imageUrl, 
        type: type,
      };

      if (postToEdit) {
        // --- MODO EDICIÓN ---
        const postRef = doc(db, 'posts', postToEdit.id);
        await updateDoc(postRef, {
          ...commonData,
          updatedAt: serverTimestamp() // Marca de edición
        });
      } else {
        // --- MODO CREACIÓN ---
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

        await addDoc(collection(db, 'posts'), {
          ...commonData,
          authorId: auth.currentUser.uid,
          authorName: auth.currentUser.displayName,
          authorPhoto: auth.currentUser.photoURL,
          role: 'Pastor / Equipo', 
          poll: finalPoll,
          isPinned: false, // Por defecto no fijado al crear
          createdAt: serverTimestamp(),
          likes: [],
          commentsCount: 0
        });
      }

      // Finalizar
      resetForm();
      setLoading(false);
      onClose();

    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
      alert('Error al guardar. Revisa tu conexión.');
    }
  };

  return (
    // Z-INDEX 60 para estar ENCIMA del menú inferior.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow-2xl animate-slide-up relative max-h-[85vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-lg">
            {postToEdit ? 'Editar Publicación' : 'Crear Publicación'}
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 pr-1">
          {/* Selector de Tipo */}
          <div className="flex gap-2 mb-4">
            {['Noticia', 'Devocional', 'Urgente'].map(t => (
              <button 
                key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors ${
                  type === t ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {type === 'Devocional' && (
            <input 
              type="text" placeholder="Título del Devocional (Portada)" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 mb-3 font-bold text-slate-800 focus:outline-none focus:border-brand-500"
            />
          )}

          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={type === 'Devocional' ? "Escribe la reflexión completa..." : "¿Qué quieres compartir?"}
            className="w-full h-24 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 resize-none text-sm mb-3"
          />

          {/* Sección Encuesta (Solo visible al crear, no editar) */}
          {!postToEdit && showPoll && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 animate-fade-in">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Encuesta</span>
                <button onClick={() => setShowPoll(false)} className="text-red-400 hover:text-red-500"><Trash2 size={14}/></button>
              </div>
              {pollOptions.map((opt, idx) => (
                <input 
                  key={idx} type="text" placeholder={`Opción ${idx + 1}`} value={opt} onChange={(e) => handlePollChange(idx, e.target.value)}
                  className="w-full p-2 bg-white rounded-lg border border-slate-200 text-xs mb-2 focus:border-brand-500 outline-none"
                />
              ))}
              {pollOptions.length < 4 && (
                <button onClick={handleAddPollOption} className="text-xs text-brand-600 font-bold flex items-center gap-1 hover:underline">
                  <Plus size={14}/> Agregar opción
                </button>
              )}
            </div>
          )}

          {/* Links y Tags */}
          <div className="space-y-2 mb-3">
             <div className="flex gap-2">
               <div className="relative flex-1">
                  <LinkIcon size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input type="text" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} className="w-full pl-8 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs focus:outline-none" />
               </div>
               <input type="text" placeholder="Texto Botón" value={linkText} onChange={e => setLinkText(e.target.value)} className="w-1/3 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs focus:outline-none" />
             </div>
             <div className="relative">
                <Tag size={14} className="absolute left-3 top-3 text-slate-400" />
                <input type="text" placeholder="Etiquetas (ej: Fe, Jóvenes)" value={tagInput} onChange={e => setTagInput(e.target.value)} className="w-full pl-8 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs focus:outline-none" />
             </div>
          </div>

          {preview && (
            <div className="relative mb-4 rounded-xl overflow-hidden max-h-40 border border-slate-200">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              <button onClick={() => { setImage(null); setPreview(null); }} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><X size={16} /></button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-3 mt-auto border-t border-slate-100">
          <div className="flex gap-2">
            <label className="text-brand-600 p-2 hover:bg-brand-50 rounded-lg cursor-pointer"><ImageIcon size={20} /><input type="file" accept="image/*" className="hidden" onChange={handleImageChange} /></label>
            {/* Solo mostramos botón de encuesta si NO estamos editando */}
            {!postToEdit && (
              <button onClick={() => setShowPoll(!showPoll)} className={`p-2 rounded-lg ${showPoll ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:bg-slate-50'}`}><BarChart2 size={20} /></button>
            )}
          </div>

          <button 
            onClick={handleSubmit} 
            disabled={loading || (!text && !image && !preview && !title)} 
            className="bg-brand-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-md flex items-center gap-2 disabled:opacity-50 hover:bg-brand-700"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (postToEdit ? <Save size={18}/> : <Send size={18} />)} 
            {postToEdit ? 'Guardar' : 'Publicar'}
          </button>
        </div>

      </div>
    </div>
  );
}