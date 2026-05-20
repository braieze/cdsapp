import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, MessageCircle, MoreVertical, PlusCircle, Trash2, 
  Archive, Pin, ChevronDown, Sparkles, BellRing, X
} from 'lucide-react';
import Topbar from '../components/TopBar';
import CreatePostModal from '../components/CreatePostModal';
import BirthdayModal from '../components/BirthdayModal';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  deleteDoc, doc, updateDoc, limit, setDoc
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ONESIGNAL_CONFIG } from '../oneSignalConfig';

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
    <div className="mt-3 cursor-pointer bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <p className="text-xs text-slate-500 font-bold mb-1.5 hover:text-slate-700 transition-colors">Ver los {realCount} comentarios</p>
      <div className="space-y-1.5">
        {previewComments.map((c, idx) => (
          <div key={idx} className="flex gap-2 text-left items-start text-[13px] leading-tight">
            <span className="font-bold text-slate-900 shrink-0">{c.name?.split(' ')[0]}</span>
            <span className="text-slate-600 line-clamp-1">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 👥 NUEVO SUB-COMPONENTE: MODAL DE LISTA DE REACCIONES ---
function ReactionsListModal({ isOpen, onClose, reactions = [] }) {
  const [activeTab, setActiveTab] = useState('Todas');
  
  if (!isOpen) return null;

  // Extraer emojis únicos usados en este post
  const usedEmojis = [...new Set(reactions.map(r => r.emoji))];
  
  // Filtrar lista según la pestaña
  const displayedReactions = activeTab === 'Todas' 
    ? reactions 
    : reactions.filter(r => r.emoji === activeTab);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] shadow-2xl animate-slide-up flex flex-col h-[65vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Reacciones</h3>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={18}/></button>
        </div>

        {/* Tabs */}
        {usedEmojis.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 border-b border-slate-50 shrink-0">
            <button 
              onClick={() => setActiveTab('Todas')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'Todas' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Todas {reactions.length}
            </button>
            {usedEmojis.map(emoji => {
              const count = reactions.filter(r => r.emoji === emoji).length;
              return (
                <button 
                  key={emoji} 
                  onClick={() => setActiveTab(emoji)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === emoji ? 'bg-slate-100 text-slate-900 border border-slate-200' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}
                >
                  {emoji} <span className="text-xs">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Lista de Usuarios */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {displayedReactions.length === 0 ? (
            <p className="text-center text-sm text-slate-400 mt-10">No hay reacciones aún.</p>
          ) : (
            displayedReactions.map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    <img src={`https://ui-avatars.com/api/?name=${r.name}&background=f8fafc&color=0f172a`} alt={r.name} className="w-full h-full object-cover"/>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{r.name}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-lg shadow-sm border border-slate-100">
                  {r.emoji}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const PostSkeleton = () => (
  <div className="bg-white p-5 rounded-[32px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 animate-pulse mb-5 mx-4">
    <div className="flex gap-3 mb-4">
      <div className="w-11 h-11 bg-slate-200 rounded-full"></div>
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
        <div className="h-2 bg-slate-200 rounded w-1/6"></div>
      </div>
    </div>
    <div className="h-52 bg-slate-100 rounded-2xl w-full mb-2"></div>
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
  const [visibleCount, setVisibleCount] = useState(5);
  const [birthdays, setBirthdays] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  
  const [activeReactionPost, setActiveReactionPost] = useState(null); // Popover para dar reacción
  const [viewReactionsPostId, setViewReactionsPostId] = useState(null); // Modal para ver la lista de reacciones
  
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
      if (isMiembro) finalPosts = postsData.filter(p => p.visibility !== 'servidores');
      if (!isPastor) finalPosts = finalPosts.filter(p => !p.isArchived);
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

  // ✅ NUEVOS EMOJIS (Se reemplazó 👍 por 🙌)
  const EMOJIS = ['❤️', '🔥', '🙏', '🙌'];

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
    setActiveReactionPost(null); 
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
    } catch (e) { console.error(e); }
  };

  const handleDeletePost = async (postId) => {
    if (!isModerator) return;
    if (!window.confirm("¿Seguro que deseas eliminar permanentemente este post?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setMenuOpenId(null);
      showToast("Post eliminado");
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

      if (post.visibility === 'servidores') payload.filters = [{ field: "tag", key: "role", relation: "!=", value: "miembro" }];
      else payload.included_segments = ["Total Subscriptions"];

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify(payload)
      });
      showToast("¡Aviso enviado con éxito!");
    } catch (error) { console.error(error); }
  };

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (filter === 'Archivados') return posts.filter(p => p.isArchived === true);
    result = posts.filter(p => p.isArchived !== true);
    if (filter !== 'Todo') result = result.filter(p => p.type === filter);
    return result;
  }, [filter, posts]);

  const storyDevocionales = useMemo(() => {
    return posts.filter(p => p.type === 'Devocional' && !p.isArchived).slice(0, 8);
  }, [posts]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMorePosts = visibleCount < filteredPosts.length;

  return (
    // EL FONDO AHORA ES GRIS CLARO (bg-slate-50)
    <div className="min-h-screen bg-slate-50 pb-24 font-sans relative">
    
	{/* 🚀 EL TOPBAR SE AGREGA AQUÍ EN LA PARTE SUPERIOR */}
      <Topbar dbUser={dbUser} />	

	{/* Toast */}
      {toast.show && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[250] bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-xl animate-slide-up">
          {toast.message}
        </div>
      )}

      {/* Stories Carousel */}
      <div className="flex gap-4 px-4 pb-3 pt-3 overflow-x-auto no-scrollbar bg-slate-50">
        {canCreatePost && (
          <div className="flex flex-col items-center gap-1.5 min-w-fit cursor-pointer" onClick={() => { setEditingPost(null); setIsModalOpen(true); }}>
            <div className="w-16 h-16 rounded-full border-[2.5px] border-dashed border-slate-300 bg-white flex items-center justify-center active:scale-95 transition-transform">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-[11px] text-slate-600 font-bold">Crear</span>
          </div>
        )}
        
        {storyDevocionales.map((post) => {
          const storyPhoto = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;
          return (
            <div key={post.id} className="flex flex-col items-center gap-1.5 min-w-fit cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/post/${post.id}`)}>
              <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600">
                <img src={storyPhoto} alt={post.authorName} className="w-full h-full rounded-full object-cover border-[2.5px] border-white bg-white" />
              </div>
              <span className="text-[11px] text-slate-700 font-bold max-w-[64px] truncate">{post.authorName?.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      {/* Post Feed */}
      <div className="pb-6">
        {loading ? (
            <><PostSkeleton /><PostSkeleton /></>
        ) : displayedPosts.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center">
              <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-3">
                <Sparkles size={24} className="text-slate-400"/>
              </div>
              <p className="text-sm font-semibold text-slate-500">Muro al día. No hay publicaciones.</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const profileImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;
              const isOracion = post.type === 'Oración';
              const isDevocional = post.type === 'Devocional';
              const postReactions = post.reactions || [];

              // Extraer solo los emojis usados para el resumen derecho
              const usedEmojisDisplay = [...new Set(postReactions.map(r => r.emoji))].slice(0, 3);

              return (
              <div key={post.id} className={`bg-white rounded-[32px] p-5 mb-5 mx-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden relative ${post.isPinned ? 'border-amber-200/50 bg-gradient-to-b from-amber-50/10 to-white' : ''}`}>
                
                {/* Etiqueta flotante de fijado */}
                {post.isPinned && <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"><Pin size={10} fill="currentColor"/> Fijado</div>}

                {/* Post Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={profileImg} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-slate-100 bg-slate-50" />
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 leading-none tracking-tight">{post.authorName}</h3>
                      <p className={`text-[11px] font-semibold mt-1 ${isOracion ? 'text-purple-600' : isDevocional ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {isOracion ? '🛐 Pedido de Oración' : isDevocional ? '📖 Devocional' : post.role}
                      </p>
                    </div>
                  </div>
                  
                  {isModerator && (
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="p-2 text-slate-400 hover:text-slate-800 transition-colors rounded-full hover:bg-slate-50">
                        <MoreVertical size={18}/>
                      </button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-10 bg-white shadow-xl rounded-2xl border border-slate-100 py-2 w-48 z-50">
                          <button onClick={() => handlePin(post.id, post.isPinned)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <Pin size={14}/> {post.isPinned ? 'Desanclar' : 'Fijar arriba'}
                          </button>
                          <button onClick={() => handleReNotify(post)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-blue-600 hover:bg-slate-50 flex items-center gap-2">
                            <BellRing size={14}/> Re-Notificar
                          </button>
                          {isPastor && (
                            <button onClick={() => handleArchive(post.id, post.isArchived)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-2">
                              <Archive size={14}/> {post.isArchived ? 'Desarchivar' : 'Archivar'}
                            </button>
                          )}
                          <button onClick={() => handleDeletePost(post.id)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <Trash2 size={14}/> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Post Content */}
                <div className="cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                  {post.title && <h2 className={`font-black text-slate-900 tracking-tight leading-snug mb-2 ${isDevocional ? 'text-lg uppercase italic' : 'text-[16px]'}`}>{post.title}</h2>}
                  <p className="text-[14px] text-slate-600 mb-4 leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {post.content}
                  </p>
                </div>

                {/* 📸 Post Image (DISEÑO DIFERENCIADO) */}
                {post.image && (
                  <div className={`mb-4 cursor-pointer overflow-hidden bg-slate-50 border border-slate-100 ${isDevocional ? 'rounded-[24px] aspect-square' : 'rounded-[18px] max-h-72'}`} onClick={() => navigate(`/post/${post.id}`)}>
                    <img src={post.image} alt="Post image" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                  </div>
                )}

                {/* LÍNEA SEPARADORA SUTIL */}
                <div className="h-px w-full bg-slate-100 my-3"></div>

                {/* 🌟 NUEVO ENGAGEMENT BAR (Facebook Style Avanzado) */}
                <div className="flex items-center justify-between relative pt-1">
                  
                  {/* Izquierda: Botones de Acción limpios */}
                  <div className="flex items-center gap-1.5">
                    {/* Botón Reaccionar con Popover */}
                    <div className="relative">
                      {activeReactionPost === post.id && (
                        <div className="absolute bottom-10 left-0 bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 px-2 py-1.5 flex items-center gap-1 z-50 animate-slide-up">
                          {EMOJIS.map(emoji => {
                            const isSelected = postReactions.some(r => r.uid === currentUser?.uid && r.emoji === emoji);
                            return (
                              <button key={emoji} onClick={() => handleReaction(post.id, post.reactions, emoji)} 
                                      className={`w-9 h-9 flex items-center justify-center hover:scale-125 transition-transform rounded-full text-xl ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                                {emoji}
                              </button>
                            )
                          })}
                          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white border-r border-b border-slate-100 rotate-45" />
                        </div>
                      )}
                      
                      <button onClick={() => setActiveReactionPost(activeReactionPost === post.id ? null : post.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-50 active:scale-95 transition-all font-semibold text-xs">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Reaccionar
                      </button>
                    </div>

                    {/* Botón Comentar */}
                    <button onClick={() => navigate(`/post/${post.id}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-50 active:scale-95 transition-all font-semibold text-xs">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {post.commentsCount > 0 ? post.commentsCount : 'Comentar'}
                    </button>
                  </div>

                  {/* Derecha: Acumulado de Reacciones */}
                  {postReactions.length > 0 && (
                    <button onClick={() => setViewReactionsPostId(post.id)} className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-slate-50 transition-colors">
                      <div className="flex -space-x-1">
                        {usedEmojisDisplay.map((emj, idx) => (
                          <div key={idx} className="w-5 h-5 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] z-10 shadow-sm">{emj}</div>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-slate-500 ml-1">{postReactions.length}</span>
                    </button>
                  )}
                </div>

                {/* Sub-componente de comentarios */}
                <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
              </div>
            )})
        )}

        {hasMorePosts && !loading && (
          <div className="flex justify-center mt-2 pb-8">
            <button onClick={() => setVisibleCount(prev => prev + 5)} className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-6 py-3 rounded-full active:scale-95 transition-transform shadow-sm">
              Cargar más publicaciones
            </button>
          </div>
        )}
      </div>

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
      
      {/* EL NUEVO MODAL DE LISTA DE REACCIONES */}
      {viewReactionsPostId && (
        <ReactionsListModal 
          isOpen={true} 
          onClose={() => setViewReactionsPostId(null)} 
          reactions={posts.find(p => p.id === viewReactionsPostId)?.reactions || []} 
        />
      )}
    </div>
  );
}