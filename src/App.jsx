import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Layouts y Páginas
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import MyServices from './pages/MyServices';
import AppsHub from './pages/AppsHub';
import Login from './pages/Login';
import Profile from './pages/Profile'; // <--- 1. AQUÍ IMPORTAMOS LA PÁGINA
import Directory from './pages/Directory';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
      <Routes>
        {/* Si no hay usuario, solo puede ver el Login */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

        {/* Rutas protegidas: Si no hay usuario, te manda al login */}
        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Home />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/servicios" element={<MyServices />} />
          <Route path="/apps" element={<AppsHub />} />
          <Route path="/directorio" element={<Directory />} />
          
          {/* 2. AQUÍ CONECTAMOS LA PÁGINA REAL */}
          <Route path="/perfil" element={<Profile />} /> 
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;