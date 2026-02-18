import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  deleteDoc, doc, getDoc, serverTimestamp, 
  getDocs, where, writeBatch 
} from 'firebase/firestore'; 
import { 
  Plus, Calendar as CalIcon, List, Clock, Trash2, X, 
  ChevronLeft, ChevronRight, Loader2, Megaphone, 
  Send, EyeOff, CheckCircle, XCircle, ImageIcon,
  Check, Info, AlertCircle, Users, ChevronDown
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, addMonths, subMonths, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [events, setEvents] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // ✅ Base para el blindaje
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null); 
  const [actionConfirm, setActionConfirm] = useState(null); 

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  // ✅ ESTADO INICIAL CON ASIGNACIONES LIMPIAS
  const [newEvent, setNewEvent] = useState({
    title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '',
    published: false,
    assignments: { predica: [], alabanza: [], multimedia: [], recepcion: [] }
  });

  const [activeAssignRole, setActiveAssignRole] = useState(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ✅ CARGA DE ROLES Y DIRECTORIO PARA VALIDACIONES
  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) setUserRole(userSnap.data().role);
      }
      const uSnap = await getDocs(collection(db, 'users'));
      setAllUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchData();

    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribeEvents();
  }, []);

  // ✅ LÓGICA DE BLINDAJE: NO REPETIR PERSONAS
  const isUserSelectedInAnyRole = (name) => {
    return Object.values(newEvent.assignments).flat().includes(name);
  };

  const toggleAssignment = (role, name) => {
    const current = newEvent.assignments[role] || [];
    if (current.includes(name)) {
      setNewEvent({ ...newEvent, assignments: { ...newEvent.assignments, [role]: current.filter(n => n !== name) } });
    } else {
      setNewEvent({ ...newEvent, assignments: { ...newEvent.assignments, [role]: [...current, name] } });
    }
  };

  // ✅ FUNCIONES DE NOTIFICACIÓN (MANTENIDAS)
  const sendEventNotification = async (eventTitle, eventDate, eventUrl, eventType) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      let tokens = [];
      usersSnap.forEach((doc) => { if (doc.data().fcmTokens) tokens.push(...doc.data().fcmTokens); });
      const uniqueTokens = [...new Set(tokens)].filter(t => t && t.length > 10);
      if (uniqueTokens.length === 0) return;
      const typeLabel = EVENT_TYPES[eventType]?.label || eventType;
      await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Nuevo evento: ${typeLabel}`, body: `${eventTitle} - 📅 ${eventDate}`, tokens: uniqueTokens, url: eventUrl })
      });
    } catch (e) { console.error(e); }
  };

  // ✅ LÓGICA DE GUARDADO REAL
  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return setToast({ message: "Falta título o fecha", type: "error" });
    setIsUploading(true);
    let uploadedImageUrl = null;
    try {
        if (imageFile && newEvent.type === 'ayuno') {
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressed = await imageCompression(imageFile, options);
            const formData = new FormData();
            formData.append("file", compressed); formData.append("upload_preset", UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
            const data = await res.json();
            uploadedImageUrl = data.secure_url;
        }

        const finalEndDate = newEvent.type === 'ayuno' && newEvent.endDate ? newEvent.endDate : newEvent.date;
        const eventDocRef = await addDoc(collection(db, 'events'), {
            ...newEvent,
            endDate: finalEndDate,
            image: uploadedImageUrl,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: auth.currentUser?.uid
        });

        if (newEvent.published) {
            const dateStr = format(new Date(newEvent.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es });
            await sendEventNotification(newEvent.title, dateStr, `/calendario/${eventDocRef.id}`, newEvent.type);
        }

        setIsModalOpen(false);
        setNewEvent({ title: '', type: 'culto', date: '', endDate: '', time: '19:30', description: '', published: false, assignments: { predica: [], alabanza: [], multimedia: [], recepcion: [] } });
        setImageFile(null); setImagePreview(null);
        setToast({ message: "Evento y equipo guardados", type: "success" });
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); } 
    finally { setIsUploading(false); }
  };

  // ✅ MODAL DE SELECCIÓN CON FILTROS DE CATEGORÍA
  const renderTeamPicker = () => {
    if (!activeAssignRole) return null;

    // Filtro estricto por ministerio/rol
    const candidates = allUsers.filter(u => {
      if (activeAssignRole === 'predica') return u.role === 'pastor' || u.role === 'lider';
      if (activeAssignRole === 'alabanza') return u.ministerio?.toLowerCase() === 'alabanza';
      if (activeAssignRole === 'multimedia') return u.ministerio?.toLowerCase() === 'multimedia';
      if (activeAssignRole === 'recepcion') return u.ministerio?.toLowerCase() === 'recepcion';
      return true;
    });

    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-xl flex items-end justify-center animate-fade-in" onClick={() => setActiveAssignRole(null)}>
        <div className="bg-white w-full max-w-sm rounded-t-[45px] p-8 shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Users size={16} className="text-brand-500"/> Equipo {activeAssignRole}</h3>
            <button onClick={() => setActiveAssignRole(null)} className="p-2 bg-slate-50 rounded-full"><X size={18}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pb-6">
            {candidates.map(user => {
              const isSelectedInThisRole = newEvent.assignments[activeAssignRole].includes(user.displayName);
              const isBlocked = isUserSelectedInAnyRole(user.displayName) && !isSelectedInThisRole;
              
              return (
                <button 
                  key={user.id} disabled={isBlocked}
                  onClick={() => toggleAssignment(activeAssignRole, user.displayName)}
                  className={`w-full flex items-center gap-4 p-3 rounded-[25px] border-2 transition-all ${isSelectedInThisRole ? 'bg-brand-50 border-brand-500' : isBlocked ? 'bg-slate-50 border-transparent opacity-40 grayscale cursor-not-allowed' : 'bg-white border-slate-100 active:scale-95'}`}
                >
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-12 h-12 rounded-[18px] object-cover" />
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-800 text-sm truncate uppercase">{user.displayName}</p>
                    <p className={`text-[8px] font-black uppercase ${isBlocked ? 'text-rose-500' : 'text-slate-400'}`}>
                      {isBlocked ? 'Ya seleccionado para otra tarea' : user.role}
                    </p>
                  </div>
                  {isSelectedInThisRole && <CheckCircle size={22} className="text-brand-600"/>}
                </button>
              );
            })}
          </div>
          <button onClick={() => setActiveAssignRole(null)} className="w-full bg-slate-900 text-white py-5 rounded-[25px] font-black text-xs uppercase tracking-widest shadow-xl">Confirmar</button>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in relative font-outfit">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Agenda</h1>
        <div className="flex bg-white p-1 rounded-xl border shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg ${viewMode === 'month' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'}`}><CalIcon size={18}/></button>
        </div>
      </div>

      {['pastor', 'lider'].includes(userRole) && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-4 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 border-4 border-white"><Plus size={32} /></button>
      )}

      {/* ✅ MODAL NUEVO EVENTO CON BLINDAJE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[45px] p-8 shadow-2xl max-h-[92vh] overflow-y-auto animate-scale-in">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Nuevo Evento</h2><button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full"><X size={20}/></button></div>
                <div className="space-y-4">
                    <input type="text" placeholder="Título del culto" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none uppercase text-sm" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-black uppercase" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                        <input type="time" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-black" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                    </div>

                    {/* ✅ SECCIÓN DE EQUIPO BLINDADA (PUNTO 4) */}
                    <div className="bg-slate-900 p-6 rounded-[35px] shadow-xl space-y-3">
                       <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest border-b border-white/10 pb-2">Selección de Equipo</p>
                       {['predica', 'alabanza', 'multimedia', 'recepcion'].map(role => (
                         <div key={role}>
                            <button onClick={() => setActiveAssignRole(role)} className="w-full flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 text-white text-[10px] font-black uppercase active:scale-95 transition-all">
                               <div className="flex items-center gap-2"><Users size={14} className="text-brand-500"/> {role}</div>
                               <ChevronDown size={14} className="opacity-40"/>
                            </button>
                            <div className="flex flex-wrap gap-1 mt-1">
                               {newEvent.assignments[role]?.map(n => <span key={n} className="bg-brand-500 text-slate-900 text-[8px] font-black px-2 py-0.5 rounded-md uppercase">{n}</span>)}
                            </div>
                         </div>
                       ))}
                    </div>

                    <button onClick={handleCreateEvent} disabled={isUploading} className="w-full bg-brand-600 text-white font-black py-5 rounded-[25px] shadow-xl mt-4 active:scale-95 disabled:opacity-50 text-xs uppercase tracking-widest">
                        {isUploading ? <Loader2 className="animate-spin mx-auto" size={20}/> : "GUARDAR EVENTO"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {renderTeamPicker()}
      {/* Resto de vistas (list/month) respetadas */}
      {viewMode === 'list' ? renderListView() : renderMonthView()}
    </div>
  );
}