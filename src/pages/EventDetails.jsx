import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'; 
import { 
  X, Calendar, Clock, Save, Trash2, Plus, Users, 
  CheckCircle, Download, Loader2, Search, HelpCircle,
  AlertCircle, Check, ExternalLink, ArrowRight, UserPlus, UserMinus, Heart,
  Music, Eraser, Wrench, Flame, Church, Lock, ShieldAlert, MessageSquare
} from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas'; 
import jsPDF from 'jspdf'; 

// Importamos la config de tipos que definimos en Calendar
import { OPERATIVE_EVENT_TYPES } from './Calendar';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reportRef = useRef(); 
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null); 
  const [isEditing, setIsEditing] = useState(false); 
  const [assignments, setAssignments] = useState({}); 
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeRoleKey, setActiveRoleKey] = useState(null); 
  const [activeRoleConfig, setActiveRoleConfig] = useState(null); 
  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        let currentDbUser = null;
        if (userSnap.exists()) {
            currentDbUser = userSnap.data();
            setUserRole(currentDbUser.role);
        }

        const eventRef = doc(db, 'events', id);
        const eventSnap = await getDoc(eventRef);
        
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        usersList.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setUsers(usersList);

        if (eventSnap.exists()) {
          const data = eventSnap.id ? { id: eventSnap.id, ...eventSnap.data() } : null;
          
          // ✅ PRIVACIDAD ENSAYO (Punto 1)
          const isWorshipMember = currentDbUser?.area?.toLowerCase() === 'alabanza';
          const isLeader = ['pastor', 'lider'].includes(currentDbUser?.role);
          if (data.type === 'ensayo' && !isWorshipMember && !isLeader) {
              setEvent({ ...data, restricted: true });
          } else {
              setEvent(data);
          }
          setAssignments(data.assignments || {});
        } else {
          navigate('/calendario');
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, navigate, currentUser]);

  // ✅ NOTIFICACIÓN PRO (Fix Windows/iPhone)
  const notifyNewAssignments = async (newAssignments) => {
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      if (!REST_API_KEY) return;

      const oldAssigned = Object.values(event.assignments || {}).flat();
      const currentAssigned = Object.values(newAssignments).flat();
      const newlyAddedNames = currentAssigned.filter(name => !oldAssigned.includes(name));
      if (newlyAddedNames.length === 0) return;

      const targetUserIds = users.filter(u => newlyAddedNames.includes(u.displayName)).map(u => u.id);
      
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: APP_ID,
          include_external_user_ids: targetUserIds,
          headings: { en: "📍 Tarea asignada", es: "📍 Tarea asignada" },
          contents: { en: `Fuiste asignado en: ${event.title}. Toca para confirmar.`, es: `Fuiste asignado en: ${event.title}. Toca para confirmar.` },
          data: { route: `/calendario/${id}` },
          priority: 10
        })
      });
    } catch (error) { console.error(error); }
  };

  const handleConfirmTask = async (status) => {
    if (!currentUser) return;
    try {
      const eventRef = doc(db, 'events', id);
      const currentConf = event.confirmations || {};
      await updateDoc(eventRef, {
        [`confirmations.${currentUser.displayName}`]: status
      });
      setEvent(prev => ({
        ...prev,
        confirmations: { ...currentConf, [currentUser.displayName]: status }
      }));
      setToast({ message: status === 'confirmed' ? "¡Servicio confirmado!" : "Aviso enviado", type: "success" });
    } catch (e) { toast.error("Error al confirmar"); }
  };

  const handleSaveAssignments = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'events', id), { assignments });
      await notifyNewAssignments(assignments); 
      setEvent(prev => ({ ...prev, assignments }));
      setToast({ message: "Cambios guardados", type: "success" });
      setIsEditing(false);
    } catch (error) { toast.error("Error al guardar"); } 
    finally { setIsSaving(false); }
  };

  // ✅ LÓGICA DE ASIGNACIÓN POR GRUPO (Ministerio)
  const assignMinistryGroup = (areaName) => {
    const ministryUsers = users.filter(u => u.area?.toLowerCase() === areaName.toLowerCase());
    const names = ministryUsers.map(u => u.displayName);
    const currentList = assignments[activeRoleKey] || [];
    const newList = [...new Set([...currentList, ...names])];
    setAssignments({ ...assignments, [activeRoleKey]: newList });
    setIsSelectorOpen(false);
    toast.success(`Grupo ${areaName} añadido`);
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`Agenda-${event.title}.pdf`);
    } catch (e) { toast.error("Error PDF"); } 
    finally { setIsDownloading(false); }
  };

  if (loading || !event) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  // ✅ VISTA RESTRINGIDA (Ensayo Alabanza)
  if (event.restricted) return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-10 text-center font-outfit">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400"><Lock size={48}/></div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Acceso Privado</h2>
        <p className="text-sm font-medium text-slate-500 mt-4 leading-relaxed">Los detalles de los ensayos de Alabanza solo son visibles para los integrantes del ministerio.</p>
        <button onClick={() => navigate(-1)} className="mt-10 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Volver</button>
    </div>
  );

  const TypeConfig = OPERATIVE_EVENT_TYPES[event.type] || OPERATIVE_EVENT_TYPES.culto;
  const isMyTaskPending = event.assignments && 
                          Object.values(event.assignments).flat().includes(currentUser?.displayName) &&
                          (!event.confirmations || !event.confirmations[currentUser?.displayName] || event.confirmations[currentUser?.displayName] === 'pending');

  const structure = [
    { section: 'OPERATIVO / UJERES', roles: [
        { key: 'bienvenida', label: 'Bienvenida / Puerta', icon: Users, type: 'multi' },
        { key: 'acomodadores', label: 'Pasillo / Acomodadores', icon: ArrowRight, type: 'multi' },
        { key: 'servicio_altar', label: 'Servicio Altar', icon: Heart, type: 'multi' },
        { key: 'porteria', label: 'Portería (Cierre)', icon: Lock, type: 'single' }
    ]},
    { section: 'ALABANZA & TÉCNICA', roles: [
        { key: 'direccion', label: 'Dirección Alabanza', icon: Music, type: 'single' },
        { key: 'sonido', label: 'Consola de Sonido', icon: Wrench, type: 'single' },
        { key: 'multimedia', label: 'Multimedia / Letras', icon: ExternalLink, type: 'single' }
    ]}
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden font-outfit">
      
      <header className={`relative pt-12 pb-24 px-6 ${TypeConfig.color} flex-shrink-0`}>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button onClick={() => navigate('/calendario')} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white active:scale-90"><X size={24} /></button>
            <div className="flex gap-2">
                <button onClick={downloadPDF} disabled={isDownloading} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white">
                  {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20}/>}
                </button>
                {['pastor', 'lider'].includes(userRole) && (
                    <button onClick={() => setIsEditing(!isEditing)} className={`px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isEditing ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>
                        {isEditing ? 'Salir' : 'Asignar'}
                    </button>
                )}
            </div>
        </div>
        <div className="flex flex-col items-center text-center mt-4">
            <div className="w-20 h-20 bg-white rounded-[30px] shadow-2xl flex items-center justify-center mb-5">
                <TypeConfig.icon size={40} className={TypeConfig.text} />
            </div>
            <h1 className="text-2xl font-black text-white leading-tight px-4 uppercase tracking-tighter">{event.title}</h1>
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-14 bg-white rounded-t-[50px]"></div>
      </header>

      <div className="flex-1 overflow-y-auto bg-white px-6 pb-40 no-scrollbar">
        <div className="max-w-xl mx-auto space-y-8">
            
            {/* ✅ BOTÓN DE CONFIRMACIÓN PARPADEANTE (Punto 3) */}
            {isMyTaskPending && !isEditing && (
                <div className="bg-brand-50 border-2 border-brand-200 p-6 rounded-[35px] flex flex-col items-center animate-pulse">
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Tienes una tarea asignada</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => handleConfirmTask('confirmed')} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">Confirmar Asistencia</button>
                        <button onClick={() => handleConfirmTask('declined')} className="px-6 py-4 bg-white text-slate-400 rounded-2xl font-black text-[11px] uppercase border border-slate-100">No puedo</button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl text-[11px] font-black text-slate-700 uppercase border border-slate-100"><Calendar size={14} className="text-brand-500"/>{format(parseISO(event.date), "EEEE d MMMM", { locale: es })}</div>
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl text-[11px] font-black text-slate-700 uppercase border border-slate-100"><Clock size={14} className="text-brand-500"/>{event.time} hs</div>
            </div>

            {/* CUERPO DEL EVENTO */}
            <div className="space-y-10">
                {structure.map((section, idx) => (
                    <div key={idx} className="text-left">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 ml-2 border-l-4 border-brand-500 pl-3">{section.section}</h3>
                        <div className="grid gap-4">
                            {section.roles.map(role => {
                                const assigned = assignments[role.key] || [];
                                return (
                                    <div key={role.key} className="bg-white p-5 rounded-[30px] border border-slate-50 shadow-sm flex flex-col gap-4">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-50 rounded-xl text-slate-400"><role.icon size={18}/></div>
                                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{role.label}</span>
                                            </div>
                                            {isEditing && (
                                                <button onClick={() => { setActiveRoleKey(role.key); setActiveRoleConfig(role); setIsSelectorOpen(true); }} className="p-2 bg-brand-50 text-brand-600 rounded-lg"><Plus size={20}/></button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {assigned.length === 0 ? (
                                                <p className="text-[9px] font-bold text-slate-300 uppercase italic">Sin asignar</p>
                                            ) : (
                                                assigned.map((p, i) => (
                                                    <div key={i} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                                        <span className="text-[10px] font-black text-slate-700 uppercase">{p}</span>
                                                        {!isEditing && event.confirmations?.[p] === 'confirmed' && <CheckCircle size={12} className="text-emerald-500"/>}
                                                        {isEditing && <button onClick={() => setAssignments({...assignments, [role.key]: assigned.filter(n => n !== p)})} className="text-rose-500"><X size={12}/></button>}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {isEditing && (
          <div className="p-6 bg-white border-t border-slate-100 absolute bottom-0 w-full shadow-2xl flex gap-3 z-50">
              <button onClick={handleSaveAssignments} disabled={isSaving} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 uppercase text-xs tracking-widest active:scale-95 transition-all">
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20}/>} Guardar Cambios
              </button>
          </div>
      )}

      {/* ✅ SELECTOR DE PERSONAL CON ASIGNACIÓN POR GRUPOS (Punto 1) */}
      {isSelectorOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-end justify-center" onClick={() => setIsSelectorOpen(false)}>
              <div className="bg-white w-full max-w-md rounded-t-[50px] h-[85vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="p-8 border-b flex justify-between items-center text-left">
                      <div><h3 className="font-black text-slate-900 text-sm uppercase">Seleccionar Personal</h3><p className="text-[9px] font-bold text-slate-400 uppercase">Carga individual o por ministerio</p></div>
                      <button onClick={() => setIsSelectorOpen(false)} className="p-3 bg-slate-50 rounded-full"><X size={20}/></button>
                  </div>
                  
                  {/* BOTONES DE GRUPO */}
                  <div className="p-5 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-50">
                      {['Alabanza', 'Ujieres', 'Multimedia', 'Niños', 'Limpieza'].map(m => (
                          <button key={m} onClick={() => assignMinistryGroup(m)} className="px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-[9px] font-black uppercase whitespace-nowrap border border-brand-100">+ Grupo {m}</button>
                      ))}
                  </div>

                  <div className="p-5 bg-slate-50"><div className="bg-white rounded-2xl px-5 py-3 flex items-center gap-3"><Search size={18} className="text-slate-300"/><input type="text" placeholder="Buscar hermano..." className="w-full text-sm font-bold outline-none bg-transparent" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/></div></div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-2 no-scrollbar text-left">
                      {users.filter(u => u.displayName?.toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => {
                          const isAssigned = (assignments[activeRoleKey] || []).includes(u.displayName);
                          return (
                              <button key={u.id} onClick={() => {
                                    const current = assignments[activeRoleKey] || [];
                                    setAssignments({ ...assignments, [activeRoleKey]: isAssigned ? current.filter(n => n !== u.displayName) : [...current, u.displayName] });
                                }} className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isAssigned ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-50 text-slate-800'}`}>
                                  <span className="font-black text-xs uppercase">{u.displayName}</span>
                                  {isAssigned ? <CheckCircle size={18}/> : <Plus size={18} className="text-slate-200"/>}
                              </button>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}

      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[600] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}