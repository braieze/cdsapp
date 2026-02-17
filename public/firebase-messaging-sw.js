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

// MANEJADOR EN SEGUNDO PLANO
messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.data.title || "Nuevo Aviso";
  const notificationOptions = {
    body: payload.data.body || "Toca para ver más.",
    icon: '/web-app-manifest-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'cds-notif',
    data: {
      // ✅ IMPORTANTE: Guardamos la URL aquí para que el clic la encuentre
      url: payload.data.url || '/' 
    }
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ✅ LÓGICA QUE SÍ FUNCIONABA (Restaurada al 100%)
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); 

  const targetUrl = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (const c of clientList) {
          if (c.visibilityState === 'visible') {
            client = c;
            break;
          }
        }
        return client.navigate(targetUrl).then(c => c.focus());
      }
      return clients.openWindow(targetUrl);
    })
  );
});