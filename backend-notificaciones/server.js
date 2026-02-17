const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- LÓGICA INTELIGENTE DE CREDENCIALES ---
let serviceAccount;

try {
  // 1. Intenta leer el archivo (Para cuando estás en Codespaces)
  serviceAccount = require('./service-account.json');
  console.log("✅ Usando archivo service-account.json local");
} catch (error) {
  // 2. Si falla, intenta leer la variable de entorno (Para Render)
  if (process.env.FIREBASE_CREDENTIALS) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    console.log("✅ Usando credenciales de Variable de Entorno (Render)");
  } else {
    console.error("❌ FATAL: No se encontraron credenciales (ni archivo ni variable).");
  }
}
// -------------------------------------------

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// RUTA ACTUALIZADA PARA DEEP LINKING
app.post('/send-notification', async (req, res) => {
  // Recibimos la 'url' enviada desde el modal de React
  const { title, body, tokens, url } = req.body;

  if (!tokens || !tokens.length) return res.status(400).send('Faltan tokens');

  try {
    // Usamos sendEachForMulticast para compatibilidad con Firebase v12+
    const response = await admin.messaging().sendEachForMulticast({
      // El objeto 'notification' hace que el sistema operativo muestre el globo automáticamente
      notification: { 
        title: title || "Nuevo Aviso", 
        body: body || "Toca para ver el contenido" 
      },
      // El objeto 'data' lleva la URL que el Service Worker usará para abrir la app
      data: { 
        url: url || '/' 
      },
      tokens: tokens,
    });
    
    // Log para monitorear si llegan duplicados (Debería decir Enviados: 1)
    console.log(`✅ Enviados: ${response.successCount}, Fallos: ${response.failureCount}`);
    
    res.json({ success: true, detail: response });
  } catch (error) {
    console.error("🔥 Error en el servidor de notificaciones:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo en puerto ${PORT}`);
});