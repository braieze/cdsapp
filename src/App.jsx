import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, db, messaging } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging'; 
import { Toaster } from 'sonner';
import OneSignal from 'react-onesignal'; 

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

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

// ✅ 1. ÚNICO EFECTO DE CONTROL: INICIALIZACIÓN + AUTH
  useEffect(() => {
    const initAndSync = async () => {
      // A. Inicializar OneSignal de forma segura
      try {
        if (!window.OneSignal || !window.OneSignal.initialized) {
          await OneSignal.init({
            appId: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
            allowLocalhostAsSecureOrigin: true,
            notifyButton: { enable: false },
          });
          console.log("🚀 OneSignal: Motor listo");
        }
      } catch (err) {
        console.warn("Información OneSignal Init:", err.message);
      }

      // B. Escuchar cambios de usuario
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        setLoading(false);

        if (currentUser) {
          await syncMaster(currentUser);
        } else {
          try { 
            if (window.OneSignal && window.OneSignal.initialized) {
              await OneSignal.logout(); 
            }
          } catch (e) {}
        }
      });

      return unsubscribe;
    };

    const unsubAuth = initAndSync();
    return () => { 
      if (typeof unsubAuth === 'function') unsubAuth(); 
    };
  }, []);

  // ✅ 2. SINCRONIZACIÓN MAESTRA (FIREBASE + ONESIGNAL FINAL)
  const syncMaster = async (currentUser) => {
    try {
      // PARTE 1: FIRESTORE (Asegurar que el usuario existe)
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

      // PARTE 2: ONESIGNAL (EL MARTILLAZO DE IDENTIDAD)
      // Usamos un retraso de 3 segundos para que el navegador registre 
      // el dispositivo antes de intentar ponerle nombre (External ID).
      setTimeout(async () => {
        try {
          // Este comando es el que llena el "External ID" en el panel
          await OneSignal.login(currentUser.uid);
          console.log(`💎 OneSignal: Identidad vinculada para ${currentUser.uid}`);
        } catch (idErr) {
          console.error("❌ Error vinculando identidad:", idErr.message);
        }
      }, 3000); 

      // PARTE 3: PERMISOS (Activar el canal Push)
      // Usamos una lectura más compatible del permiso
      const currentPerm = window.Notification?.permission;
      if (currentPerm !== 'granted') {
        console.log("📢 Solicitando permiso de notificaciones...");
        await OneSignal.Notifications.requestPermission();
      }

      // PARTE 4: FIREBASE CLOUD MESSAGING (Backup)
      if (window.Notification?.permission === 'granted') {
        try {
          const token = await getToken(messaging, {
            vapidKey: "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk"
          });
          if (token) await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
        } catch (fcmErr) { /* Backup FCM silencioso */ }
      }

      console.log("✅ Ciclo de sincronización completado");
    } catch (error) {
      console.warn("⚠️ Error general en Sync:", error.message);
    }
  };

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