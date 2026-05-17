import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, BookOpen, Pin, Link as LinkIcon, ExternalLink, 
  MessageCircle, MoreVertical, X, Edit3, Trash2, 
  PlusCircle, AlertTriangle, Calendar, Heart, Send, 
  AlertCircle, CheckCircle, Flame, HandHeart, ThumbsUp, 
  Archive, ChevronDown, Sparkles, Smile, Frown, Sun, CloudRain, Anchor, HelpCircle,
  Wallet, Video, Music, GraduationCap, Briefcase, BellRing, Layers, ArrowRight
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
  { id: 'Fortaleza', label: 'Fortaleza', icon: Anchor, color: 'from-blue-600 to-cyan-500' },
  { id: 'Gozo', label: 'Gozo', icon: Sun, color: 'from-amber-500 to-orange-500' },
  { id: 'Necesidad', label: 'Necesidad', icon: CloudRain, color: 'from-slate-600 to-slate-500' },
  { id: 'Paz', label: 'Paz', icon: Smile, color: 'from-emerald-600 to-teal-500' },
];

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
    <div className="mt-4 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl p-3.5 border border-blue-100/40 cursor-pointer hover:border-blue-200/60 transition-all duration-200 group" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <div className="flex items-center gap-2 mb-2.5">
        <MessageCircle size={13} className="text-blue-400 group-hover:text-blue-500 transition-colors" />
        <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-800 transition-colors">Ver {realCount} comentario{realCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">
        {previewComments.map((c, idx) => (
          <div key={idx} className="flex gap-2 text-xs">
            <span className="font-bold text-slate-900 shrink-0">{c.name?.split(' ')[0]}:</span>
            <span className="text-slate-600 line-clamp-1">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PostSkeleton = () => (
  <div className="bg-white p-6 rounded-2xl border border-blue-100/30 shadow-lg shadow-blue-200/10 animate-pulse">
    <div className="flex gap-3 mb-4">
      <div className="w-12 h-12 bg-gradient-to-br from-slate-300 to-slate-200 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-300 rounded-lg w-1/3"></div>
        <div className="h-3 bg-slate-200 rounded-lg w-1/4"></div>
      </div>
    </div>
    <div className="h-48 bg-gradient-to-br from-slate-200 to-slate-100 rounded-xl w-full mb-3"></div>
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
    if (!window.confirm("¿Eliminar este post permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setMenuOpenId(null);
      showToast("Post eliminado");
    } catch (e) { 
      console.error(e); 
      showToast("Error al eliminar");
    }
  };

  const handleReNotify = async (post) => {
    setMenuOpenId(null);
    showToast("Re-enviando notificación...");

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
        showToast("¡Notificación reenviada!");
      } else {
        throw new Error("OneSignal Error");
      }
    } catch (error) {
      console.error(error);
      showToast("Error en notificaciones");
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
    <div className="pb-40 min-h-screen bg-gradient-to-b from-blue-50/80 via-white to-blue-50/40 font-outfit text-left antialiased">
      {/* TOAST NOTIFICATION */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[250] bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3.5 rounded-full text-xs font-bold shadow-2xl border border-blue-500/30 animate-in fade-in slide-in-from-top-4 duration-300">
          {toast.message}
        </div>
      )}

      <TopBar />

      <div className="max-w-2xl mx-auto px-5 mt-8 space-y-6">
          
          {/* BANNER CUMPLEAÑOS - CARD PREMIUM */}
          {birthdays.length > 0 && (
            <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} 
                 className="group relative overflow-hidden bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-orange-500/10 p-px rounded-2xl cursor-pointer active:scale-98 transition-transform duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-rose-400 to-orange-400 opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-xl px-5 py-4 rounded-[15px] border border-rose-200/30 group-hover:border-rose-300/50 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform duration-300">
                      <Cake size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Celebraciones Hoy</h4>
                      <p className="text-xs text-rose-600 font-semibold mt-0.5">
                        {birthdays.length} hermano{birthdays.length !== 1 ? 's' : ''} de cumpleaños ✨
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-slate-400 group-hover:text-rose-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          )}

          {/* STORIES SECTION - PREMIUM CAROUSEL */}
          {storyDevocionales.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"></div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Historias Activas</span>
                <div className="flex-1 h-px bg-gradient-to-r from-blue-200/50 to-transparent"></div>
              </div>
              <div className="bg-white border border-blue-100/40 rounded-2xl p-5 shadow-lg shadow-blue-200/10 backdrop-blur-sm">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {storyDevocionales.map((post) => {
                    const storyPhoto = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=1e293b&color=fff`;
                    return (
                      <button 
                        key={post.id} 
                        onClick={() => navigate(`/post/${post.id}`)}
                        className="flex flex-col items-center gap-2.5 shrink-0 group/story"
                      >
                        <div className="relative">
                          <div className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-500 shadow-lg shadow-blue-400/30 group-hover/story:shadow-blue-400/50 transition-all group-hover/story:scale-110 duration-300">
                            <div className="w-full h-full rounded-full border-[2.5px] border-white overflow-hidden bg-slate-100">
                              <img src={storyPhoto} alt="Story" className="w-full h-full object-cover" />
                            </div>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 max-w-[56px] text-center truncate group-hover/story:text-blue-600 transition-colors">
                          {post.title?.split(' ')[0] || 'Palabra'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY FILTERS - PREMIUM TABS */}
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
                  className={`relative py-2.5 px-5 rounded-xl text-xs font-bold tracking-wider transition-all duration-300 whitespace-nowrap ${
                    isActive 
                      ? 'text-white shadow-lg shadow-blue-600/40' 
                      : 'text-slate-700 hover:text-slate-900 bg-white/60 border border-blue-200/30 hover:border-blue-300/50'
                  }`}
                  style={isActive ? {
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)',
                    borderColor: 'transparent'
                  } : {}}
                >
                  {cat}
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full"></div>}
                </button>
              )
            })}
          </div>

          {/* FILTROS ANIDADOS - MOOD & SERIES */}
          {filter === 'Devocional' && (
            <div className="space-y-4 bg-white border border-blue-100/40 p-5 rounded-2xl shadow-lg shadow-blue-200/10 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 px-1">Filtrar por Ánimo</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {MOODS.map(m => (
                    <button key={m.id} onClick={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                     className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 border text-xs font-bold whitespace-nowrap ${
                       selectedMood === m.id 
                         ? `text-white border-transparent shadow-lg ${m.color}` 
                         : 'bg-slate-50/80 text-slate-700 border-blue-200/30 hover:border-blue-300/50'
                     }`}
                     style={selectedMood === m.id ? { background: `linear-gradient(135deg, var(--tw-gradient-stops))` } : {}}
                    >
                       <m.icon size={14} />
                       <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {allSeries.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 px-1">Series de Fe</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <button 
                      onClick={() => setSelectedSeries(null)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-2 ${!selectedSeries ? 'text-white border-transparent shadow-lg bg-gradient-to-r from-indigo-600 to-blue-600' : 'bg-slate-50/80 text-slate-700 border-blue-200/30 hover:border-blue-300/50'}`}
                    >
                      <Layers size={13}/> Todas
                    </button>
                    {allSeries.map((s, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setSelectedSeries(selectedSeries === s ? null : s)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${selectedSeries === s ? 'text-white border-transparent shadow-lg bg-gradient-to-r from-indigo-600 to-blue-600' : 'bg-slate-50/80 text-slate-700 border-blue-200/30 hover:border-blue-300/50'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

      {/* FEED DE POSTS - PREMIUM LAYOUT */}
      <div className="max-w-2xl mx-auto space-y-6 px-5 mt-8">
        {loading ? (
            <div className="space-y-5"><PostSkeleton /><PostSkeleton /></div>
        ) : filteredPosts.length === 0 ? (
            <div className="text-center py-24 bg-white border border-blue-100/40 rounded-2xl shadow-lg shadow-blue-200/10 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                <Sparkles size={32} className="text-blue-400"/>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sin contenido aún</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const isDevocional = post.type === 'Devocional';
              const isOracion = post.type === 'Oración';
              const profileImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=1e293b&color=fff`;

              return (
              <div key={post.id} className={`relative overflow-hidden bg-white border rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group ${
                post.isPinned ? 'border-amber-400/40 shadow-amber-200/20' : 'border-blue-100/40 shadow-blue-200/10'
              }`}>
                {post.isPinned && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400"></div>}
                
                {/* HEADER ELEGANTE */}
                <div className="p-5 flex justify-between items-start border-b border-blue-100/30 bg-gradient-to-br from-white/80 to-blue-50/40 backdrop-blur-sm">
                  <div className="flex items-start gap-3 flex-1">
                      <div className="w-11 h-11 rounded-full border-2 border-blue-200/60 overflow-hidden shrink-0 bg-gradient-to-br from-slate-100 to-blue-50 shadow-md">
                        <img src={profileImg} className="w-full h-full object-cover" alt="Avatar"/>
                      </div>
                      <div className="pt-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{post.authorName}</h3>
                          {post.isPinned && <Pin size={11} className="text-amber-600 fill-amber-600" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isOracion ? 'bg-purple-100/80 text-purple-700' : 
                            isDevocional ? 'bg-indigo-100/80 text-indigo-700' : 
                            'bg-slate-100/80 text-slate-600'
                          }`}>
                            {isOracion ? '🛐 Oración' : isDevocional ? '📖 Devocional' : `📢 ${post.type}`}
                          </span>
                        </div>
                      </div>
                  </div>
                  
                  {isModerator && (
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white/80 transition-all"><MoreVertical size={16}/></button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-10 bg-white shadow-2xl shadow-slate-300/30 rounded-xl border border-blue-100/30 py-2 w-44 z-50 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-sm">
                          <button onClick={(e) => { e.stopPropagation(); handlePin(post.id, post.isPinned); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-blue-50 flex items-center gap-2.5 border-b border-blue-100/30 transition-colors">
                            <Pin size={13}/> {post.isPinned ? 'Desanclar' : 'Fijar'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleReNotify(post); }} className="w-full text-left px-4 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2.5 border-b border-blue-100/30 transition-colors">
                            <BellRing size={13}/> Re-notificar
                          </button>
                          {isPastor && (
                            <button onClick={(e) => { e.stopPropagation(); handleArchive(post.id, post.isArchived); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-blue-50 flex items-center gap-2.5 border-b border-blue-100/30 transition-colors">
                              <Archive size={13}/> {post.isArchived ? 'Restaurar' : 'Archivar'}
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors">
                            <Trash2 size={13}/> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* IMAGEN INMERSIVA */}
                {post.image && (
                  <div className="w-full aspect-square bg-gradient-to-br from-slate-200 to-blue-200 cursor-pointer overflow-hidden" onClick={() => navigate(`/post/${post.id}`)}>
                    <img src={post.image} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer" alt="Post"/>
                  </div>
                )}

                {/* CONTENIDO */}
                <div className="p-5 space-y-3">
                  {isDevocional && post.seriesName && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-100/80 to-blue-100/80 text-indigo-700 text-xs font-bold border border-indigo-200/60">
                      <Layers size={12} /> {post.seriesName}
                    </span>
                  )}
                  
                  <div className="cursor-pointer space-y-2" onClick={() => navigate(`/post/${post.id}`)}>
                    <h2 className="text-lg font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">{post.title}</h2>
                    <div className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{post.content}</div>
                  </div>

                  <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
                  
                  {/* BARRA DE INTERACCIONES */}
                  <div className="pt-4 border-t border-blue-100/30 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                         {['❤️', '🔥', '🙏', '👍'].map(e => {
                            const reactions = post.reactions || [];
                            const count = reactions.filter(r => r.emoji === e).length;
                            const isSelected = reactions.some(r => r.uid === currentUser?.uid && r.emoji === e);
                            return (
                              <button key={e} onClick={() => handleReaction(post.id, post.reactions, e)} 
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all active:scale-90 shrink-0 border font-semibold text-xs ${
                                  isSelected 
                                    ? 'text-white border-transparent shadow-lg bg-gradient-to-r from-blue-600 to-cyan-500' 
                                    : 'bg-white text-slate-700 border-blue-200/30 hover:border-blue-300/50 hover:bg-blue-50/50'
                                }`}>
                                <span className="text-sm">{e}</span>
                                {count > 0 && <span>{count}</span>}
                              </button>
                            )
                         })}
                      </div>
                      
                      <button onClick={() => navigate(`/post/${post.id}`)} className="p-2.5 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border border-blue-200/60 text-blue-500 hover:text-blue-600 rounded-lg transition-all shrink-0 shadow-md hover:shadow-lg group-hover:scale-105">
                         <MessageCircle size={17} />
                         {post.commentsCount > 0 && (
                           <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-lg">
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
          <div className="flex justify-center mt-8 pb-16">
            <button onClick={() => setVisibleCount(prev => prev + 4)} className="group relative bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-8 py-3.5 rounded-full text-sm font-bold flex items-center gap-2.5 active:scale-95 transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 border border-blue-500/50 hover:border-blue-400">
              <ChevronDown size={15} /> Cargar más
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-full transition-opacity duration-300"></div>
            </button>
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE PREMIUM */}
      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} 
          className="fixed bottom-24 right-5 w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-500 text-white rounded-full shadow-2xl shadow-blue-600/40 flex items-center justify-center active:scale-90 z-40 transition-all border border-blue-500/30 hover:shadow-blue-600/60 hover:scale-110 duration-300 group">
          <PlusCircle size={22} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
    </div>
  );
}
