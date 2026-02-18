import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  X, Calendar, Clock, CheckCircle, XCircle, 
  ChevronLeft, Loader2, ListChecks, Users, 
  MessageSquare, Info, MapPin 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ServiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

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
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchService();
  }, [id]);

  const handleResponse = async (status) => {
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, { [`confirmations.${currentUser.displayName}`]: status });
      setEvent(prev => ({
        ...prev,
        confirmations: { ...prev.confirmations, [currentUser.displayName]: status }
      }));
    } catch (error) {
      alert("Error al actualizar");
    }
  };

  const handleToggleTask = async (idx) => {
    const newChecklist = [...event.checklist];
    newChecklist[idx].completed = !newChecklist[idx].completed;
    newChecklist[idx].completedBy = newChecklist[idx].completed ? currentUser.displayName : null;
    
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, { checklist: newChecklist });
      setEvent(prev => ({ ...prev, checklist: newChecklist }));
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-brand-600" size={40} />
    </div>
  );

  const myStatus = event.confirmations?.[currentUser.displayName];
  const myRole = Object.keys(event.assignments || {}).find(role => 
    event.assignments[role].includes(currentUser.displayName)
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-32 animate-fade-in">
      {/* HEADER TÉCNICO */}
      <div className="bg-slate-900 text-white pt-12 pb-8 px-6 rounded-b-[40px] shadow-lg relative">
        <button 
          onClick={() => navigate('/servicios')} 
          className="absolute top-4 left-4 p-2 bg-white/10 rounded-full text-white"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="mt-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-400">Tu Servicio</span>
          <h1 className="text-2xl font-black mt-1 leading-tight">{event.title}</h1>
          <div className="flex flex-wrap gap-4 mt-4 text-slate-300">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={16} /> 
              {format(new Date(event.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} /> {event.time} hs
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-6 space-y-6">
        
        {/* CARD: MI ROL Y ESTADO */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-brand-100 p-2.5 rounded-2xl text-brand-600">
                <Users size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Función Asignada</p>
                <p className="text-lg font-bold text-slate-800 capitalize">{myRole?.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>

          {!myStatus ? (
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => handleResponse('confirmed')}
                className="flex-1 bg-brand-600 text-white py-3 rounded-2xl font-bold text-sm shadow-lg shadow-brand-200 flex items-center justify-center gap-2"
              >
                <CheckCircle size={18}/> Confirmar
              </button>
              <button 
                onClick={() => handleResponse('declined')}
                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <XCircle size={18}/> No puedo
              </button>
            </div>
          ) : (
            <div className={`mt-4 p-4 rounded-2xl flex items-center justify-between ${myStatus === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {myStatus === 'confirmed' ? <CheckCircle size={18}/> : <XCircle size={18}/>}
                {myStatus === 'confirmed' ? 'Asistencia Confirmada' : 'No podrás asistir'}
              </div>
              <button onClick={() => handleResponse(null)} className="text-[10px] underline font-black uppercase">Cambiar</button>
            </div>
          )}
        </div>

        {/* CHECKLIST DE TAREAS */}
        {event.checklist && event.checklist.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <ListChecks size={18} className="text-slate-400" />
              <h3 className="font-black text-slate-700 text-xs uppercase tracking-widest">Lista de Tareas</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {event.checklist.map((task, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleToggleTask(idx)}
                  className="p-5 flex items-start gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-brand-500 border-brand-500' : 'border-slate-200'}`}>
                    {task.completed && <CheckCircle size={14} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</p>
                    {task.completed && (
                      <p className="text-[10px] text-brand-600 font-bold mt-1 uppercase">✓ Por {task.completedBy || 'Equipo'}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INFORMACIÓN ADICIONAL */}
        {event.description && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Info size={14} className="text-brand-500"/> Notas del Pastor
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap italic">
              "{event.description}"
            </p>
          </div>
        )}

      </div>
    </div>
  );
}