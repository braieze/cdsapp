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
  
  // Archivos y Checklist
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [viewingImage, setViewingImage] = useState(null); 
  const [showChecklistCreator, setShowChecklistCreator] = useState(false);
  const [tempTasks, setTempTasks] = useState(['']);

  // Interfaz
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
        const usersListData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllUsers(usersListData);
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

  // 🔥 NOTIFICACIONES DE CHAT (REPARADO)
  const sendChatNotification = async (text, hasImage, hasChecklist) => {
    try {
      const isSenderPastor = userRole === 'pastor';
      let targetTokens = [];

      if (isSenderPastor) {
        const assignedNames = Object.values(event.assignments || {}).flat();
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

      let bodyText = text;
      if (hasImage) bodyText = "📷 Imagen adjunta";
      if (hasChecklist) bodyText = "📋 Nueva lista de tareas";

      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: isSenderPastor ? `Nota del Pastor: ${event.title}` : `${currentUser.displayName} en ${event.title}`,
          body: bodyText,
          tokens: uniqueTokens,
          url: `/servicios/${id}`
        })
      });
    } catch (e) { console.error("Error en noti:", e); }
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

      const textToSend = newMessage;
      await addDoc(collection(db, `events/${id}/notes`), {
        text: textToSend, image: imageUrl, checklist: checklist,
        sender: currentUser.displayName, uid: currentUser.uid,
        createdAt: serverTimestamp(), readBy: [currentUser.uid], isPinned: false
      });

      sendChatNotification(textToSend, !!imageUrl, !!checklist);
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];
  const pinnedMessage = messages.find(m => m.isPinned);

  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in flex flex-col overflow-hidden">
      {/* 🎨 HEADER: Corregido pt-24 y pb-12 para evitar solapamiento */}
      <div className="bg-slate-900 text-white pt-24 pb-12 px-6 rounded-b-[45px] shadow-lg relative flex-shrink-0 z-30">
        <button onClick={() => navigate('/servicios')} className="absolute top-12 left-6 p-2 bg-white/10 rounded-full text-white"><ChevronLeft size={26} /></button>
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 opacity-80">Panel de Servicio</span>
          <h1 className="text-3xl font-black mt-2 leading-tight break-words">{event.title}</h1>
          <div className="flex justify-center gap-4 mt-4 text-slate-400 text-[11px] font-bold">
             <span>{format(new Date(event.date + 'T00:00:00'), "d 'de' MMMM", { locale: es })}</span>
             <span>•</span>
             <span>{event.time} hs</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-5 mt-6 space-y-6 flex-1 overflow-y-auto pb-10 z-20">
        {/* CARD FUNCIÓN */}
        <div className="bg-white rounded-[32px] p-6 shadow-xl border border-slate-100">
          <div className="flex items-center gap-5 mb-6">
            <div className="bg-brand-50 p-4 rounded-2xl text-brand-600 flex-shrink-0"><Users size={24} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu función</p>
              <p className="text-xl font-black text-slate-800 capitalize">{myRole?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          {!myStatus ? (
            <div className="flex gap-3"><button onClick={() => handleResponse('confirmed')} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg uppercase">Confirmar ✓</button><button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-50 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase">No puedo</button></div>
          ) : (
            <div className={`p-4 rounded-2xl flex items-center justify-between border ${myStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}><span className="text-xs font-black flex items-center gap-2 uppercase tracking-tight">{myStatus === 'confirmed' ? <CheckCircle size={18}/> : <XCircle size={18}/>} {myStatus === 'confirmed' ? 'LISTO PARA SERVIR' : 'AUSENCIA NOTIFICADA'}</span><button onClick={() => handleResponse(null)} className="text-[10px] font-black uppercase underline decoration-2 underline-offset-4">Cambiar</button></div>
          )}
        </div>

        {/* 💬 MURO DE NOTAS */}
        <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 flex flex-col h-[500px] overflow-hidden relative">
          
          {/* HEADER CHAT + STICKY PIN */}
          <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md flex flex-col border-b border-slate-50">
            <div className="p-5 flex items-center justify-between">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><MessageSquare size={16} className="text-brand-500"/> Notas de Equipo</h3>
              <button onClick={() => setHideReceipts(!hideReceipts)} className="p-2 text-slate-400">{hideReceipts ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            </div>
            {pinnedMessage && (
              <div className="bg-brand-600 text-white p-4 shadow-lg flex items-start gap-3 animate-slide-down">
                <Pin size={18} className="flex-shrink-0 mt-1"/>
                <div className="flex-1 overflow-hidden">
                   {pinnedMessage.image && <img src={pinnedMessage.image} className="w-12 h-12 rounded-lg object-cover float-right ml-2 border border-white/20"/>}
                   <p className="text-[10px] font-black uppercase opacity-60">Mensaje Anclado</p>
                   <p className="text-sm font-bold leading-relaxed line-clamp-2">{pinnedMessage.text}</p>
                </div>
                {userRole === 'pastor' && <button onClick={() => togglePin(pinnedMessage.id, true)} className="p-1"><X size={16}/></button>}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white">
            {messages.map((m) => {
                const isMyMessage = m.uid === currentUser.uid;
                const readers = allUsers.filter(u => m.readBy?.includes(u.id) && u.id !== m.uid).map(u => u.displayName?.split(' ')[0]);
                return (
                  <div key={m.id} className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] p-1 rounded-[22px] shadow-sm relative group ${isMyMessage ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40'}`}>
                          {m.image && <img src={m.image} onClick={() => setViewingImage(m.image)} className="w-full h-auto rounded-[18px] cursor-pointer" alt="Adjunto" />}
                          {m.checklist && (
                            <div className="p-4 space-y-2">
                                {m.checklist.map((task, tidx) => (
                                  <button key={tidx} onClick={() => toggleChecklistTask(m.id, tidx)} className="flex items-center gap-3 w-full text-left">
                                     {task.completed ? <CheckSquare size={18} className={isMyMessage ? "text-white" : "text-brand-600"}/> : <Square size={18} className="opacity-40"/>}
                                     <span className={`text-sm font-bold ${task.completed ? 'opacity-40 line-through' : ''}`}>{task.text}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                          {m.text && <p className="font-semibold px-4 py-3 text-sm whitespace-pre-wrap">{m.text}</p>}
                          <div className={`absolute top-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isMyMessage ? '-left-16' : '-right-16'}`}>
                             {(userRole === 'pastor' || isMyMessage) && <button onClick={() => deleteMessage(m.id)} className="p-2 bg-red-50 text-red-500 rounded-full shadow-sm"><Trash2 size={14}/></button>}
                             {userRole === 'pastor' && <button onClick={() => togglePin(m.id, m.isPinned)} className={`p-2 rounded-full ${m.isPinned ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}><Pin size={14}/></button>}
                          </div>
                      </div>
                      <div className={`flex flex-col mt-1 px-1 ${isMyMessage ? 'items-end' : 'items-start'}`}>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.sender?.split(' ')[0]}</span>
                        {!hideReceipts && readers.length > 0 && <button onClick={() => setShowReadersId(m.id)} className="flex items-center gap-1 text-[8px] font-bold text-slate-300 mt-1 hover:text-brand-400"><Eye size={10} /> <span>Visto por {readers.length}</span></button>}
                      </div>
                  </div>
                );
            })}
            <div ref={scrollRef} />
          </div>

          {/* INPUT MEJORADO CON PREVIEW */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            {imagePreview && (
              <div className="relative inline-block mb-3">
                <img src={imagePreview} className="w-16 h-16 object-cover rounded-xl border-2 border-white shadow-lg" />
                <button onClick={() => { setSelectedFile(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button>
              </div>
            )}
            {showChecklistCreator && (
              <div className="bg-white border rounded-2xl p-4 mb-3 space-y-2">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Crear Lista</span><button onClick={() => setShowChecklistCreator(false)}><X size={14}/></button></div>
                {tempTasks.map((t, i) => (
                  <input key={i} type="text" value={t} onChange={(e) => {
                    const newT = [...tempTasks]; newT[i] = e.target.value; 
                    if (i === tempTasks.length - 1 && e.target.value !== '') newT.push('');
                    setTempTasks(newT);
                  }} placeholder="Tarea..." className="w-full text-xs font-bold p-1 outline-none border-b border-slate-50" />
                ))}
              </div>
            )}
            <div className="flex items-end gap-3">
              <div className="flex gap-2">
                <label className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 cursor-pointer"><ImageIcon size={20}/><input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isSending}/></label>
                <button onClick={() => setShowChecklistCreator(!showChecklistCreator)} className={`p-3.5 border rounded-2xl ${showChecklistCreator ? 'bg-brand-600 text-white' : 'bg-white text-slate-400'}`}><ListPlus size={20}/></button>
              </div>
              <textarea ref={textareaRef} rows="1" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribir..." className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 outline-none resize-none max-h-40" />
              <button onClick={handleSendMessage} disabled={isSending} className="bg-brand-600 text-white p-4 rounded-2xl shadow-xl active:scale-90 flex-shrink-0 disabled:opacity-50">{isSending ? <Loader2 size={22} className="animate-spin"/> : <Send size={22}/>}</button>
            </div>
          </div>
        </div>
      </div>

      {/* VISOR DE IMAGEN */}
      {viewingImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-4" onClick={() => setViewingImage(null)}>
          <div className="absolute top-8 right-6 flex gap-4"><button onClick={(e) => { e.stopPropagation(); handleDownload(viewingImage); }} className="p-3 bg-white/10 rounded-full text-white"><Download size={24}/></button><button onClick={() => setViewingImage(null)} className="p-3 bg-white/10 rounded-full text-white"><X size={24}/></button></div>
          <img src={viewingImage} className="max-w-full max-h-[80vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* MODAL LECTORES */}
      {showReadersId && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowReadersId(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
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