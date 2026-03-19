import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { Toaster } from 'sonner';
import { Capacitor } from '@capacitor/core'; 
import { App as CapApp } from '@capacitor/app'; // ✅ Importar plugin de App nativa
import OneSignalWeb from 'react-onesignal'; 

// ✅ ONESIGNAL VERSIÓN 5
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

// --- MANEJADOR DE NAVEGACIÓN Y EVENTOS NATIVOS ---
function NavigationHandler() {
  const navigate = useNavigate();
  const location = useLocation(); // Para saber dónde estamos parados
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // 1. Lógica de Notificaciones (Deep Linking)
    if (isNative) {
      const handleNotificationClick = (event) => {
        const route = event.notification.additionalData?.route;
        if (route) navigate(route);
      };
      OneSignal.Notifications.addEventListener("click", handleNotificationClick);

      // 🎯 2. ARREGLO BOTÓN ATRÁS ANDROID
      const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
        // Si estamos en el Home (raíz), cerramos la app. Si no, vamos atrás.
        if (location.pathname === '/') {
          CapApp.exitApp();
        } else {
          navigate(-1);
        }
      });

      return () => {
        OneSignal.Notifications.removeEventListener("click", handleNotificationClick);
        backListener.remove(); // Limpiar el listener al desmontar
      };
    } else {
      // Lógica WEB
      const handleWebClick = (event) => {
        const route = event.notification.data?.route;
        if (route) navigate(route);
      };
      OneSignalWeb.Notifications.addEventListener("click", handleWebClick);
      return () => OneSignalWeb.Notifications.removeEventListener("click", handleWebClick);
    }
  }, [navigate, location, isNative]);

  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    const initNotifications = async () => {
      try {
        if (isNative) {
          OneSignal.initialize("742a62cd-6d15-427f-8bab-5b8759fabd0a");
          OneSignal.Notifications.requestPermission(true);
        } else {
          await OneSignalWeb.init({
            appId: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerPath: "OneSignalSDKWorker.js",
          });
        }
      } catch (e) { /* silent */ }
    };

    initNotifications();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
      if (currentUser) {
        syncMaster(currentUser);
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

      if (isNative) {
        OneSignal.login(currentUser.uid);
      } else {
        await OneSignalWeb.login(currentUser.uid);
      }

    } catch (error) { /* silent */ }
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
      <Toaster richColors position="top-center" expand={false} />
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