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
  Pin, X, EyeOff, Trash2, ListPlus, Square, CheckSquare, Download, Maximize2, ExternalLink, Info, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';
import OneSignalWeb from 'react-onesignal'; 
import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';

export default function ServiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [toast, setToast] = useState(null);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [viewingImage, setViewingImage] = useState(null); 
  const [showChecklistCreator, setShowChecklistCreator] = useState(false);
  const [tempTasks, setTempTasks] = useState(['']);
  const [showReadersId, setShowReadersId] = useState(null);
  const [hideReceipts, setHideReceipts] = useState(false);
  
  const scrollRef = useRef();
  const currentUser = auth.currentUser;
  const isNative = Capacitor.isNativePlatform();

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default";

  // ✅ ROLES MODERADORES
  const isModerator = userRole === 'pastor' || userRole === 'lider';

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sincronización OneSignal
  useEffect(() => {
    if (currentUser) {
      if (isNative) { OneSignal.login(currentUser.uid); } 
      else { OneSignalWeb.login(currentUser.uid); }
    }
  }, [currentUser, isNative]);

  // Carga de Datos
  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventSnap = await getDoc(doc(db, 'events', id));
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const usersSnap = await getDocs(collection(db, 'users'));
        
        if (userSnap.exists()) setUserRole(userSnap.data().role);
        setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        if (eventSnap.exists()) {
          setEvent({ id: eventSnap.id, ...eventSnap.data() });
        } else {
          navigate('/servicios');
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, [id, navigate, currentUser.uid]);

  // Listener de Chat
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

  // ✅ FUNCIÓN DE NOTIFICACIÓN UNIVERSAL
  const sendOneSignalNotification = async (userIds, title, message) => {
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      if (!REST_API_KEY || userIds.length === 0) return;

      const path = `/servicios/${id}`;

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          include_external_user_ids: userIds,
          headings: { en: title, es: title },
          contents: { en: message, es: message },
          url: `https://cdsapp.vercel.app/#${path}`,
          data: { route: path },
          isIos: true,
          priority: 10
        })
      });
      const data = await response.json();
      console.log("✅ OneSignal Chat:", data);
    } catch (e) { console.error("Error Notif:", e); }
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
      
      // ✅ NOTIFICAR SEGÚN ROL
      let targetIds = [];
      const assignedNames = Object.values(event.assignments || {}).flat();
      
      if (isModerator) {
        // Pastor avisa a los asignados
        targetIds = allUsers.filter(u => assignedNames.includes(u.displayName) && u.id !== currentUser.uid).map(u => u.id);
      } else {
        // Servidor avisa a los Pastores/Líderes
        targetIds = allUsers.filter(u => (u.role === 'pastor' || u.role === 'lider') && u.id !== currentUser.uid).map(u => u.id);
      }

      const notifBody = imageUrl ? "📷 Envió una imagen" : checklist ? "📋 Envió una lista de tareas" : txt;
      await sendOneSignalNotification(targetIds, `${currentUser.displayName} en ${event.title}`, notifBody);
      
      setNewMessage(''); setSelectedFile(null); setImagePreview(null);
      setShowChecklistCreator(false); setTempTasks(['']);
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  const handleResponse = async (status) => {
    const eventRef = doc(db, 'events', id);
    await updateDoc(eventRef, { [`confirmations.${currentUser.displayName}`]: status, updatedAt: serverTimestamp() });
    
    if (status) {
      const moderators = allUsers.filter(u => (u.role === 'pastor' || u.role === 'lider') && u.id !== currentUser.uid).map(u => u.id);
      const statusText = status === 'confirmed' ? 'Confirmó asistencia ✓' : 'No puede asistir ✗';
      await sendOneSignalNotification(moderators, `Estado: ${currentUser.displayName}`, `${statusText} para ${event.title}`);
    }

    setEvent(prev => ({ ...prev, confirmations: { ...prev.confirmations, [currentUser.displayName]: status } }));
    setToast({ message: "Estado actualizado", type: "success" });
  };

  const togglePin = async (msgId, currentState) => {
    if (!isModerator) return;
    messages.forEach(async (m) => { if (m.isPinned) await updateDoc(doc(db, `events/${id}/notes`, m.id), { isPinned: false }); });
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

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-white z-[100]"><Loader2 className="animate-spin text-brand-600" /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];
  const pinnedMessage = messages.find(m => m.isPinned);

  const MessageContent = ({ m, isPinnedView = false }) => {
    const isMyMessage = m.uid === currentUser.uid;
    return (
      <div className={`${isPinnedView ? 'w-full' : 'p-1 rounded-[22px] shadow-sm relative group'} ${!isPinnedView && (isMyMessage ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40')}`}>
        {m.image && <img src={m.image} onClick={(e) => { e.stopPropagation(); setViewingImage(m.image); }} className={`${isPinnedView ? 'w-16 h-16 rounded-lg float-right ml-2' : 'w-full h-auto rounded-[18px]'} object-cover`} />}
        {m.checklist && (
          <div className={`${isPinnedView ? 'mt-1' : 'p-3'} space-y-1.5`}>
            {m.checklist.map((task, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); toggleChecklistTask(m.id, i); }} className="flex items-center gap-2.5 w-full text-left">
                {task.completed ? <CheckSquare size={isPinnedView ? 14 : 16} className={isPinnedView ? "text-white/80" : (isMyMessage ? "text-white" : "text-brand-600")}/> : <Square size={16} className="opacity-40"/>}
                <span className={`${isPinnedView ? 'text-xs' : 'text-sm'} font-black ${task.completed ? 'opacity-40 line-through' : ''}`}>{task.text}</span>
              </button>
            ))}
          </div>
        )}
        {m.text && <p className={`font-semibold leading-snug whitespace-pre-wrap ${isPinnedView ? 'text-xs truncate' : 'px-4 py-2.5 text-sm'}`}>{m.text}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden animate-fade-in z-[100] font-outfit">
      
      <header className="bg-slate-900 text-white pt-12 pb-4 px-5 rounded-b-[40px] shadow-xl z-50 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/servicios')} className="p-2 bg-white/10 rounded-full"><ChevronLeft size={22} /></button>
          <div className="text-center flex-1">
            <h1 className="text-xl font-black truncate uppercase tracking-tighter">{event.title}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(event.date + 'T00:00:00'), "d MMMM", { locale: es })} • {event.time} hs</p>
          </div>
          <div className="w-10"></div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between mb-2">
           <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-brand-500/20 p-2 rounded-xl text-brand-400"><Users size={18} /></div>
              <div className="min-w-0 flex-1"><p className="text-[8px] font-black text-white/40 uppercase">Tu función</p><p className="text-sm font-bold text-white capitalize truncate">{myRole?.replace(/_/g, ' ') || 'Servidor'}</p></div>
           </div>
           <button onClick={() => navigate(`/calendario/${id}`)} className="text-[9px] font-black bg-brand-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-all">EQUIPO <ExternalLink size={10}/></button>
        </div>

        {!myStatus ? (
          <div className="flex gap-2"><button onClick={() => handleResponse('confirmed')} className="flex-1 bg-emerald-500 text-white py-2 rounded-xl font-black text-[9px] uppercase shadow-lg">Confirmar ✓</button><button onClick={() => handleResponse('declined')} className="flex-1 bg-white/10 text-white/60 py-2 rounded-xl font-black text-[9px] uppercase">No puedo</button></div>
        ) : (
          <div className={`p-2 rounded-xl flex items-center justify-between border ${myStatus === 'confirmed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            <span className="text-[9px] font-black uppercase flex items-center gap-2">{myStatus === 'confirmed' ? <CheckCircle size={14}/> : <XCircle size={14}/>} {myStatus === 'confirmed' ? 'LISTO' : 'BAJA'}</span>
            <button onClick={() => handleResponse(null)} className="text-[8px] font-black uppercase underline ml-2">Cambiar</button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative bg-white">
        <div className="bg-slate-50/95 backdrop-blur-md z-40 border-b border-slate-200 flex-shrink-0">
            <div className="p-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={14} className="text-brand-500"/> Notas de Equipo</h3>
              <button onClick={() => setHideReceipts(!hideReceipts)} className="p-1.5 text-slate-400">{hideReceipts ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            </div>
            {pinnedMessage && (
              <div onClick={() => {
                  const el = document.getElementById(`msg-${pinnedMessage.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }} className="bg-brand-600 text-white p-4 shadow-lg flex items-start gap-3 animate-slide-down cursor-pointer">
                <Pin size={18} className="flex-shrink-0 mt-1 opacity-60"/><div className="flex-1"><p className="text-[9px] font-black uppercase opacity-40 mb-1">Fijado por el Pastor</p><MessageContent m={pinnedMessage} isPinnedView={true} /></div>
                {isModerator && <button onClick={(e) => { e.stopPropagation(); togglePin(pinnedMessage.id, true); }} className="p-1"><X size={18}/></button>}
              </div>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth no-scrollbar">
          {messages.map((m) => {
              const isMy = m.uid === currentUser.uid;
              const readers = allUsers.filter(u => m.readBy?.includes(u.id) && u.id !== m.uid).map(u => u.displayName?.split(' ')[0]);
              return (
                <div key={m.id} id={`msg-${m.id}`} className="flex flex-col">
                    <div className={`flex flex-col ${isMy ? 'items-end' : 'items-start'}`}>
                        <div className="relative group max-w-[85%]">
                          <MessageContent m={m} />
                          <div className={`absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMy ? '-left-14' : '-right-14'}`}>
                             {(isModerator || isMy) && <button onClick={() => deleteMessage(m.id)} className="p-1.5 bg-red-50 text-red-500 rounded-full active:scale-90 transition-transform"><Trash2 size={12}/></button>}
                             {isModerator && <button onClick={() => togglePin(m.id, m.isPinned)} className={`p-1.5 rounded-full active:scale-90 transition-transform ${m.isPinned ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}><Pin size={12}/></button>}
                          </div>
                        </div>
                        <div className={`mt-1 px-1 flex flex-col ${isMy ? 'items-end' : 'items-start'}`}>
                          <span className="text-[8px] font-black text-slate-400 uppercase">{m.sender?.split(' ')[0]}</span>
                          {!hideReceipts && readers.length > 0 && <button onClick={() => setShowReadersId(m.id)} className="text-[7px] font-bold text-slate-300 mt-0.5 flex items-center gap-1"><Eye size={8} /> Visto por {readers.length}</button>}
                        </div>
                    </div>
                </div>
              );
          })}
          <div ref={scrollRef} />
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 p-4 pb-8 z-50 flex-shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] relative">
        {imagePreview && (
          <div className="absolute bottom-full left-4 mb-3 animate-scale-in">
            <img src={imagePreview} className="w-16 h-16 object-cover rounded-xl border-2 border-white shadow-lg" />
            <button onClick={() => { setSelectedFile(null); setImagePreview(null); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1 rounded-full"><X size={10}/></button>
          </div>
        )}
        {showChecklistCreator && (
          <div className="absolute bottom-full left-4 right-4 bg-white border border-slate-200 rounded-[24px] p-4 mb-3 space-y-2 shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-2"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nueva Lista de Tareas</span><button onClick={() => setShowChecklistCreator(false)}><X size={14}/></button></div>
            {tempTasks.map((t, i) => (
              <input key={i} type="text" value={t} onChange={(e) => {
                const newT = [...tempTasks]; newT[i] = e.target.value; 
                if (i === tempTasks.length - 1 && e.target.value !== '') newT.push('');
                setTempTasks(newT);
              }} placeholder="Escribir tarea..." className="w-full text-xs p-2 bg-slate-50 border-b border-slate-100 rounded-lg outline-none font-bold text-slate-700" />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex gap-1.5">
            <label className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 cursor-pointer active:scale-95 transition-all"><ImageIcon size={20}/><input type="file" className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files[0];
                if (file) { setSelectedFile(file); setImagePreview(URL.createObjectURL(file)); }
            }} /></label>
            <button onClick={() => setShowChecklistCreator(!showChecklistCreator)} className={`p-3.5 border rounded-2xl active:scale-95 transition-all ${showChecklistCreator ? 'bg-brand-600 text-white border-brand-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}><ListPlus size={20}/></button>
          </div>
          <textarea rows="1" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Nota rápida..." className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none resize-none max-h-32 font-medium" />
          <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !selectedFile && !showChecklistCreator)} className="bg-brand-600 text-white p-4 rounded-2xl shadow-xl disabled:opacity-50 active:scale-95 transition-all">{isSending ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}</button>
        </div>
      </footer>

      {/* MODALES */}
      {viewingImage && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
          <img src={viewingImage} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-10 right-10 text-white p-3 bg-white/10 rounded-full backdrop-blur-md"><X size={28}/></button>
        </div>
      )}

      {showReadersId && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowReadersId(null)}>
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h4 className="font-black text-slate-400 text-[10px] uppercase mb-6 tracking-[0.2em] border-b pb-2">Visto por:</h4>
            <div className="space-y-4 max-h-64 overflow-y-auto no-scrollbar">
              {allUsers.filter(u => messages.find(m => m.id === showReadersId)?.readBy?.includes(u.id) && u.id !== messages.find(m => m.id === showReadersId)?.uid).map(u => (
                <div key={u.id} className="flex items-center gap-4">
                  <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-10 h-10 rounded-xl shadow-sm" />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{u.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[400] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}