# CDS App - Comunidad y Gestión de Servidores ⛪

CDS App es una plataforma móvil híbrida diseñada para digitalizar, organizar y potenciar la comunicación interna de la iglesia. Construida con una estética de red social moderna ("Mobile-First"), la aplicación permite conectar a los miembros, organizar a los equipos de servidores y distribuir contenido educativo y anuncios urgentes de manera centralizada.

## 🚀 ¿Qué problema resuelve?
* **Comunicación Desorganizada:** Sustituye los grupos de mensajería masiva por un muro social limpio donde los anuncios importantes, devocionales y pedidos de oración tienen su propio espacio.
* **Falta de Alcance:** A través de notificaciones Push segmentadas (vía OneSignal), asegura que los avisos urgentes o enlaces de transmisión (Meet/YouTube) lleguen directamente a la pantalla del usuario.
* **Gestión de Equipos:** Permite administrar los roles de los servidores (bienvenida, portería, altar, etc.), facilitando la organización de los servicios semanales.
* **Distribución de Material:** Centraliza estudios, clases y herramientas financieras (ofrendas/tesorería) en un solo entorno cerrado y seguro.

## ✨ Funcionalidades Principales

* **Muro Social Interactivo (Feed):** Publicaciones categorizadas (Todo, Devocional, Oración, Urgente) con capacidad de reacción (emojis) y comentarios.
* **Historias (Stories):** Carrusel superior para contenido efímero y devocionales destacados.
* **Sistema de Roles y Permisos:** 
  * *Pastores/Líderes:* Pueden fijar posts, archivar contenido, y lanzar notificaciones Push manualmente a toda la congregación o a áreas específicas.
  * *Miembros:* Acceso al contenido público, perfil personal y academia.
* **Notificaciones Push y Deep Linking:** Al tocar una notificación, el usuario es redirigido exactamente a la publicación o evento mencionado.
* **Academia (StudyHub):** Módulo de aprendizaje para tomar clases y estudios bíblicos directamente desde la app.
* **Actualizaciones OTA (Over-The-Air):** Integración con Capgo para enviar actualizaciones de diseño y código a los usuarios sin necesidad de descargar un nuevo APK.

## 🛠️ Stack Tecnológico

* **Frontend:** React.js, Tailwind CSS (Diseño UI/UX premium y responsivo).
* **Backend & Base de Datos:** Firebase (Auth, Firestore, Cloud Storage).
* **Contenedor Móvil:** Capacitor (iOS/Android).
* **Notificaciones:** OneSignal (Cordova Plugin & Web SDK).
* **Distribución OTA:** Capgo Updater.

