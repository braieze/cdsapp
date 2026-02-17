const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Cargar la llave
const serviceAccount = require('./service-account.json');

const app = express();

// 1. CONFIGURACIÓN CORS (LA SOLUCIÓN AL BLOQUEO)
// Esto permite que Vercel, Localhost o cualquier origen se conecte.
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. INICIAR FIREBASE
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

console.log("🔥 Backend activo y con CORS habilitado!");

app.post('/send-notification', async (req, res) => {
  const { title, body, tokens } = req.body;

  if (!tokens || !tokens.length) return res.status(400).send('Faltan tokens');

  try {
    // 3. USAR LA FUNCIÓN NUEVA (Para evitar error "is not a function")
    const response = await admin.messaging().sendEachForMulticast({
      notification: { title, body },
      tokens: tokens,
    });
    
    console.log(`✅ Enviados: ${response.successCount}, ❌ Fallos: ${response.failureCount}`);
    
    if (response.failureCount > 0) {
      console.log('Detalle errores:', response.responses.filter(r => !r.success).map(r => r.error));
    }

    res.json({ success: true, detail: response });
    
  } catch (error) {
    console.error("🔥 Error grave en el servidor:", error);
    res.status(500).json({ error: error.message });
  }
});

// Arrancar en puerto 3000
app.listen(3000, () => {
  console.log("🚀 Servidor escuchando en el puerto 3000");
});