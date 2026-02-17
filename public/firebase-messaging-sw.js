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

// Manejador de mensajes en segundo plano
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Mensaje recibido:', payload);
  
  // 💡 IMPORTANTE: Ahora leemos todo de 'payload.data' porque el servidor
  // ya no envía el objeto 'notification'. Esto evita la duplicidad.
  const notificationTitle = payload.data.title || "Nuevo Aviso";
  
  const notificationOptions = {
    body: payload.data.body || "Tienes contenido nuevo en la app.",
    // Imagen a color (derecha)
    icon: '/web-app-manifest-192x192.png', 
    // Silueta BLANCA (Barra de estado arriba en Android)
    badge: '/badge-72x72.png', 
    vibrate: [200, 100, 200],
    // El 'tag' es vital: si llega otra notificación con el mismo tag, 
    // reemplaza a la anterior en lugar de crear un segundo globo.
    tag: 'cds-notif-unica', 
    renotify: true,
    data: {
      // Guardamos la URL para el evento 'notificationclick'
      url: payload.data.url || '/' 
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejador del clic en la notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si la app ya está abierta, la enfocamos
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no está abierta o es una ruta distinta, la abrimos
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});