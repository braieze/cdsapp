import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { Toaster } from 'sonner';
import { Capacitor } from '@capacitor/core'; 
import { App as CapApp } from '@capacitor/app'; 
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

// ✅ ACADEMIA CDS
import StudyHub from './pages/StudyHub';
import CreateStudy from './pages/CreateStudy'; 
import StudyDetail from './pages/StudyDetail';
import CreateLesson from './pages/CreateLesson';
import LessonView from './pages/LessonView';

// --- 🧭 MANEJADOR DE NAVEGACIÓN PRO (Deep Linking Fix) ---
function NavigationHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // Estilos globales para Android
    if (isNative && Capacitor.getPlatform() === 'android') {
      const style = document.createElement('style');
      style.innerHTML = `img { display: block; max-width: 100%; content-visibility: auto; }`;
      document.head.appendChild(style);
    }

    // 📱 LÓGICA NATIVA (Android/iOS)
    if (isNative) {
      const handleNotificationClick = (event) => {
        // Obtenemos los datos sin importar si vienen anidados
        const data = event.notification.additionalData;
        console.log("DEBUG NOTIF NATIVA:", data);

        if (data?.url) {
          window.open(data.url, '_blank');
          return;
        }

        const route = data?.route;
        if (route) {
          // ✅ FIX: Aseguramos que la ruta empiece con "/"
          const finalRoute = route.startsWith('/') ? route : `/${route}`;
          
          // ✅ FIX TIMING: Delay para que el Router esté listo
          setTimeout(() => {
            console.log("Navegando a:", finalRoute);
            navigate(finalRoute);
          }, 400);
        }
      };

      OneSignal.Notifications.addEventListener("click", handleNotificationClick);

      const backListener = CapApp.addListener('backButton', () => {
        if (location.pathname === '/') {
          CapApp.exitApp();
        } else {
          navigate(-1);
        }
      });

      return () => {
        OneSignal.Notifications.removeEventListener("click", handleNotificationClick);
        backListener.remove();
      };
    } 
    // 💻 LÓGICA WEB
    else {
      const handleWebClick = (event) => {
        const data = event.notification.data;
        console.log("DEBUG NOTIF WEB:", data);

        if (data?.url) {
          window.open(data.url, '_blank');
          return;
        }

        const route = data?.route;
        if (route) {
          const finalRoute = route.startsWith('/') ? route : `/${route}`;
          setTimeout(() => {
            navigate(finalRoute);
          }, 400);
        }
      };
      OneSignalWeb.Notifications.addEventListener("click", handleWebClick);
      return () => OneSignalWeb.Notifications.removeEventListener("click", handleWebClick);
    }
  }, [navigate, location.pathname, isNative]); // Escuchamos cambios de path

  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  // 1. INICIALIZAR ONESIGNAL
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
      setLoading(false); 
      if (currentUser) {
        syncMaster(currentUser);
      }
    });

    return () => unsubscribe();
  }, [isNative]);

  // 2. SINCRONIZACIÓN DE PERFIL Y LOGIN NOTIFICACIONES
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

      // Login en OneSignal con el UID de Firebase para segmentación personalizada
      if (isNative) {
        OneSignal.login(currentUser.uid);
      } else {
        await OneSignalWeb.login(currentUser.uid);
      }

    } catch (error) { console.error("Error en syncMaster:", error); }
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
      {/* El NavigationHandler debe estar DENTRO del Router pero antes de las Routes */}
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

          {/* 🎓 ACADEMIA */}
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