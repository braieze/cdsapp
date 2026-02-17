import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { Cake, BookOpen, Pin, Link as LinkIcon, ExternalLink, MessageCircle, MoreVertical, X, Edit3, Trash2, PlusCircle, AlertTriangle, Calendar, Heart, Send } from 'lucide-react';
import CreatePostModal from '../components/CreatePostModal';
import TopBar from '../components/TopBar'; 
import BirthdayModal from '../components/BirthdayModal';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, limit } from 'firebase/firestore';

// --- SKELETON LOADER ---
const PostSkeleton = () => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-pulse mb-4">
    <div className="flex gap-3 mb-4">
      <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
      <div className="flex-1 space-y-2 py-2">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-slate-200 rounded w-full"></div>
      <div className="h-4 bg-slate-200 rounded w-5/6"></div>
    </div>
  </div>
);

// --- EMPTY STATE ---
const EmptyState = () => (
  <div className="text-center py-16 px-6 flex flex-col items-center opacity-60">
    <div className="bg-slate-100 p-6 rounded-full mb-4">
      <Heart size={48} className="text-slate-300" fill="currentColor" />
    </div>
    <h3 className="text-lg font-black text-slate-700">¡El muro está tranquilo!</h3>
    <p className="text-sm text-slate-500 mt-2 max-w-xs">Aún no hay publicaciones recientes.</p>
  </div>
);

export default function Home() {
  const navigate = useNavigate(); 
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  const canCreatePost = dbUser?.role === 'pastor' || dbUser?.area === 'recepcion';
  const isPastor = dbUser?.role === 'pastor';
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todo');
  const [birthdays, setBirthdays] = useState([]);

  // Estados de Interfaz
  const [expandedPosts, setExpandedPosts] = useState(new Set()); 
  const [reactionPickerOpen, setReactionPickerOpen] = useState(null); 
  const [menuOpenId, setMenuOpenId] = useState(null); 
  
  // Modales de Acción
  const [editingPost, setEditingPost] = useState(null); 
  const [postToDelete, setPostToDelete] = useState(null); 
  const [fullImage, setFullImage] = useState(null); 
  const [showReactionsFor, setShowReactionsFor] = useState(null);

  const REACTION_TYPES = ['👍', '❤️', '🔥', '🙏', '😢', '😂'];

  // 1. CARGAR POSTS
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      postsData.sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. CARGAR CUMPLEAÑOS
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const today = new Date();
      const currentMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const birthdayPeople = [];
      snapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.birthday) {
          const userMonthDay = userData.birthday.slice(5); 
          if (userMonthDay === currentMonthDay) {
            birthdayPeople.push({
                id: doc.id,
                displayName: userData.displayName || 'Alguien',
                photoURL: userData.photoURL,
                phone: userData.phone
            });
          }
        }
      });
      setBirthdays(birthdayPeople);
    });
    return () => unsubscribe();
  }, []);

  // Cierra menú si clicamos fuera
  useEffect(() => {
    const closeMenu = () => setMenuOpenId(null);
    if (menuOpenId) window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [menuOpenId]);

  const handleLinkClick = (e, url) => {
    e.preventDefault(); e.stopPropagation(); 
    if (!url) return;
    if (url.startsWith('/')) { navigate(url); } else { window.open(url, '_blank', 'noopener,noreferrer'); }
  };

  const toggleExpand = (postId) => {
    const newSet = new Set(expandedPosts);
    newSet.has(postId) ? newSet.delete(postId) : newSet.add(postId);
    setExpandedPosts(newSet);
  };

  const handleReaction = async (post, emoji) => {
    const postRef = doc(db, 'posts', post.id);
    const currentReactions = post.reactions || []; 
    const myIndex = currentReactions.findIndex(r => r.uid === currentUser.uid);
    let newReactions = [...currentReactions];
    if (myIndex >= 0) {
      if (currentReactions[myIndex].emoji === emoji) { newReactions.splice(myIndex, 1); } else { newReactions[myIndex].emoji = emoji; }
    } else {
      newReactions.push({ uid: currentUser.uid, name: currentUser.displayName, photo: currentUser.photoURL, emoji: emoji });
    }
    await updateDoc(postRef, { reactions: newReactions });
    setReactionPickerOpen(null);
  };

  const handleConfirmDelete = async () => {
    if (postToDelete) { await deleteDoc(doc(db, 'posts', postToDelete.id)); setPostToDelete(null); }
  };

  const handleTogglePin = async (post) => {
    await updateDoc(doc(db, 'posts', post.id), { isPinned: !post.isPinned }); setMenuOpenId(null);
  };

  const handleEdit = (post) => { setEditingPost(post); setIsModalOpen(true); setMenuOpenId(null); };

  const handleVote = async (post, optionIndex) => {
    if (post.poll.voters.includes(currentUser.uid)) return alert('Ya votaste.');
    const newOptions = [...post.poll.options];
    newOptions[optionIndex].votes += 1;
    const newVoters = [...post.poll.voters, currentUser.uid];
    await updateDoc(doc(db, 'posts', post.id), { poll: { ...post.poll, options: newOptions, voters: newVoters } });
  };

  const filteredPosts = filter === 'Todo' ? posts : posts.filter(post => post.type === filter);

  const getGroupedReactions = (reactions = []) => {
    const groups = {};
    reactions.forEach(r => { groups[r.emoji] = (groups[r.emoji] || 0) + 1; });
    return Object.entries(groups); 
  };

  const getBirthdayText = () => {
    if (birthdays.length === 0) return "Nadie cumple años hoy";
    const names = birthdays.map(b => b.displayName.split(' ')[0]);
    if (names.length === 1) return `¡Feliz cumple ${names[0]}! 🎂`;
    if (names.length === 2) return `${names[0]} y ${names[1]}`;
    return `${names[0]}, ${names[1]} y ${names.length - 2} más`;
  };

  return (
    <div className="pb-28 animate-fade-in relative min-h-screen bg-slate-50">
      <TopBar />

      <div className="px-4 mt-4">
          <div 
            onClick={() => { if (birthdays.length > 0) setIsBirthdayModalOpen(true); }}
            className={`bg-white p-5 mb-6 border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm transition-all ${birthdays.length > 0 ? 'cursor-pointer hover:bg-slate-50 hover:shadow-md active:scale-[0.98]' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full text-white shadow-sm ${birthdays.length > 0 ? 'bg-gradient-to-tr from-brand-500 to-brand-400 animate-pulse' : 'bg-slate-300'}`}>
                <Cake size={26} />
              </div>
              <div>
                <p className="text-base font-black text-slate-800">Cumpleaños de hoy</p>
                <p className={`text-sm font-medium ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                  {getBirthdayText()}
                </p>
              </div>
            </div>
            {birthdays.length > 0 && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Ver</span>}
          </div>

          <div className="flex gap-3 overflow-x-auto py-2 mb-4 hide-scrollbar">
            {['Todo', 'Noticia', 'Devocional', 'Urgente'].map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-5 py-2.5 text-sm font-bold rounded-full transition-colors shadow-sm ${filter === cat ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{cat}</button>
            ))}
          </div>
      </div>

      <div className="space-y-6 px-0 sm:px-4 mt-2">
        {loading ? (
            <div className="px-4">
                <PostSkeleton />
                <PostSkeleton />
            </div>
        ) : filteredPosts.length === 0 ? (
            <EmptyState />
        ) : (
            filteredPosts.map(post => {
              const groupedReactions = getGroupedReactions(post.reactions);
              const isExpanded = expandedPosts.has(post.id);

              const ManagementMenu = () => (
                  (isPastor || post.authorId === currentUser.uid) && (
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setMenuOpenId(post.id)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors bg-white/50 rounded-full"><MoreVertical size={24}/></button>
                    {menuOpenId === post.id && (
                      <div className="absolute right-0 top-8 bg-white shadow-xl rounded-xl border border-slate-100 py-1 w-44 z-20 animate-scale-in origin-top-right overflow-hidden">
                        {isPastor && (
                          <button onClick={() => handleTogglePin(post)} className="w-full text-left px-4 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                            <Pin size={18} className={post.isPinned ? "fill-brand-600 text-brand-600" : ""}/> {post.isPinned ? 'Desfijar' : 'Fijar arriba'}
                          </button>
                        )}
                        <button onClick={() => handleEdit(post)} className="w-full text-left px-4 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                          <Edit3 size={18}/> Editar
                        </button>
                        <button onClick={() => setPostToDelete(post)} className="w-full text-left px-4 py-3.5 text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-3">
                          <Trash2 size={18}/> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                )
              );

              const SocialFooter = () => (
                <div className="px-5 py-4 border-t border-slate-50 flex flex-col gap-4">
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center flex-wrap gap-2">
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setReactionPickerOpen(reactionPickerOpen === post.id ? null : post.id); }} className="flex items-center justify-center border w-10 h-10 rounded-full transition-colors bg-white border-slate-200 text-slate-400 hover:bg-slate-50 active:scale-95 shadow-sm">
                          <span className="text-lg">😀+</span>
                        </button>
                        {reactionPickerOpen === post.id && (
                          <div className="absolute bottom-12 left-0 bg-white shadow-xl rounded-full p-2 flex gap-2 border border-slate-100 z-20 animate-scale-in">
                            {REACTION_TYPES.map(emoji => (
                              <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(post, emoji); }} className="text-2xl hover:scale-125 transition-transform p-1.5">{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {groupedReactions.map(([emoji, count]) => (
                        <button key={emoji} onClick={(e) => { e.stopPropagation(); setShowReactionsFor(post); }} className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                          <span className="text-base">{emoji}</span><span>{count}</span>
                        </button>
                      ))}
                    </div>
                    {/* ✅ UNIFICACIÓN: Ahora navega a la página de detalle */}
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.id}`); }} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-600 transition-colors px-2 py-1 rounded-lg hover:bg-slate-50">
                      <MessageCircle size={22} /> Comentar
                    </button>
                  </div>
                  {/* ✅ UNIFICACIÓN: Click en la previsualización también navega */}
                  <CommentPreview postId={post.id} onClick={() => navigate(`/post/${post.id}`)} />
                </div>
              );

              if (post.type === 'Devocional') {
                return (
                  <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mx-4 sm:mx-0 relative">
                     <div className="absolute top-4 right-4 z-10"><ManagementMenu /></div>
                    {/* ✅ UNIFICACIÓN: Click en la tarjeta navega a la página */}
                    <div onClick={() => navigate(`/post/${post.id}`)} className="cursor-pointer">
                      {post.image ? (
                        <div className="h-56 w-full bg-slate-200 relative">
                            <img src={post.image} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                            <span className="absolute top-4 left-4 bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded border border-white/20 uppercase tracking-widest">DEVOCIONAL</span>
                            <h2 className="absolute bottom-5 left-5 right-5 text-2xl font-black text-white leading-tight drop-shadow-md">{post.title || 'Reflexión del día'}</h2>
                        </div>
                      ) : (
                        <div className="h-40 bg-gradient-to-r from-brand-600 to-purple-600 flex items-center justify-center relative p-6">
                          <BookOpen className="text-white/20 absolute right-4 top-4" size={100}/>
                          <h2 className="text-2xl font-black text-white relative z-10 text-center px-4">{post.title || 'Reflexión del día'}</h2>
                        </div>
                      )}
                      <div className="px-5 py-4">
                        <p className="text-base text-slate-600 line-clamp-3 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                        <div className="flex items-center gap-3 mt-4 mb-2">
                          <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-8 h-8 rounded-full" />
                          <div>
                              <p className="text-sm font-bold text-slate-800">{post.authorName}</p>
                              <p className="text-xs text-slate-400">{new Date(post.createdAt?.toDate()).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {post.link && (
                            <div className="mt-5">
                                <button onClick={(e) => handleLinkClick(e, post.link)} className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold shadow-md hover:bg-black transition-colors flex items-center justify-center gap-2">
                                    {post.link.startsWith('/') ? <Calendar size={18}/> : <ExternalLink size={18}/>} {post.linkText || 'Ver más'}
                                </button>
                            </div>
                        )}
                      </div>
                    </div>
                    <SocialFooter />
                  </div>
                );
              }

              return (
                <div key={post.id} className={`bg-white pt-5 sm:rounded-2xl shadow-sm border-y sm:border border-slate-100 relative ${post.type === 'Urgente' ? 'border-l-4 border-l-red-500' : ''} ${post.isPinned ? 'bg-slate-50/80' : ''}`}>
                  {post.isPinned && <div className="absolute top-0 right-12 bg-slate-200 text-slate-500 px-3 py-1 rounded-b-lg text-[10px] font-bold flex items-center gap-1 shadow-sm"><Pin size={12} /> FIJADO</div>}
                  <div className="flex justify-between items-start mb-4 px-5 pt-1">
                    <div className="flex items-center gap-3">
                        <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-12 h-12 rounded-full border border-slate-100 shadow-sm" />
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{post.authorName} <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase ml-1 align-middle">{post.role}</span></h3>
                          <p className="text-xs text-slate-500 mt-0.5">{new Date(post.createdAt?.toDate()).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <ManagementMenu />
                  </div>
                  {/* ✅ UNIFICACIÓN: El contenido de la noticia también lleva al detalle */}
                  <div className="px-5 mb-4 cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                    <div className={`text-base text-slate-800 whitespace-pre-wrap leading-relaxed ${isExpanded ? '' : 'line-clamp-4'}`}>{post.content}</div>
                    {post.content.length > 200 && !isExpanded && <button onClick={(e) => { e.stopPropagation(); toggleExpand(post.id); }} className="text-brand-600 text-sm font-bold mt-2 hover:underline">Leer más...</button>}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {post.tags?.map((tag, i) => <span key={i} className="inline-block text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg font-bold">#{tag}</span>)}
                    </div>
                  </div>
                  {post.image && <div className="w-full mb-4 bg-slate-100 cursor-zoom-in" onClick={() => setFullImage(post.image)}><img src={post.image} className="w-full h-auto max-h-[500px] object-cover" /></div>}
                  {post.link && (
                      <div className="px-5 mb-4">
                          <button onClick={(e) => handleLinkClick(e, post.link)} className="flex items-center justify-between w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 p-4 rounded-xl transition-colors group">
                              <span className="text-sm font-bold text-brand-700 flex items-center gap-3">{post.link.startsWith('/') ? <LinkIcon size={20} /> : <ExternalLink size={20} />} {post.linkText}</span>
                              <ExternalLink size={20} className="text-slate-400 group-hover:text-brand-500" />
                          </button>
                      </div>
                  )}
                  {post.poll && (
                    <div className="px-5 mb-4">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-3">Encuesta</p>
                        {post.poll.options.map((opt, idx) => {
                          const totalVotes = post.poll.voters.length || 1; 
                          const percent = Math.round((opt.votes / totalVotes) * 100);
                          return (
                            <button key={idx} onClick={() => handleVote(post, idx)} disabled={post.poll.voters.includes(currentUser.uid)} className="w-full relative mb-3 h-10 rounded-lg overflow-hidden bg-white border border-slate-200 text-left hover:bg-slate-50 transition-colors shadow-sm">
                              <div className="absolute top-0 left-0 h-full bg-brand-100 transition-all duration-500" style={{ width: `${percent}%` }}></div>
                              <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-bold z-10 text-slate-700"><span>{opt.text}</span><span>{percent}%</span></div>
                            </button>
                          )
                        })}
                        <p className="text-xs text-slate-400 text-right mt-2">{post.poll.voters.length} votos totales</p>
                      </div>
                    </div>
                  )}
                  <SocialFooter />
                </div>
              );
            })
        )}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} className="fixed bottom-28 right-5 w-16 h-16 bg-brand-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 z-40 transition-transform">
          <PlusCircle size={32} />
        </button>
      )}

      {/* MODALES ACTIVOS */}
      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      {fullImage && <ImageModal src={fullImage} onClose={() => setFullImage(null)} />}
      
      {showReactionsFor && <ReactionsListModal post={showReactionsFor} onClose={() => setShowReactionsFor(null)} />}
      
      <BirthdayModal 
        isOpen={isBirthdayModalOpen} 
        onClose={() => setIsBirthdayModalOpen(false)} 
        users={birthdays}
      />

      {postToDelete && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scale-in border border-slate-800">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="bg-red-500/10 p-3 rounded-full"><AlertTriangle size={28}/></div>
              <h3 className="font-bold text-xl text-white">¿Eliminar publicación?</h3>
            </div>
            <p className="text-slate-400 text-base mb-8 leading-relaxed">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setPostToDelete(null)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-colors text-sm">Cancelar</button>
              <button onClick={handleConfirmDelete} className="flex-1 py-3.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors text-sm shadow-lg shadow-red-900/20">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUBCOMPONENTES ---

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
    <div className="bg-slate-50/50 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors mt-2" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {previewComments.map((c, idx) => (
        <div key={idx} className="flex gap-2 mb-1.5 last:mb-0"><span className="font-bold text-sm text-slate-800 whitespace-nowrap">{c.name}:</span><span className="text-sm text-slate-600 line-clamp-1">{c.text}</span></div>
      ))}
      <div className="mt-2 text-xs font-bold text-brand-600">Ver todos los comentarios...</div>
    </div>
  );
}

function ReactionsListModal({ post, onClose }) {
  const reactions = post.reactions || [];
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-2xl p-0 max-h-[60vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-white"><h3 className="font-bold text-lg text-slate-800">Reacciones</h3><button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button></div>
        <div className="space-y-4 p-4 overflow-y-auto">
            {reactions.length === 0 && <p className="text-base text-slate-400 text-center py-8">Nadie ha reaccionado aún.</p>}
            {reactions.map((r, idx) => (
                <div key={idx} className="flex items-center gap-4">
                    <div className="relative"><img src={r.photo || `https://ui-avatars.com/api/?name=${r.name}`} className="w-10 h-10 rounded-full object-cover" /><span className="absolute -bottom-1 -right-1 text-base shadow-sm bg-white rounded-full">{r.emoji}</span></div>
                    <span className="text-base font-medium text-slate-700">{r.name}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function ImageModal({ src, onClose }) { return (<div className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center p-2 animate-fade-in" onClick={onClose}><button className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full hover:bg-white/20 transition-colors"><X size={28}/></button><img src={src} className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl" /></div>); }