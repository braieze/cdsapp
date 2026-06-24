import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, collection, query, orderBy, onSnapshot, 
  addDoc, serverTimestamp, deleteDoc, updateDoc, runTransaction 
} from 'firebase/firestore';
import { 
  X, MessageCircle, Send, Trash2, ExternalLink, 
  Link as LinkIcon, Loader2, Calendar, CheckCircle,
  ChevronLeft, BookOpen, HandHeart
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
    <div className="fixed inset-0 z-[120] bg-[#F8F9FE] flex flex-col animate-fade-in overflow-hidden font-sans text-left">
      
      {/* 🚀 HEADER SOCIALYO: Flotante y limpio */}
      {!isDevocional && (
        <header className="sticky top-0 bg-[#F8F9FE]/90 backdrop-blur-xl px-5 pt-12 pb-4 flex items-center justify-between z-50 max-w-md mx-auto w-full">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-slate-700 shadow-sm active:scale-90 transition-transform">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="text-center flex-1 px-4">
              <h1 className="text-base font-bold text-slate-900 truncate max-w-[200px] mx-auto">{post.title}</h1>
              <span className={`font-bold text-[11px] uppercase tracking-widest mt-0.5 block ${isOracion ? 'text-purple-500' : 'text-blue-500'}`}>{post.type}</span>
          </div>
          <div className="w-10"></div>
        </header>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar relative w-full">
        
        {isDevocional && (
          <div className="relative w-full h-[50vh] shrink-0 rounded-b-[40px] overflow-hidden shadow-sm">
             <button onClick={() => navigate(-1)} className="absolute top-12 left-5 z-[60] w-10 h-10 flex items-center justify-center bg-white/30 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"><ChevronLeft size={24} strokeWidth={2.5} /></button>
             {post.image ? (
               <img src={post.image} className="w-full h-full object-cover" alt="portada" referrerPolicy="no-referrer" />
             ) : (
               <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-800" />
             )}
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />
             <div className="absolute bottom-0 left-0 right-0 p-8 text-left max-w-md mx-auto">
                <div className="flex gap-2 mb-3">
                  <span className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-sm">Devocional</span>
                  {post.mood && <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-full">{post.mood}</span>}
                </div>
                <h1 className="text-3xl font-black text-white leading-tight tracking-tight">{post.title}</h1>
             </div>
          </div>
        )}

        <div className={`max-w-md mx-auto ${!isDevocional ? 'mt-4' : 'mt-8'} px-5`}>
            
            {/* 🚀 AUTHOR CARD - BURBUJA INDEPENDIENTE */}
            {!isDevocional && (
              <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-[28px] shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                  <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=EBF4FF&color=2563EB`} className="w-12 h-12 rounded-full object-cover shrink-0 bg-slate-100" referrerPolicy="no-referrer" alt="Autor" />
                  <div className="text-left flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-[15px] truncate">{post.authorName}</h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{post.createdAt ? format(post.createdAt.toDate(), "d 'de' MMMM, HH:mm", { locale: es }) : 'Recién publicado'}</p>
                  </div>
              </div>
            )}

            {/* TEXTO DEL POST */}
            <div className={`text-left mb-8 ${isOracion ? 'bg-purple-50 p-6 rounded-[32px] border border-purple-100' : 'px-1'}`}>
                {isOracion && <HandHeart size={28} className="text-purple-500 mb-4"/>}
                <p className="text-[16px] text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {post.content}
                </p>
            </div>

            {/* IMAGEN ADJUNTA */}
            {post.image && !isDevocional && (
                <div className="mb-8 rounded-[32px] overflow-hidden shadow-sm border border-slate-100 bg-white">
                    <img src={post.image} className="w-full h-auto object-cover" alt="Imagen adjunta" referrerPolicy="no-referrer" />
                </div>
            )}

            {/* ENLACE EXTERNO */}
            {post.link && (
                <button 
                    onClick={() => post.link.startsWith('/') ? navigate(post.link) : window.open(post.link.startsWith('http') ? post.link : `https://${post.link}`, '_blank')}
                    className="flex items-center justify-between w-full bg-white text-blue-600 p-5 rounded-[24px] transition-all active:scale-95 mb-8 shadow-sm border border-slate-100"
                >
                    <span className="text-sm font-bold flex items-center gap-3">
                        {post.link.startsWith('/') ? <Calendar size={20} /> : <LinkIcon size={20} />} 
                        {post.linkText || 'Ver más información'}
                    </span>
                    <ExternalLink size={18} className="text-slate-300" />
                </button>
            )}

            {/* 🚀 REACCIONES: PASTILLAS ESTILO SOCIALYO */}
            <div className="mb-10 flex flex-wrap gap-3 py-1">
                {[ {e: '❤️'}, {e: '🔥'}, {e: '🙏'}, {e: '👍'}].map(item => {
                    const count = reactions.filter(r => r.emoji === item.e).length;
                    const isSelected = reactions.some(r => r.uid === currentUser.uid && r.emoji === item.e);
                    return (
                      <button key={item.e} onClick={() => handleReaction(item.e)} 
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all active:scale-95 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border ${isSelected ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}>
                        <span className="text-lg leading-none">{item.e}</span>
                        {count > 0 && <span className={`text-xs font-bold leading-none ${isSelected ? 'text-white' : 'text-slate-500'}`}>{count}</span>}
                      </button>
                    )
                })}
            </div>

            {/* ENCUESTA */}
            {post.poll && (
               <div className="mb-10 bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2"><BookOpen size={16}/> Encuesta</p>
                  <div className="space-y-3">
                    {post.poll.options.map((opt, idx) => {
                      const total = post.poll.voters?.length || 0;
                      const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                      const myVote = post.poll.votesDetails?.find(v => v.uid === currentUser.uid);
                      const isMyOption = myVote?.option === opt.text;

                      return (
                        <button key={idx} onClick={() => handleVote(idx)} className={`w-full relative h-14 rounded-[20px] overflow-hidden border transition-all text-left ${isMyOption ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 bg-slate-50 hover:border-slate-300'}`}>
                          <div className={`absolute top-0 left-0 h-full transition-all duration-700 ${isMyOption ? 'bg-blue-100' : 'bg-white'}`} style={{ width: `${percent}%` }}></div>
                          <div className="absolute inset-0 flex items-center justify-between px-5 text-sm font-bold z-10">
                              <span className={isMyOption ? 'text-blue-700' : 'text-slate-700'}>{opt.text} {isMyOption && '✓'}</span>
                              <span className={isMyOption ? 'text-blue-700 font-black' : 'text-slate-400'}>{percent}%</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold text-right mt-4 uppercase tracking-widest">{post.poll.voters?.length || 0} votos</p>
               </div>
            )}

            {/* 🚀 COMENTARIOS: BURBUJAS REDONDEADAS */}
            <section className="text-left pb-10 border-t border-slate-200 pt-8">
              <div className="flex items-center gap-2 mb-6 px-1">
                <MessageCircle className="text-slate-400" size={20}/>
                <h3 className="font-bold text-sm text-slate-800">Comentarios ({comments.length})</h3>
              </div>
              
              <div className="space-y-6">
                {comments.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 font-medium py-6">Sé el primero en comentar.</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-3 animate-fade-in group items-start text-left">
                      <img src={c.photo || `https://ui-avatars.com/api/?name=${c.name}&background=EBF4FF&color=2563EB`} className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm" referrerPolicy="no-referrer" alt={c.name} />
                      <div className="flex-1 bg-white p-4 rounded-[24px] rounded-tl-none border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative">
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="font-bold text-[12px] text-slate-900">{c.name}</span>
                          {(c.uid === currentUser.uid || isModerator) && (
                            <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 -mt-1 -mr-1"><Trash2 size={14}/></button>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
        </div>
      </div>

      {/* 🚀 INPUT FOOTER: REDONDEADO Y FLOTANTE */}
      <footer className="fixed bottom-0 w-full left-1/2 -translate-x-1/2 max-w-md bg-[#F8F9FE]/90 backdrop-blur-md pb-6 pt-3 px-5 z-50">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white border border-slate-200 rounded-full flex items-center px-5 shadow-sm">
             <input 
              value={commentText} 
              onChange={e => setCommentText(e.target.value)} 
              placeholder="Escribe un comentario..." 
              className="w-full bg-transparent py-3.5 text-[15px] outline-none font-medium text-slate-800 placeholder-slate-400"
              onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }}
            />
          </div>
          <button 
            onClick={sendComment} 
            disabled={!commentText.trim() || isSending} 
            className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all shadow-sm ${commentText.trim() ? 'bg-slate-900 text-white active:scale-90' : 'bg-slate-200 text-slate-400'}`}
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="-ml-0.5 mt-0.5"/>}
          </button>
        </div>
      </footer>
    </div>
  );
}