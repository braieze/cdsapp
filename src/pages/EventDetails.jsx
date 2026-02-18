import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore'; 
import { X, Calendar, Clock, MapPin, Save, Trash2, Plus, ChevronDown, Users, CheckCircle, Edit3, CheckSquare, Search, Download, HelpCircle, Loader2, UserCheck, ChevronRight } from 'lucide-react';
import { EVENT_TYPES } from '../utils/eventTypes';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas'; // ✅ Para captura de PDF
import jsPDF from 'jspdf'; // ✅ Para generación de PDF

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reportRef = useRef(); // Referencia para el PDF
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null); 
  const [isEditing, setIsEditing] = useState(false); 
  const [assignments, setAssignments] = useState({});
  const [expandedDay, setExpandedDay] = useState(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeRoleKey, setActiveRoleKey] = useState(null); 
  const [activeRoleConfig, setActiveRoleConfig] = useState(null); 
  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState(null); // ✅ Estado de Toast corregido

  const currentUser = auth.currentUser;
  const myUid = currentUser?.uid;

  // Limpiador de Toasts
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

  // ✅ DESCARGA DE PDF DIRECTA (ESTILO CREDENCIAL)
  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Cronograma-${event.title}.pdf`);
      setToast({ message: "PDF Descargado", type: "success" });
    } catch (e) { 
      console.error(e); 
      setToast({ message: "Error al generar PDF", type: "error" });
    } finally { setIsDownloading(false); }
  };

  // ✅ BLINDAJE: REVISAR DISPONIBILIDAD
  const isUserTaken = (name) => {
    return Object.values(assignments).flat().includes(name);
  };

  const notifyNewAssignments = async (newAssignments) => {
    try {
      const oldAssigned = Object.values(event.assignments || {}).flat();
      const currentAssigned = Object.values(newAssignments).flat();
      const newlyAdded = currentAssigned.filter(name => !oldAssigned.includes(name));
      if (newlyAdded.length === 0) return;
      const targetTokens = users.filter(u => newlyAdded.includes(u.displayName) && u.fcmTokens).flatMap(u => u.fcmTokens);
      if (targetTokens.length === 0) return;
      const BACKEND_URL = "https://backend-notificaciones-mceh.onrender.com/send-notification";
      await fetch(BACKEND_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "📍 Nueva tarea asignada", body: `Se te asignó un servicio en: ${event.title}`, tokens: [...new Set(targetTokens)], url: "/servicios" })
      });
    } catch (error) { console.error(error); }
  };

  const handleSaveAssignments = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'events', id), { assignments });
      notifyNewAssignments(assignments);
      setEvent(prev => ({ ...prev, assignments }));
      setIsEditing(false);
      setToast({ message: "Equipo guardado y notificado", type: "success" });
    } catch (error) { setToast({ message: "Error al guardar", type: "error" }); } finally { setIsSaving(false); }
  };

  const handleToggleTask = async (taskIndex) => {
    const newTasks = [...(event.checklist || [])];
    newTasks[taskIndex].completed = !newTasks[taskIndex].completed;
    newTasks[taskIndex].completedBy = newTasks[taskIndex].completed ? currentUser?.displayName : null;
    await updateDoc(doc(db, 'events', id), { checklist: newTasks });
    setEvent(prev => ({ ...prev, checklist: newTasks }));
  };

  const handleDelete = async () => {
    if(window.confirm("¿Eliminar evento?")) {
        await deleteDoc(doc(db, 'events', id));
        navigate('/calendario');
    }
  };

  const openPersonSelector = (roleKey, roleConfig) => {
      setActiveRoleKey(roleKey);
      setActiveRoleConfig(roleConfig);
      setIsSelectorOpen(true);
      setPersonSearchTerm('');
  };

  const handleSelectPersonFromModal = (personName) => {
      const currentList = assignments[activeRoleKey] || [];
      const newList = activeRoleConfig.type === 'single' ? [personName] : [...new Set([...currentList, personName])];
      setAssignments({ ...assignments, [activeRoleKey]: newList });
      setIsSelectorOpen(false); 
  };

  const handleRemovePersonRole = (roleKey, personName) => {
    setAssignments({ ...assignments, [roleKey]: assignments[roleKey].filter(p => p !== personName) });
  };

  const getAyunoDays = () => {
    const start = new Date(event.date + 'T00:00:00');
    const end = event.endDate ? new Date(event.endDate + 'T00:00:00') : start;
    return eachDayOfInterval({ start, end });
  };

  const getStructure = (type) => {
    const config = EVENT_TYPES[type] || EVENT_TYPES.culto;
    if (config.structure === 'same_as_culto') return EVENT_TYPES.culto.structure;
    if (config.structure === 'same_as_limpieza') return EVENT_TYPES.limpieza.structure;
    return config.structure || []; 
  };

  const getStatusIcon = (personName) => {
    if (!event.confirmations) return <HelpCircle size={14} className="text-slate-300"/>;
    const status = event.confirmations[personName];
    if (status === 'confirmed') return <CheckCircle size={14} className="text-green-500"/>;
    if (status === 'declined') return <X size={14} className="text-red-500"/>;
    return <HelpCircle size={14} className="text-slate-300"/>;
  };

  if (loading || !event) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center font-outfit"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const TypeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.culto;
  const isAyuno = event.type === 'ayuno';
  const hasChecklist = TypeConfig.hasChecklist;
  const canEdit = ['pastor', 'lider'].includes(userRole);

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden font-outfit">
      
      {/* BANNER SUPERIOR */}
      <div className={`relative pt-12 pb-24 px-6 ${isAyuno ? 'bg-rose-500' : 'bg-slate-900'} print:hidden flex-shrink-0`}>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button onClick={() => navigate('/calendario')} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white"><X size={24} /></button>
            <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={isDownloading} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white">
                  {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20}/>}
                </button>
                {canEdit && (
                    <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-2 rounded-full font-bold text-xs ${isEditing ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>
                        {isEditing ? 'Cancelar' : 'Editar'}
                    </button>
                )}
            </div>
        </div>
        <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-4 transform -rotate-3 border-4 border-white/20">
                <TypeConfig.icon size={40} className={isAyuno ? 'text-rose-500' : 'text-slate-800'} />
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase text-white/60 mb-1">{TypeConfig.label}</span>
            <h1 className="text-2xl font-black text-white leading-tight px-4">{event.title}</h1>
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-12 bg-white rounded-t-[40px]"></div>
      </div>

      {/* CUERPO - Capturado por referencia para el PDF */}
      <div ref={reportRef} className="flex-1 overflow-y-auto bg-white px-6 pb-24">
        <div className="max-w-xl mx-auto space-y-6">
            <div className="flex flex-wrap gap-2 justify-center mt-4">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 border border-slate-100 shadow-sm">
                    <Calendar size={16} className="text-brand-500"/>
                    {format(new Date(event.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                </div>
                {!isAyuno && (
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 border border-slate-100 shadow-sm">
                    <Clock size={16} className="text-brand-500"/>{event.time} hs
                  </div>
                )}
            </div>

            {/* SECCIONES SEGÚN IMÁGENES 2, 3, 4, 5 */}
            <div className="space-y-6 pb-20">
              {getStructure(event.type).map((section, idx) => (
                  <div key={idx} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-widest">{section.section}</h3>
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                      </div>
                      <div className="p-5 space-y-5">
                          {section.roles.map(role => {
                              const assigned = assignments[role.key] || [];
                              const RoleIcon = role.icon;
                              return (
                                  <div key={role.key}>
                                      <label className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2 tracking-tighter">
                                          <RoleIcon size={12} className="text-brand-500"/> {role.label}
                                      </label>
                                      <div className="flex flex-wrap gap-2">
                                          {assigned.length > 0 ? assigned.map((p, i) => (
                                              <span key={i} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${isEditing ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                                  {p}
                                                  {!isEditing && <span>{getStatusIcon(p)}</span>}
                                                  {isEditing && <button onClick={() => handleRemovePersonRole(role.key, p)} className="p-0.5 bg-brand-200 rounded-full"><X size={12}/></button>}
                                              </span>
                                          )) : <p className="text-[10px] text-slate-300 italic font-bold ml-2">Vacante</p>}
                                          {isEditing && (role.type === 'multi' || assigned.length === 0) && (
                                              <button onClick={() => openPersonSelector(role.key, role)} className="w-full mt-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 hover:bg-slate-50 transition-all uppercase">+ Añadir</button>
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

      {/* FOOTER EDICIÓN */}
      {isEditing && (
          <div className="p-4 bg-white border-t border-slate-100 absolute bottom-0 w-full shadow-2xl flex gap-3 z-50 animate-slide-up">
              <button onClick={handleDelete} className="p-4 bg-red-50 text-red-500 rounded-2xl"><Trash2 size={24}/></button>
              <button onClick={handleSaveAssignments} disabled={isSaving} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>}
                  {isSaving ? 'Guardando...' : 'Guardar Equipo'}
              </button>
          </div>
      )}

      {/* ✅ MODAL SELECTOR CON BLINDAJE Y LISTA COMPLETA */}
      {isSelectorOpen && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setIsSelectorOpen(false)}>
              <div className="bg-white w-full sm:max-w-sm rounded-t-[40px] sm:rounded-[40px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b flex justify-between items-center bg-white shrink-0">
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Asignar a {activeRoleConfig?.label}</h3>
                      <button onClick={() => setIsSelectorOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
                  </div>
                  <div className="p-4 bg-slate-50 shrink-0">
                      <div className="bg-white border rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm">
                          <Search size={18} className="text-slate-400"/><input type="text" placeholder="Buscar hermano..." className="w-full text-sm font-bold outline-none" value={personSearchTerm} onChange={e => setPersonSearchTerm(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                      {users.filter(u => {
                          const matchesSearch = (u.displayName || '').toLowerCase().includes(personSearchTerm.toLowerCase());
                          return matchesSearch; // ✅ Siempre muestra lista completa, no vacía
                      }).map(u => {
                          const isTaken = isUserTaken(u.displayName);
                          const isHere = (assignments[activeRoleKey] || []).includes(u.displayName);

                          return (
                              <button 
                                key={u.id} 
                                disabled={isTaken && !isHere}
                                onClick={() => handleSelectPersonFromModal(u.displayName)} 
                                className={`w-full flex items-center gap-4 p-4 rounded-[28px] border-2 transition-all text-left relative ${isHere ? 'bg-brand-50 border-brand-500' : isTaken ? 'bg-slate-50 border-transparent opacity-40 grayscale cursor-not-allowed' : 'bg-white border-slate-50 hover:border-brand-100 active:scale-95'}`}
                              >
                                  <div className="w-14 h-14 rounded-[22px] bg-slate-100 overflow-hidden border-2 border-white shadow-sm flex items-center justify-center font-black text-slate-400 relative">
                                      {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" alt="User"/> : (u.displayName || '?')[0].toUpperCase()}
                                      {isHere && <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center"><UserCheck size={24} className="text-brand-600 animate-scale-in"/></div>}
                                  </div>
                                  <div className="flex-1">
                                      <p className="font-black text-slate-800 text-sm uppercase tracking-tight leading-none">{u.displayName}</p>
                                      {isTaken && !isHere ? (
                                          <p className="text-[8px] text-rose-600 font-black uppercase tracking-widest mt-1.5 animate-pulse">YA TIENE UN SERVICIO ASIGNADO</p>
                                      ) : (
                                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{u.area || u.ministerio || 'Miembro'}</p>
                                      )}
                                  </div>
                                  {!isTaken && <Plus size={18} className="text-slate-300"/>}
                              </button>
                          );
                      })}
                  </div>
                  <div className="p-4 bg-white border-t shrink-0">
                      <button onClick={() => setIsSelectorOpen(false)} className="w-full bg-slate-900 text-white py-4 rounded-[25px] font-black text-xs uppercase tracking-widest shadow-xl">Confirmar</button>
                  </div>
              </div>
          </div>
      )}

      {/* SISTEMA DE TOASTS CORREGIDO */}
      {toast && (
        <div className="fixed bottom-24 left-6 right-6 z-[400] animate-slide-up">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-[25px] shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : toast.type === 'error' ? 'bg-rose-600 text-white border-rose-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            {toast.type === 'success' ? <Check size={18}/> : <Info size={18}/>}
            <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}