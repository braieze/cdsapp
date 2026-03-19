import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, db } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { Toaster } from 'sonner';
import { Capacitor } from '@capacitor/core'; 
import OneSignalWeb from 'react-onesignal'; 

// ✅ IMPORTACIÓN OFICIAL DE ONESIGNAL (VERSIÓN 5)
import OneSignal from 'onesignal-cordova-plugin';

// Importaciones de Páginas
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

// --- MANEJADOR DE NAVEGACIÓN (Escucha clics en notificaciones) ---
function NavigationHandler() {
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // 1. Lógica para WEB (Service Worker)
    if ('serviceWorker' in navigator) {
      const handleMessage = (event) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          navigate(event.data.url);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }

    // 2. Lógica para NATIVO (Android/APK)
    if (isNative) {
      const handleNotificationClick = (event) => {
        const route = event.notification.additionalData?.route;
        if (route) navigate(route);
      };
      OneSignal.Notifications.addEventListener("click", handleNotificationClick);
      return () => OneSignal.Notifications.removeEventListener("click", handleNotificationClick);
    }
  }, [navigate, isNative]);

  return null;
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    const initNotifications = async () => {
      try {
        if (isNative) {
          // ✅ INICIALIZACIÓN NATIVA
          OneSignal.initialize("742a62cd-6d15-427f-8bab-5b8759fabd0a");
          OneSignal.Notifications.requestPermission(true);
        } else {
          // ✅ INICIALIZACIÓN WEB (V16)
          await OneSignalWeb.init({
            appId: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerPath: "OneSignalSDKWorker.js",
          });

          // 🔍 DEBUG PARA VERSIÓN 16 (Detección de ID)
          setTimeout(() => {
            const subscriptionId = OneSignalWeb.User.PushSubscription.id;
            const isOptedIn = OneSignalWeb.User.PushSubscription.optedIn;

            console.log("-----------------------------------------");
            console.log("🆔 MI ID DE ONESIGNAL:", subscriptionId || "AÚN NO GENERADO");
            console.log("🔔 ¿SUSCRITO?:", isOptedIn ? "SÍ ✅" : "NO ❌");
            console.log("-----------------------------------------");
          }, 8000);
        }
      } catch (e) {
        console.error("Critical OneSignal Error:", e);
      }
    };

    initNotifications();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
      if (currentUser) {
        // Vinculación segura de External ID
        setTimeout(() => syncMaster(currentUser), 2000);
      }
    });

    return () => unsubscribe();
  }, [isNative]);

  const syncMaster = async (currentUser) => {
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
        });
      }

      // Login en OneSignal para que lleguen notificaciones personalizadas
      if (isNative) {
        OneSignal.login(currentUser.uid);
      } else {
        await OneSignalWeb.login(currentUser.uid);
      }

    } catch (error) { console.warn("Sync failed", error); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <HashRouter>
      <NavigationHandler /> 
      <Toaster richColors position="top-center" />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/ofrendar" element={<Ofrendar />} /> 
        
        <Route element={user ? <MainLayout /> : <Navigate to="/login" replace />}>
          <Route index element={<Home />} />
          <Route path="post/:postId" element={<PostDetail />} />
          <Route path="calendario" element={<Calendar />} />
          <Route path="calendario/:id" element={<EventDetails />} />
          <Route path="servicios" element={<MyServices />} />
          <Route path="servicios/:id" element={<ServiceDetails />} />
          <Route path="historial" element={<HistoryPage />} />
          <Route path="apps" element={<AppsHub />} />
          <Route path="perfil" element={<Profile />} /> 
          <Route path="directorio" element={<Directory />} />
          <Route path="tesoreria" element={<Tesoreria />} /> 
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}