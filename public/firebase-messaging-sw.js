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

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: '/web-app-manifest-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'cds-notif',
    data: {
      url: payload.data.url // Guardamos la ruta: /post/ID
    }
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Convertimos a URL absoluta para que iPhone no se pierda (VITAL)
  const targetPath = event.notification.data.url || '/';
  const fullUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 1. Buscamos si la app ya está abierta
      for (let client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // ✅ PRIMERO DAMOS FOCO, LUEGO NAVEGAMOS
          // Esto soluciona el problema del segundo plano en Android e iPhone
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(fullUrl);
            }
          });
        }
      }
      
      // 2. Si no hay ventana abierta (App cerrada), abrimos una nueva
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});