import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore'; // ✅ Cambiamos getDoc por onSnapshot
import BottomNavigation from '../components/BottomNavigation';

export default function MainLayout() {
  const [dbUser, setDbUser] = useState(null); 
  const user = auth.currentUser;

  // ✅ ESCUCHA EN TIEMPO REAL DEL PERFIL DE USUARIO
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    
    // onSnapshot detecta cambios en readNotifications, role, etc., al instante
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setDbUser(docSnap.data());
      }
    }, (error) => {
      console.error("Error escuchando usuario:", error);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-20 font-outfit text-slate-800">
      <main className="max-w-md mx-auto animate-fade-in relative bg-slate-50">
        {/* Pasamos dbUser a las páginas hijas por si lo necesitan */}
        <Outlet context={{ dbUser }} /> 
      </main>

      {/* ✅ La navegación ahora recibe datos que cambian en vivo */}
      <BottomNavigation dbUser={dbUser} />
    </div>
  );
}