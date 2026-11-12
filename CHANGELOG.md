# Changelog — ContentSync

Todos los cambios relevantes de este proyecto se documentan en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y [Semantic Versioning (SemVer)](https://semver.org/lang/es/).

## [Sin publicar]

### Added
- **Actualización en tiempo real:** los cambios de otros usuarios aparecen sin refrescar la página (Server-Sent Events).
- **Cambiar contraseña en Ajustes.** Quien entró solo con una red social puede crear una.
- **App en React Native (`front/`):** la app para teléfonos, escrita en TypeScript (TSX) con Expo, reemplaza al WebView en Kotlin.

### Changed
- **En formato vertical:** las pantallas no muestran su descripción y los bloques de un mismo día se deslizan de costado.
- **Ideas:** el botón "Nuevo color" ahora dice "Crear sección".
- **Los avisos de actividad quedan solo en la sección Avisos.**
- **Mensajes de éxito y de error:** aparecen en un pop up en el medio de la pantalla, por encima de cualquier ventana. Los de éxito se cierran a los 3,5 segundos y los de error a los 7; también se cierran al tocarlos.
- **Botones con íconos:** cerrar, cancelar, editar, eliminar, fijar, ver, comentar, aceptar, rechazar y reenviar muestran un ícono relleno en vez de texto, en un botón con contorno claro para que se distinga del fondo oscuro.
- **Menos texto:** botones, títulos y etiquetas más cortos ("+ Semana", "+ Bloque", "Guardar", "Invitar"...). Las explicaciones quedan ocultas detrás de un botón ⓘ "Ver detalle".
- **Backend en TSX:** los archivos del backend pasan de `.ts` a `.tsx`, con el mismo contenido.

### Removed
- **Duplicar semana,** en la pantalla y en la API.

### Fixed
- **Editar y aceptar propuestas de clientes:** si algo fallaba, el error quedaba detrás del pop up y parecía que no se guardaba. Ahora el error se ve, y los enlaces escritos sin `https://` se completan solos.
- **Pop ups en la app Android:** quedaban con menos de 1 cm de alto. Ahora ocupan casi toda la pantalla en el teléfono.

## [2.0.0] - 2026-11-06

ContentSync pasa a ser un espacio de trabajo entre agencias y clientes: comunicación, revisiones y cronogramas. Ya no publica en redes.

### Added
- **Tipo de contenido por bloque:** reel, carrusel, historia, publicación, video u otro, con contenido y texto de la publicación.
- **Varias fotos y videos por bloque,** cada uno con su descripción y en el orden elegido, para que el cliente los vea desde la plataforma.
- **Confirmación del cronograma:** el cliente confirma la semana y queda registrado quién y cuándo. Si después cambia algo, vuelve a revisión.
- **Estado de producción por bloque:** pendiente, grabado, editado o subido.
- **Colores propios en Ideas:** cada agencia elige un color y le pone nombre.
- **Comentarios con aviso a la otra parte,** y botón **Ver** en los avisos para ir directo al bloque.

### Changed
- **Mensaje de la web y la app:** el producto se presenta como comunicación entre agencias y clientes.
- **Revisión:** ahora se hace por bloque, no por video.
- **Archivos privados:** se ven con enlaces firmados que vencen a las 12 horas, así que el bucket puede ser privado.
- **Avisos** reemplaza a **Historial**, y se marcan como leídos al abrir la pantalla.
- **Semanas de lunes a domingo.**
- **Acceso en dos pestañas:** Iniciar sesión y Crear cuenta. Google, Facebook y GitHub entran sin pedir datos antes, y una cuenta nueva los completa una sola vez en un pop up obligatorio. La agencia se puede renombrar en Ajustes.
- **Reenviar a revisión:** la agencia devuelve al cliente un bloque con cambios pedidos, sin tener que editarlo.
- **Propuestas de ideas:** el cliente le propone ideas a su agencia, y la agencia las acepta, las edita y acepta, o las rechaza desde Ideas.
- **Duplicar semana:** ahora se elige qué semana copiar.
- **Etiquetas en los bloques:** el bloque muestra los colores con nombre creados en Ideas, y cada etiqueta usa un color distinto.
- **Crear sección desde la idea:** se elige nombre y color sin salir del formulario.
- **Revisión:** aprobar o rechazar después de pedir cambios muestra un aviso antes de confirmar, y los pop ups ya no se mueven cuando crece el contenido.
- **Modo claro:** paleta nueva con más color y mejor contraste.
- **Clientes:** la lista muestra los activos, y los que faltan confirmar van en un panel lateral.
- **Android:** el selector admite fotos y videos, y varios a la vez.

### Fixed
- Reenviar la invitación dejaba inservibles los correos anteriores. Ahora se conserva el enlace mientras siga vigente.
- Las ventanas volvían arriba al cambiar algo adentro, como quitar un archivo de un bloque.

### Removed
- **Mi marca** en el menú del cliente.
- **Zona horaria** en Ajustes.
- Conexión con YouTube, Instagram y TikTok, publicación automática, programador, reintentos y límites por red.
- Pantalla **Subir video**, hashtags y destinos por red.
- Registro de semanas duplicadas y textos de ejemplo en los campos.
- Cifrado de tokens de redes y la variable `OAUTH_ENCRYPTION_KEY`.

## [1.1.0] - 2026-11-04

Detalle completo en [docs/auditoria.md](docs/auditoria.md).

### Changed
- **Base de datos:** historial de migraciones, Docker y documentación migrados de PostgreSQL a MySQL. `deploy.js` adopta bases existentes.
- **Configuración:** variables de entorno validadas al arrancar y nuevos Ajustes editables en MySQL, sin reiniciar el servidor.
- **Sesiones:** access token de 15 minutos con renovación automática en la SPA.
- **Límites por defecto:** Reels 90 s, TikTok 600 s, Shorts 60 s, según la especificación (editables en Ajustes).
- **Visado:** solo el cliente aprueba, y por defecto nada se publica sin su aprobación (desactivable en Ajustes).
- **Alta de clientes:** la agencia ya no define la contraseña; el cliente la crea con un código por correo.

- **Sesión:** refresh token en cookie `httpOnly`; access token solo en memoria.
- **Publicación inmediata:** en segundo plano, con resultado en la interfaz y botón Reintentar.
- **Duración:** el servidor la lee del archivo de video.
- **Eliminar cuenta:** agencias y clientes pueden eliminar su propia cuenta desde Ajustes. Se borran sus datos personales, sus redes conectadas y sus videos. Al eliminar una agencia se eliminan también sus clientes. El administrador no puede eliminar la suya.
- **Videos en S3:** la web guarda los archivos en el bucket configurado, en la carpeta del cliente. Sin S3 usa el disco del servidor.
- **Android:** solo WebView, autorización de redes en el navegador del sistema, APK Release de 1 MB y clave de firma nueva.

### Fixed
- Las invitaciones "Sí, soy yo" no salían en Render: el relay respondía "Acceso denegado", no se probaba n8n y SMTP está bloqueado. Ahora salen primero por n8n, y la web avisa si el correo no se pudo enviar.
- Saltos del flujo "Sí, soy yo", falsificación del `state` OAuth, fuerza bruta de códigos OTP, toma de cuentas por vinculación social y reintentos entre agencias.
- Publicación: tokens renovados con valores inventados, TikTok marcado como publicado antes de confirmarse, permisos insuficientes de Instagram, doble publicación y hora programada dependiente de la zona del servidor.

### Removed
- Redis y BullMQ, que estaban instalados pero sin uso, y la columna `bull_job_id`. Pantallas Compose sin uso de Android. Keystore de firma y datos de usuarios del repositorio.

## [1.0.0] - 2026-10-22

### Added
- **Fase 1 (Base & Base de Datos 3FN):**
  - Estructura monorepo (`backend/`, `android/`, `docs/`), `docker-compose.yml` (PostgreSQL 16, Redis 7, MinIO S3, Backend) y `.env.example`.
  - Esquema relacional PostgreSQL normalizado en 3FN (`schema.prisma`) y migración SQL versionada con restricciones `CHECK`, `UNIQUE`, claves foráneas, borrado lógico (`deleted_at`) e índices de consulta frecuente.
  - Script `prisma/seed.ts` con 1 Administrador General, 2 Agencias, 4 Clientes, conexiones OAuth cifradas, cronograma semanal y videos de ejemplo.
- **Fase 2 (Autenticación, Seguridad y RBAC):**
  - Autenticación propia con OAuth 2.0 + JWT (`accessToken` de 15m + `refreshToken` rotativo de 7d con detección de reuso por familia de tokens y hash Argon2id).
  - Inicio de sesión social con 3 proveedores (Google, Facebook y GitHub) con vinculación automática por email en `social_auth_accounts`.
  - Guards de NestJS por rol (`ADMIN_GENERAL`, `AGENCIA`, `CLIENTE`), aislamiento multi-tenant por propiedad del recurso, Rate Limiting (`ThrottlerGuard`), cabeceras `helmet` y registro en `audit_logs`.
- **Fase 3 (Gestión de Agencias y Clientes):**
  - ABM completo de Agencias exclusivo para `ADMIN_GENERAL` (creación transaccional, suspensión y borrado lógico).
  - ABM de Clientes para `ADMIN_GENERAL` y `AGENCIA` restringido estrictamente a los clientes creados por cada agencia.
- **Fase 4 (Videos y Almacenamiento S3):**
  - Generación de URLs prefirmadas de subida y lectura en S3/MinIO (`StorageService`).
  - Validación técnica de formato, duración y peso por plataforma destino (Instagram Reels máx 15m/1GB, TikTok máx 10m/500MB, YouTube Shorts máx 3m/2GB).
- **Fase 5 (Cronogramas Semanales y Flujo de Aprobación):**
  - Gestión de cronogramas semanales por cliente con ítems por día y hora.
  - Máquina de estados de revisión del cliente (`DRAFT` → `IN_REVIEW` → `APPROVED` / `CHANGES_REQUESTED` / `REJECTED` → `SCHEDULED` → `PUBLISHED`) con notas y comentarios.
- **Fase 6 (Integración con Plataformas y Programación):**
  - Cifrado simétrico autenticado **AES-256-GCM** para tokens OAuth de plataformas en `platform_connections` con renovación automática.
  - Patrón Strategy (`PlatformPublisher`) con adaptadores para Instagram Graph API, TikTok Content Posting API y YouTube Data API v3 (modo real + modo mock configurable).
  - Programación y publicación multiplataforma con reintentos automáticos y registro en `publications` y `publication_attempts`.
- **Fase 7 (Historial y Notificaciones Push FCM):**
  - Buscador e historial con filtros combinados por semana, cliente, plataforma y estado.
  - Notificaciones push FCM e in-app para cada transición del flujo.
- **Fase 8 (Aplicación Android Nativa, APK, Tests y CI/CD):**
  - Aplicación Android en Kotlin + Jetpack Compose + Material 3 con Clean Architecture + MVVM, Hilt, Room, DataStore, EncryptedSharedPreferences, Retrofit, WorkManager y `WindowSizeClass`.
  - Pipeline de integración continua en GitHub Actions (`.github/workflows/ci.yml`).
