import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNavigation from '../components/BottomNavigation'; // Importamos el nuevo componente

export default function MainLayout() {
  const [dbUser, setDbUser] = useState(null); 
  const user = auth.currentUser;

  // Este efecto busca tu rol en la base de datos apenas entras
  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setDbUser(userSnap.data());
        }
      }
    };
    fetchUserRole();
  }, [user]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-20 font-outfit text-slate-800">
      
      {/* 🔥 IMPORTANTE: 
          Hemos eliminado el <header> viejo de aquí.
          Ahora cada página (Home, Calendar, etc.) usará <TopBar /> si lo necesita.
          Esto elimina el "doble navbar".
      */}

      <main className="max-w-md mx-auto animate-fade-in relative bg-slate-50">
        {/* Pasamos los datos del usuario a todas las pantallas hijas */}
        <Outlet context={{ dbUser }} /> 
      </main>

      {/* Navegación Inferior Modularizada */}
      <BottomNavigation />
      
    </div>
  );
}