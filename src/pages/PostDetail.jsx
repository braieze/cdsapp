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

    // 1. Cargar el Post
    const fetchPost = async () => {
      const docRef = doc(db, 'posts', postId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    };

    // 2. Cargar Comentarios en tiempo real
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
    if (window.confirm('¿Borrar comentario?')) {
      await deleteDoc(doc(db, `posts/${postId}/comments`, id));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!post) return <div className="p-10 text-center">Publicación no encontrada</div>;

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-fade-in">
      {/* Header unificado (Estilo Modal de tu imagen) */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={24} />
        </button>
        <span className="font-bold text-slate-800 uppercase tracking-wider text-xs">{post.type}</span>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Renderizado de Devocional o Noticia Normal */}
        {post.type === 'Devocional' ? (
          <>
            {post.image && <img src={post.image} className="w-full h-auto object-cover max-h-[400px]" alt="Portada" />}
            <div className="p-6">
              <h1 className="text-3xl font-black text-slate-900 mb-4 leading-tight">{post.title}</h1>
              <div className="flex items-center gap-3 mb-6">
                <img src={post.authorPhoto} className="w-12 h-12 rounded-full border shadow-sm" alt="Autor" />
                <div>
                  <p className="font-bold text-base text-slate-800">{post.authorName}</p>
                  <p className="text-sm text-slate-500">{post.createdAt?.toDate().toLocaleDateString()}</p>
                </div>
              </div>
              <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap mb-6">{post.content}</p>
            </div>
          </>
        ) : (
          <div className="p-6">
             {/* Noticia Normal */}
             <div className="flex items-center gap-3 mb-4">
                <img src={post.authorPhoto} className="w-10 h-10 rounded-full" alt="Autor" />
                <div><p className="font-bold text-slate-800">{post.authorName}</p><p className="text-xs text-slate-400">{post.createdAt?.toDate().toLocaleDateString()}</p></div>
             </div>
             <p className="text-base text-slate-800 whitespace-pre-wrap mb-4">{post.content}</p>
             {post.image && <img src={post.image} className="w-full rounded-2xl mb-4 shadow-md" alt="Post" />}
          </div>
        )}

        {/* Sección de Comentarios Unificada */}
        <div className="px-6 pb-10">
          <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-2">
            <MessageCircle className="text-brand-500" size={24}/> 
            Comentarios <span className="text-slate-400 text-base font-normal">({comments.length})</span>
          </h3>
          <div className="space-y-6">
            {comments.map(c => (
              <div key={c.id} className="flex gap-4">
                <img src={c.photo} className="w-10 h-10 rounded-full border border-slate-100 shadow-sm" alt="User" />
                <div className="flex-1 bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100">
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

      {/* Input de Comentarios Fijo */}
      <div className="p-4 border-t border-slate-100 bg-white absolute bottom-0 w-full flex gap-3 items-center shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <input 
          value={commentText} 
          onChange={e => setCommentText(e.target.value)} 
          placeholder="Escribe un comentario..." 
          className="flex-1 bg-slate-100 rounded-full px-6 py-3.5 text-base outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button 
          onClick={sendComment} 
          disabled={!commentText.trim()} 
          className="p-3.5 bg-brand-600 text-white rounded-full disabled:opacity-50 shadow-md active:scale-95 transition-all"
        >
          <Send size={20}/>
        </button>
      </div>
    </div>
  );
}