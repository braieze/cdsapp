import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, updateDoc, collection, getDocs, deleteDoc, 
  serverTimestamp, arrayUnion, arrayRemove, addDoc
} from 'firebase/firestore'; 
import { 
  X, Calendar, Clock, Save, Trash2, Plus, Users, 
  CheckCircle, Download, Loader2, Search, HelpCircle,
  AlertCircle, Check, ExternalLink, ArrowRight, UserPlus, UserMinus, Heart,
  Music, Eraser, Wrench, Flame, Church, Lock, ShieldAlert, MessageSquare, 
  Edit3, PlusCircle, CheckSquare, Square, Car, Shield, Monitor, Camera, Send, Globe,
  Info, ChevronLeft, MoreHorizontal
} from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas'; 
import jsPDF from 'jspdf'; 
import { toast } from 'sonner';
import { OPERATIVE_EVENT_TYPES } from './Calendar';
import { ONESIGNAL_CONFIG } from '../oneSignalConfig';

/**
 * Diccionario de descripciones para los roles de servicio.
 * Explica de manera sencilla y clara qué se espera en cada tarea.
 */
const ROLE_DESCRIPTIONS = {
  bienvenida: "Tu labor es recibir a cada persona que llega a la iglesia con una gran sonrisa, un abrazo afectuoso y palabras amables. Sos la primera cara que ven, así que tu bienvenida marca el tono de su experiencia en el culto.",
  porteria: "Tu responsabilidad comienza al terminar el culto. Tenes que asegurarte de que el auditorio quede cerrado y seguro: verificar que todas las ventanas estén trabadas, las luces apagadas, el gas cerrado, las puertas internas bloqueadas y, finalmente, cerrar el portón de entrada.",
  oracion_inicio: "Tu tarea es dirigirnos a todos en oración antes de comenzar el culto. Tenes que estar listo a las 19:30hs con el micrófono para guiar a la iglesia en este momento de entrega y preparación.",
  pasillos: "Tu objetivo es ayudar a que todos estén cómodos. Debes estar atento a cuántas personas llegan y guiarlas a los asientos que estén disponibles, asegurándote de aprovechar bien el espacio y que nadie se quede parado.",
  seguridad_autos: "Tu lugar es fuera de la iglesia. Estás a cargo de supervisar el orden y la seguridad de todos los autos estacionados en la cuadra durante todo el tiempo que dure la reunión.",
  control_banos: "Tu misión es mantener los baños en perfectas condiciones. Antes, durante y después del culto, debes revisar que estén limpios, reponer el papel higiénico y estar atento a cualquier necesidad de quienes ingresan.",
  servicio_altar: "Tu función es asistir al predicador y al equipo de alabanza en lo que necesiten. Debes estar pendiente para acercar agua, ajustar la intensidad de las luces según la música o el momento del culto, y estar atento a cualquier seña o indicación del coordinador. Ademas, debes acomodar el alfoli en el momento de la ofrenda"
};

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reportRef = useRef(); 
  
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [dbUser, setDbUser] = useState(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignments, setAssignments] = useState({}); 
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeRoleKey, setActiveRoleKey] = useState(null); 
  const [activeRoleConfig, setActiveRoleConfig] = useState(null); 
  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [infoModal, setInfoModal] = useState(null); 

  const currentUser = auth.currentUser;

  // --- 1. CARGA DE DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentUser) return;
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const currentDbUser = uSnap.exists() ? uSnap.data() : null;
        setDbUser(currentDbUser);

        const eRef = doc(db, 'events', id);
        const eSnap = await getDoc(eRef);
        
        const usSnap = await getDocs(collection(db, 'users'));
        const sortedUsers = usSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setUsers(sortedUsers);

        if (eSnap.exists()) {
          const data = { id: eSnap.id, ...eSnap.data() };
          const isAlabanza = currentDbUser?.area?.toLowerCase() === 'alabanza';
          const isLeader = ['pastor', 'lider'].includes(currentDbUser?.role);
          if (data.type === 'ensayo' && !isAlabanza && !isLeader) {
            setEvent({ ...data, restricted: true });
          } else {
            setEvent(data);
          }
          setAssignments(data.assignments || {});
        } else { navigate('/calendario'); }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, currentUser, navigate]);

  // ✅ 2. LÓGICA DE NORMALIZACIÓN
  const getAssignedForRole = (roleKey) => {
    if (!assignments) return [];
    const foundKey = Object.keys(assignments).find(k => 
      k.toLowerCase().replace(/[\s_]/g, '') === roleKey.toLowerCase().replace(/[\s_]/g, '')
    );
    const value = foundKey ? assignments[foundKey] : null;
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const handleTogglePerson = (userName) => {
    const currentList = getAssignedForRole(activeRoleKey);
    const isAlready = currentList.includes(userName);
    
    let newList;
    if (isAlready) {
      newList = currentList.filter(n => n !== userName);
    } else {
      newList = activeRoleConfig.type === 'single' ? [userName] : [...currentList, userName];
    }

    const newAssignments = { ...assignments };
    const oldKey = Object.keys(newAssignments).find(k => 
      k.toLowerCase().replace(/[\s_]/g, '') === activeRoleKey.toLowerCase().replace(/[\s_]/g, '')
    );
    if (oldKey) delete newAssignments[oldKey];
    
    newAssignments[activeRoleKey] = newList;
    setAssignments(newAssignments);
  };

  const sendPush = async (userNames, eventTitle) => {
    const KEY = ONESIGNAL_CONFIG.REST_API_KEY;
    const APP_ID = ONESIGNAL_CONFIG.APP_ID;
    
    if (!KEY) return;

    const targetIds = users.filter(u => userNames.includes(u.displayName)).map(u => u.id);
    if (targetIds.length === 0) return;

    try {
      const payload = {
        app_id: APP_ID,
        include_external_user_ids: targetIds,
        headings: { en: "📍 Tarea asignada", es: "📍 Tarea asignada" },
        contents: { 
          en: `Tienes una nueva tarea en: ${eventTitle}. Toca para ver detalles.`, 
          es: `Tienes una nueva tarea en: ${eventTitle}. Toca para ver detalles.` 
        },
        data: { route: `/calendario/${id}` },
        large_icon: "https://cdsapp.vercel.app/logo.png",
        priority: 10,
        android_accent_color: "2F80ED",
        android_visibility: 1
      };

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${KEY}` },
        body: JSON.stringify(payload)
      });

    } catch (e) { console.error("Error enviando push de tarea:", e); }
  };

  const handleConfirm = async (status) => {
    try {
      const eRef = doc(db, 'events', id);
      await updateDoc(eRef, { [`confirmations.${dbUser.displayName}`]: status });
      setEvent(prev => ({ ...prev, confirmations: { ...prev.confirmations, [dbUser.displayName]: status } }));
      toast.success(status === 'confirmed' ? "Servicio confirmado" : "Aviso enviado");
    } catch (e) { toast.error("Error"); }
  };

  const saveAll = async () => {
    setIsSaving(true);
    try {
      const eRef = doc(db, 'events', id);
      await updateDoc(eRef, { ...event, assignments, updatedAt: serverTimestamp() });
      
      if (isAssigning) {
        const assignedList = Object.values(assignments).flat();
        await sendPush(assignedList, event.title);
      }

      setIsAssigning(false);
      setIsEditingMeta(false);
      toast.success("Cambios guardados");
    } catch (e) { toast.error("Error al guardar"); } finally { setIsSaving(false); }
  };

  const assignGroup = (areaName) => {
    const ministry = users.filter(u => u.area?.toLowerCase() === areaName.toLowerCase()).map(u => u.displayName);
    const current = getAssignedForRole(activeRoleKey);
    const newList = [...new Set([...current, ...ministry])];
    
    const newAssignments = { ...assignments };
    const oldKey = Object.keys(newAssignments).find(k => 
      k.toLowerCase().replace(/[\s_]/g, '') === activeRoleKey.toLowerCase().replace(/[\s_]/g, '')
    );
    if (oldKey) delete newAssignments[oldKey];
    
    newAssignments[activeRoleKey] = newList;
    setAssignments(newAssignments);
    setIsSelectorOpen(false);
    toast.info(`Grupo ${areaName} añadido`);
  };

  const toggleFast = async (dateStr) => {
    const currentList = event.fastingSignups?.[dateStr] || [];
    const isSigned = currentList.includes(dbUser.displayName);
    const eRef = doc(db, 'events', id);
    try {
      if (isSigned) await updateDoc(eRef, { [`fastingSignups.${dateStr}`]: arrayRemove(dbUser.displayName) });
      else await updateDoc(eRef, { [`fastingSignups.${dateStr}`]: arrayUnion(dbUser.displayName) });
      const newList = isSigned ? currentList.filter(n => n !== dbUser.displayName) : [...currentList, dbUser.displayName];
      setEvent({ ...event, fastingSignups: { ...event.fastingSignups, [dateStr]: newList } });
    } catch (e) { toast.error("Error"); }
  };

  if (loading || !event) return <div className="fixed inset-0 flex items-center justify-center bg-white z-[200]"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;

  if (event.restricted) return (
    <div className="fixed inset-0 bg-[#F8F9FE] z-[200] flex flex-col items-center justify-center p-10 text-center font-sans">
      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
        <Lock size={32} className="text-slate-400"/>
      </div>
      <h2 className="text-xl font-bold text-slate-900">Ensayo Privado</h2>
      <p className="text-slate-500 font-medium text-sm mt-3">Solo el ministerio de Alabanza puede ver los detalles.</p>
      <button onClick={() => navigate('/calendario')} className="mt-8 py-3.5 px-8 bg-blue-600 text-white rounded-full font-semibold text-sm shadow-md active:scale-95 transition-all">Volver al Calendario</button>
    </div>
  );

  const Config = OPERATIVE_EVENT_TYPES[event.type] || OPERATIVE_EVENT_TYPES.culto;
  const myStatus = event.confirmations?.[dbUser?.displayName] || 'pending';
  const amIAssigned = Object.values(event.assignments || {}).flat().includes(dbUser?.displayName);
  const shouldPulse = amIAssigned && myStatus === 'pending';

  const getStructure = () => {
    if (event.type === 'limpieza' || event.type === 'mantenimiento') {
      return [{ section: 'Sectores y Trabajo', roles: [
        { key: 'salon', label: 'Salón Principal', icon: Church, type: 'multi' },
        { key: 'banos', label: 'Baños', icon: Eraser, type: 'multi' },
        { key: 'vereda', label: 'Vereda y Entrada', icon: ArrowRight, type: 'multi' },
        { key: 'cocina', label: 'Cocina / Anexo', icon: Flame, type: 'multi' }
      ]}];
    }
    return [
      { section: 'Liderazgo', roles: [
        { key: 'predicador', label: 'Predicador', icon: MessageSquare, type: 'single' },
        { key: 'oracion_inicio', label: 'Oración de Inicio', icon: Heart, type: 'single' },
        { key: 'palabra_ofrenda', label: 'Palabra de Ofrenda', icon: Globe, type: 'single' }
      ]},
      { section: 'Ministerio de Alabanza', roles: [
        { key: 'vocalistas', label: 'Vocalistas', icon: Music, type: 'multi' },
        { key: 'g_electrica', label: 'Guitarra Eléctrica', icon: Music, type: 'single' },
        { key: 'g_acustica', label: 'Guitarra Acústica', icon: Music, type: 'single' },
        { key: 'bateria', label: 'Batería', icon: Music, type: 'single' },
        { key: 'bajo', label: 'Bajo', icon: Music, type: 'single' },
        { key: 'teclado', label: 'Teclado', icon: Music, type: 'single' }
      ]},
      { section: 'Operativo / Ujieres', roles: [
        { key: 'bienvenida', label: 'Bienvenida', icon: Users, type: 'multi' },
        { key: 'porteria', label: 'Portería', icon: Lock, type: 'single' },
        { key: 'pasillos', label: 'Pasillos', icon: ArrowRight, type: 'multi' },
        { key: 'seguridad_autos', label: 'Seguridad de autos', icon: Car, type: 'multi' },
        { key: 'control_banos', label: 'Control de baños', icon: Eraser, type: 'multi' },
        { key: 'servicio_altar', label: 'Servicio altar', icon: Shield, type: 'multi' }
      ]},
      { section: 'Técnica', roles: [
        { key: 'proyeccion', label: 'Proyección', icon: Monitor, type: 'single' },
        { key: 'transmision', label: 'Transmisión Cámaras', icon: Camera, type: 'single' },
        { key: 'sonido', label: 'Sonido', icon: Wrench, type: 'single' }
      ]}
    ];
  };

  const fastingDays = (event.type === 'ayuno' && event.endDate) ? eachDayOfInterval({ start: parseISO(event.date), end: parseISO(event.endDate) }) : [];
  const allAssigned = Object.values(assignments).flat();
  const confirmedCount = allAssigned.filter(name => event.confirmations?.[name] === 'confirmed').length;

  return (
    <div className={`fixed inset-0 z-[100] bg-[#F8F9FE] flex flex-col animate-fade-in overflow-hidden font-sans ${event.isCena ? 'border-t-4 border-rose-500' : ''}`}>
      
      {/* HEADER TIPO SOCIALYO */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-center justify-between shadow-sm z-10 shrink-0 rounded-b-[32px]">
        <button onClick={() => navigate('/calendario')} className="w-10 h-10 flex items-center justify-center text-slate-700 active:scale-90 transition-transform">
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        
        <div className="flex-1 text-center truncate px-2">
            {isEditingMeta ? (
              <input className="bg-slate-50 text-slate-900 text-lg font-bold text-center w-full outline-none rounded-xl py-1 border border-blue-200 focus:border-blue-500" value={event.title} onChange={e => setEvent({...event, title: e.target.value})} />
            ) : (
              <h1 className="text-lg font-bold text-slate-900 truncate">{event.title}</h1>
            )}
            <p className="text-[12px] font-medium text-slate-500 capitalize mt-0.5">
              {format(parseISO(event.date), "EEEE d, MMMM", { locale: es })} • {event.time}
            </p>
        </div>

        <div className="w-10 flex justify-end">
            {['pastor', 'lider'].includes(dbUser?.role) && (
              isAssigning || isEditingMeta ? (
                <button onClick={saveAll} className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                </button>
              ) : (
                <button onClick={() => setIsAssigning(true)} className="w-9 h-9 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center active:scale-95 transition-all">
                  <MoreHorizontal size={20}/>
                </button>
              )
            )}
        </div>
      </header>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto px-5 pb-32 no-scrollbar">
        <div className="max-w-md mx-auto mt-6 space-y-6">
            
            {/* ESTADO CONFIRMACIÓN ESTILO ALERTA SOCIALYO */}
            {shouldPulse && !isAssigning && (
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-[24px] flex flex-col items-center animate-pulse-soft shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-amber-700">
                      <Lock size={16} className="text-amber-500"/>
                      <p className="text-sm font-semibold">¿Confirmas tu disponibilidad?</p>
                    </div>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => handleConfirm('confirmed')} className="flex-1 bg-blue-600 text-white py-3 rounded-full font-semibold text-sm shadow-md active:scale-95 transition-transform">Confirmar</button>
                        <button onClick={() => handleConfirm('declined')} className="px-5 py-3 bg-white text-slate-600 rounded-full font-semibold text-sm border border-slate-200 active:scale-95 transition-transform">Rechazar</button>
                    </div>
                </div>
            )}

            {event.isCena && (
              <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-[20px] text-sm font-semibold text-center border border-rose-100">
                Reunión de Santa Cena
              </div>
            )}

            {event.type === 'ayuno' ? (
              <div className="space-y-4">
                {fastingDays.map((day) => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const signups = event.fastingSignups?.[dStr] || [];
                  const isMe = signups.includes(dbUser?.displayName);
                  return (
                    <div key={dStr} className="bg-white p-5 rounded-[28px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-400 capitalize">{format(day, "EEEE", { locale: es })}</p>
                        <p className="text-base font-bold text-slate-900">{format(day, "d 'de' MMMM", { locale: es })}</p>
                      </div>
                      <button onClick={() => toggleFast(dStr)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMe ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                        {isMe ? <Check size={20} strokeWidth={2.5}/> : <Plus size={20} strokeWidth={2.5}/>}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-8">
                {getStructure().map((sec, sIdx) => (
                  <div key={sIdx}>
                    <h3 className="text-sm font-bold text-slate-800 mb-4 px-1">{sec.section}</h3>
                    <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5">
                      {sec.roles.map((role, idx) => {
                        const assigned = getAssignedForRole(role.key);
                        return (
                          <div key={role.key} className={`${idx !== sec.roles.length - 1 ? 'border-b border-slate-50 pb-5' : ''}`}>
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-700">{role.label}</span>
                                {/* BOTÓN DE INFO SUTIL */}
                                {ROLE_DESCRIPTIONS[role.key] && (
                                  <button onClick={(e) => { e.stopPropagation(); setInfoModal({ title: role.label, desc: ROLE_DESCRIPTIONS[role.key] }); }} className="text-slate-400 hover:text-blue-500 transition-colors p-1">
                                    <Info size={16} />
                                  </button>
                                )}
                              </div>
                              {isAssigning && (
                                <button onClick={() => { setActiveRoleKey(role.key); setActiveRoleConfig(role); setIsSelectorOpen(true); }} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center active:scale-95 transition-transform">
                                  <Plus size={16} strokeWidth={2.5}/>
                                </button>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {assigned.length === 0 ? (
                                <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full">Sin asignar</span>
                              ) : (
                                assigned.map((p, pIdx) => {
                                  const userObj = users.find(u => u.displayName === p);
                                  return (
                                    <div key={pIdx} className="flex items-center gap-2 bg-slate-50/50 pr-3 pl-1 py-1 rounded-full border border-slate-100">
                                      <img src={userObj?.photoURL || `https://ui-avatars.com/api/?name=${p}&background=random`} className="w-7 h-7 rounded-full object-cover" alt={p} />
                                      <span className="text-xs font-medium text-slate-800">{p}</span>
                                      {event.confirmations?.[p] === 'confirmed' && <CheckCircle size={14} className="text-blue-500"/>}
                                      {isAssigning && <button onClick={() => { setActiveRoleKey(role.key); handleTogglePerson(p); }} className="text-slate-400 hover:text-rose-500 ml-1"><X size={14}/></button>}
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* ROLES EXTRA */}
                {Object.keys(assignments).filter(k => {
                  const fixedKeys = getStructure().flatMap(s => s.roles.map(r => r.key.toLowerCase().replace(/[\s_]/g, '')));
                  const normalizedK = k.toLowerCase().replace(/[\s_]/g, '');
                  return !fixedKeys.includes(normalizedK) && assignments[k]?.length > 0;
                }).length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-4 px-1">Otros asignados</h3>
                    <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5">
                      {Object.keys(assignments).filter(k => {
                        const fixedKeys = getStructure().flatMap(s => s.roles.map(r => r.key.toLowerCase().replace(/[\s_]/g, '')));
                        const normalizedK = k.toLowerCase().replace(/[\s_]/g, '');
                        return !fixedKeys.includes(normalizedK);
                      }).map((extraKey, idx, arr) => (
                        <div key={extraKey} className={`${idx !== arr.length - 1 ? 'border-b border-slate-50 pb-5' : ''}`}>
                           <span className="font-semibold text-sm text-slate-700 capitalize block mb-3">{extraKey.replace(/_/g, ' ')}</span>
                           <div className="flex flex-wrap gap-2">
                             {getAssignedForRole(extraKey).map((p, pIdx) => {
                               const userObj = users.find(u => u.displayName === p);
                               return (
                                 <div key={pIdx} className="flex items-center gap-2 bg-slate-50/50 pr-3 pl-1 py-1 rounded-full border border-slate-100">
                                    <img src={userObj?.photoURL || `https://ui-avatars.com/api/?name=${p}&background=random`} className="w-7 h-7 rounded-full object-cover" alt={p} />
                                    <span className="text-xs font-medium text-slate-800">{p}</span>
                                 </div>
                               )
                             })}
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* BARRA INFERIOR DE ESTADO (ESTILO SOCIALYO) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-md bg-white p-3 rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] flex items-center justify-between border border-slate-50 animate-slide-up z-50">
          <div className="flex items-center gap-3 pl-3">
             <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
               <Users size={20}/>
             </div>
             <div>
               <p className="text-[10px] font-medium text-slate-400">Personal Confirmado</p>
               <h4 className="text-sm font-bold text-slate-900">{confirmedCount} de {allAssigned.length}</h4>
             </div>
          </div>
          <button onClick={() => navigate(-1)} className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold text-sm active:scale-95 transition-transform shadow-md shadow-blue-600/20">Listo</button>
      </div>

      {/* ✅ MODAL DE INFORMACIÓN (LA "i") ESTILO SOCIALYO */}
      {infoModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setInfoModal(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl relative animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                <Info size={20} strokeWidth={2.5}/>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{infoModal.title}</h3>
            </div>
            <p className="text-sm font-medium text-slate-600 leading-relaxed px-1 mb-8">{infoModal.desc}</p>
            <button onClick={() => setInfoModal(null)} className="w-full py-3.5 bg-blue-600 text-white rounded-full font-semibold text-sm active:scale-95 transition-transform shadow-md shadow-blue-600/20">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* SELECTOR DE PERSONAL (BOTTOM SHEET ESTILO SOCIALYO) */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-end justify-center" onClick={() => setIsSelectorOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[40px] h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 shrink-0"></div>
            <div className="px-6 py-2 flex justify-between items-center bg-white shrink-0">
               <div>
                 <h3 className="font-bold text-slate-900 text-lg">Seleccionar</h3>
                 <p className="text-xs font-medium text-blue-600">{activeRoleConfig?.label}</p>
               </div>
               <button onClick={() => setIsSelectorOpen(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 active:scale-90 transition-transform"><X size={18}/></button>
            </div>
            <div className="px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-white shrink-0">
               {['Alabanza', 'Ujieres', 'Multimedia', 'Niños', 'Limpieza'].map(area => (
                 <button key={area} onClick={() => assignGroup(area)} className="px-4 py-2 bg-slate-50 text-slate-700 rounded-full text-xs font-semibold active:scale-95 transition-transform whitespace-nowrap">Grupo {area}</button>
               ))}
            </div>
            <div className="px-6 pb-2 pt-1 bg-white shrink-0 border-b border-slate-100">
              <div className="bg-slate-50 rounded-full px-4 py-2.5 flex items-center gap-2">
                <Search size={18} className="text-slate-400"/>
                <input autoFocus type="text" placeholder="Buscar por nombre..." className="w-full text-sm font-medium outline-none bg-transparent placeholder-slate-400" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 no-scrollbar pb-32">
              {users.filter(u => u.displayName?.toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => {
                const isAlready = getAssignedForRole(activeRoleKey).includes(u.displayName);
                return (
                  <div key={u.id} onClick={() => handleTogglePerson(u.displayName)} className="flex items-center justify-between p-2 cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=random`} className="w-12 h-12 rounded-full object-cover" alt={u.displayName}/>
                      <div>
                        <p className={`font-semibold text-sm ${isAlready ? 'text-blue-600' : 'text-slate-900'}`}>{u.displayName}</p>
                        <p className="text-xs font-medium text-slate-400">{u.area || 'Miembro'}</p>
                      </div>
                    </div>
                    <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isAlready ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                      {isAlready ? <Check size={16} strokeWidth={3}/> : <Plus size={16} strokeWidth={2.5}/>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}