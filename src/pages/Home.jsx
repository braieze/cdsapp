import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, BookOpen, Pin, Link as LinkIcon, ExternalLink, 
  MessageCircle, MoreVertical, X, Edit3, Trash2, 
  PlusCircle, AlertTriangle, Calendar, Heart, Send, 
  AlertCircle, CheckCircle, Flame, HandHeart, ThumbsUp, 
  Archive, ChevronDown, Sparkles, Smile, Frown, Sun, CloudRain, Anchor, HelpCircle,
  Wallet, Video, Music, GraduationCap // ✅ Nuevos iconos para los widgets
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

const MOODS = [
  { id: 'Fortaleza', label: 'Fortaleza', icon: Anchor, color: 'bg-blue-500' },
  { id: 'Gozo', label: 'Gozo', icon: Sun, color: 'bg-amber-500' },
  { id: 'Necesidad', label: 'Necesidad', icon: CloudRain, color: 'bg-slate-500' },
  { id: 'Paz', label: 'Paz', icon: Smile, color: 'bg-emerald-500' },
];

// --- 💬 SUB-COMPONENTE: PREVIEW DE COMENTARIOS (Sincronizado) ---
function CommentPreview({ postId, count, onClick }) {
  const [previewComments, setPreviewComments] = useState([]);
  const [realCount, setRealCount] = useState(count); 
  
  useEffect(() => {
    if (!postId) return;
    const qPreview = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'), limit(2));
    const unsubPreview = onSnapshot(qPreview, (snap) => setPreviewComments(snap.docs.map(d => d.data())));

    // ✅ FIX: Escuchamos el TAMAÑO REAL siempre para evitar el "0" falso
    const unsubCount = onSnapshot(collection(db, `posts/${postId}/comments`), (snap) => {
      setRealCount(snap.size);
    });

    return () => { unsubPreview(); unsubCount(); };
  }, [postId]);

  if (realCount === 0 && previewComments.length === 0) return null;

  return (
    <div className="mt-4 bg-slate-50/50 rounded-2xl p-4 border border-slate-100 cursor-pointer active:scale-[0.98] transition-all" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={12} className="text-brand-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">{realCount} Comentarios</span>
      </div>
      <div className="space-y-2">
        {previewComments.map((c, idx) => (
          <div key={idx} className="flex gap-2 text-left items-start">
            <span className="font-black text-[10px] text-slate-800 uppercase mt-0.5 whitespace-nowrap">{c.name?.split(' ')[0]}:</span>
            <span className="text-[11px] text-slate-500 line-clamp-1 font-medium">{c.text}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Toca para conversar</p>
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
    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  
  // ✅ DEFINICIÓN DE PERMISOS
  const isPastor = dbUser?.role === 'pastor';
  const isLider = dbUser?.role === 'lider';
  const isStaff = isPastor || isLider;
  const isAlabanza = dbUser?.area?.toLowerCase() === 'alabanza' || isPastor;
  const isMultimedia = dbUser?.area?.toLowerCase() === 'multimedia' || isPastor;
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

  // ✅ ACCESOS RÁPIDOS FILTRADOS (Punto 2)
  const quickActions = useMemo(() => {
    const actions = [
      { id: 'ofrendar', label: 'Ofrendar', icon: HandHeart, path: '/ofrendar', color: 'text-rose-600', bg: 'bg-rose-50', visible: true },
      { id: 'series', label: 'Series', icon: GraduationCap, path: '/estudio', color: 'text-emerald-600', bg: 'bg-emerald-50', visible: true },
      { id: 'agenda', label: 'Agenda', icon: Calendar, path: '/calendario', color: 'text-orange-600', bg: 'bg-orange-50', visible: isStaff },
      { id: 'servicios', label: 'Servicios', icon: Briefcase, path: '/servicios', color: 'text-blue-600', bg: 'bg-blue-50', visible: isStaff },
      { id: 'tesoreria', label: 'Tesorería', icon: Wallet, path: '/tesoreria', color: 'text-slate-900', bg: 'bg-slate-200', visible: isPastor },
      { id: 'cancionero', label: 'Canciones', icon: Music, path: '/apps', color: 'text-pink-600', bg: 'bg-pink-50', visible: isAlabanza },
    ];
    return actions.filter(a => a.visible);
  }, [isStaff, isPastor, isAlabanza]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // ✅ FILTRADO DE CONTENIDO PRIVADO
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

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-outfit relative">
      <TopBar />

      <div className="px-5 mt-6 space-y-6">
          {/* CUMPLEÑOS */}
          <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} 
               className={`p-1 rounded-[35px] transition-all active:scale-95 ${birthdays.length > 0 ? 'bg-gradient-to-r from-brand-500 to-indigo-500 shadow-xl' : 'bg-white border border-slate-100'}`}>
            <div className={`flex items-center justify-between p-4 rounded-[30px] ${birthdays.length > 0 ? 'bg-white/90 backdrop-blur-sm' : 'bg-white'}`}>
              <div className="flex items-center gap-4 text-left">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${birthdays.length > 0 ? 'bg-brand-600 animate-pulse' : 'bg-slate-100 text-slate-300'}`}>
                  <Cake size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase leading-none">Cumpleaños</p>
                  <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                    {birthdays.length > 0 ? `${birthdays.length} celebraciones hoy 🎂` : "Sin festejos hoy"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ WIDGETS DE ACCESO RÁPIDO (Segmentados) */}
          <div className="grid grid-cols-4 gap-3">
             {quickActions.map(action => (
               <button 
                key={action.id} 
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-2 group active:scale-90 transition-all"
               >
                 <div className={`w-full aspect-square rounded-[22px] ${action.bg} flex items-center justify-center shadow-sm border-2 border-white`}>
                    <action.icon className={`${action.color}`} size={24} strokeWidth={2.5} />
                 </div>
                 <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{action.label}</span>
               </button>
             ))}
          </div>

          {/* TABS MODERNAS */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {['Todo', 'Devocional', 'Oración', 'Noticia', 'Archivados'].map((cat) => {
              if (cat === 'Archivados' && !isPastor) return null;
              return (
                <button key={cat} onClick={() => { setFilter(cat); setVisibleCount(4); setSelectedMood(null); }} 
                  className={`py-3 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 whitespace-nowrap ${
                    filter === cat 
                    ? (cat === 'Oración' ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-slate-900 border-slate-900 text-white shadow-lg')
                    : 'bg-white text-slate-400 border-slate-50'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {filter === 'Devocional' && (
            <div className="flex gap-3 overflow-x-auto no-scrollbar px-1 animate-slide-up">
               {MOODS.map(m => (
                 <button key={m.id} onClick={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                  className={`flex flex-col items-center gap-2 transition-all active:scale-90 min-w-[70px] ${selectedMood === m.id ? 'scale-110' : 'opacity-40 grayscale'}`}
                 >
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg ${m.color}`}>
                      <m.icon size={20} />
                   </div>
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{m.label}</span>
                 </button>
               ))}
            </div>
          )}
      </div>

      <div className="space-y-10 px-0 sm:px-5 mt-10">
        {loading ? (
            <div className="px-5"><PostSkeleton /><PostSkeleton /></div>
        ) : displayedPosts.length === 0 ? (
            <div className="text-center py-24 opacity-30 flex flex-col items-center">
              <Sparkles size={64} className="mb-4 text-slate-300"/>
              <p className="font-black uppercase tracking-[0.3em] text-xs text-slate-400 text-center">Sin contenido por aquí</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const isDevocional = post.type === 'Devocional';
              const isOracion = post.type === 'Oración';
              const profileImg = (post.authorPhoto && post.authorPhoto.trim() !== "") 
                ? post.authorPhoto 
                : `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;

              return (
              <div key={post.id} className={`relative mx-4 transition-all group ${
                isDevocional ? 'h-[420px] rounded-[45px] overflow-hidden shadow-2xl' 
                : isOracion ? 'bg-purple-50 border-2 border-purple-100 rounded-[35px] p-1 shadow-sm'
                : 'bg-white border border-slate-100 rounded-[35px] shadow-sm'
              }`}>
                {isDevocional ? (
                  <div className="absolute inset-0 w-full h-full" onClick={() => navigate(`/post/${post.id}`)}>
                    {post.image ? <img src={post.image} className="w-full h-full object-cover" alt="Portada" referrerPolicy="no-referrer" /> : <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-brand-900" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="absolute inset-0 p-8 flex flex-col justify-end text-left">
                       <div className="flex items-center gap-2 mb-4">
                          <div className="px-3 py-1 bg-brand-500 rounded-full text-[8px] font-black text-white uppercase tracking-widest">Devocional</div>
                          {post.mood && <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[8px] font-black text-white uppercase tracking-widest">{post.mood}</div>}
                       </div>
                       <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-3 italic">{post.title}</h2>
                       <p className="text-white/80 text-sm font-medium line-clamp-2 mb-6 leading-relaxed">{post.content}</p>
                       <button className="bg-white text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                         <BookOpen size={16}/> Ver Devocional
                       </button>
                    </div>
                    <div className="absolute top-6 left-6 flex items-center gap-3">
                       <img src={profileImg} className="w-10 h-10 rounded-xl border-2 border-white/30" alt="autor" referrerPolicy="no-referrer" />
                       <span className="text-white text-[10px] font-black uppercase tracking-widest">{post.authorName.split(' ')[0]}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex items-center gap-3 text-left">
                          <div className="w-12 h-12 rounded-2xl border-2 border-white shadow-md overflow-hidden shrink-0 bg-slate-100">
                            <img src={profileImg} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" alt="Avatar"/>
                          </div>
                          <div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter leading-none">{post.authorName}</h3>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1.5 inline-block ${isOracion ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {isOracion ? 'Pedido de Oración' : post.role}
                            </span>
                          </div>
                      </div>
                      {isModerator && (
                        <div className="relative">
                          <button onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)} className="p-2 text-slate-300 bg-slate-50 rounded-xl active:text-slate-900"><MoreVertical size={20}/></button>
                          {menuOpenId === post.id && (
                            <div className="absolute right-0 top-12 bg-white shadow-2xl rounded-2xl border border-slate-100 py-2 w-52 z-50 animate-scale-in origin-top-right">
                              {isPastor && <button onClick={() => handleArchive(post.id, post.isArchived)} className="w-full text-left px-5 py-4 text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 flex items-center gap-3 border-b border-slate-50"><Archive size={14}/> {post.isArchived ? 'Desarchivar' : 'Archivar post'}</button>}
                              <button onClick={() => { setEditingPost(post); setIsModalOpen(true); setMenuOpenId(null); }} className="w-full text-left px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Edit3 size={14}/> Editar</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-left mb-4" onClick={() => navigate(`/post/${post.id}`)}>
                      {isOracion && <div className="text-purple-600 mb-2"><HandHeart size={24}/></div>}
                      <h2 className={`text-xl font-black uppercase tracking-tighter leading-tight mb-2 ${isOracion ? 'text-purple-900' : 'text-slate-900'}`}>{post.title}</h2>
                      <div className="text-[14px] text-slate-700 whitespace-pre-wrap leading-relaxed font-medium line-clamp-4">{post.content}</div>
                    </div>
                    {post.image && !isDevocional && (
                      <div className="mt-4 -mx-6 bg-slate-100 cursor-pointer overflow-hidden shadow-inner" onClick={() => navigate(`/post/${post.id}`)}>
                        <img src={post.image} className="w-full h-auto max-h-[400px] object-cover block" loading="lazy" referrerPolicy="no-referrer"/>
                      </div>
                    )}
                    <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
                  </div>
                )}

                {!isDevocional && (
                  <div className="px-6 py-5 border-t border-slate-100 bg-white/50 rounded-b-[35px]">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar pb-1">
                           {[ {e: '❤️'}, {e: '🔥'}, {e: '🙏'}, {e: '👍'}].map(item => {
                              const reactions = post.reactions || [];
                              const count = reactions.filter(r => r.emoji === item.e).length;
                              const isSelected = reactions.some(r => r.uid === currentUser?.uid && r.emoji === item.e);
                              return (
                                <button key={item.e} onClick={() => handleReaction(post.id, post.reactions, item.e)} 
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-75 shadow-sm border ${isSelected ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-100'}`}>
                                  <span className="text-lg">{item.e}</span>
                                  {count > 0 && <span className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{count}</span>}
                                </button>
                              )
                           })}
                        </div>
                        <button onClick={() => navigate(`/post/${post.id}`)} className="p-3 bg-brand-50 text-brand-600 rounded-2xl active:scale-95 transition-all relative">
                          <MessageCircle size={22} />
                          {post.commentsCount > 0 && <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{post.commentsCount}</span>}
                        </button>
                    </div>
                  </div>
                )}
              </div>
            )})
        )}

        {filteredPosts.length > visibleCount && !loading && (
          <button onClick={() => setVisibleCount(prev => prev + 4)} className="w-full py-8 flex flex-col items-center gap-2 group active:scale-95 transition-all">
            <div className="p-5 bg-white border-2 border-slate-100 rounded-full shadow-xl text-slate-300 group-hover:text-brand-600 group-hover:border-brand-100">
               <ChevronDown size={32} className="animate-bounce" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Ver más contenido</span>
          </button>
        )}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} 
          className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center active:scale-90 z-40 transition-all border-4 border-white">
          <PlusCircle size={32} />
        </button>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
    </div>
  );
}