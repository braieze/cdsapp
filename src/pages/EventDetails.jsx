import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
  doc, getDoc, updateDoc, collection, getDocs, deleteDoc,
  Timestamp, writeBatch, where
} from 'firebase/firestore'; 
import { 
  X, Calendar, Clock, Trash2, Plus, Users, CheckCircle, 
  Search, Printer, Loader2, AlertCircle, Lock,
  Mic, Music, Guitar, Speaker, Tv, Wifi, Shield, DoorOpen,
  Armchair, Coins, UserCheck, Bath, ArrowUp, Sparkles, Wallet
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ✅ DEFINICIÓN DE ROLES EXACTA
const SERVICE_ROLES = {
  // PASTORAL / ESPIRITUAL
  'predicador': { category: 'PASTORAL / ESPIRITUAL', label: 'Predicador', icon: UserCheck },
  'oracion_inicio': { category: 'PASTORAL / ESPIRITUAL', label: 'Oración de inicio', icon: Sparkles },
  'palabra_ofrenda': { category: 'PASTORAL / ESPIRITUAL', label: 'Palabra de ofrenda', icon: Wallet },

  // ALABANZA & ADORACIÓN
  'lider_alabanza': { category: 'ALABANZA & ADORACIÓN', label: 'Líder de Alabanza', icon: Mic },
  'voces': { category: 'ALABANZA & ADORACIÓN', label: 'Voces', icon: Mic },
  'guitarra_electrica': { category: 'ALABANZA & ADORACIÓN', label: 'Guitarra Eléctrica', icon: Guitar },
  'guitarra_acustica': { category: 'ALABANZA & ADORACIÓN', label: 'Guitarra Acústica', icon: Guitar },
  'teclado': { category: 'ALABANZA & ADORACIÓN', label: 'Teclado', icon: Music },
  'bajo': { category: 'ALABANZA & ADORACIÓN', label: 'Bajo', icon: Music },
  'bateria': { category: 'ALABANZA & ADORACIÓN', label: 'Batería', icon: Speaker },

  // OPERATIVO / UJIERES
  'puerta': { category: 'OPERATIVO / UJIERES', label: 'Puerta', icon: DoorOpen },
  'pasillo': { category: 'OPERATIVO / UJIERES', label: 'Pasillo/Acomodadores', icon: Armchair },
  'seguridad_autos': { category: 'OPERATIVO / UJIERES', label: 'Seguridad Autos', icon: Shield },
  'control_banos': { category: 'OPERATIVO / UJIERES', label: 'Control Baños', icon: Bath },
  'control_altar': { category: 'OPERATIVO / UJIERES', label: 'Control Altar', icon: ArrowUp },
  'ofrenda_ujier': { category: 'OPERATIVO / UJIERES', label: 'Ofrenda', icon: Coins },
  'recepcion': { category: 'OPERATIVO / UJIERES', label: 'Recepción', icon: UserCheck },

  // MULTIMEDIA
  'lider_multimedia': { category: 'MULTIMEDIA', label: 'Líder Multimedia', icon: Tv },
  'proyeccion': { category: 'MULTIMEDIA', label: 'Proyección', icon: Tv },
  'streaming': { category: 'MULTIMEDIA', label: 'Streaming', icon: Wifi },
};

const CATEGORY_ORDER = [
  'PASTORAL / ESPIRITUAL',
  'ALABANZA & ADORACIÓN',
  'OPERATIVO / UJIERES',
  'MULTIMEDIA'
];

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [userRole, setUserRole] = useState(null);
  
  // Modales y Acciones
  const [assignmentModal, setAssignmentModal] = useState(null); // { roleKey, roleLabel, category }
  const [actionConfirm, setActionConfirm] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        // 1. Obtener Rol
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setUserRole(userSnap.data().role);

        // 2. Obtener Evento
        const eventRef = doc(db, 'events', id);
        const eventSnap = await getDoc(eventRef);
        
        // 3. Obtener Usuarios (Solo si es evento existente)
        if (eventSnap.exists()) {
           setEvent({ id: eventSnap.id, ...eventSnap.data() });
           // Cargar usuarios para asignación
           const usersSnap = await getDocs(query(collection(db, 'users'), where("active", "==", true))); // Opcional filtro activo
           // Si no tienes campo active, usa getDocs(collection(db, 'users'))
           const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
           setUsers(usersList);
        } else {
           navigate('/calendario');
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, navigate]);

  // --- LÓGICA DE BLINDAJE Y ASIGNACIÓN ---
  
  const handleAssignUser = async (user) => {
    if (!event || !assignmentModal) return;

    // BLINDAJE: Verificar si ya existe en algun rol de ESTE evento
    const isAlreadyAssigned = Object.values(event.assignments || {}).some(a => a.userId === user.id);
    if (isAlreadyAssigned) {
        alert("¡Este usuario ya tiene un servicio asignado hoy!");
        return;
    }

    try {
        const newAssignment = {
            userId: user.id,
            userName: user.displayName || 'Usuario',
            userPhoto: user.photoURL || null,
            role: assignmentModal.roleLabel,
            roleKey: assignmentModal.roleKey,
            assignedAt: Timestamp.now()
        };

        const updatedAssignments = { ...event.assignments, [assignmentModal.roleKey]: newAssignment };
        
        // Actualizar BD
        await updateDoc(doc(db, 'events', event.id), { assignments: updatedAssignments });
        
        // Actualizar Estado Local
        setEvent(prev => ({ ...prev, assignments: updatedAssignments }));
        setAssignmentModal(null);

        // NOTIFICAR AL USUARIO (Tu lógica original simplificada)
        if (user.fcmTokens && user.fcmTokens.length > 0) {
            await fetch("https://backend-notificaciones-mceh.onrender.com/send-notification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "📍 Nueva tarea asignada",
                    body: `Se te asignó: ${assignmentModal.roleLabel} en ${event.title}`,
                    tokens: user.fcmTokens,
                    url: "/servicios"
                })
            });
        }
    } catch (error) {
        console.error("Error al asignar:", error);
        alert("Error al guardar asignación.");
    }
  };

  const handleRemoveAssignment = async (roleKey) => {
      try {
          const updatedAssignments = { ...event.assignments };
          delete updatedAssignments[roleKey];
          await updateDoc(doc(db, 'events', event.id), { assignments: updatedAssignments });
          setEvent(prev => ({ ...prev, assignments: updatedAssignments }));
      } catch (error) { alert("Error al eliminar"); }
  };

  const executeDelete = async () => {
      try {
        await deleteDoc(doc(db, 'events', id));
        // Limpiar subcolecciones si es necesario
        navigate('/calendario');
      } catch (e) { alert("Error al borrar"); }
  };

  // --- COMPONENTES VISUALES ---

  const UserSearchModal = () => {
    const [search, setSearch] = useState('');
    
    // Lista de IDs ya ocupados (Blindaje Visual)
    const assignedUserIds = useMemo(() => {
        if (!event?.assignments) return [];
        return Object.values(event.assignments).map(a => a.userId);
    }, [event]);

    // Lógica de Filtrado por Ministerio
    const filteredUsers = users.filter(u => {
        const matchName = (u.displayName || '').toLowerCase().includes(search.toLowerCase());
        const roleCategory = assignmentModal?.category;
        
        // Excepción Pastoral
        const isPastoralRole = roleCategory === 'PASTORAL / ESPIRITUAL';
        const isUserLeader = u.role === 'pastor' || u.role === 'lider';

        // Coincidencia de Ministerio (Asume campos 'ministerio' o 'area' en BD)
        const userMinistry = u.ministerio || u.area;
        const matchMinistry = userMinistry === roleCategory;

        if (isPastoralRole) return matchName && isUserLeader;
        return matchName && (matchMinistry || isUserLeader);
    });

    return (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-slide-up">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                <button onClick={() => setAssignmentModal(null)} className="p-2 rounded-full hover:bg-slate-50"><X size={24} className="text-slate-600"/></button>
                <div className="flex-1">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{assignmentModal?.category}</p>
                    <h3 className="text-lg font-black text-slate-800">{assignmentModal?.roleLabel}</h3>
                </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center bg-white rounded-xl px-4 py-3 border border-slate-200 shadow-sm">
                    <Search size={18} className="text-slate-400 mr-2"/>
                    <input autoFocus type="text" placeholder="Buscar servidor..." className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700 placeholder:font-medium" value={search} onChange={e => setSearch(e.target.value)}/>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredUsers.map(user => {
                    // BLINDAJE: Visual check
                    const isBlocked = assignedUserIds.includes(user.id);

                    return (
                        <div key={user.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isBlocked ? 'bg-slate-50 border-slate-100 opacity-60 grayscale' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                                {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Users size={18}/></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 text-sm truncate">{user.displayName}</h4>
                                {isBlocked ? (
                                    <p className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1 mt-0.5"><AlertCircle size={10}/> YA TIENE UN SERVICIO ASIGNADO</p>
                                ) : (
                                    <p className="text-xs text-slate-400 font-medium capitalize">{user.role || 'Voluntario'}</p>
                                )}
                            </div>
                            <button 
                                onClick={() => !isBlocked && handleAssignUser(user)}
                                disabled={isBlocked}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isBlocked ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-900 text-white hover:scale-105 active:scale-95'}`}>
                                {isBlocked ? <Lock size={14}/> : <Plus size={16}/>}
                            </button>
                        </div>
                    );
                })}
                {filteredUsers.length === 0 && <p className="text-center text-slate-400 text-xs font-bold py-8">No se encontraron servidores disponibles en {assignmentModal?.category}.</p>}
            </div>
        </div>
    );
  };

  const renderRoleItem = (roleKey, roleInfo) => {
      const assignment = event.assignments?.[roleKey];
      const Icon = roleInfo.icon;

      return (
          <div key={roleKey} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-1.5">
                   <Icon size={14} className="text-[#bf9e58]" /> 
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">{roleInfo.label}</span>
              </div>

              {assignment ? (
                  <div className="relative group">
                      <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                                  {assignment.userPhoto ? <img src={assignment.userPhoto} className="w-full h-full object-cover"/> : <Users size={14} className="m-auto mt-2 text-slate-400"/>}
                              </div>
                              <span className="text-sm font-bold text-slate-700">{assignment.userName}</span>
                          </div>
                          <button onClick={() => handleRemoveAssignment(roleKey)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100">
                              <X size={14} />
                          </button>
                      </div>
                  </div>
              ) : (
                  <>
                      <p className="text-xs font-bold text-slate-300 italic mb-2 pl-6">Vacante</p>
                      <button 
                          onClick={() => setAssignmentModal({ roleKey, roleLabel: roleInfo.label, category: roleInfo.category })}
                          className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3 text-xs font-black text-slate-400 uppercase tracking-widest hover:border-slate-300 hover:text-slate-500 transition-all flex items-center justify-center gap-2">
                          <Plus size={14} /> AÑADIR
                      </button>
                  </>
              )}
          </div>
      );
  };

  if (loading || !event) return <div className="fixed inset-0 bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-300"/></div>;

  const config = EVENT_TYPES[event.type] || EVENT_TYPES.culto;

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F7FA] animate-fade-in flex flex-col overflow-hidden">
        
        {/* CABECERA ESTILO MODAL OSCURO */}
        <div className="bg-[#0F172A] px-5 py-4 pt-12 flex justify-between items-start shrink-0 relative overflow-hidden">
             {/* Decoración */}
             <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>

             <button onClick={() => navigate('/calendario')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-10">
                <X size={16} />
             </button>

             <div className="flex flex-col items-center z-10">
                <div className="w-16 h-16 bg-white rounded-[20px] flex items-center justify-center mb-3 shadow-lg text-slate-800">
                    <config.icon size={32} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{config.label}</p>
                <h2 className="text-xl font-black text-white text-center leading-tight">{event.title}</h2>
             </div>

             <button onClick={() => window.print()} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-10">
                <Printer size={16} />
             </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto px-4 pb-32 bg-[#F5F7FA]">
            
            {/* PÍLDORAS DE FECHA Y HORA */}
            <div className="flex justify-center gap-3 my-6">
                <div className="bg-white px-5 py-2.5 rounded-2xl shadow-sm flex items-center gap-2 text-slate-600 border border-slate-100/50">
                    <Calendar size={16} className="text-[#bf9e58]" />
                    <span className="text-xs font-bold capitalize">{format(new Date(event.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}</span>
                </div>
                <div className="bg-white px-5 py-2.5 rounded-2xl shadow-sm flex items-center gap-2 text-slate-600 border border-slate-100/50">
                    <Clock size={16} className="text-[#bf9e58]" />
                    <span className="text-xs font-bold">{event.time} hs</span>
                </div>
            </div>

            {/* TARJETAS DE CATEGORÍAS */}
            <div className="space-y-4">
                {CATEGORY_ORDER.map(category => (
                    <div key={category} className="bg-white rounded-[30px] p-6 shadow-sm border border-slate-100/50">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">{category}</h3>
                            <div className="w-2 h-2 rounded-full bg-[#bf9e58]"></div>
                        </div>
                        
                        <div className="space-y-6">
                            {Object.entries(SERVICE_ROLES)
                                .filter(([_, role]) => role.category === category)
                                .map(([key, role]) => renderRoleItem(key, role))
                            }
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* FOOTER FIJO BOTONERA */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md p-4 pb-8 border-t border-slate-100 flex items-center gap-3">
             {['pastor', 'lider'].includes(userRole) && (
                <button onClick={() => setActionConfirm(true)} 
                    className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-100 transition-colors shrink-0">
                    <Trash2 size={24} />
                </button>
             )}
             <button onClick={() => navigate('/calendario')} className="flex-1 bg-[#0F172A] text-white h-14 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-xl shadow-slate-200">
                <CheckCircle size={18} /> GUARDAR EQUIPO
             </button>
        </div>

        {/* MODAL DE BUSQUEDA */}
        {assignmentModal && <UserSearchModal />}

        {/* MODAL CONFIRM BORRAR */}
        {actionConfirm && (
            <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-xs rounded-[35px] p-8 shadow-2xl text-center">
                <h4 className="font-black text-slate-800 text-lg mb-2">¿Borrar evento?</h4>
                <p className="text-xs text-slate-500 font-bold mb-8 uppercase">Esta acción es irreversible.</p>
                <div className="flex flex-col gap-3">
                  <button onClick={executeDelete} className="w-full py-4 rounded-2xl font-black text-xs uppercase shadow-lg bg-rose-600 text-white">Confirmar Borrado</button>
                  <button onClick={() => setActionConfirm(null)} className="w-full py-4 rounded-2xl font-black text-xs uppercase text-slate-400 bg-slate-50">Cancelar</button>
                </div>
              </div>
            </div>
        )}
    </div>
  );
}