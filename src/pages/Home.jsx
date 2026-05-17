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
import { ONESIGNAL_CONFIG } from '../oneSignalConfig';

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
    <div className="mt-4 bg-slate-50 rounded-xl p-3.5 border border-slate-150 cursor-pointer hover:border-slate-200 transition-all duration-150" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle size={13} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-500">Ver {realCount} comentario{realCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1">
        {previewComments.map((c, idx) => (
          <div key={idx} className="flex gap-2 text-left items-start text-xs">
            <span className="font-semibold text-slate-800 shrink-0">{c.name?.split(' ')[0]}:</span>
            <span className="text-slate-600 line-clamp-1 font-normal">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PostSkeleton = () => (
  <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-[0_2px_12px_rgba(0,0,0,0.04)] animate-pulse mb-4">
    <div className="flex gap-3 mb-4">
      <div className="w-11 h-11 bg-slate-200 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
        <div className="h-2.5 bg-slate-200 rounded w-1/4"></div>
      </div>
    </div>
    <div className="h-40 bg-slate-100 rounded-lg w-full mb-2"></div>
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

  const handleDeletePost = async (postId) => {
    if (!isModerator) return;
    if (!window.confirm("¿Seguro que deseas eliminar permanentemente este post?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setMenuOpenId(null);
      showToast("Post eliminado de forma definitiva");
    } catch (e) { 
      console.error(e); 
      showToast("Error al procesar la baja");
    }
  };

  const handleReNotify = async (post) => {
    setMenuOpenId(null);
    showToast("Re-enviando alerta push...");

    try {
      const notifBody = post.content ? post.content.substring(0, 100) + '...' : 'Toca para ver el anuncio.';
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
        showToast("¡Alerta empujada correctamente!");
      } else {
        throw new Error("OneSignal Error");
      }
    } catch (error) {
      console.error(error);
      showToast("Error en los servidores de alerta.");
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

  const storyDevocionales = useMemo(() => {
    return posts.filter(p => p.type === 'Devocional' && !p.isArchived).slice(0, 8);
  }, [posts]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMorePosts = visibleCount < filteredPosts.length;

  return (
    <div className="pb-36 min-h-screen bg-white font-outfit text-left antialiased">
      {/* GLOBAL TOAST NOTIFICATION POPUP */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[250] bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-semibold shadow-xl border border-slate-800 animate-fade-in">
          {toast.message}
        </div>
      )}

      <TopBar />

      <div className="max-w-2xl mx-auto px-5 mt-6 space-y-4">
          
          {/* BANNER DE CUMPLEAÑOS REDISEÑADO */}
          {birthdays.length > 0 && (
            <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} 
                 className="relative overflow-hidden bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-[1px] rounded-xl border border-purple-200/40 cursor-pointer group transition-all hover:border-purple-200/60 active:scale-95">
              <div className="bg-white/98 backdrop-blur px-4 py-3 rounded-[10px] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-purple-600 shrink-0">
                    <Cake size={16} className="group-hover:animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">Cumpleaños hoy</h4>
                    <p className="text-xs text-purple-600 font-medium mt-0.5">
                      {birthdays.length} hermano{birthdays.length !== 1 ? 's' : ''} para celebrar
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
              </div>
            </div>
          )}

          {/* STORIES CAROUSEL - ESTILO PREMIUM */}
          {storyDevocionales.length > 0 && (
            <div className="bg-white py-4 px-0 rounded-xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
              <div className="px-4 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Historias</span>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 px-4">
                {storyDevocionales.map((post) => {
                  const storyPhoto = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;
                  return (
                    <button 
                      key={post.id} 
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="flex flex-col items-center gap-2 shrink-0 group transition-transform active:scale-90"
                    >
                      <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-600 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className="w-full h-full rounded-full border-[2px] border-white overflow-hidden bg-slate-50">
                          <img src={storyPhoto} alt="Story" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-700 max-w-[56px] text-center truncate">
                        {post.title?.split(' ')[0] || 'Palabra'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* FILTROS DE CATEGORÍA - DISEÑO MINIMALISTA */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-5 px-5">
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
                  className={`py-2 px-3.5 rounded-lg text-xs font-semibold tracking-tight transition-all border whitespace-nowrap ${
                    isActive 
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100/50 hover:border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* FILTROS ANIDADOS - MOOD & SERIES */}
          {filter === 'Devocional' && (
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2 overflow-x-auto no-scrollbar justify-start">
                {MOODS.map(m => (
                  <button key={m.id} onClick={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                   className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all border text-xs font-semibold whitespace-nowrap ${selectedMood === m.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:border-slate-200'}`}
                  >
                     <m.icon size={12} />
                     <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {allSeries.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100/60">
                  <button 
                    onClick={() => setSelectedSeries(null)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap flex items-center gap-1 ${!selectedSeries ? 'bg-indigo-50 border-indigo-200/60 text-indigo-700' : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:border-slate-200'}`}
                  >
                    <Layers size={11}/> Todas
                  </button>
                  {allSeries.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedSeries(selectedSeries === s ? null : s)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${selectedSeries === s ? 'bg-indigo-50 border-indigo-200/60 text-indigo-700' : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:border-slate-200'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {/* FEED DE PUBLICACIONES */}
      <div className="max-w-2xl mx-auto space-y-4 px-5 mt-5">
        {loading ? (
            <div className="space-y-4"><PostSkeleton /><PostSkeleton /></div>
        ) : filteredPosts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200/60 flex flex-col items-center">
              <Sparkles size={28} className="mb-3 text-slate-300"/>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Sin contenido</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const isDevocional = post.type === 'Devocional';
              const isOracion = post.type === 'Oración';
              const profileImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;

              return (
              <div key={post.id} className={`bg-white border rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] ${
                post.isPinned ? 'border-amber-200/60 bg-gradient-to-b from-amber-50/40 to-white' : 'border-slate-200/60'
              }`}>
                
                {/* HEADER - AUTOR Y OPCIONES */}
                <div className="p-4 flex justify-between items-start bg-white border-b border-slate-100/60">
                  <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full border border-slate-150 overflow-hidden shrink-0 bg-slate-50">
                        <img src={profileImg} className="w-full h-full object-cover" alt="Avatar"/>
                      </div>
                      <div className="text-left pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900">{post.authorName}</h3>
                          {post.isPinned && <Pin size={10} className="text-amber-600 fill-amber-600 mt-0.5" />}
                        </div>
                        <span className={`text-xs font-semibold tracking-tight mt-0.5 inline-block ${isOracion ? 'text-purple-600' : isDevocional ? 'text-indigo-600' : 'text-slate-500'}`}>
                          {isOracion ? '🛐 Oración' : isDevocional ? '📖 Devocional' : post.type}
                        </span>
                      </div>
                  </div>
                  
                  {isModerator && (
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"><MoreVertical size={16}/></button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-8 bg-white shadow-lg rounded-lg border border-slate-200/60 py-1 w-40 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                          <button onClick={(e) => { e.stopPropagation(); handlePin(post.id, post.isPinned); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100/60">
                            <Pin size={13}/> {post.isPinned ? 'Desanclar' : 'Fijar'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleReNotify(post); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 border-b border-slate-100/60">
                            <BellRing size={13}/> Re-notificar
                          </button>
                          {isPastor && (
                            <button onClick={(e) => { e.stopPropagation(); handleArchive(post.id, post.isArchived); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100/60">
                              <Archive size={13}/> {post.isArchived ? 'Restaurar' : 'Archivar'}
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                            <Trash2 size={13}/> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* IMAGEN */}
                {post.image && (
                  <div className="w-full aspect-square bg-slate-50 cursor-pointer overflow-hidden border-y border-slate-100/60" onClick={() => navigate(`/post/${post.id}`)}>
                    <img src={post.image} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy" referrerPolicy="no-referrer" alt="Post"/>
                  </div>
                )}

                {/* CONTENIDO */}
                <div className="p-4 text-left space-y-3">
                  {isDevocional && post.seriesName && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200/60">
                      <Layers size={11} /> {post.seriesName}
                    </span>
                  )}
                  
                  <div className="cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                    <h2 className="text-base font-bold text-slate-900 leading-tight mb-2">{post.title}</h2>
                    <div className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{post.content}</div>
                  </div>

                  {/* PREVIEW COMENTARIOS */}
                  <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
                  
                  {/* BARRA DE ACCIONES */}
                  <div className="pt-3 border-t border-slate-100/60 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                         {['❤️', '🔥', '🙏', '👍'].map(e => {
                            const reactions = post.reactions || [];
                            const count = reactions.filter(r => r.emoji === e).length;
                            const isSelected = reactions.some(r => r.uid === currentUser?.uid && r.emoji === e);
                            return (
                              <button key={e} onClick={() => handleReaction(post.id, post.reactions, e)} 
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all active:scale-90 shrink-0 border text-xs ${
                                  isSelected 
                                    ? 'bg-slate-900 border-slate-900 text-white' 
                                    : 'bg-slate-50 border-slate-200/60 text-slate-700 hover:bg-slate-100/50'
                                }`}>
                                <span>{e}</span>
                                {count > 0 && <span className="font-semibold">{count}</span>}
                              </button>
                            )
                         })}
                      </div>
                      
                      <button onClick={() => navigate(`/post/${post.id}`)} className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-400 hover:text-slate-600 rounded-lg transition-all shrink-0">
                         <MessageCircle size={16} />
                         {post.commentsCount > 0 && (
                           <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white">
                             {post.commentsCount > 9 ? '9+' : post.commentsCount}
                           </span>
                         )}
                      </button>
                  </div>
                </div>
              </div>
            )})
        )}

        {/* CARGAR MÁS */}
        {hasMorePosts && !loading && (
          <div className="flex justify-center mt-6 pb-12">
            <button onClick={() => setVisibleCount(prev => prev + 4)} className="bg-white text-slate-700 border border-slate-200/60 px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 active:scale-95 transition-all hover:bg-slate-50">
              <ChevronDown size={13} /> Cargar más
            </button>
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE */}
      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} 
          className="fixed bottom-24 right-5 w-12 h-12 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 z-40 transition-all border border-slate-800 hover:bg-slate-800">
          <PlusCircle size={20} />
        </button>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
    </div>
  );
}
