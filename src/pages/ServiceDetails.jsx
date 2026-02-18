import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, updateDoc, collection, addDoc, 
  query, orderBy, onSnapshot, serverTimestamp, 
  getDocs, arrayUnion 
} from 'firebase/firestore';
import { 
  Calendar, Clock, CheckCircle, XCircle, 
  ChevronLeft, Loader2, ListChecks, Users, 
  Send, MessageSquare, Info, Eye, Image as ImageIcon,
  Pin, X, EyeOff
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
  const [isUploading, setIsUploading] = useState(false);
  
  // Estados de Interfaz
  const [showReadersId, setShowReadersId] = useState(null); // Para el modal de vistos
  const [hideReceipts, setHideReceipts] = useState(false); // Para ocultar visualmente los vistos
  
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
          await updateDoc(doc(db, `events/${id}/notes`, m.id), {
            readBy: arrayUnion(currentUser.uid)
          });
        }
      });
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [id, currentUser.uid]);

  // 3. FUNCIONES DE ENVÍO Y ACCIÓN
  const handleSendMessage = async (image = null) => {
    if (!newMessage.trim() && !image) return;
    const textToSend = newMessage;
    setNewMessage('');
    try {
      await addDoc(collection(db, `events/${id}/notes`), {
        text: textToSend,
        image: image,
        sender: currentUser.displayName,
        uid: currentUser.uid,
        createdAt: serverTimestamp(),
        readBy: [currentUser.uid],
        isPinned: false
      });
    } catch (e) { console.error(e); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.secure_url) await handleSendMessage(data.secure_url);
    } catch (e) { alert("Error al subir foto"); } finally { setIsUploading(false); }
  };

  const togglePin = async (msgId, currentState) => {
    if (userRole !== 'pastor') return;
    await updateDoc(doc(db, `events/${id}/notes`, msgId), { isPinned: !currentState });
  };

  const handleResponse = async (status) => {
    const eventRef = doc(db, 'events', id);
    await updateDoc(eventRef, { [`confirmations.${currentUser.displayName}`]: status, updatedAt: serverTimestamp() });
    setEvent(prev => ({ ...prev, confirmations: { ...prev.confirmations, [currentUser.displayName]: status } }));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];
  const pinnedMessage = messages.find(m => m.isPinned);

  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in flex flex-col">
      {/* HEADER */}
      <div className="bg-slate-900 text-white pt-20 pb-28 px-6 rounded-b-[50px] shadow-lg relative flex-shrink-0 z-10">
        <button onClick={() => navigate('/servicios')} className="absolute top-10 left-6 p-2 bg-white/10 rounded-full text-white"><ChevronLeft size={26} /></button>
        <div className="mt-2 text-center">
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-400">Panel de Servicio</span>
          <h1 className="text-4xl font-black mt-2 leading-tight">{event.title}</h1>
          <div className="flex justify-center gap-6 mt-4 text-slate-400">
            <div className="flex items-center gap-2 text-xs font-bold bg-white/5 px-3 py-1.5 rounded-full"><Calendar size={14} /> {format(new Date(event.date + 'T00:00:00'), "d 'de' MMMM", { locale: es })}</div>
            <div className="flex items-center gap-2 text-xs font-bold bg-white/5 px-3 py-1.5 rounded-full"><Clock size={14} /> {event.time} hs</div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-5 -mt-14 space-y-6 flex-1 overflow-y-auto pb-10 z-20">
        {/* CARD FUNCIÓN */}
        <div className="bg-white rounded-[35px] p-7 shadow-2xl border border-slate-100/50">
          <div className="flex items-center gap-5 mb-6">
            <div className="bg-brand-50 p-4 rounded-3xl text-brand-600 flex-shrink-0"><Users size={28} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu función hoy</p>
              <p className="text-2xl font-black text-slate-800 capitalize leading-tight">{myRole?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          {!myStatus ? (
            <div className="flex gap-3"><button onClick={() => handleResponse('confirmed')} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg uppercase">Confirmar ✓</button><button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-50 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase">No puedo</button></div>
          ) : (
            <div className={`p-5 rounded-2xl flex items-center justify-between border ${myStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}><span className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">{myStatus === 'confirmed' ? <CheckCircle size={20}/> : <XCircle size={20}/>} {myStatus === 'confirmed' ? 'LISTO PARA SERVIR' : 'AUSENCIA NOTIFICADA'}</span><button onClick={() => handleResponse(null)} className="text-[10px] font-black uppercase underline decoration-2 underline-offset-4">Cambiar</button></div>
          )}
        </div>

        {/* 💬 MURO DE NOTAS */}
        <div className="bg-white rounded-[35px] shadow-xl border border-slate-100 flex flex-col min-h-[520px] max-h-[700px] overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-col gap-1 bg-slate-50/40">
            <div className="flex items-center justify-between">
               <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><MessageSquare size={16} className="text-brand-500"/> Notas de Equipo</h3>
               <button onClick={() => setHideReceipts(!hideReceipts)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                 {hideReceipts ? <Eye size={16} /> : <EyeOff size={16} />}
               </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {/* 📌 MENSAJE ANCLADO */}
            {pinnedMessage && (
              <div className="bg-brand-50 border-2 border-brand-200 p-4 rounded-3xl relative animate-pulse shadow-md mb-4">
                <div className="flex items-center gap-2 text-brand-600 font-black text-[10px] uppercase tracking-widest mb-1"><Pin size={12}/> Mensaje Anclado</div>
                <p className="text-sm font-bold text-brand-900 leading-relaxed">{pinnedMessage.text}</p>
                {userRole === 'pastor' && <button onClick={() => togglePin(pinnedMessage.id, true)} className="absolute top-2 right-2 p-1 text-brand-300 hover:text-brand-600"><X size={14}/></button>}
              </div>
            )}

            {messages.map((m) => {
                const readers = allUsers.filter(u => m.readBy?.includes(u.id) && u.id !== m.uid).map(u => u.displayName?.split(' ')[0]);
                return (
                  <div key={m.id} className={`flex flex-col ${m.uid === currentUser.uid ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] p-1 rounded-[22px] shadow-sm relative group ${m.uid === currentUser.uid ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40'}`}>
                          {m.image && <img src={m.image} className="w-full h-auto rounded-[18px] mb-2" alt="Referencia" />}
                          {m.text && <p className="font-semibold leading-relaxed whitespace-pre-wrap px-4 py-2.5 text-sm">{m.text}</p>}
                          
                          {/* BOTÓN PIN PARA EL PASTOR */}
                          {userRole === 'pastor' && !m.image && (
                            <button onClick={() => togglePin(m.id, m.isPinned)} className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-brand-500"><Pin size={14} fill={m.isPinned ? "currentColor" : "none"}/></button>
                          )}
                      </div>
                      
                      <div className={`flex flex-col mt-2 px-1 ${m.uid === currentUser.uid ? 'items-end' : 'items-start'}`}>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-80">{m.sender?.split(' ')[0]}</span>
                        
                        {/* ✅ INDICADOR "LEÍDO POR" CLICKEABLE */}
                        {!hideReceipts && readers.length > 0 && (
                          <button onClick={() => setShowReadersId(m.id)} className="flex items-center gap-1 text-[8px] font-bold text-slate-300 mt-1 hover:text-brand-400 transition-colors">
                            <Eye size={10} /> <span>Visto por {readers.length} {readers.length === 1 ? 'persona' : 'personas'}</span>
                          </button>
                        )}
                      </div>
                  </div>
                );
            })}
            <div ref={scrollRef} />
          </div>

          {/* INPUT MEJORADO CON FOTOS */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-5 border-t border-slate-100 flex items-end gap-3 bg-slate-50/50">
            <label className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-brand-600 transition-colors cursor-pointer shadow-sm active:scale-95">
              {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20}/>}
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading}/>
            </label>
            <textarea 
                ref={textareaRef} rows="1" value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder="Escribir nota..." 
                className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-brand-500/10 outline-none resize-none max-h-40 shadow-inner"
            />
            <button type="submit" className="bg-brand-600 text-white p-4 rounded-2xl shadow-xl active:scale-90 flex-shrink-0"><Send size={22}/></button>
          </form>
        </div>
      </div>

      {/* 📋 MODAL SIMPLE DE LECTORES */}
      {showReadersId && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowReadersId(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2"><Eye size={16} className="text-brand-500"/> Leído por</h4>
              <button onClick={() => setShowReadersId(null)} className="p-2 bg-slate-50 rounded-full"><X size={16}/></button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {allUsers.filter(u => messages.find(m => m.id === showReadersId)?.readBy?.includes(u.id) && u.id !== messages.find(m => m.id === showReadersId)?.uid).map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-8 h-8 rounded-full border border-slate-100 shadow-sm" />
                  <span className="text-sm font-bold text-slate-600">{u.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}