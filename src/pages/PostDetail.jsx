import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { X, MessageCircle, Send, Trash2, Clock, Calendar, ExternalLink, Link as LinkIcon } from 'lucide-react';

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);

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

  const sendComment = async () => {
    if (!commentText.trim()) return;
    await addDoc(collection(db, `posts/${postId}/comments`), {
      text: commentText,
      uid: currentUser.uid,
      name: currentUser.displayName,
      photo: currentUser.photoURL,
      createdAt: serverTimestamp()
    });
    setCommentText('');
  };

  const deleteComment = async (id) => {
    if (window.confirm('¿Borrar comentario?')) await deleteDoc(doc(db, `posts/${postId}/comments`, id));
  };

  if (loading) return <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!post) return null;

  return (
    // 'fixed inset-0' asegura que sea 100% pantalla completa y bloquee el scroll del fondo
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden">
      
      {/* Header Fijo */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={26} className="text-slate-800" />
        </button>
        <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">{post.type}</span>
        <div className="w-8"></div>
      </div>

      {/* Contenido Scrolleable */}
      <div className="flex-1 overflow-y-auto pb-32">
        {post.type === 'Devocional' ? (
          <>
            {post.image && <img src={post.image} className="w-full h-auto object-cover max-h-[450px]" alt="Portada" />}
            <div className="p-6">
              <h1 className="text-3xl font-black text-slate-900 mb-4 leading-tight">{post.title}</h1>
              <div className="flex items-center gap-3 mb-6">
                <img src={post.authorPhoto} className="w-12 h-12 rounded-full border border-slate-100 shadow-sm" alt="Autor" />
                <div>
                  <p className="font-bold text-base text-slate-800">{post.authorName}</p>
                  <p className="text-sm text-slate-500">{post.createdAt?.toDate().toLocaleDateString()}</p>
                </div>
              </div>
              <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>
          </>
        ) : (
          <div className="p-6">
             <div className="flex items-center gap-3 mb-4">
                <img src={post.authorPhoto} className="w-10 h-10 rounded-full" alt="Autor" />
                <div><p className="font-bold text-slate-800">{post.authorName}</p><p className="text-xs text-slate-400">{post.createdAt?.toDate().toLocaleDateString()}</p></div>
             </div>
             <p className="text-base text-slate-800 whitespace-pre-wrap mb-4">{post.content}</p>
             {post.image && <img src={post.image} className="w-full rounded-2xl mb-4 shadow-sm" alt="Post" />}
          </div>
        )}

        {/* Sección Comentarios */}
        <div className="px-6 mt-6">
          <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-2">
            <MessageCircle className="text-brand-500" size={24}/> Comentarios ({comments.length})
          </h3>
          <div className="space-y-6">
            {comments.map(c => (
              <div key={c.id} className="flex gap-4">
                <img src={c.photo} className="w-10 h-10 rounded-full border border-slate-100 shadow-sm" alt="User" />
                <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-slate-800">{c.name}</span>
                    {(c.uid === currentUser.uid || post.authorId === currentUser.uid) && (
                      <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                    )}
                  </div>
                  <p className="text-base text-slate-600 leading-snug">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input de Comentarios Fijo Abajo */}
      <div className="p-4 border-t border-slate-100 bg-white absolute bottom-0 w-full flex gap-3 items-center shadow-lg">
        <input 
          value={commentText} 
          onChange={e => setCommentText(e.target.value)} 
          placeholder="Escribe un comentario..." 
          className="flex-1 bg-slate-100 rounded-full px-6 py-3.5 text-base outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button 
          onClick={sendComment} 
          disabled={!commentText.trim()} 
          className="p-3.5 bg-brand-600 text-white rounded-full disabled:opacity-50 shadow-md transition-all active:scale-95"
        >
          <Send size={20}/>
        </button>
      </div>
    </div>
  );
}