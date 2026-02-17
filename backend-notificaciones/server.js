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

// --- LÓGICA DE CREDENCIALES ---
let serviceAccount;
try {
  serviceAccount = require('./service-account.json');
  console.log("✅ Usando archivo service-account.json local");
} catch (error) {
  if (process.env.FIREBASE_CREDENTIALS) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    console.log("✅ Usando credenciales de Variable de Entorno (Render)");
  } else {
    console.error("❌ FATAL: No se encontraron credenciales.");
  }
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// 🚀 NUEVO: Ruta de "Despertador" para evitar carga lenta
app.get('/ping', (req, res) => {
  res.send('pong');
});

// 🔔 RUTA MODIFICADA: "SÓLO DATOS" PARA EVITAR DUPLICADOS
app.post('/send-notification', async (req, res) => {
  const { title, body, tokens, url } = req.body;

  try {
    const response = await admin.messaging().sendEachForMulticast({
      // ✅ Enviamos como 'data' para que el SW tenga el control
      data: { 
        title: title || "Nuevo Aviso", 
        body: body || "Toca para ver el contenido",
        url: url || '/' 
      },
      tokens: tokens,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo en puerto ${PORT}`);
});