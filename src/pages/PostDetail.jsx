import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  doc, getDoc, collection, query, orderBy, onSnapshot, 
  addDoc, serverTimestamp, deleteDoc, updateDoc, arrayUnion, runTransaction 
} from 'firebase/firestore';
import { 
  X, MessageCircle, Send, Trash2, ExternalLink, 
  Link as LinkIcon, Loader2, Calendar, CheckCircle 
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
    
    // Escuchar el post para actualizaciones en tiempo real (especialmente encuestas)
    const unsubPost = onSnapshot(doc(db, 'posts', postId), (docSnap) => {
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() });
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    // Escuchar comentarios
    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'));
    const unsubComments = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPost();
      unsubComments();
    };
  }, [postId, navigate]);

  // ✅ NOTIFICACIÓN AL AUTOR
  const notifyAuthor = async (commenterName, textPreview) => {
    if (post.authorId === currentUser.uid) return;
    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      if (!REST_API_KEY) return;

      const path = `/post/${postId}`;
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${REST_API_KEY}` },
        body: JSON.stringify({
          app_id: APP_ID,
          include_external_user_ids: [post.authorId],
          headings: { en: "💬 Nuevo comentario", es: "💬 Nuevo comentario" },
          contents: { 
            en: `${commenterName}: "${textPreview.substring(0, 40)}..."`, 
            es: `${commenterName}: "${textPreview.substring(0, 40)}..."` 
          },
          web_url: `https://cdsapp.vercel.app/#${path}`,
          data: { route: path },
          priority: 10
        })
      });
    } catch (e) { /* Error silent */ }
  };

  const handleVote = async (optionIdx) => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        const data = postDoc.data();
        const voters = data.poll.voters || [];
        
        // Si ya votó en esta misma opción, se quita el voto (desmarcar)
        const voteIndex = data.poll.votesDetails?.findIndex(v => v.uid === currentUser.uid);
        
        let newOptions = [...data.poll.options];
        let newVoters = [...voters];
        let newVotesDetails = data.poll.votesDetails ? [...data.poll.votesDetails] : [];

        if (voteIndex !== -1) {
            // Ya había votado, quitamos el voto anterior
            const previousOptionText = newVotesDetails[voteIndex].option;
            const prevOptIdx = newOptions.findIndex(o => o.text === previousOptionText);
            if (prevOptIdx !== -1) newOptions[prevOptIdx].votes = Math.max(0, newOptions[prevOptIdx].votes - 1);
            
            newVoters = newVoters.filter(id => id !== currentUser.uid);
            newVotesDetails.splice(voteIndex, 1);
            
            // Si la opción que tocó es distinta a la anterior, agregamos el nuevo voto
            if (data.poll.options[optionIdx].text !== previousOptionText) {
                newOptions[optionIdx].votes += 1;
                newVoters.push(currentUser.uid);
                newVotesDetails.push({ uid: currentUser.uid, name: currentUser.displayName, option: data.poll.options[optionIdx].text });
            }
        } else {
            // Voto nuevo
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
        await notifyAuthor(currentUser.displayName, commentText);
        setCommentText('');
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  if (loading) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center font-outfit"><Loader2 className="animate-spin text-brand-600" size={40}/></div>;
  if (!post) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden font-outfit">
      
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 border-b border-slate-100 bg-white shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-full active:scale-90 transition-all"><X size={26} className="text-slate-800" /></button>
        <div className="flex flex-col items-center">
            <span className="font-black text-slate-900 uppercase tracking-tighter text-[11px]">{post.type}</span>
            <span className="text-[9px] text-brand-600 font-black uppercase tracking-[0.2em]">Detalle</span>
        </div>
        <div className="w-10"></div>
      </header>

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
        {/* CONTENIDO DEL POST */}
        <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl border-2 border-slate-100 overflow-hidden shrink-0">
                    <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-full h-full object-cover" />
                </div>
                <div>
                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-tighter">{post.authorName}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{post.createdAt ? format(post.createdAt.toDate(), "d 'de' MMMM", { locale: es }) : 'Reciente'}</p>
                </div>
            </div>

            {post.type === 'Devocional' && <h1 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tight leading-tight">{post.title}</h1>}
            
            <p className="text-base text-slate-800 whitespace-pre-wrap mb-6 leading-relaxed font-medium">{post.content}</p>

            {/* IMAGEN DEL POST */}
            {post.image && (
                <div className="mb-6 rounded-[32px] overflow-hidden border-4 border-white shadow-2xl">
                    <img src={post.image} className="w-full h-auto object-cover" alt="Post" />
                </div>
            )}

            {/* LINK EXTERNO */}
            {post.link && (
                <div className="mb-6">
                    <button 
                        onClick={() => post.link.startsWith('/') ? navigate(post.link) : window.open(post.link.startsWith('http') ? post.link : `https://${post.link}`, '_blank')}
                        className="flex items-center justify-between w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-[24px] transition-all active:scale-[0.98] shadow-sm"
                    >
                        <span className="text-xs font-black text-brand-700 flex items-center gap-3 uppercase tracking-[0.1em]">
                            {post.link.startsWith('/') ? <Calendar size={18} /> : <LinkIcon size={18} />} 
                            {post.linkText || 'Ver más'}
                        </span>
                        <ExternalLink size={16} className="text-slate-300" />
                    </button>
                </div>
            )}

            {/* ENCUESTA */}
            {post.poll && (
               <div className="mb-6 bg-slate-50 rounded-[35px] p-6 border-2 border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5">Encuesta de la iglesia</p>
                  {post.poll.options.map((opt, idx) => {
                    const voters = post.poll.voters || [];
                    const isVoted = voters.includes(currentUser?.uid);
                    const total = voters.length || 0;
                    const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                    
                    // Ver si YO voté específicamente esta opción
                    const myVote = post.poll.votesDetails?.find(v => v.uid === currentUser.uid);
                    const isMyOption = myVote?.option === opt.text;

                    return (
                      <button key={idx} onClick={() => handleVote(idx)} className="w-full relative mb-3 h-14 rounded-2xl overflow-hidden bg-white border-2 border-slate-100 text-left active:scale-[0.98] transition-all">
                        <div className={`absolute top-0 left-0 h-full transition-all duration-700 ${isMyOption ? 'bg-brand-500/20' : 'bg-slate-100'}`} style={{ width: `${percent}%` }}></div>
                        <div className="absolute inset-0 flex items-center justify-between px-5 text-xs font-black uppercase z-10">
                            <span className={isMyOption ? 'text-brand-700' : 'text-slate-700'}>{opt.text} {isMyOption && '✓'}</span>
                            <span className="text-slate-400">{percent}%</span>
                        </div>
                      </button>
                    )
                  })}
                  <div className="mt-2 text-[9px] font-black text-slate-300 uppercase text-center tracking-[0.2em]">
                    Participantes: {post.poll.voters?.length || 0}
                  </div>
               </div>
            )}
        </div>

        {/* COMENTARIOS */}
        <section className="px-6 border-t border-slate-50 pt-8 bg-slate-50/30">
          <h3 className="font-black text-[11px] text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
            <MessageCircle className="text-brand-500" size={18}/> {comments.length} Comentarios
          </h3>
          <div className="space-y-6 pb-10">
            {comments.map(c => (
              <div key={c.id} className="flex gap-4 animate-fade-in">
                <div className="w-10 h-10 rounded-xl border-2 border-white shadow-sm overflow-hidden shrink-0">
                    <img src={c.photo || `https://ui-avatars.com/api/?name=${c.name}`} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 bg-white p-4 rounded-[22px] border border-slate-100 relative shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-black text-[10px] text-slate-900 uppercase tracking-tight">{c.name}</span>
                    {(c.uid === currentUser.uid || post.authorId === currentUser.uid || isModerator) && (
                      <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-rose-500 p-1 transition-colors"><Trash2 size={16}/></button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 leading-snug font-medium">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* INPUT COMENTARIO */}
      <footer className="p-4 border-t border-slate-100 bg-white absolute bottom-0 w-full flex gap-3 items-center shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
        <input 
          value={commentText} 
          onChange={e => setCommentText(e.target.value)} 
          placeholder="Escribir un comentario..." 
          className="flex-1 bg-slate-100 rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all font-semibold"
        />
        <button 
          onClick={sendComment} 
          disabled={!commentText.trim() || isSending} 
          className="w-14 h-14 bg-brand-600 text-white rounded-2xl flex items-center justify-center disabled:opacity-50 shadow-xl shadow-brand-200 active:scale-90 transition-all"
        >
          {isSending ? <Loader2 size={22} className="animate-spin" /> : <Send size={22}/>}
        </button>
      </footer>
    </div>
  );
}