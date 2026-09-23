import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { Toaster } from 'sonner';

import { Capacitor } from '@capacitor/core'; 
import { App as CapApp } from '@capacitor/app'; 
import { CapacitorUpdater } from '@capgo/capacitor-updater'; 

import OneSignalWeb from 'react-onesignal'; 
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
import Alabanza from './pages/Alabanza'; 

import StudyHub from './pages/StudyHub';
import CreateStudy from './pages/CreateStudy'; 
import StudyDetail from './pages/StudyDetail';
import CreateLesson from './pages/CreateLesson';
import LessonView from './pages/LessonView';
import PresentationPanel from './pages/PresentationPanel'; 

// --- 🧭 MANEJADOR DE NAVEGACIÓN PRO ---
function NavigationHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative && Capacitor.getPlatform() === 'android') {
      const style = document.createElement('style');
      style.innerHTML = `img { display: block; max-width: 100%; content-visibility: auto; }`;
      document.head.appendChild(style);
    }

    if (isNative) {
      const handleNotificationClick = (event) => {
        const data = event.notification.additionalData;
        if (data?.url) { window.open(data.url, '_blank'); return; }
        const route = data?.route;
        if (route) {
          const finalRoute = route.startsWith('/') ? route : `/${route}`;
          setTimeout(() => navigate(finalRoute), 400);
        }
      };

      OneSignal.Notifications.addEventListener("click", handleNotificationClick);
      const backListener = CapApp.addListener('backButton', () => {
        if (location.pathname === '/') CapApp.exitApp();
        else navigate(-1);
      });

      return () => {
        OneSignal.Notifications.removeEventListener("click", handleNotificationClick);
        backListener.remove();
      };
    } else {
      const handleWebClick = (event) => {
        const data = event.notification.data;
        if (data?.url) { window.open(data.url, '_blank'); return; }
        const route = data?.route;
        if (route) {
          const finalRoute = route.startsWith('/') ? route : `/${route}`;
          setTimeout(() => navigate(finalRoute), 400);
        }
      };
      OneSignalWeb.Notifications.addEventListener("click", handleWebClick);
      return () => OneSignalWeb.Notifications.removeEventListener("click", handleWebClick);
    }
  }, [navigate, location.pathname, isNative]);

  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  
  // Dividimos la carga en dos estados para lograr la transición perfecta
  const [authLoading, setAuthLoading] = useState(true);
  const [splashMinTime, setSplashMinTime] = useState(true);
  
  const isNative = Capacitor.isNativePlatform();

  // Forzamos que la pantalla de carga dure al menos 2 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashMinTime(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isNative) {
      CapacitorUpdater.notifyAppReady().catch(err => console.error("Error OTA:", err));
    }
  }, [isNative]);

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
      } catch (e) { console.error("Error init notif:", e); }
    };
    initNotifications();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false); // Firebase ya respondió
      if (currentUser) syncMaster(currentUser);
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

      if (isNative) OneSignal.login(currentUser.uid);
      else await OneSignalWeb.login(currentUser.uid);
    } catch (error) { console.error("Error en syncMaster:", error); }
  };

  // 🚀 PANTALLA DE CARGA NATIVA PREMIUM
  // Solo se oculta cuando Firebase termina Y pasaron al menos los 2 segundos
  if (authLoading || splashMinTime) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8F9FE] font-sans transition-opacity duration-500">
        <div className="relative flex flex-col items-center animate-fade-in-up">
          
          {/* Contenedor del Logo con estilo icono de iOS */}
          <div className="w-28 h-28 mb-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-50 flex items-center justify-center overflow-hidden relative">
            <img 
              src="/logo.png" 
              alt="SocialYo Logo" 
              className="w-full h-full object-cover scale-110" 
              onError={(e) => { e.target.style.display = 'none'; }} 
            />
            {/* Brillo superpuesto para efecto premium */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/30 to-transparent"></div>
          </div>
          
          <h1 className="text-[28px] font-black text-slate-900 tracking-tighter">SocialYo.</h1>
          
          {/* Animación de carga moderna tipo 'Typing' */}
          <div className="mt-8 flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>

        {/* Branding inferior */}
        <div className="absolute bottom-10 flex flex-col items-center animate-fade-in">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Powered by</span>
          <span className="text-sm font-bold text-slate-900">CDS App</span>
        </div>
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
        <Route path="/demo-control" element={<PresentationPanel />} />

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
          <Route path="alabanza" element={<Alabanza />} /> 
          <Route path="estudio" element={<StudyHub />} />
          <Route path="estudio/crear" element={<CreateStudy />} /> 
          <Route path="estudio/crear/:id" element={<CreateStudy />} /> 
          <Route path="estudio/:id" element={<StudyDetail />} />
          <Route path="estudio/:id/nueva-clase" element={<CreateLesson />} />
          <Route path="estudio/:id/editar-clase/:lessonId" element={<CreateLesson />} />
          <Route path="estudio/clase/:lessonId" element={<LessonView />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}