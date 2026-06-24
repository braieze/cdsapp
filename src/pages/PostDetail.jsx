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
  ChevronLeft, BookOpen, Heart, Flame, HandHeart, ThumbsUp,
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

  if (loading) return <div className="fixed inset-0 bg-[#F8F9FE] z-[100] flex flex-col items-center justify-center font-sans"><Loader2 className="animate-spin text-blue-600 mb-4" size={40}/><p className="text-sm font-semibold text-slate-500">Cargando...</p></div>;
  if (!post) return null;

  const isDevocional = post.type === 'Devocional';
  const isOracion = post.type === 'Oración';
  const reactions = post.reactions || [];

  return (
    <div className="fixed inset-0 z-[120] bg-white flex flex-col animate-fade-in overflow-hidden font-sans text-left">
      
      {/* HEADER ESTILO SOCIALYO */}
      {!isDevocional && (
        <header className="flex items-center justify-between px-5 pt-12 pb-4 bg-white border-b border-slate-100 shrink-0 z-50 rounded-b-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-slate-700 active:scale-90 transition-transform">
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          <div className="text-center flex-1 px-4">
              <h1 className="text-lg font-bold text-slate-900 truncate max-w-[200px] mx-auto">{post.title}</h1>
              <span className={`font-semibold text-xs capitalize ${isOracion ? 'text-purple-600' : 'text-blue-600'}`}>{post.type}</span>
          </div>
          <div className="w-10"></div>
        </header>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-y-auto pb-28 no-scrollbar relative bg-[#F8F9FE]">
        
        {isDevocional && (
          <div className="relative w-full h-[45vh] shrink-0 rounded-b-[40px] overflow-hidden shadow-sm">
             <button onClick={() => navigate(-1)} className="absolute top-12 left-5 z-[60] w-10 h-10 flex items-center justify-center bg-white/30 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"><ChevronLeft size={26} strokeWidth={2.5} /></button>
             {post.image ? (
               <img src={post.image} className="w-full h-full object-cover" alt="portada" referrerPolicy="no-referrer" />
             ) : (
               <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-700" />
             )}
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
             <div className="absolute bottom-0 left-0 right-0 p-6 text-left">
                <div className="flex gap-2 mb-3">
                  <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">Devocional</span>
                  {post.mood && <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-full">{post.mood}</span>}
                </div>
                <h1 className="text-3xl font-bold text-white leading-tight">{post.title}</h1>
             </div>
          </div>
        )}

        <div className={`max-w-md mx-auto ${!isDevocional ? 'mt-4' : 'mt-6'} px-5`}>
            
            {/* AUTOR - DISEÑO LIMPIO */}
            {!isDevocional && (
              <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-50">
                  <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=EBF4FF&color=2563EB`} className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-100" referrerPolicy="no-referrer" />
                  <div className="text-left flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-[15px] truncate">{post.authorName}</h3>
                      <p className="text-xs font-medium text-slate-500">{post.createdAt ? format(post.createdAt.toDate(), "d 'de' MMMM, HH:mm", { locale: es }) : 'Recién publicado'}</p>
                  </div>
              </div>
            )}

            {/* TEXTO DEL POST */}
            <div className={`text-left mb-6 ${isOracion ? 'bg-purple-50 p-5 rounded-[24px] border border-purple-100' : 'px-1'}`}>
                {isOracion && <HandHeart size={28} className="text-purple-500 mb-3"/>}
                <p className="text-[15px] text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {post.content}
                </p>
            </div>

            {/* IMAGEN DEL POST */}
            {post.image && !isDevocional && (
                <div className="mb-6 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 bg-white">
                    <img src={post.image} className="w-full h-auto object-cover" alt="Imagen adjunta" referrerPolicy="no-referrer" />
                </div>
            )}

            {/* ENLACE EXTERNO */}
            {post.link && (
                <button 
                    onClick={() => post.link.startsWith('/') ? navigate(post.link) : window.open(post.link.startsWith('http') ? post.link : `https://${post.link}`, '_blank')}
                    className="flex items-center justify-between w-full bg-blue-50 text-blue-600 p-4 rounded-2xl transition-all active:scale-95 mb-6 border border-blue-100"
                >
                    <span className="text-sm font-bold flex items-center gap-3">
                        {post.link.startsWith('/') ? <Calendar size={20} /> : <LinkIcon size={20} />} 
                        {post.linkText || 'Ver más información'}
                    </span>
                    <ExternalLink size={18} className="opacity-60" />
                </button>
            )}

            {/* ENCUESTA - ESTILO SOCIALYO */}
            {post.poll && (
               <div className="mb-8 bg-white rounded-[32px] p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><BookOpen size={16}/> Encuesta</p>
                  <div className="space-y-3">
                    {post.poll.options.map((opt, idx) => {
                      const total = post.poll.voters?.length || 0;
                      const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                      const myVote = post.poll.votesDetails?.find(v => v.uid === currentUser.uid);
                      const isMyOption = myVote?.option === opt.text;

                      return (
                        <button key={idx} onClick={() => handleVote(idx)} className={`w-full relative h-12 rounded-xl overflow-hidden border transition-all text-left ${isMyOption ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <div className={`absolute top-0 left-0 h-full transition-all duration-700 ${isMyOption ? 'bg-blue-100' : 'bg-slate-100'}`} style={{ width: `${percent}%` }}></div>
                          <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-semibold z-10">
                              <span className={isMyOption ? 'text-blue-700' : 'text-slate-700'}>{opt.text} {isMyOption && '✓'}</span>
                              <span className={isMyOption ? 'text-blue-700 font-bold' : 'text-slate-500'}>{percent}%</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-slate-400 font-medium text-right mt-3">{post.poll.voters?.length || 0} votos</p>
               </div>
            )}

            {/* REACCIONES - PASTILLAS FLOTANTES */}
            <div className="mb-8 flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
                {[ {e: '❤️'}, {e: '🔥'}, {e: '🙏'}, {e: '👍'}].map(item => {
                    const count = reactions.filter(r => r.emoji === item.e).length;
                    const isSelected = reactions.some(r => r.uid === currentUser.uid && r.emoji === item.e);
                    return (
                      <button key={item.e} onClick={() => handleReaction(item.e)} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all active:scale-95 border shrink-0 ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50'}`}>
                        <span className="text-lg">{item.e}</span>
                        {count > 0 && <span className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>{count}</span>}
                      </button>
                    )
                })}
            </div>

            {/* COMENTARIOS - ESTILO CHAT */}
            <section className="text-left pb-10">
              <div className="flex items-center gap-2 mb-6 px-1">
                <MessageCircle className="text-slate-400" size={20}/>
                <h3 className="font-bold text-sm text-slate-700">Comentarios ({comments.length})</h3>
              </div>
              
              <div className="space-y-5">
                {comments.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 font-medium py-4">Sé el primero en comentar.</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-3 animate-fade-in group items-start text-left">
                      <img src={c.photo || `https://ui-avatars.com/api/?name=${c.name}&background=EBF4FF&color=2563EB`} className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-100" referrerPolicy="no-referrer" alt={c.name} />
                      <div className="flex-1 bg-white p-3.5 rounded-[20px] rounded-tl-none border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-xs text-slate-900">{c.name}</span>
                          {(c.uid === currentUser.uid || isModerator) && (
                            <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 -mt-1 -mr-1"><Trash2 size={14}/></button>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
        </div>
      </div>

      {/* INPUT FOOTER - ESTILO SOCIALYO */}
      <footer className="p-4 bg-white border-t border-slate-100 absolute bottom-0 w-full flex gap-3 items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex-1 bg-[#F8F9FE] border border-slate-200 rounded-full flex items-center px-4 shadow-inner">
           <input 
            value={commentText} 
            onChange={e => setCommentText(e.target.value)} 
            placeholder="Escribe un comentario..." 
            className="w-full bg-transparent py-3 text-sm outline-none font-medium text-slate-800 placeholder-slate-400"
            onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }}
          />
        </div>
        <button 
          onClick={sendComment} 
          disabled={!commentText.trim() || isSending} 
          className="w-12 h-12 shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-slate-300 shadow-md shadow-blue-600/20 active:scale-95 transition-transform"
        >
          {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1"/>}
        </button>
      </footer>
    </div>
  );
}