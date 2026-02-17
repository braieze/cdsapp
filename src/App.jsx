import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db, messaging } from './firebase'; // ✅ Importamos messaging
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'; // ✅ Importamos updateDoc y arrayUnion
import { getToken } from 'firebase/messaging'; // ✅ Importamos getToken
import { Toaster } from 'sonner';

// Importación del detalle de evento y POST (Agregada para corregir el error)
import EventDetails from './pages/EventDetails';
import PostDetail from './pages/PostDetail'; // 👈 ESTA ERA LA LÍNEA QUE FALTABA

// Layouts y Páginas
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import MyServices from './pages/MyServices';
import HistoryPage from './pages/History';
import AppsHub from './pages/AppsHub';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Directory from './pages/Directory';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // 1. Referencia al usuario en la BD
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        // 2. Si no existe, lo creamos (Rol por defecto: miembro)
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
          console.log("Usuario creado en el Directorio automáticamente.");
        }

        // 3. 🔥 LÓGICA DE NOTIFICACIONES PUSH 🔥
        try {
          // Pedimos permiso al navegador
          const permission = await Notification.requestPermission();
          
          if (permission === 'granted') {
            // Generamos el Token único del dispositivo
            const token = await getToken(messaging, {
              vapidKey: "BGMeg-zLHj3i9JZ09bYjrsV5P0eVEll09oaXMgHgs6ImBloOLHRFKKjELGxHrAEfd96ZnmlBf7XyoLKXiyIA3Wk"
            });

            if (token) {
              console.log("Token FCM generado:", token);
              
              // Guardamos el token en Firestore sin borrar los anteriores (arrayUnion)
              await updateDoc(userRef, {
                fcmTokens: arrayUnion(token)
              });
            }
          }
        } catch (error) {
          console.log("No se pudo configurar las notificaciones Push:", error);
        }
      }
      
      // 4. Guardamos usuario y terminamos carga
      setUser(currentUser);
      setLoading(false);
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
      <Toaster richColors position="top-center" />
      <Routes>
        {/* Si no hay usuario, solo puede ver el Login */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

        {/* Rutas protegidas */}
        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Home />} />
          
          {/* ✅ Ruta para el detalle de las publicaciones */}
          <Route path="/post/:postId" element={<PostDetail />} />
          
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/calendario/:id" element={<EventDetails />} />
          
          <Route path="/servicios" element={<MyServices />} />
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