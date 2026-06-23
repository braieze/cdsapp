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

// ✅ DICCIONARIO DE DESCRIPCIONES DE ROLES
const ROLE_DESCRIPTIONS = {
  bienvenida: "Son quienes dan el primer contacto con la gente con sonrisas, abrazos y palabras lindas.",
  porteria: "Es quien cierra la iglesia al final del culto, apaga las luces, controla arriba que estén cerradas las ventanas, el gas, todas las puertas, el portón y etc.",
  oracion_inicio: "Es quien ora con el micrófono a las 19:30hs antes de cada culto.",
  pasillos: "Son quienes acomodan a las personas mientras van llegando, es decir saber qué sillas hay disponibles y acomodar según la cantidad de personas que sea y etc.",
  seguridad_autos: "Es quien controla en el afuera de la iglesia todos los autos de la cuadra.",
  control_banos: "Son quienes limpian los baños antes durante y después del culto, reponen papel y controlan quiénes entran.",
  servicio_altar: "Es quien repone el agua al predicador, equipo de alabanza, está atento a cualquier indicación es quien apaga y prende las luces a gusto de la persona que coordina."
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
  const [infoModal, setInfoModal] = useState(null); // ✅ ESTADO DEL MODAL DE INFO

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

  // ✅ FIX APK: Función de notificación usando Configuración Centralizada
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

  const toggleCheck = async (sector) => {
    const currentChecklist = event.checklist || {};
    const newState = !currentChecklist[sector]?.done;
    const updated = { ...currentChecklist, [sector]: { ...currentChecklist[sector], done: newState } };
    setEvent({ ...event, checklist: updated });
    await updateDoc(doc(db, 'events', id), { checklist: updated });
  };

  const saveComment = async (sector, text) => {
    const currentChecklist = event.checklist || {};
    const updated = { ...currentChecklist, [sector]: { ...currentChecklist[sector], comment: text } };
    setEvent({ ...event, checklist: updated });
    await updateDoc(doc(db, 'events', id), { checklist: updated });
    toast.success("Comentario guardado");
  };

  if (loading || !event) return <div className="fixed inset-0 flex items-center justify-center bg-white z-[200]"><Loader2 className="animate-spin text-brand-600" size={40}/></div>;

  if (event.restricted) return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center p-10 text-center font-outfit">
      <Lock size={60} className="text-slate-200 mb-6"/><h2 className="text-2xl font-black text-slate-900 uppercase">Ensayo Privado</h2>
      <p className="text-slate-500 font-bold text-xs uppercase mt-4 leading-loose">Solo el ministerio de Alabanza puede ver el detalle.</p>
      <button onClick={() => navigate('/calendario')} className="mt-12 py-4 px-10 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-2xl active:scale-95 transition-all">Volver</button>
    </div>
  );

  const Config = OPERATIVE_EVENT_TYPES[event.type] || OPERATIVE_EVENT_TYPES.culto;
  const myStatus = event.confirmations?.[dbUser?.displayName] || 'pending';
  const amIAssigned = Object.values(event.assignments || {}).flat().includes(dbUser?.displayName);
  const shouldPulse = amIAssigned && myStatus === 'pending';

  // ✅ LABELS CORREGIDOS SEGÚN LO SOLICITADO
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
        { key: 'oracion_inicio', label: 'Oración de Inicio', icon: Heart, type: 'single' },
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
        { key: 'porteria', label: 'Portería', icon: Lock, type: 'single' },
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
    <div className={`fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fade-in overflow-hidden font-outfit ${event.isCena ? 'border-t-[12px] border-rose-600' : ''}`}>
      
      {/* HEADER DE ALTO IMPACTO MANTENIENDO TU ESTRUCTURA */}
      <header className={`relative pt-12 pb-24 px-6 ${event.isCena ? 'bg-rose-600' : Config.color} transition-all`}>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button onClick={() => navigate('/calendario')} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"><X size={24} /></button>
            <div className="flex gap-2">
                {['pastor', 'lider'].includes(dbUser?.role) && (
                    <>
                      <button onClick={() => setIsEditingMeta(!isEditingMeta)} className={`p-2 rounded-[14px] shadow-sm ${isEditingMeta ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}><Edit3 size={20}/></button>
                      <button onClick={saveAll} className="px-6 py-2 bg-emerald-500 text-white rounded-[14px] font-black text-[10px] uppercase shadow-lg shadow-emerald-900/20 flex items-center gap-2 active:scale-95 transition-transform">
                        {isSaving ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>}
                        {isSaving ? '...' : 'Guardar'}
                      </button>
                      <button onClick={() => setIsAssigning(!isAssigning)} className={`px-5 py-2 rounded-[14px] font-black text-[10px] uppercase shadow-sm active:scale-95 transition-transform ${isAssigning ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>{isAssigning ? 'Salir' : 'Asignar'}</button>
                    </>
                )}
            </div>
        </div>

        <div className="flex flex-col items-center text-center mt-6">
            <div className="w-24 h-24 bg-white rounded-[35px] shadow-2xl flex items-center justify-center mb-6 border-4 border-white/20 relative">
                <Config.icon size={48} className={event.isCena ? 'text-rose-600' : Config.text} strokeWidth={2.5} />
            </div>
            {isEditingMeta ? (
              <input className="bg-white/20 text-white text-3xl font-black text-center w-full outline-none uppercase tracking-tighter rounded-[20px] py-2 px-4 shadow-inner" value={event.title} onChange={e => setEvent({...event, title: e.target.value})} />
            ) : (
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter px-4 leading-none">{event.title}</h1>
            )}
            {event.isCena && <div className="mt-4 bg-white/20 backdrop-blur-md px-5 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-sm border border-white/30">Cena del Señor</div>}
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-16 bg-slate-50 rounded-t-[50px]"></div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-6 pb-60 no-scrollbar">
        <div className="max-w-xl mx-auto space-y-8">
            {shouldPulse && !isAssigning && (
                <div className="bg-brand-600 border-4 border-brand-200/30 p-8 rounded-[40px] flex flex-col items-center animate-pulse shadow-2xl shadow-brand-600/30 mt-2">
                    <p className="text-[11px] font-black text-white uppercase tracking-widest mb-5">¿Confirmas tu servicio hoy?</p>
                    <div className="flex gap-4 w-full">
                        <button onClick={() => handleConfirm('confirmed')} className="flex-1 bg-white text-brand-600 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl active:scale-95 transition-transform">Sí, Asistiré</button>
                        <button onClick={() => handleConfirm('declined')} className="px-6 py-4 bg-brand-700 text-white rounded-2xl font-black text-[11px] uppercase border border-brand-500 shadow-inner active:scale-95 transition-transform">No puedo</button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-4 justify-center mt-2">
                <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                   <div className={`p-2 rounded-xl ${Config.light} ${Config.text}`}><Calendar size={16}/></div>
                   <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{format(parseISO(event.date), "d 'de' MMMM yyyy", { locale: es })}</span>
                </div>
                <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                   <div className={`p-2 rounded-xl ${Config.light} ${Config.text}`}><Clock size={16}/></div>
                   <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{event.time} hs</span>
                </div>
            </div>

            {event.type === 'ayuno' ? (
              <div className="space-y-6 mt-8">
                <div className="grid gap-5">
                  {fastingDays.map((day) => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    const signups = event.fastingSignups?.[dStr] || [];
                    const isMe = signups.includes(dbUser?.displayName);
                    return (
                      <div key={dStr} className={`p-6 rounded-[35px] border-2 transition-all flex flex-col gap-4 ${isMe ? 'bg-white border-amber-500 shadow-2xl shadow-amber-500/10' : 'bg-white border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
                        <div className="flex justify-between items-center text-left">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(day, "EEEE", { locale: es })}</p>
                            <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter mt-1">{format(day, "d 'de' MMMM", { locale: es })}</p>
                          </div>
                          <button onClick={() => toggleFast(dStr)} className={`p-5 rounded-[20px] shadow-lg active:scale-90 transition-transform ${isMe ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>{isMe ? <UserMinus size={24} strokeWidth={2.5}/> : <UserPlus size={24} strokeWidth={2.5}/>}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-12 mt-10">
                {getStructure().map((sec, sIdx) => (
                  <div key={sIdx} className="text-left">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 border-l-4 border-brand-500 pl-4 ml-1">{sec.section}</h3>
                    <div className="grid gap-5">
                      {sec.roles.map(role => {
                        const assigned = getAssignedForRole(role.key);
                        return (
                          <div key={role.key} className="bg-white p-7 rounded-[40px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative">
                            <div className="flex justify-between items-center mb-6">
                              <div className="flex items-center gap-3">
                                <div className="p-3 bg-slate-50 rounded-[14px] text-slate-500 border border-slate-100 shadow-sm"><role.icon size={20} strokeWidth={2.5}/></div>
                                <div className="flex items-center">
                                  <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{role.label}</span>
                                  {/* ✅ NUEVO: BOTÓN DE INFORMACIÓN */}
                                  {ROLE_DESCRIPTIONS[role.key] && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setInfoModal({ title: role.label, desc: ROLE_DESCRIPTIONS[role.key] }); }} 
                                      className="ml-2 text-brand-500 hover:bg-brand-50 p-2 rounded-full transition-colors active:scale-90"
                                    >
                                      <Info size={16} strokeWidth={3} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isAssigning && (
                                <button onClick={() => { setActiveRoleKey(role.key); setActiveRoleConfig(role); setIsSelectorOpen(true); }} className="p-3 bg-brand-50 text-brand-600 rounded-[14px] shadow-sm active:scale-90 transition-transform"><Plus size={20} strokeWidth={3}/></button>
                              )}
                            </div>
                            <div className="space-y-3">
                              {assigned.length === 0 ? <p className="text-[10px] font-black text-slate-300 uppercase italic px-2 py-2">Sin personal</p> : 
                               assigned.map((p, pIdx) => {
                                 const userObj = users.find(u => u.displayName === p);
                                 return (
                                  <div key={pIdx} className="flex items-center gap-4 bg-slate-50 p-4 rounded-[24px] border border-slate-100 shadow-sm">
                                    <div className="w-14 h-14 rounded-[18px] overflow-hidden border-2 border-white shadow-md bg-slate-200 shrink-0">
                                      <img src={userObj?.photoURL || `https://ui-avatars.com/api/?name=${p}&background=random`} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-black text-slate-900 text-[13px] truncate uppercase tracking-tight">{p}</h4>
                                      <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest mt-1">{userObj?.area || 'Miembro'}</p>
                                    </div>
                                    {event.confirmations?.[p] === 'confirmed' && <CheckCircle size={22} className="text-emerald-500 shrink-0"/>}
                                    {isAssigning && <button onClick={() => { setActiveRoleKey(role.key); handleTogglePerson(p); }} className="text-rose-500 ml-2 p-2 bg-white rounded-full shadow-sm active:scale-90 transition-transform"><X size={18} strokeWidth={3}/></button>}
                                  </div>
                                )})}
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
                  <div className="text-left mt-10 pb-10">
                    <h3 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.3em] mb-6 border-l-4 border-amber-500 pl-4 ml-1 italic">Asignaciones Extra</h3>
                    <div className="grid gap-5">
                      {Object.keys(assignments).filter(k => {
                        const fixedKeys = getStructure().flatMap(s => s.roles.map(r => r.key.toLowerCase().replace(/[\s_]/g, '')));
                        const normalizedK = k.toLowerCase().replace(/[\s_]/g, '');
                        return !fixedKeys.includes(normalizedK);
                      }).map(extraKey => (
                        <div key={extraKey} className="bg-white p-7 rounded-[40px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                           <div className="flex items-center gap-4 mb-6">
                              <div className="p-3 bg-amber-50 text-amber-600 rounded-[14px] shadow-sm"><Users size={20} strokeWidth={2.5}/></div>
                              <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{extraKey.replace(/_/g, ' ')}</span>
                           </div>
                           <div className="space-y-3">
                             {getAssignedForRole(extraKey).map((p, pIdx) => (
                               <div key={pIdx} className="font-black text-slate-800 text-[11px] uppercase tracking-wider bg-slate-50 p-5 rounded-[20px] border border-slate-100 shadow-sm">{p}</div>
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

      {/* BARRA DE ESTADO */}
      <div className="fixed bottom-0 left-0 right-0 p-8 bg-slate-900 rounded-t-[50px] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-50 flex items-center justify-between animate-slide-up border-t border-slate-800">
          <div className="text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estado General</p>
            <h4 className="text-3xl font-black text-white tracking-tighter leading-none">{confirmedCount} <span className="text-slate-600 mx-1">/</span> {allAssigned.length}</h4>
          </div>
          <button onClick={() => navigate(-1)} className="bg-slate-800 text-white px-10 py-5 rounded-[22px] font-black text-[11px] uppercase active:scale-95 transition-transform shadow-lg border border-slate-700">Entendido</button>
      </div>

      {/* ✅ MODAL DE INFORMACIÓN (LA "i") */}
      {infoModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setInfoModal(null)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative animate-scale-in border border-slate-100" onClick={e => e.stopPropagation()}>
            <button onClick={() => setInfoModal(null)} className="absolute top-5 right-5 p-2 bg-slate-50 rounded-full text-slate-400 active:scale-90 transition-transform">
              <X size={20} strokeWidth={3} />
            </button>
            <div className="w-16 h-16 bg-brand-50 text-brand-500 rounded-[20px] flex items-center justify-center mb-6 shadow-sm border border-brand-100">
              <Info size={32} strokeWidth={2.5}/>
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4 leading-none">{infoModal.title}</h3>
            <div className="w-12 h-1.5 bg-brand-500 rounded-full mb-6 shadow-sm"></div>
            <p className="text-[13px] font-bold text-slate-600 leading-relaxed">{infoModal.desc}</p>
            <button onClick={() => setInfoModal(null)} className="w-full mt-8 py-5 bg-slate-900 text-white rounded-[20px] font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform shadow-xl">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* SELECTOR DE PERSONAL */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-end justify-center" onClick={() => setIsSelectorOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[50px] h-[88vh] flex flex-col animate-slide-up shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-slate-100 flex justify-between items-center text-left bg-white shrink-0">
               <div><h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">Asignar Personal</h3><p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1.5">CDS Plátanos</p></div>
               <button onClick={() => setIsSelectorOpen(false)} className="p-3 bg-slate-50 rounded-full active:scale-90 transition-transform"><X size={20} strokeWidth={3}/></button>
            </div>
            <div className="p-5 flex gap-3 overflow-x-auto no-scrollbar border-b border-slate-100 bg-slate-50/50 shrink-0">
               {['Alabanza', 'Ujieres', 'Multimedia', 'Niños', 'Limpieza'].map(area => (
                 <button key={area} onClick={() => assignGroup(area)} className="px-6 py-3 bg-white text-brand-600 rounded-[14px] text-[10px] font-black uppercase border-2 border-brand-100 shadow-sm active:scale-95 transition-transform whitespace-nowrap">+ Grupo {area}</button>
               ))}
            </div>
            <div className="p-5 bg-white shrink-0">
              <div className="bg-slate-50 rounded-[20px] px-6 py-5 flex items-center gap-3 shadow-inner border border-slate-100">
                <Search size={20} className="text-slate-400" strokeWidth={2.5}/>
                <input autoFocus type="text" placeholder="Buscar por nombre..." className="w-full text-[13px] font-black outline-none bg-transparent placeholder-slate-400 uppercase tracking-wide" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar pb-32">
              {users.filter(u => u.displayName?.toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => {
                const isAlready = getAssignedForRole(activeRoleKey).includes(u.displayName);
                return (
                  <button key={u.id} onClick={() => handleTogglePerson(u.displayName)} className={`w-full flex items-center gap-5 p-5 rounded-[24px] border-2 transition-all text-left ${isAlready ? 'bg-brand-600 border-brand-600 text-white shadow-xl' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                    <div className="w-14 h-14 rounded-[18px] border-2 border-white overflow-hidden shadow-sm shrink-0 bg-slate-200"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=random`} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0"><p className={`font-black text-[13px] uppercase truncate ${isAlready ? 'text-white' : 'text-slate-800'}`}>{u.displayName}</p><p className={`text-[9px] font-black uppercase mt-1 tracking-widest ${isAlready ? 'text-white/70' : 'text-slate-400'}`}>{u.area || 'Miembro'}</p></div>
                    {isAlready ? <CheckCircle size={24} className="text-white"/> : <Plus size={24} className="text-slate-300"/>}
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