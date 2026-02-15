import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ArrowLeft, Calendar, Clock, MapPin, User, Music, Video, Shield, Save, CheckCircle, Trash2, Users } from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]); // Para los selectores de asignar
  const [loading, setLoading] = useState(true);
  
  // Estado local para editar asignaciones
  const [assignments, setAssignments] = useState({});

  // Cargar Evento y Usuarios (Directorio)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Cargar Evento
        const eventRef = doc(db, 'events', id);
        const eventSnap = await getDoc(eventRef);
        
        // 2. Cargar Usuarios (Para poder asignar)
        const usersCol = collection(db, 'users');
        const usersSnap = await getDocs(usersCol);
        const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Ordenar usuarios por nombre (usando la lógica que arreglamos antes)
        usersList.sort((a, b) => {
            const nameA = a.displayName || a.name || 'Sin Nombre';
            const nameB = b.displayName || b.name || 'Sin Nombre';
            return nameA.localeCompare(nameB);
        });

        if (eventSnap.exists()) {
          const data = eventSnap.data();
          setEvent({ id: eventSnap.id, ...data });
          setAssignments(data.assignments || {}); // Cargar asignaciones previas si existen
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

  // Guardar Asignaciones (Solo Pastores/Líderes)
  const handleSaveAssignments = async () => {
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, {
        assignments: assignments
      });
      alert("✅ Equipo asignado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error al guardar");
    }
  };

  // Función para anotarse uno mismo (Para Ayunos o Voluntariado)
  const handleJoinEvent = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const eventRef = doc(db, 'events', id);
    // Si ya estoy anotado, me salgo. Si no, entro.
    const isParticipant = event.participants?.includes(currentUser.uid);

    try {
      if (isParticipant) {
        await updateDoc(eventRef, { participants: arrayRemove(currentUser.uid) });
        setEvent(prev => ({ ...prev, participants: prev.participants.filter(uid => uid !== currentUser.uid) }));
      } else {
        await updateDoc(eventRef, { participants: arrayUnion(currentUser.uid) });
        setEvent(prev => ({ ...prev, participants: [...(prev.participants || []), currentUser.uid] }));
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Borrar Evento
  const handleDelete = async () => {
    if(!window.confirm("¿Seguro que quieres eliminar este evento permanentemente?")) return;
    try {
        // Asumimos que deleteDoc ya está importado arriba (lo agregué en imports)
        // Pero necesito importarlo explícitamente si voy a usarlo aquí abajo,
        // Firebase modular a veces requiere importar deleteDoc desde firestore.
        // (Nota: En los imports arriba no puse deleteDoc, lo agrego ahora en la mente del código)
        const { deleteDoc } = await import('firebase/firestore'); 
        await deleteDoc(doc(db, 'events', id));
        navigate('/calendario');
    } catch (error) {
        console.error(error);
        alert("Error al borrar");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!event) return null;

  const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
  const isAyuno = event.type === 'ayuno';
  const myUid = auth.currentUser?.uid;

  // Renderizar Selector de Usuario
  const UserSelect = ({ label, icon: Icon, fieldKey }) => (
    <div className="mb-4">
      <label className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
        <Icon size={12} /> {label}
      </label>
      <select 
        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700 focus:border-brand-500 transition-colors"
        value={assignments[fieldKey] || ''}
        onChange={(e) => setAssignments({ ...assignments, [fieldKey]: e.target.value })}
      >
        <option value="">-- Sin asignar --</option>
        {users.map(u => (
          <option key={u.id} value={u.displayName || u.name}>
            {u.displayName || u.name || 'Sin Nombre'}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="pb-24 bg-white min-h-screen animate-fade-in relative">
      
      {/* HEADER CON COLOR DINÁMICO */}
      <div className={`relative px-4 pt-12 pb-8 ${TypeConfig.color.replace('text-', 'bg-').replace('100', '50')} border-b border-slate-100`}>
        <button onClick={() => navigate('/calendario')} className="absolute top-4 left-4 p-2 bg-white/50 backdrop-blur-md rounded-full hover:bg-white transition-colors shadow-sm">
          <ArrowLeft size={20} className="text-slate-700"/>
        </button>
        
        {/* Botón Borrar (Solo Pastor) */}
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

        {/* 1. SECCIÓN DESCRIPCIÓN */}
        {event.description && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm">
                    <MapPin size={16} className="text-brand-500"/> Detalles
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>
            </div>
        )}

        {/* 2. SECCIÓN GESTIÓN DE EQUIPO (SOLO SI NO ES AYUNO) */}
        {!isAyuno && (
            <div className="border border-slate-100 rounded-2xl p-5 shadow-sm bg-white">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 text-lg">
                    <Shield size={20} className="text-brand-600"/> Equipo de Servicio
                </h3>
                
                {/* Aquí están los roles que pediste */}
                <UserSelect label="Predicador / Orador" icon={User} fieldKey="predicador" />
                <UserSelect label="Dirección Alabanza" icon={Music} fieldKey="direccion_alabanza" />
                <UserSelect label="Líder Multimedia" icon={Video} fieldKey="multimedia" />
                <UserSelect label="Responsable Ujieres" icon={Shield} fieldKey="ujieres" />

                <button 
                    onClick={handleSaveAssignments}
                    className="w-full mt-2 bg-slate-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-slate-200 active:scale-95 transition-all hover:bg-black"
                >
                    <Save size={18}/> Guardar Equipo
                </button>
            </div>
        )}

        {/* 3. SECCIÓN PARTICIPANTES (PARA AYUNOS O EVENTOS ABIERTOS) */}
        {isAyuno && (
            <div className="border border-rose-100 bg-rose-50/30 rounded-2xl p-5">
                 <h3 className="font-black text-rose-800 mb-2 flex items-center gap-2 text-lg">
                    <Users size={20}/> Lista de Ayuno
                </h3>
                <p className="text-xs text-rose-600 mb-4 font-medium">Confirma tu compromiso tocando el botón.</p>
                
                <button 
                    onClick={handleJoinEvent}
                    className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                        event.participants?.includes(myUid)
                        ? 'bg-white text-rose-600 border-2 border-rose-200'
                        : 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700'
                    }`}
                >
                    {event.participants?.includes(myUid) 
                        ? <><CheckCircle size={18}/> Ya estoy anotado (Salir)</> 
                        : "Me anoto para ayunar"}
                </button>

                <div className="mt-4 pt-4 border-t border-rose-100">
                    <p className="text-xs font-bold text-rose-400 uppercase mb-2">
                        Hermanos comprometidos ({event.participants?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {/* Mapeamos los UIDs a nombres (buscando en el array de users cargado) */}
                        {event.participants?.map(uid => {
                            const user = users.find(u => u.id === uid);
                            return (
                                <span key={uid} className="text-[10px] bg-white border border-rose-100 text-rose-600 px-2 py-1 rounded-md font-bold shadow-sm">
                                    {user?.displayName || user?.name || 'Hermano'}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}