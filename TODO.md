# 📋 Backlog de Desarrollo: CDS App / SocialYo

## 🐛 Bugs Reportados (Prioridad Alta)
<!-- Usa "- [ ]" para tareas pendientes y "- [x]" para tareas terminadas -->
- [ ] Arreglar desbordamiento de texto en pantallas pequeñas dentro de `PostDetail.jsx`.
- [ ] El boton de publicar en crear contenido tapa a algunas funciones dentro del modal `CreatePostModal`.
- [ ] Resolver lo de las historias, para que van aservir? Devocionales? Tutoriales?
- [ ] Resolver el deplink en las notificaciones creadas en avispush. 
- [ ] En Series hay que resolver las analiticas, las pruebas que no a todos les de 10 si no que sea algo logico. Ademas el seguimiento a cada alumno que sea correcto, con las clases iniciadas y con las notas

## ✨ Frontend y Componentes UI (React)
- [ ] Refactorizar componente de Compartir: Crear utilidad global `share.js` usando la Web Share API.
- [ ] Splash Screen: Revisar temporizador en `App.jsx` para asegurar 2 segundos de carga.
- [ ] Mejorar el aviso push, tanto su diseño como las plantillas que se crean.
- [ ] Quiero que al planificar un evento, se pueda crear desde ese lugar que haya un notn que diga crear y que cada uno elija que va a haber en ese evento, por ejemplo: Van a ver colaboradores? Agregar area. Van a habe predicador?. Cual es el nombre del evento. Etc. Cosas asi, pero que sea como el armador de plantilla. Por ejemplo el otro dia hubo taller de sanidad interior y no se pudo cargar en la app. Para el taller necesitamos grupos de whatsap, necesitamos coordinar talleristas, a quien se le encarga y demas, cosas a traer, muchisisma logistica y si eso no esta prearmado con codigo no se puede generar.
- [ ] Armar el segmento de seguimiento o visita y asignar un colaborador a cada miembro de la iglesia, que el area de visita sea mucho mas agil con esto, que se ponga el segiumiento se haga reportes, que se haga quien esta cargo de la persona y quien esta a cargo del colaborador y asi.
- [ ] Mejorar lo del zoom del celular 

## 🗄️ Backend y Base de Datos (Firebase)
- [ ] Firestore: Agregar campo `iglesiaId` a las colecciones de usuarios para preparar arquitectura Multi-Tenant.
- [ ] Cloud Functions: Mover la lógica de las notificaciones de OneSignal al servidor por seguridad.
- [ ] ... (Anota tus ideas de base de datos aquí)

## 📝 Notas Técnicas y Fragmentos de Código
> Aquí puedes pegar ideas de código, variables, o librerías de npm que quieras que instalemos en el futuro.