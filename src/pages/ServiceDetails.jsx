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
  const textareaRef = useRef(); 
  
  const currentUser = auth.currentUser;

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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'; 
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = scrollHeight + 'px';
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
    <div className="min-h-screen bg-slate-50 animate-fade-in flex flex-col">
      {/* 🎨 HEADER: Corregido para bajar el contenido y que NO se corte */}
      <div className="bg-slate-900 text-white pt-20 pb-28 px-6 rounded-b-[50px] shadow-lg relative flex-shrink-0 z-10">
        <button 
          onClick={() => navigate('/servicios')} 
          className="absolute top-10 left-6 p-2 bg-white/10 rounded-full text-white active:scale-90 transition-transform"
        >
          <ChevronLeft size={26} />
        </button>
        <div className="mt-2 text-center">
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-400 opacity-80">Panel de Servicio</span>
          <h1 className="text-4xl font-black mt-2 leading-tight drop-shadow-sm">{event.title}</h1>
          <div className="flex justify-center gap-6 mt-4 text-slate-400">
            <div className="flex items-center gap-2 text-xs font-bold bg-white/5 px-3 py-1.5 rounded-full border border-white/5"><Calendar size={14} /> {format(new Date(event.date + 'T00:00:00'), "d 'de' MMMM", { locale: es })}</div>
            <div className="flex items-center gap-2 text-xs font-bold bg-white/5 px-3 py-1.5 rounded-full border border-white/5"><Clock size={14} /> {event.time} hs</div>
          </div>
        </div>
      </div>

      {/* CUERPO PRINCIPAL */}
      <div className="max-w-md mx-auto w-full px-5 -mt-14 space-y-6 flex-1 overflow-y-auto pb-10 z-20">
        
        {/* 🛠 CARD DE FUNCIÓN: Espacio garantizado */}
        <div className="bg-white rounded-[35px] p-7 shadow-2xl border border-slate-100/50">
          <div className="flex items-center gap-5 mb-6">
            <div className="bg-brand-50 p-4 rounded-3xl text-brand-600 flex-shrink-0"><Users size={28} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu función hoy</p>
              <p className="text-2xl font-black text-slate-800 capitalize leading-tight break-words">
                {myRole?.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          {!myStatus ? (
            <div className="flex gap-3">
              <button onClick={() => handleResponse('confirmed')} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg shadow-brand-200 active:scale-95 transition-all uppercase tracking-wider">Confirmar ✓</button>
              <button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-50 text-slate-400 py-4 rounded-2xl font-black text-xs active:scale-95 transition-all uppercase tracking-wider">No puedo</button>
            </div>
          ) : (
            <div className={`p-5 rounded-2xl flex items-center justify-between border ${myStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
              <span className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                {myStatus === 'confirmed' ? <CheckCircle size={20}/> : <XCircle size={20}/>} 
                {myStatus === 'confirmed' ? 'LISTO PARA SERVIR' : 'AUSENCIA NOTIFICADA'}
              </span>
              <button onClick={() => handleResponse(null)} className="text-[10px] font-black uppercase underline decoration-2 underline-offset-4">Cambiar</button>
            </div>
          )}
        </div>

        {/* 💬 MURO DE NOTAS: Altura mejorada para lectura larga */}
        <div className="bg-white rounded-[35px] shadow-xl border border-slate-100 flex flex-col min-h-[520px] max-h-[600px] overflow-hidden mb-4">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/40">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-500"/> Notas de Equipo
            </h3>
            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-10">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <Info size={30} className="opacity-20 text-slate-400"/>
                    </div>
                    <p className="text-xs font-bold leading-relaxed italic uppercase tracking-tighter opacity-60">Instrucciones o avisos técnicos</p>
                </div>
            ) : messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.uid === currentUser.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] px-5 py-3.5 rounded-[22px] text-sm shadow-sm ${
                        m.uid === currentUser.uid 
                        ? 'bg-amber-600 text-white rounded-tr-none' 
                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40'
                    }`}>
                        <p className="font-semibold leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 mt-2 px-1 uppercase tracking-widest opacity-80">
                        {m.sender?.split(' ')[0]}
                    </span>
                </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-5 border-t border-slate-100 flex items-end gap-3 bg-slate-50/50">
            <textarea 
                ref={textareaRef}
                rows="1"
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder="Escribir nota..." 
                className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none resize-none max-h-40 transition-all leading-snug shadow-inner"
            />
            <button type="submit" className="bg-brand-600 text-white p-4 rounded-2xl shadow-xl active:scale-90 transition-transform flex-shrink-0">
                <Send size={22}/>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}