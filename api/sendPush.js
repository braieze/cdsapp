// api/sendPush.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const KEY = process.env.ONESIGNAL_REST_KEY; 
  const APP_ID = process.env.ONESIGNAL_APP_ID;

  if (!KEY || !APP_ID) return res.status(500).json({ error: 'Faltan claves.' });

  try {
    // Tomamos todo el payload que envíe tu app (Home.jsx o MyServices.jsx)
    const payload = req.body; 
    payload.app_id = APP_ID; // Le inyectamos el ID seguro aquí

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Error al comunicarse con OneSignal' });
  }
}