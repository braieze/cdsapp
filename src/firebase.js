import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ PEGA AQUÍ EL CÓDIGO QUE GUARDAS EN TU BLOC DE NOTAS
const firebaseConfig = {
  apiKey: "AIzaSyCqz0ya0Y4DcJ10r6vdT7a1kcY09lCbWbo",
  authDomain: "conquistadores-app.firebaseapp.com",
  projectId: "conquistadores-app",
  storageBucket: "conquistadores-app.firebasestorage.app",
  messagingSenderId: "113502014192",
  appId: "1:113502014192:web:4d2d86c1f044153172d035",
  measurementId: "G-PVBC4848BN"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Exportamos Auth y Base de datos para usarlos en toda la app
export const auth = getAuth(app);
export const db = getFirestore(app);