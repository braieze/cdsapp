import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, db, messaging } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging'; 
import { Toaster } from 'sonner';
import OneSignal from 'react-onesignal'; // ✅ Importación de OneSignal

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
import Ofrendar from './pages/Ofrendar'; 
import Tesoreria from './pages/Tesoreria';

// COMPONENTE DESPERTADOR
function NavigationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          console.log("🔔 Notificación recibida en vivo. Navegando a:", event.data.url);
          navigate(event.data.url);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, [navigate]);

  return null;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ 1. INICIALIZACIÓN GLOBAL DE ONESIGNAL
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
        });
        console.log("🚀 OneSignal Inicializado en App.jsx");
      } catch (err) {
        console.error("Error al inicializar OneSignal:", err);
      }
    };
    initOneSignal();
  }, []);

  // ✅ 2. DETECTOR DE NUEVA VERSIÓN (PWA UPDATE)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log("🚀 Nueva versión detectada.");
                window.swUpdateAvailable = true;
                window.dispatchEvent(new Event('swUpdated'));
              }
            };
          }
        };
      });
    }
  }, []);

  // ✅ 3. SINCRONIZACIÓN MAESTRA (FIREBASE + ONESIGNAL)
  const syncUserAndNotifications = async (currentUser) => {
    try {
      // --- Parte A: Firebase Firestore ---
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

      // --- Parte B: OneSignal Identity & Subscription ---
      // Vinculamos el UID de Firebase con OneSignal de inmediato
      await OneSignal.login(currentUser.uid);
      
      // Verificamos permiso. Si no está otorgado, lo pedimos.
      // Esto soluciona el error "All included players are not subscribed"
      const permission = await OneSignal.Notifications.permission;
      if (!permission || permission === 'default') {
        console.log("📢 Pidiendo permiso de notificación para:", currentUser.uid);
        await OneSignal.Notifications.requestPermission();
      }

      // --- Parte C: Firebase Cloud Messaging (Opcional si usas OneSignal) ---
      if (Notification.permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk"
        });
        if (token) {
          await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
        }
      }
      
      console.log("✅ Sincronización de notificaciones completa para:", currentUser.uid);
    } catch (error) {
      console.warn("⚠️ Sync falló parcialmente:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
      if (currentUser) {
        syncUserAndNotifications(currentUser);
      } else {
        // Al cerrar sesión, informamos a OneSignal (opcional)
        if (window.OneSignal) OneSignal.logout();
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
      <NavigationHandler /> 
      <Toaster richColors position="top-center" />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/ofrendar" element={<Ofrendar />} /> 
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
          <Route path="/tesoreria" element={<Tesoreria />} /> 
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;