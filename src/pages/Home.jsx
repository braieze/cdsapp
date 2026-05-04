import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, BookOpen, Pin, Link as LinkIcon, ExternalLink, 
  MessageCircle, MoreVertical, X, Edit3, Trash2, 
  PlusCircle, AlertTriangle, Calendar, Heart, Send, 
  AlertCircle, CheckCircle, Flame, HandHeart, ThumbsUp, 
  Archive, ChevronDown, Sparkles, Smile, Frown, Sun, CloudRain, Anchor, HelpCircle,
  Wallet, Video, Music, GraduationCap, Briefcase, BellRing
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
    <div className="mt-3 bg-slate-50/80 rounded-2xl p-3 border border-slate-100 cursor-pointer active:scale-[0.98] transition-all" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle size={10} className="text-brand-600" />
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
  <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm animate-pulse mb-4 mx-4">
    <div className="flex gap-4 mb-4">
      <div className="w-14 h-14 bg-slate-200 rounded-2xl"></div>
      <div className="flex-1 space-y-3 py-2">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
      </div>
    </div>
    <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
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

      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      const payload = {
        app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
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
    if (selectedMood && filter === 'Devocional') result = result.filter(p => p.mood === selectedMood);
    return result;
  }, [filter, posts, selectedMood]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMorePosts = visibleCount < filteredPosts.length;

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-outfit relative">
      {toast.show && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl animate-slide-up border border-white/10">
          {toast.message}
        </div>
      )}

      <TopBar />

      <div className="px-5 mt-4 space-y-4">
          <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} 
               className={`p-1 rounded-[30px] transition-all active:scale-95 ${birthdays.length > 0 ? 'bg-gradient-to-r from-brand-500 to-indigo-500 shadow-lg' : 'bg-white border border-slate-100'}`}>
            <div className={`flex items-center justify-between p-3 rounded-[26px] ${birthdays.length > 0 ? 'bg-white/90 backdrop-blur-sm' : 'bg-white'}`}>
              <div className="flex items-center gap-3 text-left">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white ${birthdays.length > 0 ? 'bg-brand-600 animate-pulse' : 'bg-slate-50 text-slate-300'}`}>
                  <Cake size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase leading-none">Cumpleaños</p>
                  <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                    {birthdays.length > 0 ? `${birthdays.length} celebraciones hoy 🎂` : "Sin festejos hoy"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['Todo', 'Devocional', 'Oración', 'Noticia', 'Archivados'].map((cat) => {
              if (cat === 'Archivados' && !isPastor) return null;
              return (
                <button key={cat} onClick={() => { setFilter(cat); setVisibleCount(4); setSelectedMood(null); }} 
                  className={`py-2.5 px-5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 whitespace-nowrap ${
                    filter === cat 
                    ? (cat === 'Oración' ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-slate-900 border-slate-900 text-white shadow-md')
                    : 'bg-white text-slate-400 border-slate-50'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
      </div>

      <div className="space-y-6 px-4 mt-6">
        {loading ? (
            <div className="space-y-4"><PostSkeleton /><PostSkeleton /></div>
        ) : displayedPosts.length === 0 ? (
            <div className="text-center py-20 opacity-30 flex flex-col items-center">
              <Sparkles size={48} className="mb-4 text-slate-300"/>
              <p className="font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Sin contenido</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const isDevocional = post.type === 'Devocional';
              const isOracion = post.type === 'Oración';
              const profileImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;

              return (
              <div key={post.id} className={`relative transition-all ${
                isDevocional ? 'h-[380px] rounded-[40px] overflow-hidden shadow-xl mb-6' 
                : 'bg-white border border-slate-100 rounded-[30px] shadow-sm mb-6 overflow-hidden'
              }`}>
                {isDevocional ? (
                  <div className="absolute inset-0 w-full h-full">
                    <div className="absolute inset-0 w-full h-full cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                      {post.image ? <img src={post.image} className="w-full h-full object-cover" alt="Portada" referrerPolicy="no-referrer" /> : <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-brand-900" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                    </div>

                    {/* ✅ SOLUCIÓN: Cabecera administrativa sobre la imagen del devocional */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
                      <div>
                        {post.isPinned && <div className="bg-amber-500 text-white p-2 rounded-xl shadow-lg"><Pin size={14} fill="currentColor"/></div>}
                      </div>
                      
                      {isModerator && (
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="p-2.5 bg-black/20 backdrop-blur-md text-white rounded-xl active:bg-white/40 transition-all border border-white/10">
                            <MoreVertical size={20}/>
                          </button>
                          {menuOpenId === post.id && (
                            <div className="absolute right-0 top-12 bg-white shadow-2xl rounded-2xl border border-slate-100 py-1.5 w-48 z-50 animate-scale-in origin-top-right">
                              <button onClick={(e) => { e.stopPropagation(); handlePin(post.id, post.isPinned); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 flex items-center gap-3 border-b border-slate-50">
                                <Pin size={14}/> {post.isPinned ? 'Desanclar' : 'Fijar arriba'}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleReNotify(post); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-50">
                                <BellRing size={14}/> Re-Notificar
                              </button>
                              {isPastor && (
                                <button onClick={(e) => { e.stopPropagation(); handleArchive(post.id, post.isArchived); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                                  <Archive size={14}/> {post.isArchived ? 'Desarchivar' : 'Archivar'}
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); setEditingPost(post); setIsModalOpen(true); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                <Edit3 size={14}/> Editar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="absolute inset-0 p-6 flex flex-col justify-end text-left pointer-events-none">
                       <div className="flex items-center gap-2 mb-3">
                          <div className="px-2.5 py-1 bg-brand-500 rounded-full text-[7px] font-black text-white uppercase tracking-widest">Devocional</div>
                          {post.mood && <div className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[7px] font-black text-white uppercase tracking-widest">{post.mood}</div>}
                       </div>
                       <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight mb-2 italic line-clamp-2">{post.title}</h2>
                       <button onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.id}`); }} className="mt-4 bg-white text-black py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all pointer-events-auto">
                         <BookOpen size={14}/> Leer Palabra
                       </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {post.image && (
                      <div className="w-full aspect-video bg-slate-100 cursor-pointer overflow-hidden border-b border-slate-50" onClick={() => navigate(`/post/${post.id}`)}>
                        <img src={post.image} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" alt="Post"/>
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-9 h-9 rounded-xl border-2 border-white shadow-sm overflow-hidden shrink-0 bg-slate-100">
                              <img src={profileImg} className="w-full h-full object-cover" alt="Avatar"/>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">{post.authorName}</h3>
                                {post.isPinned && <Pin size={10} className="text-amber-500" fill="currentColor"/>}
                              </div>
                              <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-1 inline-block ${isOracion ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
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
                                  <Pin size={14}/> {post.isPinned ? 'Desanclar' : 'Fijar arriba'}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleReNotify(post); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-50">
                                  <BellRing size={14}/> Re-Notificar
                                </button>
                                {isPastor && (
                                  <button onClick={(e) => { e.stopPropagation(); handleArchive(post.id, post.isArchived); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                                    <Archive size={14}/> {post.isArchived ? 'Desarchivar' : 'Archivar'}
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setEditingPost(post); setIsModalOpen(true); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                  <Edit3 size={14}/> Editar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-left" onClick={() => navigate(`/post/${post.id}`)}>
                        <h2 className={`text-lg font-black uppercase tracking-tighter leading-tight mb-1 ${isOracion ? 'text-purple-900' : 'text-slate-900'}`}>{post.title}</h2>
                        <div className="text-[13px] text-slate-600 line-clamp-3 leading-relaxed font-medium mb-3">{post.content}</div>
                      </div>

                      <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
                      
                      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
                             {['❤️', '🔥', '🙏', '👍'].map(e => {
                                const reactions = post.reactions || [];
                                const count = reactions.filter(r => r.emoji === e).length;
                                const isSelected = reactions.some(r => r.uid === currentUser?.uid && r.emoji === e);
                                return (
                                  <button key={e} onClick={() => handleReaction(post.id, post.reactions, e)} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border active:scale-75 ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-100 text-slate-900 hover:bg-slate-50'}`}>
                                    <span className="text-base">{e}</span>
                                    {count > 0 && <span className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{count}</span>}
                                  </button>
                                )
                             })}
                          </div>
                          <button onClick={() => navigate(`/post/${post.id}`)} className="ml-2 p-3 bg-brand-50 text-brand-600 rounded-2xl active:scale-95 transition-all relative">
                             <MessageCircle size={20} />
                             {post.commentsCount > 0 && <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{post.commentsCount}</span>}
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
            <button onClick={() => setVisibleCount(prev => prev + 4)} className="bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all">
              <ChevronDown size={14} /> Cargar más
            </button>
          </div>
        )}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} 
          className="fixed bottom-28 right-6 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center active:scale-90 z-40 transition-all border-4 border-white">
          <PlusCircle size={28} />
        </button>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
    </div>
  );
}