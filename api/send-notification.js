// api/send-notification.js
// Este código corre en los servidores de Vercel, no en el navegador.

export default async function handler(request, response) {
  // Solo aceptamos peticiones POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, body, tokens } = request.body;

  // ⚠️ PEGA AQUÍ TU CLAVE LARGA (LA QUE EMPIEZA CON AIzaSy...)
  const SERVER_KEY = "AIzaSyDNyI4McGh4LZmpIFNElIG2999qkjyhbQk"; 

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return response.status(400).json({ error: 'Faltan los tokens' });
  }

  try {
    const googleResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Authorization": `key=${SERVER_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: {
          title: title,
          body: body,
          icon: "/logo192.png",
          click_action: "/"
        }
      })
    });

    const data = await googleResponse.json();
    return response.status(200).json(data);

  } catch (error) {
    console.error("Error enviando:", error);
    return response.status(500).json({ error: error.message });
  }
}