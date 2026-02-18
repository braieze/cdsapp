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

// 1. RECEPCIÓN EN SEGUNDO PLANO
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Mensaje recibido en segundo plano:', payload);
  
  const notificationTitle = payload.data.title || "Nuevo Aviso";
  const notificationOptions = {
    body: payload.data.body || "Toca para ver los detalles.",
    icon: '/web-app-manifest-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'cds-notif-unica',
    data: { 
        // Guardamos la ruta relativa (ej: /post/123)
        url: payload.data.url || '/' 
    }
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. LÓGICA DE CLIC DE INGENIERÍA (postMessage + focus)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetPath = event.notification.data.url || '/';
  // Construimos URL absoluta solo para el caso de abrir ventana nueva
  const fullUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 🎯 BUSCAMOS SI LA APP ESTÁ ABIERTA
      for (let client of clientList) {
        if (client.url.includes(self.location.origin)) {
          // 1. Le damos el foco (traer al frente)
          client.focus();
          // 2. 🔥 EL DESPERTADOR: Enviamos el mensaje al NavigationHandler de App.jsx
          return client.postMessage({ 
            type: 'NAVIGATE', 
            url: targetPath 
          });
        }
      }
      
      // 🎯 SI LA APP ESTABA CERRADA
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});