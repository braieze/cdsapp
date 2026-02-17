import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db, messaging } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging'; 
import { Toaster } from 'sonner';

import EventDetails from './pages/EventDetails';
import PostDetail from './pages/PostDetail'; 

import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import MyServices from './pages/MyServices';
import HistoryPage from './pages/History';
import AppsHub from './pages/AppsHub';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Directory from './pages/Directory';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. FUNCIÓN DE SEGUNDO PLANO (No bloquea la carga)
  const syncUserAndNotifications = async (currentUser) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      
      // Verificamos si existe el usuario (sin await en el flujo principal)
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          role: 'miembro',
          area: 'ninguna',
          createdAt: serverTimestamp(),
          phone: ''
        });
      }

      // Configuración de notificaciones (en paralelo)
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk"
        });
        if (token) {
          await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
        }
      }
    } catch (error) {
      console.warn("Tarea de fondo falló, pero la app sigue funcionando:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // ✅ PASO CLAVE: Seteamos el usuario y quitamos el loading DE INMEDIATO
      setUser(currentUser);
      setLoading(false); 

      if (currentUser) {
        // Ejecutamos la sincronización pesada sin 'await', para que no bloquee
        syncUserAndNotifications(currentUser);
      }
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
      <Toaster richColors position="top-center" />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Home />} />
          <Route path="/post/:postId" element={<PostDetail />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/calendario/:id" element={<EventDetails />} />
          <Route path="/servicios" element={<MyServices />} />
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