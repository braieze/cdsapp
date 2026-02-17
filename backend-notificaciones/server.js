// backend-notificaciones/server.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// 1. CARGAMOS LA LLAVE MAESTRA
// (Asegúrate de subir el archivo .json a esta carpeta)
const serviceAccount = require('./service-account.json');

const app = express();
app.use(cors()); // Importante para que React pueda entrar
app.use(express.json());

// 2. CONECTAR CON FIREBASE
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log("🔥 Backend activo en Codespaces!");

app.post('/send-notification', async (req, res) => {
  const { title, body, tokens } = req.body;

  if (!tokens || !tokens.length) return res.status(400).send('Faltan tokens');

  try {
    const response = await admin.messaging().sendMulticast({
      notification: { title, body },
      tokens: tokens,
    });
    console.log(`Enviados: ${response.successCount}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. PUERTO 3000
app.listen(3000, () => {
  console.log("🚀 Servidor escuchando en el puerto 3000");
});