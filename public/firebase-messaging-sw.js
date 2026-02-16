// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// ⚠️ PEGA AQUÍ TUS CREDENCIALES (Las mismas de src/firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyCqz0ya0Y4DcJ10r6vdT7a1kcY09lCbWbo",
  authDomain: "conquistadores-app.firebaseapp.com",
  projectId: "conquistadores-app",
  storageBucket: "conquistadores-app.appspot.com",
  messagingSenderId: "113502014192", // Este lo saqué de tu captura anterior
  appId: "1:113502014192:web:4d2d86c1f044153172d035"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Esto maneja las notificaciones cuando la app está CERRADA o en 2do PLANO
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notificación en 2do plano:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png', // Asegúrate de que este ícono exista en public
    badge: '/logo192.png', // Ícono pequeño para la barra de estado (Android)
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Al hacer clic en la notificación
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    // Redirigir a la URL del evento si existe, si no al home
    const urlToOpen = event.notification.data?.link || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});