import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'; 
import { ArrowLeft, Calendar, Clock, MapPin, Save, Trash2, Plus, X, ChevronDown, Users, CheckCircle, Edit3, CheckSquare, Search, Printer, User, AlertCircle, HelpCircle } from 'lucide-react';
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

  // 1. CARGAR DATOS (Mantenemos tu lógica original)
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
          alert("Evento no encontrado");
          navigate('/calendario');
        }
        setUsers(usersList);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, navigate, currentUser]);

  // --- TODA TU LÓGICA EXISTENTE (NO TOCAMOS NADA) ---
  const openPersonSelector = (roleKey, roleConfig) => {
      setActiveRoleKey(roleKey);
      setActiveRoleConfig(roleConfig);
      setPersonSearchTerm(''); 
      setIsSelectorOpen(true);
  };
  const handleSelectPersonFromModal = (personName) => {
      if (!activeRoleKey || !personName) return;
      const currentList = assignments[activeRoleKey] || [];
      if (activeRoleConfig.type === 'single') {
          setAssignments({ ...assignments, [activeRoleKey]: [personName] });
      } else {
          if (!currentList.includes(personName)) {
              setAssignments({ ...assignments, [activeRoleKey]: [...currentList, personName] });
          }
      }
      setIsSelectorOpen(false); 
  };
  const getUsersForModal = () => {
      if (!activeRoleConfig) return users;
      return users.filter(user => {
          const name = (user.displayName || user.name || '').toLowerCase();
          const search = personSearchTerm.toLowerCase();
          if (!name.includes(search)) return false;
          if (activeRoleConfig.allowedRoles && activeRoleConfig.allowedRoles.includes('pastor')) {
               const uRole = user.role || 'miembro';
               return activeRoleConfig.allowedRoles.includes(uRole);
          }
          if (activeRoleConfig.allowedAreas && activeRoleConfig.allowedAreas.includes('alabanza')) {
              return user.area === 'alabanza';
          }
          return true;
      });
  };
  const handleRemovePersonRole = (roleKey, personName) => {
    const currentList = assignments[roleKey] || [];
    setAssignments({ ...assignments, [roleKey]: currentList.filter(p => p !== personName) });
  };
  const handleToggleTask = async (taskIndex) => {
    const newTasks = [...(event.checklist || [])];
    if (!newTasks[taskIndex]) return;
    newTasks[taskIndex].completed = !newTasks[taskIndex].completed;
    if (newTasks[taskIndex].completed) newTasks[taskIndex].completedBy = currentUser?.displayName || 'Usuario';
    else delete newTasks[taskIndex].completedBy;
    try {
        await updateDoc(doc(db, 'events', id), { checklist: newTasks });
        setEvent(prev => ({ ...prev, checklist: newTasks }));
    } catch (error) { console.error(error); }
  };
  const handleToggleFastingDate = async (dateStr) => {
    if (!myUid) return; 
    const currentFasters = assignments[dateStr] || [];
    let newFasters = currentFasters.includes(myUid) ? currentFasters.filter(uid => uid !== myUid) : [...currentFasters, myUid];
    const newAssignments = { ...assignments, [dateStr]: newFasters };
    setAssignments(newAssignments);
    try { await updateDoc(doc(db, 'events', id), { assignments: newAssignments }); } catch (error) { alert("Error"); }
  };
  const handleSaveAssignments = async () => {
    try {
      await updateDoc(doc(db, 'events', id), { assignments });
      setIsEditing(false);
      alert("✅ Equipo guardado");
    } catch (error) { alert("Error"); }
  };
  const handleDelete = async () => {
    if(!window.confirm("¿Eliminar evento?")) return;
    await deleteDoc(doc(db, 'events', id));
    navigate('/calendario');
  };
  const handlePrint = () => window.print();
  const getAyunoDays = () => {
    if (!event || !event.date) return [];
    try {
        const start = new Date(event.date + 'T00:00:00');
        const end = event.endDate ? new Date(event.endDate + 'T00:00:00') : start;
        return eachDayOfInterval({ start, end });
    } catch (e) { return []; }
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

  if (loading || !event) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center">Cargando...</div>;

  const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
  const isAyuno = event.type === 'ayuno';
  const hasChecklist = TypeConfig.hasChecklist;
  const canEdit = ['pastor', 'lider'].includes(userRole);

  return (
    // ✅ UNIFICACIÓN: Contenedor 'fixed inset-0' para pantalla completa total
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden print:relative print:overflow-visible print:z-auto">
      
      {/* HEADER UNIFICADO (Igual al de PostDetail) */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white flex-shrink-0 print:hidden shadow-sm">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate(-1)} // ✅ TODO UNO: Navegación inteligente
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-800"
          >
            <X size={26} />
          </button>
          {/* Botón Imprimir al lado de cerrar para que sea accesible */}
          <button onClick={handlePrint} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
            <Printer size={20}/>
          </button>
        </div>

        <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">{TypeConfig.label}</span>

        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              {/* Botón eliminar (Solo aparece si estamos editando o es checklist) */}
              {(isEditing || hasChecklist) && (
                <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                  <Trash2 size={20}/>
                </button>
              )}
              {/* Botón Editar/Cancelar */}
              {!isAyuno && !hasChecklist && (
                <button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className={`p-2 rounded-full font-bold text-xs flex items-center gap-1 px-3 ${isEditing ? 'bg-slate-800 text-white' : 'bg-brand-50 text-brand-700'}`}
                >
                  {isEditing ? 'Cerrar' : 'Editar'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* CUERPO SCROLLEABLE */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
        
        {/* Banner de Título (Mantenemos tu estética pero más integrada) */}
        <div className="flex flex-col items-center text-center mb-8">
            <div className={`p-4 rounded-3xl mb-4 ${TypeConfig.color} bg-opacity-10 ring-1 ring-slate-100 shadow-inner`}>
              <TypeConfig.icon size={40} className={TypeConfig.color.replace('bg-', 'text-')} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight mb-4">{event.title}</h1>
            
            <div className="flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-100 px-4 py-2 rounded-xl text-sm font-bold text-slate-600">
                    <Calendar size={16} className="text-slate-400"/>
                    {isAyuno && event.endDate && event.endDate !== event.date 
                        ? `${format(new Date(event.date + 'T00:00:00'), 'd MMM', {locale:es})} - ${format(new Date(event.endDate + 'T00:00:00'), 'd MMM', {locale:es})}`
                        : format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })
                    }
                </div>
                {!isAyuno && (
                  <div className="flex items-center gap-1.5 bg-slate-100 px-4 py-2 rounded-xl text-sm font-bold text-slate-600">
                    <Clock size={16} className="text-slate-400"/>{event.time} hs
                  </div>
                )}
            </div>
        </div>

        <div className="max-w-xl mx-auto space-y-6 print:max-w-none">
          {/* Detalles / Descripción */}
          {event.description && (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 print:bg-white print:border-slate-300">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <MapPin size={16} className="text-brand-500"/> Descripción
                  </h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
          )}

          {/* Checklist (Tareas) */}
          {hasChecklist && event.checklist && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="bg-cyan-50 px-4 py-3 border-b border-cyan-100 flex items-center gap-2">
                     <h3 className="font-black text-cyan-700 text-xs uppercase tracking-widest">Tareas del evento</h3>
                  </div>
                  {event.checklist.map((task, idx) => (
                      <div key={idx} onClick={() => handleToggleTask(idx)} className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 group">
                          <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-cyan-500 border-cyan-500' : 'border-slate-300 group-hover:border-cyan-400'}`}>
                              {task.completed && <CheckSquare size={16} className="text-white" />}
                          </div>
                          <div className="flex-1">
                              <p className={`text-base font-bold transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</p>
                              {task.completed && task.completedBy && <p className="text-[10px] text-cyan-600 font-bold mt-1 uppercase">✓ Por {task.completedBy}</p>}
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {/* Ayuno (Inscripciones) */}
          {isAyuno && (
              <div className="space-y-3">
                  <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><Calendar size={20} className="text-rose-500"/> Calendario de Ayuno</h3>
                  {getAyunoDays().map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const fastersUids = assignments[dateStr] || [];
                      const isJoined = fastersUids.includes(myUid);
                      const isExpanded = expandedDay === dateStr;
                      return (
                          <div key={dateStr} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm print:break-inside-avoid">
                              <div className="p-4 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                      <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border ${isJoined ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                                          <span className="text-[10px] font-bold uppercase text-slate-400">{format(day, 'MMM', {locale: es})}</span>
                                          <span className={`text-lg font-black ${isJoined ? 'text-rose-600' : 'text-slate-700'}`}>{format(day, 'dd')}</span>
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-slate-700 text-sm capitalize">{format(day, 'EEEE', {locale: es})}</h4>
                                          <button onClick={() => setExpandedDay(isExpanded ? null : dateStr)} className="text-[10px] font-bold text-slate-400 hover:text-brand-600 flex items-center gap-1 mt-0.5 uppercase print:hidden">
                                              <Users size={12}/> {fastersUids.length} hermanos <ChevronDown size={10} className={isExpanded ? 'rotate-180' : ''}/>
                                          </button>
                                      </div>
                                  </div>
                                  <button onClick={() => handleToggleFastingDate(dateStr)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm print:hidden ${isJoined ? 'bg-rose-500 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                      {isJoined ? 'Anotado ✓' : 'Sumarme'}
                                  </button>
                              </div>
                              {isExpanded && fastersUids.length > 0 && (
                                  <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex flex-wrap gap-2">
                                      {fastersUids.map(uid => {
                                          const u = users.find(user => user.id === uid);
                                          return <span key={uid} className="text-[10px] bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-600 font-bold shadow-sm">{u?.displayName || u?.name || 'Hermano'}</span>
                                      })}
                                  </div>
                              )}
                          </div>
                      )
                  })}
              </div>
          )}

          {/* Estructura de Equipo (Cultos, etc.) */}
          {!isAyuno && !hasChecklist && getStructure(event.type).map((section, idx) => (
               <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:border-slate-300 print:break-inside-avoid print:mb-6">
                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                     <h3 className="font-black text-slate-700 text-xs uppercase tracking-widest">{section.section}</h3>
                  </div>
                  <div className="p-5 space-y-6">
                    {section.roles.map(role => {
                      const RoleIcon = role.icon;
                      const assignedPeople = assignments[role.key] || [];
                      return (
                        <div key={role.key}>
                          <label className="text-[11px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2 tracking-wider">
                            <RoleIcon size={14} className="text-brand-500" /> {role.label}
                          </label>
                          <div className="flex flex-wrap gap-2">
                              {assignedPeople.length > 0 ? assignedPeople.map((person, i) => {
                                  const statusIcon = getStatusIcon(person);
                                  const isDeclined = event.confirmations?.[person] === 'declined';
                                  return (
                                      <span key={i} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isDeclined ? 'bg-red-50 border-red-100 text-red-400 line-through' : (isEditing ? 'bg-brand-50 text-brand-700 border-brand-100' : 'bg-slate-50 text-slate-800 border-slate-200')}`}>
                                          {person}
                                          {!isEditing && <span className="print:hidden">{statusIcon}</span>}
                                          {isEditing && <button onClick={() => handleRemovePersonRole(role.key, person)} className="p-0.5 hover:bg-brand-200 rounded-full"><X size={14}/></button>}
                                      </span>
                                  )
                              }) : (
                                  <p className="text-[11px] text-slate-300 font-bold uppercase tracking-tight">-- Vacante --</p>
                              )}
                          </div>
                          {isEditing && (role.type === 'multi' || assignedPeople.length === 0) && (
                              <button onClick={() => openPersonSelector(role.key, role)} className="w-full mt-3 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-brand-600 hover:border-brand-300 transition-all flex items-center justify-center gap-1.5">
                                  <Plus size={14}/> {role.type === 'multi' ? 'Añadir persona' : 'Asignar responsable'}
                              </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
               </div>
          ))}
        </div>
      </div>

      {/* BOTÓN GUARDAR FIJO (Solo si editamos) */}
      {isEditing && !isAyuno && !hasChecklist && (
          <div className="p-4 bg-white border-t border-slate-100 absolute bottom-0 w-full flex-shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] print:hidden">
              <button onClick={handleSaveAssignments} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl">
                  <Save size={20}/> GUARDAR EQUIPO
              </button>
          </div>
      )}

      {/* SELECTOR DE PERSONAS (MODAL INTERNO) - SE MANTIENE TU LÓGICA */}
      {isSelectorOpen && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden" onClick={() => setIsSelectorOpen(false)}>
              <div className="bg-white w-full sm:max-w-sm h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-3xl sm:rounded-3xl flex flex-col animate-slide-up shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                      <div><h3 className="font-black text-slate-800 text-lg">Asignar Persona</h3><p className="text-xs text-brand-600 font-bold uppercase tracking-widest">{activeRoleConfig?.label}</p></div>
                      <button onClick={() => setIsSelectorOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
                  </div>
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                          <Search size={18} className="text-slate-400"/>
                          <input type="text" placeholder="Buscar hermano..." className="w-full text-base outline-none text-slate-700" autoFocus value={personSearchTerm} onChange={(e) => setPersonSearchTerm(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
                      {getUsersForModal().map(u => (
                          <button key={u.id} onClick={() => handleSelectPersonFromModal(u.displayName || u.name)} className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left group">
                              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg border-2 border-white shadow-sm overflow-hidden">
                                  {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover"/> : (u.displayName || u.name || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1"><p className="font-black text-slate-800 text-base leading-tight">{u.displayName || u.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{u.area || 'Miembro'}</p></div>
                              <Plus size={20} className="text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"/>
                          </button>
                      ))}
                      {getUsersForModal().length === 0 && <div className="p-10 text-center text-slate-400 italic">No se encontraron personas.</div>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}