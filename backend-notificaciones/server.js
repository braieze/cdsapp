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

// --- LÓGICA DE FIREBASE (Mantenida) ---
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

app.get('/ping', (req, res) => res.send('pong'));

// ✅ RUTA ONESIGNAL: CORREGIDA PARA CUMPLIR CON EL IDIOMA "EN" REQUERIDO
app.post('/send-onesignal', async (req, res) => {
  const { userIds, title, message, url } = req.body;

  console.log("📡 Solicitud OneSignal recibida para IDs:", userIds);

  if (!userIds || !userIds.length) {
    console.error("❌ Error: Faltan userIds");
    return res.status(400).send('Faltan IDs de usuario');
  }

  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!restApiKey) {
    console.error("❌ Error Crítico: No se encontró ONESIGNAL_REST_API_KEY en Render");
    return res.status(500).send('Error de configuración del servidor');
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${restApiKey}` 
      },
      body: JSON.stringify({
        app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
        include_external_user_ids: userIds,
        // ✅ CORRECCIÓN: Se usa "en" como clave obligatoria para OneSignal
        headings: { "en": title }, 
        contents: { "en": message }, 
        url: url || "https://cdsapp.vercel.app/servicios",
        priority: 10,
        android_accent_color: "FF3B82F6"
      })
    });

    const data = await response.json();
    
    if (data.errors) {
        console.warn("⚠️ OneSignal respondió con errores:", data.errors);
    } else {
        console.log("✅ OneSignal Response (Envío Exitoso):", data);
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("🔥 Error OneSignal (Backend):", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/send-notification', async (req, res) => {
  const { title, body, tokens, url } = req.body;
  if (!tokens || !tokens.length) return res.status(400).send('Faltan tokens');
  try {
    const response = await admin.messaging().sendEachForMulticast({
      data: { title: String(title), body: String(body), url: String(url || '/') },
      tokens: tokens,
    });
    res.json({ success: true });
  } catch (error) { 
    console.error("🔥 Error Firebase Notification:", error);
    res.status(500).json({ error: error.message }); 
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo en puerto ${PORT}`);
});