import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { Cake, BookOpen, Pin, Link as LinkIcon, ExternalLink, MessageCircle, MoreVertical, X, Edit3, Trash2, PlusCircle, AlertTriangle, Calendar, Heart, Send, AlertCircle, CheckCircle } from 'lucide-react';
import CreatePostModal from '../components/CreatePostModal';
import TopBar from '../components/TopBar';
import BirthdayModal from '../components/BirthdayModal';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, limit } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core'; 
import OneSignalWeb from 'react-onesignal'; 
import OneSignal from 'onesignal-cordova-plugin'; // Importación oficial nativa

export default function Home() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  
  // ✅ PUNTO #5: ROLES CORREGIDOS (Pastor y Líder pueden todo)
  const canManageEverything = dbUser?.role === 'pastor' || dbUser?.role === 'lider';
  const canCreatePost = canManageEverything || dbUser?.area === 'recepcion';
  
  const isNative = Capacitor.isNativePlatform(); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todo');
  const [birthdays, setBirthdays] = useState([]);
  const [toast, setToast] = useState(null);

  const [expandedPosts, setExpandedPosts] = useState(new Set());
  const [reactionPickerOpen, setReactionPickerOpen] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const [editingPost, setEditingPost] = useState(null);
  const [postToDelete, setPostToDelete] = useState(null);
  const [fullImage, setFullImage] = useState(null);
  const [showReactionsFor, setShowReactionsFor] = useState(null);

  const REACTION_TYPES = ['👍', '❤️', '🔥', '🙏', '😢', '😂'];

  // 1. CARGAR POSTS
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar: Primero los fijados, luego por fecha
      postsData.sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Error posts:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ✅ FUNCIÓN DE REPARACIÓN DUAL V5 (Punto #1)
  const handleHardResetNotifications = async () => {
    try {
      setToast({ message: "Reiniciando suscripción...", type: "info" });
      if (isNative) {
        // En V5 nativo, usamos login para refrescar el ID
        if (currentUser?.uid) {
          OneSignal.login(currentUser.uid);
          setToast({ message: "¡Suscripción Android refrescada!", type: "success" });
        }
      } else {
        await OneSignalWeb.logout();
        const permission = await OneSignalWeb.Notifications.requestPermission();
        if (permission === 'granted' && currentUser?.uid) {
          await OneSignalWeb.login(currentUser.uid);
          setToast({ message: "¡Suscripción Web reactivada!", type: "success" });
        }
      }
    } catch (e) {
      setToast({ message: "Error al reiniciar", type: "error" });
    }
  };

  // 2. CARGAR CUMPLEAÑOS
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const today = new Date();
      const currentMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const birthdayPeople = [];
      snapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.birthday && userData.birthday.slice(5) === currentMonthDay) {
            birthdayPeople.push({ id: doc.id, ...userData });
        }
      });
      setBirthdays(birthdayPeople);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLinkClick = (e, url) => {
    e.preventDefault(); e.stopPropagation();
    if (!url) return;
    if (url.startsWith('/')) { navigate(url); } else { window.open(url, '_blank', 'noopener,noreferrer'); }
  };

  const handleReaction = async (post, emoji) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    const currentReactions = post.reactions || [];
    const myIndex = currentReactions.findIndex(r => r.uid === currentUser.uid);
    let newReactions = [...currentReactions];
    if (myIndex >= 0) {
      if (currentReactions[myIndex].emoji === emoji) { newReactions.splice(myIndex, 1); } 
      else { newReactions[myIndex].emoji = emoji; }
    } else {
      newReactions.push({ uid: currentUser.uid, name: currentUser.displayName, photo: currentUser.photoURL, emoji: emoji });
    }
    await updateDoc(postRef, { reactions: newReactions });
    setReactionPickerOpen(null);
  };

  const filteredPosts = filter === 'Todo' ? posts : posts.filter(post => post.type === filter);

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50">
      <TopBar />

      <div className="px-4 mt-4 space-y-4">
          <div className="flex justify-center">
            <button onClick={handleHardResetNotifications} className="flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all">
                <AlertCircle size={16} /> Arreglar mis notificaciones
            </button>
          </div>

          <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} className={`bg-white p-5 border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm ${birthdays.length > 0 ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full text-white ${birthdays.length > 0 ? 'bg-brand-500 animate-pulse' : 'bg-slate-300'}`}><Cake size={26} /></div>
              <div>
                <p className="text-base font-black text-slate-800">Cumpleaños de hoy</p>
                <p className={`text-sm font-medium ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                  {birthdays.length > 0 ? `¡Hay ${birthdays.length} hermanos de cumple! 🎂` : "Nadie cumple hoy"}
                </p>
              </div>
            </div>
            {birthdays.length > 0 && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Ver</span>}
          </div>

          <div className="flex gap-3 overflow-x-auto py-2 mb-4 no-scrollbar">
            {['Todo', 'Noticia', 'Devocional', 'Urgente'].map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-5 py-2.5 text-sm font-bold rounded-full transition-all whitespace-nowrap shadow-sm ${filter === cat ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{cat}</button>
            ))}
          </div>
      </div>

      <div className="space-y-6 px-0 sm:px-4">
        {loading ? (
            <div className="px-4"><PostSkeleton /><PostSkeleton /></div>
        ) : filteredPosts.length === 0 ? (
            <EmptyState />
        ) : (
            filteredPosts.map(post => (
              <div key={post.id} className={`bg-white pt-5 sm:rounded-2xl shadow-sm border-y sm:border border-slate-100 relative ${post.type === 'Urgente' ? 'border-l-4 border-l-red-500' : ''} ${post.isPinned ? 'bg-slate-50/80' : ''}`}>
                {post.isPinned && <div className="absolute top-0 right-12 bg-slate-200 text-slate-500 px-3 py-1 rounded-b-lg text-[10px] font-bold flex items-center gap-1 shadow-sm"><Pin size={12} /> FIJADO</div>}
                
                <div className="flex justify-between items-start mb-4 px-5">
                  <div className="flex items-center gap-3">
                      <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-12 h-12 rounded-full border shadow-sm" />
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{post.authorName} <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase ml-1">{post.role}</span></h3>
                        <p className="text-xs text-slate-400">{post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Reciente'}</p>
                      </div>
                  </div>
                  
                  {/* ✅ PUNTO #5: MENÚ DE GESTIÓN CORREGIDO (Líderes incluidos) */}
                  {(canManageEverything || post.authorId === currentUser?.uid) && (
                    <div className="relative">
                      <button onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><MoreVertical size={24}/></button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-10 bg-white shadow-2xl rounded-2xl border border-slate-100 py-2 w-48 z-30 animate-scale-in origin-top-right">
                          {canManageEverything && (
                            <button onClick={async () => { await updateDoc(doc(db, 'posts', post.id), { isPinned: !post.isPinned }); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                              <Pin size={18} className={post.isPinned ? "text-brand-600" : ""}/> {post.isPinned ? 'Desfijar' : 'Fijar arriba'}
                            </button>
                          )}
                          <button onClick={() => { setEditingPost(post); setIsModalOpen(true); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                            <Edit3 size={18}/> Editar
                          </button>
                          <button onClick={() => { setPostToDelete(post); setMenuOpenId(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-3">
                            <Trash2 size={18}/> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-5 mb-4 cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                  <div className="text-base text-slate-800 whitespace-pre-wrap leading-relaxed line-clamp-4">{post.content}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                      {post.tags?.map((tag, i) => <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black uppercase">#{tag}</span>)}
                  </div>
                </div>

                {post.image && <div className="w-full mb-4 bg-slate-100 cursor-zoom-in" onClick={() => setFullImage(post.image)}><img src={post.image} className="w-full h-auto max-h-[500px] object-cover" /></div>}
                
                {post.link && (
                    <div className="px-5 mb-4">
                        <button onClick={(e) => handleLinkClick(e, post.link)} className="flex items-center justify-between w-full bg-slate-50 border border-slate-200 p-4 rounded-xl">
                            <span className="text-sm font-bold text-brand-700 flex items-center gap-3">{post.link.startsWith('/') ? <Calendar size={20} /> : <ExternalLink size={20} />} {post.linkText || 'Ver más'}</span>
                            <ExternalLink size={18} className="text-slate-300" />
                        </button>
                    </div>
                )}

                {/* Footer Social */}
                <div className="px-5 py-4 border-t border-slate-50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setReactionPickerOpen(reactionPickerOpen === post.id ? null : post.id)} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-sm bg-white hover:bg-slate-50">😊+</button>
                        {reactionPickerOpen === post.id && (
                          <div className="absolute bottom-16 left-5 bg-white shadow-2xl rounded-full p-2 flex gap-2 border border-slate-100 z-40 animate-scale-in">
                            {REACTION_TYPES.map(emoji => (
                              <button key={emoji} onClick={() => handleReaction(post, emoji)} className="text-2xl hover:scale-125 transition-transform p-1">{emoji}</button>
                            ))}
                          </div>
                        )}
                        {/* Listado de reacciones */}
                        {Object.entries(post.reactions?.reduce((acc, r) => ({...acc, [r.emoji]: (acc[r.emoji] || 0) + 1}), {}) || {}).map(([emoji, count]) => (
                           <button key={emoji} onClick={() => setShowReactionsFor(post)} className="bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 flex items-center gap-1 shadow-sm">{emoji} {count}</button>
                        ))}
                    </div>
                    <button onClick={() => navigate(`/post/${post.id}`)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-600 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <MessageCircle size={20} /> Comentar
                    </button>
                  </div>
                  <CommentPreview postId={post.id} onClick={() => navigate(`/post/${post.id}`)} />
                </div>
              </div>
            ))
        )}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} className="fixed bottom-28 right-5 w-16 h-16 bg-brand-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 z-40 transition-all">
          <PlusCircle size={32} />
        </button>
      )}

      {/* Modales */}
      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      {fullImage && <ImageModal src={fullImage} onClose={() => setFullImage(null)} />}
      {showReactionsFor && <ReactionsListModal post={showReactionsFor} onClose={() => setShowReactionsFor(null)} />}
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} />

      {/* Modal Confirmar Eliminación */}
      {postToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[35px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32}/></div>
            <h3 className="font-black text-slate-800 text-xl mb-2">¿Eliminar publicación?</h3>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-8">Esta acción no se puede deshacer.</p>
            <div className="flex flex-col gap-3">
              <button onClick={async () => { await deleteDoc(doc(db, 'posts', postToDelete.id)); setPostToDelete(null); }} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-200">Confirmar Eliminación</button>
              <button onClick={() => setPostToDelete(null)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-6 right-6 z-[200] animate-slide-up">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
            <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// SKELETONS Y SUBCOMPONENTES SE MANTIENEN IGUAL (Omitidos por brevedad para no saturar)
// ... (CommentPreview, ReactionsListModal, ImageModal, PostSkeleton, EmptyState)