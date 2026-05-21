import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, messaging } from '../firebase'; 
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging'; 
import { 
  Bell, X, Clock, Loader2, Send, Link as LinkIcon, 
  Activity, HandHeart, Lock, Unlock, Globe, Save,
  Megaphone, Sparkles, BellRing, AlertTriangle, BookOpen, UserCircle, MessageCircle, Cake
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';
import { ONESIGNAL_CONFIG } from '../oneSignalConfig'; 

const VAPID_KEY = "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk";

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
  const [userArea, setUserArea] = useState(''); 
  const [activeUser, setActiveUser] = useState(null);

  const [loadingAction, setLoadingAction] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const [pushData, setPushData] = useState({ title: '', body: '', link: '', targetArea: 'todos', targetPath: '/' });
  const [officialAreas, setOfficialAreas] = useState([]);
  const [prayerLinkData, setPrayerLinkData] = useState({ url: '', isLocked: true });

  const isNative = Capacitor.isNativePlatform(); 

  // ✅ 0. DETECTOR DE USUARIO Y ESCUCHADOR DE DEEP LINKING
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setActiveUser(user);
        const userRef = doc(db, 'users', user.uid);
        onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserRole(data.role || 'miembro');
            setUserArea(data.area || '');
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

  useEffect(() => {
    const unsubAreas = onSnapshot(doc(db, 'metadata', 'areas'), (snap) => {
      if (snap.exists()) setOfficialAreas(snap.data().list || []);
    });
    const unsubLink = onSnapshot(doc(db, 'metadata', 'links'), (snap) => {
      if (snap.exists()) setPrayerLinkData(prev => ({ ...prev, url: snap.data().prayer || '' }));
    });
    return () => { unsubAreas(); unsubLink(); };
  }, []);

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
      const notifRef = doc(collection(db, 'notificaciones_globales'));
      await setDoc(notifRef, {
        titulo: pushData.title,
        mensaje: pushData.body,
        fecha: new Date().toISOString(),
        destino: pushData.targetArea.toUpperCase(),
        link: pushData.link || pushData.targetPath 
      });

      const REST_API_KEY = ONESIGNAL_CONFIG.REST_API_KEY; 
      const payload = {
        app_id: ONESIGNAL_CONFIG.APP_ID,
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
          toast.success("¡Notificación enviada!");
          setIsPastorPanelOpen(false);
          setPushData({ title: '', body: '', link: '', targetArea: 'todos', targetPath: '/' });
      }
    } catch (e) { toast.error("Error al enviar"); }
    finally { setLoadingAction(false); }
  };

  useEffect(() => {
    if (!activeUser) return;
    
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
            color: p.type === 'Urgente' ? 'text-red-500 bg-red-50' : 'text-blue-500 bg-blue-50',
            isUrgent: p.type === 'Urgente'
          }));
          
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
                color: 'text-amber-500 bg-amber-50',
                isUrgent: false
              };
            });

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

  const formattedRole = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  return (
    <>
      {/* 🌟 CABECERA PREMIUM SOCIALYO STYLE */}
      {/* Añadido bg-white y eliminado el blur para que coincida con la imagen de referencia */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-4 pb-3 flex justify-between items-center font-sans border-b border-slate-100/50">
        
        {/* LOGO O TÍTULO (Igual que SocialYo) */}
        <div className="flex items-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 cursor-pointer" onClick={() => navigate('/')}>
              SocialYo.
            </h1>
        </div>
        
        {/* BOTONERA DE ACCIONES (Campanita, Megáfono, Chat) */}
        <div className="flex items-center gap-2">
          {userRole === 'pastor' && activeUser && (
            <button onClick={() => setIsPastorPanelOpen(true)} className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm text-slate-700">
              <Megaphone size={18} />
            </button>
          )}
          
          <button onClick={() => setIsOpen(true)} className="relative w-auto px-3 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm text-slate-700 font-semibold text-xs">
              <Bell size={18} />
              {unreadCount > 0 ? `+${unreadCount}` : ''}
              {unreadCount > 0 && (
                <span className="absolute top-2 left-2.5 w-1.5 h-1.5 rounded-full bg-red-500"></span>
              )}
          </button>
          
          <button className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm text-slate-700">
              <MessageCircle size={18} />
          </button>
        </div>
      </div>

      {/* 📌 MODAL DE NOTIFICACIONES */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-50 animate-fade-in flex flex-col font-sans">
            <div className="px-5 pt-12 pb-4 flex justify-between items-center bg-white border-b border-slate-100 shadow-sm sticky top-0">
                <div className="text-left">
                  <h3 className="font-bold text-xl text-slate-900 tracking-tight">Notificaciones</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
                  <X size={20}/>
                </button>
            </div>

            <div className="px-4 py-4 bg-white border-b border-slate-100 text-left">
                {isSubscribed ? (
                    <button onClick={disableNotifications} disabled={loadingAction} className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-colors">Silenciar avisos en este equipo</button>
                ) : (
                    <button onClick={enableNotifications} disabled={loadingAction} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-blue-700 transition-colors">Activar Notificaciones</button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
                {notifications.length === 0 ? (
                    <div className="py-32 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-3">
                          <Bell className="text-slate-300 w-8 h-8"/>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">Bandeja Vacía</p>
                    </div>
                ) : (
                    notifications.slice(0, displayLimit).map((notif) => (
                        <div key={notif.id} onClick={() => { setIsOpen(false); navigate(notif.link); }} 
                             className={`p-4 rounded-[24px] flex items-start gap-4 transition-all border cursor-pointer ${!readIds.includes(notif.id) ? 'bg-white border-slate-100 shadow-sm' : 'bg-transparent border-transparent opacity-70'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${notif.color}`}>
                              <notif.icon size={22}/>
                            </div>
                            <div className="flex-1 min-w-0 text-left pt-1">
                                <h4 className={`text-[14px] font-bold tracking-tight leading-snug ${notif.isUrgent ? 'text-red-600' : 'text-slate-900'}`}>{notif.title}</h4>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">{notif.subtitle}</p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2 font-semibold"><Clock size={12}/> {formatNotifTime(notif.timestamp)}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-white flex gap-3 pb-10 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                <button onClick={markAllAsRead} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-sm">Marcar leídas</button>
                <button onClick={() => setIsOpen(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">Cerrar</button>
            </div>
        </div>
      )}

      {/* 📌 PANEL DE PASTOR (LANZAR PUSH) */}
      {isPastorPanelOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans animate-fade-in text-left">
          <div className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-slide-up flex flex-col gap-5 max-h-[90vh] overflow-y-auto no-scrollbar">
            
            {/* Indicador de arrastre para mobile */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden shrink-0"></div>

            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Aviso Push</h3>
                <p className="text-xs font-semibold text-blue-600 mt-1">Lanzamiento Manual</p>
              </div>
              <button onClick={() => setIsPastorPanelOpen(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={18}/></button>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5"><Sparkles size={14} className="text-amber-500"/> Plantillas Rápidas</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {PUSH_TEMPLATES.map((tmpl) => (
                  <button key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                    className="shrink-0 px-3.5 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-full text-xs font-semibold transition-colors">
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-[24px] space-y-3 text-left">
                <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-indigo-700 flex items-center gap-2"><HandHeart size={16}/> Link de Oración</p>
                    <button onClick={() => setPrayerLinkData({...prayerLinkData, isLocked: !prayerLinkData.isLocked})} className="text-indigo-400 hover:text-indigo-600">
                        {prayerLinkData.isLocked ? <Lock size={16}/> : <Unlock size={16} className="text-blue-600 animate-pulse"/>}
                    </button>
                </div>
                <div className="flex gap-2">
                    <input 
                      disabled={prayerLinkData.isLocked}
                      placeholder="https://meet.google.com/..." 
                      className={`flex-1 p-3 rounded-xl text-xs font-medium outline-none transition-all ${prayerLinkData.isLocked ? 'bg-indigo-100/30 text-indigo-400' : 'bg-white text-indigo-700 border border-indigo-200'}`}
                      value={prayerLinkData.url} onChange={e => setPrayerLinkData({...prayerLinkData, url: e.target.value})}
                    />
                    {!prayerLinkData.isLocked && (
                        <button onClick={savePrayerLink} className="bg-blue-600 text-white px-4 rounded-xl shadow-sm hover:bg-blue-700 transition-colors"><Save size={16}/></button>
                    )}
                </div>
                <button onClick={setPrayerTemplate} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors">Cargar a la plantilla</button>
            </div>

            <div className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 ml-1 flex items-center gap-1.5"><Globe size={14}/> Enviar a:</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500" value={pushData.targetArea} onChange={e => setPushData({...pushData, targetArea: e.target.value})}>
                       <option value="todos">Toda la Iglesia</option>
                       {officialAreas.map(a => <option key={a} value={a.toLowerCase()}>{a}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 ml-1 flex items-center gap-1.5"><LinkIcon size={14}/> Redirigir a:</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500" value={pushData.targetPath} onChange={e => setPushData({...pushData, targetPath: e.target.value})}>
                       <option value="/">Muro Principal</option>
                       <option value="/calendario">Agenda Global</option>
                       <option value="/servicios">Mis Servicios</option>
                       <option value="/directorio">Directorio</option>
                       <option value="/perfil">Mi Perfil</option>
                    </select>
                 </div>
              </div>

              <input placeholder="Título del mensaje..." className="w-full p-3.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors" value={pushData.title} onChange={e => setPushData({...pushData, title: e.target.value})} />
              <textarea placeholder="Contenido del aviso..." className="w-full p-3.5 bg-white border border-slate-200 rounded-xl font-medium text-sm h-24 resize-none outline-none focus:border-blue-500 transition-colors" value={pushData.body} onChange={e => setPushData({...pushData, body: e.target.value})} />
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2"><Globe size={14}/> Link Externo (Opcional)</p>
                <input placeholder="https://..." className="w-full p-2.5 bg-white rounded-lg border border-slate-200 font-medium text-xs outline-none focus:border-blue-500 text-blue-600" value={pushData.link} onChange={e => setPushData({...pushData, link: e.target.value})} />
              </div>
            </div>

            <button onClick={sendManualPush} disabled={loadingAction} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50 mt-2 pb-6">
              {loadingAction ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>} Lanzar Aviso
            </button>
          </div>
        </div>
      )}
    </>
  );
}