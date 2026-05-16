// src/oneSignalConfig.js

export const ONESIGNAL_CONFIG = {
  APP_ID: "742a62cd-6d15-427f-8bab-5b8759fabd0a",
  
  // ⚡️ SOLUCIÓN HÍBRIDA: 
  // 1. En la Web (Vercel) va a leer la variable oculta del servidor que configuraste.
  // 2. En el APK (Android) donde no hay variables de entorno, usará la clave fija como respaldo.
  REST_API_KEY: import.meta.env.VITE_ONESIGNAL_REST_API_KEY || "os_v2_app_oqvgftlncvbh7c5llodvt6v5bixa53v53ixuievr6pxfi3w52mr3rpiy46apyrrxqlm3yrzt6m7bmraxbspgb2u3d4qlrcckuvzgd7q"
};