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
  Pin, X, EyeOff, Trash2, ListPlus, Square, CheckSquare, Download, Maximize2
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
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [viewingImage, setViewingImage] = useState(null); 
  
  const [showChecklistCreator, setShowChecklistCreator] = useState(false);
  const [tempTasks, setTempTasks] = useState(['']);

  const [showReadersId, setShowReadersId] = useState(null);
  const [hideReceipts, setHideReceipts] = useState(false);
  
  const scrollRef = useRef();
  const textareaRef = useRef(); 
  const currentUser = auth.currentUser;

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default";

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

  useEffect(() => {
    const q = query(collection(db, `events/${id}/notes`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      msgs.forEach(async (m) => {
        if (!m.readBy?.includes(currentUser.uid)) {
          await updateDoc(doc(db, `events/${id}/notes`, m.id), { readBy: arrayUnion(currentUser.uid) });
        }
      });
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [id, currentUser.uid]);

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
      link.download = `Referencia-${event.title}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { alert("Error al descargar"); }
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
      await addDoc(collection(db, `events/${id}/notes`), {
        text: newMessage, image: imageUrl, checklist: checklist,
        sender: currentUser.displayName, uid: currentUser.uid,
        createdAt: serverTimestamp(), readBy: [currentUser.uid], isPinned: false
      });
      setNewMessage(''); setSelectedFile(null); setImagePreview(null);
      setShowChecklistCreator(false); setTempTasks(['']);
    } catch (e) { alert("Error al enviar"); } finally { setIsSending(false); }
  };

  const deleteMessage = async (msgId) => {
    if (window.confirm("¿Eliminar este mensaje?")) await deleteDoc(doc(db, `events/${id}/notes`, msgId));
  };

  const togglePin = async (msgId, currentState) => {
    if (userRole !== 'pastor') return;
    // Limpiar pines anteriores
    for (const m of messages) {
      if (m.isPinned && m.id !== msgId) await updateDoc(doc(db, `events/${id}/notes`, m.id), { isPinned: false });
    }
    await updateDoc(doc(db, `events/${id}/notes`, msgId), { isPinned: !currentState });
  };

  const toggleChecklistTask = async (msgId, taskIdx) => {
    const msg = messages.find(m => m.id === msgId);
    const newChecklist = [...msg.checklist];
    newChecklist[taskIdx].completed = !newChecklist[taskIdx].completed;
    await updateDoc(doc(db, `events/${id}/notes`, msgId), { checklist: newChecklist });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];
  const pinnedMessage = messages.find(m => m.isPinned);

  // Sub-componente para renderizar el contenido del mensaje (se usa en chat y pin)
  const MessageContent = ({ m, isPinnedView = false }) => {
    const isMyMessage = m.uid === currentUser.uid;
    return (
      <div className={`${isPinnedView ? '' : 'p-1 rounded-[22px] shadow-sm relative group'} ${!isPinnedView && (isMyMessage ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40')}`}>
        {m.image && (
          <div className={`${isPinnedView ? 'w-20 h-20 flex-shrink-0' : 'w-full'} relative cursor-zoom-in`} onClick={() => setViewingImage(m.image)}>
            <img src={m.image} className={`${isPinnedView ? 'w-full h-full object-cover rounded-xl' : 'w-full h-auto rounded-[18px]'}`} alt="Adjunto" />
            {!isPinnedView && <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[18px]"><Maximize2 className="text-white" size={24}/></div>}
          </div>
        )}
        {m.checklist && (
          <div className={`${isPinnedView ? 'mt-1' : 'p-4'} space-y-2`}>
            {m.checklist.map((task, tidx) => (
              <button key={tidx} onClick={() => toggleChecklistTask(m.id, tidx)} className="flex items-center gap-3 w-full text-left">
                {task.completed ? <CheckSquare size={isPinnedView ? 14 : 18} className={isPinnedView ? "text-white/80" : (isMyMessage ? "text-white" : "text-brand-600")}/> : <Square size={isPinnedView ? 14 : 18} className="opacity-40"/>}
                <span className={`${isPinnedView ? 'text-xs' : 'text-sm'} font-bold ${task.completed ? 'opacity-40 line-through' : ''}`}>{task.text}</span>
              </button>
            ))}
          </div>
        )}
        {m.text && <p className={`font-semibold leading-relaxed whitespace-pre-wrap ${isPinnedView ? 'text-sm line-clamp-2' : 'px-4 py-3 text-sm'}`}>{m.text}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="bg-slate-900 text-white pt-20 pb-28 px-6 rounded-b-[50px] shadow-lg relative flex-shrink-0 z-30">
        <button onClick={() => navigate('/servicios')} className="absolute top-10 left-6 p-2 bg-white/10 rounded-full text-white"><ChevronLeft size={26} /></button>
        <div className="mt-2 text-center">
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-400 opacity-80">Panel de Servicio</span>
          <h1 className="text-4xl font-black mt-2 leading-tight">{event.title}</h1>
          <div className="flex justify-center gap-4 mt-4 text-slate-400">
             <span className="text-[11px] font-bold bg-white/5 px-3 py-1.5 rounded-full border border-white/5">{format(new Date(event.date + 'T00:00:00'), "d 'de' MMMM", { locale: es })}</span>
             <span className="text-[11px] font-bold bg-white/5 px-3 py-1.5 rounded-full border border-white/5">{event.time} hs</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-5 -mt-14 space-y-6 flex-1 overflow-y-auto pb-10 z-20">
        {/* CARD FUNCIÓN */}
        <div className="bg-white rounded-[35px] p-7 shadow-2xl border border-slate-100/50">
          <div className="flex items-center gap-5 mb-6"><div className="bg-brand-50 p-4 rounded-3xl text-brand-600 flex-shrink-0"><Users size={28} /></div><div className="flex-1 min-w-0"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu función hoy</p><p className="text-2xl font-black text-slate-800 capitalize leading-tight">{myRole?.replace(/_/g, ' ')}</p></div></div>
          {!myStatus ? (<div className="flex gap-3"><button onClick={() => handleResponse('confirmed')} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg uppercase">Confirmar ✓</button><button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-50 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase">No puedo</button></div>) : (<div className={`p-5 rounded-2xl flex items-center justify-between border ${myStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}><span className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">{myStatus === 'confirmed' ? <CheckCircle size={20}/> : <XCircle size={20}/>} {myStatus === 'confirmed' ? 'LISTO PARA SERVIR' : 'AUSENCIA NOTIFICADA'}</span><button onClick={() => handleResponse(null)} className="text-[10px] font-black uppercase underline decoration-2 underline-offset-4">Cambiar</button></div>)}
        </div>

        {/* 💬 MURO DE NOTAS */}
        <div className="bg-white rounded-[35px] shadow-xl border border-slate-100 flex flex-col min-h-[550px] max-h-[700px] overflow-hidden">
          <div className="flex flex-col flex-shrink-0 sticky top-0 z-40 bg-white">
            <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/40">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><MessageSquare size={16} className="text-brand-500"/> Notas de Equipo</h3>
              <button onClick={() => setHideReceipts(!hideReceipts)} className="p-2 text-slate-400 hover:text-slate-600">{hideReceipts ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            </div>
            
            {/* ✅ PINNED STICKY UNIVERSAL */}
            {pinnedMessage && (
              <div className="bg-brand-600 text-white p-4 shadow-lg flex items-start gap-4 animate-slide-down">
                <Pin size={20} className="flex-shrink-0 mt-1 opacity-60"/>
                <div className="flex-1 flex gap-3 overflow-hidden">
                   <MessageContent m={pinnedMessage} isPinnedView={true} />
                </div>
                {userRole === 'pastor' && <button onClick={() => togglePin(pinnedMessage.id, true)} className="p-1 hover:bg-white/10 rounded-full"><X size={18}/></button>}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {messages.map((m) => {
                const readers = allUsers.filter(u => m.readBy?.includes(u.id) && u.id !== m.uid).map(u => u.displayName?.split(' ')[0]);
                const isMyMessage = m.uid === currentUser.uid;
                return (
                  <div key={m.id} className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                      <div className="relative group max-w-[90%] flex flex-col items-end">
                        <MessageContent m={m} isPinnedView={false} />
                        <div className={`absolute top-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isMyMessage ? '-left-16' : '-right-16'}`}>
                           {(userRole === 'pastor' || isMyMessage) && <button onClick={() => deleteMessage(m.id)} className="p-2 bg-red-50 text-red-500 rounded-full shadow-sm"><Trash2 size={14}/></button>}
                           {userRole === 'pastor' && <button onClick={() => togglePin(m.id, m.isPinned)} className={`p-2 rounded-full shadow-sm ${m.isPinned ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}><Pin size={14}/></button>}
                        </div>
                      </div>
                      <div className={`flex flex-col mt-2 px-1 ${isMyMessage ? 'items-end' : 'items-start'}`}>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-80">{m.sender?.split(' ')[0]}</span>
                        {!hideReceipts && readers.length > 0 && (
                          <button onClick={() => setShowReadersId(m.id)} className="flex items-center gap-1 text-[8px] font-bold text-slate-300 mt-1 hover:text-brand-400"><Eye size={10} /> <span>Visto por {readers.length}</span></button>
                        )}
                      </div>
                  </div>
                );
            })}
            <div ref={scrollRef} />
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            {imagePreview && (
              <div className="relative inline-block mb-3 animate-scale-in">
                <img src={imagePreview} className="w-20 h-20 object-cover rounded-2xl border-2 border-white shadow-lg" alt="Preview" />
                <button onClick={() => { setSelectedFile(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md"><X size={14}/></button>
              </div>
            )}
            {showChecklistCreator && (
              <div className="bg-white border rounded-2xl p-4 mb-3 space-y-2 shadow-inner">
                <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Crear Lista</span><button onClick={() => setShowChecklistCreator(false)}><X size={14}/></button></div>
                {tempTasks.map((task, idx) => (
                  <input key={idx} type="text" value={task} onChange={(e) => {
                    const newT = [...tempTasks]; newT[idx] = e.target.value; 
                    if (idx === tempTasks.length - 1 && e.target.value !== '') newT.push('');
                    setTempTasks(newT);
                  }} placeholder={`Tarea ${idx + 1}...`} className="w-full text-xs font-bold p-1 outline-none border-b border-slate-50" />
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-end gap-3">
              <div className="flex gap-2">
                <label className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-brand-600 transition-colors cursor-pointer shadow-sm"><ImageIcon size={20}/><input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isSending}/></label>
                <button type="button" onClick={() => setShowChecklistCreator(!showChecklistCreator)} className={`p-3.5 border rounded-2xl transition-all shadow-sm ${showChecklistCreator ? 'bg-brand-600 text-white' : 'bg-white text-slate-400'}`}><ListPlus size={20}/></button>
              </div>
              <textarea ref={textareaRef} rows="1" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribir nota..." className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 outline-none resize-none max-h-40" />
              <button type="submit" disabled={isSending || (!newMessage.trim() && !selectedFile && !showChecklistCreator)} className="bg-brand-600 text-white p-4 rounded-2xl shadow-xl active:scale-90 flex-shrink-0 disabled:opacity-50">{isSending ? <Loader2 size={22} className="animate-spin"/> : <Send size={22}/>}</button>
            </form>
          </div>
        </div>
      </div>

      {/* MODALES: IMAGEN Y LECTORES */}
      {viewingImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
          <div className="absolute top-8 right-6 flex gap-4"><button onClick={(e) => { e.stopPropagation(); handleDownload(viewingImage); }} className="p-3 bg-white/10 rounded-full text-white"><Download size={24}/></button><button onClick={() => setViewingImage(null)} className="p-3 bg-white/10 rounded-full text-white"><X size={24}/></button></div>
          <img src={viewingImage} className="max-w-full max-h-[80vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
      {showReadersId && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowReadersId(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b"><h4 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2"><Eye size={16}/> Leído por</h4><button onClick={() => setShowReadersId(null)} className="p-2 bg-slate-50 rounded-full"><X size={16}/></button></div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {allUsers.filter(u => messages.find(m => m.id === showReadersId)?.readBy?.includes(u.id) && u.id !== messages.find(m => m.id === showReadersId)?.uid).map(u => (
                <div key={u.id} className="flex items-center gap-3"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-8 h-8 rounded-full shadow-sm" /><span className="text-sm font-bold text-slate-600">{u.displayName}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}