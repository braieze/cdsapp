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

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.data.title || "Nuevo Aviso";
  const notificationOptions = {
    body: payload.data.body || "Toca para ver más.",
    icon: '/web-app-manifest-192x192.png', 
    badge: '/badge-72x72.png', 
    vibrate: [200, 100, 200],
    tag: 'cds-notif',
    data: {
      // Guardamos la URL que viene del servidor
      url: payload.data.url 
    }
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // 1. Construimos la URL completa para que iPhone no se quede en blanco
  const baseUrl = self.location.origin;
  const path = event.notification.data.url || '/';
  const fullTargetUrl = new URL(path, baseUrl).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 2. Si la app ya está abierta, navegamos en esa misma pestaña
      for (let client of clientList) {
        if ('navigate' in client) {
          client.focus();
          return client.navigate(fullTargetUrl);
        }
      }
      // 3. Si está cerrada, abrimos una nueva con la URL completa
      if (clients.openWindow) {
        return clients.openWindow(fullTargetUrl);
      }
    })
  );
});