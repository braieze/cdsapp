import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'; 
import { ArrowLeft, Calendar, Clock, MapPin, Save, Trash2, Plus, X, ChevronDown, Users, CheckCircle, Edit3, CheckSquare, Search, Printer, User } from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Estado de permisos y edición
  const [userRole, setUserRole] = useState(null); 
  const [isEditing, setIsEditing] = useState(false); 
  
  const [assignments, setAssignments] = useState({});
  const [expandedDay, setExpandedDay] = useState(null);

  // ESTADOS PARA EL MODAL DE SELECCIÓN DE PERSONAS
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeRoleKey, setActiveRoleKey] = useState(null); // Qué rol estamos editando (ej: 'bateria')
  const [activeRoleConfig, setActiveRoleConfig] = useState(null); // Config del rol (para filtros)
  const [personSearchTerm, setPersonSearchTerm] = useState(''); // Buscador del modal

  // ✅ CORRECCIÓN: Definimos el usuario AQUÍ ARRIBA
  const currentUser = auth.currentUser;
  const myUid = currentUser?.uid;

  // 1. CARGAR DATOS
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

  // --- LÓGICA DEL MODAL DE SELECCIÓN ---
  const openPersonSelector = (roleKey, roleConfig) => {
      setActiveRoleKey(roleKey);
      setActiveRoleConfig(roleConfig);
      setPersonSearchTerm(''); // Reiniciar búsqueda
      setIsSelectorOpen(true);
  };

  const handleSelectPersonFromModal = (personName) => {
      if (!activeRoleKey || !personName) return;
      
      const currentList = assignments[activeRoleKey] || [];
      
      // Si es "single", reemplazamos. Si es "multi", agregamos.
      if (activeRoleConfig.type === 'single') {
          setAssignments({ ...assignments, [activeRoleKey]: [personName] });
      } else {
          if (!currentList.includes(personName)) {
              setAssignments({ ...assignments, [activeRoleKey]: [...currentList, personName] });
          }
      }
      setIsSelectorOpen(false); // Cerrar modal
  };

  // --- FILTRO DE USUARIOS (MODAL) ---
  const getUsersForModal = () => {
      if (!activeRoleConfig) return users;

      return users.filter(user => {
          const name = (user.displayName || user.name || '').toLowerCase();
          const search = personSearchTerm.toLowerCase();
          
          // 1. Filtro de Texto (Buscador)
          if (!name.includes(search)) return false;

          // 2. Filtro de Lógica de Negocio
          // Si es un rol de LIDERAZGO (Pastor/Lider), filtramos estricto.
          if (activeRoleConfig.allowedRoles && activeRoleConfig.allowedRoles.includes('pastor')) {
               const uRole = user.role || 'miembro';
               return activeRoleConfig.allowedRoles.includes(uRole);
          }

          // Si es ALABANZA, filtramos por área (para que no salgan todos en Batería)
          if (activeRoleConfig.allowedAreas && activeRoleConfig.allowedAreas.includes('alabanza')) {
              return user.area === 'alabanza';
          }

          // PARA TODO LO DEMÁS (Operativo, Multimedia, Ujieres): MOSTRAR TODOS
          // Esto soluciona tu problema de que no podías asignar a nadie.
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
    if (newTasks[taskIndex].completed) {
        newTasks[taskIndex].completedBy = currentUser?.displayName || 'Usuario';
    } else {
        delete newTasks[taskIndex].completedBy;
    }
    try {
        const eventRef = doc(db, 'events', id);
        await updateDoc(eventRef, { checklist: newTasks });
        setEvent(prev => ({ ...prev, checklist: newTasks }));
    } catch (error) { console.error(error); }
  };

  const handleToggleFastingDate = async (dateStr) => {
    if (!myUid) return; 
    const currentFasters = assignments[dateStr] || [];
    let newFasters;
    if (currentFasters.includes(myUid)) newFasters = currentFasters.filter(uid => uid !== myUid);
    else newFasters = [...currentFasters, myUid];

    const newAssignments = { ...assignments, [dateStr]: newFasters };
    setAssignments(newAssignments);
    try {
        const eventRef = doc(db, 'events', id);
        await updateDoc(eventRef, { assignments: newAssignments });
    } catch (error) { alert("Error de conexión"); }
  };

  const handleSaveAssignments = async () => {
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, { assignments });
      setIsEditing(false);
      alert("✅ Equipo guardado exitosamente");
    } catch (error) { alert("Error al guardar"); }
  };

  const handleDelete = async () => {
    if(!window.confirm("¿Seguro que quieres eliminar este evento?")) return;
    try {
        await deleteDoc(doc(db, 'events', id));
        navigate('/calendario');
    } catch (error) { console.error(error); }
  };

  // Función PDF / Imprimir
  const handlePrint = () => {
      window.print(); // Abre el diálogo nativo del celular/PC para guardar como PDF
  };

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

  if (loading || !event) return <div className="p-10 text-center">Cargando...</div>;

  const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
  const isAyuno = event.type === 'ayuno';
  const hasChecklist = TypeConfig.hasChecklist;
  const canEdit = ['pastor', 'lider'].includes(userRole);

  return (
    <div className="pb-32 bg-slate-50 min-h-screen animate-fade-in relative print:bg-white print:pb-0">
      
      {/* HEADER (Oculto al imprimir) */}
      <div className={`relative px-4 pt-12 pb-8 ${TypeConfig.color.replace('text-', 'bg-').replace('100', '50')} border-b border-slate-100 print:hidden`}>
        <button onClick={() => navigate('/calendario')} className="absolute top-4 left-4 p-2 bg-white/50 backdrop-blur-md rounded-full hover:bg-white transition-colors shadow-sm">
          <ArrowLeft size={20} className="text-slate-700"/>
        </button>
        
        {/* Botón PDF / Imprimir */}
        <button onClick={handlePrint} className="absolute top-4 right-16 p-2 bg-white/50 backdrop-blur-md rounded-full hover:bg-white transition-colors text-slate-700 shadow-sm">
            <Printer size={20}/>
        </button>

        {canEdit && !isAyuno && !hasChecklist && (
            <button 
                onClick={() => setIsEditing(!isEditing)} 
                className={`absolute top-4 right-4 p-2 rounded-full transition-colors flex items-center gap-2 px-3 text-xs font-bold ${isEditing ? 'bg-slate-800 text-white' : 'bg-white/50 text-slate-700 hover:bg-white'}`}
            >
                {isEditing ? <><X size={16}/> Cancelar</> : <><Edit3 size={16}/> Editar</>}
            </button>
        )}
        
        {hasChecklist && canEdit && (
             <button onClick={handleDelete} className="absolute top-4 right-4 p-2 text-red-500 bg-white/50 hover:bg-red-50 rounded-full transition-colors">
                 <Trash2 size={20}/>
            </button>
        )}

        {isEditing && (
            <button onClick={handleDelete} className="absolute top-4 right-28 p-2 text-red-500 bg-white/50 hover:bg-red-50 rounded-full transition-colors">
                 <Trash2 size={20}/>
            </button>
        )}

        <div className="flex flex-col items-center text-center mt-2">
            <div className={`p-4 rounded-2xl mb-4 bg-white shadow-sm ${TypeConfig.color} ring-4 ring-white`}>
                <TypeConfig.icon size={32} />
            </div>
            <span className={`text-[10px] font-black tracking-widest uppercase mb-2 px-3 py-1 rounded-full bg-white/60 ${TypeConfig.color.split(' ')[1]}`}>
                {TypeConfig.label}
            </span>
            <h1 className="text-2xl font-black text-slate-800 leading-tight px-4">{event.title}</h1>
            
            <div className="flex items-center gap-4 mt-4 text-sm font-medium text-slate-600">
                <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-lg shadow-sm">
                    <Calendar size={14} className="text-slate-400"/>
                    {isAyuno && event.endDate && event.endDate !== event.date 
                        ? `${format(new Date(event.date + 'T00:00:00'), 'd MMM', {locale:es})} - ${format(new Date(event.endDate + 'T00:00:00'), 'd MMM', {locale:es})}`
                        : format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })
                    }
                </div>
                {!isAyuno && (
                    <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-lg shadow-sm"><Clock size={14} className="text-slate-400"/>{event.time} hs</div>
                )}
            </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6 print:p-0 print:max-w-none">
        
        {event.description && (
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm print:border-none print:shadow-none print:p-0 print:mb-4">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm"><MapPin size={16} className="text-brand-500"/> Detalles</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>
            </div>
        )}

        {/* --- CHECKLIST --- */}
        {hasChecklist && event.checklist && event.checklist.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in print:border-slate-300">
                <div className="bg-cyan-50/50 px-4 py-3 border-b border-cyan-100 flex items-center gap-2">
                   <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
                   <h3 className="font-black text-cyan-700 text-sm uppercase tracking-wide">Lista de Tareas</h3>
                </div>
                <div>
                    {event.checklist.map((task, idx) => (
                        <div key={idx} onClick={() => handleToggleTask(idx)} className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group">
                            <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-cyan-500 border-cyan-500' : 'border-slate-300 group-hover:border-cyan-400'}`}>
                                {task.completed ? <CheckSquare size={14} className="text-white" /> : null}
                            </div>
                            <div className="flex-1">
                                <p className={`text-sm font-bold transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</p>
                                {task.completed && task.completedBy && <p className="text-[10px] text-cyan-600 font-bold mt-1">Completado por {task.completedBy}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- AYUNO --- */}
        {isAyuno && (
            <div className="space-y-3">
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><Calendar size={20} className="text-rose-500"/> Días de Ayuno</h3>
                {getAyunoDays().map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const fastersUids = assignments[dateStr] || [];
                    const isJoined = fastersUids.includes(myUid);
                    const isExpanded = expandedDay === dateStr;
                    return (
                        <div key={dateStr} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm transition-all print:break-inside-avoid">
                            <div className="p-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${isJoined ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <span className="text-[10px] font-bold uppercase text-slate-400">{format(day, 'MMM', {locale: es})}</span>
                                        <span className={`text-lg font-black ${isJoined ? 'text-rose-600' : 'text-slate-700'}`}>{format(day, 'dd')}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-700 text-sm capitalize">{format(day, 'EEEE', {locale: es})}</h4>
                                        <button onClick={() => setExpandedDay(isExpanded ? null : dateStr)} className="text-xs text-slate-400 hover:text-brand-600 flex items-center gap-1 mt-0.5 group print:hidden">
                                            <Users size={12}/> {fastersUids.length} hermanos <ChevronDown size={10} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}/>
                                        </button>
                                        <span className="hidden print:inline text-xs text-slate-500"> - {fastersUids.length} inscritos</span>
                                    </div>
                                </div>
                                <button onClick={() => handleToggleFastingDate(dateStr)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 print:hidden ${isJoined ? 'bg-rose-500 text-white shadow-rose-200' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                    {isJoined ? <><CheckCircle size={12}/> Anotado</> : 'Sumarme'}
                                </button>
                            </div>
                            {/* En impresión mostramos siempre la lista */}
                            {(isExpanded || (window.matchMedia && window.matchMedia('print').matches)) && fastersUids.length > 0 && (
                                <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 print:bg-white">
                                    <div className="flex flex-wrap gap-2">
                                        {fastersUids.map(uid => {
                                            const u = users.find(user => user.id === uid);
                                            return <span key={uid} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-600 font-bold shadow-sm">{u?.displayName || u?.name || 'Hermano'}</span>
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )}

        {/* --- CULTOS --- */}
        {!isAyuno && !hasChecklist && getStructure(event.type).map((section, idx) => (
             <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:shadow-none print:border-slate-300 print:break-inside-avoid print:mb-4">
                <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center gap-2 print:bg-slate-100">
                   <div className="w-1 h-4 bg-brand-500 rounded-full"></div>
                   <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">{section.section}</h3>
                </div>
                <div className="p-4 space-y-5">
                  {section.roles.map(role => {
                    const RoleIcon = role.icon;
                    const assignedPeople = assignments[role.key] || [];
                    
                    return (
                      <div key={role.key}>
                        <label className="text-[11px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                          <RoleIcon size={12} /> {role.label}
                        </label>
                        
                        {/* LISTA DE PERSONAS */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            {assignedPeople.length > 0 ? assignedPeople.map((person, i) => (
                                <span key={i} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border ${isEditing ? 'bg-brand-50 text-brand-700 border-brand-100' : 'bg-slate-50 text-slate-700 border-slate-200'} print:bg-white print:border-slate-300`}>
                                    {person}
                                    {isEditing && <button onClick={() => handleRemovePersonRole(role.key, person)} className="p-0.5 hover:bg-brand-200 rounded-full print:hidden"><X size={12}/></button>}
                                </span>
                            )) : (
                                <p className="text-xs text-slate-300 italic print:hidden">-- Sin asignar --</p>
                            )}
                        </div>

                        {/* BOTÓN AGREGAR (REEMPLAZA AL SELECT) */}
                        {isEditing && (role.type === 'multi' || assignedPeople.length === 0) && (
                            <button 
                                onClick={() => openPersonSelector(role.key, role)}
                                className="w-full py-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-brand-600 transition-colors flex items-center justify-center gap-1 print:hidden"
                            >
                                <Plus size={14}/> {role.type === 'multi' ? 'Agregar persona...' : 'Seleccionar responsable...'}
                            </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
        ))}

        {isEditing && !isAyuno && !hasChecklist && (
            <button onClick={handleSaveAssignments} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-slate-200 active:scale-95 transition-all sticky bottom-4 z-20 animate-slide-up print:hidden">
                <Save size={18}/> Guardar Cambios
            </button>
        )}
      </div>

      {/* --- MODAL SELECTOR DE PERSONAS --- */}
      {isSelectorOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden" onClick={() => setIsSelectorOpen(false)}>
              <div className="bg-white w-full sm:max-w-sm h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
                  
                  {/* Modal Header */}
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl">
                      <div>
                          <h3 className="font-bold text-slate-800">Seleccionar Persona</h3>
                          <p className="text-xs text-slate-400 capitalize">{activeRoleKey?.replace('_', ' ')}</p>
                      </div>
                      <button onClick={() => setIsSelectorOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={18} className="text-slate-600"/></button>
                  </div>

                  {/* Search Bar */}
                  <div className="p-3 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                          <Search size={16} className="text-slate-400"/>
                          <input 
                              type="text" 
                              placeholder="Buscar por nombre..." 
                              className="w-full text-sm outline-none text-slate-700 placeholder:text-slate-400"
                              autoFocus
                              value={personSearchTerm}
                              onChange={(e) => setPersonSearchTerm(e.target.value)}
                          />
                      </div>
                  </div>

                  {/* Users List */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {getUsersForModal().map(u => (
                          <button 
                              key={u.id} 
                              onClick={() => handleSelectPersonFromModal(u.displayName || u.name)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors text-left group"
                          >
                              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm border-2 border-white shadow-sm group-hover:border-slate-200">
                                  {u.photoURL ? <img src={u.photoURL} className="w-full h-full rounded-full object-cover"/> : (u.displayName || u.name || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1">
                                  <p className="text-sm font-bold text-slate-800">{u.displayName || u.name || 'Sin Nombre'}</p>
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{u.area || 'Miembro'}</p>
                              </div>
                              <Plus size={16} className="text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"/>
                          </button>
                      ))}
                      {getUsersForModal().length === 0 && (
                          <div className="p-10 text-center text-slate-400 text-sm">
                              No se encontraron personas.
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}