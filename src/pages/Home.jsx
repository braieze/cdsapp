import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Cake, Megaphone, BookOpen, Send, PlusCircle, Trash2, Clock, Pin, Link as LinkIcon, ExternalLink, MessageCircle, MoreVertical, X, Edit3, AlertTriangle } from 'lucide-react';
import CreatePostModal from '../components/CreatePostModal';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, limit, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Home() {
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  const canCreatePost = dbUser?.role === 'pastor' || dbUser?.area === 'recepcion';
  const isPastor = dbUser?.role === 'pastor';
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todo');

  // --- NUEVO: ESTADO PARA CUMPLEAÑOS ---
  const [birthdays, setBirthdays] = useState([]);

  // Estados de Interfaz
  const [expandedPosts, setExpandedPosts] = useState(new Set()); 
  const [reactionPickerOpen, setReactionPickerOpen] = useState(null); 
  const [menuOpenId, setMenuOpenId] = useState(null); 
  
  // Modales de Acción
  const [editingPost, setEditingPost] = useState(null); 
  const [postToDelete, setPostToDelete] = useState(null); 
  const [readingPost, setReadingPost] = useState(null); 
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

  // 2. CARGAR Y CALCULAR CUMPLEAÑOS (NUEVO)
  useEffect(() => {
    // Escuchamos la colección de usuarios
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const today = new Date();
      // Obtenemos mes y día actual en formato "MM-DD" (Ej: "02-14" para 14 de febrero)
      // getMonth() devuelve 0-11, por eso sumamos 1. padStart agrega el 0 si es necesario.
      const currentMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const birthdayPeople = [];

      snapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.birthday) {
          // userData.birthday viene como "YYYY-MM-DD" (Ej: 2001-02-14)
          // Cortamos los últimos 5 caracteres para tener "MM-DD"
          const userMonthDay = userData.birthday.slice(5); 
          
          if (userMonthDay === currentMonthDay) {
            birthdayPeople.push(userData.displayName || 'Alguien');
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
      if (currentReactions[myIndex].emoji === emoji) {
        newReactions.splice(myIndex, 1); 
      } else {
        newReactions[myIndex].emoji = emoji; 
      }
    } else {
      newReactions.push({ uid: currentUser.uid, name: currentUser.displayName, photo: currentUser.photoURL, emoji: emoji });
    }
    await updateDoc(postRef, { reactions: newReactions });
    setReactionPickerOpen(null);
  };

  const handleConfirmDelete = async () => {
    if (postToDelete) {
      await deleteDoc(doc(db, 'posts', postToDelete.id));
      setPostToDelete(null); 
    }
  };

  const handleTogglePin = async (post) => {
    await updateDoc(doc(db, 'posts', post.id), { isPinned: !post.isPinned });
    setMenuOpenId(null);
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setIsModalOpen(true); 
    setMenuOpenId(null);
  };

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

  // Función auxiliar para texto de cumpleaños
  const getBirthdayText = () => {
    if (birthdays.length === 0) return "Nadie cumple años hoy";
    if (birthdays.length === 1) return `¡Feliz cumple ${birthdays[0]}! 🎂`;
    if (birthdays.length === 2) return `${birthdays[0]} y ${birthdays[1]}`;
    return `${birthdays[0]}, ${birthdays[1]} y ${birthdays.length - 2} más`;
  };

  return (
    <div className="pb-24 animate-fade-in relative min-h-screen bg-slate-50">
      
      {/* Widget Cumpleaños REAL */}
      <div className="bg-white p-4 mb-2 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-full text-white shadow-sm ${birthdays.length > 0 ? 'bg-gradient-to-tr from-brand-500 to-brand-400 animate-pulse' : 'bg-slate-300'}`}>
            <Cake size={22} />
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-800">Cumpleaños de hoy</p>
            <p className={`text-xs font-medium ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
              {getBirthdayText()}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 mb-2 hide-scrollbar">
        {['Todo', 'Noticia', 'Devocional', 'Urgente'].map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${filter === cat ? 'bg-brand-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{cat}</button>
        ))}
      </div>

      {/* FEED */}
      <div className="space-y-6 px-0 sm:px-4 mt-4">
        {loading && <div className="text-center py-10">Cargando...</div>}
        
        {filteredPosts.map(post => {
          const groupedReactions = getGroupedReactions(post.reactions);
          const isExpanded = expandedPosts.has(post.id);

          const ManagementMenu = () => (
             (isPastor || post.authorId === currentUser.uid) && (
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setMenuOpenId(post.id)} className="p-1 text-slate-300 hover:text-slate-600 transition-colors"><MoreVertical size={20}/></button>
                {menuOpenId === post.id && (
                  <div className="absolute right-0 top-6 bg-white shadow-xl rounded-xl border border-slate-100 py-1 w-40 z-20 animate-scale-in origin-top-right overflow-hidden">
                    {isPastor && (
                      <button onClick={() => handleTogglePin(post)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                        <Pin size={14} className={post.isPinned ? "fill-brand-600 text-brand-600" : ""}/> {post.isPinned ? 'Desfijar' : 'Fijar arriba'}
                      </button>
                    )}
                    <button onClick={() => handleEdit(post)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <Edit3 size={14}/> Editar
                    </button>
                    <button onClick={() => setPostToDelete(post)} className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
                      <Trash2 size={14}/> Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          );

          const SocialFooter = () => (
            <div className="px-4 py-3 border-t border-slate-50 flex flex-col gap-3">
              <div className="flex items-center justify-between relative">
                <div className="flex items-center flex-wrap gap-1.5">
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setReactionPickerOpen(reactionPickerOpen === post.id ? null : post.id); }} className="flex items-center justify-center border w-8 h-8 rounded-full transition-colors bg-white border-slate-200 text-slate-400 hover:bg-slate-50 active:scale-95 shadow-sm">
                      <span className="text-xs font-bold">😀+</span>
                    </button>
                    {reactionPickerOpen === post.id && (
                      <div className="absolute bottom-10 left-0 bg-white shadow-xl rounded-full p-2 flex gap-2 border border-slate-100 z-20 animate-scale-in">
                        {REACTION_TYPES.map(emoji => (
                          <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(post, emoji); }} className="text-xl hover:scale-125 transition-transform p-1">{emoji}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  {groupedReactions.map(([emoji, count]) => (
                    <button key={emoji} onClick={(e) => { e.stopPropagation(); setShowReactionsFor(post); }} className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-600 shadow-sm hover:bg-slate-50">
                      <span>{emoji}</span><span>{count}</span>
                    </button>
                  ))}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setReadingPost(post); }} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-600 transition-colors">
                  <MessageCircle size={18} /> Comentar
                </button>
              </div>
              <CommentPreview postId={post.id} onClick={() => setReadingPost(post)} />
            </div>
          );

          if (post.type === 'Devocional') {
            return (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mx-4 sm:mx-0 relative">
                 <div className="absolute top-3 right-3 z-10 bg-black/20 backdrop-blur-sm rounded-full p-0.5">
                    <ManagementMenu />
                 </div>
                <div onClick={() => setReadingPost(post)} className="cursor-pointer">
                  {post.image ? (
                    <div className="h-48 w-full bg-slate-200 relative">
                       <img src={post.image} className="w-full h-full object-cover" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                       <span className="absolute top-3 left-3 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/20">DEVOCIONAL</span>
                       <h2 className="absolute bottom-4 left-4 right-4 text-xl font-black text-white leading-tight drop-shadow-md">{post.title || 'Reflexión del día'}</h2>
                    </div>
                  ) : (
                    <div className="h-32 bg-gradient-to-r from-brand-600 to-purple-600 flex items-center justify-center relative p-6">
                      <BookOpen className="text-white/20 absolute right-4 top-4" size={80}/>
                      <h2 className="text-xl font-black text-white relative z-10 text-center">{post.title || 'Reflexión del día'}</h2>
                    </div>
                  )}
                  <div className="px-4 py-3">
                    <p className="text-sm text-slate-500 line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-2 mt-3 mb-1">
                      <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-5 h-5 rounded-full" />
                      <span className="text-xs font-bold text-slate-700">{post.authorName}</span>
                      <span className="text-[10px] text-slate-400">• {new Date(post.createdAt?.toDate()).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <SocialFooter />
              </div>
            );
          }

          return (
            <div key={post.id} className={`bg-white pt-4 sm:rounded-2xl shadow-sm border-y sm:border border-slate-100 relative ${post.type === 'Urgente' ? 'border-l-4 border-l-red-500' : ''} ${post.isPinned ? 'bg-slate-50/80' : ''}`}>
              {post.isPinned && <div className="absolute top-0 right-10 bg-slate-200 text-slate-500 px-2 py-0.5 rounded-bl-lg rounded-br-lg text-[9px] font-bold flex items-center gap-1"><Pin size={10} /> FIJADO</div>}
              <div className="flex justify-between items-start mb-3 px-4 pt-1">
                <div className="flex items-center gap-3">
                   <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-10 h-10 rounded-full border border-slate-100" />
                   <div>
                     <h3 className="text-sm font-bold text-slate-900">{post.authorName} <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{post.role}</span></h3>
                     <p className="text-[11px] text-slate-500">{new Date(post.createdAt?.toDate()).toLocaleDateString()}</p>
                   </div>
                </div>
                <ManagementMenu />
              </div>
              <div className="px-4 mb-3">
                <div className={`text-sm text-slate-800 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>{post.content}</div>
                {post.content.length > 150 && !isExpanded && <button onClick={() => toggleExpand(post.id)} className="text-brand-600 text-xs font-bold mt-1 hover:underline">Ver más...</button>}
                {post.content.length > 150 && isExpanded && <button onClick={() => toggleExpand(post.id)} className="text-slate-400 text-xs font-bold mt-2 hover:underline">Ver menos</button>}
                {post.tags?.map((tag, i) => <span key={i} className="inline-block mt-2 mr-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold">#{tag}</span>)}
              </div>
              {post.image && <div className="w-full mb-3 bg-slate-100 cursor-zoom-in" onClick={() => setFullImage(post.image)}><img src={post.image} className="w-full h-auto max-h-[400px] object-cover" /></div>}
              {post.link && (<div className="px-4 mb-3"><a href={post.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 p-3 rounded-xl transition-colors group"><span className="text-sm font-bold text-brand-700 flex items-center gap-2"><LinkIcon size={16} /> {post.linkText}</span><ExternalLink size={16} className="text-slate-400 group-hover:text-brand-500" /></a></div>)}
              {post.poll && (
                <div className="px-4 mb-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Encuesta</p>
                    {post.poll.options.map((opt, idx) => {
                      const totalVotes = post.poll.voters.length || 1; 
                      const percent = Math.round((opt.votes / totalVotes) * 100);
                      return (
                        <button key={idx} onClick={() => handleVote(post, idx)} disabled={post.poll.voters.includes(currentUser.uid)} className="w-full relative mb-2 h-8 rounded-lg overflow-hidden bg-white border border-slate-200 text-left hover:bg-slate-50 transition-colors">
                          <div className="absolute top-0 left-0 h-full bg-brand-100 transition-all duration-500" style={{ width: `${percent}%` }}></div>
                          <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-bold z-10 text-slate-700"><span>{opt.text}</span><span>{percent}%</span></div>
                        </button>
                      )
                    })}
                    <p className="text-[10px] text-slate-400 text-right">{post.poll.voters.length} votos</p>
                  </div>
                </div>
              )}
              <SocialFooter />
            </div>
          );
        })}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} className="fixed bottom-24 right-4 w-14 h-14 bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 z-40">
          <PlusCircle size={28} />
        </button>
      )}

      {/* MODALES */}
      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      {fullImage && <ImageModal src={fullImage} onClose={() => setFullImage(null)} />}
      {readingPost && <PostDetailModal post={readingPost} currentUser={currentUser} onClose={() => setReadingPost(null)} />}
      {showReactionsFor && <ReactionsListModal post={showReactionsFor} onClose={() => setShowReactionsFor(null)} />}
      
      {/* MODAL BORRAR */}
      {postToDelete && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-slide-up border border-slate-800">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="bg-red-500/10 p-2 rounded-full"><AlertTriangle size={24}/></div>
              <h3 className="font-bold text-lg text-white">¿Eliminar publicación?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">Esta acción no se puede deshacer. Se borrará permanentemente del muro.</p>
            <div className="flex gap-3">
              <button onClick={() => setPostToDelete(null)} className="flex-1 py-3 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-colors text-sm">Cancelar</button>
              <button onClick={handleConfirmDelete} className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors text-sm shadow-lg shadow-red-900/20">Sí, eliminar</button>
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
    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'), limit(2));
    const unsubscribe = onSnapshot(q, (snap) => setPreviewComments(snap.docs.map(d => d.data())));
    return () => unsubscribe();
  }, [postId]);
  if (previewComments.length === 0) return null;
  return (
    <div className="bg-slate-50/50 rounded-xl p-2 cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {previewComments.map((c, idx) => (
        <div key={idx} className="flex gap-2 mb-1 last:mb-0"><span className="font-bold text-xs text-slate-800 whitespace-nowrap">{c.name}:</span><span className="text-xs text-slate-600 line-clamp-1">{c.text}</span></div>
      ))}
      <div className="mt-1 text-[10px] font-bold text-brand-600">Ver todos los comentarios...</div>
    </div>
  );
}

function ReactionsListModal({ post, onClose }) {
  const reactions = post.reactions || [];
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4 max-h-[60vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2"><h3 className="font-bold text-slate-800">Reacciones</h3><button onClick={onClose} className="p-1 bg-slate-100 rounded-full"><X size={16}/></button></div>
        <div className="space-y-3">{reactions.length === 0 && <p className="text-sm text-slate-400 text-center">Nadie ha reaccionado aún.</p>}{reactions.map((r, idx) => (<div key={idx} className="flex items-center gap-3"><div className="relative"><img src={r.photo || `https://ui-avatars.com/api/?name=${r.name}`} className="w-8 h-8 rounded-full object-cover" /><span className="absolute -bottom-1 -right-1 text-xs">{r.emoji}</span></div><span className="text-sm font-medium text-slate-700">{r.name}</span></div>))}</div>
      </div>
    </div>
  );
}

function ImageModal({ src, onClose }) { return (<div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-2 animate-fade-in" onClick={onClose}><button className="absolute top-4 right-4 text-white bg-white/10 p-2 rounded-full"><X size={24}/></button><img src={src} className="max-w-full max-h-screen object-contain" /></div>); }

function PostDetailModal({ post, currentUser, onClose }) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  useEffect(() => { const q = query(collection(db, `posts/${post.id}/comments`), orderBy('createdAt', 'desc')); return onSnapshot(q, (snap) => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))); }, [post.id]);
  const sendComment = async () => { if(!commentText.trim()) return; await addDoc(collection(db, `posts/${post.id}/comments`), { text: commentText, uid: currentUser.uid, name: currentUser.displayName, photo: currentUser.photoURL, createdAt: serverTimestamp() }); setCommentText(''); };
  const deleteComment = async (id) => { if(confirm('Borrar comentario?')) await deleteDoc(doc(db, `posts/${post.id}/comments`, id)); };
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex sm:items-center justify-center animate-fade-in">
      <div className="bg-white w-full h-full sm:h-[85vh] sm:max-w-lg sm:rounded-2xl flex flex-col relative overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white sticky top-0 z-10"><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button><span className="font-bold text-sm text-slate-800">{post.type}</span><div className="w-8"></div></div>
        <div className="flex-1 overflow-y-auto p-0 pb-20">
          {post.type === 'Devocional' && (<>{post.image && <img src={post.image} className="w-full h-auto object-cover" />}<div className="p-5"><h1 className="text-2xl font-black text-slate-900 mb-4 leading-tight">{post.title}</h1><div className="flex items-center gap-3 mb-6"><img src={post.authorPhoto} className="w-10 h-10 rounded-full" /><div><p className="font-bold text-sm">{post.authorName}</p><p className="text-xs text-slate-500">{new Date(post.createdAt?.toDate()).toLocaleDateString()}</p></div></div><p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap mb-6">{post.content}</p></div><hr className="border-slate-100"/></>)}
          <div className="p-5"><h3 className="font-bold text-slate-800 mb-4">Comentarios ({comments.length})</h3><div className="space-y-4">{comments.map(c => (<div key={c.id} className="flex gap-3"><img src={c.photo} className="w-8 h-8 rounded-full" /><div className="flex-1 bg-slate-50 p-3 rounded-2xl rounded-tl-none"><div className="flex justify-between items-start"><span className="font-bold text-xs text-slate-700">{c.name}</span>{(c.uid === currentUser.uid || post.authorId === currentUser.uid) && <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>}</div><p className="text-sm text-slate-600 mt-1">{c.text}</p></div></div>))}</div></div>
        </div>
        <div className="p-3 border-t border-slate-100 bg-white absolute bottom-0 w-full flex gap-2 items-center"><input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Escribe un comentario..." className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-100"/><button onClick={sendComment} disabled={!commentText.trim()} className="p-2 bg-brand-600 text-white rounded-full disabled:opacity-50"><Send size={18}/></button></div>
      </div>
    </div>
  );
}