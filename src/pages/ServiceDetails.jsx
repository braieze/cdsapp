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
    
    // Bloqueo de seguridad. Si declinó, no escuchamos el chat.
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

  if (loading) return <div className="fixed inset-0 bg-[#F8F9FE] z-[100] flex flex-col items-center justify-center font-sans"><Loader2 className="animate-spin text-blue-600 mb-4" size={40}/><p className="text-sm font-semibold text-slate-500">Cargando...</p></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];
  const pinnedMessage = messages.find(m => m.isPinned);

  const MessageContent = ({ m, isPinnedView = false }) => {
    const isMyMessage = m.uid === currentUser.uid;
    return (
      <div className={`${isPinnedView ? 'w-full' : 'p-1 relative group'} ${!isPinnedView && (isMyMessage ? 'bg-blue-600 text-white rounded-[20px] rounded-tr-[4px] shadow-sm' : 'bg-white text-slate-800 rounded-[20px] rounded-tl-[4px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100')}`}>
        {m.image && <img src={m.image} referrerPolicy="no-referrer" onClick={(e) => { e.stopPropagation(); setViewingImage(m.image); }} className={`${isPinnedView ? 'w-16 h-16 rounded-xl float-right ml-3 object-cover' : 'w-full h-auto rounded-[16px] object-cover mb-1'}`} />}
        {m.checklist && (
          <div className={`${isPinnedView ? 'mt-1' : 'p-3'} space-y-2`}>
            {m.checklist.map((task, i) => (
              <button key={i} onClick={async (e) => {
                e.stopPropagation();
                const newChecklist = [...m.checklist];
                newChecklist[i].completed = !newChecklist[i].completed;
                await updateDoc(doc(db, `events/${id}/notes`, m.id), { checklist: newChecklist });
              }} className="flex items-start gap-3 w-full text-left">
                <div className="mt-0.5">
                  {task.completed ? <CheckSquare size={18} className={isPinnedView ? "text-blue-600" : (isMyMessage ? "text-white" : "text-blue-600")}/> : <Square size={18} className="opacity-50"/>}
                </div>
                <span className={`${isPinnedView ? 'text-xs' : 'text-[15px]'} font-semibold leading-snug ${task.completed ? 'opacity-60 line-through' : ''}`}>{task.text}</span>
              </button>
            ))}
          </div>
        )}
        {m.text && <p className={`font-medium leading-relaxed whitespace-pre-wrap ${isPinnedView ? 'text-sm truncate text-slate-700' : 'px-3 py-2 text-[15px]'}`}>{m.text}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#F8F9FE] flex flex-col overflow-hidden animate-fade-in z-[100] font-sans">
      
      {/* 🚀 HEADER SOCIALYO */}
      <header className="bg-white pt-12 pb-5 px-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] z-50 flex-shrink-0 border-b border-slate-100 rounded-b-[32px]">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/servicios')} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-700 rounded-full active:scale-90 transition-transform"><ChevronLeft size={24} strokeWidth={2.5}/></button>
            <div className="text-center flex-1 px-4 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate">{event.title}</h1>
              <p className="text-xs font-bold text-blue-600 capitalize mt-0.5">{format(new Date(event.date + 'T00:00:00'), "EEEE d MMMM", { locale: es })}</p>
            </div>
            <div className="w-10"></div>
          </div>

          <div className="bg-[#F8F9FE] border border-slate-100 rounded-[24px] p-4 flex items-center justify-between mb-5 shadow-inner">
             <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0"><Users size={18} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tu lugar en el equipo</p>
                  <p className="text-sm font-bold text-slate-900 capitalize truncate">{myRole?.replace(/_/g, ' ') || 'Servidor'}</p>
                </div>
             </div>
             <button onClick={() => navigate(`/calendario/${id}`)} className="text-xs font-bold bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-full active:scale-95 transition-all shadow-sm">Ver Equipo</button>
          </div>

          {!myStatus ? (
            <div className="flex gap-3">
              <button onClick={() => handleResponse('confirmed')} className="flex-1 bg-emerald-500 text-white py-3.5 rounded-full font-bold text-sm shadow-md shadow-emerald-500/20 active:scale-95 transition-all">Confirmar Asistencia</button>
              <button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 py-3.5 rounded-full font-bold text-sm active:scale-95 transition-all">Informar Baja</button>
            </div>
          ) : (
            <div className={`p-4 rounded-[20px] flex items-center justify-between border ${myStatus === 'confirmed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
              <span className="text-xs font-bold flex items-center gap-2">{myStatus === 'confirmed' ? <CheckCircle size={18}/> : <XCircle size={18}/>} {myStatus === 'confirmed' ? 'Asistencia Confirmada' : 'Baja Notificada'}</span>
              <button onClick={() => handleResponse(null)} className="text-xs font-bold underline underline-offset-2 ml-2 opacity-70 hover:opacity-100">Cambiar</button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative w-full max-w-md mx-auto">
        {/* 🎯 PUNTO 2: Lógica de Bloqueo de Chat */}
        {myStatus === 'declined' && !isModerator ? (
          <div className="absolute inset-0 z-[60] bg-[#F8F9FE]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-fade-in">
             <div className="w-20 h-20 bg-white text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-100">
                <Lock size={32} strokeWidth={2.5}/>
             </div>
             <h3 className="text-xl font-bold text-slate-900 mb-3">Chat Restringido</h3>
             <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
                Has notificado que no podrás asistir a este servicio. El chat solo está disponible para los servidores activos.
             </p>
             <button onClick={() => handleResponse(null)} className="w-full py-4 bg-slate-900 text-white rounded-full font-bold text-sm shadow-lg active:scale-95 transition-all">
                Reconsiderar Asistencia
             </button>
          </div>
        ) : (
          <>
            <div className="z-40 flex-shrink-0 pt-2">
                <div className="px-5 py-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><MessageSquare size={16} className="text-blue-500"/> Equipo Operativo</h3>
                  <button onClick={() => setHideReceipts(!hideReceipts)} className="w-8 h-8 flex items-center justify-center text-slate-400 bg-white rounded-full shadow-sm active:scale-90 transition-transform">{hideReceipts ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                </div>
                
                {pinnedMessage && (
                  <div onClick={() => document.getElementById(`msg-${pinnedMessage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} 
                       className="mx-5 mb-2 bg-blue-50 border border-blue-100 p-4 rounded-[24px] shadow-sm flex items-start gap-3 animate-slide-down cursor-pointer">
                    <Pin size={18} className="flex-shrink-0 mt-0.5 text-blue-600"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Mensaje Fijado</p>
                      <MessageContent m={pinnedMessage} isPinnedView={true} />
                    </div>
                    {isModerator && <button onClick={(e) => { e.stopPropagation(); togglePin(pinnedMessage.id, true); }} className="p-2 text-slate-400 hover:text-red-500 rounded-full active:scale-75 transition-colors -mt-1 -mr-1"><X size={16}/></button>}
                  </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scroll-smooth no-scrollbar pb-36">
              {messages.map((m) => {
                  const isMy = m.uid === currentUser.uid;
                  const readers = allUsers.filter(u => m.readBy?.includes(u.id) && u.id !== m.uid).map(u => u.displayName?.split(' ')[0]);
                  return (
                    <div key={m.id} id={`msg-${m.id}`} className="flex flex-col animate-fade-in group">
                        <div className={`flex flex-col ${isMy ? 'items-end' : 'items-start'}`}>
                            <div className="relative max-w-[85%]">
                              <MessageContent m={m} />
                              <div className={`absolute top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all ${isMy ? '-left-14' : '-right-14'}`}>
                                 {(isModerator || isMy) && <button onClick={() => deleteMessage(m.id)} className="w-8 h-8 flex items-center justify-center bg-white text-red-500 rounded-full shadow-sm border border-slate-100"><Trash2 size={14}/></button>}
                                 {isModerator && <button onClick={() => togglePin(m.id, m.isPinned)} className={`w-8 h-8 flex items-center justify-center rounded-full shadow-sm border ${m.isPinned ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-100'}`}><Pin size={14}/></button>}
                              </div>
                            </div>
                            <div className={`mt-1.5 px-2 flex flex-col ${isMy ? 'items-end' : 'items-start'}`}>
                              <span className="text-[10px] font-semibold text-slate-400">{m.sender?.split(' ')[0]} • {m.createdAt ? format(m.createdAt.toDate(), 'HH:mm') : '...'}</span>
                              {!hideReceipts && readers.length > 0 && <button onClick={() => setShowReadersId(m.id)} className="text-[10px] font-semibold text-blue-500/70 mt-0.5 flex items-center gap-1"><Eye size={10} /> Visto por {readers.length}</button>}
                            </div>
                        </div>
                    </div>
                  );
              })}
              <div ref={scrollRef} className="h-4" />
            </div>

            {/* 🚀 FOOTER INPUT SOCIALYO */}
            <footer className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 pb-6 z-[70]">
              {imagePreview && (
                <div className="absolute bottom-full left-5 mb-4 animate-scale-in">
                  <img src={imagePreview} className="w-20 h-20 object-cover rounded-[16px] border border-slate-200 shadow-lg" />
                  <button onClick={() => { setSelectedFile(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-sm"><X size={14}/></button>
                </div>
              )}
              
              {showChecklistCreator && (
                <div className="absolute bottom-full left-5 right-5 bg-white border border-slate-100 rounded-[28px] p-5 mb-4 space-y-3 shadow-xl animate-slide-up text-left">
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Nueva Lista de Tareas</span><button onClick={() => setShowChecklistCreator(false)} className="w-8 h-8 bg-slate-50 flex items-center justify-center rounded-full text-slate-500"><X size={16}/></button></div>
                  <div className="max-h-48 overflow-y-auto pr-1 no-scrollbar space-y-2">
                      {tempTasks.map((t, i) => (
                        <input key={i} type="text" value={t} onChange={(e) => {
                          const newT = [...tempTasks]; newT[i] = e.target.value; 
                          if (i === tempTasks.length - 1 && e.target.value !== '') newT.push('');
                          setTempTasks(newT);
                        }} placeholder="Escribir tarea..." className="w-full text-sm py-3 px-4 bg-[#F8F9FE] border border-slate-200 rounded-xl outline-none font-medium text-slate-800 focus:bg-white focus:border-blue-500 transition-all" />
                      ))}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 text-center pt-2">Las tareas aparecerán para todo el equipo</p>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex gap-2 mb-1">
                  <label className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-500 cursor-pointer active:scale-95 transition-all"><ImageIcon size={18}/><input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) { setSelectedFile(file); setImagePreview(URL.createObjectURL(file)); }
                  }} /></label>
                  <button onClick={() => setShowChecklistCreator(!showChecklistCreator)} className={`w-10 h-10 border rounded-full flex items-center justify-center active:scale-95 transition-all ${showChecklistCreator ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}><ListPlus size={18}/></button>
                </div>
                <div className="flex-1 bg-[#F8F9FE] border border-slate-200 rounded-[24px] flex items-end">
                   <textarea rows="1" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribe un mensaje..." className="w-full bg-transparent px-4 py-3 text-sm outline-none resize-none max-h-32 font-medium text-slate-800 placeholder-slate-400" />
                </div>
                <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !selectedFile && !showChecklistCreator)} className="w-12 h-12 mb-0.5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:bg-slate-300 active:scale-95 transition-transform shrink-0">
                   {isSending ? <Loader2 size={20} className="animate-spin"/> : <Send size={20} className="ml-1"/>}
                </button>
              </div>
            </footer>
          </>
        )}
      </main>

      {/* VISUALIZADOR DE IMAGEN */}
      {viewingImage && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
          <img src={viewingImage} referrerPolicy="no-referrer" className="max-w-full max-h-[80vh] object-contain rounded-[24px] shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-12 right-6 w-12 h-12 text-white bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md active:scale-90 transition-transform"><X size={24}/></button>
        </div>
      )}

      {/* LISTA DE LECTORES */}
      {showReadersId && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowReadersId(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-scale-in text-left" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Visto por</h4>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Acuse de lectura</p>
              </div>
              <button onClick={() => setShowReadersId(null)} className="w-8 h-8 bg-slate-50 flex items-center justify-center rounded-full text-slate-500 active:scale-90 transition-transform"><X size={16}/></button>
            </div>
            <div className="space-y-4 max-h-64 overflow-y-auto no-scrollbar pr-1">
              {allUsers.filter(u => messages.find(m => m.id === showReadersId)?.readBy?.includes(u.id) && u.id !== messages.find(m => m.id === showReadersId)?.uid).map(u => (
                <div key={u.id} className="flex items-center gap-3 animate-fade-in">
                  <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=EBF4FF&color=2563EB`} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover bg-slate-100" />
                  <span className="text-sm font-bold text-slate-800">{u.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      {toast && (
        <div className="fixed bottom-28 left-0 right-0 z-[1000] animate-slide-up flex justify-center pointer-events-none">
          <div className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-lg border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-900 text-white border-slate-800'}`}>
            <CheckCircle size={18}/>
            <span className="text-xs font-bold">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}