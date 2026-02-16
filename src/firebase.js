import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging"; 

const firebaseConfig = {
  // ... TUS CREDENCIALES (NO LAS BORRES) ...
  apiKey: "AIzaSyCqz0ya0Y4DcJ10r6vdT7a1kcY09lCbWbo",
  authDomain: "conquistadores-app.firebaseapp.com",
  projectId: "conquistadores-app",
  storageBucket: "conquistadores-app.firebasestorage.app",
  messagingSenderId: "113502014192",
  appId: "1:113502014192:web:4d2d86c1f044153172d035",
  measurementId: "G-PVBC4848BN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 🔥 CORRECCIÓN PARA VERCEL:
// Solo inicializamos messaging si estamos en el navegador (window existe)
let messaging = null;
if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.error("Error iniciando messaging:", err);
  }
}

export { auth, db, storage, messaging };