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
  Send, MessageSquare, Info, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ServiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [allUsers, setAllUsers] = useState([]); // ✅ Para mapear IDs a Nombres
  const scrollRef = useRef();
  const textareaRef = useRef(); 
  
  const currentUser = auth.currentUser;

  // 1. CARGA INICIAL (Evento, Rol y Usuarios)
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

  // 2. 🔥 GESTIÓN DE MENSAJES Y ACUSE DE RECIBO
  useEffect(() => {
    const q = query(collection(db, `events/${id}/notes`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      // ✅ ACUSE DE RECIBO: Si veo un mensaje y mi UID no está, lo agrego
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

  // Auto-resize del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'; 
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newMessage]);

  // Función de notificaciones segmentadas
  const sendChatNotification = async (text) => {
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

      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: isSenderPastor ? `📝 Nota del Pastor` : `💬 ${currentUser.displayName}`,
          body: text,
          tokens: uniqueTokens,
          url: `/servicios/${id}`
        })
      });
    } catch (e) { console.error(e); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const textToSend = newMessage;
    setNewMessage('');
    try {
      await addDoc(collection(db, `events/${id}/notes`), {
        text: textToSend,
        sender: currentUser.displayName,
        uid: currentUser.uid,
        createdAt: serverTimestamp(),
        readBy: [currentUser.uid] // El emisor ya lo leyó
      });
      sendChatNotification(textToSend);
    } catch (e) { console.error(e); }
  };

  const handleResponse = async (status) => {
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, { [`confirmations.${currentUser.displayName}`]: status, updatedAt: serverTimestamp() });
      setEvent(prev => ({ ...prev, confirmations: { ...prev.confirmations, [currentUser.displayName]: status } }));
    } catch (error) { alert("Error al actualizar"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];

  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in flex flex-col">
      {/* HEADER */}
      <div className="bg-slate-900 text-white pt-20 pb-28 px-6 rounded-b-[50px] shadow-lg relative flex-shrink-0 z-10">
        <button onClick={() => navigate('/servicios')} className="absolute top-10 left-6 p-2 bg-white/10 rounded-full text-white"><ChevronLeft size={26} /></button>
        <div className="mt-2 text-center">
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-400 opacity-80">Panel de Servicio</span>
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
            <div className="flex gap-3">
              <button onClick={() => handleResponse('confirmed')} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg uppercase tracking-wider">Confirmar ✓</button>
              <button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-50 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-wider">No puedo</button>
            </div>
          ) : (
            <div className={`p-5 rounded-2xl flex items-center justify-between border ${myStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
              <span className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">{myStatus === 'confirmed' ? <CheckCircle size={20}/> : <XCircle size={20}/>} {myStatus === 'confirmed' ? 'LISTO PARA SERVIR' : 'AUSENCIA NOTIFICADA'}</span>
              <button onClick={() => handleResponse(null)} className="text-[10px] font-black uppercase underline">Cambiar</button>
            </div>
          )}
        </div>

        {/* 💬 MURO DE NOTAS CON "VISTO POR" */}
        <div className="bg-white rounded-[35px] shadow-xl border border-slate-100 flex flex-col min-h-[520px] max-h-[600px] overflow-hidden mb-4">
          <div className="p-6 border-b border-slate-50 flex flex-col gap-1 bg-slate-50/40">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-500"/> Notas de Equipo
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Coordinación directa con el Pastor.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {messages.map((m) => {
                // Obtenemos los nombres de quienes leyeron el mensaje
                const readers = allUsers
                  .filter(u => m.readBy?.includes(u.id) && u.id !== m.uid)
                  .map(u => u.displayName?.split(' ')[0]);

                return (
                  <div key={m.id} className={`flex flex-col ${m.uid === currentUser.uid ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] px-5 py-3.5 rounded-[22px] text-sm shadow-sm ${m.uid === currentUser.uid ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40'}`}>
                          <p className="font-semibold leading-relaxed whitespace-pre-wrap">{m.text}</p>
                      </div>
                      
                      <div className={`flex items-center gap-2 mt-2 px-1 ${m.uid === currentUser.uid ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-80">{m.sender?.split(' ')[0]}</span>
                        
                        {/* ✅ INDICADOR "LEÍDO POR" */}
                        {readers.length > 0 && (
                          <div className="flex items-center gap-1 text-[8px] font-bold text-slate-300">
                            <Eye size={10} />
                            <span>Visto por {readers.join(', ')}</span>
                          </div>
                        )}
                      </div>
                  </div>
                );
            })}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-5 border-t border-slate-100 flex items-end gap-3 bg-slate-50/50">
            <textarea 
                ref={textareaRef}
                rows="1"
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder="Escribir nota técnica..." 
                className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-brand-500/10 outline-none resize-none max-h-40"
            />
            <button type="submit" className="bg-brand-600 text-white p-4 rounded-2xl shadow-xl active:scale-90 flex-shrink-0"><Send size={22}/></button>
          </form>
        </div>
      </div>
    </div>
  );
}