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

// 1. MANEJADOR DE MENSAJES EN SEGUNDO PLANO
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Mensaje recibido:', payload);
  
  // Extraemos datos del objeto 'data' (enviado desde server.js)
  const notificationTitle = payload.data.title || "Nuevo Aviso";
  const notificationOptions = {
    body: payload.data.body || "Tienes contenido nuevo en la app.",
    icon: '/web-app-manifest-192x192.png', 
    badge: '/badge-72x72.png', 
    vibrate: [200, 100, 200],
    tag: 'cds-notif-unica', // Evita que se dupliquen globos
    renotify: true,
    data: {
      url: payload.data.url || '/' 
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. LÓGICA DE CLIC ACTUALIZADA (Deep Linking Forzado)
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Cierra el globo de notificación

  // Obtenemos la URL de destino guardada en la notificación
  const targetUrl = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 1. Si la app ya está abierta en alguna pestaña/ventana
      if (clientList.length > 0) {
        let client = clientList[0];
        
        // Priorizamos la ventana que el usuario esté viendo actualmente
        for (const c of clientList) {
          if (c.visibilityState === 'visible') {
            client = c;
            break;
          }
        }
        
        // 🔥 FUERZA BRUTA: Obligamos a esa ventana a navegar a la URL del evento
        return client.navigate(targetUrl).then(c => c.focus());
      }
      
      // 2. Si la app está cerrada completamente, abrimos una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});