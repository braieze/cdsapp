import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom'; 
import { 
  Cake, BookOpen, Pin, Link as LinkIcon, ExternalLink, 
  MessageCircle, MoreVertical, X, Edit3, Trash2, 
  PlusCircle, AlertTriangle, Calendar, Heart, Send, 
  AlertCircle, CheckCircle 
} from 'lucide-react';
import CreatePostModal from '../components/CreatePostModal';
import TopBar from '../components/TopBar';
import BirthdayModal from '../components/BirthdayModal';
import { db, auth } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  deleteDoc, doc, updateDoc, limit, arrayUnion, arrayRemove, runTransaction, getDoc, setDoc
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core'; 
import OneSignalWeb from 'react-onesignal'; 
import OneSignal from 'onesignal-cordova-plugin';
import { format } from 'date-fns';

// --- 1. SUBCOMPONENTES ---

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

const EmptyState = () => (
  <div className="text-center py-16 px-6 flex flex-col items-center opacity-60">
    <div className="bg-slate-100 p-6 rounded-full mb-4">
      <Heart size={48} className="text-slate-300" fill="currentColor" />
    </div>
    <h3 className="text-lg font-black text-slate-700">¡El muro está tranquilo!</h3>
    <p className="text-sm text-slate-500 mt-2 max-w-xs font-bold">Aún no hay publicaciones recientes.</p>
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
    <div className="bg-slate-50/50 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors mt-2" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {previewComments.map((c, idx) => (
        <div key={idx} className="flex gap-2 mb-1.5 last:mb-0">
          <span className="font-bold text-xs text-slate-800 whitespace-nowrap">{c.name?.split(' ')[0]}:</span>
          <span className="text-xs text-slate-600 line-clamp-1">{c.text}</span>
        </div>
      ))}
      <div className="mt-2 text-[10px] font-black text-brand-600 uppercase tracking-widest">Ver todos los comentarios...</div>
    </div>
  );
}

function ReactionsListModal({ post, onClose }) {
  const reactions = post.reactions || [];
  return (
    <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-[30px] p-0 max-h-[60vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Reacciones</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
        </div>
        <div className="space-y-4 p-5 overflow-y-auto no-scrollbar">
            {reactions.length === 0 && <p className="text-base text-slate-400 text-center py-8">Nadie ha reaccionado aún.</p>}
            {reactions.map((r, idx) => (
                <div key={idx} className="flex items-center gap-4">
                    <div className="relative">
                      <img src={r.photo || `https://ui-avatars.com/api/?name=${r.name}`} className="w-10 h-10 rounded-xl object-cover border" />
                      <span className="absolute -bottom-1 -right-1 text-base shadow-sm bg-white rounded-full p-0.5">{r.emoji}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">{r.name}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function ImageModal({ src, onClose }) { 
  return (
    <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-2 animate-fade-in" onClick={onClose}>
      <button className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full"><X size={28}/></button>
      <img src={src} className="max-w-full max-h-screen object-contain rounded-2xl shadow-2xl" />
    </div>
  ); 
}

// --- 2. COMPONENTE PRINCIPAL ---

export default function Home() {
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  
  const isModerator = dbUser?.role === 'pastor' || dbUser?.role === 'lider';
  const canCreatePost = isModerator || dbUser?.area === 'recepcion';
  const isNative = Capacitor.isNativePlatform(); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todo');
  const [birthdays, setBirthdays] = useState([]);
  const [toast, setToast] = useState(null);
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
      postsData.sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. CARGAR CUMPLEAÑOS Y AUTO-NOTIFICACIÓN
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const today = new Date();
      const currentMonthDay = format(today, 'MM-dd');
      const birthdayPeople = [];
      const allUsers = [];

      snapshot.forEach(doc => {
        const userData = { id: doc.id, ...doc.data() };
        allUsers.push(userData);
        if (userData.birthday && userData.birthday.slice(5) === currentMonthDay) {
            birthdayPeople.push(userData);
        }
      });
      setBirthdays(birthdayPeople);

      // Disparar revisión automática de notificaciones a las 11am
      if (allUsers.length > 0) {
        checkAndNotifyBirthdays(allUsers);
      }
    });
    return () => unsubscribe();
  }, []);

  // ✅ SISTEMA AUTOMÁTICO DE CUMPLEAÑOS
  const checkAndNotifyBirthdays = async (allUsers) => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const currentTime = format(today, 'HH:mm');
      
      if (currentTime < "11:00") return;

      const taskRef = doc(db, 'system_tasks', 'birthday_notif');
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists() && taskSnap.data().lastSent === todayStr) return;

      const currentMonthDay = format(today, 'MM-dd');
      const bdayPeople = allUsers.filter(u => u.birthday && u.birthday.slice(5) === currentMonthDay);

      if (bdayPeople.length > 0) {
        const names = bdayPeople.map(u => u.displayName.split(' ')[0]).join(', ');
        const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
        
        await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
          body: JSON.stringify({
            app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
            included_segments: ["Total Subscriptions"],
            headings: { en: "🎂 ¡Cumpleaños de hoy!", es: "🎂 ¡Cumpleaños de hoy!" },
            contents: { en: `Hoy celebramos a: ${names}. ¡Escríbeles un mensaje!`, es: `Hoy celebramos a: ${names}. ¡Escríbeles un mensaje!` },
            url: "https://cdsapp.vercel.app/#/",
            data: { route: "/" }
          })
        });
      }
      await setDoc(taskRef, { lastSent: todayStr }, { merge: true });
    } catch (e) { console.error(e); }
  };

  // ✅ FUNCIONES DE ACCIÓN CORREGIDAS

  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    try {
      await deleteDoc(doc(db, 'posts', postToDelete.id));
      setToast({ message: "Publicación eliminada", type: "success" });
      setPostToDelete(null);
    } catch (e) { setToast({ message: "Error al eliminar", type: "error" }); }
  };

  const handleVote = async (post, optionIdx) => {
    if (!currentUser) return;
    
    // Optimistic UI: Actualizamos localmente para que la barra se mueva YA
    const updatedPosts = posts.map(p => {
      if (p.id === post.id) {
        const voters = p.poll.voters || [];
        if (voters.includes(currentUser.uid)) return p;
        const newOptions = [...p.poll.options];
        newOptions[optionIdx].votes += 1;
        return { ...p, poll: { ...p.poll, options: newOptions, voters: [...voters, currentUser.uid] } };
      }
      return p;
    });
    setPosts(updatedPosts);

    // Persistencia en Firebase
    const postRef = doc(db, 'posts', post.id);
    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        const data = postDoc.data();
        const voters = data.poll.voters || [];
        if (voters.includes(currentUser.uid)) return;

        const newOptions = [...data.poll.options];
        newOptions[optionIdx].votes += 1;
        
        // Guardamos también el nombre del votante para las listas
        const voteRecord = { uid: currentUser.uid, name: currentUser.displayName, option: data.poll.options[optionIdx].text };
        
        transaction.update(postRef, {
          'poll.options': newOptions,
          'poll.voters': arrayUnion(currentUser.uid),
          'poll.votesDetails': arrayUnion(voteRecord)
        });
      });
    } catch (e) { console.error("Error voto:", e); }
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

  const handleHardResetNotifications = async () => {
    try {
      setToast({ message: "Reiniciando conexión...", type: "info" });
      if (isNative) {
        if (currentUser?.uid) OneSignal.login(currentUser.uid);
      } else {
        await OneSignalWeb.login(currentUser.uid);
      }
      setToast({ message: "¡Suscripción reparada!", type: "success" });
    } catch (e) { setToast({ message: "Error al reiniciar", type: "error" }); }
  };

  const handleLinkClick = (e, url) => {
    e.preventDefault(); e.stopPropagation();
    if (!url) return;
    if (url.startsWith('/')) { navigate(url); } 
    else { window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer'); }
  };

  const filteredPosts = filter === 'Todo' ? posts : posts.filter(post => post.type === filter);

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-outfit relative">
      <TopBar />

      <div className="px-4 mt-4 space-y-4">
          <div className="flex justify-center">
            <button onClick={handleHardResetNotifications} className="flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm">
                <AlertCircle size={16} /> Arreglar mis notificaciones
            </button>
          </div>

          <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} className={`bg-white p-5 border border-slate-100 rounded-3xl flex items-center justify-between shadow-sm transition-all ${birthdays.length > 0 ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl text-white ${birthdays.length > 0 ? 'bg-brand-500 animate-pulse' : 'bg-slate-300'}`}><Cake size={26} /></div>
              <div>
                <p className="text-base font-black text-slate-800 leading-none mb-1 text-left">Cumpleaños</p>
                <p className={`text-[10px] font-black uppercase tracking-widest ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                  {birthdays.length > 0 ? `${birthdays.length} Hermanos hoy 🎂` : "Nadie cumple hoy"}
                </p>
              </div>
            </div>
            {birthdays.length > 0 && <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">Ver</span>}
          </div>

          <div className="flex gap-3 overflow-x-auto py-2 mb-4 no-scrollbar">
            {['Todo', 'Noticia', 'Devocional', 'Urgente'].map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-all whitespace-nowrap shadow-sm ${filter === cat ? 'bg-slate-900 text-white shadow-xl' : 'bg-white border border-slate-200 text-slate-400'}`}>{cat}</button>
            ))}
          </div>
      </div>

      <div className="space-y-6 px-0 sm:px-4 mt-2">
        {loading ? (
            <div className="px-4"><PostSkeleton /><PostSkeleton /></div>
        ) : filteredPosts.length === 0 ? (
            <EmptyState />
        ) : (
            filteredPosts.map(post => (
              <div key={post.id} className={`bg-white pt-6 sm:rounded-[40px] shadow-sm border-y sm:border border-slate-100 relative ${post.type === 'Urgente' ? 'border-l-4 border-l-rose-500' : ''} ${post.isPinned ? 'bg-slate-50/80' : ''}`}>
                {post.isPinned && <div className="absolute top-0 right-12 bg-brand-600 text-white px-3 py-1 rounded-b-xl text-[9px] font-black tracking-widest shadow-lg flex items-center gap-1"><Pin size={10} /> FIJADO</div>}
                
                <div className="flex justify-between items-start mb-4 px-6">
                  <div className="flex items-center gap-3">
                      <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-12 h-12 rounded-2xl border shadow-sm object-cover" />
                      <div className="text-left">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">{post.authorName} <span className="text-[8px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded ml-1 tracking-widest font-black uppercase">{post.role}</span></h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Reciente'}</p>
                      </div>
                  </div>
                  
                  {(isModerator || post.authorId === currentUser?.uid) && (
                    <div className="relative">
                      <button onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><MoreVertical size={24}/></button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-10 bg-white shadow-2xl rounded-2xl border border-slate-100 py-2 w-48 z-[60] animate-scale-in origin-top-right overflow-hidden">
                          {isModerator && (
                            <button onClick={async () => { await updateDoc(doc(db, 'posts', post.id), { isPinned: !post.isPinned }); setMenuOpenId(null); }} className="w-full text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                              <Pin size={16} className={post.isPinned ? "text-brand-600" : ""}/> {post.isPinned ? 'Desfijar' : 'Fijar arriba'}
                            </button>
                          )}
                          <button onClick={() => { setEditingPost(post); setIsModalOpen(true); setMenuOpenId(null); }} className="w-full text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                            <Edit3 size={16}/> Editar
                          </button>
                          <button onClick={() => { setPostToDelete(post); setMenuOpenId(null); }} className="w-full text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 flex items-center gap-3">
                            <Trash2 size={16}/> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-6 mb-4 cursor-pointer text-left" onClick={() => navigate(`/post/${post.id}`)}>
                  {post.type === 'Devocional' && <h2 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tighter">{post.title}</h2>}
                  <div className={`text-[15px] text-slate-800 whitespace-pre-wrap leading-relaxed line-clamp-4 font-medium tracking-tight`}>{post.content}</div>
                </div>

                {post.image && <div className="w-full mb-4 bg-slate-100 cursor-zoom-in" onClick={() => setFullImage(post.image)}><img src={post.image} className="w-full h-auto max-h-[500px] object-cover" /></div>}
                
                {post.link && (
                    <div className="px-6 mb-4">
                        <button onClick={(e) => handleLinkClick(e, post.link)} className="flex items-center justify-between w-full bg-slate-50 border border-slate-100 p-4 rounded-[22px] transition-all hover:bg-slate-100 active:scale-[0.98]">
                          <span className="text-xs font-black text-brand-700 flex items-center gap-3 uppercase tracking-widest">{post.link.startsWith('/') ? <Calendar size={18} /> : <LinkIcon size={18} />} {post.linkText || 'Ver más'}</span>
                          <ExternalLink size={16} className="text-slate-300" />
                        </button>
                    </div>
                )}

                {post.poll && (
                   <div className="px-6 mb-4">
                      <div className="bg-slate-50 rounded-[24px] p-5 border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-left">Encuesta rápida</p>
                        {post.poll.options.map((opt, idx) => {
                          const voters = post.poll.voters || [];
                          const total = voters.length || 0;
                          const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                          return (
                            <button key={idx} onClick={() => handleVote(post, idx)} disabled={voters.includes(currentUser?.uid)} className="w-full relative mb-3 h-12 rounded-xl overflow-hidden bg-white border border-slate-100 text-left active:scale-[0.98] transition-transform">
                              <div className="absolute top-0 left-0 h-full bg-brand-100/50 transition-all duration-700" style={{ width: `${percent}%` }}></div>
                              <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-black uppercase z-10 text-slate-700"><span>{opt.text}</span><span>{percent}%</span></div>
                            </button>
                          )
                        })}
                        {isModerator && (
                          <div className="mt-2 text-[8px] font-black text-slate-300 uppercase text-center tracking-widest">
                            Votos totales: {post.poll.voters?.length || 0}
                          </div>
                        )}
                      </div>
                   </div>
                )}

                <div className="px-6 py-5 border-t border-slate-50 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setReactionPickerOpen(reactionPickerOpen === post.id ? null : post.id)} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-sm bg-white hover:bg-slate-50 shadow-sm active:scale-90 transition-all">😊+</button>
                        {reactionPickerOpen === post.id && (
                          <div className="absolute bottom-16 left-6 bg-white shadow-2xl rounded-full p-2 flex gap-2 border border-slate-100 z-[70] animate-scale-in">
                            {REACTION_TYPES.map(emoji => (
                              <button key={emoji} onClick={() => handleReaction(post, emoji)} className="text-2xl hover:scale-125 transition-transform p-1.5 active:scale-90">{emoji}</button>
                            ))}
                          </div>
                        )}
                        {Object.entries(post.reactions?.reduce((acc, r) => ({...acc, [r.emoji]: (acc[r.emoji] || 0) + 1}), {}) || {}).map(([emoji, count]) => (
                            <button key={emoji} onClick={() => setShowReactionsFor(post)} className="bg-white border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-black text-slate-600 flex items-center gap-1.5 shadow-sm hover:bg-slate-50 active:scale-95 transition-all">{emoji} {count}</button>
                        ))}
                    </div>
                    <button onClick={() => navigate(`/post/${post.id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 px-4 py-2 rounded-2xl hover:bg-brand-50 transition-all">
                      <MessageCircle size={18} /> Comentar
                    </button>
                  </div>
                  <CommentPreview postId={post.id} onClick={() => navigate(`/post/${post.id}`)} />
                </div>
              </div>
            ))
        )}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} className="fixed bottom-28 right-5 w-16 h-16 bg-brand-600 text-white rounded-[24px] shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 z-40 transition-all border-4 border-white">
          <PlusCircle size={32} />
        </button>
      )}

      {toast && (
        <div className="fixed bottom-24 left-6 right-6 z-[2000] animate-slide-up">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-[24px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{toast.message}</span>
          </div>
        </div>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      {fullImage && <ImageModal src={fullImage} onClose={() => setFullImage(null)} />}
      {showReactionsFor && <ReactionsListModal post={showReactionsFor} onClose={() => setShowReactionsFor(null)} />}
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />

      {postToDelete && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32}/></div>
            <h3 className="font-black text-slate-800 text-lg mb-2 tracking-tight uppercase">¿Eliminar post?</h3>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-8 leading-relaxed text-center">Esta acción es irreversible.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleConfirmDelete} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-200">Confirmar</button>
              <button onClick={() => setPostToDelete(null)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}