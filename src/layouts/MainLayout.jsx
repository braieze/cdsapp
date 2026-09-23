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
  const path = location.pathname;

  // 🎯 LÓGICA DE VISIBILIDAD DE NAVEGACIÓN
  // Evaluamos la URL actual para decidir si ocultamos la barra inferior.
  const hideNav = 
    path.includes('/post/') || // Detalles de publicación
    path.includes('/estudio/') || // Hub, Clases y Creación de Academia
    path === '/alabanza' || // Módulo de Alabanza
    path.includes('/notificaciones') || // Pantalla de notificaciones
    path.includes('/chat') || // Cualquier chat
    (path.includes('/calendario/') && path !== '/calendario') || // Detalle de evento específico
    (path.includes('/servicios/') && path !== '/servicios'); // Detalle de servicio específico

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
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FE]">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    /* 
      Fondo global para PC (Gris oscuro/azulado). 
      Si se abre en celular, este fondo no se nota porque el contenedor central ocupa todo.
    */
    <div className="min-h-[100dvh] bg-slate-100 flex justify-center font-sans">
      
      {/* 
        Contenedor estricto que simula la pantalla del celular.
        max-w-md limita el ancho, bg-[#F8F9FE] es el color base de la app.
      */}
      <div className={`w-full max-w-md bg-[#F8F9FE] min-h-[100dvh] relative shadow-2xl transition-all duration-300 ${hideNav ? 'pb-0' : 'pb-24'}`}>
        
        <main className="animate-fade-in h-full">
          <Outlet context={{ dbUser }} /> 
        </main>

        {/* 
          Enjaulamos el BottomNavigation para que respete el ancho del celular.
          Usamos left-1/2 y -translate-x-1/2 para mantenerlo perfectamente centrado en pantallas grandes.
        */}
        {!hideNav && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-[100]">
            <BottomNavigation dbUser={dbUser} />
          </div>
        )}

      </div>
    </div>
  );
}