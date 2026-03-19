import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore'; 
import BottomNavigation from '../components/BottomNavigation';
import { Loader2 } from 'lucide-react';

export default function MainLayout() {
  const [dbUser, setDbUser] = useState(null); 
  const [fetchingUser, setFetchingUser] = useState(true);
  const user = auth.currentUser;

  // ✅ ESCUCHA EN TIEMPO REAL DEL PERFIL (Punto #5)
  useEffect(() => {
    if (!user) {
      setFetchingUser(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    
    // onSnapshot es clave para que los cambios de ROL impacten al instante
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setDbUser({ id: docSnap.id, ...docSnap.data() });
      }
      setFetchingUser(false);
    }, (error) => {
      console.error("Error escuchando usuario:", error);
      setFetchingUser(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Si estamos cargando el perfil de la DB, mostramos un spinner pequeño
  if (fetchingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-36 font-outfit text-slate-800">
      <main className="max-w-md mx-auto animate-fade-in relative bg-slate-50">
        {/* ✅ Punto #5: Pasamos dbUser a todas las páginas (Home, Calendar, etc) */}
        <Outlet context={{ dbUser }} /> 
      </main>

      {/* ✅ La navegación recibe el dbUser para ocultar/mostrar botones (Tesorería) */}
      <BottomNavigation dbUser={dbUser} />
    </div>
  );
}