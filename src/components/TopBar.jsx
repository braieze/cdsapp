import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, messaging } from '../firebase'; 
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging'; 
import { 
  Bell, X, Clock, Loader2, Send, Link as LinkIcon, 
  Activity, HandHeart, Lock, Unlock, Globe, Save,
  Megaphone, Sparkles, BellRing, AlertTriangle, BookOpen, UserCircle
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';

const VAPID_KEY = "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk";

// ✅ NUEVO: PLANTILLAS RÁPIDAS
const PUSH_TEMPLATES = [
  { id: 'urgente', label: '🚨 Aviso Urgente', title: '¡Aviso Importante!', body: 'Por favor, lee este comunicado urgente de la iglesia.', targetArea: 'todos', targetPath: '/' },
  { id: 'servicio', label: '⛪ Confirmar Servicio', title: 'Recordatorio de Servicio', body: 'No olvides confirmar tu asistencia para servir en el próximo culto.', targetArea: 'todos', targetPath: '/servicios' },
  { id: 'clase', label: '📚 Nueva Clase', title: '¡Nueva Clase Publicada!', body: 'Ya está disponible el material de la nueva serie. ¡No te lo pierdas!', targetArea: 'todos', targetPath: '/' },
  { id: 'meet', label: '🎥 Link de Meet', title: '¡Ya estamos en vivo!', body: 'Entrá al link para sumarte a la transmisión.', targetArea: 'todos', targetPath: '/' }
];

export default function TopBar() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState([]); 
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isPastorPanelOpen, setIsPastorPanelOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [userRole, setUserRole] = useState('miembro');
  const [activeUser, setActiveUser] = useState(null);

  const [loadingAction, setLoadingAction] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const [pushData, setPushData] = useState({ title: '', body: '', link: '', targetArea: 'todos', targetPath: '/' });
  const [officialAreas, setOfficialAreas] = useState([]);
  const [prayerLinkData, setPrayerLinkData] = useState({ url: '', isLocked: true });

  const isNative = Capacitor.isNativePlatform(); 

  // 0. DETECTOR DE USUARIO, ROL Y DEEP LINKING
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setActiveUser(user);
        const userRef = doc(db, 'users', user.uid);
        onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserRole(data.role || 'miembro');
            setReadIds(data.readNotifications || []); 
            
            if (isNative) {
                const areaTag = (data.area || 'ninguna').toLowerCase();
                OneSignal.sendTag("area", areaTag);
            }
          }
        });
      }
    });

    if (isNative) {
      OneSignal.Notifications.addEventListener('click', (event) => {
        const data = event.notification.additionalData;
        if (data && data.route) {
          navigate(data.route);
        }
      });
    }

    return () => unsubscribeAuth();
  }, [isNative, navigate]);

  // CARGAR METADATA
  useEffect(() => {
    const unsubAreas = onSnapshot(doc(db, 'metadata', 'areas'), (snap) => {
      if (snap.exists()) setOfficialAreas(snap.data().list || []);
    });
    const unsubLink = onSnapshot(doc(db, 'metadata', 'links'), (snap) => {
      if (snap.exists()) setPrayerLinkData(prev => ({ ...prev, url: snap.data().prayer || '' }));
    });
    return () => { unsubAreas(); unsubLink(); };
  }, []);

  // LÓGICA DE SUSCRIPCIÓN
  useEffect(() => {
    if (isNative) {
      setIsSupported(true);
      const localFlag = localStorage.getItem('fcm_active');
      setIsSubscribed(localFlag === 'true');
      return;
    }
    if (!('Notification' in window)) { setIsSupported(false); return; }
    const localFlag = localStorage.getItem('fcm_active');
    const browserPerm = Notification.permission;
    setIsSubscribed(browserPerm === 'granted' && localFlag === 'true');
  }, [isOpen, isNative]); 

  const enableNotifications = async () => {
    if (!isSupported) { toast.error("No soportado"); return; }
    setLoadingAction(true);
    try {
        if (isNative) {
            await OneSignal.Notifications.requestPermission(true);
            if (activeUser?.uid) OneSignal.login(activeUser.uid);
            localStorage.setItem('fcm_active', 'true');
            setIsSubscribed(true);
            toast.success("¡Activadas!");
        } else {
            const result = await Notification.requestPermission();
            if (result === 'granted' && messaging) {
                const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                if (token) {
                    await updateDoc(doc(db, 'users', activeUser.uid), { fcmTokens: arrayUnion(token) });
                    localStorage.setItem('fcm_active', 'true');
                    setIsSubscribed(true);
                    toast.success("¡Activadas!");
                }
            }
        }
    } catch (error) { toast.error("Error al activar"); } 
    finally { setLoadingAction(false); }
  };

  const disableNotifications = async () => {
    if (!window.confirm("¿Desactivar avisos?")) return;
    setLoadingAction(true);
    try {
        if (isNative) OneSignal.logout();
        localStorage.removeItem('fcm_active');
        setIsSubscribed(false);
        toast.success("Desactivadas.");
    } catch (error) { console.error(error); } 
    finally { setLoadingAction(false); }
  };

  const savePrayerLink = async () => {
    try {
      await setDoc(doc(db, 'metadata', 'links'), { prayer: prayerLinkData.url }, { merge: true });
      setPrayerLinkData({ ...prayerLinkData, isLocked: true });
      toast.success("Link actualizado");
    } catch (e) { toast.error("Error al guardar"); }
  };

  const setPrayerTemplate = () => {
    setPushData({
      ...pushData,
      title: "🙏 ¡Estamos en Oración!",
      body: "Toca aquí para entrar directo al Google Meet.",
      link: prayerLinkData.url, 
      targetPath: '/' 
    });
    toast.info("Link cargado");
  };

  // ✅ NUEVO: Aplicar Plantilla Rápida
  const applyTemplate = (template) => {
    setPushData({
      title: template.title,
      body: template.body,
      link: '',
      targetArea: template.targetArea,
      targetPath: template.targetPath
    });
    toast.success("Plantilla aplicada");
  };

  const sendManualPush = async () => {
    if (!pushData.title || !pushData.body) return toast.error("Completa título y mensaje");
    setLoadingAction(true);
    try {
      // 1. Guardar en Base de Datos para el Historial (Fase 2)
      const notifRef = doc(collection(db, 'notificaciones_globales'));
      await setDoc(notifRef, {
        titulo: pushData.title,
        mensaje: pushData.body,
        fecha: new Date().toISOString(),
        destino: pushData.targetArea.toUpperCase(),
        link: pushData.link || pushData.targetPath
      });

      // 2. Enviar a OneSignal
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      const payload = {
        app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
        headings: { en: pushData.title, es: pushData.title },
        contents: { en: pushData.body, es: pushData.body },
        url: pushData.link || null, 
        data: { route: pushData.targetPath }, 
        large_icon: "https://cdsapp.vercel.app/logo.png",
        priority: 10,
        android_accent_color: "FF0000",
        android_visibility: 1
      };

      if (pushData.targetArea === 'todos') {
        payload.included_segments = ["Total Subscriptions"];
      } else {
        payload.filters = [{ field: "tag", key: "area", relation: "=", value: pushData.targetArea.toLowerCase() }];
      }

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
          toast.success("¡Notificación enviada y guardada!");
          setIsPastorPanelOpen(false);
          setPushData({ title: '', body: '', link: '', targetArea: 'todos', targetPath: '/' });
      }
    } catch (e) { toast.error("Error al enviar"); }
    finally { setLoadingAction(false); }
  };

  // ✅ NUEVO: FUSIONAR POSTS Y AVISOS PUSH EN LA CAMPANITA
  useEffect(() => {
    if (!activeUser) return;
    
    // Escuchamos Posts
    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(15));
    const unsubPosts = onSnapshot(qPosts, (snap) => {
        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(p => userRole === 'miembro' ? (p.visibility === 'publico' || !p.visibility) : true)
          .map(p => ({
            id: p.id,
            type: 'post',
            title: p.title || 'Nueva publicación',
            subtitle: p.type,
            timestamp: p.createdAt?.toMillis() || Date.now(),
            link: `/post/${p.id}`,
            icon: p.type === 'Devocional' ? BookOpen : Megaphone,
            color: p.type === 'Urgente' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600',
            isUrgent: p.type === 'Urgente'
          }));
          
        // Escuchamos Notificaciones Globales (Push manuales)
        const qNotifs = query(collection(db, 'notificaciones_globales'), orderBy('fecha', 'desc'), limit(15));
        const unsubGlobal = onSnapshot(qNotifs, (snapGlobal) => {
            const globals = snapGlobal.docs.map(d => {
              const data = d.data();
              return {
                id: d.id,
                type: 'push',
                title: data.titulo,
                subtitle: data.destino === 'TODOS' ? 'Aviso General' : `Aviso: ${data.destino}`,
                timestamp: new Date(data.fecha).getTime(),
                link: data.link || '/',
                icon: BellRing,
                color: 'bg-amber-100 text-amber-600',
                isUrgent: false
              };
            });

            // Juntamos todo y ordenamos por fecha
            const allMerged = [...posts, ...globals].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
            setNotifications(allMerged);
        });
        
        return () => unsubGlobal();
    });

    return () => unsubPosts();
  }, [activeUser, userRole]); 

  useEffect(() => {
    const unread = notifications.filter(n => !readIds.includes(n.id)).length;
    setUnreadCount(unread);
  }, [notifications, readIds]);

  const markAllAsRead = async () => {
      if (!activeUser) return;
      const allIds = notifications.map(n => n.id);
      setReadIds(allIds);
      await updateDoc(doc(db, 'users', activeUser.uid), { readNotifications: allIds });
  };

  const formatNotifTime = (ts) => {
    const date = new Date(ts);
    if (isToday(date)) return `Hoy, ${format(date, 'HH:mm')}`;
    return format(date, "d MMM", { locale: es });
  };

  return (
    <>
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md px-5 pt-5 pb-3 flex justify-between items-center font-outfit">
        <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white overflow-hidden">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col text-left">
                <span className="text-xl font-black text-slate-900 tracking-tighter leading-none">CDS APP</span>
                <p className="text-[9px] text-brand-600 font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
                  <Activity size={10}/> {userRole}
                </p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          {userRole === 'pastor' && activeUser && (
            <button onClick={() => setIsPastorPanelOpen(true)} className="p-2.5 bg-brand-50 text-brand-600 rounded-xl active:scale-90 border border-brand-100 shadow-sm">
              <Megaphone size={22} />
            </button>
          )}
          <button onClick={() => setIsOpen(true)} className="relative p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-800 active:scale-90">
              <Bell size={22} />
              {unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-black text-white animate-bounce">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {/* --- PANEL NOTIFICACIONES --- */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-white animate-fade-in flex flex-col font-outfit">
            <div className="px-6 pt-14 pb-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0">
                <div className="text-left">
                  <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tighter">Notificaciones</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Historial de Avisos</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 active:scale-75 transition-all"><X size={24}/></button>
            </div>

            <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 text-left">
                {isSubscribed ? (
                    <button onClick={disableNotifications} disabled={loadingAction} className="w-full py-3 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Silenciar avisos en este equipo</button>
                ) : (
                    <button onClick={enableNotifications} disabled={loadingAction} className="w-full py-3 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest animate-pulse">🔔 ACTIVAR NOTIFICACIONES</button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 no-scrollbar">
                {notifications.length === 0 ? (
                    <div className="py-32 text-center opacity-20 flex flex-col items-center">
                        <Sparkles size={64} className="mb-4 text-slate-300"/>
                        <p className="text-xs font-black uppercase text-center">Bandeja Vacía</p>
                    </div>
                ) : (
                    notifications.slice(0, displayLimit).map((notif) => (
                        <div key={notif.id} onClick={() => { setIsOpen(false); navigate(notif.link); }} 
                             className={`p-5 rounded-[28px] flex items-start gap-4 transition-all border-2 mb-2 relative ${!readIds.includes(notif.id) ? 'bg-white border-brand-50 shadow-md shadow-brand-100/20' : 'bg-slate-50 border-transparent opacity-60'}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${notif.color}`}><notif.icon size={24}/></div>
                            <div className="flex-1 min-w-0 text-left pt-1">
                                <h4 className={`text-sm font-black uppercase tracking-tight leading-tight ${notif.isUrgent ? 'text-red-600' : 'text-slate-800'}`}>{notif.title}</h4>
                                <p className="text-[11px] text-slate-500 font-semibold mt-1 leading-snug">{notif.subtitle}</p>
                                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest"><Clock size={10}/> {formatNotifTime(notif.timestamp)}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-8 border-t border-slate-50 bg-white flex gap-3 pb-12">
                <button onClick={markAllAsRead} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl">Limpiar</button>
                <button onClick={() => setIsOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]">Cerrar</button>
            </div>
        </div>
      )}

      {/* --- PANEL DE PASTORES --- */}
      {isPastorPanelOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-5 font-outfit animate-fade-in text-left">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-scale-in flex flex-col gap-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Aviso Push</h3>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1">Lanzamiento Manual</p>
              </div>
              <button onClick={() => setIsPastorPanelOpen(false)} className="p-2 bg-slate-100 rounded-full active:scale-75 transition-all text-slate-400"><X size={20}/></button>
            </div>

            {/* ✅ NUEVO: PLANTILLAS RÁPIDAS (CHIPS) */}
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Sparkles size={12}/> Plantillas Rápidas</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {PUSH_TEMPLATES.map((tmpl) => (
                  <button key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                    className="shrink-0 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold transition-colors">
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-indigo-50 border-2 border-indigo-100 rounded-3xl space-y-3 text-left">
                <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2 tracking-widest"><HandHeart size={16}/> Link de Oración</p>
                    <button onClick={() => setPrayerLinkData({...prayerLinkData, isLocked: !prayerLinkData.isLocked})} className="text-indigo-400">
                        {prayerLinkData.isLocked ? <Lock size={16}/> : <Unlock size={16} className="text-brand-600 animate-pulse"/>}
                    </button>
                </div>
                <div className="flex gap-2">
                    <input 
                      disabled={prayerLinkData.isLocked}
                      placeholder="https://meet.google.com/..." 
                      className={`flex-1 p-3 rounded-xl text-[10px] font-bold outline-none transition-all ${prayerLinkData.isLocked ? 'bg-indigo-100/50 text-indigo-400' : 'bg-white text-indigo-700 shadow-inner border border-indigo-200'}`}
                      value={prayerLinkData.url} onChange={e => setPrayerLinkData({...prayerLinkData, url: e.target.value})}
                    />
                    {!prayerLinkData.isLocked && (
                        <button onClick={savePrayerLink} className="bg-brand-600 text-white p-3 rounded-xl shadow-lg active:scale-90 transition-all"><Save size={16}/></button>
                    )}
                </div>
                <button onClick={setPrayerTemplate} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Usar como aviso</button>
            </div>

            <div className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-1.5"><Globe size={10}/> Enviar a:</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase outline-none" value={pushData.targetArea} onChange={e => setPushData({...pushData, targetArea: e.target.value})}>
                       <option value="todos">Toda la Iglesia</option>
                       {officialAreas.map(a => <option key={a} value={a.toLowerCase()}>{a}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-1.5"><LinkIcon size={10}/> Redirigir a:</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase outline-none" value={pushData.targetPath} onChange={e => setPushData({...pushData, targetPath: e.target.value})}>
                       <option value="/">Muro Principal</option>
                       <option value="/calendario">Agenda Global</option>
                       <option value="/servicios">Mis Servicios</option>
                       <option value="/directorio">Directorio</option>
                       <option value="/perfil">Mi Perfil</option>
                    </select>
                 </div>
              </div>

              <input placeholder="Título del mensaje..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-brand-500 transition-all shadow-inner" value={pushData.title} onChange={e => setPushData({...pushData, title: e.target.value})} />
              <textarea placeholder="Contenido del aviso..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-semibold text-sm h-24 resize-none outline-none focus:border-brand-500 transition-all shadow-inner" value={pushData.body} onChange={e => setPushData({...pushData, body: e.target.value})} />
              
              <div className="p-4 bg-slate-50 rounded-2xl border-dashed border-2 border-slate-200">
                <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2 mb-2"><Globe size={12}/> Link Externo (Opcional)</p>
                <input placeholder="https://..." className="w-full p-2 bg-white rounded-lg border border-slate-100 font-bold text-[10px] outline-none text-brand-600" value={pushData.link} onChange={e => setPushData({...pushData, link: e.target.value})} />
              </div>
            </div>

            <button onClick={sendManualPush} disabled={loadingAction} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50">
              {loadingAction ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>} Lanzar Aviso
            </button>
          </div>
        </div>
      )}
    </>
  );
}