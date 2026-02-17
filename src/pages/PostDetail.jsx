import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ArrowLeft, Clock, User, Tag as TagIcon, Share2, MessageCircle, Heart } from 'lucide-react';

export default function PostDetail() {
  const { postId } = useParams(); // Captura el ID desde la URL (/post/ID)
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600"></div>
    </div>
  );

  if (!post) return (
    <div className="p-8 text-center min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <h2 className="text-xl font-bold text-slate-800">Publicación no encontrada</h2>
      <button 
        onClick={() => navigate('/')} 
        className="mt-4 bg-brand-600 text-white px-6 py-2 rounded-full font-bold shadow-md"
      >
        Volver al inicio
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm animate-fade-in pb-20">
      {/* Header Pegajoso */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-700"
          >
            <ArrowLeft size={24} />
          </button>
          <span className="font-bold text-slate-800 line-clamp-1">
            {post.type || 'Publicación'}
          </span>
        </div>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
          <Share2 size={20} />
        </button>
      </div>

      <div className="p-4 md:p-6">
        {/* Título Principal */}
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-4 leading-tight">
          {post.title}
        </h1>

        {/* Info del Autor */}
        <div className="flex items-center gap-3 mb-6 bg-slate-50 p-3 rounded-2xl">
          <img 
            src={post.authorPhoto || '/default-avatar.png'} 
            alt={post.authorName} 
            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" 
          />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{post.authorName}</h3>
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Clock size={12} />
              <span>{post.createdAt?.toDate().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Imagen del Post */}
        {post.image && (
          <div className="relative mb-6 rounded-3xl overflow-hidden shadow-lg border border-slate-100">
            <img src={post.image} alt="Contenido" className="w-full h-auto object-cover" />
          </div>
        )}

        {/* Contenido de Texto */}
        <div className="prose prose-slate max-w-none mb-8">
          <p className="text-slate-700 leading-relaxed text-lg whitespace-pre-wrap">
            {post.content}
          </p>
        </div>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-100">
            {post.tags.map((tag, idx) => (
              <span key={idx} className="flex items-center gap-1 bg-brand-50 text-brand-700 px-4 py-1.5 rounded-full text-xs font-bold">
                <TagIcon size={12} />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Enlace si existe */}
        {post.link && (
          <a 
            href={post.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-8 flex items-center justify-center gap-2 bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg"
          >
            {post.linkText || 'Ver más'}
          </a>
        )}
      </div>

      {/* Barra de Interacción (Visual) */}
      <div className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 flex justify-around items-center">
        <button className="flex items-center gap-2 text-slate-600 font-medium">
          <Heart size={20} /> {post.likes?.length || 0}
        </button>
        <button className="flex items-center gap-2 text-slate-600 font-medium">
          <MessageCircle size={20} /> {post.commentsCount || 0}
        </button>
      </div>
    </div>
  );
}