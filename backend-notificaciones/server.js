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

// ✅ NUEVA RUTA: ENVÍO MEDIANTE ONESIGNAL (Seguro y Masivo)
app.post('/send-onesignal', async (req, res) => {
  const { userIds, title, message, url } = req.body;

  if (!userIds || !userIds.length) return res.status(400).send('Faltan IDs de usuario');

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic os_v2_app_oqvgftlncvbh7c5llodvt6v5bizleim6w4cefan3kucbz63ch6kslgr5rvlaoicnpzicabq3natbwjhks37jm2vjdr4bn7i225ejyui" // ✅ Llave segura en backend
      },
      body: JSON.stringify({
        app_id: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
        include_external_user_ids: userIds, // Usamos los UIDs de Firebase
        headings: { "es": title },
        contents: { "es": message },
        url: url || "https://tu-app-mceh.web.app/servicios"
      })
    });

    const data = await response.json();
    console.log("✅ OneSignal Response:", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("🔥 Error OneSignal:", error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta original de Firebase (por si la sigues usando en otras partes)
app.post('/send-notification', async (req, res) => {
  const { title, body, tokens, url } = req.body;
  if (!tokens || !tokens.length) return res.status(400).send('Faltan tokens');
  try {
    const response = await admin.messaging().sendEachForMulticast({
      data: { title: String(title), body: String(body), url: String(url || '/') },
      tokens: tokens,
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo en puerto ${PORT}`);
});