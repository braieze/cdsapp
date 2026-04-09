import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, collection, query, orderBy, onSnapshot, 
  addDoc, serverTimestamp, deleteDoc, updateDoc, arrayUnion, runTransaction 
} from 'firebase/firestore';
import { 
  X, MessageCircle, Send, Trash2, ExternalLink, 
  Link as LinkIcon, Loader2, Calendar, CheckCircle,
  ChevronLeft, BookOpen, Heart, Flame, HandHeart, ThumbsUp, // ✅ Cambiado a HandHeart
  Anchor, Smile, Sun, CloudRain, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const isModerator = dbUser?.role === 'pastor' || dbUser?.role === 'lider';

  useEffect(() => {
    if (!postId) return;
    
    // Escucha del Post en tiempo real
    const unsubPost = onSnapshot(doc(db, 'posts', postId), (docSnap) => {
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() });
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    // Escucha de Comentarios
    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'));
    const unsubComments = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPost();
      unsubComments();
    };
  }, [postId, navigate]);

  const handleReaction = async (emoji) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    const reactions = post.reactions || [];
    const myIdx = reactions.findIndex(r => r.uid === currentUser.uid);
    let newReactions = [...reactions];
    
    if (myIdx >= 0) {
      if (newReactions[myIdx].emoji === emoji) newReactions.splice(myIdx, 1);
      else newReactions[myIdx].emoji = emoji;
    } else {
      newReactions.push({ uid: currentUser.uid, name: currentUser.displayName, emoji });
    }
    await updateDoc(postRef, { reactions: newReactions });
  };

  const handleVote = async (optionIdx) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        const data = postDoc.data();
        const voteIndex = data.poll.votesDetails?.findIndex(v => v.uid === currentUser.uid);
        
        let newOptions = [...data.poll.options];
        let newVoters = [...(data.poll.voters || [])];
        let newVotesDetails = data.poll.votesDetails ? [...data.poll.votesDetails] : [];

        if (voteIndex !== -1) {
            const previousOptionText = newVotesDetails[voteIndex].option;
            const prevOptIdx = newOptions.findIndex(o => o.text === previousOptionText);
            if (prevOptIdx !== -1) newOptions[prevOptIdx].votes = Math.max(0, newOptions[prevOptIdx].votes - 1);
            newVoters = newVoters.filter(id => id !== currentUser.uid);
            newVotesDetails.splice(voteIndex, 1);
            if (data.poll.options[optionIdx].text !== previousOptionText) {
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
    } catch (e) { console.error(e); }
  };

  const sendComment = async () => {
    if (!commentText.trim() || isSending) return;
    setIsSending(true);
    try {
        const commentData = {
          text: commentText,
          uid: currentUser.uid,
          name: currentUser.displayName,
          photo: currentUser.photoURL,
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, `posts/${postId}/comments`), commentData);
        await updateDoc(doc(db, 'posts', postId), { commentsCount: (post.commentsCount || 0) + 1 });
        setCommentText('');
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  const deleteComment = async (commentId) => {
    if (window.confirm("¿Eliminar comentario?")) {
      await deleteDoc(doc(db, `posts/${postId}/comments`, commentId));
      await updateDoc(doc(db, 'posts', postId), { commentsCount: Math.max(0, (post.commentsCount || 1) - 1) });
    }
  };

  if (loading) return <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center font-outfit"><Loader2 className="animate-spin text-brand-600 mb-4" size={48}/><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abriendo contenido...</p></div>;
  if (!post) return null;

  const isDevocional = post.type === 'Devocional';
  const isOracion = post.type === 'Oración';
  const reactions = post.reactions || [];

  return (
    <div className="fixed inset-0 z-[120] bg-white flex flex-col animate-fade-in overflow-hidden font-outfit text-left">
      
      {!isDevocional && (
        <header className="flex items-center justify-between p-5 border-b border-slate-50 bg-white shrink-0 z-50">
          <button onClick={() => navigate(-1)} className="p-2.5 bg-slate-50 rounded-2xl active:scale-75 transition-all text-slate-800"><ChevronLeft size={24} /></button>
          <div className="text-center">
              <span className={`font-black uppercase tracking-widest text-[10px] ${isOracion ? 'text-purple-600' : 'text-slate-400'}`}>{post.type}</span>
              <h1 className="text-sm font-black text-slate-900 uppercase truncate max-w-[180px]">{post.title}</h1>
          </div>
          <div className="w-10"></div>
        </header>
      )}

      <div className="flex-1 overflow-y-auto pb-40 no-scrollbar relative bg-slate-50/30">
        
        {isDevocional && (
          <div className="relative w-full h-[55vh] shrink-0">
             <button onClick={() => navigate(-1)} className="absolute top-12 left-6 z-[60] p-3 bg-black/20 backdrop-blur-xl rounded-2xl text-white active:scale-75 transition-all border border-white/20"><ChevronLeft size={24} /></button>
             {post.image ? (
               <img src={post.image} className="w-full h-full object-cover" alt="portada" referrerPolicy="no-referrer" />
             ) : (
               <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-brand-900" />
             )}
             <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/30" />
             <div className="absolute bottom-0 left-0 right-0 p-8 text-left">
                <div className="flex gap-2 mb-4">
                  <span className="px-3 py-1 bg-brand-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">Devocional</span>
                  {post.mood && <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 text-[9px] font-black uppercase tracking-widest rounded-full shadow-md">{post.mood}</span>}
                </div>
                <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{post.title}</h1>
             </div>
          </div>
        )}

        <div className={`p-8 ${!isDevocional ? 'mt-2' : ''}`}>
            
            {!isDevocional && (
              <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl border-2 border-white shadow-xl overflow-hidden shrink-0 bg-slate-100">
                      <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=0f172a&color=fff`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="text-left">
                      <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight leading-none">{post.authorName}</h3>
                      <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1.5">{post.createdAt ? format(post.createdAt.toDate(), "d 'de' MMMM", { locale: es }) : 'Recién publicado'}</p>
                  </div>
              </div>
            )}

            <div className={`text-left ${isOracion ? 'bg-purple-50 p-6 rounded-[35px] border-2 border-purple-100 mb-8 shadow-inner' : ''}`}>
                {isOracion && <HandHeart size={32} className="text-purple-600 mb-4 animate-pulse"/>}
                <p className="text-[16px] text-slate-800 whitespace-pre-wrap leading-relaxed font-medium tracking-tight">
                  {post.content}
                </p>
            </div>

            {post.image && !isDevocional && (
                <div className="my-8 rounded-[40px] overflow-hidden border-4 border-white shadow-2xl">
                    <img src={post.image} className="w-full h-auto object-cover" alt="Imagen" referrerPolicy="no-referrer" />
                </div>
            )}

            {post.link && (
                <button 
                    onClick={() => post.link.startsWith('/') ? navigate(post.link) : window.open(post.link.startsWith('http') ? post.link : `https://${post.link}`, '_blank')}
                    className="flex items-center justify-between w-full bg-slate-900 text-white p-6 rounded-[30px] transition-all active:scale-95 shadow-xl mt-4"
                >
                    <span className="text-[11px] font-black flex items-center gap-4 uppercase tracking-[0.2em]">
                        {post.link.startsWith('/') ? <Calendar size={22} className="text-brand-400" /> : <LinkIcon size={22} className="text-brand-400" />} 
                        {post.linkText || 'Más información'}
                    </span>
                    <ExternalLink size={18} className="opacity-40" />
                </button>
            )}

            {post.poll && (
               <div className="mt-10 bg-white rounded-[40px] p-8 border-2 border-slate-50 shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-2">📊 Encuesta</p>
                  {post.poll.options.map((opt, idx) => {
                    const total = post.poll.voters?.length || 0;
                    const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                    const myVote = post.poll.votesDetails?.find(v => v.uid === currentUser.uid);
                    const isMyOption = myVote?.option === opt.text;

                    return (
                      <button key={idx} onClick={() => handleVote(idx)} className="w-full relative mb-4 h-14 rounded-2xl overflow-hidden bg-slate-50 border-2 border-transparent active:scale-[0.98] transition-all text-left">
                        <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ${isMyOption ? 'bg-brand-500/20' : 'bg-slate-200/50'}`} style={{ width: `${percent}%` }}></div>
                        <div className="absolute inset-0 flex items-center justify-between px-6 text-[11px] font-black uppercase z-10">
                            <span className={isMyOption ? 'text-brand-700' : 'text-slate-700'}>{opt.text} {isMyOption && '✓'}</span>
                            <span className="text-slate-400">{percent}%</span>
                        </div>
                      </button>
                    )
                  })}
               </div>
            )}

            <div className="mt-12 bg-white p-2 rounded-[28px] border-2 border-slate-50 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar shadow-sm">
                {[ {e: '❤️'}, {e: '🔥'}, {e: '🙏'}, {e: '👍'}].map(item => {
                    const count = reactions.filter(r => r.emoji === item.e).length;
                    const isSelected = reactions.some(r => r.uid === currentUser.uid && r.emoji === item.e);
                    return (
                      <button key={item.e} onClick={() => handleReaction(item.e)} 
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all active:scale-75 shadow-sm border-2 ${isSelected ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-white text-slate-600'}`}>
                        <span className="text-xl">{item.e}</span>
                        {count > 0 && <span className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{count}</span>}
                      </button>
                    )
                })}
            </div>

            <section className="mt-12 text-left pb-20">
              <h3 className="font-black text-[12px] text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3 px-2">
                <MessageCircle className="text-brand-600" size={20}/> {comments.length} Comentarios
              </h3>
              <div className="space-y-6">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-4 animate-fade-in group items-start text-left">
                    <div className="w-11 h-11 rounded-xl border-2 border-white shadow-lg overflow-hidden shrink-0 bg-slate-100">
                        <img src={c.photo || `https://ui-avatars.com/api/?name=${c.name}&background=0f172a&color=fff`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 bg-white p-5 rounded-[28px] border border-slate-100 relative shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-[10px] text-brand-600 uppercase">{c.name}</span>
                        {(c.uid === currentUser.uid || isModerator) && (
                          <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={14}/></button>
                        )}
                      </div>
                      <p className="text-[14px] text-slate-700 leading-relaxed font-semibold">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
        </div>
      </div>

      <footer className="p-6 border-t border-slate-50 bg-white/80 backdrop-blur-xl absolute bottom-0 w-full flex gap-3 items-center z-50">
        <div className="flex-1 relative text-left">
           <input 
            value={commentText} 
            onChange={e => setCommentText(e.target.value)} 
            placeholder="Escribe algo..." 
            className="w-full bg-slate-100 rounded-2xl px-6 py-5 text-sm outline-none focus:ring-4 focus:ring-brand-50 transition-all font-bold shadow-inner"
          />
          <MessageCircle className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
        </div>
        <button 
          onClick={sendComment} 
          disabled={!commentText.trim() || isSending} 
          className="w-16 h-16 bg-slate-900 text-white rounded-[22px] flex items-center justify-center disabled:opacity-30 shadow-2xl active:scale-90 transition-all"
        >
          {isSending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24}/>}
        </button>
      </footer>
    </div>
  );
}