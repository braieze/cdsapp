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
  Link as LinkIcon, Loader2, Calendar, CheckCircle,
  ChevronLeft, BookOpen, HandHeart, Lock, Heart, Share2, Globe
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  
  // 1. ESTADOS LOCALES DE AUTENTICACIÓN
  const [authUser, setAuthUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [activeReactionPost, setActiveReactionPost] = useState(null);

  const isModerator = userRole === 'pastor' || userRole === 'lider';

  const EMOJIS = ['❤️', '🔥', '🙏', '👍', '😢', '🎉'];

  // 2. VERIFICACIÓN DE SESIÓN INDEPENDIENTE
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

  // 3. CARGA DEL POST Y GUARDIA DE SEGURIDAD
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
    setActiveReactionPost(null);
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
      alert("Enlace copiado");
    }
  };

  if (loading) return <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center font-sans"><Loader2 className="animate-spin text-blue-600 mb-4" size={40}/><p className="text-sm font-semibold text-slate-500">Cargando...</p></div>;
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
    // ✅ FONDO BLANCO PURO para integrarse estilo FB
    <div className="fixed inset-0 z-[120] bg-white flex flex-col animate-fade-in font-sans text-left" onClick={() => setActiveReactionPost(null)}>
      
      {/* HEADER SUPERIOR (BARRA DE NAVEGACIÓN) */}
      <header className="sticky top-0 bg-white px-4 pt-12 pb-3 flex items-center justify-between z-50 max-w-md mx-auto w-full border-b border-slate-200">
        <button onClick={() => navigate(authUser ? -1 : '/')} className="w-10 h-10 flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={28} strokeWidth={2} />
        </button>
        <div className="text-center flex-1 px-4">
            <h1 className="text-[17px] font-bold text-slate-900 truncate">{isDevocional ? 'Devocional' : 'Publicación'}</h1>
        </div>
        <div className="w-10"></div>
      </header>

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar w-full max-w-md mx-auto">
        
        {/* ✅ CABECERA DEL AUTOR (Integrada al post, sin burbuja) */}
        <div className="px-4 pt-4 flex items-center gap-3 mb-3">
            <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=EBF4FF&color=2563EB`} className="w-11 h-11 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" alt="Autor" />
            <div>
                <h3 className="font-bold text-[16px] text-slate-900 leading-tight">{post.authorName}</h3>
                <div className="flex items-center gap-1 text-[13px] text-slate-500">
                  <span>{timeAgo || 'Recién publicado'}</span>
                  <span>•</span>
                  <Globe size={11} />
                  {post.type !== 'Noticia' && (
                    <>
                      <span>•</span>
                      <span className={isOracion ? 'text-purple-600 font-medium' : 'text-blue-600 font-medium'}>{post.type}</span>
                    </>
                  )}
                </div>
            </div>
        </div>

        {/* ✅ TEXTO DEL POST (Con break-words y sin fondo gris/morado a menos que sea oración) */}
        <div className={`px-4 mb-4 ${isOracion ? 'bg-purple-50 p-4 mx-4 rounded-xl border border-purple-100' : ''}`}>
            {isOracion && <HandHeart size={28} className="text-purple-500 mb-3"/>}
            {post.title && !isDevocional && <h2 className="font-bold text-[18px] text-slate-900 tracking-tight leading-snug mb-2">{post.title}</h2>}
            <p className="text-[15px] text-slate-900 leading-relaxed whitespace-pre-wrap break-words">
              {post.content}
            </p>
        </div>

        {/* ✅ IMAGEN EDGE-TO-EDGE (Toca los bordes de la pantalla) */}
        {post.image && (
            <div className="w-full bg-slate-100 mb-2">
                <img src={post.image} className="w-full h-auto object-cover max-h-[600px]" alt="Imagen adjunta" referrerPolicy="no-referrer" />
            </div>
        )}

        {/* ENLACE EXTERNO */}
        {post.link && (
            <div className="px-4 mb-4">
              <button 
                  onClick={() => post.link.startsWith('/') ? navigate(post.link) : window.open(post.link.startsWith('http') ? post.link : `https://${post.link}`, '_blank')}
                  className="flex items-center justify-between w-full bg-[#f0f2f5] text-slate-800 p-4 rounded-xl transition-all active:scale-95 border border-slate-200"
              >
                  <span className="text-[15px] font-bold flex items-center gap-3 min-w-0 break-words text-left">
                      {post.link.startsWith('/') ? <Calendar size={20} className="shrink-0 text-blue-600" /> : <LinkIcon size={20} className="shrink-0 text-blue-600" />} 
                      {post.linkText || 'Ver más información'}
                  </span>
                  <ExternalLink size={18} className="text-slate-400 shrink-0 ml-2" />
              </button>
            </div>
        )}

        {/* ENCUESTA */}
        {post.poll && (
            <div className="mx-4 mb-6 bg-[#f0f2f5] rounded-xl p-5 border border-slate-200">
              <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><BookOpen size={16}/> Encuesta</p>
              <div className="space-y-3">
                {post.poll.options.map((opt, idx) => {
                  const total = post.poll.voters?.length || 0;
                  const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                  const myVote = authUser && post.poll.votesDetails?.find(v => v.uid === authUser.uid);
                  const isMyOption = myVote?.option === opt.text;

                  return (
                    <button key={idx} onClick={() => handleVote(idx)} className={`w-full relative h-12 rounded-lg overflow-hidden border transition-all text-left ${isMyOption ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
                      <div className={`absolute top-0 left-0 h-full transition-all duration-700 ${isMyOption ? 'bg-blue-200' : 'bg-[#e4e6eb]'}`} style={{ width: `${percent}%` }}></div>
                      <div className="absolute inset-0 flex items-center justify-between px-4 text-[15px] font-semibold z-10">
                          <span className={`truncate mr-2 ${isMyOption ? 'text-blue-800' : 'text-slate-800'}`}>{opt.text} {isMyOption && '✓'}</span>
                          <span className={isMyOption ? 'text-blue-800 font-bold' : 'text-slate-600'}>{percent}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[12px] text-slate-500 font-semibold text-right mt-3">{post.poll.voters?.length || 0} votos</p>
            </div>
        )}

        {/* ✅ CONTADORES (Me gusta / Comentarios) - Estilo FB */}
        <div className="px-4">
          {(reactions.length > 0 || comments.length > 0) && (
            <div className="py-3 flex items-center justify-between text-[14px] text-slate-500 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {reactions.length > 0 && (
                  <>
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-sm"><Heart size={10} fill="currentColor"/></div>
                    <span className="font-medium">{reactions.length}</span>
                  </>
                )}
              </div>
              <div className="flex gap-3 font-medium">
                {comments.length > 0 && <span>{comments.length} comentarios</span>}
              </div>
            </div>
          )}
        </div>

        {/* ✅ ACTION BAR (Barra de botones de interacción) - Estilo FB */}
        <div className="flex px-2 py-1 relative z-40 border-b-8 border-[#ebedf0]">
          {/* BOTÓN ME GUSTA */}
          <div className="flex-1 relative">
            {activeReactionPost === post.id && (
              <div className="absolute bottom-12 left-0 bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-200 px-3 py-2 flex items-center gap-2 animate-slide-up z-50">
                {EMOJIS.map(emoji => {
                  const isSelected = authUser && reactions.some(r => r.uid === authUser.uid && r.emoji === emoji);
                  return (
                    <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }} 
                            className={`w-10 h-10 flex items-center justify-center hover:scale-125 hover:-translate-y-2 transition-transform rounded-full text-2xl ${isSelected ? 'bg-slate-100' : 'bg-transparent'}`}>
                      {emoji}
                    </button>
                  )
                })}
              </div>
            )}
            
            {(() => {
              const myReaction = authUser ? reactions.find(r => r.uid === authUser.uid) : null;
              return (
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveReactionPost(activeReactionPost === post.id ? null : post.id); }} 
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-md transition-colors text-[15px] font-semibold hover:bg-[#f0f2f5] ${myReaction ? 'text-blue-600' : 'text-slate-600'}`}
                >
                  {myReaction ? <Heart size={20} fill="currentColor" /> : <Heart size={20} strokeWidth={1.5} />}
                  {myReaction ? myReaction.emoji : 'Me gusta'}
                </button>
              );
            })()}
          </div>
          
          <button onClick={() => document.getElementById('commentInput').focus()} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors text-[15px] font-semibold text-slate-600 hover:bg-[#f0f2f5]">
            <MessageCircle size={20} strokeWidth={1.5} /> Comentar
          </button>

          <button onClick={(e) => { 
            e.stopPropagation(); 
            shareContent(post.title, 'Mira esta publicación', `/post/${post.id}`); 
          }}>
            Compartir
          </button>
        </div>

        {/* ✅ SECCIÓN DE COMENTARIOS */}
        <section className="px-4 py-4 bg-white">
          <h3 className="font-bold text-[15px] text-slate-900 mb-4">Comentarios</h3>
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-center text-[15px] text-slate-500 py-4">Sé el primero en comentar.</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-2 animate-fade-in items-start w-full">
                  <img src={c.photo || `https://ui-avatars.com/api/?name=${c.name}&background=EBF4FF&color=2563EB`} className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200" referrerPolicy="no-referrer" alt={c.name} />
                  <div className="flex-1 min-w-0">
                    <div className="bg-[#f0f2f5] px-4 py-2.5 rounded-2xl inline-block max-w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[14px] text-slate-900">{c.name}</span>
                      </div>
                      {/* ✅ break-words asegura que no se desborde */}
                      <p className="text-[15px] text-slate-900 leading-snug break-words">{c.text}</p>
                    </div>
                    {/* Botón de eliminar más discreto debajo de la burbuja (estilo FB) */}
                    {(authUser && (c.uid === authUser.uid || isModerator)) && (
                      <div className="px-3 pt-1">
                        <button onClick={() => deleteComment(c.id)} className="text-[12px] font-semibold text-slate-500 hover:text-red-500 transition-colors">Eliminar</button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* FOOTER FIJO (INPUT DE COMENTARIOS) */}
      <footer className="fixed bottom-0 w-full left-1/2 -translate-x-1/2 max-w-md bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)] pt-2 px-4 z-50">
        {!authUser ? (
          <button onClick={() => navigate('/login')} className="w-full bg-blue-600 text-white rounded-lg py-3 font-bold text-[15px] flex items-center justify-center gap-2 mb-2">
            <Lock size={18} /> Inicia sesión para interactuar
          </button>
        ) : (
          <div className="flex items-center gap-2 mb-2">
            <img src={authUser.photoURL || `https://ui-avatars.com/api/?name=${authUser.displayName}&background=EBF4FF&color=2563EB`} className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200" alt="Tu perfil" />
            <div className="flex-1 bg-[#f0f2f5] rounded-full flex items-center px-4">
               <input 
                id="commentInput"
                value={commentText} 
                onChange={e => setCommentText(e.target.value)} 
                placeholder="Escribe un comentario..." 
                className="w-full bg-transparent py-2.5 text-[15px] outline-none font-medium text-slate-800 placeholder-slate-500"
                onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }}
              />
            </div>
            {commentText.trim() && (
              <button 
                onClick={sendComment} 
                disabled={isSending} 
                className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-blue-600 active:scale-90 transition-transform"
              >
                {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1"/>}
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}