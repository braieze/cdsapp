// src/oneSignalConfig.js

export const ONESIGNAL_CONFIG = {
  APP_ID: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
  // ✅ Lee la variable de entorno de donde sea que se compile (Tu compu o Vercel)
  REST_API_KEY: import.meta.env.VITE_ONESIGNAL_REST_API_KEY
};