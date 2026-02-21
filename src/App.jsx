import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, db, messaging } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging'; 
import { Toaster } from 'sonner';
import { Capacitor } from '@capacitor/core'; // ✅ Detecta si es App o Web
import OneSignalWeb from 'react-onesignal'; // ✅ Renombrado para claridad

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
  const isNative = Capacitor.isNativePlatform(); // ✅ TRUE en Android/iOS Nativo

  // ✅ 1. INICIALIZACIÓN DUAL DE ONESIGNAL
  useEffect(() => {
    const initNotifications = async () => {
      if (isNative) {
        // --- LÓGICA PARA ANDROID NATIVO (Capacitor) ---
        try {
          // El plugin de OneSignal Nativo se inicializa automáticamente 
          // mediante el plugin de Cordova que instalaste. Solo configuramos el ID.
          const OneSignal = window.OneSignal || (window.plugins && window.plugins.OneSignal);
          if (OneSignal) {
            OneSignal.setAppId("742a62cd-6d15-427f-8bab-5b8759fabd0a");
            console.log("🚀 OneSignal Nativo (Android) configurado");
          }
        } catch (e) { console.error("Error OneSignal Nativo:", e); }
      } else {
        // --- LÓGICA PARA WEB/PWA (iOS) ---
        try {
          if (!window.OneSignal || !window.OneSignal.initialized) {
            await OneSignalWeb.init({
              appId: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
              allowLocalhostAsSecureOrigin: true,
              notifyButton: { enable: false },
            });
            console.log("🚀 OneSignal Web (PWA) listo");
          }
        } catch (err) { console.warn("Info OneSignal Web:", err.message); }
      }
    };

    initNotifications();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        syncMaster(currentUser);
      } else {
        // Logout según plataforma
        if (isNative) {
          const OneSignal = window.OneSignal || (window.plugins && window.plugins.OneSignal);
          if (OneSignal) OneSignal.logout();
        } else {
          if (window.OneSignal && window.OneSignal.initialized) OneSignalWeb.logout();
        }
      }
    });

    return () => unsubscribe();
  }, [isNative]);

  // ✅ 2. SINCRONIZACIÓN MAESTRA (FIREBASE + ONESIGNAL)
  const syncMaster = async (currentUser) => {
    try {
      // PARTE A: FIRESTORE
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

      // PARTE B: VINCULACIÓN DE IDENTIDAD (External ID)
      // Esperamos un momento para que el plugin nativo cargue bien
      setTimeout(async () => {
        try {
          if (isNative) {
            // Nativo (Android)
            const OneSignal = window.OneSignal || (window.plugins && window.plugins.OneSignal);
            if (OneSignal) {
              OneSignal.setExternalUserId(currentUser.uid);
              console.log(`💎 Nativo: UID ${currentUser.uid} vinculado`);
            }
          } else {
            // Web (iOS)
            await OneSignalWeb.login(currentUser.uid);
            console.log(`💎 Web: UID ${currentUser.uid} vinculado`);
          }
        } catch (idErr) { console.error("Error vinculando identidad:", idErr); }
      }, 3000);

      // PARTE C: PERMISOS (Solo para Web, Nativo lo maneja el sistema)
      if (!isNative) {
        const currentPerm = window.Notification?.permission;
        if (currentPerm !== 'granted') {
          await OneSignalWeb.Notifications.requestPermission();
        }
      }

      // PARTE D: FIREBASE CLOUD MESSAGING (Backup)
      if (window.Notification?.permission === 'granted') {
        try {
          const token = await getToken(messaging, {
            vapidKey: "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk"
          });
          if (token) await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
        } catch (fcmErr) { /* FCM Silent */ }
      }

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