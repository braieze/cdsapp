import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore'; 
import BottomNavigation from '../components/BottomNavigation';
import { Loader2 } from 'lucide-react';

export default function MainLayout() {
  const [dbUser, setDbUser] = useState(null); 
  const [fetchingUser, setFetchingUser] = useState(true);
  const user = auth.currentUser;
  const location = useLocation();

  // 🎯 LÓGICA DE VISIBILIDAD DE NAVEGACIÓN (Punto 2)
  // Mostramos el menú SIEMPRE, EXCEPTO cuando:
  // 1. Estamos en el detalle de una serie (/estudio/ID_DE_SERIE)
  // 2. Estamos en una clase (/estudio/clase/ID_DE_CLASE)
  // 3. Estamos creando/editando (/estudio/crear o /estudio/nueva-clase)
  // 4. Estamos en el módulo de Alabanza (/alabanza) <- ¡NUEVO!
  
  const hideNav = location.pathname.includes('/estudio/') || 
                  location.pathname.includes('/editar-clase/') ||
                  location.pathname.includes('/nueva-clase/') ||
                  location.pathname.includes('/alabanza');

  useEffect(() => {
    if (!user) {
      setFetchingUser(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
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

  if (fetchingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    );
  }

  return (
    // ✅ pb-36 se mantiene solo si el menú está visible
    <div className={`min-h-[100dvh] bg-slate-50 font-outfit text-slate-800 transition-all duration-300 ${hideNav ? 'pb-0' : 'pb-36'}`}>
      <main className="max-w-md mx-auto animate-fade-in relative bg-slate-50">
        <Outlet context={{ dbUser }} /> 
      </main>

      {/* ✅ Solo renderiza el BottomNavigation si NO estamos en un detalle/clase/alabanza */}
      {!hideNav && <BottomNavigation dbUser={dbUser} />}
    </div>
  );
}