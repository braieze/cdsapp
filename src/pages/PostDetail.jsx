import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { X, MessageCircle, Send, Trash2, ExternalLink, Link as LinkIcon, Loader2 } from 'lucide-react';

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  // ✅ PUNTO #5: Obtenemos el usuario de la DB para ver su rol
  const { dbUser } = useOutletContext();
  const currentUser = auth.currentUser;
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // ✅ ROLES: ¿Es jefe?
  const isModerator = dbUser?.role === 'pastor' || dbUser?.role === 'lider';

  useEffect(() => {
    if (!postId) return;
    const fetchPost = async () => {
      const snap = await getDoc(doc(db, 'posts', postId));
      if (snap.exists()) setPost({ id: snap.id, ...snap.data() });
      setLoading(false);
    };

    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'desc'));
    const unsubComments = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    fetchPost();
    return () => unsubComments();
  }, [postId]);

  // ✅ PUNTO #1: NOTIFICAR AL AUTOR DEL POST
  const notifyAuthor = async (commenterName, textPreview) => {
    // Si yo mismo comento mi post, no me mando notificación
    if (post.authorId === currentUser.uid) return;

    try {
      const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
      const APP_ID = "742a62cd-6d15-427f-8bab-5b8759fabd0a";
      if (!REST_API_KEY) return;

      const path = `/post/${postId}`;

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          // 🎯 Apuntamos directo al autor del post original
          include_external_user_ids: [post.authorId],
          headings: { en: "💬 Nuevo comentario", es: "💬 Nuevo comentario" },
          contents: { 
            en: `${commenterName}: "${textPreview.substring(0, 50)}..."`, 
            es: `${commenterName}: "${textPreview.substring(0, 50)}..."` 
          },
          url: `https://cdsapp.vercel.app/#${path}`,
          data: { route: path },
          isIos: true,
          priority: 10
        })
      });
    } catch (e) { console.error("Error notificar autor:", e); }
  };

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/'); 
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
        
        // 🔥 DISPARAR NOTIFICACIÓN AL DUEÑO DEL POST
        await notifyAuthor(currentUser.displayName, commentText);

        setCommentText('');
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  const deleteComment = async (commentId) => {
    if (window.confirm('¿Eliminar este comentario permanentemente?')) {
        await deleteDoc(doc(db, `posts/${postId}/comments`, commentId));
    }
  };

  if (loading) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" size={40}/></div>;
  if (!post) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white flex-shrink-0">
        <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={26} className="text-slate-800" />
        </button>
        <div className="flex flex-col items-center">
            <span className="font-black text-slate-800 uppercase tracking-tighter text-xs">Publicación</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">{post.type}</span>
        </div>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
        {post.type === 'Devocional' ? (
          <>
            {post.image && <img src={post.image} className="w-full h-72 object-cover" alt="Portada" />}
            <div className="p-6">
              <h1 className="text-3xl font-black text-slate-900 mb-4 leading-tight">{post.title}</h1>
              <div className="flex items-center gap-3 mb-6">
                <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-10 h-10 rounded-full border shadow-sm" />
                <div>
                  <p className="font-bold text-sm text-slate-800">{post.authorName}</p>
                  <p className="text-xs text-slate-400">{post.createdAt?.toDate().toLocaleDateString()}</p>
                </div>
              </div>
              <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>
          </>
        ) : (
          <div className="p-6">
             <div className="flex items-center gap-3 mb-4">
                <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-10 h-10 rounded-full" />
                <div><p className="font-bold text-slate-800">{post.authorName}</p><p className="text-xs text-slate-400">{post.createdAt?.toDate().toLocaleDateString()}</p></div>
             </div>
             <p className="text-base text-slate-800 whitespace-pre-wrap mb-4">{post.content}</p>
             {post.image && <img src={post.image} className="w-full rounded-2xl mb-4 shadow-sm" alt="Post" />}
          </div>
        )}

        <div className="px-6 mt-4 border-t border-slate-50 pt-6">
          <h3 className="font-black text-lg text-slate-800 mb-6 flex items-center gap-2">
            <MessageCircle className="text-brand-500" size={20}/> Comentarios ({comments.length})
          </h3>
          <div className="space-y-6">
            {comments.map(c => (
              <div key={c.id} className="flex gap-4">
                <img src={c.photo || `https://ui-avatars.com/api/?name=${c.name}`} className="w-10 h-10 rounded-full border shadow-sm" />
                <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-tighter">{c.name}</span>
                    
                    {/* ✅ PUNTO #5: El Pastor/Líder puede borrar CUALQUIER comentario. El autor del post también. */}
                    {(c.uid === currentUser.uid || post.authorId === currentUser.uid || isModerator) && (
                      <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={16}/></button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 leading-snug">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-white absolute bottom-0 w-full flex gap-3 items-center shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        <input 
          value={commentText} 
          onChange={e => setCommentText(e.target.value)} 
          placeholder="Escribe un comentario..." 
          className="flex-1 bg-slate-100 rounded-full px-6 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
        />
        <button 
          onClick={sendComment} 
          disabled={!commentText.trim() || isSending} 
          className="w-11 h-11 bg-brand-600 text-white rounded-full flex items-center justify-center disabled:opacity-50 shadow-lg active:scale-90 transition-all"
        >
          {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18}/>}
        </button>
      </div>
    </div>
  );
}