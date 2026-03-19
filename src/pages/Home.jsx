import { useState, useEffect, useMemo } from 'react';
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
    <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
  </div>
);

const EmptyState = () => (
  <div className="text-center py-16 px-6 flex flex-col items-center opacity-60">
    <div className="bg-slate-100 p-6 rounded-full mb-4">
      <Heart size={48} className="text-slate-300" fill="currentColor" />
    </div>
    <h3 className="text-lg font-black text-slate-700 uppercase tracking-tighter">Muro en silencio</h3>
    <p className="text-xs text-slate-500 mt-2 max-w-xs font-bold uppercase tracking-widest leading-loose text-center">Pronto habrá nuevas bendiciones compartidas aquí.</p>
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
        <div key={idx} className="flex gap-2 mb-1.5 last:mb-0 text-left">
          <span className="font-bold text-xs text-slate-800 whitespace-nowrap">{c.name?.split(' ')[0]}:</span>
          <span className="text-xs text-slate-600 line-clamp-1">{c.text}</span>
        </div>
      ))}
      <div className="mt-2 text-[9px] font-black text-brand-600 uppercase tracking-[0.2em] text-left">Ver la conversación...</div>
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

  // 2. CARGAR CUMPLEAÑOS
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const today = new Date();
      const currentMonthDay = format(today, 'MM-dd');
      const bdayList = [];
      const allUsers = [];
      snapshot.forEach(doc => {
        const u = { id: doc.id, ...doc.data() };
        allUsers.push(u);
        if (u.birthday && u.birthday.slice(5) === currentMonthDay) bdayList.push(u);
      });
      setBirthdays(bdayList);
      if (allUsers.length > 0) checkAndNotifyBirthdays(allUsers);
    });
    return () => unsubscribe();
  }, []);

  const checkAndNotifyBirthdays = async (allUsers) => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      if (format(today, 'HH:mm') < "11:00") return;
      const taskRef = doc(db, 'system_tasks', 'birthday_notif');
      const taskSnap = await getDoc(taskRef);
      if (taskSnap.exists() && taskSnap.data().lastSent === todayStr) return;

      const bdayPeople = allUsers.filter(u => u.birthday && u.birthday.slice(5) === format(today, 'MM-dd'));
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
            contents: { en: `Hoy celebramos a: ${names}. ¡Mándales un saludo!`, es: `Hoy celebramos a: ${names}. ¡Mándales un saludo!` },
            data: { route: "/" }
          })
        });
      }
      await setDoc(taskRef, { lastSent: todayStr }, { merge: true });
    } catch (e) { /* silent */ }
  };

  const handleVote = async (post, optionIdx) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        const data = postDoc.data();
        const voters = data.poll.voters || [];
        const voteRecord = data.poll.votesDetails?.find(v => v.uid === currentUser.uid);
        
        let newOptions = [...data.poll.options];
        let newVoters = [...voters];
        let newVotesDetails = data.poll.votesDetails ? [...data.poll.votesDetails] : [];

        if (voteRecord) {
            const prevOptionText = voteRecord.option;
            const prevOptIdx = newOptions.findIndex(o => o.text === prevOptionText);
            if (prevOptIdx !== -1) newOptions[prevOptIdx].votes = Math.max(0, newOptions[prevOptIdx].votes - 1);
            
            newVoters = newVoters.filter(id => id !== currentUser.uid);
            newVotesDetails = newVotesDetails.filter(v => v.uid !== currentUser.uid);
            
            if (data.poll.options[optionIdx].text !== prevOptionText) {
                newOptions[optionIdx].votes += 1;
                newVoters.push(currentUser.uid);
                newVotesDetails.push({ uid: currentUser.uid, name: currentUser.displayName, option: data.poll.options[optionIdx].text });
            }
        } else {
            newOptions[optionIdx].votes += 1;
            newVoters.push(currentUser.uid);
            newVotesDetails.push({ uid: currentUser.uid, name: currentUser.displayName, option: data.poll.options[optionIdx].text });
        }

        transaction.update(postRef, {
          'poll.options': newOptions,
          'poll.voters': newVoters,
          'poll.votesDetails': newVotesDetails
        });
      });
    } catch (e) { /* error silent */ }
  };

  const handleLinkClick = (e, url) => {
    e.preventDefault(); e.stopPropagation();
    if (!url) return;
    if (url.startsWith('/')) navigate(url);
    else window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
  };

  const handleReaction = async (post, emoji) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    const reactions = post.reactions || [];
    const myIdx = reactions.findIndex(r => r.uid === currentUser.uid);
    let newReactions = [...reactions];
    if (myIdx >= 0) {
      if (reactions[myIdx].emoji === emoji) newReactions.splice(myIdx, 1);
      else newReactions[myIdx].emoji = emoji;
    } else {
      newReactions.push({ uid: currentUser.uid, name: currentUser.displayName, emoji });
    }
    await updateDoc(postRef, { reactions: newReactions });
    setReactionPickerOpen(null);
  };

  const filteredPosts = useMemo(() => {
    return filter === 'Todo' ? posts : posts.filter(p => p.type === filter);
  }, [filter, posts]);

  return (
    <div className="pb-36 animate-fade-in min-h-screen bg-slate-50 font-outfit relative">
      <TopBar />

      <div className="px-4 mt-6 space-y-4">
          <div onClick={() => birthdays.length > 0 && setIsBirthdayModalOpen(true)} className={`bg-white p-5 border border-slate-100 rounded-[30px] flex items-center justify-between shadow-sm transition-all ${birthdays.length > 0 ? 'bg-gradient-to-r from-white to-brand-50/30 active:scale-95' : ''}`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white ${birthdays.length > 0 ? 'bg-brand-500 shadow-lg shadow-brand-200 animate-pulse' : 'bg-slate-200'}`}><Cake size={28} /></div>
              <div className="text-left">
                <p className="text-base font-black text-slate-800 tracking-tighter uppercase">Cumpleaños</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${birthdays.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                  {birthdays.length > 0 ? `${birthdays.length} Hermanos hoy 🎂` : "No hay festejos hoy"}
                </p>
              </div>
            </div>
            {birthdays.length > 0 && <span className="text-[9px] font-black text-white bg-brand-600 px-3 py-1.5 rounded-full uppercase shadow-md">Ver</span>}
          </div>

          <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
            {['Todo', 'Noticia', 'Devocional', 'Urgente'].map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-full transition-all whitespace-nowrap ${filter === cat ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white border border-slate-200 text-slate-400'}`}>{cat}</button>
            ))}
          </div>
      </div>

      <div className="space-y-6 px-0 sm:px-4 mt-4">
        {loading ? (
            <div className="px-4"><PostSkeleton /><PostSkeleton /></div>
        ) : filteredPosts.length === 0 ? (
            <EmptyState />
        ) : (
            filteredPosts.map(post => {
              const myVote = post.poll?.votesDetails?.find(v => v.uid === currentUser.uid);
              // 🛡️ REFUERZO DE IMAGEN DE PERFIL: Si no hay URL o está vacía, usamos avatar
              const profileImg = (post.authorPhoto && post.authorPhoto.trim() !== "") 
                ? post.authorPhoto 
                : `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`;

              return (
              <div key={post.id} className={`bg-white pt-6 sm:rounded-[40px] shadow-sm border-y sm:border border-slate-100 relative ${post.type === 'Urgente' ? 'border-l-4 border-l-rose-500' : ''} ${post.isPinned ? 'bg-slate-50/50' : ''}`}>
                {post.isPinned && <div className="absolute top-0 right-10 bg-brand-600 text-white px-3 py-1 rounded-b-xl text-[8px] font-black tracking-[0.2em] shadow-lg flex items-center gap-1"><Pin size={10} /> FIJADO</div>}
                
                <div className="flex justify-between items-start mb-5 px-6">
                  <div className="flex items-center gap-3">
                      {/* ✅ FIX ANDROID: CONTENEDOR RÍGIDO CON ALTURA FIJA */}
                      <div className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl border-2 border-white shadow-md overflow-hidden bg-slate-200 shrink-0">
                        <img 
                          src={profileImg} 
                          className="w-full h-full object-cover block" 
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          alt="Perfil"
                        />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter">{post.authorName}</h3>
                        <p className="text-[8px] font-black text-brand-500 uppercase tracking-widest bg-brand-50 px-1.5 py-0.5 rounded-md inline-block mt-0.5">{post.role}</p>
                      </div>
                  </div>
                  
                  {(isModerator || post.authorId === currentUser?.uid) && (
                    <div className="relative">
                      <button onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)} className="p-2 text-slate-300 active:text-slate-900"><MoreVertical size={24}/></button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-10 bg-white shadow-2xl rounded-2xl border border-slate-100 py-2 w-48 z-[60] animate-scale-in origin-top-right overflow-hidden">
                          {isModerator && (
                            <button onClick={async () => { await updateDoc(doc(db, 'posts', post.id), { isPinned: !post.isPinned }); setMenuOpenId(null); }} className="w-full text-left px-5 py-3.5 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                              <Pin size={14} className={post.isPinned ? "text-brand-600" : ""}/> {post.isPinned ? 'Desfijar' : 'Fijar arriba'}
                            </button>
                          )}
                          <button onClick={() => { setEditingPost(post); setIsModalOpen(true); setMenuOpenId(null); }} className="w-full text-left px-5 py-3.5 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                            <Edit3 size={14}/> Editar
                          </button>
                          <button onClick={async () => { if(window.confirm('¿Eliminar?')){ await deleteDoc(doc(db, 'posts', post.id)); } setMenuOpenId(null); }} className="w-full text-left px-5 py-3.5 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 flex items-center gap-3">
                            <Trash2 size={14}/> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-6 mb-4 cursor-pointer text-left" onClick={() => navigate(`/post/${post.id}`)}>
                  {post.type === 'Devocional' && <h2 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter leading-tight">{post.title}</h2>}
                  <div className="text-[15px] text-slate-800 whitespace-pre-wrap leading-relaxed line-clamp-5 font-medium tracking-tight">{post.content}</div>
                </div>

                {/* ✅ FIX ANDROID: ALTURA MÍNIMA PARA EL POST IMAGE */}
                {post.image && (
                  <div className="w-full mb-4 bg-slate-100 cursor-pointer min-h-[200px] flex items-center justify-center overflow-hidden" onClick={() => navigate(`/post/${post.id}`)}>
                    <img 
                      src={post.image} 
                      className="w-full h-auto max-h-[500px] object-cover block" 
                      loading="lazy" 
                      referrerPolicy="no-referrer"
                      alt="Post"
                    />
                  </div>
                )}
                
                {post.link && (
                    <div className="px-6 mb-4">
                        <button onClick={(e) => handleLinkClick(e, post.link)} className="flex items-center justify-between w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-[22px] active:scale-[0.98] shadow-sm">
                          <span className="text-[10px] font-black text-brand-700 flex items-center gap-3 uppercase tracking-widest">{post.link.startsWith('/') ? <Calendar size={18} /> : <LinkIcon size={18} />} {post.linkText || 'Ver más'}</span>
                          <ExternalLink size={16} className="text-slate-300" />
                        </button>
                    </div>
                )}

                {post.poll && (
                   <div className="px-6 mb-4">
                      <div className="bg-slate-50 rounded-[30px] p-5 border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-left">Encuesta rápida</p>
                        {post.poll.options.map((opt, idx) => {
                          const total = post.poll.voters?.length || 0;
                          const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                          const isMyOption = myVote?.option === opt.text;
                          return (
                            <button key={idx} onClick={() => handleVote(post, idx)} className="w-full relative mb-3 h-12 rounded-xl overflow-hidden bg-white border border-slate-100 text-left active:scale-[0.98] transition-all">
                              <div className={`absolute top-0 left-0 h-full transition-all duration-700 ${isMyOption ? 'bg-brand-500/20' : 'bg-slate-100'}`} style={{ width: `${percent}%` }}></div>
                              <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-black uppercase z-10 text-slate-700">
                                <span>{opt.text} {isMyOption && '✓'}</span>
                                <span className="opacity-40">{percent}%</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                   </div>
                )}

                <div className="px-6 py-5 border-t border-slate-50 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setReactionPickerOpen(reactionPickerOpen === post.id ? null : post.id)} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-sm bg-white active:scale-90 shadow-sm">😊+</button>
                        {reactionPickerOpen === post.id && (
                          <div className="absolute bottom-16 left-6 bg-white shadow-2xl rounded-full p-2 flex gap-2 border border-slate-100 z-[70] animate-scale-in">
                            {['👍', '❤️', '🔥', '🙏', '😂'].map(emoji => (
                              <button key={emoji} onClick={() => handleReaction(post, emoji)} className="text-2xl hover:scale-125 transition-transform p-1.5">{emoji}</button>
                            ))}
                          </div>
                        )}
                        {Object.entries(post.reactions?.reduce((acc, r) => ({...acc, [r.emoji]: (acc[r.emoji] || 0) + 1}), {}) || {}).map(([emoji, count]) => (
                            <div key={emoji} className="bg-white border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-black text-slate-600 flex items-center gap-1.5 shadow-sm">{emoji} {count}</div>
                        ))}
                    </div>
                    <button onClick={() => navigate(`/post/${post.id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 active:scale-95 transition-all px-2 py-1">
                      <MessageCircle size={18} /> Comentar
                    </button>
                  </div>
                  <CommentPreview postId={post.id} onClick={() => navigate(`/post/${post.id}`)} />
                </div>
              </div>
            )})
        )}
      </div>

      {canCreatePost && (
        <button onClick={() => { setEditingPost(null); setIsModalOpen(true); }} className="fixed bottom-28 right-5 w-16 h-16 bg-brand-600 text-white rounded-[24px] shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 z-40 transition-all border-4 border-white">
          <PlusCircle size={32} />
        </button>
      )}

      <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} postToEdit={editingPost} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} users={birthdays} dbUser={dbUser} />

      {toast && (
        <div className="fixed bottom-24 left-6 right-6 z-[2000] animate-slide-up">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-[24px] shadow-2xl border-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}