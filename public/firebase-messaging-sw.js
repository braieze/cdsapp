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

// 1. RECEPCIÓN: Guardamos la URL en el objeto data
messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.data.title || "Nuevo Aviso";
  const notificationOptions = {
    body: payload.data.body || "Toca para ver más.",
    icon: '/web-app-manifest-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'cds-notif',
    data: {
      url: payload.data.url || '/' 
    }
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. CLIC: Navegación forzada a URL absoluta (Solución iPhone)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Convertimos la ruta relativa (/post/123) en una URL absoluta que el celular entienda
  const targetUrl = new URL(event.notification.data.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Intentamos encontrar cualquier pestaña de nuestra app abierta
      if (clientList.length > 0) {
        let client = clientList[0];
        for (const c of clientList) {
          if (c.visibilityState === 'visible') {
            client = c;
            break;
          }
        }
        // Navegamos al destino y damos foco
        return client.navigate(targetUrl).then(c => c.focus());
      }
      
      // Si la app estaba cerrada, abrimos la URL absoluta directamente
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});