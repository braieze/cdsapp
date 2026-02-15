import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ArrowLeft, Calendar, Clock, MapPin, Save, Trash2, Plus, X, AlertCircle } from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // assignments ahora guardará ARRAYS de nombres: { voces: ['Juan', 'Pedro'], predicador: ['Pastor'] }
  const [assignments, setAssignments] = useState({});

  // 1. CARGAR DATOS
  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventRef = doc(db, 'events', id);
        const eventSnap = await getDoc(eventRef);
        
        const usersCol = collection(db, 'users');
        const usersSnap = await getDocs(usersCol);
        const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        usersList.sort((a, b) => {
            const nameA = a.displayName || a.name || 'Sin Nombre';
            const nameB = b.displayName || b.name || 'Sin Nombre';
            return nameA.localeCompare(nameB);
        });

        if (eventSnap.exists()) {
          const data = eventSnap.data();
          setEvent({ id: eventSnap.id, ...data });
          
          // Compatibilidad: Si venía del sistema viejo (string), lo convertimos a array
          const rawAssignments = data.assignments || {};
          const normalizedAssignments = {};
          Object.keys(rawAssignments).forEach(key => {
            const val = rawAssignments[key];
            normalizedAssignments[key] = Array.isArray(val) ? val : [val]; // Forzar Array
          });
          setAssignments(normalizedAssignments);

        } else {
          alert("Evento no encontrado");
          navigate('/calendario');
        }
        setUsers(usersList);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  // 2. LOGICA DE ASIGNACIÓN (Multi y Single)
  const handleAddPerson = (roleKey, personName) => {
    if (!personName) return;
    const currentList = assignments[roleKey] || [];
    
    // Evitar duplicados
    if (!currentList.includes(personName)) {
      setAssignments({ ...assignments, [roleKey]: [...currentList, personName] });
    }
  };

  const handleRemovePerson = (roleKey, personName) => {
    const currentList = assignments[roleKey] || [];
    setAssignments({ 
      ...assignments, 
      [roleKey]: currentList.filter(p => p !== personName) 
    });
  };

  const handleSaveAssignments = async () => {
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, { assignments });
      alert("✅ Equipo guardado exitosamente");
    } catch (error) {
      console.error(error);
      alert("Error al guardar");
    }
  };

  // Lógica Ayuno (Simplificada para esta fase)
  const handleJoinEvent = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const eventRef = doc(db, 'events', id);
    const isParticipant = event.participants?.includes(currentUser.uid);
    try {
      if (isParticipant) {
        await updateDoc(eventRef, { participants: arrayRemove(currentUser.uid) });
        setEvent(prev => ({ ...prev, participants: prev.participants.filter(uid => uid !== currentUser.uid) }));
      } else {
        await updateDoc(eventRef, { participants: arrayUnion(currentUser.uid) });
        setEvent(prev => ({ ...prev, participants: [...(prev.participants || []), currentUser.uid] }));
      }
    } catch (error) { console.error(error); }
  };

  const handleDelete = async () => {
    if(!window.confirm("¿Seguro que quieres eliminar este evento?")) return;
    try {
        const { deleteDoc } = await import('firebase/firestore'); 
        await deleteDoc(doc(db, 'events', id));
        navigate('/calendario');
    } catch (error) { console.error(error); }
  };

  // --- AYUDANTE PARA RESOLVER ESTRUCTURA (Herencia) ---
  const getStructure = (type) => {
    const config = EVENT_TYPES[type] || EVENT_TYPES.culto;
    if (config.structure === 'same_as_culto') return EVENT_TYPES.culto.structure;
    if (config.structure === 'same_as_limpieza') return EVENT_TYPES.limpieza.structure;
    return config.structure || []; // Si es array directo o vacío (ayuno)
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!event) return null;

  const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
  const structure = getStructure(event.type);
  const isAyuno = event.type === 'ayuno';
  const myUid = auth.currentUser?.uid;

  return (
    <div className="pb-32 bg-slate-50 min-h-screen animate-fade-in relative">
      
      {/* HEADER */}
      <div className={`relative px-4 pt-12 pb-8 ${TypeConfig.color.replace('text-', 'bg-').replace('100', '50')} border-b border-slate-100`}>
        <button onClick={() => navigate('/calendario')} className="absolute top-4 left-4 p-2 bg-white/50 backdrop-blur-md rounded-full hover:bg-white transition-colors shadow-sm">
          <ArrowLeft size={20} className="text-slate-700"/>
        </button>
        <button onClick={handleDelete} className="absolute top-4 right-4 p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors">
          <Trash2 size={20}/>
        </button>

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
                    {format(new Date(event.date + 'T00:00:00'), 'EEEE d MMMM', { locale: es })}
                </div>
                <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-lg shadow-sm">
                    <Clock size={14} className="text-slate-400"/>
                    {event.time} hs
                </div>
            </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">

        {/* 1. DESCRIPCIÓN */}
        {event.description && (
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm">
                    <MapPin size={16} className="text-brand-500"/> Detalles
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>
            </div>
        )}

        {/* 2. GESTOR DE EQUIPOS DINÁMICO (CULTOS, ENSAYOS, ETC) */}
        {!isAyuno && structure.length > 0 && (
          <div className="space-y-6">
            {structure.map((section, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Título de Sección (Ej: Alabanza) */}
                <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                   <div className="w-1 h-4 bg-brand-500 rounded-full"></div>
                   <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">{section.section}</h3>
                </div>

                <div className="p-4 space-y-5">
                  {section.roles.map(role => {
                    const RoleIcon = role.icon;
                    const assignedPeople = assignments[role.key] || []; // Array de nombres

                    return (
                      <div key={role.key}>
                        <label className="text-[11px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                          <RoleIcon size={12} /> {role.label}
                        </label>

                        {/* LISTA DE PERSONAS YA ASIGNADAS (CHIPS) */}
                        {assignedPeople.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {assignedPeople.map((person, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-bold border border-brand-100 animate-fade-in">
                                {person}
                                <button 
                                  onClick={() => handleRemovePerson(role.key, person)}
                                  className="p-0.5 hover:bg-brand-200 rounded-full transition-colors"
                                >
                                  <X size={12}/>
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* SELECTOR PARA AGREGAR (Si es 'single' y ya hay uno, se oculta el selector a menos que lo borres, o se muestra para reemplazar) */}
                        {(role.type === 'multi' || assignedPeople.length === 0) && (
                          <div className="relative">
                            <select 
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm text-slate-600 focus:border-brand-500 transition-colors appearance-none"
                              value=""
                              onChange={(e) => {
                                handleAddPerson(role.key, e.target.value);
                                e.target.value = ""; // Resetear selector
                              }}
                            >
                              <option value="">
                                {role.type === 'multi' ? '+ Agregar persona...' : 'Seleccionar responsable...'}
                              </option>
                              {users.map(u => (
                                <option key={u.id} value={u.displayName || u.name}>
                                  {u.displayName || u.name || 'Sin Nombre'}
                                </option>
                              ))}
                            </select>
                            <Plus size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <button 
                onClick={handleSaveAssignments}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-slate-200 active:scale-95 transition-all sticky bottom-4 z-20"
            >
                <Save size={18}/> Guardar Cambios
            </button>
          </div>
        )}

        {/* 3. VISTA PROVISORIA AYUNO (FASE 3 PRÓXIMAMENTE) */}
        {isAyuno && (
             <div className="border border-rose-100 bg-rose-50/30 rounded-2xl p-6 text-center">
                 <AlertCircle size={32} className="mx-auto text-rose-400 mb-2"/>
                 <h3 className="font-bold text-rose-800">Sistema de Ayuno por Días</h3>
                 <p className="text-xs text-rose-600 mt-1">
                   Estamos actualizando este módulo para permitir inscripción por fechas específicas. 
                   Disponible en la próxima actualización.
                 </p>
             </div>
        )}

      </div>
    </div>
  );
}