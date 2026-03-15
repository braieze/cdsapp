import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, db, messaging } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging'; 
import { Toaster } from 'sonner';
import { Capacitor } from '@capacitor/core'; 
import OneSignalWeb from 'react-onesignal'; 

// ✅ IMPORTACIÓN OFICIAL DE ONESIGNAL (VERSIÓN 5)
import OneSignal from 'onesignal-cordova-plugin';

// Importaciones
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
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // 1. Init OneSignal con control de errores total
    const initNotifications = async () => {
      try {
        if (isNative) {
          // ✅ ENCENDEMOS EL MOTOR NATIVO V5
          OneSignal.initialize("742a62cd-6d15-427f-8bab-5b8759fabd0a");
        } else {
          // Encendemos el motor web
          await OneSignalWeb.init({
            appId: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
            allowLocalhostAsSecureOrigin: true,
          });
        }
      } catch (e) { console.warn("Notif delay", e); }
    };

    initNotifications();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // ✅ IMPORTANTE: Liberamos el loading ANTES de sincronizar para que la UI no se trabe
      setLoading(false); 
      
      if (currentUser) {
        // Ejecutamos syncMaster con un pequeño delay para no estorbar al renderizado inicial
        setTimeout(() => syncMaster(currentUser), 1000);
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

      // ✅ VINCULACIÓN DE USUARIO OFICIAL V5
      if (isNative) {
        OneSignal.login(currentUser.uid);
      } else {
        await OneSignalWeb.login(currentUser.uid);
      }

    } catch (error) { console.warn("Background Sync failed", error); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f0d]">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
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
        {/* Captura de rutas inexistentes para evitar pantalla blanca */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}