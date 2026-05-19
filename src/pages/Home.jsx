import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, MessageCircle, MoreVertical, PlusCircle, Trash2, 
  Archive, Pin, ChevronDown, Sparkles, BellRing
} from 'lucide-react';
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
    <div className="mt-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <p className="text-sm text-gray-500 font-medium mb-1">Ver los {realCount} comentarios</p>
      <div className="space-y-1">
        {previewComments.map((c, idx) => (
          <div key={idx} className="flex gap-2 text-left items-start text-sm">
            <span className="font-semibold text-gray-900 shrink-0">{c.name?.split(' ')[0]}</span>
            <span className="text-gray-600 line-clamp-1">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PostSkeleton = () => (
  <div className="bg-white p-5 rounded-[32px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100 animate-pulse mb-5 mx-4">
    <div className="flex gap-3 mb-4">
      <div className="w-11 h-11 bg-gray-200 rounded-full"></div>
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        <div className="h-2 bg-gray-200 rounded w-1/6"></div>
      </div>
    </div>
    <div className="h-52 bg-gray-100 rounded-2xl w-full mb-2"></div>
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
  const [activeReactionPost, setActiveReactionPost] = useState(null); // Controla el popover de reacciones
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
    setActiveReactionPost(null); // Cierra el popover al reaccionar
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
    // EL FONDO AHORA ES GRIS CLARO (bg-slate-50) PARA QUE RESALTEN LAS TARJETAS BLANCAS
    <div className="min-h-screen bg-slate-50 pb-32 font-sans relative">
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[250] bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-xl animate-slide-up">
          {toast.message}
        </div>
      )}

      {/* Header SocialYo Style - Flotando sobre el gris */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2 bg-slate-50 sticky top-0 z-40">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">CDS App.</h1>
        <div className="flex items-center gap-2">
          {birthdays.length > 0 && (
            <button onClick={() => setIsBirthdayModalOpen(true)} className="relative w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
              <Cake className="w-5 h-5 text-gray-700" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white border-2 border-white">
                {birthdays.length}
              </span>
            </button>
          )}
          <button className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stories Carousel */}
      <div className="flex gap-4 px-4 pb-2 pt-2 overflow-x-auto no-scrollbar bg-slate-50">
        {canCreatePost && (
          <div className="flex flex-col items-center gap-1 min-w-fit cursor-pointer" onClick={() => { setEditingPost(null); setIsModalOpen(true); }}>
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 bg-white flex items-center justify-center active:scale-95 transition-transform">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">Crear</span>
          </div>
        )}
        
        {storyDevocionales.map((post) => {
          const storyPhoto = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;
          return (
            <div key={post.id} className="flex flex-col items-center gap-1 min-w-fit cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/post/${post.id}`)}>
              <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600">
                <img src={storyPhoto} alt={post.authorName} className="w-full h-full rounded-full object-cover border-2 border-white bg-white" />
              </div>
              <span className="text-xs text-gray-700 font-medium max-w-[64px] truncate">{post.authorName?.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      {/* PESTAÑAS PASTILLERO (SEGMENTED CONTROL) */}
      <div className="px-4 sticky top-[60px] z-30 bg-slate-50 pt-3 pb-5">
        <div className="flex bg-gray-200/60 p-1 rounded-full overflow-x-auto no-scrollbar border border-gray-100/50">
          {['Todo', 'Devocional', 'Oración', 'Noticia'].map((cat) => (
            <button 
              key={cat} onClick={() => { setFilter(cat); setVisibleCount(5); }} 
              className={`flex-1 min-w-fit px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-300 ${
                filter === cat ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
          {isPastor && (
            <button onClick={() => { setFilter('Archivados'); setVisibleCount(5); }} 
              className={`flex-1 min-w-fit px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-300 ${
                filter === 'Archivados' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              Archivados
            </button>
          )}
        </div>
      </div>

      {/* Post Feed */}
      <div className="pb-6">
        {loading ? (
            <><PostSkeleton /><PostSkeleton /></>
        ) : displayedPosts.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center">
              <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center mb-3">
                <Sparkles size={24} className="text-gray-400"/>
              </div>
              <p className="text-sm font-medium text-gray-500">Muro al día. No hay publicaciones.</p>
            </div>
        ) : (
            displayedPosts.map(post => {
              const profileImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;
              const isOracion = post.type === 'Oración';

              return (
              // LA TARJETA BLANCA INDEPENDIENTE CON BORDES REDONDEADOS
              <div key={post.id} className="bg-white rounded-[32px] p-5 mb-5 mx-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100/80">
                {/* Post Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={profileImg} alt="Avatar" className="w-11 h-11 rounded-full object-cover border border-gray-100 bg-gray-50" />
                    <div>
                      <div className="flex items-center gap-1">
                        <h3 className="font-semibold text-sm text-gray-900 leading-tight">{post.authorName}</h3>
                        {post.isPinned && <Pin size={12} className="text-amber-500 fill-amber-500" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{isOracion ? '🛐 Pedido de Oración' : post.role}</p>
                    </div>
                  </div>
                  
                  {isModerator && (
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="p-2 text-gray-400 hover:text-gray-700 transition-colors bg-gray-50 rounded-full">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                      </button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-10 bg-white shadow-xl rounded-xl border border-gray-100 py-2 w-48 z-50">
                          <button onClick={() => handlePin(post.id, post.isPinned)} className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Pin size={16}/> {post.isPinned ? 'Desanclar' : 'Fijar arriba'}
                          </button>
                          <button onClick={() => handleReNotify(post)} className="w-full text-left px-4 py-2 text-sm font-medium text-blue-600 hover:bg-gray-50 flex items-center gap-2">
                            <BellRing size={16}/> Re-Notificar
                          </button>
                          {isPastor && (
                            <button onClick={() => handleArchive(post.id, post.isArchived)} className="w-full text-left px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                              <Archive size={16}/> {post.isArchived ? 'Desarchivar' : 'Archivar'}
                            </button>
                          )}
                          <button onClick={() => handleDeletePost(post.id)} className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <Trash2 size={16}/> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Post Content */}
                <div className="cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                  {post.title && <h2 className="text-[16px] font-bold text-gray-900 mb-1.5">{post.title}</h2>}
                  <p className="text-[14px] text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {post.content}
                  </p>
                </div>

                {/* Post Image */}
                {post.image && (
                  <div className="mb-4 cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                    <img src={post.image} alt="Post image" className="w-full max-h-72 object-cover rounded-[20px] bg-gray-50 border border-gray-100" />
                  </div>
                )}

                {/* Engagement Bar */}
                <div className="flex items-center justify-between py-2 relative">
                  <div className="flex items-center gap-5">
                    
                    {/* Like Button with Popover */}
                    <div className="relative flex items-center gap-1.5">
                      {/* POPOVER DE REACCIONES */}
                      {activeReactionPost === post.id && (
                        <div className="absolute -top-12 left-0 bg-white rounded-full shadow-lg border border-gray-100 px-2 py-1.5 flex items-center gap-1 z-50 animate-slide-up">
                          {['❤️', '🔥', '🙏', '👍'].map(emoji => (
                            <button key={emoji} onClick={() => handleReaction(post.id, post.reactions, emoji)} className="w-8 h-8 flex items-center justify-center hover:scale-125 transition-transform rounded-full hover:bg-gray-50 text-xl">
                              {emoji}
                            </button>
                          ))}
                          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white border-r border-b border-gray-100 rotate-45" />
                        </div>
                      )}
                      
                      <button onClick={() => setActiveReactionPost(activeReactionPost === post.id ? null : post.id)} className="p-1 active:scale-75 transition-transform bg-gray-50 hover:bg-gray-100 rounded-full">
                        <svg className="w-[20px] h-[20px] text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <span className="text-[13px] font-semibold text-gray-500">{post.reactions?.length || 0}</span>
                    </div>

                    <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                      <button className="p-1 active:scale-75 transition-transform bg-gray-50 hover:bg-gray-100 rounded-full">
                        <svg className="w-[20px] h-[20px] text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                      <span className="text-[13px] font-semibold text-gray-500">{post.commentsCount || 0}</span>
                    </div>
                  </div>
                  
                  {/* Vista Icono */}
                  <button className="p-1">
                    <svg className="w-[20px] h-[20px] text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>

                {/* Sub-componente de comentarios integrado limpio */}
                <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
              </div>
            )})
        )}

        {hasMorePosts && !loading && (
          <div className="flex justify-center mt-2 pb-8">
            <button onClick={() => setVisibleCount(prev => prev + 5)} className="text-[13px] font-semibold text-blue-500 bg-blue-50 px-5 py-2.5 rounded-full active:scale-95 transition-transform">
              Cargar más publicaciones
            </button>
          </div>
        )}
      </div>

      {/* Floating Bottom Navigation SocialYo Style */}
      <div className="fixed bottom-6 left-4 right-4 bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-around py-3 px-2 z-40">
        <button onClick={() => navigate('/')} className="p-2">
          <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 00.707-1.707l-9-9a.999.999 0 00-1.414 0l-9 9A1 1 0 003 13zm7 7v-5h4v5h-4zm2-15.586l6 6V20h-3v-5c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v5H6v-9.586l6-6z"/>
          </svg>
        </button>
        <button className="p-2">
          <svg className="w-6 h-6 text-gray-400 hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        
        {/* Botón Central de Creación (Azul) */}
        <button onClick={() => { if(canCreatePost){ setEditingPost(null); setIsModalOpen(true); } }} className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 -mt-6 active:scale-95 transition-transform border-[3px] border-white">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        
        <button className="p-2">
          <svg className="w-6 h-6 text-gray-400 hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <button className="p-2">
          <svg className="w-6 h-6 text-gray-400 hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </div>

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
    </div>
  );
}