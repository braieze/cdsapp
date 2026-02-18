import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { 
  Calendar, Clock, CheckCircle, XCircle, 
  ChevronLeft, Loader2, ListChecks, Users, 
  Send, MessageSquare, Info 
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
  const scrollRef = useRef();
  const textareaRef = useRef(); // Para el auto-resize
  
  const currentUser = auth.currentUser;

  // Lógica de carga y mensajes se mantiene igual para estabilidad
  useEffect(() => {
    const fetchService = async () => {
      try {
        const docRef = doc(db, 'events', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) setEvent({ id: snap.id, ...snap.data() });
        else navigate('/servicios');
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchService();
  }, [id, navigate]);

  useEffect(() => {
    const q = query(collection(db, `events/${id}/notes`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [id]);

  // ✅ AUTO-RESIZE DEL TEXTAREA
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newMessage]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, `events/${id}/notes`), {
        text: newMessage,
        sender: currentUser.displayName,
        photo: currentUser.photoURL,
        uid: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
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
    <div className="min-h-screen bg-slate-50 pb-10 animate-fade-in flex flex-col">
      {/* 🎨 HEADER: Reducimos padding para que no se corte arriba */}
      <div className="bg-slate-900 text-white pt-10 pb-10 px-6 rounded-b-[35px] shadow-lg relative flex-shrink-0">
        <button onClick={() => navigate('/servicios')} className="absolute top-4 left-4 p-2 bg-white/10 rounded-full text-white"><ChevronLeft size={24} /></button>
        <div className="mt-4">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-400">Panel de Servicio</span>
          <h1 className="text-2xl font-black mt-1 leading-tight break-words">{event.title}</h1>
          <div className="flex gap-4 mt-3 text-slate-400">
            <div className="flex items-center gap-1.5 text-[11px] font-bold"><Calendar size={13} /> {format(new Date(event.date + 'T00:00:00'), "d 'de' MMMM", { locale: es })}</div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold"><Clock size={13} /> {event.time} hs</div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-5 -mt-6 space-y-5 flex-1 overflow-y-auto">
        
        {/* 🛠 CARD DE FUNCIÓN: Reparada para evitar cortes */}
        <div className="bg-white rounded-[28px] p-5 shadow-xl border border-slate-100">
          <div className="flex items-start gap-4 mb-5">
            <div className="bg-brand-50 p-3 rounded-2xl text-brand-600 flex-shrink-0"><Users size={22} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Tu función hoy</p>
              {/* break-words evita que nombres largos se corten */}
              <p className="text-lg font-black text-slate-800 capitalize leading-tight break-words">{myRole?.replace(/_/g, ' ')}</p>
            </div>
          </div>

          {!myStatus ? (
            <div className="flex gap-2">
              <button onClick={() => handleResponse('confirmed')} className="flex-1 bg-brand-600 text-white py-3 rounded-2xl font-bold text-xs shadow-lg shadow-brand-200 active:scale-95 transition-transform">Confirmar ✓</button>
              <button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-2xl font-bold text-xs active:scale-95 transition-transform">No puedo</button>
            </div>
          ) : (
            <div className={`p-4 rounded-2xl flex items-center justify-between ${myStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              <span className="text-xs font-black flex items-center gap-2">{myStatus === 'confirmed' ? <CheckCircle size={16}/> : <XCircle size={16}/>} {myStatus === 'confirmed' ? 'LISTO PARA SERVIR' : 'AUSENCIA NOTIFICADA'}</span>
              <button onClick={() => handleResponse(null)} className="text-[10px] font-black uppercase underline decoration-2">Cambiar</button>
            </div>
          )}
        </div>

        {/* 💬 MURO DE NOTAS: Corregido el input y las burbujas */}
        <div className="bg-white rounded-[28px] shadow-sm border border-slate-100 flex flex-col h-[380px] overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={14} className="text-brand-500"/> Notas de Equipo</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-6">
                    <Info size={24} className="mb-2 opacity-20"/>
                    <p className="text-[11px] font-medium leading-relaxed italic">Espacio para instrucciones del Pastor o avisos del equipo.</p>
                </div>
            ) : messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.uid === currentUser.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.uid === currentUser.uid ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                        <p className="font-medium leading-snug">{m.text}</p>
                    </div>
                    {/* Nombre más pegado a la burbuja y sutil */}
                    <span className="text-[9px] font-bold text-slate-300 mt-1 px-1 uppercase tracking-tighter">{m.sender?.split(' ')[0]}</span>
                </div>
            ))}
            <div ref={scrollRef} />
          </div>

          {/* ✅ FORMULARIO CON TEXTAREA AUTO-AJUSTABLE */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-50 flex items-end gap-2 bg-slate-50/50">
            <textarea 
                ref={textareaRef}
                rows="1"
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder="Escribir nota..." 
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none max-h-32 transition-all"
            />
            <button type="submit" className="bg-brand-600 text-white p-3 rounded-xl shadow-md active:scale-90 transition-transform flex-shrink-0">
                <Send size={18}/>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}