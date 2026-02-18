import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import ServiceDetails from './pages/ServiceDetails';
import HistoryPage from './pages/History';
import AppsHub from './pages/AppsHub';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Directory from './pages/Directory';

// 🔥 COMPONENTE DESPERTADOR (PASO 4)
// Este componente escucha al Service Worker y fuerza la navegación
function NavigationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event) => {
        // Escuchamos el mensaje 'NAVIGATE' enviado por el SW
        if (event.data && event.data.type === 'NAVIGATE') {
          console.log("🔔 Notificación recibida en vivo. Navegando a:", event.data.url);
          navigate(event.data.url);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, [navigate]);

  return null; // No renderiza nada, solo escucha
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncUserAndNotifications = async (currentUser) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
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
      console.warn("Sync falló:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
      if (currentUser) syncUserAndNotifications(currentUser);
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
      {/* ✅ El NavigationHandler debe estar AQUÍ, dentro del BrowserRouter */}
      <NavigationHandler /> 
      
      <Toaster richColors position="top-center" />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Home />} />
          <Route path="/post/:postId" element={<PostDetail />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/calendario/:id" element={<EventDetails />} />
          <Route path="/servicios" element={<MyServices />} />
          <Route path="/servicios/:id" element={<ServiceDetails />} />
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