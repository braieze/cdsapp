import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, updateDoc, collection, addDoc, 
  query, orderBy, onSnapshot, serverTimestamp, 
  getDocs, arrayUnion, deleteDoc 
} from 'firebase/firestore';
import { 
  Calendar, Clock, CheckCircle, XCircle, 
  ChevronLeft, Loader2, ListChecks, Users, 
  Send, MessageSquare, Info, Eye, Image as ImageIcon,
  Pin, X, EyeOff, Trash2, ListPlus, Square, CheckSquare, Download, Maximize2, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

export default function ServiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  
  // Estados de Archivos y Checklist
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [viewingImage, setViewingImage] = useState(null); 
  const [showChecklistCreator, setShowChecklistCreator] = useState(false);
  const [tempTasks, setTempTasks] = useState(['']);

  // Estados de Interfaz
  const [showReadersId, setShowReadersId] = useState(null);
  const [hideReceipts, setHideReceipts] = useState(false);
  
  const scrollRef = useRef();
  const textareaRef = useRef(); 
  const currentUser = auth.currentUser;

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default";

  // 1. CARGA DE DATOS
  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventSnap = await getDoc(doc(db, 'events', id));
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const usersSnap = await getDocs(collection(db, 'users'));
        
        if (userSnap.exists()) setUserRole(userSnap.data().role);
        setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        if (eventSnap.exists()) setEvent({ id: eventSnap.id, ...eventSnap.data() });
        else navigate('/servicios');
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, navigate, currentUser.uid]);

  // 2. CHAT EN TIEMPO REAL
  useEffect(() => {
    const q = query(collection(db, `events/${id}/notes`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      // Marcado de lectura automático
      msgs.forEach(async (m) => {
        if (!m.readBy?.includes(currentUser.uid)) {
          await updateDoc(doc(db, `events/${id}/notes`, m.id), {
            readBy: arrayUnion(currentUser.uid)
          });
        }
      });

      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [id, currentUser.uid]);

  // ✅ CORRECCIÓN: FUNCIÓN DEFINIDA CORRECTAMENTE PARA EL INPUT
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Nota-${event.title}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { alert("Error al descargar"); }
  };

  // 🔥 LÓGICA DE NOTIFICACIONES REPARADA
  const sendChatNotification = async (text, hasImage, hasChecklist) => {
    try {
      const isSenderPastor = userRole === 'pastor';
      let targetTokens = [];
      const assignedNames = Object.values(event.assignments || {}).flat();

      if (isSenderPastor) {
        allUsers.forEach(u => {
          if (assignedNames.includes(u.displayName) && u.fcmTokens) targetTokens.push(...u.fcmTokens);
        });
      } else {
        allUsers.forEach(u => {
          if (u.role === 'pastor' && u.fcmTokens) targetTokens.push(...u.fcmTokens);
        });
      }

      const uniqueTokens = [...new Set(targetTokens)].filter(t => t && t.length > 10);
      if (uniqueTokens.length === 0) return;

      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: isSenderPastor ? `Nota del Pastor: ${event.title}` : `Mensaje de ${currentUser.displayName}`,
          body: hasImage ? "📷 Imagen enviada" : hasChecklist ? "📋 Lista de tareas" : text,
          tokens: uniqueTokens,
          url: `/servicios/${id}`
        })
      });
    } catch (e) { console.error(e); }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile && !showChecklistCreator) return;
    setIsSending(true);
    try {
      let imageUrl = null;
      if (selectedFile) {
        const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true };
        const compressedFile = await imageCompression(selectedFile, options);
        const formData = new FormData();
        formData.append("file", compressedFile);
        formData.append("upload_preset", UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const data = await res.json();
        imageUrl = data.secure_url;
      }

      let checklist = null;
      if (showChecklistCreator) {
        const validTasks = tempTasks.filter(t => t.trim() !== '');
        if (validTasks.length > 0) checklist = validTasks.map(t => ({ text: t, completed: false }));
      }

      const textToStore = newMessage;
      await addDoc(collection(db, `events/${id}/notes`), {
        text: textToStore, image: imageUrl, checklist: checklist,
        sender: currentUser.displayName, uid: currentUser.uid,
        createdAt: serverTimestamp(), readBy: [currentUser.uid], isPinned: false
      });

      sendChatNotification(textToStore, !!imageUrl, !!checklist);
      setNewMessage(''); setSelectedFile(null); setImagePreview(null);
      setShowChecklistCreator(false); setTempTasks(['']);
    } catch (e) { alert("Error al enviar"); } finally { setIsSending(false); }
  };

  const togglePin = async (msgId, currentState) => {
    if (userRole !== 'pastor') return;
    for (const m of messages) {
      if (m.isPinned) await updateDoc(doc(db, `events/${id}/notes`, m.id), { isPinned: false });
    }
    await updateDoc(doc(db, `events/${id}/notes`, msgId), { isPinned: !currentState });
  };

  const toggleChecklistTask = async (msgId, taskIdx) => {
    const msg = messages.find(m => m.id === msgId);
    const newChecklist = [...msg.checklist];
    newChecklist[taskIdx].completed = !newChecklist[taskIdx].completed;
    await updateDoc(doc(db, `events/${id}/notes`, msgId), { checklist: newChecklist });
  };

  const deleteMessage = async (msgId) => {
    if (window.confirm("¿Eliminar este mensaje?")) await deleteDoc(doc(db, `events/${id}/notes`, msgId));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];
  const pinnedMessage = messages.find(m => m.isPinned);

  // Componente de contenido para evitar repetición
  const MessageContent = ({ m, isPinnedView = false }) => {
    const isMyMessage = m.uid === currentUser.uid;
    return (
      <div className={`${isPinnedView ? '' : 'p-1 rounded-[22px] shadow-sm relative group'} ${!isPinnedView && (isMyMessage ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40')}`}>
        {m.image && (
          <div className={`${isPinnedView ? 'w-16 h-16 flex-shrink-0' : 'w-full'} relative cursor-zoom-in`} onClick={() => setViewingImage(m.image)}>
            <img src={m.image} className={`${isPinnedView ? 'w-full h-full object-cover rounded-lg' : 'w-full h-auto rounded-[18px]'}`} />
          </div>
        )}
        {m.checklist && (
          <div className={`${isPinnedView ? 'mt-1' : 'p-3'} space-y-1.5`}>
            {m.checklist.map((task, tidx) => (
              <button key={tidx} onClick={() => toggleChecklistTask(m.id, tidx)} className="flex items-center gap-2.5 w-full text-left">
                {task.completed ? <CheckSquare size={isPinnedView ? 14 : 16} className={isPinnedView ? "text-white/80" : (isMyMessage ? "text-white" : "text-brand-600")}/> : <Square size={isPinnedView ? 14 : 16} className="opacity-40"/>}
                <span className={`${isPinnedView ? 'text-xs' : 'text-sm'} font-bold ${task.completed ? 'opacity-40 line-through' : ''}`}>{task.text}</span>
              </button>
            ))}
          </div>
        )}
        {m.text && <p className={`font-semibold leading-snug whitespace-pre-wrap ${isPinnedView ? 'text-xs line-clamp-2' : 'px-4 py-2.5 text-sm'}`}>{m.text}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in flex flex-col overflow-hidden">
      
      {/* 🚀 CABECERA COMPACTA: Sin solapamiento */}
      <div className="bg-slate-900 text-white pt-12 pb-4 px-5 rounded-b-[35px] shadow-md relative flex-shrink-0 z-30">
        <button onClick={() => navigate('/servicios')} className="absolute top-10 left-4 p-1.5 bg-white/10 rounded-full text-white"><ChevronLeft size={22} /></button>
        <div className="text-center">
          <h1 className="text-2xl font-black">{event.title}</h1>
          <div className="flex justify-center gap-3 mt-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
             <span>{format(new Date(event.date + 'T00:00:00'), "d MMMM", { locale: es })}</span>
             <span>•</span>
             <span>{event.time} hs</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-4 mt-4 space-y-4 flex-1 overflow-y-auto pb-6 z-20">
        
        {/* CARD FUNCIÓN */}
        <div className="bg-white rounded-[28px] p-5 shadow-lg border border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-brand-50 p-2.5 rounded-xl text-brand-600"><Users size={20} /></div>
                <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Tu función</p>
                    <p className="text-base font-black text-slate-800 capitalize leading-none">{myRole?.replace(/_/g, ' ')}</p>
                </div>
            </div>
            <button onClick={() => navigate(`/calendario/${id}`)} className="text-[10px] font-black text-brand-600 flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-full active:scale-95 transition-all">
                EQUIPO <ExternalLink size={12}/>
            </button>
          </div>
          {!myStatus ? (
            <div className="flex gap-2"><button onClick={() => handleResponse('confirmed')} className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-black text-[10px] shadow-md uppercase">Confirmar ✓</button><button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-50 text-slate-400 py-3 rounded-xl font-black text-[10px] uppercase">No puedo</button></div>
          ) : (
            <div className={`p-3.5 rounded-xl flex items-center justify-between border ${myStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}><span className="text-[11px] font-black flex items-center gap-2 uppercase tracking-tight">{myStatus === 'confirmed' ? <CheckCircle size={16}/> : <XCircle size={16}/>} {myStatus === 'confirmed' ? 'LISTO' : 'BAJA'}</span><button onClick={() => handleResponse(null)} className="text-[9px] font-black uppercase underline">Cambiar</button></div>
          )}
        </div>

        {/* 💬 MURO DE NOTAS EXPANDIDO */}
        <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 flex flex-col flex-1 min-h-[450px] overflow-hidden relative mb-4">
          <div className="flex flex-col flex-shrink-0 sticky top-0 z-40 bg-white/95 backdrop-blur-md">
            <div className="p-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><MessageSquare size={14} className="text-brand-500"/> Notas de Equipo</h3>
              <button onClick={() => setHideReceipts(!hideReceipts)} className="p-1.5 text-slate-400">{hideReceipts ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            </div>
            {pinnedMessage && (
              <div className="bg-brand-600 text-white p-3.5 shadow-md flex items-start gap-3 animate-slide-down">
                <Pin size={16} className="flex-shrink-0 mt-1 opacity-60"/>
                <div className="flex-1 flex gap-2 overflow-hidden items-center"><MessageContent m={pinnedMessage} isPinnedView={true} /></div>
                {userRole === 'pastor' && <button onClick={() => togglePin(pinnedMessage.id, true)} className="p-1"><X size={16}/></button>}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
            {messages.map((m) => {
                const isMyMessage = m.uid === currentUser.uid;
                const readers = allUsers.filter(u => m.readBy?.includes(u.id) && u.id !== m.uid).map(u => u.displayName?.split(' ')[0]);
                return (
                  <div key={m.id} className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                      <div className="relative group max-w-[90%]">
                        <MessageContent m={m} />
                        <div className={`absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMyMessage ? '-left-14' : '-right-14'}`}>
                           {(userRole === 'pastor' || isMyMessage) && <button onClick={() => deleteMessage(m.id)} className="p-1.5 bg-red-50 text-red-500 rounded-full shadow-sm"><Trash2 size={12}/></button>}
                           {userRole === 'pastor' && <button onClick={() => togglePin(m.id, m.isPinned)} className={`p-1.5 rounded-full ${m.isPinned ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}><Pin size={12}/></button>}
                        </div>
                      </div>
                      <div className={`flex flex-col mt-1 px-1 ${isMyMessage ? 'items-end' : 'items-start'}`}>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.sender?.split(' ')[0]}</span>
                        {!hideReceipts && readers.length > 0 && <button onClick={() => setShowReadersId(m.id)} className="flex items-center gap-1 text-[7px] font-bold text-slate-300 mt-0.5"><Eye size={8} /> Visto por {readers.length}</button>}
                      </div>
                  </div>
                );
            })}
            <div ref={scrollRef} />
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            {imagePreview && (
              <div className="relative inline-block mb-3 animate-scale-in">
                <img src={imagePreview} className="w-16 h-16 object-cover rounded-xl border-2 border-white shadow-md" />
                <button onClick={() => { setSelectedFile(null); setImagePreview(null); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1 rounded-full"><X size={10}/></button>
              </div>
            )}
            {showChecklistCreator && (
              <div className="bg-white border rounded-xl p-3 mb-3 space-y-2">
                <div className="flex justify-between items-center"><span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Nueva Lista</span><button onClick={() => setShowChecklistCreator(false)}><X size={12}/></button></div>
                {tempTasks.map((t, i) => (
                  <input key={i} type="text" value={t} onChange={(e) => {
                    const newT = [...tempTasks]; newT[i] = e.target.value; 
                    if (i === tempTasks.length - 1 && e.target.value !== '') newT.push('');
                    setTempTasks(newT);
                  }} placeholder="Tarea..." className="w-full text-xs p-1 outline-none border-b border-slate-50" />
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <label className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 cursor-pointer shadow-sm active:scale-95 transition-transform">
                <ImageIcon size={18}/>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isSending}/>
              </label>
              <button onClick={() => setShowChecklistCreator(!showChecklistCreator)} className={`p-3 border rounded-xl shadow-sm ${showChecklistCreator ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-400'}`}><ListPlus size={18}/></button>
              <textarea ref={textareaRef} rows="1" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribir..." className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none resize-none max-h-32 shadow-inner" />
              <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !selectedFile && !showChecklistCreator)} className="bg-brand-600 text-white p-3 rounded-xl shadow-lg active:scale-90 disabled:opacity-50 transition-all">{isSending ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}</button>
            </div>
          </div>
        </div>
      </div>

      {/* MODALES: IMAGEN Y LECTORES */}
      {viewingImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
          <div className="absolute top-8 right-6 flex gap-4"><button onClick={(e) => { e.stopPropagation(); handleDownload(viewingImage); }} className="p-3 bg-white/10 rounded-full text-white"><Download size={22}/></button><button onClick={() => setViewingImage(null)} className="p-3 bg-white/10 rounded-full text-white"><X size={22}/></button></div>
          <img src={viewingImage} className="max-w-full max-h-[80vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
      {showReadersId && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowReadersId(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b"><h4 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Visto por</h4><button onClick={() => setShowReadersId(null)}><X size={16}/></button></div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {allUsers.filter(u => messages.find(m => m.id === showReadersId)?.readBy?.includes(u.id) && u.id !== messages.find(m => m.id === showReadersId)?.uid).map(u => (
                <div key={u.id} className="flex items-center gap-3"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-7 h-7 rounded-full shadow-sm" /><span className="text-xs font-bold text-slate-600">{u.displayName}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}