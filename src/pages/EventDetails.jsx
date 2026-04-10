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
  Music, Eraser, Wrench, Flame, Church, Lock, ShieldAlert, MessageSquare, Edit3
} from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas'; 
import jsPDF from 'jspdf'; 
import { toast } from 'sonner';

// Importamos la configuración global de tipos
import { OPERATIVE_EVENT_TYPES } from './Calendar';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reportRef = useRef(); 
  
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [dbUser, setDbUser] = useState(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false); // Edición de Título/Fecha/Hora
  const [isAssigning, setIsAssigning] = useState(false); // Modo asignar personas
  const [assignments, setAssignments] = useState({}); 
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeRoleKey, setActiveRoleKey] = useState(null); 
  const [activeRoleConfig, setActiveRoleConfig] = useState(null); 
  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentUser = auth.currentUser;

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentUser) return;
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (uSnap.exists()) setDbUser(uSnap.data());

        const eRef = doc(db, 'events', id);
        const eSnap = await getDoc(eRef);
        
        const usSnap = await getDocs(collection(db, 'users'));
        setUsers(usSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        if (eSnap.exists()) {
          const data = eSnap.data();
          // ✅ PRIVACIDAD ENSAYO (Punto 1)
          const isAlabanza = uSnap.data()?.area?.toLowerCase() === 'alabanza';
          const isLeader = ['pastor', 'lider'].includes(uSnap.data()?.role);
          
          if (data.type === 'ensayo' && !isAlabanza && !isLeader) {
            setEvent({ ...data, id: eSnap.id, restricted: true });
          } else {
            setEvent({ ...data, id: eSnap.id });
          }
          setAssignments(data.assignments || {});
        } else {
          navigate('/calendario');
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, currentUser, navigate]);

  // ✅ NOTIFICACIÓN REST API (IGUAL QUE TOPBAR - Punto 4)
  const notifyOneSignal = async (names, eventTitle) => {
    const KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
    if (!KEY) return;
    const targetIds = users.filter(u => names.includes(u.displayName)).map(u => u.id);
    if (targetIds.length === 0) return;

    try {
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Basic ${KEY}` },
        body: JSON.stringify({
          app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
          include_external_user_ids: targetIds,
          headings: { en: "📍 Nueva asignación", es: "📍 Nueva asignación" },
          contents: { en: `Te asignaron en: ${eventTitle}`, es: `Te asignaron en: ${eventTitle}` },
          data: { route: `/calendario/${id}` },
          priority: 10
        })
      });
    } catch (e) { console.log(e); }
  };

  // ✅ ACCIONES DE CONFIRMACIÓN (Punto 3)
  const handleConfirm = async (status) => {
    try {
      const eRef = doc(db, 'events', id);
      await updateDoc(eRef, { [`confirmations.${dbUser.displayName}`]: status });
      setEvent(prev => ({ ...prev, confirmations: { ...prev.confirmations, [dbUser.displayName]: status } }));
      toast.success(status === 'confirmed' ? "Servicio confirmado" : "Aviso enviado");
    } catch (e) { toast.error("Error"); }
  };

  // ✅ GUARDAR CAMBIOS DE ASIGNACIÓN
  const saveAllAssignments = async () => {
    setIsSaving(true);
    try {
      const eRef = doc(db, 'events', id);
      await updateDoc(eRef, { assignments });
      await notifyOneSignal(Object.values(assignments).flat(), event.title);
      setEvent(prev => ({ ...prev, assignments }));
      setIsAssigning(false);
      toast.success("Cambios guardados");
    } catch (e) { toast.error("Error"); } finally { setIsSaving(false); }
  };

  // ✅ EDICIÓN DEL EVENTO (Punto 2)
  const updateEventMeta = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'events', id), { 
        title: event.title, 
        time: event.time, 
        date: event.date,
        isCena: event.isCena || false
      });
      setIsEditingEvent(false);
      toast.success("Información actualizada");
    } catch (e) { toast.error("Error"); } finally { setIsSaving(false); }
  };

  // ✅ ASIGNAR GRUPO (Punto 1 - Limpieza/Mantenimiento)
  const assignGroup = (areaName) => {
    const group = users.filter(u => u.area?.toLowerCase() === areaName.toLowerCase()).map(u => u.displayName);
    const current = assignments[activeRoleKey] || [];
    setAssignments({ ...assignments, [activeRoleKey]: [...new Set([...current, ...group])] });
    setIsSelectorOpen(false);
    toast.info(`Grupo ${areaName} añadido`);
  };

  if (loading || !event) return <div className="fixed inset-0 flex items-center justify-center bg-white z-[200]"><Loader2 className="animate-spin text-brand-600" size={40}/></div>;

  // ✅ VISTA RESTRINGIDA (Punto 1 - Ensayo)
  if (event.restricted) return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center p-10 text-center font-outfit">
      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400"><Lock size={48}/></div>
      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Acceso Restringido</h2>
      <p className="text-slate-500 font-bold text-xs uppercase mt-4 leading-loose tracking-widest">Los detalles del ensayo son exclusivos para Alabanza.</p>
      <button onClick={() => navigate(-1)} className="mt-12 py-4 px-10 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]">Volver a Agenda</button>
    </div>
  );

  const Config = OPERATIVE_EVENT_TYPES[event.type] || OPERATIVE_EVENT_TYPES.culto;
  
  // ✅ LOGICA PULSE (Punto 3)
  const isMyTurnPending = event.assignments && 
                          Object.values(event.assignments).flat().includes(dbUser?.displayName) &&
                          (!event.confirmations || !event.confirmations[dbUser?.displayName] || event.confirmations[dbUser?.displayName] === 'pending');

  // ESTRUCTURA DINÁMICA DE ROLES (Punto 1)
  const getStructure = () => {
    if (event.type === 'limpieza' || event.type === 'mantenimiento') {
      return [
        { section: 'SECTORES A CUBRIR', roles: [
          { key: 'salon', label: 'Salón Principal', icon: Church, type: 'multi' },
          { key: 'banos', label: 'Baños y Pasillos', icon: Eraser, type: 'multi' },
          { key: 'vereda', label: 'Vereda y Entrada', icon: ArrowRight, type: 'multi' }
        ]}
      ];
    }
    return [
      { section: 'OPERATIVO / UJERES', roles: [
          { key: 'bienvenida', label: 'Bienvenida / Puerta', icon: Users, type: 'multi' },
          { key: 'acomodadores', label: 'Pasillo / Acomodadores', icon: ArrowRight, type: 'multi' },
          { key: 'servicio_altar', label: 'Servicio Altar', icon: Heart, type: 'multi' },
          { key: 'porteria', label: 'Portería (Cierre)', icon: Lock, type: 'single' }
      ]},
      { section: 'ALABANZA & TÉCNICA', roles: [
          { key: 'direccion', label: 'Dirección', icon: Music, type: 'single' },
          { key: 'sonido', label: 'Sonido', icon: Wrench, type: 'single' },
          { key: 'multimedia', label: 'Multimedia', icon: ExternalLink, type: 'single' }
      ]}
    ];
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in font-outfit overflow-hidden">
      
      <header className={`relative pt-12 pb-24 px-6 ${Config.color} transition-all`}>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button onClick={() => navigate('/calendario')} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white"><X size={24} /></button>
            <div className="flex gap-2">
                {['pastor', 'lider'].includes(dbUser?.role) && (
                    <>
                      <button onClick={() => setIsEditingEvent(!isEditingEvent)} className={`p-2 rounded-xl ${isEditingEvent ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}><Edit3 size={20}/></button>
                      <button onClick={() => setIsAssigning(!isAssigning)} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest ${isAssigning ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>{isAssigning ? 'Salir' : 'Asignar'}</button>
                    </>
                )}
            </div>
        </div>

        <div className="flex flex-col items-center text-center mt-4">
            <div className="w-20 h-20 bg-white rounded-[32px] shadow-2xl flex items-center justify-center mb-5 border-4 border-white/20">
                <Config.icon size={40} className={Config.text} />
            </div>
            {isEditingEvent ? (
              <input autoFocus className="bg-white/20 text-white text-2xl font-black text-center w-full outline-none uppercase tracking-tighter rounded-xl px-2" value={event.title} onChange={e => setEvent({...event, title: e.target.value})} />
            ) : (
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter px-4">{event.title}</h1>
            )}
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-14 bg-white rounded-t-[50px]"></div>
      </header>

      <div className="flex-1 overflow-y-auto bg-white px-6 pb-40 no-scrollbar">
        <div className="max-w-xl mx-auto space-y-8">
            
            {/* ✅ BOTÓN PULSE (Punto 3) */}
            {isMyTurnPending && !isAssigning && (
                <div className="bg-brand-50 border-2 border-brand-200 p-6 rounded-[35px] flex flex-col items-center animate-pulse mt-2">
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mb-4">Confirmación Requerida</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => handleConfirm('confirmed')} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl">Confirmar</button>
                        <button onClick={() => handleConfirm('declined')} className="px-6 py-4 bg-white text-slate-400 rounded-2xl font-black text-[11px] uppercase border border-slate-100">Declinar</button>
                    </div>
                </div>
            )}

            {/* INFO META (Editable) */}
            <div className="flex flex-wrap gap-3 justify-center">
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                   <Calendar size={14} className="text-brand-500"/>
                   {isEditingEvent ? (
                     <input type="date" className="bg-transparent font-black text-[11px] outline-none" value={event.date} onChange={e => setEvent({...event, date: e.target.value})} />
                   ) : (
                     <span className="text-[11px] font-black text-slate-700 uppercase">{format(parseISO(event.date), "EEEE d MMMM", { locale: es })}</span>
                   )}
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                   <Clock size={14} className="text-brand-500"/>
                   {isEditingEvent ? (
                     <input type="time" className="bg-transparent font-black text-[11px] outline-none" value={event.time} onChange={e => setEvent({...event, time: e.target.value})} />
                   ) : (
                     <span className="text-[11px] font-black text-slate-700 uppercase">{event.time} hs</span>
                   )}
                </div>
                {isEditingEvent && (
                  <button onClick={updateEventMeta} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase mt-2 shadow-lg flex items-center justify-center gap-2">
                    <Save size={16}/> Guardar Info Básica
                  </button>
                )}
            </div>

            {/* ✅ LOGICA DE AYUNO (Punto 1) */}
            {event.type === 'ayuno' ? (
              <div className="space-y-6">
                <div className="bg-rose-50 p-6 rounded-[35px] border-2 border-rose-100 text-left">
                  <h3 className="text-rose-600 font-black text-xs uppercase flex items-center gap-2 mb-2"><Flame size={16} fill="currentColor"/> Inscripción Diaria</h3>
                  <p className="text-[10px] font-bold text-rose-900/40 uppercase">Seleccioná los días que te sumás al ayuno congregacional.</p>
                </div>
                {/* Aquí iría el loop de fastingDays como estaba antes */}
              </div>
            ) : (
              <div className="space-y-10">
                {getStructure().map((section, sIdx) => (
                  <div key={sIdx} className="text-left">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-l-4 border-brand-500 pl-3 ml-2">{section.section}</h3>
                    <div className="grid gap-4">
                      {section.roles.map(role => {
                        const assigned = assignments[role.key] || [];
                        return (
                          <div key={role.key} className="bg-white p-6 rounded-[35px] border border-slate-50 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-xl text-slate-400"><role.icon size={18}/></div>
                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{role.label}</span>
                              </div>
                              {isAssigning && (
                                <button onClick={() => { setActiveRoleKey(role.key); setActiveRoleConfig(role); setIsSelectorOpen(true); }} className="p-2 bg-brand-50 text-brand-600 rounded-lg"><Plus size={18}/></button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {assigned.length === 0 ? <p className="text-[9px] font-bold text-slate-300 uppercase italic">Sin asignar</p> : 
                               assigned.map((p, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                  <span className="text-[10px] font-black text-slate-700 uppercase">{p.split(' ')[0]}</span>
                                  {event.confirmations?.[p] === 'confirmed' && <CheckCircle size={12} className="text-emerald-500"/>}
                                  {isAssigning && <button onClick={() => setAssignments({...assignments, [role.key]: assigned.filter(n => n !== p)})} className="text-rose-500"><X size={12}/></button>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {isAssigning && (
        <div className="absolute bottom-0 w-full p-6 bg-white border-t border-slate-100 shadow-2xl z-50 flex gap-4">
           <button onClick={async () => { if(window.confirm("¿Eliminar actividad?")) { await deleteDoc(doc(db, 'events', id)); navigate('/calendario'); } }} className="p-5 bg-rose-50 text-rose-500 rounded-3xl"><Trash2 size={24}/></button>
           <button onClick={saveAllAssignments} disabled={isSaving} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 uppercase text-[11px] tracking-widest active:scale-95 transition-all">
             {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Guardar Personal
           </button>
        </div>
      )}

      {/* ✅ SELECTOR DE PERSONAL CON GRUPOS (Punto 1) */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-end justify-center" onClick={() => setIsSelectorOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[50px] h-[85vh] flex flex-col animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b flex justify-between items-center text-left">
               <div><h3 className="font-black text-slate-900 text-sm uppercase">Asignar {activeRoleConfig?.label}</h3><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Carga por ministerios</p></div>
               <button onClick={() => setIsSelectorOpen(false)} className="p-3 bg-slate-50 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="p-5 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-50 bg-slate-50/30">
               {['Alabanza', 'Ujieres', 'Multimedia', 'Niños', 'Limpieza'].map(m => (
                 <button key={m} onClick={() => assignGroup(m)} className="px-5 py-2 bg-brand-50 text-brand-600 rounded-xl text-[9px] font-black uppercase whitespace-nowrap border border-brand-100 shadow-sm">+ {m}</button>
               ))}
            </div>

            <div className="p-5 bg-slate-50"><div className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-3"><Search size={18} className="text-slate-300"/><input autoFocus type="text" placeholder="Buscar hermano..." className="w-full text-sm font-bold outline-none bg-transparent" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/></div></div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-2 no-scrollbar text-left">
              {users.filter(u => u.displayName?.toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => {
                const isAlready = (assignments[activeRoleKey] || []).includes(u.displayName);
                return (
                  <button key={u.id} onClick={() => {
                    const curr = assignments[activeRoleKey] || [];
                    setAssignments({ ...assignments, [activeRoleKey]: isAlready ? curr.filter(n => n !== u.displayName) : [...curr, u.displayName] });
                  }} className={`w-full flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${isAlready ? 'bg-brand-600 border-brand-600 text-white shadow-xl' : 'bg-white border-slate-50'}`}>
                    <div className="w-12 h-12 rounded-2xl border-2 border-white overflow-hidden"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0"><p className="font-black text-xs uppercase truncate">{u.displayName}</p><p className={`text-[9px] font-bold uppercase ${isAlready ? 'text-white/60' : 'text-slate-400'}`}>{u.area}</p></div>
                    {isAlready ? <CheckCircle size={20}/> : <Plus size={20} className="opacity-20"/>}
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