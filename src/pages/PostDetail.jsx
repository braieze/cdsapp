import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Clock, Tag as TagIcon, Send } from 'lucide-react'; // Cambiamos ArrowLeft por X, agregamos Send

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState(''); // Estado para el input de comentarios

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);

        if (postSnap.exists()) {
          setPost({ id: postSnap.id, ...postSnap.data() });
        } else {
          console.log("No se encontró la publicación.");
        }
      } catch (error) {
        console.error("Error al obtener el post:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  // Función auxiliar para formatear fechas de Firestore
  const formatDate = (timestamp) => {
    if (!timestamp || !(timestamp instanceof Timestamp)) return '';
    return timestamp.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
    </div>
  );

  if (!post) return null; // Opcional: Podrías mostrar un mensaje de error aquí

  return (
    // Usamos 'fixed inset-0' y 'z-50' para que se sienta como un modal de pantalla completa sobre todo lo demás
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in">
      
      {/* === HEADER ESTILO MODAL === */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white flex-shrink-0">
        <button 
          onClick={() => navigate('/')} // Al cerrar, vuelve al inicio
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-800"
        >
          <X size={24} /> {/* Usamos la X en lugar de la flecha */}
        </button>
        <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
          {post.type || 'Publicación'}
        </h2>
        <div className="w-10"></div> {/* Espaciador para centrar el título */}
      </div>

      {/* === CONTENIDO SCROLLEABLE === */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-white pb-20"> {/* pb-20 para dejar espacio al input */}
        
        {/* Imagen Principal */}
        {post.image && (
          <div className="rounded-2xl overflow-hidden shadow-sm mb-5 border border-slate-100">
            <img src={post.image} alt={post.title} className="w-full h-auto object-cover" />
          </div>
        )}

        {/* Título */}
        <h1 className="text-2xl font-black text-slate-900 mb-4 leading-tight">
          {post.title}
        </h1>

        {/* Info Autor y Fecha */}
        <div className="flex items-center gap-3 mb-6">
          <img 
            src={post.authorPhoto || '/default-avatar.png'} 
            alt={post.authorName} 
            className="w-10 h-10 rounded-full object-cover border border-slate-200" 
          />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{post.authorName}</h3>
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Clock size={12} />
              <span>{formatDate(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Cuerpo del Texto */}
        <div className="prose prose-slate max-w-none mb-6">
          <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap">
            {post.content}
          </p>
        </div>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag, idx) => (
              <span key={idx} className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold">
                <TagIcon size={12} />
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* === INPUT DE COMENTARIOS FIJO ABAJO === */}
      <div className="border-t border-slate-100 p-3 bg-white flex items-center gap-2 flex-shrink-0 safe-area-bottom">
        <input 
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Escribe un comentario..."
          className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
        />
        <button 
          disabled={!comment.trim()}
          className="bg-brand-600 text-white p-3 rounded-full hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center shadow-sm"
        >
          <Send size={18} className={comment.trim() ? 'ml-0.5' : ''} />
        </button>
      </div>

    </div>
  );
}