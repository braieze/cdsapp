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
    // ⚠️ CAMBIO IMPORTANTE: Usamos 'sendEachForMulticast' en lugar de 'sendMulticast'
    // Esto es compatible con la versión más nueva de Firebase instalada
    const response = await admin.messaging().sendEachForMulticast({
      notification: { title, body },
      tokens: tokens, // La lista de tokens
    });
    
    console.log(`Enviados: ${response.successCount}, Fallos: ${response.failureCount}`);
    
    // Si hubo fallos, mostramos por qué (ayuda a depurar)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(resp.error);
        }
      });
      console.log('Errores:', failedTokens);
    }

    res.json({ success: true, detail: response });
    
  } catch (error) {
    console.error("❌ Error grave en el servidor:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. PUERTO 3000
app.listen(3000, () => {
  console.log("🚀 Servidor escuchando en el puerto 3000");
});