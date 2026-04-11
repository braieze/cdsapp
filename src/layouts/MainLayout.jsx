import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom'; // ✅ Importamos useLocation
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore'; 
import BottomNavigation from '../components/BottomNavigation';
import { Loader2 } from 'lucide-react';

export default function MainLayout() {
  const [dbUser, setDbUser] = useState(null); 
  const [fetchingUser, setFetchingUser] = useState(true);
  const user = auth.currentUser;
  const location = useLocation(); // ✅ Hook para saber dónde estamos

  // 🎯 Detectamos si estamos en una ruta de estudio para ocultar la nav
  const isStudyPage = location.pathname.includes('/estudio');

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
    // ✅ Cambiamos el padding inferior dinámicamente (pb-36 solo si NO es estudio)
    <div className={`min-h-[100dvh] bg-slate-50 font-outfit text-slate-800 ${isStudyPage ? 'pb-0' : 'pb-36'}`}>
      <main className="max-w-md mx-auto animate-fade-in relative bg-slate-50">
        <Outlet context={{ dbUser }} /> 
      </main>

      {/* ✅ Ocultamos la navegación si estamos en estudios */}
      {!isStudyPage && <BottomNavigation dbUser={dbUser} />}
    </div>
  );
}