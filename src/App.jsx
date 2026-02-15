import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase'; // Importamos db también
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Importamos funciones de base de datos
import EventDetails from './pages/EventDetails'; // ✅ Importar la nueva página (Aún no existe, no te asustes si da error un segundo)

// Layouts y Páginas
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import MyServices from './pages/MyServices';
import HistoryPage from './pages/History'; // 👈 IMPORTANTE: Agrega esto
import AppsHub from './pages/AppsHub';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Directory from './pages/Directory';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // 1. Si el usuario está logueado, verificamos si existe en la Base de Datos
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // 2. Si NO existe (es nuevo o no se guardó), lo creamos ahora mismo
          await setDoc(userRef, {
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            role: 'miembro',      // Rol por defecto
            area: 'ninguna',      // Área por defecto
            createdAt: serverTimestamp(),
            phone: ''
          });
          console.log("Usuario creado en el Directorio automáticamente.");
        }
      }
      
      // 3. Guardamos el usuario en el estado y terminamos la carga
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Si no hay usuario, solo puede ver el Login */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

        {/* Rutas protegidas */}
        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Home />} />
          
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/calendario/:id" element={<EventDetails />} /> {/* ✅ NUEVA RUTA (Hija de calendario) */}
          
          <Route path="/servicios" element={<MyServices />} />
          {/* 👇 AGREGA ESTA LÍNEA */}
          <Route path="/historial" element={<HistoryPage />} />
          <Route path="/apps" element={<AppsHub />} />
          <Route path="/perfil" element={<Profile />} /> 
          <Route path="/directorio" element={<Directory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;