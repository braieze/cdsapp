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

function NavigationHandler() {
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();

 useEffect(() => {
    const initNotifications = async () => {
      try {
        if (isNative) {
          // ✅ INICIALIZACIÓN NATIVA (Android/iOS)
          OneSignal.initialize("742a62cd-6d15-427f-8bab-5b8759fabd0a");
          OneSignal.Notifications.requestPermission(true);
        } else {
          // ✅ INICIALIZACIÓN WEB (PWA)
          await OneSignalWeb.init({
            appId: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerPath: "OneSignalSDKWorker.js",
          });

          // 🔍 SISTEMA DE DEBUG PARA V16 (Sustituye al viejo getUserId)
          setTimeout(() => {
            const subscriptionId = OneSignalWeb.User.PushSubscription.id;
            const isOptedIn = OneSignalWeb.User.PushSubscription.optedIn;
            const token = OneSignalWeb.User.PushSubscription.token;

            console.log("-----------------------------------------");
            console.log("🆔 MI ID DE ONESIGNAL:", subscriptionId || "AÚN NO GENERADO");
            console.log("🔔 ¿Suscripción activa?:", isOptedIn);
            console.log("🎫 Push Token:", token ? "GENERADO ✅" : "NO HAY TOKEN ❌");
            console.log("-----------------------------------------");

            if (!subscriptionId) {
              console.error("⚠️ EL NAVEGADOR NO GENERÓ ID: Revisa si el archivo OneSignalSDKWorker.js está en la carpeta /public");
            }
          }, 8000); // Esperamos 8 segundos para dar tiempo al registro
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
        setTimeout(() => syncMaster(currentUser), 2000);
      }
    });

    return () => unsubscribe();
  }, [isNative]);

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

          // 🔍 ESTO ES PARA EL DEBUG:
          setTimeout(async () => {
            const id = await OneSignalWeb.getUserId();
            console.log("🆔 MI ID DE ONESIGNAL ES:", id);
            if (!id) console.error("❌ NO ESTOY SUSCRITO REALMENTE");
          }, 5000);
        }
      } catch (e) { console.error("Error init:", e); }
    };

    initNotifications();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
      if (currentUser) {
        // Un pequeño delay para asegurar que OneSignal esté listo antes del login
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

      // Vinculación de External ID
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