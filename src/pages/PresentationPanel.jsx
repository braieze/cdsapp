import { useState } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, getDocs, updateDoc, doc, addDoc, 
  serverTimestamp, deleteDoc, query, where 
} from 'firebase/firestore';
import { 
  Shield, Users, Calendar, Sparkles, Loader2, 
  BookOpen, LayoutGrid, Home, Wand2, Trash2, AlertOctagon, Cake
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function PresentationPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  const MY_DNI = "43043713"; 

  // --- 1. FUNCIÓN: DISTRIBUCIÓN DINÁMICA DE SERVIDORES ---
  const handleMassAssignment = async () => {
    setLoading(true);
    try {
      // 1. Traer todos los usuarios que son SERVIDORES
      const userSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'servidor')));
      
      const servers = userSnap.docs
        .filter(d => d.data().dni !== MY_DNI)
        .map(d => d.data().displayName);

      if (servers.length === 0) {
        throw new Error("No hay usuarios con rol 'servidor'. Primero pulsa 'Staff (Servidores)' abajo.");
      }

      // 2. Mezclar servidores aleatoriamente
      const shuffled = [...servers].sort(() => 0.5 - Math.random());
      const total = shuffled.length;

      // 3. Calcular tamaños de grupos (Proporcional)
      // Dividimos el total en 4 grupos para cultos (aprox 20% cada uno) y el resto para limpieza
      const cultosCount = Math.floor(total / 4);
      
      const groups = [
        { title: "DEMO: Culto GRP A", type: "Culto", members: shuffled.slice(0, cultosCount) },
        { title: "DEMO: Culto GRP B", type: "Culto", members: shuffled.slice(cultosCount, cultosCount * 2) },
        { title: "DEMO: Culto GRP C", type: "Culto", members: shuffled.slice(cultosCount * 2, cultosCount * 3) },
        { title: "DEMO: Culto GRP D", type: "Culto", members: shuffled.slice(cultosCount * 3, total) },
        { title: "DEMO: Limpieza Templo", type: "Limpieza", members: shuffled.slice(0, Math.max(1, Math.floor(total / 5))) },
        { title: "DEMO: Ayuno General", type: "Oración", members: shuffled } // TODOS aquí
      ];

      // 4. Crear los eventos en Firestore
      for (const group of groups) {
        if (group.members.length === 0) continue;

        await addDoc(collection(db, 'events'), {
          title: group.title,
          type: group.type,
          date: new Date().toISOString().split('T')[0], 
          time: "20:00",
          location: "Santuario Principal",
          published: false, // Se guardan en BORRADOR
          assignments: { "Servidores": group.members },
          createdAt: serverTimestamp(),
          isDemo: true
        });
      }

      toast.success(`¡Misión cumplida! ${total} personas repartidas en 6 eventos.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. FUNCIÓN: POST URGENTE ---
  const createUrgentPost = async () => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'posts'), {
        title: "🚨 AVISO URGENTE: CAMBIO DE CLIMA",
        content: "Debido a las fuertes lluvias, el evento de hoy se traslada al salón techado. ¡Por favor compartir!",
        type: "Urgente",
        authorName: "ADMINISTRACIÓN",
        createdAt: serverTimestamp(),
        visibility: "publico",
        isDemo: true
      });
      toast.success("Post urgente lanzado");
    } catch (e) { toast.error("Error"); } finally { setLoading(false); }
  };

  // --- 3. FUNCIÓN: SIMULAR MI CUMPLEAÑOS ---
  const setMyBirthdayToday = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0]; 
      await updateDoc(doc(db, 'users', currentUser.uid), { birthday: today });
      toast.success("¡Felicidades Braian! App en modo festivo.");
    } catch (e) { toast.error("Error"); } finally { setLoading(false); }
  };

  // --- 4. FUNCIÓN: LIMPIEZA TOTAL ---
  const clearDemoData = async () => {
    const confirm = window.confirm("¿Limpiar todos los datos de prueba?");
    if (!confirm) return;
    setLoading(true);
    try {
      const evSnap = await getDocs(query(collection(db, 'events'), where('isDemo', '==', true)));
      for (const d of evSnap.docs) { await deleteDoc(doc(db, 'events', d.id)); }

      const postSnap = await getDocs(query(collection(db, 'posts'), where('isDemo', '==', true)));
      for (const d of postSnap.docs) { await deleteDoc(doc(db, 'posts', d.id)); }

      toast.success("Base de datos limpia y lista.");
    } catch (e) { toast.error("Error al limpiar"); } finally { setLoading(false); }
  };

  // --- 5. CAMBIO DE ROLES MASIVO ---
  const handleMassRoleUpdate = async (newRole) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const updates = snap.docs.map(d => {
        if (d.data().dni === MY_DNI || d.id === currentUser.uid) return null;
        return updateDoc(doc(db, 'users', d.id), { role: newRole });
      });
      await Promise.all(updates);
      toast.success(`Ahora todos son ${newRole.toUpperCase()}S`);
    } catch (e) { toast.error("Error"); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-outfit">
      <div className="max-w-md mx-auto space-y-8 pt-10 pb-20">
        
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-brand-500/40 animate-pulse">
            <Wand2 size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic text-brand-400">CDS MASTER CONTROL</h1>
        </div>

        {/* ORGANIZACIÓN DINÁMICA */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 text-left">1. Automatización</p>
          <button onClick={handleMassAssignment} disabled={loading} className="w-full bg-brand-600 p-6 rounded-[30px] flex items-center gap-4 active:scale-95 transition-all shadow-xl">
            <div className="p-3 bg-white/20 rounded-2xl"><LayoutGrid size={24}/></div>
            <div className="text-left">
              <p className="font-black uppercase text-sm italic">Repartir Servidores</p>
              <p className="text-[9px] font-bold text-brand-200 uppercase mt-1">Calcula y asigna a TODOS automáticamente</p>
            </div>
          </button>
        </div>

        {/* COMUNICACIÓN */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 text-left">2. Alertas Reales</p>
          <button onClick={createUrgentPost} disabled={loading} className="w-full bg-red-600 p-6 rounded-[30px] flex items-center gap-4 active:scale-95 transition-all shadow-xl">
            <div className="p-3 bg-white/20 rounded-2xl"><AlertOctagon size={24}/></div>
            <div className="text-left"><p className="font-black uppercase text-sm">Lanzar Alerta Roja</p><p className="text-[9px] font-bold text-red-200 uppercase mt-1">Simula un aviso de emergencia</p></div>
          </button>
        </div>

        {/* EFECTO VISUAL */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 text-left">3. Experiencia de Usuario</p>
          <button onClick={setMyBirthdayToday} disabled={loading} className="w-full bg-indigo-600 p-6 rounded-[30px] flex items-center gap-4 active:scale-95 transition-all shadow-xl">
            <div className="p-3 bg-white/20 rounded-2xl"><Cake size={24}/></div>
            <div className="text-left"><p className="font-black uppercase text-sm">Activar Mi Cumpleaños</p><p className="text-[9px] font-bold text-indigo-200 uppercase mt-1">Muestra el diseño festivo</p></div>
          </button>
        </div>

        {/* ROLES */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 text-left">4. Gestión de Permisos</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleMassRoleUpdate('miembro')} className="bg-white text-slate-900 p-5 rounded-[28px] font-black text-[10px] uppercase shadow-lg">Iglesia (Miembros)</button>
            <button onClick={() => handleMassRoleUpdate('servidor')} className="bg-slate-800 text-white p-5 rounded-[28px] font-black text-[10px] uppercase border border-slate-700">Staff (Servidores)</button>
          </div>
        </div>

        {/* LIMPIEZA */}
        <div className="pt-6 border-t border-slate-900">
            <button onClick={clearDemoData} disabled={loading} className="w-full py-4 border-2 border-dashed border-red-900/30 text-red-500 rounded-[28px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Trash2 size={16}/> Limpiar datos de Demo
            </button>
        </div>

        <button onClick={() => navigate('/')} className="w-full py-6 text-slate-600 font-black uppercase text-[10px] tracking-[0.4em] flex items-center justify-center gap-2">
          <Home size={16}/> Ir al Inicio
        </button>

        {loading && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[200]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-brand-500" size={48} />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Ejecutando Magia...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}