# Auditoría de ContentSync — 4 de noviembre de 2026

Alcance: backend NestJS, esquema y migraciones, SPA web, proyecto Android (`MainActivity` y configuración de compilación), Docker, Render y CI.

## Severidad crítica: corregido

| # | Fallo | Cómo se explotaba | Corrección |
| :-- | :--- | :--- | :--- |
| 1 | Se saltaba «Sí, soy yo» | `GET /clients` devolvía `confirmationToken`: la agencia lo leía y confirmaba en nombre del cliente | El token ya no sale del servidor |
| 2 | Conexiones OAuth falsificables | El `state` era JSON sin firmar con `role` y `clientId`: cualquiera podía declararse admin y conectar su cuenta a otro cliente | `state` firmado y permisos revalidados contra MySQL |
| 3 | Toma de cuentas por código OTP | `reset-password` aceptaba solo el código, sin correo: probar códigos de 6 dígitos daba acceso a cualquier cuenta con un restablecimiento pendiente | Correo obligatorio, códigos con HMAC, vencimiento e intentos limitados |
| 4 | Secretos públicos como respaldo | Sin variables, los JWT se firmaban con un texto publicado en el repositorio, y `.env.example` se cargaba como configuración | El servidor no arranca en producción con secretos ausentes o de ejemplo |
| 5 | Credenciales de firma públicas | `release-keystore.jks` y su contraseña estaban en el repositorio público | Sacados del repositorio y del código. **Ver acciones pendientes** |
| 6 | Contraseña de cliente conocida | El formulario traía `ContentSync2026!` y la agencia podía entrar y aprobar como su cliente | El cliente crea su propia contraseña |

## Severidad alta: corregido

**Autenticación**
- Vinculación social por correo sin verificar: GitHub aceptaba correos no verificados y Facebook no informa ese dato. Ahora solo vincula un correo verificado por el proveedor.
- Pre-apropiación de cuentas: la contraseña de una cuenta nunca verificada sobrevivía a la vinculación social. Ahora se descarta.
- Inicio de sesión forzado en la cuenta de otra persona: el flujo OAuth social no estaba atado al navegador. Ahora usa una cookie de un solo uso.
- Tokens de sesión en la URL (`?social_session=`): ahora viajan en el fragmento, que no llega a servidores ni logs.
- Sin límite específico en login ni códigos: se agregó `AUTH_RATE_LIMIT_PER_MINUTE`.
- Sesiones de 7 y 30 días fijas en el código, contra los 15 minutos y 7 días especificados: ahora se respeta la configuración y la SPA renueva sola.
- Códigos OTP escritos en el log de producción y correos enviados sin validar la contraseña.

**Flujo de visado**
- Los escáneres de correo confirmaban solos: abrir el enlace ejecutaba la decisión. Ahora abre una pantalla y exige presionar el botón.
- Las invitaciones no vencían, y rechazar seguía disponible después de confirmar.
- La agencia podía aprobar sus propios videos.
- `autoPublish` (activo por defecto) y el modo directo publicaban sin aprobación, incluso videos rechazados.

**Publicación**
- Renovar un token de Instagram o TikTok guardaba un token **inventado** sobre el real, y rompía la conexión sin avisar. Lo mismo hacía YouTube al fallar.
- Instagram pedía permisos que no permiten publicar y conectaba una cuenta falsa como respaldo.
- TikTok se marcaba como publicado al aceptar el pedido, con una URL inventada. Ahora espera la confirmación.
- Doble publicación al reprogramar o reintentar lo ya publicado, o si dos procesos tomaban la misma publicación.
- `POST /publications/:id/retry` no comprobaba permisos: cualquier agencia podía disparar publicaciones ajenas. Tampoco reintentaba nada tras agotar los intentos.
- YouTube cargaba el video entero en memoria, lo que agota la RAM en un servidor pequeño. Ahora lo envía como flujo.
- Las publicaciones colgadas por un reinicio quedaban en `PROCESSING` para siempre.

**Datos y archivos**
- La hora del Plan dependía de la zona del servidor: en Render, las 18:00 se publicaban a las 15:00 de Buenos Aires. `00:30` se interpretaba como las 18:00.
- `storageKey` admitía cualquier URL, que el servidor luego descargaba (SSRF). Ahora solo acepta rutas propias.
- Se aceptaba cualquier archivo como video. Ahora se valida el contenido, no el nombre.
- La SPA creaba videos apuntando a archivos inexistentes y declaraba WebM como MP4 para Instagram.

**Infraestructura**
- `prisma migrate deploy` no funcionaba en MySQL (`P3019`): las migraciones y Docker seguían en PostgreSQL.
- La imagen Docker no incluía `public/`, así que la app no cargaba.
- Helmet se registraba después de los estáticos: `index.html` se servía sin CSP. CORS aceptaba cualquier origen e ignoraba `CORS_ORIGIN`.
- `MOCK_PLATFORMS=true` en `render.yaml`. Ahora el servidor lo rechaza en producción.
- Las pruebas no compilaban, así que el CI ya estaba en rojo.

## Severidad media: corregido

- HTML sin escapar en correos (nombres de agencia), posible phishing.
- Filtros `undefined` en Prisma que devolvían datos de todas las agencias si faltaba `agencyId`.
- Enlaces `javascript:` en ideas de contenido y asignación de ideas a clientes de otra agencia.
- Errores de MySQL devueltos como 500 genéricos. Ahora hay respuestas claras (409, 400, 404).
- Clientes de agencias suspendidas podían seguir entrando. El reloj también publicaba para ellos.
- Semanas que no empezaban en lunes, bloques en sábado o domingo que la grilla no mostraba, y bloques programados en el pasado.
- El título `#Shorts` se truncaba, y reconectar una red borraba el refresh token.
- `updateBlock` ignoraba `videoId`. `duplicateSchedule` podía dejar semanas a medias: ahora es transaccional.
- Android: tráfico sin cifrar en Release, acceso a archivos en el WebView y token de Google entregable a cualquier página cargada.
- Dependencias sin uso (Redis, BullMQ) y `dotenv` sin declarar.

## Configuración

Antes había valores fijos en el código: remitente, URL, duración de sesiones, límites, reintentos, versión de la API de Meta. Ahora:

- **Variables de entorno** validadas al arrancar: ver `.env.example`.
- **Ajustes** en la app (`ADMIN_GENERAL`), sin reiniciar: nombre de la app, aprobación obligatoria, registro, zona horaria, códigos, invitaciones, reintentos y límites por red. También muestra qué integraciones están activas, sin exponer credenciales.
- **Perfil**: cada usuario edita su nombre y zona horaria.

## Segunda tanda, antes del lanzamiento

- **Sesión:** el refresh token pasó a una cookie `httpOnly` con `SameSite=Strict`, y el access token solo vive en memoria. Un XSS ya no puede robar una sesión duradera. Cerrar sesión funciona aunque el access token haya vencido.
- **Publicación inmediata:** corre en segundo plano y la web muestra el resultado al terminar, sin depender del tiempo límite del proxy.
- **Reintentos:** una publicación agotada que se volvía a publicar o programar fallaba sin intentar nada. Ahora cada ejecución abre una tanda nueva. La web muestra el error de cada red con un botón **Reintentar**.
- **Duración del video:** el servidor la lee del archivo (MP4, MOV y WebM, en disco o S3), sin `ffprobe`. Si el contenedor no la declara, como algunos WebM grabados en el navegador, usa la que informa el navegador.
- **Android:** se eliminaron las pantallas Compose sin uso y sus dependencias: el APK Release pesa 1 MB. El APK publicado antes era una compilación Debug de 21 MB. La autorización de redes se abre en el navegador del sistema y dejó de ocultarse que la app es un WebView.
- **Firma:** clave nueva fuera de Git. La anterior, expuesta en el historial, ya no firma nada.
- **Limpieza:** se eliminó `bull_job_id` y se agregó configuración de ESLint, que ahora corre en el CI.

## Acciones pendientes del titular

1. **Guardar la clave de firma.** Copiá `android/signing/contentsync-release.jks` y `android/keystore.properties` fuera del equipo. Si se pierden, no se puede actualizar la app sin desinstalarla.
2. **Registrar la huella en Google Cloud.** Sin el SHA-1 de la clave nueva, el acceso con Google falla en la app. Ver `docs/deployment-guide.md`.
3. **Almacenamiento de videos.** Cargar las variables `S3_*` y `UPLOAD_MAX_MB=50` en Render (ver `docs/deployment-guide.md`).
4. **Rotar credenciales** si `backend/.env` se compartió alguna vez: nunca estuvo en Git, pero contiene la contraseña de aplicación de Gmail y los secretos de Google, Meta y GitHub.
5. **Revisar producción.** Si el seed se ejecutó ahí, existen cuentas con la contraseña publicada `ContentSync2026!`, incluida la de tu correo real. Lo más simple antes del lanzamiento es empezar con una base vacía.
6. **Datos personales en el historial.** El dump anterior, con hashes y tu correo, sigue en el historial público de Git. Quitarlo requiere reescribir el historial.

## Limitaciones conocidas: sin corregir

- **Publicación real sin probar.** No hay cuentas de prueba: los adaptadores se verificaron con respuestas simuladas, según la documentación de cada API. Conviene una prueba real por red antes de usarlos con clientes.
- **Notificaciones push.** Firebase no está implementado y requiere un proyecto propio: los avisos solo aparecen dentro de la app.
- **Almacenamiento en Render.** Sin las variables `S3_*`, los videos quedan en el disco del plan gratuito y se pierden al reiniciar.
- **Tamaño de video.** Supabase Free admite hasta 50 MB por archivo. Un video más pesado se rechaza con un aviso.
- **Inyección de scripts.** La CSP mantiene `unsafe-inline` porque la web usa manejadores en línea. El access token en memoria sigue expuesto durante un XSS.
- **Acceso con Facebook en la app.** Sigue dentro del WebView porque necesita su cookie, y Meta puede bloquearlo. Sin probar con una cuenta real.
