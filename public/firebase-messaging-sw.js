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
  const notificationTitle = payload.data.title || "Nuevo Aviso";
  const notificationOptions = {
    body: payload.data.body || "Toca para ver los detalles.",
    icon: '/web-app-manifest-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'cds-notif-unica',
    data: { url: payload.data.url || '/' }
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // 1. Construimos la URL absoluta (Crucial para que iPhone sepa a dónde ir)
  const targetPath = event.notification.data.url || '/';
  const fullUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 2. Buscamos si la app ya está abierta (primer o segundo plano)
      for (let client of clientList) {
        if (client.url.includes(self.location.origin)) {
          // 🔥 ESTRATEGIA DE INGENIERÍA:
          // Primero damos foco para despertar la app, luego navegamos.
          return client.focus().then((focusedClient) => {
            return focusedClient.navigate(fullUrl);
          });
        }
      }
      
      // 3. Si la app estaba cerrada (Cold Start)
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});