import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore'; 
import { 
  X, Calendar, Clock, Save, Trash2, Plus, Users, 
  CheckCircle, Download, Loader2, Search, HelpCircle,
  AlertCircle, Check, ExternalLink, ArrowRight
} from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, isSameDay } from 'date-fns';
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

  // ✅ NOTIFICACIÓN DE ASIGNACIÓN (Corregida para abrir la App)
  const notifyNewAssignments = async (newAssignments) => {
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      if (!REST_API_KEY) return;

      const oldAssigned = Object.values(event.assignments || {}).flat();
      const currentAssigned = Object.values(newAssignments).flat();
      const newlyAddedNames = currentAssigned.filter(name => !oldAssigned.includes(name));
      
      if (newlyAddedNames.length === 0) return;

      const targetUserIds = users
        .filter(u => newlyAddedNames.includes(u.displayName))
        .map(u => u.id);

      if (targetUserIds.length === 0) return;

      const path = `/calendario/${id}`;
      const webUrl = `https://cdsapp.vercel.app/#${path}`;

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: APP_ID,
          include_external_user_ids: targetUserIds,
          headings: { en: "📍 Nueva tarea asignada", es: "📍 Nueva tarea asignada" },
          contents: { en: `Fuiste asignado en: ${event.title}. Toca para ver detalles.`, es: `Fuiste asignado en: ${event.title}. Toca para ver detalles.` },
          // 🎯 Deep Linking: web_url + data para abrir la app
          web_url: webUrl,
          data: { route: path },
          isAnyWeb: true,
          isAndroid: true,
          isIos: true,
          priority: 10
        })
      });
    } catch (error) { console.error("Error notif tarea:", error); }
  };

  const handleSaveAssignments = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'events', id), { assignments });
      await notifyNewAssignments(assignments); 
      setEvent(prev => ({ ...prev, assignments }));
      setToast({ message: "Servidores notificados", type: "success" });
      setIsEditing(false);
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); } 
    finally { setIsSaving(false); }
  };

  const canEdit = ['pastor', 'lider'].includes(userRole);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Equipo-${event.title}.pdf`);
      setToast({ message: "PDF Generado", type: "success" });
    } catch (e) { setToast({ message: "Error PDF", type: "error" }); } 
    finally { setIsDownloading(false); }
  };

  const getStatusIcon = (personName) => {
    if (!event.confirmations) return <HelpCircle size={14} className="text-slate-300"/>;
    const status = event.confirmations[personName];
    if (status === 'confirmed') return <CheckCircle size={14} className="text-emerald-500"/>;
    if (status === 'declined') return <X size={14} className="text-rose-500"/>;
    return <HelpCircle size={14} className="text-slate-300"/>;
  };

  if (loading || !event) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden font-outfit">
      
      <header className={`relative pt-12 pb-24 px-6 ${event.type === 'ayuno' ? 'bg-rose-600' : 'bg-slate-900'} flex-shrink-0`}>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button onClick={() => navigate('/calendario')} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"><X size={24} /></button>
            <div className="flex gap-2">
                <button onClick={downloadPDF} disabled={isDownloading} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white active:scale-90">
                  {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20}/>}
                </button>
                {canEdit && (
                    <button onClick={() => setIsEditing(!isEditing)} className={`px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isEditing ? 'bg-white text-slate-900 shadow-xl' : 'bg-white/20 text-white'}`}>
                        {isEditing ? 'Cancelar' : 'Asignar Equipo'}
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
                    {format(new Date(event.date + 'T00:00:00'), "EEEE d", { locale: es })}
                    {event.endDate && event.endDate !== event.date && (
                      <> <ArrowRight size={10}/> {format(new Date(event.endDate + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })} </>
                    )}
                    {!event.endDate || event.endDate === event.date ? format(new Date(event.date + 'T00:00:00'), " 'de' MMMM", { locale: es }) : ''}
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl text-[11px] font-black text-slate-700 border border-slate-100 uppercase tracking-widest shadow-sm">
                    <Clock size={14} className="text-brand-500"/>{event.time} hs
                </div>
            </div>

            <div className="space-y-6">
              {(EVENT_TYPES[event.type]?.structure || EVENT_TYPES.culto.structure).map((section, idx) => (
                  <div key={idx} className="bg-white rounded-[35px] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-50">
                          <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">{section.section}</h3>
                      </div>
                      <div className="p-6 space-y-6">
                          {section.roles.map(role => {
                              const assigned = assignments[role.key] || [];
                              const RoleIcon = role.icon;
                              return (
                                  <div key={role.key}>
                                      <label className="text-[10px] font-black text-slate-800 uppercase mb-4 flex items-center gap-2.5 tracking-widest">
                                          <div className="p-1.5 bg-brand-50 rounded-lg text-brand-600"><RoleIcon size={14}/></div> {role.label}
                                      </label>
                                      <div className="flex flex-wrap gap-2.5">
                                          {assigned.length > 0 ? assigned.map((p, i) => (
                                              <span key={i} className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-tight border transition-all ${isEditing ? 'bg-brand-600 text-white border-brand-400 shadow-lg scale-105' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                                  {p}
                                                  {!isEditing && getStatusIcon(p)}
                                                  {isEditing && <button onClick={() => setAssignments({ ...assignments, [role.key]: assigned.filter(item => item !== p) })} className="p-1 bg-white/20 rounded-full"><X size={12}/></button>}
                                              </span>
                                          )) : <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest ml-1">Sin asignar</p>}
                                          
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
        </div>
      </div>

      {isEditing && (
          <div className="p-5 bg-white border-t border-slate-100 absolute bottom-0 w-full shadow-[0_-20px_50px_rgba(0,0,0,0.1)] flex gap-4 z-50 animate-slide-up">
              <button onClick={async () => { if(window.confirm("¿Borrar evento?")) { await deleteDoc(doc(db, 'events', id)); navigate('/calendario'); } }} className="p-5 bg-rose-50 text-rose-500 rounded-[24px] active:scale-90 transition-transform"><Trash2 size={24}/></button>
              <button onClick={handleSaveAssignments} disabled={isSaving} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-[24px] shadow-2xl flex items-center justify-center gap-3 uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>}
                  Guardar y Avisar
              </button>
          </div>
      )}

      {/* SELECTOR DE PERSONA (BUSCADOR FIJO ARRIBA) */}
      {isSelectorOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setIsSelectorOpen(false)}>
              <div className="bg-white w-full max-w-md rounded-t-[50px] h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="p-8 border-b flex justify-between items-center bg-white shrink-0">
                      <div>
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tighter">Asignar {activeRoleConfig?.label}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Selecciona un servidor</p>
                      </div>
                      <button onClick={() => setIsSelectorOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 active:scale-90 transition-transform"><X size={20}/></button>
                  </div>
                  {/* BUSCADOR FIJO */}
                  <div className="p-5 bg-slate-50 shrink-0 border-b border-slate-100">
                      <div className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-inner">
                          <Search size={18} className="text-slate-400"/><input autoFocus type="text" placeholder="Buscar por nombre..." className="w-full text-sm font-bold outline-none bg-transparent" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/>
                      </div>
                  </div>
                  {/* LISTA CON SCROLL INDEPENDIENTE */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar pb-10">
                      {users.filter(u => (u.displayName || '').toLowerCase().includes(personSearchTerm.toLowerCase())).map(u => {
                          const isAlreadyInThisRole = (assignments[activeRoleKey] || []).includes(u.displayName);
                          const isTaken = Object.values(assignments).flat().includes(u.displayName);
                          return (
                              <button 
                                key={u.id} 
                                disabled={isTaken && !isAlreadyInThisRole}
                                onClick={() => {
                                    const currentList = assignments[activeRoleKey] || [];
                                    const newList = activeRoleConfig.type === 'single' ? [u.displayName] : [...new Set([...currentList, u.displayName])];
                                    setAssignments({ ...assignments, [activeRoleKey]: newList });
                                    setIsSelectorOpen(false);
                                }} 
                                className={`w-full flex items-center gap-4 p-4 rounded-[28px] border-2 transition-all text-left ${isAlreadyInThisRole ? 'bg-brand-600 border-brand-600 shadow-xl scale-[0.98]' : isTaken ? 'opacity-30 grayscale' : 'bg-white border-slate-100 active:scale-95'}`}
                              >
                                  <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white flex items-center justify-center font-black text-slate-400 shrink-0 shadow-sm">
                                      {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : (u.displayName || '?')[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <p className={`font-black text-sm uppercase truncate ${isAlreadyInThisRole ? 'text-white' : 'text-slate-800'}`}>{u.displayName}</p>
                                      <p className={`text-[10px] font-bold uppercase mt-1 tracking-widest ${isAlreadyInThisRole ? 'text-white/60' : 'text-slate-400'}`}>{u.area || 'Servidor'}</p>
                                  </div>
                                  {isAlreadyInThisRole ? <Check size={20} className="text-white"/> : <Plus size={20} className="text-slate-200"/>}
                              </button>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}

      {/* TOASTS */}
      {toast && (
        <div className="fixed bottom-28 left-6 right-6 z-[300] animate-slide-up">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}