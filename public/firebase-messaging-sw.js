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

// Configuración de la apariencia nativa
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notificación recibida:', payload);
  
  const notificationTitle = payload.notification.title || "Nuevo Aviso";
  const notificationOptions = {
    body: payload.notification.body || "Tienes contenido nuevo en la app.",
    // El 'icon' es la imagen a color que sale a la derecha
    icon: '/web-app-manifest-192x192.png', 
    // El 'badge' es la silueta BLANCA que sale arriba en la barra de estado (Android)
    badge: '/badge-72x72.png', 
    vibrate: [200, 100, 200],
    tag: 'cds-notification', // Evita que se amontonen si envías varias
    renotify: true,
    data: {
      url: payload.data?.url || '/' // Puedes enviar una URL desde el backend
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Lógica para abrir la App al hacer clic en la notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Cierra el globo de la notificación

  // Abre la aplicación o enfoca la pestaña si ya está abierta
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});