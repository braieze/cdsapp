# 📋 Backlog de Desarrollo: CDS App / SocialYo

## 🐛 Bugs Reportados (Prioridad Alta)
<!-- Usa "- [ ]" para tareas pendientes y "- [x]" para tareas terminadas -->
- [ ] Arreglar desbordamiento de texto en pantallas pequeñas dentro de `PostDetail.jsx`.
- [ ] El botón de publicar en crear contenido tapa a algunas funciones dentro del modal `CreatePostModal`.
- [ ] Resolver lo de las historias, ¿para qué van a servir? (Definir lógica en código para Devocionales, Tutoriales, etc.).
- [ ] Resolver el deep link en las notificaciones creadas en avispush. 
- [ ] En Series: resolver analíticas (que las calificaciones no sean todas 10, implementar lógica dinámica) y el seguimiento correcto a cada alumno (clases iniciadas y notas).
- [ ] **Glitch de Confirmación:** En `MyServices.jsx` y `BottomNavigation.jsx`, el badge no desaparece al confirmar asistencia. Posible falla de sincronización del estado de React con Firebase.
- [ ] **Retraso OneSignal:** Revisar parámetros del fetch en la API para asegurar entrega inmediata de notificaciones.

## ✨ Frontend y Componentes UI (React)
- [ ] Refactorizar componente de Compartir: Crear utilidad global `share.js` usando la Web Share API (Aplicar a posts, eventos, etc.).
- [ ] Splash Screen: Revisar temporizador en `App.jsx` para asegurar 2 segundos de carga.
- [ ] Mejorar el aviso push, tanto su diseño UI como las plantillas que se crean.
- [ ] **Creador de Eventos Avanzado:** Módulo dinámico (tipo armador de plantilla) para planificar logística (ej. Taller Sanidad). Botones para agregar áreas, predicador, grupos de WhatsApp, cosas a traer, etc.
- [ ] **Módulo de Seguimiento/Visitas:** Crear UI para asignar colaboradores a miembros, generar reportes de seguimiento y jerarquías (quién está a cargo de quién).
- [ ] Mejorar lo del zoom del celular (Aplicar reglas estrictas en `index.html` y CSS).
- [ ] **Fechas en Posts:** Extraer `post.createdAt` y renderizar la fecha (ej. "Hace 2 horas" o "15/09/2026") junto al nombre del perfil en `Home.jsx`.
- [ ] **Widget "Próximo Servicio":** Crear componente tipo agenda en la parte superior del Home que muestre la fecha y área del próximo servicio del usuario.

## 🗄️ Backend y Base de Datos (Firebase)
- [ ] Firestore: Agregar campo `iglesiaId` a las colecciones de usuarios para preparar arquitectura Multi-Tenant.
- [ ] Cloud Functions: Mover la lógica de las notificaciones de OneSignal al servidor por seguridad.
- [ ] **Vista Global de Equipos:** En `ServiceDetails.jsx`, ampliar el renderizado para mostrar con quién más sirve el usuario leyendo los arrays completos (pasillo, altar, etc.).
- [ ] **Categoría Capacitación/Revista:** Crear estructura en Firestore para separar las capacitaciones y reseñas de mensajes pastorales en una vista de revista semanal.

## 📝 Notas Técnicas y Fragmentos de Código
> Aquí puedes pegar ideas de código, variables, o librerías de npm que quieras que instalemos en el futuro.


# 🗺️ Plan de Acción por Sprints

## 🏃 Sprint 1: Estabilización (Bugs y UX Crítica)
*Objetivo: Dejar la app sin errores y visualmente perfecta en lo básico.*
- [ ] 1. **Zoom y Accesibilidad:** Ajustar `index.html` (meta viewport) e `index.css` (text-size-adjust).
- [ ] 2. **Bug de Confirmación:** Revisar el `useEffect` en `BottomNavigation.jsx` y `MyServices.jsx` para asegurar que el estado escuche correctamente a Firebase.
- [ ] 3. **UI Rota:** Arreglar el desbordamiento en `PostDetail.jsx` (añadir clases `break-words` o `truncate` de Tailwind).
- [ ] 4. **Splash Screen:** Ajustar el temporizador en `App.jsx` para forzar los 2 segundos mínimos.

## 🚀 Sprint 2: Datos Dinámicos y Victorias Rápidas
*Objetivo: Darle vida al contenido existente sin tocar mucho la base de datos.*
- [ ] 1. **Fechas en Posts:** Importar `date-fns` en `Home.jsx` y mapear el campo `post.createdAt`.
- [ ] 2. **Widget "Próximo Servicio":** Crear un nuevo componente funcional que filtre la query de eventos más cercana y colocarlo arriba del feed.
- [ ] 3. **Vista Global de Equipos:** En `ServiceDetails.jsx`, mapear el array de asignaciones para mostrar todo el equipo.
- [ ] 4. **Botón Compartir:** Crear `src/utils/share.js` e importarlo en los posts y eventos.

## 🏗️ Sprint 3: Arquitectura y Lógica Compleja (Backend)
*Objetivo: Construir los nuevos módulos pesados.*
- [ ] 1. **Creador de Eventos:** Construir el formulario interactivo con estados dinámicos (`useState`) para agregar áreas, predicadores y links.
- [ ] 2. **Módulo Seguimiento:** Crear pantallas nuevas, tablas de datos y consultas (`where()`) en Firestore para enlazar colaboradores con miembros.
- [ ] 3. **Migración Multi-Tenant:** Añadir `iglesiaId` y reestructurar colecciones.