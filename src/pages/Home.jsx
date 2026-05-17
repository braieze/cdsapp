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
    <div className="mt-4 bg-slate-50/70 hover:bg-slate-100/70 rounded-2xl p-4 border border-slate-100/80 cursor-pointer transition-all duration-200" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <div className="flex items-center gap-2 mb-2.5">
        <MessageCircle size={13} className="text-slate-400" />
        <span className="text-[11px] font-bold text-slate-500 tracking-tight">Ver los {realCount} comentarios</span>
      </div>
      <div className="space-y-2">
        {previewComments.map((c, idx) => (
          <div key={idx} className="flex gap-2 text-left items-start text-sm">
            <span className="font-bold text-slate-800 text-[13px]">{c.name?.split(' ')[0]}</span>
            <span className="text-slate-600 font-normal text-[13px] line-clamp-2">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PostSkeleton = () => (
  <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm animate-pulse mb-5 mx-4">
    <div className="flex gap-3 mb-4">
      <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
        <div className="h-2 bg-slate-200 rounded w-1/6"></div>
      </div>
    </div>
    <div className="h-44 bg-slate-100 rounded-[20px] w-full mb-2"></div>
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
      showToast(currentPinned ? "Publicación desanclada" : "Publicación anclada");
    } catch (e) { console.error(e); }
  };

  const handleDeletePost = async (postId) => {
    if (!isModerator) return;
    if (!window.confirm("¿Deseas eliminar permanentemente esta publicación?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setMenuOpenId(null);
      showToast("Publicación eliminada");
    } catch (e) { 
      console.error(e); 
      showToast("Error al eliminar");
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
        showToast("¡Aviso enviado!");
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

  const storyDevocionales = useMemo(() => {
    return posts.filter(p => p.type === 'Devocional' && !p.isArchived).slice(0, 7);
  }, [posts]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMorePosts = visibleCount < filteredPosts.length;

  return (
    <div className="pb-36 min-h-screen bg-slate-50 font-outfit relative animate-fade-in">
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl text-xs font-semibold shadow-xl border border-white/10 animate-slide-up">
          {toast.message}
        </div>
      )}

      <TopBar />

      {/* CONTENEDOR DE FILTROS Y CONTENIDO SUPERIOR */}
      <div className="px-4 mt-3 space-y-4">
          
          {/* CUMPLEANIOS - BANNER ESTILO HISTORIA */}
          {birthdays.length > 0 && (
            <div onClick={() => setIsBirthdayModalOpen(true)} 
                 className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-[1.5px] rounded-3xl shadow-md active:scale-[0.99] transition-all cursor-pointer">
              <div className="bg-white px-4 py-3 rounded-[22px] flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-pink-600 shrink-0">
                    <Cake size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 tracking-tight">Celebraciones de Hoy</h4>
                    <p className="text-[11px] text-purple-600 font-medium mt-0.5">
                      Hay {birthdays.length} hermanos de festejo. ¡Saludalos! 🎂
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INSTAGRAM LOOK: STORIES PARA DEVOCIONALES */}
          {storyDevocionales.length > 0 && (
            <div className="bg-white py-3.5 px-4 rounded-[26px] border border-slate-100 shadow-sm space-y-2 text-left">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-500 animate-pulse"/> Últimos Devocionales
              </span>
              <div className="flex gap-4 overflow-x-auto no-scrollbar py-1 px-0.5">
                {storyDevocionales.map((post) => {
                  const storyPhoto = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;
                  return (
                    <button 
                      key={post.id} 
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="flex flex-col items-center gap-1 shrink-0 transition-all active:scale-90"
                    >
                      <div className="w-13 h-13 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 shadow-sm">
                        <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-slate-100">
                          <img src={storyPhoto} alt="Story Avatar" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-slate-700 max-w-[56px] truncate tracking-tight">
                        {post.title?.split(' ')[0] || 'Palabra'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PÍLDORAS DE FILTRADO - MINIMALISTAS THREADS STYLE */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
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
                  className={`py-2 px-4 rounded-full text-xs font-semibold tracking-tight transition-all border whitespace-nowrap ${
                    isActive 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200/60 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* FILTROS AVANZADOS DE DEVOCIONALES */}
          {filter === 'Devocional' && (
            <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 animate-slide-up">
              {/* Ánimos */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar justify-start">
                {MOODS.map(m => (
                  <button key={m.id} onClick={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border text-xs font-medium ${selectedMood === m.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-transparent opacity-50'}`}
                  >
                     <m.icon size={14} />
                     <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Series Pills */}
              {allSeries.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  <button 
                    onClick={() => setSelectedSeries(null)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap flex items-center gap-1 ${!selectedSeries ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    <Layers size={11}/> Todas
                  </button>
                  {allSeries.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedSeries(selectedSeries === s ? null : s)}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap ${selectedSeries === s ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white text-slate-400 border-slate-100'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {/* FEED DE PUBLICACIONES (ESTILO RED SOCIAL LIMPIA) */}
      <div className="space-y-5 px-4 mt-4">
        {loading ? (
            <div className="space-y-4"><PostSkeleton /><PostSkeleton /></div>
        ) : filteredPosts.length === 0 ? (
            <div className="text-center py-20 opacity-40 flex flex-col items-center">
              <Sparkles size={36} className="mb-2 text-slate-300"/>
              <p className="text-sm font-medium text-slate-400">No hay publicaciones disponibles</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const isDevocional = post.type === 'Devocional';
              const isOracion = post.type === 'Oración';
              const profileImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;

              return (
              <div key={post.id} className={`bg-white border border-slate-100 rounded-[24px] shadow-[0_2px_8px_rgba(15,23,42,0.02)] mb-4 overflow-hidden hover:shadow-[0_4px_16px_rgba(15,23,42,0.04)] transition-all duration-300 ${
                post.isPinned ? 'border-amber-200/80 bg-gradient-to-b from-amber-50/10 to-white' : ''
              }`}>
                
                {/* 1. HEADER INTEGRADO DEL AUTOR (IG / THREADS STYLE) */}
                <div className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3 text-left">
                      <div className="w-9 h-9 rounded-full border border-slate-100 shadow-sm overflow-hidden shrink-0 bg-slate-50">
                        <img src={profileImg} className="w-full h-full object-cover" alt="Avatar"/>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-[13px] font-bold text-slate-900 tracking-tight">{post.authorName}</h3>
                          {post.isPinned && <Pin size={11} className="text-amber-500" fill="currentColor"/>}
                        </div>
                        <span className={`text-[10px] font-bold tracking-tight mt-0.5 inline-block ${isOracion ? 'text-purple-600' : 'text-slate-400'}`}>
                          {isOracion ? '🛐 Pedido de Oración' : isDevocional ? '📖 Devocional' : `📢 ${post.role}`}
                        </span>
                      </div>
                  </div>
                  
                  {isModerator && (
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-50 transition-all"><MoreVertical size={16}/></button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-8 bg-white shadow-xl rounded-2xl border border-slate-100 py-1.5 w-44 z-50 animate-scale-in origin-top-right">
                          <button onClick={(e) => { e.stopPropagation(); handlePin(post.id, post.isPinned); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 border-b border-slate-50">
                            <Pin size={13}/> {post.isPinned ? 'Desanclar' : 'Fijar arriba'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleReNotify(post); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2.5 border-b border-slate-50">
                            <BellRing size={13}/> Re-Notificar
                          </button>
                          {isPastor && (
                            <button onClick={(e) => { e.stopPropagation(); handleArchive(post.id, post.isArchived); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 flex items-center gap-2.5 border-b border-slate-50">
                              <Archive size={13}/> {post.isArchived ? 'Desarchivar' : 'Archivar'}
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5">
                            <Trash2 size={13}/> Eliminar Post
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. AREA MULTIMEDIA CENTRAL */}
                {post.image && (
                  <div className="w-full aspect-square sm:aspect-video bg-slate-50 cursor-pointer overflow-hidden border-y border-slate-100/60" onClick={() => navigate(`/post/${post.id}`)}>
                    <img src={post.image} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" alt="Post"/>
                  </div>
                )}

                {/* 3. BLOQUE DE TEXTO DEL FEED */}
                <div className="p-4 pt-3 text-left">
                  {isDevocional && post.seriesName && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold mb-2 border border-indigo-100">
                      Serie: {post.seriesName}
                    </span>
                  )}
                  
                  <div className="cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight leading-snug mb-1">{post.title}</h2>
                    <div className="text-[13.5px] text-slate-600 line-clamp-3 leading-relaxed font-normal mb-2">{post.content}</div>
                  </div>

                  {/* PREVIEW COMPONENT DE COMENTARIOS */}
                  <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
                  
                  {/* 4. BARRA DE REACCIONES LIMPIA (TIPO INSTAGRAM/THREADS) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                         {['❤️', '🔥', '🙏', '👍'].map(e => {
                            const reactions = post.reactions || [];
                            const count = reactions.filter(r => r.emoji === e).length;
                            const isSelected = reactions.some(r => r.uid === currentUser?.uid && r.emoji === e);
                            return (
                              <button key={e} onClick={() => handleReaction(post.id, post.reactions, e)} 
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-transform active:scale-70 shrink-0 border ${
                                  isSelected 
                                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                                    : 'bg-slate-50/50 border-slate-100 text-slate-800 hover:bg-slate-50'
                                }`}>
                                <span className="text-sm">{e}</span>
                                {count > 0 && <span className="text-[11px] font-bold ml-1">{count}</span>}
                              </button>
                            )
                         })}
                      </div>
                      
                      <button onClick={() => navigate(`/post/${post.id}`)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors relative shrink-0">
                         <MessageCircle size={20} />
                         {post.commentsCount > 0 && (
                           <span className="absolute -top-0.5 -right-0.5 bg-brand-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                             {post.commentsCount}
                           </span>
                         )}
                      </button>
                  </div>
                </div>
              </div>
            )})
        )}

        {hasMorePosts && !loading && (
          <div className="flex justify-center mt-3 pb-10">
            <button onClick={() => setVisibleCount(prev => prev + 4)} className="bg-white text-slate-500 border border-slate-200/80 px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm">
              <ChevronDown size={14} /> Cargar más
            </button>
          </div>
        )}
      </div>

      {/* BOTON FLOTANTE DE CREACION */}
      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} 
          className="fixed bottom-28 right-5 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 z-40 transition-all border border-white/20">
          <PlusCircle size={24} />
        </button>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
    </div>
  );
}