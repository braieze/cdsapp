// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCqz0ya0Y4DcJ10r6vdT7a1kcY09lCbWbo",
  authDomain: "conquistadores-app.firebaseapp.com",
  projectId: "conquistadores-app",
  storageBucket: "conquistadores-app.firebasestorage.app",
  messagingSenderId: "113502014192",
  appId: "1:113502014192:web:4d2d86c1f044153172d035",
  measurementId: "G-PVBC4848BN"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 1. MANEJADOR EN SEGUNDO PLANO (Evita duplicados)
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Mensaje recibido:', payload);
  
  const notificationTitle = payload.data.title || "Nuevo Aviso";
  const notificationOptions = {
    body: payload.data.body || "Tienes contenido nuevo en la app.",
    icon: '/web-app-manifest-192x192.png', 
    badge: '/badge-72x72.png', 
    vibrate: [200, 100, 200],
    tag: 'cds-notif-unica', 
    renotify: true,
    data: {
      url: payload.data.url || '/' 
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. LÓGICA DE CLIC (Deep Linking con URL Absoluta para iPhone)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // ✅ SOLUCIÓN AL BLANCO: Convertimos ruta relativa a URL Absoluta
  // Esto asegura que iPhone y Android siempre encuentren la ruta correcta
  const relativeUrl = event.notification.data.url || '/';
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Intentamos encontrar la pestaña de la app y navegar
      for (const client of clientList) {
        if ('navigate' in client) {
          return client.navigate(targetUrl).then(c => c.focus());
        }
      }
      
      // Si la app está cerrada, abrimos la URL absoluta
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});