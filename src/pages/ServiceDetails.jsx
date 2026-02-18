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
  
  const currentUser = auth.currentUser;

  // 1. CARGAR DATOS DEL EVENTO (Tu lógica original)
  useEffect(() => {
    const fetchService = async () => {
      try {
        const docRef = doc(db, 'events', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setEvent({ id: snap.id, ...snap.data() });
        } else {
          navigate('/servicios');
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchService();
  }, [id, navigate]);

  // 2. 🔥 MURO DE NOTAS EN TIEMPO REAL (Punto 2 y 3)
  useEffect(() => {
    const q = query(collection(db, `events/${id}/notes`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Auto-scroll al último mensaje
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [id]);

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
      await updateDoc(eventRef, { 
        [`confirmations.${currentUser.displayName}`]: status,
        updatedAt: serverTimestamp() 
      });
      setEvent(prev => ({ ...prev, confirmations: { ...prev.confirmations, [currentUser.displayName]: status } }));
    } catch (error) { alert("Error al actualizar"); }
  };

  const handleToggleTask = async (idx) => {
    const newChecklist = [...event.checklist];
    newChecklist[idx].completed = !newChecklist[idx].completed;
    newChecklist[idx].completedBy = newChecklist[idx].completed ? currentUser.displayName : null;
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, { checklist: newChecklist, updatedAt: serverTimestamp() });
      setEvent(prev => ({ ...prev, checklist: newChecklist }));
    } catch (error) { console.error(error); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;

  const myRole = Object.keys(event.assignments || {}).find(role => event.assignments[role].includes(currentUser.displayName));
  const myStatus = event.confirmations?.[currentUser.displayName];

  return (
    <div className="min-h-screen bg-slate-50 pb-10 animate-fade-in flex flex-col">
      {/* 🎨 HEADER: Espaciado visual optimizado */}
      <div className="bg-slate-900 text-white pt-12 pb-12 px-6 rounded-b-[40px] shadow-lg relative flex-shrink-0">
        <button onClick={() => navigate('/servicios')} className="absolute top-4 left-4 p-2 bg-white/10 rounded-full text-white"><ChevronLeft size={24} /></button>
        <div className="mt-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-400">Panel de Servicio</span>
          <h1 className="text-2xl font-black mt-1 leading-tight">{event.title}</h1>
          <div className="flex gap-4 mt-4 text-slate-300">
            <div className="flex items-center gap-2 text-xs font-bold"><Calendar size={14} /> {format(new Date(event.date + 'T00:00:00'), "d 'de' MMMM", { locale: es })}</div>
            <div className="flex items-center gap-2 text-xs font-bold"><Clock size={14} /> {event.time} hs</div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-6 -mt-8 space-y-6 flex-1 overflow-y-auto">
        
        {/* CARD DE FUNCIÓN */}
        <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-brand-50 p-3 rounded-2xl text-brand-600"><Users size={24} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Tu función hoy</p>
              <p className="text-lg font-black text-slate-800 capitalize">{myRole?.replace(/_/g, ' ')}</p>
            </div>
          </div>

          {!myStatus ? (
            <div className="flex gap-2">
              <button onClick={() => handleResponse('confirmed')} className="flex-1 bg-brand-600 text-white py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg"><CheckCircle size={16}/> Confirmar</button>
              <button onClick={() => handleResponse('declined')} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2"><XCircle size={16}/> No puedo</button>
            </div>
          ) : (
            <div className={`p-4 rounded-2xl flex items-center justify-between ${myStatus === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span className="text-xs font-bold flex items-center gap-2">{myStatus === 'confirmed' ? <CheckCircle size={16}/> : <XCircle size={16}/>} {myStatus === 'confirmed' ? 'Asistencia Confirmada' : 'Ausencia Notificada'}</span>
              <button onClick={() => handleResponse(null)} className="text-[10px] font-black uppercase underline">Cambiar</button>
            </div>
          )}
        </div>

        {/* CHECKLIST */}
        {event.checklist && event.checklist.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ListChecks size={14}/> Tareas Técnicas</h3>
            </div>
            {event.checklist.map((task, idx) => (
              <div key={idx} onClick={() => handleToggleTask(idx)} className="p-4 flex items-center gap-4 cursor-pointer border-b border-slate-50 last:border-0">
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-brand-500 border-brand-500' : 'border-slate-200'}`}>{task.completed && <CheckCircle size={14} className="text-white" />}</div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</p>
                  {task.completed && <p className="text-[9px] text-brand-600 font-bold uppercase mt-0.5">✓ {task.completedBy || 'Equipo'}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 💬 MURO DE COORDINACIÓN (Chat Privado del Evento) */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[320px] overflow-hidden">
          <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={14}/> Notas de Equipo</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-4">
                    <Info size={24} className="mb-2 opacity-20"/>
                    <p className="text-[11px] font-medium leading-relaxed">Instrucciones del Pastor o avisos técnicos del equipo para este día.</p>
                </div>
            ) : messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.uid === currentUser.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.uid === currentUser.uid ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                        <p className="font-medium leading-snug">{m.text}</p>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 mt-1 px-1 capitalize">{m.sender?.split(' ')[0]}</span>
                </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-50 flex gap-2 bg-white">
            <input 
                type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} 
                placeholder="Escribir nota..." 
                className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none"
            />
            <button type="submit" className="bg-brand-600 text-white p-2 rounded-xl shadow-md active:scale-95"><Send size={18}/></button>
          </form>
        </div>
      </div>
    </div>
  );
}