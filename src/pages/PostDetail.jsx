import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, getDoc, collection, query, orderBy, onSnapshot, 
  addDoc, serverTimestamp, deleteDoc, updateDoc, runTransaction 
} from 'firebase/firestore';
import { 
  X, MessageCircle, Send, Trash2, ExternalLink, 
  Link as LinkIcon, Loader2, Calendar, ChevronLeft, 
  BookOpen, HandHeart, Lock, Share2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  
  const [authUser, setAuthUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const isModerator = userRole === 'pastor' || userRole === 'lider';
  const EMOJIS = ['❤️', '🔥', '🙏', '👍', '😢', '🎉'];

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) setUserRole(userDoc.data().role);
        } catch (e) { console.error(e); }
      } else {
        setAuthUser(null);
        setUserRole(null);
      }
      setAuthChecked(true); 
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!postId || !authChecked) return; 
    
    const unsubPost = onSnapshot(doc(db, 'posts', postId), (docSnap) => {
      if (docSnap.exists()) {
        const postData = { id: docSnap.id, ...docSnap.data() };
        
        if (postData.visibility === 'servidores' && !authUser) {
          sessionStorage.setItem('redirectAfterLogin', `/post/${postId}`);
          navigate('/login', { replace: true });
          return;
        }
        setPost(postData);
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'));
    const unsubComments = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPost();
      unsubComments();
    };
  }, [postId, navigate, authChecked, authUser]);

  const handleReaction = async (emoji) => {
    if (!authUser) return navigate('/login'); 
    const postRef = doc(db, 'posts', post.id);
    const reactions = post.reactions || [];
    const myIdx = reactions.findIndex(r => r.uid === authUser.uid);
    let newReactions = [...reactions];
    
    if (myIdx >= 0) {
      if (newReactions[myIdx].emoji === emoji) newReactions.splice(myIdx, 1);
      else newReactions[myIdx].emoji = emoji;
    } else {
      newReactions.push({ uid: authUser.uid, name: authUser.displayName, emoji });
    }
    await updateDoc(postRef, { reactions: newReactions });
  };

  const handleVote = async (optionIdx) => {
    if (!authUser) return navigate('/login');
    const postRef = doc(db, 'posts', post.id);
    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        const data = postDoc.data();
        const voteIndex = data.poll.votesDetails?.findIndex(v => v.uid === authUser.uid);
        
        let newOptions = [...data.poll.options];
        let newVoters = [...(data.poll.voters || [])];
        let newVotesDetails = data.poll.votesDetails ? [...data.poll.votesDetails] : [];

        if (voteIndex !== -1) {
            const previousOptionText = newVotesDetails[voteIndex].option;
            const prevOptIdx = newOptions.findIndex(o => o.text === previousOptionText);
            if (prevOptIdx !== -1) newOptions[prevOptIdx].votes = Math.max(0, newOptions[prevOptIdx].votes - 1);
            newVoters = newVoters.filter(id => id !== authUser.uid);
            newVotesDetails.splice(voteIndex, 1);
            if (data.poll.options[optionIdx].text !== previousOptionText) {
                newOptions[optionIdx].votes += 1;
                newVoters.push(authUser.uid);
                newVotesDetails.push({ uid: authUser.uid, name: authUser.displayName, option: data.poll.options[optionIdx].text });
            }
        } else {
            newOptions[optionIdx].votes += 1;
            newVoters.push(authUser.uid);
            newVotesDetails.push({ uid: authUser.uid, name: authUser.displayName, option: data.poll.options[optionIdx].text });
        }
        transaction.update(postRef, { 'poll.options': newOptions, 'poll.voters': newVoters, 'poll.votesDetails': newVotesDetails });
      });
    } catch (e) { console.error(e); }
  };

  const sendComment = async () => {
    if (!commentText.trim() || isSending || !authUser) return;
    setIsSending(true);
    try {
        const commentData = {
          text: commentText,
          uid: authUser.uid,
          name: authUser.displayName,
          photo: authUser.photoURL,
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

  const handleShare = async () => {
    const url = `https://cdsapp.vercel.app/#/post/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title || 'CDS App', text: 'Mira esta publicación', url }); } catch(err){}
    } else {
      navigator.clipboard.writeText(url);
      alert("Enlace copiado al portapapeles");
    }
  };

  if (loading) return <div className="fixed inset-0 bg-[#F8F9FE] z-[100] flex flex-col items-center justify-center font-sans"><Loader2 className="animate-spin text-blue-600 mb-4" size={40}/><p className="text-sm font-semibold text-slate-500">Cargando...</p></div>;
  if (!post) return null;

  const isDevocional = post.type === 'Devocional';
  const isOracion = post.type === 'Oración';
  const reactions = post.reactions || [];

  let timeAgo = '';
  if (post.createdAt) {
    try {
      const dateObj = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
      timeAgo = formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
    } catch (e) { timeAgo = ''; }
  }

  return (
    <div className="fixed inset-0 z-[120] bg-[#F8F9FE] flex flex-col animate-fade-in overflow-hidden font-sans text-left">
      
      {/* HEADER SUPERIOR */}
      {!isDevocional && (
        <header className="sticky top-0 bg-[#F8F9FE]/90 backdrop-blur-xl px-5 pt-12 pb-4 flex items-center justify-between z-50 max-w-md mx-auto w-full">
          <button onClick={() => navigate(authUser ? -1 : '/')} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-slate-700 shadow-sm active:scale-90 transition-transform">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="text-center flex-1 px-4 min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate mx-auto">
                {isOracion ? 'Motivo de Oración' : 'Publicación'}
              </h1>
              <span className="font-bold text-[11px] uppercase tracking-widest text-slate-400 block truncate">
                {timeAgo || 'Recién publicado'}
              </span>
          </div>
          <div className="w-10"></div>
        </header>
      )}

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar relative w-full">
        
        {/* PORTADA DE DEVOCIONALES */}
        {isDevocional && (
          <div className="relative w-full h-[50vh] shrink-0 rounded-b-[40px] overflow-hidden shadow-sm">
             <button onClick={() => navigate(authUser ? -1 : '/')} className="absolute top-12 left-5 z-[60] w-10 h-10 flex items-center justify-center bg-white/30 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform">
               <ChevronLeft size={24} strokeWidth={2.5} />
             </button>
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
                <h1 className="text-3xl font-black text-white leading-tight tracking-tight break-words">{post.title}</h1>
             </div>
          </div>
        )}

        <div className={`max-w-md mx-auto ${!isDevocional ? 'mt-4' : 'mt-8'} px-5`}>
            
            {/* ✅ LA TARJETA UNIFICADA (Idéntica al Home.jsx) */}
            <div className="bg-white rounded-[32px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 relative mb-8">
                
                {/* CABECERA DEL AUTOR (Integrada) */}
                {!isDevocional && (
                  <div className="flex items-center gap-3 mb-5">
                      <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=EBF4FF&color=2563EB`} className="w-11 h-11 rounded-full object-cover bg-slate-100" referrerPolicy="no-referrer" alt="Autor" />
                      <div>
                          <h3 className="font-bold text-[15px] text-slate-900 leading-tight">{post.authorName}</h3>
                          <div className="flex items-center gap-1 mt-0.5">
                            <p className="text-[11px] font-medium text-slate-400">
                              {isOracion ? '🛐 Pedido de Oración' : post.role}
                            </p>
                          </div>
                      </div>
                  </div>
                )}

                {/* TEXTO DEL POST */}
                <div className={`text-left w-full overflow-hidden mb-5 ${isOracion ? 'bg-purple-50 p-5 rounded-[24px] border border-purple-100' : ''}`}>
                    {isOracion && <HandHeart size={28} className="text-purple-500 mb-3"/>}
                    {post.title && !isDevocional && <h2 className="font-bold text-[17px] text-slate-900 tracking-tight leading-snug mb-2">{post.title}</h2>}
                    <p className="text-[15px] text-slate-800 whitespace-pre-wrap break-words leading-relaxed font-medium">
                      {post.content}
                    </p>
                </div>

                {/* IMAGEN DEL POST (Si no es devocional) */}
                {post.image && !isDevocional && (
                    <div className="mb-5 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 bg-white">
                        <img src={post.image} className="w-full h-auto object-cover max-h-[500px]" alt="Imagen adjunta" referrerPolicy="no-referrer" />
                    </div>
                )}

                {/* ENLACES EXTERNOS */}
                {post.link && (
                    <button 
                        onClick={() => post.link.startsWith('/') ? navigate(post.link) : window.open(post.link.startsWith('http') ? post.link : `https://${post.link}`, '_blank')}
                        className="flex items-center justify-between w-full bg-[#F8F9FE] text-blue-600 p-4 rounded-[20px] transition-all active:scale-95 mb-5 shadow-sm border border-slate-100 overflow-hidden"
                    >
                        <span className="text-sm font-bold flex items-center gap-3 min-w-0 break-words text-left">
                            {post.link.startsWith('/') ? <Calendar size={20} className="shrink-0" /> : <LinkIcon size={20} className="shrink-0" />} 
                            {post.linkText || 'Ver más información'}
                        </span>
                        <ExternalLink size={18} className="text-slate-300 shrink-0 ml-2" />
                    </button>
                )}

                {/* ENCUESTA */}
                {post.poll && (
                   <div className="mb-5 bg-[#F8F9FE] rounded-[24px] p-5 border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><BookOpen size={16}/> Encuesta</p>
                      <div className="space-y-3">
                        {post.poll.options.map((opt, idx) => {
                          const total = post.poll.voters?.length || 0;
                          const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                          const myVote = authUser && post.poll.votesDetails?.find(v => v.uid === authUser.uid);
                          const isMyOption = myVote?.option === opt.text;

                          return (
                            <button key={idx} onClick={() => handleVote(idx)} className={`w-full relative h-12 rounded-[16px] overflow-hidden border transition-all text-left ${isMyOption ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                              <div className={`absolute top-0 left-0 h-full transition-all duration-700 ${isMyOption ? 'bg-blue-100' : 'bg-slate-100'}`} style={{ width: `${percent}%` }}></div>
                              <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-bold z-10">
                                  <span className={`truncate mr-2 ${isMyOption ? 'text-blue-700' : 'text-slate-700'}`}>{opt.text} {isMyOption && '✓'}</span>
                                  <span className={isMyOption ? 'text-blue-700 font-black' : 'text-slate-400'}>{percent}%</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400 font-bold text-right mt-3 uppercase tracking-widest">{post.poll.voters?.length || 0} votos</p>
                   </div>
                )}

                {/* LÍNEA DIVISORIA */}
                <div className="w-full h-[1px] bg-slate-100 my-4"></div>

                {/* REACCIONES Y COMPARTIR (Idéntico a Home.jsx) */}
                <div className="flex flex-wrap gap-2.5">
                    {EMOJIS.map(emoji => {
                        const count = reactions.filter(r => r.emoji === emoji).length;
                        const isSelected = authUser && reactions.some(r => r.uid === authUser.uid && r.emoji === emoji);
                        
                        // Solo mostramos el emoji si alguien reaccionó con él, o si es el corazón por defecto
                        if (count === 0 && emoji !== '❤️' && emoji !== '🔥' && emoji !== '🙏' && emoji !== '👍') return null;

                        return (
                          <button key={emoji} onClick={() => handleReaction(emoji)} 
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all active:scale-95 border ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <span className="text-[16px] leading-none">{emoji}</span>
                            {count > 0 && <span className={`text-[12px] font-bold leading-none ${isSelected ? 'text-white' : 'text-slate-500'}`}>{count}</span>}
                          </button>
                        )
                    })}
                    
                    <button 
                      onClick={handleShare}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all ml-auto"
                    >
                      <Share2 size={16} strokeWidth={2}/>
                      <span className="text-[12px] font-bold">Compartir</span>
                    </button>
                </div>
            </div>

            {/* SECCIÓN DE COMENTARIOS TIPO CHAT */}
            <section className="text-left pb-10 pt-2">
              <div className="flex items-center gap-2 mb-6 px-2">
                <MessageCircle className="text-slate-400" size={20}/>
                <h3 className="font-bold text-sm text-slate-800">Comentarios ({comments.length})</h3>
              </div>
              
              <div className="space-y-5">
                {comments.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 font-medium py-6">Sé el primero en comentar.</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-3 animate-fade-in group items-start text-left w-full overflow-hidden">
                      <img src={c.photo || `https://ui-avatars.com/api/?name=${c.name}&background=EBF4FF&color=2563EB`} className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm border border-white" referrerPolicy="no-referrer" alt={c.name} />
                      
                      <div className="flex-1 min-w-0 bg-white p-4 rounded-[24px] rounded-tl-none shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-50 relative">
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="font-bold text-[13px] text-slate-900 truncate">{c.name}</span>
                          {(authUser && (c.uid === authUser.uid || isModerator)) && (
                            <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 -mt-1 -mr-1 shrink-0"><Trash2 size={14}/></button>
                          )}
                        </div>
                        <p className="text-[14px] text-slate-600 leading-relaxed font-medium break-words">{c.text}</p>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </section>
        </div>
      </div>

      {/* FOOTER FLOTANTE (INPUT DE COMENTARIOS) */}
      <footer className="fixed bottom-0 w-full left-1/2 -translate-x-1/2 max-w-md bg-[#F8F9FE]/95 backdrop-blur-xl pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 px-5 z-50">
        {!authUser ? (
          <button onClick={() => navigate('/login')} className="w-full bg-blue-600 text-white rounded-full py-3.5 font-bold text-[13px] flex items-center justify-center gap-2 shadow-sm mb-4">
            <Lock size={16} /> Inicia sesión para interactuar
          </button>
        ) : (
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 bg-white border border-slate-200/60 rounded-full flex items-center px-5 shadow-sm">
               <input 
                id="commentInput"
                value={commentText} 
                onChange={e => setCommentText(e.target.value)} 
                placeholder="Escribe un comentario..." 
                className="w-full bg-transparent py-3.5 text-[14px] outline-none font-medium text-slate-800 placeholder-slate-400"
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
        )}
      </footer>
    </div>
  );
}