import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Shield, Users, Calendar, Sparkles, Loader2, 
  BookOpen, Play, LayoutGrid, Home, Wand2 
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function PresentationPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  const MY_DNI = "43043713"; 

  // --- 1. FUNCIÓN: DISTRIBUCIÓN MASIVA INTELIGENTE ---
  const handleMassAssignment = async () => {
    const confirm = window.confirm("¿Repartir a toda la congregación en turnos de prueba? (Se crearán 7 eventos en borrador)");
    if (!confirm) return;

    setLoading(true);
    try {
      const userSnap = await getDocs(collection(db, 'users'));
      // Filtramos y obtenemos solo los nombres, excluyéndote a vos
      const allUserNames = userSnap.docs
        .filter(d => d.data().dni !== MY_DNI)
        .map(d => d.data().displayName);

      if (allUserNames.length === 0) throw new Error("No hay usuarios para asignar");

      // Mezclamos la lista para que sea aleatorio
      const shuffled = [...allUserNames].sort(() => 0.5 - Math.random());

      // Configuración de eventos a crear
      const eventsToCreate = [
        { title: "Culto - Grupo A", type: "Culto", size: 15 },
        { title: "Culto - Grupo B", type: "Culto", size: 15 },
        { title: "Culto - Grupo C", type: "Culto", size: 15 },
        { title: "Culto - Grupo D", type: "Culto", size: 15 },
        { title: "Limpieza Mañana", type: "Limpieza", size: 5 },
        { title: "Limpieza Tarde", type: "Limpieza", size: 5 },
        { title: "Ayuno General", type: "Oración", size: shuffled.length } // Todos en el ayuno
      ];

      let currentIndex = 0;

      for (const config of eventsToCreate) {
        // Tomamos un trozo de la lista de usuarios
        const chunk = shuffled.slice(currentIndex, currentIndex + config.size);
        
        await addDoc(collection(db, 'events'), {
          title: config.title,
          type: config.type,
          date: "2026-04-15", // Fecha de ejemplo
          time: "19:00",
          location: "Templo Central",
          published: false, // 🚩 IMPORTANTE: En borrador
          assignments: {
            "Servidores": chunk // Los asignamos al área "Servidores"
          },
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });

        // Solo avanzamos el índice si no es el Ayuno General (donde repetimos a todos)
        if (config.title !== "Ayuno General") currentIndex += config.size;
      }

      toast.success("¡Distribución masiva creada en borradores!");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. FUNCIÓN: SEMBRAR ACADEMIA (Serie + Clase) ---
  const seedAcademicDemo = async () => {
    setLoading(true);
    try {
      // Crear la Serie
      const studyRef = await addDoc(collection(db, 'studies'), {
        title: "Fundamentos de la Fe",
        description: "Una serie profunda sobre los pilares del cristianismo para nuevos creyentes.",
        category: "Estudios Bíblicos",
        instructorName: "Braian Gomez",
        instructorPhoto: currentUser?.photoURL || "",
        coverImage: "https://images.unsplash.com/photo-1504052434139-441ae7420e92?auto=format&fit=crop&w=800&q=80",
        visibility: "publico",
        createdAt: serverTimestamp()
      });

      // Crear una Clase para esa serie
      await addDoc(collection(db, 'lessons'), {
        studyId: studyRef.id,
        title: "Capítulo 1: La Gracia de Dios",
        description: "Entendiendo el regalo inmerecido que cambió la historia.",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Link de ejemplo
        duration: "15 min",
        order: 1,
        createdAt: serverTimestamp()
      });

      toast.success("Serie y Clase demo creadas");
    } catch (e) {
      toast.error("Error al crear academia");
    } finally {
      setLoading(false);
    }
  };

  // --- 3. CAMBIO DE ROLES (Mantenido) ---
  const handleMassRoleUpdate = async (newRole) => {
    if (!window.confirm(`¿Pasar a todos a ${newRole}?`)) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const updates = snap.docs.map(d => {
        if (d.data().dni === MY_DNI) return null;
        return updateDoc(doc(db, 'users', d.id), { role: newRole });
      });
      await Promise.all(updates);
      toast.success("Roles actualizados");
    } catch (e) { toast.error("Error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-outfit">
      <div className="max-w-md mx-auto space-y-8 pt-10">
        
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-brand-500/40">
            <Wand2 size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Demo Master Control</h1>
        </div>

        {/* SECCIÓN 1: ORGANIZACIÓN DE SERVICIOS */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] ml-2 text-left">Automatización de Servicios</p>
          <button 
            onClick={handleMassAssignment}
            disabled={loading}
            className="w-full bg-brand-600 text-white p-6 rounded-[30px] flex items-center gap-4 active:scale-95 transition-all shadow-xl shadow-brand-900/20"
          >
            <div className="p-3 bg-white/20 rounded-2xl"><LayoutGrid size={24}/></div>
            <div className="text-left">
              <p className="font-black uppercase text-sm leading-none">Distribuir 70 personas</p>
              <p className="text-[9px] font-bold text-brand-200 uppercase mt-1">Crea 4 Cultos, Limpieza y Ayuno</p>
            </div>
          </button>
        </div>

        {/* SECCIÓN 2: ACADEMIA */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] ml-2 text-left">Contenido Académico</p>
          <button 
            onClick={seedAcademicDemo}
            disabled={loading}
            className="w-full bg-emerald-600 text-white p-6 rounded-[30px] flex items-center gap-4 active:scale-95 transition-all shadow-xl shadow-emerald-900/20"
          >
            <div className="p-3 bg-white/20 rounded-2xl"><BookOpen size={24}/></div>
            <div className="text-left">
              <p className="font-black uppercase text-sm leading-none">Crear Serie + Clase</p>
              <p className="text-[9px] font-bold text-emerald-200 uppercase mt-1">Puebla la sección de Series Bíblicas</p>
            </div>
          </button>
        </div>

        {/* SECCIÓN 3: ROLES */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 text-left">Control de Permisos</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleMassRoleUpdate('miembro')} className="bg-white text-slate-900 p-4 rounded-3xl font-black text-[10px] uppercase shadow-lg">Todos Miembros</button>
            <button onClick={() => handleMassRoleUpdate('lider')} className="bg-slate-800 text-white p-4 rounded-3xl font-black text-[10px] uppercase border border-slate-700">Todos Líderes</button>
          </div>
        </div>

        <button onClick={() => navigate('/')} className="w-full py-6 text-slate-500 font-black uppercase text-[10px] tracking-[0.4em] flex items-center justify-center gap-2">
          <Home size={16}/> Salir de modo Demo
        </button>

        {loading && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200]">
            <Loader2 className="animate-spin text-brand-500" size={48} />
          </div>
        )}
      </div>
    </div>
  );
}