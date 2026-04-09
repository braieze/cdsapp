import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, BookOpen, Pin, Link as LinkIcon, ExternalLink, 
  MessageCircle, MoreVertical, X, Edit3, Trash2, 
  PlusCircle, AlertTriangle, Calendar, Heart, Send, 
  AlertCircle, CheckCircle, Flame, PrayingHand, ThumbsUp, 
  Archive, ChevronDown, Sparkles
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

// --- SUBCOMPONENTES REFINADOS ---

const PostSkeleton = () => (
  <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm animate-pulse mb-4">
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

function CommentPreview({ postId, onClick }) {
  const [previewComments, setPreviewComments] = useState([]);
  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'), limit(2));
    const unsubscribe = onSnapshot(q, (snap) => setPreviewComments(snap.docs.map(d => d.data())));
    return () => unsubscribe();
  }, [postId]);

  if (previewComments.length === 0) return null;
  return (
    <div className="bg-slate-50/80 rounded-2xl p-4 cursor-pointer hover:bg-slate-100 transition-colors mt-3 border border-slate-100" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {previewComments.map((c, idx) => (
        <div key={idx} className="flex gap-2 mb-2 last:mb-0 text-left items-start">
          <span className="font-black text-[10px] text-slate-800 uppercase mt-0.5 whitespace-nowrap">{c.name?.split(' ')[0]}:</span>
          <span className="text-xs text-slate-600 line-clamp-1 font-medium">{c.text}</span>
        </div>
      ))}
      <div className="mt-2 text-[9px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-1">
        <MessageCircle size={10}/> Ver conversación completa
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  
  const isModerator = dbUser?.role === 'pastor' || dbUser?.role === 'lider';
  const canCreatePost = isModerator || dbUser?.area === 'recepcion';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todo');
  const [visibleCount, setVisibleCount] = useState(4); // ✅ Paginación (Punto 5)
  const [birthdays, setBirthdays] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);

  // 1. CARGA DE POSTS (Excluyendo Archivados por defecto)
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Orden: Fijados arriba, luego por fecha
      postsData.sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. CARGA DE CUMPLEAÑOS
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

  const handleArchive = async (postId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'posts', postId), { isArchived: !currentStatus });
      setMenuOpenId(null);
    } catch (e) { console.error(e); }
  };

  const handleVote = async (post, optionIdx) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        const data = postDoc.data();
        const voteRecord = data.poll.votesDetails?.find(v => v.uid === currentUser.uid);
        let newOptions = [...data.poll.options];
        let newVoters = [...(data.poll.voters || [])];
        let newVotesDetails = [...(data.poll.votesDetails || [])];

        if (voteRecord) {
            const prevOptIdx = newOptions.findIndex(o => o.text === voteRecord.option);
            if (prevOptIdx !== -1) newOptions[prevOptIdx].votes = Math.max(0, newOptions[prevOptIdx].votes - 1);
            newVoters = newVoters.filter(id => id !== currentUser.uid);
            newVotesDetails = newVotesDetails.filter(v => v.uid !== currentUser.uid);
            if (data.poll.options[optionIdx].text !== voteRecord.option) {
                newOptions[optionIdx].votes += 1;
                newVoters.push(currentUser.uid);
                newVotesDetails.push({ uid: currentUser.uid, name: currentUser.displayName, option: data.poll.options[optionIdx].text });
            }
        } else {
            newOptions[optionIdx].votes += 1;
            newVoters.push(currentUser.uid);
            newVotesDetails.push({ uid: currentUser.uid, name: currentUser.displayName, option: data.poll.options[optionIdx].text });
        }
        transaction.update(postRef, { 'poll.options': newOptions, 'poll.voters': newVoters, 'poll.votesDetails': newVotesDetails });
      });
    } catch (e) { /* silent */ }
  };

  const handleReaction = async (postId, reactions, emoji) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', postId);
    const myIdx = (reactions || []).findIndex(r => r.uid === currentUser.uid);
    let newReactions = [...(reactions || [])];
    
    if (myIdx >= 0) {
      if (newReactions[myIdx].emoji === emoji) newReactions.splice(myIdx, 1);
      else newReactions[myIdx].emoji = emoji;
    } else {
      newReactions.push({ uid: currentUser.uid, name: currentUser.displayName, emoji });
    }
    await updateDoc(postRef, { reactions: newReactions });
  };

  // ✅ FILTRADO INTELIGENTE (Punto 5)
  const filteredPosts = useMemo(() => {
    let result = posts;
    if (filter === 'Archivados') {
      result = posts.filter(p => p.isArchived === true);
    } else {
      result = posts.filter(p => p.isArchived !== true);
      if (filter !== 'Todo') result = result.filter(p => p.type === filter);
    }
    return result;
  }, [filter, posts]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-outfit relative">
      <TopBar />

      <div className="px-5 mt-6 space-y-5">
          {/* CUMPLEÑOS (Punto 1) */}
          <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} 
               className={`p-1 rounded-[35px] transition-all active:scale-95 ${birthdays.length > 0 ? 'bg-gradient-to-r from-brand-500 to-indigo-500 shadow-xl shadow-brand-100' : 'bg-white border border-slate-100'}`}>
            <div className={`flex items-center justify-between p-4 rounded-[30px] ${birthdays.length > 0 ? 'bg-white/90 backdrop-blur-sm' : 'bg-white'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white ${birthdays.length > 0 ? 'bg-brand-600 animate-pulse' : 'bg-slate-100 text-slate-300'}`}>
                  <Cake size={28} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">Cumpleaños</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                    {birthdays.length > 0 ? `${birthdays.length} celebraciones hoy 🎂` : "Sin festejos hoy"}
                  </p>
                </div>
              </div>
              {birthdays.length > 0 && <div className="p-2 bg-brand-50 rounded-full text-brand-600"><ChevronDown size={20}/></div>}
            </div>
          </div>

          {/* TABS CUADRADAS Y SÓLIDAS (Punto 5) */}
          <div className="grid grid-cols-4 gap-2">
            {['Todo', 'Devocional', 'Noticia', 'Archivados'].map((cat) => (
              <button key={cat} onClick={() => { setFilter(cat); setVisibleCount(4); }} 
                className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                  filter === cat 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-95' 
                  : 'bg-white text-slate-400 border-slate-50 shadow-sm'
                }`}
              >
                {cat === 'Archivados' ? <Archive size={14} className="mx-auto mb-1"/> : null}
                {cat}
              </button>
            ))}
          </div>
      </div>

      <div className="space-y-8 px-0 sm:px-5 mt-8">
        {loading ? (
            <div className="px-5"><PostSkeleton /><PostSkeleton /></div>
        ) : displayedPosts.length === 0 ? (
            <div className="text-center py-24 opacity-30 flex flex-col items-center">
              <Sparkles size={64} className="mb-4"/>
              <p className="font-black uppercase tracking-[0.3em] text-xs">Muro en paz</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const isDevocional = post.type === 'Devocional';
              const myVote = post.poll?.votesDetails?.find(v => v.uid === currentUser.uid);
              const profileImg = (post.authorPhoto && post.authorPhoto.trim() !== "") 
                ? post.authorPhoto 
                : `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;

              return (
              <div key={post.id} className={`relative transition-all ${
                isDevocional 
                ? 'bg-gradient-to-b from-indigo-50/50 to-white border-x-4 border-indigo-200 rounded-[45px] mx-4 p-1 shadow-2xl shadow-indigo-100/50' 
                : 'bg-white border-y sm:border border-slate-100 sm:rounded-[35px]'
              }`}>
                
                {post.isPinned && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white px-4 py-1 rounded-full text-[8px] font-black tracking-widest shadow-xl z-10 flex items-center gap-1.5"><Pin size={10} fill="white"/> CONTENIDO FIJADO</div>}

                <div className="p-6">
                  {/* HEADER POST */}
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-4 text-left">
                        {/* ✅ FIX ANDROID: CONTENEDOR RÍGIDO (Punto 8) */}
                        <div className="w-14 h-14 min-w-[56px] rounded-2xl border-2 border-white shadow-xl overflow-hidden bg-slate-100 shrink-0">
                          <img src={profileImg} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" alt="Avatar"/>
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter leading-none">{post.authorName}</h3>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1.5 inline-block ${isDevocional ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {isDevocional ? 'Palabra de Vida' : post.role}
                          </span>
                        </div>
                    </div>
                    
                    {(isModerator || post.authorId === currentUser?.uid) && (
                      <div className="relative">
                        <button onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)} className="p-2 text-slate-300 active:text-slate-900 bg-slate-50 rounded-xl"><MoreVertical size={20}/></button>
                        {menuOpenId === post.id && (
                          <div className="absolute right-0 top-12 bg-white shadow-2xl rounded-2xl border border-slate-100 py-2 w-52 z-50 animate-scale-in origin-top-right overflow-hidden">
                            {isModerator && (
                              <button onClick={async () => { await updateDoc(doc(db, 'posts', post.id), { isPinned: !post.isPinned }); setMenuOpenId(null); }} className="w-full text-left px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                                <Pin size={14} className={post.isPinned ? "text-brand-600" : ""}/> {post.isPinned ? 'Quitar de arriba' : 'Fijar al inicio'}
                              </button>
                            )}
                            <button onClick={() => { setEditingPost(post); setIsModalOpen(true); setMenuOpenId(null); }} className="w-full text-left px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                              <Edit3 size={14}/> Editar contenido
                            </button>
                            <button onClick={() => handleArchive(post.id, post.isArchived)} className="w-full text-left px-5 py-4 text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 flex items-center gap-3 border-b border-slate-50">
                              <Archive size={14}/> {post.isArchived ? 'Desarchivar' : 'Archivar post'}
                            </button>
                            <button onClick={async () => { if(window.confirm('¿Eliminar para siempre?')){ await deleteDoc(doc(db, 'posts', post.id)); } setMenuOpenId(null); }} className="w-full text-left px-5 py-4 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 flex items-center gap-3">
                              <Trash2 size={14}/> Borrar definitivamente
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CUERPO POST */}
                  <div className="cursor-pointer text-left group" onClick={() => navigate(`/post/${post.id}`)}>
                    {isDevocional && (
                      <div className="flex items-center gap-2 mb-3 text-indigo-600">
                        <BookOpen size={20} />
                        <h2 className="text-2xl font-black uppercase tracking-tighter leading-tight italic">{post.title}</h2>
                      </div>
                    )}
                    <div className={`text-[15px] text-slate-800 whitespace-pre-wrap leading-relaxed font-medium tracking-tight ${!isDevocional ? 'line-clamp-6' : ''}`}>
                      {post.content}
                    </div>
                  </div>

                  {post.image && (
                    <div className="mt-5 -mx-6 bg-slate-100 cursor-pointer min-h-[220px] flex items-center justify-center overflow-hidden relative shadow-inner" onClick={() => navigate(`/post/${post.id}`)}>
                      <img src={post.image} className="w-full h-auto max-h-[550px] object-cover block" loading="lazy" referrerPolicy="no-referrer" alt="Imagen Post"/>
                    </div>
                  )}
                  
                  {post.link && (
                    <button onClick={(e) => { e.stopPropagation(); window.open(post.link.startsWith('http') ? post.link : `https://${post.link}`, '_blank'); }} 
                            className="mt-4 flex items-center justify-between w-full bg-slate-900 text-white p-5 rounded-2xl active:scale-95 transition-all shadow-xl shadow-slate-200">
                      <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                        <LinkIcon size={16} className="text-brand-400" /> {post.linkText || 'Seguir leyendo'}
                      </span>
                      <ExternalLink size={14} className="opacity-50" />
                    </button>
                  )}

                  {/* ENCUESTAS */}
                  {post.poll && (
                    <div className="mt-5 bg-slate-50 rounded-[28px] p-5 border-2 border-slate-100 shadow-inner">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">📊 Encuesta de la iglesia</p>
                      <div className="space-y-3">
                        {post.poll.options.map((opt, idx) => {
                          const total = post.poll.voters?.length || 0;
                          const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                          const isMyOption = myVote?.option === opt.text;
                          return (
                            <button key={idx} onClick={() => handleVote(post, idx)} className="w-full relative h-12 rounded-xl overflow-hidden bg-white border border-slate-200 active:scale-98 transition-all">
                              <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ${isMyOption ? 'bg-brand-500/20' : 'bg-slate-100'}`} style={{ width: `${percent}%` }}></div>
                              <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-black uppercase z-10 text-slate-700">
                                <span className="flex items-center gap-2">{opt.text} {isMyOption && <CheckCircle size={14} className="text-brand-600"/>}</span>
                                <span className="opacity-40">{percent}%</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* REACCIONES FIJAS (Punto 5) */}
                  <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                          {/* Botones de Reacción Directos */}
                          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 gap-1 shrink-0">
                            {[ {e: '❤️', l: 'Amor'}, {e: '🔥', l: 'Fuego'}, {e: '🙏', l: 'Amén'}, {e: '👍', l: 'Like'}].map(item => {
                              const reactions = post.reactions || [];
                              const isSelected = reactions.some(r => r.uid === currentUser.uid && r.emoji === item.e);
                              return (
                                <button key={item.e} onClick={() => handleReaction(post.id, post.reactions, item.e)} 
                                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-75 ${isSelected ? 'bg-white shadow-md scale-110' : 'grayscale opacity-60 hover:grayscale-0'}`}>
                                  <span className="text-xl">{item.e}</span>
                                </button>
                              )
                            })}
                          </div>
                          
                          {/* Contadores */}
                          {Object.entries(post.reactions?.reduce((acc, r) => ({...acc, [r.emoji]: (acc[r.emoji] || 0) + 1}), {}) || {}).map(([emoji, count]) => (
                              <div key={emoji} className="bg-white border border-brand-50 px-2.5 py-1.5 rounded-xl text-[11px] font-black text-slate-700 flex items-center gap-1 shadow-sm shrink-0">
                                {emoji} <span className="text-brand-600">{count}</span>
                              </div>
                          ))}
                      </div>

                      <button onClick={() => navigate(`/post/${post.id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-600 bg-brand-50 px-4 py-2.5 rounded-xl active:scale-95 transition-all">
                        <MessageCircle size={16} /> {post.commentsCount > 0 ? post.commentsCount : ''} Comentar
                      </button>
                    </div>
                    
                    <CommentPreview postId={post.id} onClick={() => navigate(`/post/${post.id}`)} />
                  </div>
                </div>
              </div>
            )})
        )}

        {/* BOTÓN CARGAR MÁS (Punto 5) */}
        {filteredPosts.length > visibleCount && !loading && (
          <button onClick={() => setVisibleCount(prev => prev + 4)} className="w-full py-6 flex flex-col items-center gap-2 group active:scale-95 transition-all">
            <div className="p-4 bg-white border border-slate-200 rounded-full shadow-lg text-slate-400 group-hover:text-brand-600">
               <ChevronDown size={28} className="animate-bounce" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Cargar más bendiciones</span>
          </button>
        )}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} 
          className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[26px] shadow-2xl flex items-center justify-center active:scale-90 z-40 transition-all border-4 border-white">
          <PlusCircle size={32} />
        </button>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
    </div>
  );
}