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
  Pin, X, EyeOff, Trash2, ListPlus, Square, CheckSquare, Lock, AlertCircle
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

  const isModerator = userRole === 'pastor' || userRole === 'lider';

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
    if (!event) return;
    
    // 🎯 PUNTO 2: Bloqueo de seguridad. Si declinó, no escuchamos el chat.
    if (event.confirmations?.[currentUser.displayName] === 'declined' && !isModerator) {
      setMessages([]);
      return;
    }

    const q = query(collection(db, `events/${id}/notes`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      
      msgs.forEach(async (m) => {
        if (!m.readBy?.includes(currentUser.uid)) {
          await updateDoc(doc(db, `events/${id}/notes`, m.id), { readBy: arrayUnion(currentUser.uid) });
        }
      });

      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 300);
    });
    return () => unsubscribe();
  }, [id, event, currentUser.uid, isModerator]);

  const sendOneSignalNotification = async (userIds, title, message) => {
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      if (!REST_API_KEY || userIds.length === 0) return;

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: APP_ID,
          include_external_user_ids: userIds,
          headings: { en: title, es: title },
          contents: { en: message, es: message },
          data: { route: `/servicios/${id}` },
          isAndroid: true, isIos: true, priority: 10
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
        formData.append("file", compressed); formData.append("upload_preset", UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const data = await res.json();
        imageUrl = data.secure_url;
      }
      
      let checklist = null;
      if (showChecklistCreator) {
        const tasks = tempTasks.filter(t => t.trim() !== '');
        if (tasks.length > 0) checklist = tasks.map(t => ({ text: t, completed: false }));
      }

      await addDoc(collection(db, `events/${id}/notes`), {
        text: newMessage, image: imageUrl, checklist: checklist,
        sender: currentUser.displayName, uid: currentUser.uid,
        createdAt: serverTimestamp(), readBy: [currentUser.uid], isPinned: false
      });
      
      let targetIds = [];
      const assignedNames = Object.values(event.assignments || {}).flat();
      if (isModerator) {
        targetIds = allUsers.filter(u => assignedNames.includes(u.displayName) && u.id !== currentUser.uid).map(u => u.id);
      } else {
        targetIds = allUsers.filter(u => (u.role === 'pastor' || u.role === 'lider') && u.id !== currentUser.uid).map(u => u.id);
      }
      
      await sendOneSignalNotification(targetIds, `${currentUser.displayName} en ${event.title}`, imageUrl ? "📷 Imagen" : checklist ? "📋 Checklist" : newMessage);
      
      setNewMessage(''); setSelectedFile(null); setImagePreview(null);
      setShowChecklistCreator(false); setTempTasks(['']);
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  const handleResponse = async (status) => {
    const eventRef = doc(db, 'events', id);
    await updateDoc(eventRef, { [`confirmations.${currentUser.displayName}`]: status, updatedAt: serverTimestamp() });
    
    if (status) {
      const moderators = allUsers.filter(u => (u.role === 'pastor' || u.role === 'lider') && u.id !== currentUser.uid).map(u => u.id);
      const label = status === 'confirmed' ? 'Confirmó ✓' : 'No asiste ✗';
      await sendOneSignalNotification(moderators, `Estado: ${currentUser.displayName}`, `${label} para ${event.title}`);
    }
    setEvent(prev => ({ ...prev, confirmations: { ...prev.confirmations, [currentUser.displayName]: status } }));
    setToast({ message: "Estado actualizado", type: "success" });
  };

  const togglePin = async (msgId, currentState) => {
    if (!isModerator) return;
    messages.forEach(async (m) => { if (m.isPinned) await updateDoc(doc(db, `events/${id}/notes`, m.id), { isPinned: false }); });
    await updateDoc(doc(db, `events/${id}/notes`, msgId), { isPinned: !currentState });
  };

  const deleteMessage = async (msgId) => {
    if (window.confirm("¿Eliminar mensaje?")) await deleteDoc(doc(db, `events/${id}/notes`, msgId));
  };

  if (loading) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];
  const pinnedMessage = messages.find(m => m.isPinned);

  const MessageContent = ({ m, isPinnedView = false }) => {
    const isMyMessage = m.uid === currentUser.uid;
    return (
      <div className={`${isPinnedView ? 'w-full' : 'p-1 rounded-[22px] shadow-sm relative group'} ${!isPinnedView && (isMyMessage ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40')}`}>
        {m.image && <img src={m.image} referrerPolicy="no-referrer" onClick={(e) => { e.stopPropagation(); setViewingImage(m.image); }} className={`${isPinnedView ? 'w-16 h-16 rounded-lg float-right ml-2' : 'w-full h-auto rounded-[18px]'} object-cover`} />}
        {m.checklist && (
          <div className={`${isPinnedView ? 'mt-1' : 'p-4'} space-y-2`}>
            {m.checklist.map((task, i) => (
              <button key={i} onClick={async (e) => {
                e.stopPropagation();
                const newChecklist = [...m.checklist];
                newChecklist[i].completed = !newChecklist[i].completed;
                await updateDoc(doc(db, `events/${id}/notes`, m.id), { checklist: newChecklist });
              }} className="flex items-center gap-3 w-full text-left">
                {task.completed ? <CheckSquare size={18} className={isPinnedView ? "text-white/80" : (isMyMessage ? "text-white" : "text-brand-600")}/> : <Square size={18} className="opacity-40"/>}
                <span className={`${isPinnedView ? 'text-xs' : 'text-sm'} font-black ${task.completed ? 'opacity-40 line-through' : ''}`}>{task.text}</span>
              </button>
            ))}
          </div>
        )}
        {m.text && <p className={`font-semibold leading-relaxed whitespace-pre-wrap ${isPinnedView ? 'text-xs truncate' : 'px-4 py-3 text-[15px]'}`}>{m.text}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden animate-fade-in z-[100] font-outfit">
      
      <header className="bg-slate-900 text-white pt-14 pb-5 px-6 rounded-b-[45px] shadow-2xl z-50 flex-shrink-0 border-b-4 border-brand-500/20">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => navigate('/servicios')} className="p-2.5 bg-white/10 rounded-2xl active:scale-90 transition-transform"><ChevronLeft size={24} /></button>
          <div className="text-center flex-1 px-4">
            <h1 className="text-lg font-black truncate uppercase tracking-tighter leading-tight">{event.title}</h1>
            <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] mt-1">{format(new Date(event.date + 'T00:00:00'), "EEEE d MMMM", { locale: es })}</p>
          </div>
          <div className="w-12"></div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[24px] p-4 flex items-center justify-between mb-4 shadow-inner">
           <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-brand-500/20 p-2.5 rounded-xl text-brand-400 shadow-lg"><Users size={20} /></div>
              <div className="min-w-0 flex-1"><p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Tu lugar en el equipo</p><p className="text-sm font-black text-white capitalize truncate">{myRole?.replace(/_/g, ' ') || 'Servidor'}</p></div>
           </div>
           <button onClick={() => navigate(`/calendario/${id}`)} className="text-[9px] font-black bg-white text-slate-900 px-4 py-2.5 rounded-xl active:scale-95 transition-all shadow-xl uppercase tracking-widest">Equipo</button>
        </div>

        {!myStatus ? (
          <div className="flex gap-3"><button onClick={() => handleResponse('confirmed')} className="flex-1 bg-emerald-500 text-white py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">Confirmar ✓</button><button onClick={() => handleResponse('declined')} className="flex-1 bg-white/10 text-white/60 py-3.5 rounded-2xl font-black text-[10px] uppercase active:scale-95">Informar Baja</button></div>
        ) : (
          <div className={`p-4 rounded-2xl flex items-center justify-between border-2 ${myStatus === 'confirmed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            <span className="text-[10px] font-black uppercase flex items-center gap-3 tracking-widest">{myStatus === 'confirmed' ? <CheckCircle size={18}/> : <XCircle size={18}/>} {myStatus === 'confirmed' ? 'Servicio Confirmado' : 'Baja Notificada'}</span>
            <button onClick={() => handleResponse(null)} className="text-[9px] font-black uppercase underline decoration-2 underline-offset-4 ml-2">Cambiar</button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">
        {/* 🎯 PUNTO 2: Lógica de Bloqueo de Chat */}
        {myStatus === 'declined' && !isModerator ? (
          <div className="absolute inset-0 z-[60] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center animate-fade-in">
             <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[40px] flex items-center justify-center mb-6 shadow-xl shadow-rose-100 border-2 border-rose-100">
                <Lock size={48} strokeWidth={2.5}/>
             </div>
             <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Chat Restringido</h3>
             <p className="text-sm text-slate-500 font-bold leading-relaxed mb-8 uppercase tracking-widest">
                Has notificado que no podrás asistir a este servicio. El chat solo está disponible para los servidores activos.
             </p>
             <button onClick={() => handleResponse(null)} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all">
                Reconsiderar Asistencia
             </button>
          </div>
        ) : (
          <>
            <div className="bg-white/80 backdrop-blur-md z-40 border-b border-slate-200 flex-shrink-0">
                <div className="px-6 py-4 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><MessageSquare size={14} className="text-brand-600"/> Coordinación de Equipo</h3>
                  <button onClick={() => setHideReceipts(!hideReceipts)} className="p-2 text-slate-400 bg-slate-100 rounded-xl active:scale-90">{hideReceipts ? <Eye size={18} /> : <EyeOff size={18} />}</button>
                </div>
                
                {pinnedMessage && (
                  <div onClick={() => document.getElementById(`msg-${pinnedMessage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} 
                       className="mx-4 mb-4 bg-brand-600 text-white p-5 rounded-[28px] shadow-xl shadow-brand-100 flex items-start gap-4 animate-slide-down cursor-pointer border-b-4 border-brand-700/50">
                    <Pin size={22} className="flex-shrink-0 mt-1 opacity-70 rotate-12"/><div className="flex-1"><p className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-[0.2em]">Nota Importante</p><MessageContent m={pinnedMessage} isPinnedView={true} /></div>
                    {isModerator && <button onClick={(e) => { e.stopPropagation(); togglePin(pinnedMessage.id, true); }} className="p-2 bg-black/20 rounded-full active:scale-75"><X size={16}/></button>}
                  </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth no-scrollbar pb-32">
              {messages.map((m) => {
                  const isMy = m.uid === currentUser.uid;
                  const readers = allUsers.filter(u => m.readBy?.includes(u.id) && u.id !== m.uid).map(u => u.displayName?.split(' ')[0]);
                  return (
                    <div key={m.id} id={`msg-${m.id}`} className="flex flex-col animate-fade-in group">
                        <div className={`flex flex-col ${isMy ? 'items-end' : 'items-start'}`}>
                            <div className="relative max-w-[88%]">
                              <MessageContent m={m} />
                              <div className={`absolute top-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-all ${isMy ? '-left-16' : '-right-16'}`}>
                                 {(isModerator || isMy) && <button onClick={() => deleteMessage(m.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl shadow-sm border border-rose-100"><Trash2 size={14}/></button>}
                                 {isModerator && <button onClick={() => togglePin(m.id, m.isPinned)} className={`p-2 rounded-xl shadow-sm border ${m.isPinned ? 'bg-brand-600 text-white border-brand-500' : 'bg-white text-brand-600 border-slate-100'}`}><Pin size={14}/></button>}
                              </div>
                            </div>
                            <div className={`mt-2 px-1 flex flex-col ${isMy ? 'items-end' : 'items-start'}`}>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{m.sender?.split(' ')[0]} • {m.createdAt ? format(m.createdAt.toDate(), 'HH:mm') : '...'}</span>
                              {!hideReceipts && readers.length > 0 && <button onClick={() => setShowReadersId(m.id)} className="text-[8px] font-black text-brand-500/60 mt-1 flex items-center gap-1.5 uppercase tracking-widest"><Eye size={10} /> Visto por {readers.length}</button>}
                            </div>
                        </div>
                    </div>
                  );
              })}
              <div ref={scrollRef} className="h-4" />
            </div>

            <footer className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-5 pb-10 z-[70] shadow-[0_-20px_50px_rgba(0,0,0,0.08)]">
              {imagePreview && (
                <div className="absolute bottom-full left-5 mb-4 animate-scale-in">
                  <img src={imagePreview} className="w-24 h-24 object-cover rounded-[24px] border-4 border-white shadow-2xl" />
                  <button onClick={() => { setSelectedFile(null); setImagePreview(null); }} className="absolute -top-3 -right-3 bg-rose-600 text-white p-2 rounded-full shadow-lg border-2 border-white"><X size={14}/></button>
                </div>
              )}
              
              {showChecklistCreator && (
                <div className="absolute bottom-full left-5 right-5 bg-white border-2 border-slate-100 rounded-[35px] p-6 mb-5 space-y-4 shadow-2xl animate-slide-up text-left">
                  <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Nueva Tarea Grupal</span><button onClick={() => setShowChecklistCreator(false)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={16}/></button></div>
                  <div className="max-h-48 overflow-y-auto pr-2 no-scrollbar space-y-2.5">
                      {tempTasks.map((t, i) => (
                        <input key={i} type="text" value={t} onChange={(e) => {
                          const newT = [...tempTasks]; newT[i] = e.target.value; 
                          if (i === tempTasks.length - 1 && e.target.value !== '') newT.push('');
                          setTempTasks(newT);
                        }} placeholder="Escribir requerimiento..." className="w-full text-sm p-4 bg-slate-50 border-2 border-transparent rounded-[20px] outline-none font-bold text-slate-700 focus:bg-white focus:border-brand-500 transition-all shadow-inner" />
                      ))}
                  </div>
                  <p className="text-[9px] font-black text-slate-300 uppercase text-center tracking-widest">Las tareas aparecerán para todo el equipo</p>
                </div>
              )}

              <div className="flex items-end gap-3">
                <div className="flex gap-2">
                  <label className="p-4 bg-slate-50 border-2 border-slate-100 rounded-[22px] text-slate-500 cursor-pointer active:scale-95 transition-all shadow-sm"><ImageIcon size={22}/><input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) { setSelectedFile(file); setImagePreview(URL.createObjectURL(file)); }
                  }} /></label>
                  <button onClick={() => setShowChecklistCreator(!showChecklistCreator)} className={`p-4 border-2 rounded-[22px] active:scale-95 transition-all shadow-sm ${showChecklistCreator ? 'bg-brand-600 text-white border-brand-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}><ListPlus size={22}/></button>
                </div>
                <textarea rows="1" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribe al equipo..." className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-[25px] px-6 py-4 text-[15px] outline-none resize-none max-h-36 font-semibold focus:border-brand-500 focus:bg-white transition-all shadow-inner" />
                <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !selectedFile && !showChecklistCreator)} className="bg-slate-900 text-white p-5 rounded-[25px] shadow-2xl disabled:opacity-30 active:scale-90 transition-all">{isSending ? <Loader2 size={24} className="animate-spin"/> : <Send size={24}/>}</button>
              </div>
            </footer>
          </>
        )}
      </main>

      {/* VISUALIZADOR DE IMAGEN FULL SCREEN (PUNTO 8) */}
      {viewingImage && (
        <div className="fixed inset-0 z-[200] bg-slate-900/98 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
          <img src={viewingImage} referrerPolicy="no-referrer" className="max-w-full max-h-[80vh] object-contain rounded-3xl shadow-2xl border-4 border-white/10" onClick={e => e.stopPropagation()} />
          <button className="absolute top-12 right-8 text-white p-4 bg-white/10 rounded-full backdrop-blur-xl border border-white/20 active:scale-75 transition-all"><X size={32}/></button>
        </div>
      )}

      {/* LISTA DE LECTORES (PUNTO 8: FIX ANDROID) */}
      {showReadersId && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in" onClick={() => setShowReadersId(null)}>
          <div className="bg-white w-full max-w-xs rounded-[45px] p-8 shadow-2xl animate-scale-in border-2 border-slate-100 text-left" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 border-b pb-5 border-slate-50">
              <div>
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-tighter">Visto por:</h4>
                <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest mt-1">Acuse de lectura</p>
              </div>
              <button onClick={() => setShowReadersId(null)} className="p-2.5 bg-slate-50 rounded-full text-slate-400 active:scale-75 transition-all"><X size={18}/></button>
            </div>
            <div className="space-y-4 max-h-72 overflow-y-auto no-scrollbar">
              {allUsers.filter(u => messages.find(m => m.id === showReadersId)?.readBy?.includes(u.id) && u.id !== messages.find(m => m.id === showReadersId)?.uid).map(u => (
                <div key={u.id} className="flex items-center gap-4 animate-fade-in">
                  <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white shadow-lg bg-slate-100 flex-shrink-0">
                    <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=0f172a&color=fff`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{u.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      {toast && (
        <div className="fixed bottom-32 left-6 right-6 z-[1000] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <CheckCircle size={24}/>
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}