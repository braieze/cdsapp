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
  Info
} from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas'; 
import jsPDF from 'jspdf'; 
import { toast } from 'sonner';
import { OPERATIVE_EVENT_TYPES } from './Calendar';
import { ONESIGNAL_CONFIG } from '../oneSignalConfig';

// ✅ DICCIONARIO DE ROLES CON SUS DESCRIPCIONES (NUEVO)
const ROLE_INFO = {
  bienvenida: { title: 'Bienvenida', desc: 'Son quienes dan el primer contacto con la gente con sonrisas, abrazos y palabras lindas.' },
  porteria: { title: 'Portero', desc: 'Es quien cierra la iglesia al final del culto, apaga las luces, controla arriba que estén cerradas las ventanas, el gas, todas las puertas, el portón y etc.' },
  oracion_inicio: { title: 'Oración de inicio', desc: 'Es quien ora con el micrófono a las 19:30hs antes de cada culto.' },
  pasillos: { title: 'Pasillos', desc: 'Son quienes acomodan a las personas mientras van llegando, es decir, saber qué sillas hay disponibles y acomodar según la cantidad de personas que sea y etc.' },
  seguridad_autos: { title: 'Seguridad de autos', desc: 'Es quien controla en el afuera de la iglesia todos los autos de la cuadra.' },
  control_banos: { title: 'Control de baños', desc: 'Son quienes limpian los baños antes, durante y después del culto, reponen papel y controlan quiénes entran.' },
  servicio_altar: { title: 'Servicio altar', desc: 'Es quien repone el agua al predicador, equipo de alabanza, está atento a cualquier indicación, es quien apaga y prende las luces a gusto de la persona que coordina.' }
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
  const [infoModal, setInfoModal] = useState(null); // Estado para el modal de Información

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

  // --- 2. LÓGICA DE NORMALIZACIÓN ---
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

  // --- 3. NOTIFICACIONES ONESIGNAL ---
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
        android_accent_color: "FF0000",
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
    <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center p-10 text-center font-sans">
      <Lock size={60} className="text-slate-200 mb-6"/><h2 className="text-2xl font-bold text-slate-900">Ensayo Privado</h2>
      <p className="text-slate-500 font-medium text-sm mt-4 leading-relaxed">Solo el ministerio de Alabanza puede ver el detalle.</p>
      <button onClick={() => navigate('/calendario')} className="mt-10 py-3.5 px-8 bg-blue-600 text-white rounded-full font-bold text-sm shadow-sm active:scale-95 transition-all">Volver</button>
    </div>
  );

  const Config = OPERATIVE_EVENT_TYPES[event.type] || OPERATIVE_EVENT_TYPES.culto;
  const myStatus = event.confirmations?.[dbUser?.displayName] || 'pending';
  const amIAssigned = Object.values(event.assignments || {}).flat().includes(dbUser?.displayName);
  const shouldPulse = amIAssigned && myStatus === 'pending';

  // --- ESTRUCTURA ACTUALIZADA CON LOS NUEVOS LABELS ---
  const getStructure = () => {
    if (event.type === 'limpieza' || event.type === 'mantenimiento') {
      return [{ section: 'SECTORES Y TRABAJO', roles: [
        { key: 'salon', label: 'Salón Principal', icon: Church, type: 'multi' },
        { key: 'banos', label: 'Baños', icon: Eraser, type: 'multi' },
        { key: 'vereda', label: 'Vereda y Entrada', icon: ArrowRight, type: 'multi' },
        { key: 'cocina', label: 'Cocina / Anexo', icon: Flame, type: 'multi' }
      ]}];
    }
    return [
      { section: 'LIDERAZGO', roles: [
        { key: 'predicador', label: 'Predicador', icon: MessageSquare, type: 'single' },
        { key: 'oracion_inicio', label: 'Oración de inicio', icon: Heart, type: 'single' },
        { key: 'palabra_ofrenda', label: 'Palabra de Ofrenda', icon: Globe, type: 'single' }
      ]},
      { section: 'MINISTERIO DE ALABANZA', roles: [
        { key: 'vocalistas', label: 'Vocalistas', icon: Music, type: 'multi' },
        { key: 'g_electrica', label: 'Guitarra Eléctrica', icon: Music, type: 'single' },
        { key: 'g_acustica', label: 'Guitarra Acústica', icon: Music, type: 'single' },
        { key: 'bateria', label: 'Batería', icon: Music, type: 'single' },
        { key: 'bajo', label: 'Bajo', icon: Music, type: 'single' },
        { key: 'teclado', label: 'Teclado', icon: Music, type: 'single' }
      ]},
      { section: 'OPERATIVO / UJIERES', roles: [
        { key: 'bienvenida', label: 'Bienvenida', icon: Users, type: 'multi' },
        { key: 'porteria', label: 'Portero', icon: Lock, type: 'single' },
        { key: 'pasillos', label: 'Pasillos', icon: ArrowRight, type: 'multi' },
        { key: 'seguridad_autos', label: 'Seguridad de autos', icon: Car, type: 'multi' },
        { key: 'control_banos', label: 'Control de baños', icon: Eraser, type: 'multi' },
        { key: 'servicio_altar', label: 'Servicio altar', icon: Shield, type: 'multi' }
      ]},
      { section: 'TÉCNICA', roles: [
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
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fade-in font-sans">
      
      {/* --- HEADER ESTILO SOCIALYO --- */}
      <header className="bg-white px-5 pt-12 pb-6 flex items-center justify-between shadow-sm z-10 shrink-0">
        <button onClick={() => navigate('/calendario')} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={20} />
        </button>
        <div className="flex-1 text-center truncate px-4">
            {isEditingMeta ? (
              <input className="bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold text-center w-full outline-none focus:border-blue-500 rounded-lg px-3 py-1.5" value={event.title} onChange={e => setEvent({...event, title: e.target.value})} />
            ) : (
              <h1 className="text-lg font-bold text-slate-900 truncate">{event.title}</h1>
            )}
            <p className="text-[11px] font-semibold text-slate-400 capitalize">{format(parseISO(event.date), "EEEE d 'de' MMMM", { locale: es })} • {event.time} hs</p>
        </div>
        <div className="flex gap-2">
            {['pastor', 'lider'].includes(dbUser?.role) && (
                <>
                  {isAssigning || isEditingMeta ? (
                    <button onClick={saveAll} className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-all">
                      {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                    </button>
                  ) : (
                    <div className="flex gap-1.5">
                      <button onClick={() => setIsEditingMeta(!isEditingMeta)} className="w-9 h-9 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"><Edit3 size={16}/></button>
                      <button onClick={() => setIsAssigning(!isAssigning)} className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"><UserPlus size={16}/></button>
                    </div>
                  )}
                </>
            )}
        </div>
      </header>

      {/* --- CONTENIDO --- */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 no-scrollbar">
        <div className="max-w-md mx-auto space-y-6 pt-6">
            
            {/* ESTADO CONFIRMACIÓN */}
            {shouldPulse && !isAssigning && (
                <div className="bg-blue-600 border border-blue-500 p-5 rounded-[24px] flex flex-col items-center animate-pulse-soft shadow-lg shadow-blue-600/20">
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider mb-4">¿Confirmas tu servicio hoy?</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => handleConfirm('confirmed')} className="flex-1 bg-white text-blue-600 py-3 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all">Sí, Asistiré</button>
                        <button onClick={() => handleConfirm('declined')} className="px-5 py-3 bg-blue-700 text-white rounded-xl font-bold text-xs hover:bg-blue-800 transition-all">No puedo</button>
                    </div>
                </div>
            )}

            {event.type === 'ayuno' ? (
              <div className="space-y-4">
                {fastingDays.map((day) => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const signups = event.fastingSignups?.[dStr] || [];
                  const isMe = signups.includes(dbUser?.displayName);
                  return (
                    <div key={dStr} className={`p-5 rounded-[24px] border transition-all flex flex-col gap-3 ${isMe ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex justify-between items-center text-left">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 capitalize">{format(day, "EEEE", { locale: es })}</p>
                          <p className="text-lg font-bold text-slate-900">{format(day, "d 'de' MMMM", { locale: es })}</p>
                        </div>
                        <button onClick={() => toggleFast(dStr)} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-all ${isMe ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>{isMe ? <UserMinus size={20}/> : <UserPlus size={20}/>}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-8">
                {getStructure().map((sec, sIdx) => (
                  <div key={sIdx} className="text-left">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{sec.section}</h3>
                    </div>
                    
                    <div className="grid gap-3">
                      {sec.roles.map(role => {
                        const assigned = getAssignedForRole(role.key);
                        return (
                          <div key={role.key} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-[14px] ${Config.light} ${Config.text}`}><role.icon size={16}/></div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">{role.label}</span>
                                  {/* ✅ ÍCONO DE INFORMACIÓN AL LADO DEL ROL */}
                                  {ROLE_INFO[role.key] && (
                                    <button onClick={(e) => { e.stopPropagation(); setInfoModal(ROLE_INFO[role.key]); }} className="text-blue-500 p-1 rounded-full hover:bg-blue-50 transition-colors">
                                      <Info size={16} strokeWidth={2.5}/>
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isAssigning && (
                                <button onClick={() => { setActiveRoleKey(role.key); setActiveRoleConfig(role); setIsSelectorOpen(true); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full transition-colors"><Plus size={16}/></button>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              {assigned.length === 0 ? <p className="text-[11px] font-medium text-slate-400 italic px-1">Sin personal asignado</p> : 
                               assigned.map((p, pIdx) => {
                                 const userObj = users.find(u => u.displayName === p);
                                 return (
                                  <div key={pIdx} className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                    <div className="w-10 h-10 rounded-[12px] overflow-hidden bg-slate-200 shrink-0">
                                      <img src={userObj?.photoURL || `https://ui-avatars.com/api/?name=${p}&background=random`} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-slate-800 text-xs truncate">{p}</h4>
                                      <p className="text-[10px] font-semibold text-slate-500 uppercase">{userObj?.area || 'Miembro'}</p>
                                    </div>
                                    {event.confirmations?.[p] === 'confirmed' && <CheckCircle size={16} className="text-emerald-500 shrink-0"/>}
                                    {isAssigning && <button onClick={() => { setActiveRoleKey(role.key); handleTogglePerson(p); }} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full ml-1"><X size={16}/></button>}
                                  </div>
                                )})}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* ROLES EXTRA CREADOS DINÁMICAMENTE */}
                {Object.keys(assignments).filter(k => {
                  const fixedKeys = getStructure().flatMap(s => s.roles.map(r => r.key.toLowerCase().replace(/[\s_]/g, '')));
                  const normalizedK = k.toLowerCase().replace(/[\s_]/g, '');
                  return !fixedKeys.includes(normalizedK) && assignments[k]?.length > 0;
                }).length > 0 && (
                  <div className="text-left mt-8 pb-4">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-400"></div>
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Asignaciones Extra</h3>
                    </div>
                    <div className="grid gap-3">
                      {Object.keys(assignments).filter(k => {
                        const fixedKeys = getStructure().flatMap(s => s.roles.map(r => r.key.toLowerCase().replace(/[\s_]/g, '')));
                        const normalizedK = k.toLowerCase().replace(/[\s_]/g, '');
                        return !fixedKeys.includes(normalizedK);
                      }).map(extraKey => (
                        <div key={extraKey} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-[14px]"><Users size={16}/></div>
                              <span className="text-sm font-bold text-slate-900 capitalize">{extraKey.replace(/_/g, ' ')}</span>
                           </div>
                           <div className="space-y-2">
                             {getAssignedForRole(extraKey).map((p, pIdx) => (
                               <div key={pIdx} className="font-bold text-slate-700 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">{p}</div>
                             ))}
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

      {/* --- BARRA FLOTANTE DE ESTADO (ESTILO SOCIALYO) --- */}
      {!isAssigning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-white p-2 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 z-50 flex items-center justify-between animate-slide-up">
            <div className="pl-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Servidores</p>
              <h4 className="text-lg font-bold text-slate-900 leading-none mt-1">{confirmedCount} <span className="text-slate-300 mx-0.5">/</span> {allAssigned.length}</h4>
            </div>
            <button onClick={() => navigate(-1)} className="bg-blue-600 text-white px-6 py-3.5 rounded-[18px] font-bold text-sm active:scale-95 transition-all shadow-sm">Volver</button>
        </div>
      )}

      {/* --- MODAL DE INFORMACIÓN (BOTTOM SHEET) --- */}
      {infoModal && (
        <div className="fixed inset-0 z-[600] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setInfoModal(null)}>
            <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl animate-slide-up relative text-left" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Info size={24} strokeWidth={2.5}/>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{infoModal.title}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium mb-8 px-1">{infoModal.desc}</p>
                <button onClick={() => setInfoModal(null)} className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold py-4 rounded-2xl active:scale-95 transition-all text-sm">Entendido</button>
            </div>
        </div>
      )}

      {/* --- SELECTOR DE PERSONAL --- */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setIsSelectorOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[32px] h-[88vh] flex flex-col animate-slide-up shadow-2xl relative overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center text-left bg-white shrink-0">
               <div>
                 <h3 className="font-bold text-slate-900 text-lg">Asignar Personal</h3>
                 <p className="text-[11px] font-semibold text-blue-600 mt-0.5">Gestión de áreas</p>
               </div>
               <button onClick={() => setIsSelectorOpen(false)} className="w-8 h-8 bg-slate-50 flex items-center justify-center rounded-full active:scale-90 text-slate-500"><X size={18}/></button>
            </div>
            <div className="p-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-50 bg-slate-50/50 shrink-0">
               {['Alabanza', 'Ujieres', 'Multimedia', 'Niños', 'Limpieza'].map(area => (
                 <button key={area} onClick={() => assignGroup(area)} className="px-4 py-2 bg-white text-slate-700 rounded-full text-xs font-bold border border-slate-200 shadow-sm active:scale-95 whitespace-nowrap">+ Grupo {area}</button>
               ))}
            </div>
            <div className="p-4 bg-white shrink-0">
              <div className="bg-slate-50 rounded-[16px] px-4 py-3.5 flex items-center gap-3 border border-slate-100">
                <Search size={18} className="text-slate-400"/>
                <input autoFocus type="text" placeholder="Buscar por nombre..." className="w-full text-sm font-semibold outline-none bg-transparent text-slate-800 placeholder-slate-400" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar pb-10">
              {users.filter(u => u.displayName?.toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => {
                const isAlready = getAssignedForRole(activeRoleKey).includes(u.displayName);
                return (
                  <button key={u.id} onClick={() => handleTogglePerson(u.displayName)} className={`w-full flex items-center gap-4 p-3.5 rounded-[20px] border transition-all text-left ${isAlready ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                    <div className="w-10 h-10 rounded-[12px] bg-slate-100 overflow-hidden shrink-0"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=random`} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${isAlready ? 'text-white' : 'text-slate-800'}`}>{u.displayName}</p>
                      <p className={`text-[10px] font-semibold uppercase mt-0.5 ${isAlready ? 'text-blue-200' : 'text-slate-400'}`}>{u.area || 'Miembro'}</p>
                    </div>
                    {isAlready ? <CheckCircle size={18} className="text-white"/> : <Plus size={18} className="text-slate-300"/>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}