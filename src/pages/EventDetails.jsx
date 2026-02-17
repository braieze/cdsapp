import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'; 
import { X, Calendar, Clock, MapPin, Save, Trash2, Plus, ChevronDown, Users, CheckCircle, Edit3, CheckSquare, Search, Printer, HelpCircle } from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null); 
  const [isEditing, setIsEditing] = useState(false); 
  const [assignments, setAssignments] = useState({});
  const [expandedDay, setExpandedDay] = useState(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeRoleKey, setActiveRoleKey] = useState(null); 
  const [activeRoleConfig, setActiveRoleConfig] = useState(null); 
  const [personSearchTerm, setPersonSearchTerm] = useState('');

  const currentUser = auth.currentUser;
  const myUid = currentUser?.uid;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setUserRole(userSnap.data().role);

        const eventRef = doc(db, 'events', id);
        const eventSnap = await getDoc(eventRef);
        
        const usersCol = collection(db, 'users');
        const usersSnap = await getDocs(usersCol);
        const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        usersList.sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''));

        if (eventSnap.exists()) {
          const data = eventSnap.data();
          setEvent({ id: eventSnap.id, ...data });
          const rawAssignments = data.assignments || {};
          const normalizedAssignments = {};
          Object.keys(rawAssignments).forEach(key => {
            const val = rawAssignments[key];
            normalizedAssignments[key] = Array.isArray(val) ? val : [val];
          });
          setAssignments(normalizedAssignments);
        } else {
          navigate('/calendario');
        }
        setUsers(usersList);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, navigate, currentUser]);

  // --- LÓGICA DE FUNCIONES MANTENIDA ---
  const handleToggleTask = async (taskIndex) => {
    const newTasks = [...(event.checklist || [])];
    newTasks[taskIndex].completed = !newTasks[taskIndex].completed;
    newTasks[taskIndex].completedBy = newTasks[taskIndex].completed ? currentUser?.displayName : null;
    await updateDoc(doc(db, 'events', id), { checklist: newTasks });
    setEvent(prev => ({ ...prev, checklist: newTasks }));
  };
  const handleToggleFastingDate = async (dateStr) => {
    const currentFasters = assignments[dateStr] || [];
    const newFasters = currentFasters.includes(myUid) ? currentFasters.filter(uid => uid !== myUid) : [...currentFasters, myUid];
    const newAssignments = { ...assignments, [dateStr]: newFasters };
    setAssignments(newAssignments);
    await updateDoc(doc(db, 'events', id), { assignments: newAssignments });
  };
  const handleSaveAssignments = async () => {
    await updateDoc(doc(db, 'events', id), { assignments });
    setIsEditing(false);
    alert("✅ Equipo guardado");
  };
  const handleDelete = async () => {
    if(window.confirm("¿Eliminar evento?")) {
        await deleteDoc(doc(db, 'events', id));
        navigate('/calendario');
    }
  };
  const openPersonSelector = (roleKey, roleConfig) => {
      setActiveRoleKey(roleKey);
      setActiveRoleConfig(roleConfig);
      setIsSelectorOpen(true);
  };
  const handleSelectPersonFromModal = (personName) => {
      const currentList = assignments[activeRoleKey] || [];
      const newList = activeRoleConfig.type === 'single' ? [personName] : [...new Set([...currentList, personName])];
      setAssignments({ ...assignments, [activeRoleKey]: newList });
      setIsSelectorOpen(false); 
  };
  const handleRemovePersonRole = (roleKey, personName) => {
    setAssignments({ ...assignments, [roleKey]: assignments[roleKey].filter(p => p !== personName) });
  };
  const getAyunoDays = () => {
    const start = new Date(event.date + 'T00:00:00');
    const end = event.endDate ? new Date(event.endDate + 'T00:00:00') : start;
    return eachDayOfInterval({ start, end });
  };
  const getStructure = (type) => {
    const config = EVENT_TYPES[type] || EVENT_TYPES.culto;
    if (config.structure === 'same_as_culto') return EVENT_TYPES.culto.structure;
    if (config.structure === 'same_as_limpieza') return EVENT_TYPES.limpieza.structure;
    return config.structure || []; 
  };
  const getStatusIcon = (personName) => {
    if (!event.confirmations) return <HelpCircle size={14} className="text-slate-300"/>;
    const status = event.confirmations[personName];
    if (status === 'confirmed') return <CheckCircle size={14} className="text-green-500"/>;
    if (status === 'declined') return <X size={14} className="text-red-500"/>;
    return <HelpCircle size={14} className="text-slate-300"/>;
};

  if (loading || !event) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
  const isAyuno = event.type === 'ayuno';
  const hasChecklist = TypeConfig.hasChecklist;
  const canEdit = ['pastor', 'lider'].includes(userRole);

  // src/pages/EventDetails.jsx (Trozo corregido del Header y Chips)

// ... (imports y lógica inicial igual)

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden">
      
      {/* BANNER SUPERIOR - Aumentamos padding para dar aire */}
      <div className={`relative pt-12 pb-20 px-6 ${isAyuno ? 'bg-rose-500' : 'bg-slate-900'} print:hidden flex-shrink-0`}>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button onClick={() => navigate('/calendario')} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white"><X size={24} /></button>
            <div className="flex gap-2">
                <button onClick={() => window.print()} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white"><Printer size={20}/></button>
                {canEdit && (
                    <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-2 rounded-full font-bold text-xs ${isEditing ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>
                        {isEditing ? 'Cancelar' : 'Editar'}
                    </button>
                )}
            </div>
        </div>

        <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-4 transform -rotate-3 border-4 border-white/20">
                <TypeConfig.icon size={40} className={isAyuno ? 'text-rose-500' : 'text-slate-800'} />
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase text-white/60 mb-1">{TypeConfig.label}</span>
            <h1 className="text-2xl font-black text-white leading-tight px-4">{event.title}</h1>
        </div>

        {/* CURVA DE FONDO - Ajustamos posición */}
        <div className="absolute -bottom-1 left-0 right-0 h-10 bg-white rounded-t-[40px]"></div>
      </div>

      {/* CUERPO - Eliminamos el -mt-1 para que no se suba tanto */}
      <div className="flex-1 overflow-y-auto bg-white px-6 pb-24">
        <div className="max-w-xl mx-auto space-y-6">
            
            {/* CHIPS DE FECHA - Ahora con más margen superior */}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 border border-slate-100 shadow-sm">
                    <Calendar size={16} className="text-brand-500"/>
                    {isAyuno && event.endDate && event.endDate !== event.date 
                        ? `${format(new Date(event.date + 'T00:00:00'), 'd MMM', {locale:es})} al ${format(new Date(event.endDate + 'T00:00:00'), 'd MMM', {locale:es})}`
                        : format(new Date(event.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })
                    }
                </div>
                {!isAyuno && (
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 border border-slate-100 shadow-sm">
                    <Clock size={16} className="text-brand-500"/>{event.time} hs
                  </div>
                )}
            </div>

            {/* DESCRIPCIÓN - Aseguramos visibilidad */}
            {event.description && (
                <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <MapPin size={14} className="text-brand-500"/> Información adicional
                    </h3>
                    <p className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap font-medium">
                      {event.description}
                    </p>
                </div>
            )}
            
            {/* Render de Ayuno o Estructura de Equipo */}
            {isAyuno ? (
                <div className="space-y-3 pb-10">
                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                        📅 Calendario de Ayuno
                    </h3>
                    {getAyunoDays().map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const fasters = assignments[dateStr] || [];
                        const isJoined = fasters.includes(myUid);
                        const isExpanded = expandedDay === dateStr;
                        return (
                            <div key={dateStr} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                <div className="p-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border ${isJoined ? 'bg-rose-500 border-rose-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                            <span className="text-[8px] font-bold uppercase">{format(day, 'MMM', {locale: es})}</span>
                                            <span className="text-sm font-black">{format(day, 'dd')}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-700 text-sm capitalize">{format(day, 'EEEE', {locale: es})}</h4>
                                            <button onClick={() => setExpandedDay(isExpanded ? null : dateStr)} className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                <Users size={12}/> {fasters.length} hermanos <ChevronDown size={10} className={isExpanded ? 'rotate-180' : ''}/>
                                            </button>
                                        </div>
                                    </div>
                                    <button onClick={() => handleToggleFastingDate(dateStr)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isJoined ? 'bg-rose-100 text-rose-600' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                        {isJoined ? 'Anotado ✓' : 'Sumarme'}
                                    </button>
                                </div>
                                {isExpanded && fasters.length > 0 && (
                                    <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex flex-wrap gap-2">
                                        {fasters.map(uid => {
                                            const u = users.find(user => user.id === uid);
                                            return <span key={uid} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-600 font-bold shadow-sm">{u?.displayName || u?.name || 'Hermano'}</span>
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : hasChecklist ? (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-cyan-50 px-5 py-3 border-b border-cyan-100 flex items-center gap-2">
                        <h3 className="font-black text-cyan-700 text-[11px] uppercase tracking-widest">Lista de Tareas</h3>
                    </div>
                    {event.checklist?.map((task, idx) => (
                        <div key={idx} onClick={() => handleToggleTask(idx)} className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
                            <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-cyan-500 border-cyan-500' : 'border-slate-300'}`}>
                                {task.completed && <CheckSquare size={16} className="text-white" />}
                            </div>
                            <div className="flex-1">
                                <p className={`text-sm font-bold ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</p>
                                {task.completed && task.completedBy && <p className="text-[10px] text-cyan-600 font-bold mt-1 uppercase">✓ {task.completedBy}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                getStructure(event.type).map((section, idx) => (
                    <div key={idx} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-widest">{section.section}</h3>
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(var(--brand-500),0.5)]"></div>
                        </div>
                        <div className="p-5 space-y-5">
                            {section.roles.map(role => {
                                const assigned = assignments[role.key] || [];
                                const RoleIcon = role.icon;
                                return (
                                    <div key={role.key}>
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2 tracking-tighter">
                                            <RoleIcon size={12} className="text-brand-500"/> {role.label}
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {assigned.length > 0 ? assigned.map((p, i) => (
                                                <span key={i} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${isEditing ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                                    {p}
                                                    {!isEditing && <span>{getStatusIcon(p)}</span>}
                                                    {isEditing && <button onClick={() => handleRemovePersonRole(role.key, p)} className="p-0.5 bg-brand-200 rounded-full"><X size={12}/></button>}
                                                </span>
                                            )) : <p className="text-[10px] text-slate-300 italic font-bold">Vacante</p>}
                                            {isEditing && (role.type === 'multi' || assigned.length === 0) && (
                                                <button onClick={() => openPersonSelector(role.key, role)} className="w-full mt-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 hover:bg-slate-50 transition-all uppercase">+ Añadir</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Footer Guardar Fijo (Solo en edición) */}
      {isEditing && !isAyuno && !hasChecklist && (
          <div className="p-4 bg-white border-t border-slate-100 absolute bottom-0 w-full shadow-2xl flex gap-3">
              <button onClick={handleDelete} className="p-4 bg-red-50 text-red-500 rounded-2xl"><Trash2 size={24}/></button>
              <button onClick={handleSaveAssignments} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2">
                  <Save size={20}/> GUARDAR EQUIPO
              </button>
          </div>
      )}

      {/* Selector de Personas (Modal Interno) */}
      {isSelectorOpen && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setIsSelectorOpen(false)}>
              <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b flex justify-between items-center">
                      <h3 className="font-black text-slate-800">Asignar a {activeRoleConfig?.label}</h3>
                      <button onClick={() => setIsSelectorOpen(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-4 bg-slate-50">
                      <div className="bg-white border rounded-2xl px-4 py-2 flex items-center gap-2">
                          <Search size={18} className="text-slate-400"/><input type="text" placeholder="Buscar hermano..." className="w-full text-sm outline-none" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {users.filter(u => (u.displayName || u.name).toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => (
                          <button key={u.id} onClick={() => handleSelectPersonFromModal(u.displayName || u.name)} className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl text-left group">
                              <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm flex items-center justify-center font-bold text-slate-400">
                                  {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover"/> : (u.displayName || u.name || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1"><p className="font-black text-slate-800 text-sm">{u.displayName || u.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{u.area || 'Miembro'}</p></div>
                              <Plus size={16} className="text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"/>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}