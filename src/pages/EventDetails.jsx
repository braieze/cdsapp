import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, updateDoc, collection, getDocs, deleteDoc, 
  serverTimestamp, arrayUnion, arrayRemove 
} from 'firebase/firestore'; 
import { 
  X, Calendar, Clock, Save, Trash2, Plus, Users, 
  CheckCircle, Download, Loader2, Search, HelpCircle,
  AlertCircle, Check, ExternalLink, ArrowRight, UserPlus, UserMinus, Heart,
  Music, Eraser, Wrench, Flame, Church, Lock, ShieldAlert, MessageSquare, 
  Edit3, PlusCircle, CheckSquare, Square, Car, Shield, Monitor, Camera, Send, Globe
} from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas'; 
import jsPDF from 'jspdf'; 
import { toast } from 'sonner';
import { OPERATIVE_EVENT_TYPES } from './Calendar';

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

  const currentUser = auth.currentUser;

  // --- 1. CARGA DE DATOS (ORDEN ALFABÉTICO Y PRIVACIDAD) ---
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
        // ✅ 2. LISTA EN ORDEN ALFABÉTICO
        const sortedUsers = usSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setUsers(sortedUsers);

        if (eSnap.exists()) {
          const data = { id: eSnap.id, ...eSnap.data() };
          // ✅ 1. PRIVACIDAD ENSAYO ALABANZA
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

  // --- 4. NOTIFICACIONES REST API ---
  const sendPush = async (userNames, eventTitle) => {
    const KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
    if (!KEY) return;
    const targetIds = users.filter(u => userNames.includes(u.displayName)).map(u => u.id);
    if (targetIds.length === 0) return;
    try {
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Basic ${KEY}` },
        body: JSON.stringify({
          app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
          include_external_user_ids: targetIds,
          headings: { en: "📍 Tarea asignada", es: "📍 Tarea asignada" },
          contents: { en: `Tarea en: ${eventTitle}`, es: `Tarea en: ${eventTitle}` },
          data: { route: `/calendario/${id}` },
          priority: 10
        })
      });
    } catch (e) { console.log(e); }
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
      if (isAssigning) await sendPush(Object.values(assignments).flat(), event.title);
      setIsAssigning(false);
      setIsEditingMeta(false);
      toast.success("Cambios guardados");
    } catch (e) { toast.error("Error al guardar"); } finally { setIsSaving(false); }
  };

  // ✅ 1. ASIGNAR GRUPO COMPLETO
  const assignGroup = (areaName) => {
    const ministry = users.filter(u => u.area?.toLowerCase() === areaName.toLowerCase()).map(u => u.displayName);
    const current = assignments[activeRoleKey] || [];
    setAssignments({ ...assignments, [activeRoleKey]: [...new Set([...current, ...ministry])] });
    setIsSelectorOpen(false);
    toast.info(`Grupo ${areaName} añadido`);
  };

  // ✅ 1. AYUNO: ANOTARSE
  const toggleFast = async (dateStr) => {
    const current = event.fastingSignups?.[dateStr] || [];
    const isSigned = current.includes(dbUser.displayName);
    const eRef = doc(db, 'events', id);
    try {
      if (isSigned) await updateDoc(eRef, { [`fastingSignups.${dateStr}`]: arrayRemove(dbUser.displayName) });
      else await updateDoc(eRef, { [`fastingSignups.${dateStr}`]: arrayUnion(dbUser.displayName) });
      const newList = isSigned ? current.filter(n => n !== dbUser.displayName) : [...current, dbUser.displayName];
      setEvent({ ...event, fastingSignups: { ...event.fastingSignups, [dateStr]: newList } });
    } catch (e) { toast.error("Error"); }
  };

  // ✅ 1. CHECKLIST LIMPIEZA
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

  // ✅ PRIVACIDAD ENSAYO
  if (event.restricted) return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center p-10 text-center font-outfit">
      <Lock size={60} className="text-slate-200 mb-6"/><h2 className="text-2xl font-black text-slate-900 uppercase">Ensayo Privado</h2>
      <p className="text-slate-500 font-bold text-xs uppercase mt-4 leading-loose">Solo el ministerio de Alabanza puede ver el detalle.</p>
      <button onClick={() => navigate(-1)} className="mt-12 py-4 px-10 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase">Volver</button>
    </div>
  );

  const Config = OPERATIVE_EVENT_TYPES[event.type] || OPERATIVE_EVENT_TYPES.culto;
  
  // ✅ 3. LÓGICA PULSE
  const myStatus = event.confirmations?.[dbUser?.displayName] || 'pending';
  const amIAssigned = Object.values(event.assignments || {}).flat().includes(dbUser?.displayName);
  const shouldPulse = amIAssigned && myStatus === 'pending';

  // ✅ 1. ESTRUCTURAS OPERATIVAS
  const getStructure = () => {
    if (event.type === 'limpieza' || event.type === 'mantenimiento') {
      return [
        { section: 'SECTORES Y TRABAJO', roles: [
          { key: 'salon', label: 'Salón Principal', icon: Church, type: 'multi' },
          { key: 'banos', label: 'Baños y Pasillos', icon: Eraser, type: 'multi' },
          { key: 'vereda', label: 'Vereda y Entrada', icon: ArrowRight, type: 'multi' },
          { key: 'cocina', label: 'Cocina / Anexo', icon: Flame, type: 'multi' }
        ]}
      ];
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
      { section: 'OPERATIVO / UJERES', roles: [
          { key: 'bienvenida', label: 'Bienvenida', icon: Users, type: 'multi' },
          { key: 'porteria', label: 'Portero (cerrar iglesia)', icon: Lock, type: 'single' },
          { key: 'pasillos', label: 'Pasillos', icon: ArrowRight, type: 'multi' },
          { key: 'seguridad_autos', label: 'Seguridad Autos', icon: Car, type: 'multi' },
          { key: 'control_banos', label: 'Control de Baños', icon: Eraser, type: 'multi' },
          { key: 'servicio_altar', label: 'Servicio Altar', icon: Shield, type: 'multi' }
      ]},
      { section: 'TÉCNICA', roles: [
          { key: 'proyeccion', label: 'Proyección', icon: Monitor, type: 'single' },
          { key: 'transmision', label: 'Transmisión Cámaras', icon: Camera, type: 'single' },
          { key: 'sonido', label: 'Sonido', icon: Wrench, type: 'single' }
      ]}
    ];
  };

  const fastDays = (event.type === 'ayuno' && event.endDate) ? eachDayOfInterval({ start: parseISO(event.date), end: parseISO(event.endDate) }) : [];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden font-outfit">
      
      <header className={`relative pt-12 pb-24 px-6 ${Config.color} transition-all`}>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button onClick={() => navigate('/calendario')} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white"><X size={24} /></button>
            <div className="flex gap-2">
                {['pastor', 'lider'].includes(dbUser?.role) && (
                    <>
                      <button onClick={() => setIsEditingMeta(!isEditingMeta)} className={`p-2 rounded-xl ${isEditingMeta ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}><Edit3 size={20}/></button>
                      <button onClick={() => setIsAssigning(!isAssigning)} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${isAssigning ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>{isAssigning ? 'Salir' : 'Asignar'}</button>
                    </>
                )}
            </div>
        </div>

        <div className="flex flex-col items-center text-center mt-4">
            <div className="w-20 h-20 bg-white rounded-[32px] shadow-2xl flex items-center justify-center mb-5 border-4 border-white/20">
                <Config.icon size={40} className={Config.text} />
            </div>
            {isEditingMeta ? (
              <input className="bg-white/20 text-white text-2xl font-black text-center w-full outline-none uppercase tracking-tighter rounded-xl px-2" value={event.title} onChange={e => setEvent({...event, title: e.target.value})} />
            ) : (
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter px-4">{event.title}</h1>
            )}
            {event.isCena && <div className="mt-3 bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest">Cena del Señor</div>}
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-14 bg-white rounded-t-[50px]"></div>
      </header>

      <div className="flex-1 overflow-y-auto bg-white px-6 pb-40 no-scrollbar">
        <div className="max-w-xl mx-auto space-y-8">
            
            {/* ✅ 3. BOTÓN PULSE */}
            {shouldPulse && !isAssigning && (
                <div className="bg-brand-50 border-2 border-brand-200 p-6 rounded-[35px] flex flex-col items-center animate-pulse mt-2">
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">¿Confirmas tu servicio hoy?</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => handleConfirm('confirmed')} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl">Sí, Asistiré</button>
                        <button onClick={() => handleConfirm('declined')} className="px-6 py-4 bg-white text-slate-400 rounded-2xl font-black text-[11px] uppercase border border-slate-100">No puedo</button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center mt-4">
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                   <Calendar size={14} className="text-brand-500"/>
                   {isEditingMeta ? (
                     <div className="flex gap-1">
                        <input type="date" className="bg-white border rounded p-1 text-[10px] font-black" value={event.date} onChange={e => setEvent({...event, date: e.target.value})} />
                        {event.type === 'ayuno' && <><ArrowRight size={10}/><input type="date" className="bg-white border rounded p-1 text-[10px] font-black" value={event.endDate} onChange={e => setEvent({...event, endDate: e.target.value})} /></>}
                     </div>
                   ) : (
                     <span className="text-[11px] font-black text-slate-700 uppercase">{format(parseISO(event.date), "EEEE d MMMM", { locale: es })} {event.endDate && event.endDate !== event.date && ` al ${format(parseISO(event.endDate), "d MMMM", { locale: es })}`}</span>
                   )}
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                   <Clock size={14} className="text-brand-500"/>
                   {isEditingMeta ? (
                     <input type="time" className="bg-transparent font-black text-[11px] outline-none" value={event.time} onChange={e => setEvent({...event, time: e.target.value})} />
                   ) : (
                     <span className="text-[11px] font-black text-slate-700 uppercase">{event.time} hs</span>
                   )}
                </div>
                {isEditingMeta && (
                  <div className="w-full grid grid-cols-2 gap-3 mt-4">
                     <button onClick={() => setEvent({...event, isCena: !event.isCena})} className={`py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${event.isCena ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>Cena del Señor</button>
                     <button onClick={saveAll} className="bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2"><Save size={16}/> Guardar Info</button>
                  </div>
                )}
            </div>

            {/* ✅ 1. CASO AYUNO CONGREGACIONAL */}
            {event.type === 'ayuno' ? (
              <div className="space-y-6">
                <div className="bg-amber-50 p-6 rounded-[35px] border-2 border-amber-100 text-left">
                  <h3 className="text-amber-600 font-black text-xs uppercase flex items-center gap-2 mb-2"><Flame size={16} fill="currentColor"/> Inscripción Diaria</h3>
                  <p className="text-[10px] font-bold text-amber-900/40 uppercase leading-relaxed">Seleccioná los días que vas a ayunar.</p>
                </div>
                <div className="grid gap-4">
                  {fastDays.map((day) => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    const signups = event.fastingSignups?.[dStr] || [];
                    const isMe = signups.includes(dbUser?.displayName);
                    return (
                      <div key={dStr} className={`p-5 rounded-[30px] border-2 transition-all flex flex-col gap-4 ${isMe ? 'bg-white border-amber-500 shadow-xl' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center text-left">
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(day, "EEEE", { locale: es })}</p><p className="text-lg font-black text-slate-800 uppercase tracking-tighter">{format(day, "d 'de' MMMM", { locale: es })}</p></div>
                          <button onClick={() => toggleFast(dStr)} className={`p-4 rounded-2xl shadow-lg ${isMe ? 'bg-amber-500 text-white' : 'bg-white text-slate-300'}`}>{isMe ? <UserMinus size={22}/> : <UserPlus size={22}/>}</button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                           <p className="w-full text-[8px] font-black text-slate-300 uppercase mb-1">Anotados ({signups.length})</p>
                           {signups.map((n, i) => <span key={i} className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase">{n.split(' ')[0]}</span>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ✅ CASO CULTO / LIMPIEZA */
              <div className="space-y-10">
                {getStructure().map((sec, sIdx) => (
                  <div key={sIdx} className="text-left">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 border-l-4 border-brand-500 pl-3 ml-2">{sec.section}</h3>
                    <div className="grid gap-5">
                      {sec.roles.map(role => {
                        const assigned = assignments[role.key] || [];
                        const check = event.checklist?.[role.key] || { done: false, comment: '' };
                        return (
                          <div key={role.key} className="bg-white p-6 rounded-[35px] border border-slate-50 shadow-sm">
                            <div className="flex justify-between items-center mb-5">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400"><role.icon size={18}/></div>
                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{role.label}</span>
                              </div>
                              {isAssigning ? (
                                <button onClick={() => { setActiveRoleKey(role.key); setActiveRoleConfig(role); setIsSelectorOpen(true); }} className="p-2.5 bg-brand-50 text-brand-600 rounded-xl shadow-sm"><Plus size={18}/></button>
                              ) : (
                                (event.type === 'limpieza' || event.type === 'mantenimiento') && (
                                  <button onClick={() => toggleCheck(role.key)} className={`p-2 rounded-xl transition-all ${check.done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>{check.done ? <CheckSquare size={20}/> : <Square size={20}/>}</button>
                                )
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2.5">
                              {assigned.length === 0 ? <p className="text-[9px] font-bold text-slate-300 uppercase italic px-2 py-1">Sin personal</p> : 
                               assigned.map((p, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                                  <span className="text-[10px] font-black text-slate-800 uppercase">{p}</span>
                                  {event.confirmations?.[p] === 'confirmed' && <CheckCircle size={14} className="text-emerald-500"/>}
                                  {isAssigning && <button onClick={() => setAssignments({...assignments, [role.key]: assigned.filter(n => n !== p)})} className="text-rose-500 ml-1"><X size={12}/></button>}
                                </div>
                              ))}
                            </div>

                            {(event.type === 'limpieza' || event.type === 'mantenimiento') && !isAssigning && (
                               <div className="mt-4 pt-4 border-t border-slate-50 flex gap-3 items-center">
                                  <input 
                                    className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-[10px] font-bold outline-none" 
                                    placeholder="Agregar comentario..." 
                                    defaultValue={check.comment}
                                    onBlur={(e) => saveComment(role.key, e.target.value)}
                                  />
                                  {check.comment && <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><MessageSquare size={14}/></div>}
                               </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ✅ BOTÓN "AÑADIR OTRA ACTIVIDAD" */}
            {['jovenes', 'mujeres', 'varones'].includes(event.type) && !isAssigning && (
                <button className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[35px] text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-3"><PlusCircle size={20}/> ¿Desea añadir otra actividad?</button>
            )}
        </div>
      </div>

      {isAssigning && (
        <div className="absolute bottom-0 w-full p-6 bg-white border-t border-slate-100 shadow-2xl z-50 flex gap-4 animate-slide-up">
           <button onClick={async () => { if(window.confirm("¿Eliminar actividad?")) { await deleteDoc(doc(db, 'events', id)); navigate('/calendario'); } }} className="p-5 bg-rose-50 text-rose-500 rounded-3xl"><Trash2 size={24}/></button>
           <button onClick={saveAll} disabled={isSaving} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 uppercase text-[11px] tracking-widest active:scale-95 transition-all">
             {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Guardar Cambios
           </button>
        </div>
      )}

      {/* ✅ SELECTOR DE PERSONAL CON GRUPOS */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-end justify-center" onClick={() => setIsSelectorOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[50px] h-[88vh] flex flex-col animate-slide-up shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b flex justify-between items-center text-left bg-white shrink-0">
               <div><h3 className="font-black text-slate-900 text-sm uppercase">Asignar Personal</h3><p className="text-[9px] font-bold text-slate-400 uppercase">CDS Plátanos</p></div>
               <button onClick={() => setIsSelectorOpen(false)} className="p-3 bg-slate-50 rounded-full active:scale-90"><X size={20}/></button>
            </div>
            <div className="p-5 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-50 bg-slate-50/50 shrink-0">
               {['Alabanza', 'Ujieres', 'Multimedia', 'Niños', 'Limpieza'].map(area => (
                 <button key={area} onClick={() => assignGroup(area)} className="px-5 py-2.5 bg-brand-50 text-brand-600 rounded-xl text-[9px] font-black uppercase whitespace-nowrap border border-brand-100">+ Grupo {area}</button>
               ))}
            </div>
            <div className="p-5 bg-white shrink-0"><div className="bg-slate-50 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-inner"><Search size={18} className="text-slate-300"/><input autoFocus type="text" placeholder="Buscar por nombre..." className="w-full text-sm font-bold outline-none bg-transparent" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/></div></div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2 no-scrollbar pb-32">
              {users.filter(u => u.displayName?.toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => {
                const isAlready = (assignments[activeRoleKey] || []).includes(u.displayName);
                return (
                  <button key={u.id} onClick={() => {
                    const curr = assignments[activeRoleKey] || [];
                    setAssignments({ ...assignments, [activeRoleKey]: isAlready ? curr.filter(n => n !== u.displayName) : (activeRoleConfig.type === 'single' ? [u.displayName] : [...curr, u.displayName]) });
                  }} className={`w-full flex items-center gap-4 p-4 rounded-3xl border-2 transition-all text-left ${isAlready ? 'bg-brand-600 border-brand-600 text-white shadow-xl' : 'bg-white border-slate-50'}`}>
                    <div className="w-12 h-12 rounded-2xl border-2 border-white overflow-hidden shadow-sm shrink-0"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0"><p className={`font-black text-xs uppercase truncate ${isAlready ? 'text-white' : 'text-slate-800'}`}>{u.displayName}</p><p className={`text-[9px] font-bold uppercase mt-0.5 ${isAlready ? 'text-white/60' : 'text-slate-400'}`}>{u.area || 'Miembro'}</p></div>
                    {isAlready ? <Check size={20} className="text-white"/> : <Plus size={20} className="text-slate-200"/>}
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