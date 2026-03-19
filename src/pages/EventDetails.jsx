import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'; 
import { 
  X, Calendar, Clock, Save, Trash2, Plus, Users, 
  CheckCircle, Download, Loader2, Search, HelpCircle,
  AlertCircle, Check, ExternalLink, ArrowRight, UserPlus, UserMinus, Heart 
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas'; 
import jsPDF from 'jspdf'; 

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
        if (userSnap.exists()) setUserRole(userSnap.data().role);

        const eventRef = doc(db, 'events', id);
        const eventSnap = await getDoc(eventRef);
        
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        usersList.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setUsers(usersList);

        if (eventSnap.exists()) {
          const data = eventSnap.data();
          setEvent({ id: eventSnap.id, ...data });
          setAssignments(data.assignments || {});
        } else {
          navigate('/calendario');
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, navigate, currentUser]);

  // ✅ LÓGICA DE AYUNO: ANOTARSE / DARSE DE BAJA
  const toggleFastingSignup = async (dateStr) => {
    if (!currentUser) return;
    const eventRef = doc(db, 'events', id);
    const daySignups = event.fastingSignups?.[dateStr] || [];
    const isAlreadySignedUp = daySignups.includes(currentUser.displayName);

    try {
      if (isAlreadySignedUp) {
        const newList = daySignups.filter(name => name !== currentUser.displayName);
        await updateDoc(eventRef, { [`fastingSignups.${dateStr}`]: newList });
      } else {
        await updateDoc(eventRef, { [`fastingSignups.${dateStr}`]: arrayUnion(currentUser.displayName) });
      }
      
      const updatedFast = { ...event.fastingSignups, [dateStr]: isAlreadySignedUp 
        ? daySignups.filter(n => n !== currentUser.displayName)
        : [...daySignups, currentUser.displayName] 
      };
      setEvent(prev => ({ ...prev, fastingSignups: updatedFast }));
      setToast({ message: isAlreadySignedUp ? "Ya no participas este día" : "¡Te has anotado!", type: "success" });
    } catch (e) { setToast({ message: "Error al actualizar", type: "error" }); }
  };

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
      if (targetUserIds.length === 0) return;

      const path = `/calendario/${id}`;
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: APP_ID,
          include_external_user_ids: targetUserIds,
          headings: { en: "📍 Tarea asignada", es: "📍 Tarea asignada" },
          contents: { en: `Fuiste asignado en: ${event.title}.`, es: `Fuiste asignado en: ${event.title}.` },
          web_url: `https://cdsapp.vercel.app/#${path}`,
          data: { route: path },
          priority: 10
        })
      });
    } catch (error) { /* error silent */ }
  };

  const handleSaveAssignments = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'events', id), { assignments });
      await notifyNewAssignments(assignments); 
      setEvent(prev => ({ ...prev, assignments }));
      setToast({ message: "Cambios guardados", type: "success" });
      setIsEditing(false);
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); } 
    finally { setIsSaving(false); }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`Agenda-${event.title}.pdf`);
      setToast({ message: "PDF generado", type: "success" });
    } catch (e) { setToast({ message: "Error PDF", type: "error" }); } 
    finally { setIsDownloading(false); }
  };

  if (loading || !event) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
  const canEdit = ['pastor', 'lider'].includes(userRole);
  const fastingDays = (event.type === 'ayuno' && event.endDate) 
    ? eachDayOfInterval({ start: parseISO(event.date), end: parseISO(event.endDate) })
    : [parseISO(event.date)];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden font-outfit">
      
      <header className={`relative pt-12 pb-24 px-6 ${event.type === 'ayuno' ? 'bg-rose-600' : 'bg-slate-900'} flex-shrink-0`}>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button onClick={() => navigate('/calendario')} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"><X size={24} /></button>
            <div className="flex gap-2">
                <button onClick={downloadPDF} disabled={isDownloading} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white active:scale-90">
                  {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20}/>}
                </button>
                {canEdit && event.type !== 'ayuno' && (
                    <button onClick={() => setIsEditing(!isEditing)} className={`px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isEditing ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>
                        {isEditing ? 'Cancelar' : 'Asignar'}
                    </button>
                )}
            </div>
        </div>
        <div className="flex flex-col items-center text-center mt-4">
            <div className="w-20 h-20 bg-white rounded-[30px] shadow-2xl flex items-center justify-center mb-5 border-4 border-white/20">
                <TypeConfig.icon size={40} className={event.type === 'ayuno' ? 'text-rose-600' : 'text-slate-800'} />
            </div>
            <h1 className="text-2xl font-black text-white leading-tight px-4 uppercase tracking-tighter">{event.title}</h1>
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-14 bg-white rounded-t-[50px]"></div>
      </header>

      <div ref={reportRef} className="flex-1 overflow-y-auto bg-white px-6 pb-32 no-scrollbar">
        <div className="max-w-xl mx-auto space-y-8">
            <div className="flex flex-wrap gap-3 justify-center mt-2">
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl text-[11px] font-black text-slate-700 border border-slate-100 uppercase tracking-widest shadow-sm">
                    <Calendar size={14} className="text-brand-500"/>
                    {format(parseISO(event.date), "EEEE d", { locale: es })}
                    {event.endDate && event.endDate !== event.date && (
                      <> <ArrowRight size={10} className="mx-1"/> {format(parseISO(event.endDate), "EEEE d 'de' MMMM", { locale: es })} </>
                    )}
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl text-[11px] font-black text-slate-700 border border-slate-100 uppercase tracking-widest shadow-sm">
                    <Clock size={14} className="text-brand-500"/>{event.time} hs
                </div>
            </div>

            {event.type === 'ayuno' ? (
              <div className="space-y-6">
                <div className="bg-rose-50 p-6 rounded-[35px] border-2 border-rose-100">
                  <h3 className="text-rose-600 font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Heart size={16} fill="currentColor"/> Unánimes en oración
                  </h3>
                  <p className="text-rose-900/60 text-[10px] font-bold leading-relaxed uppercase">
                    Selecciona el día que vas a ayunar. Podés elegir varios.
                  </p>
                </div>
                <div className="grid gap-4">
                  {fastingDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const daySignups = event.fastingSignups?.[dateStr] || [];
                    const amISignedUp = daySignups.includes(currentUser?.displayName);
                    return (
                      <div key={dateStr} className={`p-5 rounded-[30px] border-2 transition-all flex flex-col gap-4 ${amISignedUp ? 'bg-white border-rose-500 shadow-xl' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center">
                          <div className="text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(day, "EEEE", { locale: es })}</p>
                            <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">{format(day, "d 'de' MMMM", { locale: es })}</p>
                          </div>
                          <button onClick={() => toggleFastingSignup(dateStr)} className={`p-4 rounded-2xl shadow-lg active:scale-90 ${amISignedUp ? 'bg-rose-500 text-white' : 'bg-white text-slate-400'}`}>
                            {amISignedUp ? <UserMinus size={20}/> : <UserPlus size={20}/>}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                          <p className="w-full text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 text-left">Anotados ({daySignups.length})</p>
                          {daySignups.map((name, i) => (
                            <span key={i} className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black text-slate-600 uppercase shadow-sm">{name.split(' ')[0]}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {(EVENT_TYPES[event.type]?.structure || EVENT_TYPES.culto.structure).map((section, idx) => (
                    <div key={idx} className="bg-white rounded-[35px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-50"><h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-left">{section.section}</h3></div>
                        <div className="p-6 space-y-6">
                            {section.roles.map(role => {
                                const assigned = assignments[role.key] || [];
                                return (
                                    <div key={role.key} className="text-left">
                                        <label className="text-[10px] font-black text-slate-800 uppercase mb-4 flex items-center gap-2.5 tracking-widest"><div className="p-1.5 bg-brand-50 rounded-lg text-brand-600"><role.icon size={14}/></div> {role.label}</label>
                                        <div className="flex flex-wrap gap-2.5">
                                            {assigned.map((p, i) => (
                                                <div key={i} className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-black uppercase border transition-all ${isEditing ? 'bg-brand-600 text-white border-brand-400 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                                    <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200">
                                                        <img src={users.find(u => u.displayName === p)?.photoURL || `https://ui-avatars.com/api/?name=${p}`} className="w-full h-full object-cover" />
                                                    </div>
                                                    {p.split(' ')[0]}
                                                    {!isEditing && (event.confirmations?.[p] === 'confirmed' ? <CheckCircle size={14} className="text-emerald-500"/> : <HelpCircle size={14} className="text-slate-300"/>)}
                                                    {isEditing && <button onClick={() => setAssignments({ ...assignments, [role.key]: assigned.filter(item => item !== p) })} className="p-1 bg-white/20 rounded-full"><X size={12}/></button>}
                                                </div>
                                            ))}
                                            {isEditing && (role.type === 'multi' || assigned.length === 0) && (
                                                <button onClick={() => { setActiveRoleKey(role.key); setActiveRoleConfig(role); setIsSelectorOpen(true); setPersonSearchTerm(''); }} className="w-full mt-3 py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-[0.2em]">+ Añadir Personal</button>
                                            )}
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

      {isEditing && (
          <div className="p-5 bg-white border-t border-slate-100 absolute bottom-0 w-full shadow-2xl flex gap-4 z-50 animate-slide-up">
              <button onClick={async () => { if(window.confirm("¿Borrar?")) { await deleteDoc(doc(db, 'events', id)); navigate('/calendario'); } }} className="p-5 bg-rose-50 text-rose-500 rounded-[24px]"><Trash2 size={24}/></button>
              <button onClick={handleSaveAssignments} disabled={isSaving} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-[24px] shadow-2xl flex items-center justify-center gap-3 uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>} Guardar Cambios
              </button>
          </div>
      )}

      {isSelectorOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setIsSelectorOpen(false)}>
              <div className="bg-white w-full max-w-md rounded-t-[50px] h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="p-8 border-b flex justify-between items-center bg-white shrink-0 text-left">
                      <div><h3 className="font-black text-slate-900 text-sm uppercase tracking-tighter">Asignar {activeRoleConfig?.label}</h3><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Iglesia CDS Plátanos</p></div>
                      <button onClick={() => setIsSelectorOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 active:scale-90"><X size={20}/></button>
                  </div>
                  <div className="p-5 bg-slate-50 shrink-0"><div className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-inner"><Search size={18} className="text-slate-400"/><input autoFocus type="text" placeholder="Escribir nombre..." className="w-full text-sm font-bold outline-none bg-transparent" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/></div></div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar pb-10">
                      {users.filter(u => (u.displayName || '').toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => {
                          const isAlreadyInThisRole = (assignments[activeRoleKey] || []).includes(u.displayName);
                          const isTaken = Object.values(assignments).flat().includes(u.displayName);
                          return (
                              <button key={u.id} disabled={isTaken && !isAlreadyInThisRole} onClick={() => {
                                    const currentList = assignments[activeRoleKey] || [];
                                    const newList = activeRoleConfig.type === 'single' ? [u.displayName] : [...new Set([...currentList, u.displayName])];
                                    setAssignments({ ...assignments, [activeRoleKey]: newList });
                                    setIsSelectorOpen(false);
                                }} className={`w-full flex items-center gap-4 p-4 rounded-[28px] border-2 transition-all text-left ${isAlreadyInThisRole ? 'bg-brand-600 border-brand-600 shadow-xl scale-[0.98]' : isTaken ? 'opacity-20 grayscale' : 'bg-white border-slate-100'}`}>
                                  <div className="w-14 h-14 rounded-2xl border-2 border-white shadow-md overflow-hidden bg-slate-100 shrink-0"><img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-full h-full object-cover" /></div>
                                  <div className="flex-1 min-w-0"><p className={`font-black text-sm uppercase truncate ${isAlreadyInThisRole ? 'text-white' : 'text-slate-800'}`}>{u.displayName}</p><p className={`text-[10px] font-bold uppercase mt-1 tracking-widest ${isAlreadyInThisRole ? 'text-white/60' : 'text-slate-400'}`}>{u.area || 'Miembro'}</p></div>
                                  {isAlreadyInThisRole ? <Check size={20} className="text-white"/> : <Plus size={20} className="text-slate-200"/>}
                              </button>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}

      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[300] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}><span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span></div>
        </div>
      )}
    </div>
  );
}