const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

// Configuración de CORS para permitir peticiones desde tu App
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- LÓGICA DE CREDENCIALES ---
let serviceAccount;
try {
  serviceAccount = require('./service-account.json');
} catch (error) {
  if (process.env.FIREBASE_CREDENTIALS) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
  }
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Ruta para mantener el servidor despierto
app.get('/ping', (req, res) => res.send('pong'));

// 🔔 RUTA DE ENVÍO DE NOTIFICACIONES
// server.js (Render)
app.post('/send-notification', async (req, res) => {
  const { title, body, tokens, url } = req.body;

  if (!tokens || !tokens.length) return res.status(400).send('Faltan tokens');

  try {
    const response = await admin.messaging().sendEachForMulticast({
      // ✅ Metemos todo en 'data' y forzamos que sean Strings
      data: { 
        title: String(title || "Nuevo Aviso"), 
        body: String(body || "Toca para ver el contenido"),
        url: String(url || '/') // Ej: "/post/123"
      },
      tokens: tokens,
    });
    
    console.log(`✅ Enviados: ${response.successCount}`);
    res.json({ success: true });
  } catch (error) {
    console.error("🔥 Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo en puerto ${PORT}`);
});