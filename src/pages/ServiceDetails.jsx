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
  ChevronLeft, Loader2, Users, 
  Send, MessageSquare, Eye, Image as ImageIcon,
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

  // 2. CHAT Y LECTURA
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

  // 3. FUNCIONES
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) { setSelectedFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Nota-${event.title}.jpg`;
      link.click();
    } catch (e) { alert("Error"); }
  };

  const sendChatNotification = async (text, hasImage, hasChecklist) => {
    try {
      let tokens = [];
      const assigned = Object.values(event.assignments || {}).flat();
      if (userRole === 'pastor') {
        allUsers.forEach(u => { if (assigned.includes(u.displayName) && u.fcmTokens) tokens.push(...u.fcmTokens); });
      } else {
        allUsers.forEach(u => { if (u.role === 'pastor' && u.fcmTokens) tokens.push(...u.fcmTokens); });
      }
      const unique = [...new Set(tokens)].filter(t => t?.length > 10);
      if (unique.length === 0) return;

      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: userRole === 'pastor' ? `Nota: ${event.title}` : `${currentUser.displayName} en ${event.title}`,
          body: hasImage ? "📷 Imagen" : hasChecklist ? "📋 Tareas" : text,
          tokens: unique, url: `/servicios/${id}`
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
        const compressed = await imageCompression(selectedFile, { maxSizeMB: 0.8 });
        const formData = new FormData();
        formData.append("file", compressed);
        formData.append("upload_preset", UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const data = await res.json();
        imageUrl = data.secure_url;
      }
      let checklist = null;
      if (showChecklistCreator) {
        const tasks = tempTasks.filter(t => t.trim() !== '');
        if (tasks.length > 0) checklist = tasks.map(t => ({ text: t, completed: false }));
      }
      const txt = newMessage;
      await addDoc(collection(db, `events/${id}/notes`), {
        text: txt, image: imageUrl, checklist: checklist,
        sender: currentUser.displayName, uid: currentUser.uid,
        createdAt: serverTimestamp(), readBy: [currentUser.uid], isPinned: false
      });
      sendChatNotification(txt, !!imageUrl, !!checklist);
      setNewMessage(''); setSelectedFile(null); setImagePreview(null);
      setShowChecklistCreator(false); setTempTasks(['']);
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  const togglePin = async (msgId, currentState) => {
    if (userRole !== 'pastor') return;
    messages.forEach(async (m) => { if (m.isPinned) await updateDoc(doc(db, `events/${id}/notes`, m.id), { isPinned: false }); });
    await updateDoc(doc(db, `events/${id}/notes`, msgId), { isPinned: !currentState });
  };

  const toggleChecklistTask = async (msgId, taskIdx) => {
    const msg = messages.find(m => m.id === msgId);
    const newChecklist = [...msg.checklist];
    newChecklist[taskIdx].completed = !newChecklist[taskIdx].completed;
    await updateDoc(doc(db, `events/${id}/notes`, msgId), { checklist: newChecklist });
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];
  const pinnedMessage = messages.find(m => m.isPinned);

  const MessageContent = ({ m, isPinnedView = false }) => {
    const isMyMessage = m.uid === currentUser.uid;
    return (
      <div className={`${isPinnedView ? '' : 'p-1 rounded-[22px] shadow-sm relative group'} ${!isPinnedView && (isMyMessage ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40')}`}>
        {m.image && <img src={m.image} onClick={() => setViewingImage(m.image)} className={`${isPinnedView ? 'w-12 h-12 rounded-lg' : 'w-full h-auto rounded-[18px]'} object-cover`} />}
        {m.checklist && (
          <div className="p-3 space-y-1">
            {m.checklist.map((task, i) => (
              <button key={i} onClick={() => toggleChecklistTask(m.id, i)} className="flex items-center gap-2 w-full text-left">
                {task.completed ? <CheckSquare size={16} className={isPinnedView ? "text-white/60" : "text-white"}/> : <Square size={16} className="opacity-40"/>}
                <span className={`text-xs font-bold ${task.completed ? 'opacity-40 line-through' : ''}`}>{task.text}</span>
              </button>
            ))}
          </div>
        )}
        {m.text && <p className={`font-semibold leading-snug px-4 py-2 ${isPinnedView ? 'text-xs truncate' : 'text-sm'}`}>{m.text}</p>}
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden animate-fade-in">
      
      {/* 🚀 1. CABECERA INTEGRADA FIJA */}
      <header className="bg-slate-900 text-white pt-10 pb-4 px-5 rounded-b-[40px] shadow-xl z-50 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/servicios')} className="p-2 bg-white/10 rounded-full"><ChevronLeft size={22} /></button>
          <div className="text-center">
            <h1 className="text-xl font-black">{event.title}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(event.date + 'T00:00:00'), "d MMMM", { locale: es })} • {event.time} hs</p>
          </div>
          <div className="w-10"></div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="bg-brand-500/20 p-2 rounded-xl text-brand-400"><Users size={18} /></div>
              <div><p className="text-[8px] font-black text-white/40 uppercase">Tu función</p><p className="text-sm font-bold text-white capitalize">{myRole?.replace(/_/g, ' ')}</p></div>
           </div>
           <button onClick={() => navigate(`/calendario/${id}`)} className="text-[9px] font-black bg-brand-600 px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg active:scale-95 transition-all">EQUIPO <ExternalLink size={10}/></button>
        </div>
      </header>

      {/* 💬 2. CUERPO DE CHAT (UNICO SCROLLABLE) */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        
        {/* Título de notas fijo abajo del header */}
        <div className="bg-slate-50/95 backdrop-blur-md z-40 border-b border-slate-200">
            <div className="p-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={14} className="text-brand-500"/> Notas de Equipo</h3>
              <button onClick={() => setHideReceipts(!hideReceipts)} className="p-1.5 text-slate-400">{hideReceipts ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            </div>
            {pinnedMessage && (
              <div className="bg-brand-600 text-white p-3 shadow-lg flex items-center gap-3 animate-slide-down">
                <Pin size={16} className="opacity-60"/><div className="flex-1 overflow-hidden"><MessageContent m={pinnedMessage} isPinnedView={true} /></div>
                {userRole === 'pastor' && <button onClick={() => togglePin(pinnedMessage.id, true)} className="p-1"><X size={16}/></button>}
              </div>
            )}
        </div>

        {/* Scroll real de mensajes */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {messages.map((m) => {
              const isMy = m.uid === currentUser.uid;
              const readers = allUsers.filter(u => m.readBy?.includes(u.id) && u.id !== m.uid).map(u => u.displayName?.split(' ')[0]);
              return (
                <div key={m.id} className={`flex flex-col ${isMy ? 'items-end' : 'items-start'}`}>
                    <div className="relative group max-w-[85%]">
                      <MessageContent m={m} />
                      <div className={`absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 ${isMy ? '-left-14' : '-right-14'}`}>
                         {(userRole === 'pastor' || isMy) && <button onClick={() => deleteMessage(m.id)} className="p-1.5 bg-red-50 text-red-500 rounded-full shadow-sm"><Trash2 size={12}/></button>}
                         {userRole === 'pastor' && <button onClick={() => togglePin(m.id, m.isPinned)} className={`p-1.5 rounded-full ${m.isPinned ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}><Pin size={12}/></button>}
                      </div>
                    </div>
                    <div className={`flex flex-col mt-1 px-1 ${isMy ? 'items-end' : 'items-start'}`}>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.sender?.split(' ')[0]}</span>
                      {!hideReceipts && readers.length > 0 && <button onClick={() => setShowReadersId(m.id)} className="text-[7px] font-bold text-slate-300 mt-0.5 flex items-center gap-1"><Eye size={8} /> Visto por {readers.length}</button>}
                    </div>
                </div>
              );
          })}
          <div ref={scrollRef} />
        </div>
      </main>

      {/* 🛠 3. BARRA DE HERRAMIENTAS FIJA INFERIOR */}
      <footer className="bg-white border-t border-slate-100 p-4 pb-8 z-50 flex-shrink-0">
        {imagePreview && (
          <div className="relative inline-block mb-3 animate-scale-in">
            <img src={imagePreview} className="w-16 h-16 object-cover rounded-xl border-2 border-white shadow-lg" />
            <button onClick={() => { setSelectedFile(null); setImagePreview(null); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1 rounded-full"><X size={10}/></button>
          </div>
        )}
        {showChecklistCreator && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 space-y-2">
            <div className="flex justify-between items-center"><span className="text-[9px] font-black text-slate-500 uppercase">Nueva Lista</span><button onClick={() => setShowChecklistCreator(false)}><X size={12}/></button></div>
            {tempTasks.map((t, i) => (
              <input key={i} type="text" value={t} onChange={(e) => {
                const newT = [...tempTasks]; newT[i] = e.target.value; 
                if (i === tempTasks.length - 1 && e.target.value !== '') newT.push('');
                setTempTasks(newT);
              }} placeholder="Tarea..." className="w-full text-xs p-1 bg-transparent outline-none border-b border-slate-200 focus:border-brand-500 font-bold" />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex gap-1.5">
            <label className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 cursor-pointer active:scale-90 transition-transform"><ImageIcon size={18}/><input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} /></label>
            <button onClick={() => setShowChecklistCreator(!showChecklistCreator)} className={`p-3 border rounded-xl active:scale-90 transition-transform ${showChecklistCreator ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}><ListPlus size={18}/></button>
          </div>
          <textarea ref={textareaRef} rows="1" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribir..." className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 outline-none resize-none max-h-32 shadow-inner" />
          <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !selectedFile && !showChecklistCreator)} className="bg-brand-600 text-white p-3.5 rounded-xl shadow-lg active:scale-90 disabled:opacity-50">{isSending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}</button>
        </div>
      </footer>

      {/* MODALES: IMAGEN Y LECTORES */}
      {viewingImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
          <div className="absolute top-8 right-6 flex gap-4"><button onClick={(e) => { e.stopPropagation(); handleDownload(viewingImage); }} className="p-3 bg-white/10 rounded-full text-white"><Download size={22}/></button><button onClick={() => setViewingImage(null)} className="p-3 bg-white/10 rounded-full text-white"><X size={22}/></button></div>
          <img src={viewingImage} className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
      {showReadersId && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowReadersId(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b"><h4 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Visto por</h4><button onClick={() => setShowReadersId(null)}><X size={16}/></button></div>
            <div className="space-y-3 max-h-60 overflow-y-auto">{allUsers.filter(u => messages.find(m => m.id === showReadersId)?.readBy?.includes(u.id) && u.id !== messages.find(m => m.id === showReadersId)?.uid).map(u => (
                <div key={u.id} className="flex items-center gap-3"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-7 h-7 rounded-full" /><span className="text-xs font-bold text-slate-600">{u.displayName}</span></div>
            ))}</div>
          </div>
        </div>
      )}
    </div>
  );
}