import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, MessageCircle, MoreHorizontal, Trash2, 
  Archive, Pin, Sparkles, BellRing, X, Plus, Heart, Share2,
  Calendar, Clock, ImageIcon
} from 'lucide-react';
import TopBar from '../components/TopBar'; 
import CreatePostModal from '../components/CreatePostModal';
import BirthdayModal from '../components/BirthdayModal';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  deleteDoc, doc, updateDoc, limit, setDoc
} from 'firebase/firestore';
import { format, formatDistanceToNow, isAfter, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { shareContent } from '../utils/share';

// --- 💬 SUB-COMPONENTE: PREVIEW DE COMENTARIOS ---
function CommentPreview({ postId, count, onClick }) {
  const [previewComments, setPreviewComments] = useState([]);
  
  useEffect(() => {
    if (!postId) return;
    const qPreview = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'), limit(2));
    const unsubPreview = onSnapshot(qPreview, (snap) => setPreviewComments(snap.docs.map(d => d.data())));
    return () => unsubPreview();
  }, [postId]);

  if ((count || 0) === 0 && previewComments.length === 0) return null;

  return (
    <div className="mt-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <p className="text-[13px] font-semibold text-slate-500 mb-1 hover:underline">Ver los {count || 0} comentarios</p>
      <div className="space-y-1">
        {previewComments.map((c, idx) => (
          <div key={idx} className="flex gap-2 text-left items-start text-[13px] leading-tight">
            <span className="font-bold text-slate-900 shrink-0">{c.name?.split(' ')[0]}</span>
            <span className="text-slate-800 line-clamp-1 break-words">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 👥 SUB-COMPONENTE: MODAL DE LISTA DE REACCIONES ---
function ReactionsListModal({ isOpen, onClose, reactions = [] }) {
  const [activeTab, setActiveTab] = useState('Todas');
  
  if (!isOpen) return null;

  const usedEmojis = [...new Set(reactions.map(r => r.emoji))];
  const displayedReactions = activeTab === 'Todas' ? reactions : reactions.filter(r => r.emoji === activeTab);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-t-[20px] sm:rounded-[20px] shadow-2xl animate-slide-up flex flex-col h-[65vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 shrink-0">
          <h3 className="text-[17px] font-bold text-slate-900">Reacciones</h3>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><X size={18}/></button>
        </div>
        {usedEmojis.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-2 border-b border-slate-200 shrink-0 no-scrollbar">
            <button 
              onClick={() => setActiveTab('Todas')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'Todas' ? 'bg-blue-100 text-blue-700' : 'bg-transparent text-slate-600'}`}
            >
              Todas {reactions.length}
            </button>
            {usedEmojis.map(emoji => {
              const count = reactions.filter(r => r.emoji === emoji).length;
              return (
                <button 
                  key={emoji} 
                  onClick={() => setActiveTab(emoji)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === emoji ? 'bg-blue-100 text-blue-700' : 'bg-transparent text-slate-600'}`}
                >
                  {emoji} {count}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {displayedReactions.length === 0 ? (
            <p className="text-center text-sm text-slate-400 mt-10">No hay reacciones aún.</p>
          ) : (
            displayedReactions.map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    <img src={`https://ui-avatars.com/api/?name=${r.name}&background=f8fafc&color=0f172a`} alt={r.name} className="w-full h-full object-cover"/>
                  </div>
                  <span className="text-[15px] font-semibold text-slate-900">{r.name}</span>
                </div>
                <div className="text-xl">{r.emoji}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const PostSkeleton = () => (
  <div className="bg-white p-4 mb-2">
    <div className="flex gap-3 mb-3">
      <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse"></div>
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 bg-slate-200 rounded w-1/4 animate-pulse"></div>
        <div className="h-2 bg-slate-200 rounded w-1/6 animate-pulse"></div>
      </div>
    </div>
    <div className="h-48 bg-slate-100 w-full mb-2 animate-pulse"></div>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  
  const isPastor = dbUser?.role === 'pastor';
  const isLider = dbUser?.role === 'lider';
  const isStaff = isPastor || isLider;
  const isMiembro = dbUser?.role === 'miembro';
  const canCreatePost = isStaff || dbUser?.area === 'recepcion';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  
  const [posts, setPosts] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]); // ✅ ESTADO PARA PRÓXIMOS EVENTOS

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todo');
  const [visibleCount, setVisibleCount] = useState(5);
  const [birthdays, setBirthdays] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  
  const [activeReactionPost, setActiveReactionPost] = useState(null); 
  const [viewReactionsPostId, setViewReactionsPostId] = useState(null); 
  const [editingPost, setEditingPost] = useState(null);
  const [toastMsg, setToastMsg] = useState({ show: false, message: '' });

  const showToast = (msg) => {
    setToastMsg({ show: true, message: msg });
    setTimeout(() => setToastMsg({ show: false, message: '' }), 3000);
  };

  // ✅ CARGA DE POSTS
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

  // ✅ CARGA DE PRÓXIMOS SERVICIOS (WIDGET NUEVO)
  useEffect(() => {
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(qEvents, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const today = startOfDay(new Date());
      
      const futureEvents = eventsData.filter(event => {
        const eventDate = startOfDay(new Date(event.date + 'T00:00:00'));
        return eventDate >= today;
      });
      
      setUpcomingEvents(futureEvents.slice(0, 5)); // Mostramos los próximos 5
    });
    return () => unsubscribe();
  }, []);

  // CARGA DE CUMPLEAÑOS
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

  const EMOJIS = ['❤️', '🔥', '🙏', '👍', '😢', '🎉']; // Más emojis estilo FB

  const handleReaction = async (postId, reactions, emoji) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', postId);
    const reactionsArr = reactions || [];
    const myIdx = reactionsArr.findIndex(r => r.uid === currentUser.uid);
    let newReactions = [...reactionsArr];
    
    if (myIdx >= 0) {
      if (newReactions[myIdx].emoji === emoji) newReactions.splice(myIdx, 1);
      else newReactions[myIdx] = { ...newReactions[myIdx], emoji }; 
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
    } catch (e) { showToast("Error al archivar"); }
  };

  const handlePin = async (postId, currentPinned) => {
    if (!isStaff) return;
    try {
      await updateDoc(doc(db, 'posts', postId), { isPinned: !currentPinned });
      setMenuOpenId(null);
    } catch (e) { showToast("Error al fijar"); }
  };

  const handleDeletePost = async (postId) => {
    if (!isStaff) return;
    if (!window.confirm("¿Seguro que deseas eliminar permanentemente este post?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setMenuOpenId(null);
      showToast("Post eliminado");
    } catch (e) { showToast("Error al eliminar"); }
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

      const payload = {
        headings: { en: `RECORDATORIO: ${post.title}`, es: `RECORDATORIO: ${post.title}` },
        contents: { en: notifBody, es: notifBody },
        data: { route: `/post/${post.id}` }, 
        large_icon: "https://cdsapp.vercel.app/logo.png",
        priority: 10,
        android_visibility: 1
      };

      if (post.visibility === 'servidores') payload.filters = [{ field: "tag", key: "role", relation: "!=", value: "miembro" }];
      else payload.included_segments = ["Total Subscriptions"];

      await fetch("/api/sendPush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      showToast("¡Aviso enviado con éxito!");
    } catch (error) { showToast("Error al notificar"); }
  };

  const handleShare = async (e, post) => {
    e.stopPropagation();
    const url = `https://cdsapp.vercel.app/#/post/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title || 'CDS App', text: 'Mira esta publicación', url }); } catch(err){}
    } else {
      navigator.clipboard.writeText(url);
      showToast("Enlace copiado al portapapeles");
    }
  };

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (filter === 'Archivados') return posts.filter(p => p.isArchived === true);
    result = posts.filter(p => p.isArchived !== true);
    if (filter !== 'Todo') result = result.filter(p => p.type === filter);
    return result;
  }, [filter, posts]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMorePosts = visibleCount < filteredPosts.length;
  const myProfileImg = currentUser?.photoURL || `https://ui-avatars.com/api/?name=${currentUser?.displayName}&background=EBF4FF&color=2563EB`;

  return (
    // ✅ FONDO GRIS OSCURO TIPO FACEBOOK (#ebedf0)
    <div className="min-h-screen bg-[#ebedf0] font-sans relative flex justify-center">
      
      {(menuOpenId || activeReactionPost) && (
        <div className="fixed inset-0 z-40" onClick={() => { setMenuOpenId(null); setActiveReactionPost(null); }} />
      )}

      {/* ✅ CONTENEDOR PRINCIPAL: Ocupa todo el ancho, sin bordes a los lados en mobile */}
      <div className="w-full max-w-md bg-[#ebedf0] min-h-screen pb-24 relative">
        
        <TopBar birthdaysCount={birthdays.length} onBirthdayClick={() => setIsBirthdayModalOpen(true)} />

        {toastMsg.show && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[250] bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-xl animate-slide-up">
            {toastMsg.message}
          </div>
        )}

        {/* ✅ CAJA DE "CREAR PUBLICACIÓN" (Diseño clásico FB) */}
        <div className="bg-white px-4 py-3 mb-2 shadow-sm">
          <div className="flex gap-3 items-center">
            <img src={myProfileImg} alt="Perfil" className="w-10 h-10 rounded-full object-cover border border-slate-100" />
            {canCreatePost ? (
               <button 
                 onClick={() => { setEditingPost(null); setIsModalOpen(true); }}
                 className="flex-1 bg-[#f0f2f5] hover:bg-slate-200 transition-colors rounded-full px-4 py-2.5 text-left text-[15px] text-slate-500 font-medium"
               >
                 ¿Qué estás pensando, {currentUser?.displayName?.split(' ')[0]}?
               </button>
            ) : (
               <div className="flex-1 bg-[#f0f2f5] rounded-full px-4 py-2.5 text-left text-[15px] text-slate-400 font-medium">
                 Muro de anuncios oficiales
               </div>
            )}
          </div>
          {/* Filtros inferiores reemplazan los botones de foto/video por ahora */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 overflow-x-auto no-scrollbar pb-1">
            {['Todo', 'Devocional', 'Oración'].map((cat) => (
              <button 
                key={cat} onClick={() => { setFilter(cat); setVisibleCount(5); }} 
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  filter === cat ? 'bg-blue-100 text-blue-700' : 'bg-transparent text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
            {isPastor && (
              <button onClick={() => { setFilter('Archivados'); setVisibleCount(5); }} 
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${filter === 'Archivados' ? 'bg-slate-800 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}>
                Archivados
              </button>
            )}
          </div>
        </div>

        {/* ✅ WIDGET: PRÓXIMOS SERVICIOS (Reemplaza las historias) */}
        {upcomingEvents.length > 0 && filter === 'Todo' && (
          <div className="bg-white py-3 mb-2 shadow-sm">
            <h3 className="px-4 text-[14px] font-bold text-slate-800 mb-2">Próximos Servicios</h3>
            <div className="flex overflow-x-auto gap-3 px-4 pb-2 no-scrollbar">
              {upcomingEvents.map(event => {
                 // Verificamos si estoy asignado a este evento
                 const isMyEvent = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser?.displayName));
                 
                 return (
                  <div key={event.id} onClick={() => navigate(isMyEvent ? '/servicios' : `/calendario/${event.id}`)} className={`min-w-[140px] max-w-[160px] rounded-xl p-3 shrink-0 cursor-pointer border ${isMyEvent ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Calendar size={14} className={isMyEvent ? 'text-blue-600' : 'text-slate-400'}/>
                      <p className={`text-[11px] font-bold uppercase ${isMyEvent ? 'text-blue-600' : 'text-slate-500'}`}>{format(new Date(event.date + 'T00:00:00'), 'dd MMM', {locale: es})}</p>
                    </div>
                    <h4 className="text-[13px] font-bold text-slate-900 leading-tight line-clamp-2">{event.title}</h4>
                    {isMyEvent && <p className="text-[10px] text-blue-600 font-bold mt-2 bg-blue-100 px-2 py-0.5 rounded-md inline-block">Mi Turno</p>}
                  </div>
                 )
              })}
            </div>
          </div>
        )}

        {/* ✅ MURO DE PUBLICACIONES */}
        <div className="pb-6">
          {loading ? (
              <><PostSkeleton /><PostSkeleton /></>
          ) : displayedPosts.length === 0 ? (
              <div className="text-center py-10 bg-white">
                <Sparkles size={24} className="text-slate-400 mx-auto mb-2"/>
                <p className="text-[15px] font-medium text-slate-500">No hay publicaciones para mostrar.</p>
              </div>
          ) : (
              displayedPosts.map(post => {
                const profileImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=EBF4FF&color=2563EB`;
                const isOracion = post.type === 'Oración';
                const isDevocional = post.type === 'Devocional';
                const postReactions = post.reactions || [];
                
                let timeAgo = '';
                if (post.createdAt) {
                  try {
                    const dateObj = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
                    timeAgo = formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
                  } catch (e) { timeAgo = ''; }
                }

                return (
                // ✅ TARJETA ESTILO FACEBOOK: bg-white, sin márgenes, sin bordes redondeados
                <div key={post.id} className="bg-white mb-2 shadow-sm relative">
                  
                  {post.isPinned && <div className="absolute top-0 right-4 bg-amber-500 text-white px-2 py-0.5 rounded-b-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Pin size={10} fill="currentColor"/> Fijado</div>}

                  {/* CABECERA DEL POST */}
                  <div className="px-4 pt-3 flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <img src={profileImg} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                      <div>
                        <h3 className="font-semibold text-[15px] text-slate-900 leading-tight">{post.authorName}</h3>
                        <div className="flex items-center gap-1 text-[12px] text-slate-500">
                          <span>{timeAgo}</span>
                          <span>•</span>
                          <Globe size={10} />
                          {post.type !== 'Noticia' && (
                            <>
                              <span>•</span>
                              <span className={isOracion ? 'text-purple-600 font-medium' : 'text-blue-600 font-medium'}>{post.type}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isStaff && (
                      <div className="relative z-50">
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                          <MoreHorizontal size={20}/>
                        </button>
                        {menuOpenId === post.id && (
                          <div className="absolute right-0 top-8 bg-white shadow-xl rounded-lg border border-slate-200 py-1 w-48 animate-slide-down">
                            <button onClick={() => handlePin(post.id, post.isPinned)} className="w-full text-left px-4 py-2.5 text-[15px] text-slate-700 hover:bg-slate-100 flex items-center gap-2">
                              <Pin size={18}/> {post.isPinned ? 'Desfijar post' : 'Fijar post'}
                            </button>
                            <button onClick={() => handleReNotify(post)} className="w-full text-left px-4 py-2.5 text-[15px] text-slate-700 hover:bg-slate-100 flex items-center gap-2">
                              <BellRing size={18}/> Re-Notificar
                            </button>
                            {isPastor && (
                              <button onClick={() => handleArchive(post.id, post.isArchived)} className="w-full text-left px-4 py-2.5 text-[15px] text-slate-700 hover:bg-slate-100 flex items-center gap-2">
                                <Archive size={18}/> {post.isArchived ? 'Desarchivar' : 'Archivar'}
                              </button>
                            )}
                            <button onClick={() => handleDeletePost(post.id)} className="w-full text-left px-4 py-2.5 text-[15px] text-red-600 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 size={18}/> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CUERPO DEL POST */}
                  <div className="cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                    {post.title && <h2 className="px-4 font-bold text-[16px] text-slate-900 mb-1">{post.title}</h2>}
                    <p className={`px-4 text-[15px] text-slate-900 leading-snug whitespace-pre-wrap break-words ${post.image ? 'mb-2' : 'mb-3'}`}>
                      {post.content}
                    </p>
                  </div>

                  {/* ✅ IMAGEN EDGE-TO-EDGE: Ocupa todo el ancho, sin bordes redondeados */}
                  {post.image && (
                    <div className="w-full cursor-pointer bg-slate-100" onClick={() => navigate(`/post/${post.id}`)}>
                      <img src={post.image} alt="Post image" className="w-full h-auto max-h-[500px] object-cover" />
                    </div>
                  )}

                  {/* CONTADORES (Me gusta / Comentarios) */}
                  {(postReactions.length > 0 || (post.commentsCount || 0) > 0) && (
                    <div className="px-4 py-2 flex items-center justify-between text-[13px] text-slate-500 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        {postReactions.length > 0 && (
                          <button onClick={() => setViewReactionsPostId(post.id)} className="flex items-center">
                            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[9px] shadow-sm ring-2 ring-white z-10"><Heart size={8} fill="currentColor"/></div>
                            <span className="ml-1.5 hover:underline">{postReactions.length}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-3">
                        {(post.commentsCount || 0) > 0 && <span className="hover:underline cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>{post.commentsCount} comentarios</span>}
                      </div>
                    </div>
                  )}

                  {/* ✅ ACTION BAR ESTILO FACEBOOK */}
                  <div className="flex px-2 py-1 relative z-50">
                    
                    {/* BOTÓN ME GUSTA (Con Popover de Reacciones) */}
                    <div className="flex-1 relative">
                      {activeReactionPost === post.id && (
                        <div className="absolute bottom-12 left-0 bg-white rounded-[30px] shadow-[0_2px_15px_rgba(0,0,0,0.1)] border border-slate-200 px-3 py-2 flex items-center gap-2 animate-slide-up z-50">
                          {EMOJIS.map(emoji => {
                            const isSelected = currentUser && postReactions.some(r => r.uid === currentUser.uid && r.emoji === emoji);
                            return (
                              <button key={emoji} onClick={() => handleReaction(post.id, post.reactions, emoji)} 
                                      className={`w-9 h-9 flex items-center justify-center hover:scale-125 hover:-translate-y-2 transition-transform rounded-full text-2xl ${isSelected ? 'bg-slate-100' : 'bg-transparent'}`}>
                                {emoji}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      
                      {/* Evaluar si el usuario ya reaccionó para pintar el botón */}
                      {(() => {
                        const myReaction = currentUser ? postReactions.find(r => r.uid === currentUser.uid) : null;
                        return (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveReactionPost(activeReactionPost === post.id ? null : post.id); }} 
                            className={`w-full flex items-center justify-center gap-2 py-2 rounded-md transition-colors text-[14px] font-semibold hover:bg-[#f0f2f5] ${myReaction ? 'text-blue-600' : 'text-slate-600'}`}
                          >
                            {myReaction ? <Heart size={20} fill="currentColor" /> : <Heart size={20} strokeWidth={1.5} />}
                            {myReaction ? myReaction.emoji : 'Me gusta'}
                          </button>
                        );
                      })()}
                    </div>

                    <button onClick={() => navigate(`/post/${post.id}`)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors text-[14px] font-semibold text-slate-600 hover:bg-[#f0f2f5]">
                      <MessageCircle size={20} strokeWidth={1.5} /> Comentar
                    </button>

                    <button onClick={(e) => { 
                      e.stopPropagation(); 
                      shareContent(post.title, 'Mira esta publicación', `/post/${post.id}`); 
                    }}>
                      Compartir
                    </button>
                  </div>

                  {/* PREVIEW DE COMENTARIOS */}
                  <div className="px-4 pb-3">
                    <CommentPreview postId={post.id} count={post.commentsCount || 0} onClick={() => navigate(`/post/${post.id}`)} />
                  </div>

                </div>
              )})
          )}

          {hasMorePosts && !loading && (
            <div className="flex justify-center mt-4 pb-8">
              <button onClick={() => setVisibleCount(prev => prev + 5)} className="text-[14px] font-semibold text-slate-700 bg-white border border-slate-300 px-6 py-2.5 rounded-md hover:bg-slate-50 transition-colors shadow-sm">
                Ver más publicaciones
              </button>
            </div>
          )}
        </div> 
      </div>

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />
      
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