import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, BookOpen, Pin, Link as LinkIcon, ExternalLink, 
  MessageCircle, MoreVertical, X, Edit3, Trash2, 
  PlusCircle, AlertTriangle, Calendar, Heart, Send, 
  AlertCircle, CheckCircle, Flame, HandHeart, ThumbsUp, 
  Archive, ChevronDown, Sparkles, Smile, Frown, Sun, CloudRain, Anchor, HelpCircle,
  Wallet, Video, Music, GraduationCap, Briefcase, BellRing, Layers
} from 'lucide-react';
import CreatePostModal from '../components/CreatePostModal';
import TopBar from '../components/TopBar';
import BirthdayModal from '../components/BirthdayModal';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  deleteDoc, doc, updateDoc, limit, runTransaction, getDoc, setDoc, where
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core'; 
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ONESIGNAL_CONFIG } from '../oneSignalConfig'; // ✅ IMPORTACIÓN PARA FIX APK

const MOODS = [
  { id: 'Fortaleza', label: 'Fortaleza', icon: Anchor, color: 'bg-blue-500' },
  { id: 'Gozo', label: 'Gozo', icon: Sun, color: 'bg-amber-500' },
  { id: 'Necesidad', label: 'Necesidad', icon: CloudRain, color: 'bg-slate-500' },
  { id: 'Paz', label: 'Paz', icon: Smile, color: 'bg-emerald-500' },
];

// --- 💬 SUB-COMPONENTE: PREVIEW DE COMENTARIOS ---
function CommentPreview({ postId, count, onClick }) {
  const [previewComments, setPreviewComments] = useState([]);
  const [realCount, setRealCount] = useState(count); 
  
  useEffect(() => {
    if (!postId) return;
    const qPreview = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'), limit(2));
    const unsubPreview = onSnapshot(qPreview, (snap) => setPreviewComments(snap.docs.map(d => d.data())));
    const unsubCount = onSnapshot(collection(db, `posts/${postId}/comments`), (snap) => {
      setRealCount(snap.size);
    });
    return () => { unsubPreview(); unsubCount(); };
  }, [postId]);

  if (realCount === 0 && previewComments.length === 0) return null;

  return (
    <div className="mt-3 bg-slate-50/60 hover:bg-slate-50 rounded-2xl p-3 border border-slate-100/70 cursor-pointer active:scale-[0.99] transition-all" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle size={11} className="text-brand-600" />
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-600">{realCount} Comentarios</span>
      </div>
      <div className="space-y-1">
        {previewComments.map((c, idx) => (
          <div key={idx} className="flex gap-2 text-left items-start">
            <span className="font-black text-[9px] text-slate-800 uppercase mt-0.5 whitespace-nowrap">{c.name?.split(' ')[0]}:</span>
            <span className="text-[10px] text-slate-500 line-clamp-1 font-medium">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PostSkeleton = () => (
  <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm animate-pulse mb-4 mx-4">
    <div className="flex gap-4 mb-4">
      <div className="w-12 h-12 bg-slate-200 rounded-2xl"></div>
      <div className="flex-1 space-y-3 py-2">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
      </div>
    </div>
    <div className="h-24 bg-slate-100 rounded-[24px] w-full mb-2"></div>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  
  const isPastor = dbUser?.role === 'pastor';
  const isLider = dbUser?.role === 'lider';
  const isStaff = isPastor || isLider;
  const isModerator = isStaff;
  const isMiembro = dbUser?.role === 'miembro';
  const canCreatePost = isStaff || dbUser?.area === 'recepcion';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todo');
  const [selectedMood, setSelectedMood] = useState(null);
  
  const [allSeries, setAllSeries] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);

  const [visibleCount, setVisibleCount] = useState(4);
  const [birthdays, setBirthdays] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      let finalPosts = postsData;
      if (isMiembro) {
        finalPosts = postsData.filter(p => p.visibility !== 'servidores');
      }
      if (!isPastor) {
        finalPosts = finalPosts.filter(p => !p.isArchived);
      }
      finalPosts.sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
      setPosts(finalPosts);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isPastor, isMiembro]);

  useEffect(() => {
    const unsubSeries = onSnapshot(doc(db, 'metadata', 'devotional_series'), (snap) => {
      if (snap.exists()) {
        setAllSeries(snap.data().list || []);
      }
    });
    return () => unsubSeries();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const today = new Date();
      const currentMonthDay = format(today, 'MM-dd');
      const bdayList = [];
      snapshot.forEach(doc => {
        const u = { id: doc.id, ...doc.data() };
        if (u.birthday && u.birthday.slice(5) === currentMonthDay) bdayList.push(u);
      });
      setBirthdays(bdayList);
    });
    return () => unsubscribe();
  }, []);

  const handleReaction = async (postId, reactions, emoji) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', postId);
    const reactionsArr = reactions || [];
    const myIdx = reactionsArr.findIndex(r => r.uid === currentUser.uid);
    let newReactions = [...reactionsArr];
    if (myIdx >= 0) {
      if (newReactions[myIdx].emoji === emoji) newReactions.splice(myIdx, 1);
      else newReactions[myIdx].emoji = emoji;
    } else {
      newReactions.push({ uid: currentUser.uid, name: currentUser.displayName, emoji });
    }
    await updateDoc(postRef, { reactions: newReactions });
  };

  const handleArchive = async (postId, currentStatus) => {
    if (!isPastor) return;
    try {
      await updateDoc(doc(db, 'posts', postId), { isArchived: !currentStatus });
      setMenuOpenId(null);
    } catch (e) { console.error(e); }
  };

  const handlePin = async (postId, currentPinned) => {
    if (!isStaff) return;
    try {
      await updateDoc(doc(db, 'posts', postId), { isPinned: !currentPinned });
      setMenuOpenId(null);
      showToast(currentPinned ? "Publicación desanclada" : "Publicación anclada arriba");
    } catch (e) { console.error(e); }
  };

  // ✅ NUEVA FUNCIONALIDAD FIJADA EN FASE 1: Borrado Físico de Posts
  const handleDeletePost = async (postId) => {
    if (!isModerator) return;
    if (!window.confirm("¿Estás seguro de que deseas eliminar permanentemente esta publicación?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setMenuOpenId(null);
      showToast("Publicación eliminada correctamente");
    } catch (e) { 
      console.error(e); 
      showToast("Error al eliminar la publicación");
    }
  };

  const handleReNotify = async (post) => {
    setMenuOpenId(null);
    showToast("Enviando aviso push...");

    try {
      const notifBody = post.content ? post.content.substring(0, 100) + '...' : 'Toca para ver la novedad.';
      const notifRef = doc(collection(db, 'notificaciones_globales'));
      await setDoc(notifRef, {
        titulo: `RECORDATORIO: ${post.title}`,
        mensaje: notifBody,
        fecha: new Date().toISOString(),
        destino: post.visibility === 'servidores' ? 'SERVIDORES' : 'TODA LA IGLESIA',
        link: `/post/${post.id}`
      });

      const REST_API_KEY = ONESIGNAL_CONFIG.REST_API_KEY; 
      const payload = {
        app_id: ONESIGNAL_CONFIG.APP_ID, 
        headings: { en: `RECORDATORIO: ${post.title}`, es: `RECORDATORIO: ${post.title}` },
        contents: { en: notifBody, es: notifBody },
        data: { route: `/post/${post.id}` }, 
        large_icon: "https://cdsapp.vercel.app/logo.png",
        priority: 10,
        android_visibility: 1
      };

      if (post.visibility === 'servidores') {
        payload.filters = [{ field: "tag", key: "role", relation: "!=", value: "miembro" }];
      } else {
        payload.included_segments = ["Total Subscriptions"];
      }

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showToast("¡Aviso enviado con éxito!");
      } else {
        throw new Error("Error en OneSignal");
      }
    } catch (error) {
      console.error(error);
      showToast("Error al enviar el aviso.");
    }
  };

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (filter === 'Archivados') result = posts.filter(p => p.isArchived === true);
    else {
      result = posts.filter(p => p.isArchived !== true);
      if (filter !== 'Todo') result = result.filter(p => p.type === filter);
    }

    if (filter === 'Devocional') {
      if (selectedMood) result = result.filter(p => p.mood === selectedMood);
      if (selectedSeries) result = result.filter(p => p.seriesName === selectedSeries);
    }
    
    return result;
  }, [filter, posts, selectedMood, selectedSeries]);

  // ✅ FILTRO AUXILIAR EXTRA: Extraer los devocionales más recientes para el carrusel de Stories
  const storyDevocionales = useMemo(() => {
    return posts.filter(p => p.type === 'Devocional' && !p.isArchived).slice(0, 7);
  }, [posts]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMorePosts = visibleCount < filteredPosts.length;

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50/60 font-outfit relative">
      {toast.show && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-950/95 backdrop-blur-md text-white px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl border border-white/10 animate-slide-up">
          {toast.message}
        </div>
      )}

      <TopBar />

      <div className="px-5 mt-4 space-y-5">
          {/* CUMPLEAÑOS COMPONENT LOOK PREMIUM */}
          <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} 
               className={`p-[2px] rounded-[32px] transition-all duration-300 active:scale-95 ${birthdays.length > 0 ? 'bg-gradient-to-r from-brand-500 via-purple-500 to-indigo-500 shadow-xl shadow-brand-500/10' : 'bg-white border border-slate-100'}`}>
            <div className={`flex items-center justify-between p-3.5 rounded-[30px] ${birthdays.length > 0 ? 'bg-white/95 backdrop-blur-sm' : 'bg-white'}`}>
              <div className="flex items-center gap-3 text-left">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white ${birthdays.length > 0 ? 'bg-slate-950 shadow-md animate-pulse' : 'bg-slate-50 text-slate-300'}`}>
                  <Cake size={20} className={birthdays.length > 0 ? 'text-brand-400' : 'text-slate-300'} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-none">Celebraciones del Día</p>
                  <p className={`text-[8.5px] font-black uppercase tracking-widest mt-1.5 flex items-center gap-1 ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                    {birthdays.length > 0 ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-ping"></span>
                        {birthdays.length} Hermanos cumplen hoy 🎉
                      </>
                    ) : "Ningún festejo agendado hoy"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ NUEVO LOOK DE INSTAGRAM: FILA DE HISTORIAS / STORIES (DEVOCIONALES RECIENTES) */}
          {storyDevocionales.length > 0 && (
            <div className="bg-white py-4 px-4 rounded-[35px] border border-slate-100/80 shadow-sm space-y-2 text-left animate-fade-in">
              <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Sparkles size={11} className="text-indigo-500 animate-pulse"/> Historias de Fe / Devocionales
              </p>
              <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1">
                {storyDevocionales.map((post) => {
                  const authorInitials = post.authorName ? post.authorName.substring(0, 2) : 'CDS';
                  const storyPhoto = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;
                  return (
                    <button 
                      key={post.id} 
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="flex flex-col items-center gap-1.5 shrink-0 transition-transform active:scale-90"
                    >
                      <div className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-brand-500 via-indigo-500 to-purple-600 shadow-md">
                        <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-slate-900">
                          <img src={storyPhoto} alt="Story Avatar" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <span className="text-[8.5px] font-black text-slate-700 uppercase tracking-tight max-w-[62px] truncate">
                        {post.title?.split(' ')[0] || 'Palabra'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CAPSULAS DE FILTRADO RED SOCIAL */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['Todo', 'Devocional', 'Oración', 'Noticia', 'Archivados'].map((cat) => {
              if (cat === 'Archivados' && !isPastor) return null;
              const isActive = filter === cat;
              return (
                <button 
                  key={cat} 
                  onClick={() => { 
                    setFilter(cat); 
                    setVisibleCount(4); 
                    setSelectedMood(null); 
                    setSelectedSeries(null); 
                  }} 
                  className={`py-3 px-5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap shadow-sm ${
                    isActive 
                      ? (cat === 'Oración' ? 'bg-purple-600 border-purple-600 text-white scale-105' : 'bg-slate-950 border-slate-950 text-white scale-105')
                      : 'bg-white text-slate-400 border-slate-100/80 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* SECCIÓN FILTROS AUXILIARES DEVOCIONALES */}
          {filter === 'Devocional' && (
            <div className="space-y-4 bg-white/60 p-4 rounded-[32px] border border-slate-100 animate-slide-up">
              {/* Ánimos */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-1 justify-between sm:justify-start">
                {MOODS.map(m => (
                  <button key={m.id} onClick={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                   className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 min-w-[65px] ${selectedMood === m.id ? 'scale-110 text-slate-950' : 'opacity-30 grayscale'}`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md ${m.color}`}>
                       <m.icon size={18} />
                    </div>
                    <span className="text-[8.5px] font-black uppercase tracking-tight text-slate-600">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Series Pills */}
              {allSeries.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 py-0.5">
                  <button 
                    onClick={() => setSelectedSeries(null)}
                    className={`px-4 py-2 rounded-full text-[8px] font-black uppercase border transition-all whitespace-nowrap flex items-center gap-1.5 shadow-sm ${!selectedSeries ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    <Layers size={10}/> Todas las Series
                  </button>
                  {allSeries.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedSeries(selectedSeries === s ? null : s)}
                      className={`px-4 py-2 rounded-full text-[8px] font-black uppercase border transition-all whitespace-nowrap shadow-sm ${selectedSeries === s ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white text-slate-400 border-slate-100'}`}
                    >
                      Serie: {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {/* FEED PRINCIPAL */}
      <div className="space-y-6 px-4 mt-6">
        {loading ? (
            <div className="space-y-4"><PostSkeleton /><PostSkeleton /></div>
        ) : Object.keys(displayedPosts).length === 0 ? (
            <div className="text-center py-24 opacity-30 flex flex-col items-center">
              <Sparkles size={44} className="mb-3 text-slate-300 animate-pulse"/>
              <p className="font-black uppercase tracking-widest text-[9px] text-slate-400 text-center">No hay publicaciones en este feed</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const isDevocional = post.type === 'Devocional';
              const isOracion = post.type === 'Oración';
              const profileImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;

              return (
              <div key={post.id} className={`relative transition-all duration-300 ${
                isDevocional 
                  ? 'h-[390px] rounded-[38px] overflow-hidden shadow-xl shadow-slate-900/5 mb-6 hover:shadow-2xl' 
                  : 'bg-white border border-slate-100/90 rounded-[35px] shadow-sm mb-6 overflow-hidden hover:shadow-md'
              }`}>
                
                {/* 📌 RENDER TIPO 1: DEVOCIONAL (TARJETA INMERSIVA FULL IMAGE) */}
                {isDevocional ? (
                  <div className="absolute inset-0 w-full h-full">
                    <div className="absolute inset-0 w-full h-full cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                      {post.image ? <img src={post.image} className="w-full h-full object-cover" alt="Portada" referrerPolicy="no-referrer" /> : <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-brand-950" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    </div>

                    {/* MENU DESPLEGABLE LIDERAZGO DEVOCIONAL */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
                      <div>
                        {post.isPinned && <div className="bg-amber-500 text-white p-2.5 rounded-2xl shadow-lg border border-amber-400/30"><Pin size={13} fill="currentColor"/></div>}
                      </div>
                      
                      {isModerator && (
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="p-2.5 bg-black/30 backdrop-blur-md text-white rounded-xl active:bg-white/30 transition-all border border-white/10">
                            <MoreVertical size={18}/>
                          </button>
                          {menuOpenId === post.id && (
                            <div className="absolute right-0 top-12 bg-white shadow-2xl rounded-2xl border border-slate-100/80 py-1.5 w-48 z-50 animate-scale-in origin-top-right">
                              <button onClick={(e) => { e.stopPropagation(); handlePin(post.id, post.isPinned); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 flex items-center gap-3 border-b border-slate-50">
                                <Pin size={13}/> {post.isPinned ? 'Desanclar' : 'Fijar arriba'}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleReNotify(post); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-50">
                                <BellRing size={13}/> Re-Notificar
                              </button>
                              {isPastor && (
                                <button onClick={(e) => { e.stopPropagation(); handleArchive(post.id, post.isArchived); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                                  <Archive size={13}/> {post.isArchived ? 'Desarchivar' : 'Archivar'}
                                </button>
                              )}
                              {/* ACCIÓN ELIMINAR IMPLEMENTADA */}
                              <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 flex items-center gap-3">
                                <Trash2 size={13}/> Eliminar Post
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="absolute inset-0 p-6 flex flex-col justify-end text-left pointer-events-none">
                       <div className="flex flex-wrap gap-2 mb-3">
                          <div className="px-2.5 py-1 bg-brand-500 rounded-full text-[7px] font-black text-white uppercase tracking-widest">Devocional</div>
                          {post.mood && <div className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[7px] font-black text-white uppercase tracking-widest border border-white/10">{post.mood}</div>}
                          {post.seriesName && <div className="px-2.5 py-1 bg-indigo-500/80 backdrop-blur-md rounded-full text-[7px] font-black text-white uppercase tracking-widest border border-indigo-400/20 shadow-sm">{post.seriesName}</div>}
                       </div>
                       <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight mb-2 italic line-clamp-2">{post.title}</h2>
                       <button onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.id}`); }} className="mt-4 bg-white text-slate-950 py-3.5 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all pointer-events-auto w-full">
                         <BookOpen size={14} className="text-slate-950"/> Leer Palabra
                       </button>
                    </div>
                  </div>
                ) : (
                  
                  // 📌 RENDER TIPO 2: NOTICIA / ORACIÓN (ESTILO INSTAGRAM FEED PROPIAMENTE DICHO)
                  <>
                    {/* ENCABEZADO DEL AUTOR SIEMPRE ARRIBA DEL POST */}
                    <div className="p-4 flex justify-between items-center bg-white">
                      <div className="flex items-center gap-3 text-left">
                          <div className="w-10 h-10 rounded-full border-2 border-slate-50 shadow-sm overflow-hidden shrink-0 bg-slate-100">
                            <img src={profileImg} className="w-full h-full object-cover" alt="Avatar"/>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none">{post.authorName}</h3>
                              {post.isPinned && <Pin size={10} className="text-amber-500" fill="currentColor"/>}
                            </div>
                            <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 inline-block ${isOracion ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                              {isOracion ? 'Pedido de Oración' : post.role}
                            </span>
                          </div>
                      </div>
                      
                      {isModerator && (
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><MoreVertical size={18}/></button>
                          {menuOpenId === post.id && (
                            <div className="absolute right-0 top-10 bg-white shadow-2xl rounded-2xl border border-slate-100 py-1.5 w-48 z-50 animate-scale-in origin-top-right">
                              <button onClick={(e) => { e.stopPropagation(); handlePin(post.id, post.isPinned); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 flex items-center gap-3 border-b border-slate-50">
                                <Pin size={13}/> {post.isPinned ? 'Desanclar' : 'Fijar arriba'}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleReNotify(post); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-50">
                                <BellRing size={13}/> Re-Notificar
                              </button>
                              {isPastor && (
                                <button onClick={(e) => { e.stopPropagation(); handleArchive(post.id, post.isArchived); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                                  <Archive size={13}/> {post.isArchived ? 'Desarchivar' : 'Archivar'}
                                </button>
                              )}
                              {/* ACCIÓN ELIMINAR IMPLEMENTADA */}
                              <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 flex items-center gap-3">
                                <Trash2 size={13}/> Eliminar Post
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* IMAGEN DEL FEED CENTRAL */}
                    {post.image && (
                      <div className="w-full aspect-square sm:aspect-video bg-slate-50 cursor-pointer overflow-hidden border-y border-slate-100/50" onClick={() => navigate(`/post/${post.id}`)}>
                        <img src={post.image} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" alt="Post"/>
                      </div>
                    )}

                    {/* PIE DE TARJETA CON TEXTOS */}
                    <div className="p-5 pt-4">
                      <div className="text-left cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                        <h2 className={`text-lg font-black uppercase tracking-tighter leading-tight mb-1.5 ${isOracion ? 'text-purple-950' : 'text-slate-900'}`}>{post.title}</h2>
                        <div className="text-[13px] text-slate-600 line-clamp-3 leading-relaxed font-medium mb-4">{post.content}</div>
                      </div>

                      <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
                      
                      {/* BARRA DE REACCIONES TIPO CÁPSULA RED SOCIAL */}
                      <div className="mt-4 pt-4 border-t border-slate-100/60 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
                             {['❤️', '🔥', '🙏', '👍'].map(e => {
                                const reactions = post.reactions || [];
                                const count = reactions.filter(r => r.emoji === e).length;
                                const isSelected = reactions.some(r => r.uid === currentUser?.uid && r.emoji === e);
                                return (
                                  <button key={e} onClick={() => handleReaction(post.id, post.reactions, e)} 
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all border shadow-sm active:scale-75 shrink-0 ${isSelected ? 'bg-slate-950 border-slate-950 text-white' : 'bg-white border-slate-100 text-slate-900 hover:bg-slate-50'}`}>
                                    <span className="text-sm leading-none">{e}</span>
                                    {count > 0 && <span className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{count}</span>}
                                  </button>
                                )
                             })}
                          </div>
                          <button onClick={() => navigate(`/post/${post.id}`)} className="p-3 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-2xl active:scale-95 transition-all relative border border-brand-100/30 shadow-sm shrink-0">
                             <MessageCircle size={18} />
                             {post.commentsCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">{post.commentsCount}</span>}
                          </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )})
        )}

        {hasMorePosts && !loading && (
          <div className="flex justify-center mt-4 pb-10">
            <button onClick={() => setVisibleCount(prev => prev + 4)} className="bg-white text-slate-600 border border-slate-200 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all shadow-sm">
              <ChevronDown size={14} /> Cargar más
            </button>
          </div>
        )}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} 
          className="fixed bottom-28 right-6 w-16 h-16 bg-slate-950 text-white rounded-[22px] shadow-2xl flex items-center justify-center active:scale-90 z-40 transition-all border-4 border-white shadow-slate-950/20">
          <PlusCircle size={28} />
        </button>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
    </div>
  );
}