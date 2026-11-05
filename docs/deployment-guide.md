# Guía de Configuración de APIs Externas y Despliegue — ContentSync

> [!IMPORTANT]
> **Modo Simulado Activo por Defecto (`MOCK_PLATFORMS=true` y `FCM_MOCK_MODE=true`):**
> El proyecto viene configurado para funcionar de punta a punta sin requerir que tengas aprobadas hoy mismo las aplicaciones comerciales de Meta, TikTok y Google. Cuando quieras pasar a producción real con cuentas en vivo, sigue los pasos detallados a continuación y cambia `MOCK_PLATFORMS=false` en tu archivo `.env`.

---

## 1. Configuración de YouTube Data API v3 (Google Cloud Console)

1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto llamado `ContentSync`.
2. Ve a **APIs y Servicios > Biblioteca** y habilita **YouTube Data API v3**.
3. En **Pantalla de consentimiento de OAuth**, configura la aplicación y agrega los scopes:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`
4. En **Credenciales**, crea un **ID de cliente de OAuth 2.0**:
   - Tipo Web para el callback del backend (`YOUTUBE_REDIRECT_URI=https://tu-dominio.com/api/v1/platforms/oauth/youtube/callback`).
   - Tipo Android (con el SHA-1 de tu keystore) para Google Sign-In (`GOOGLE_AUTH_CLIENT_ID`).
5. **Limitaciones y Aprobación de Google:**
   - En modo prueba solo pueden publicar los usuarios agregados en "Test users".
   - Por defecto, un proyecto nuevo tiene una cuota de **10,000 unidades/día** (cada subida de video consume ~1,600 unidades, es decir ~6 subidas diarias gratis). Para agencias con alto volumen debes enviar el formulario de verificación de OAuth y aumento de cuota de YouTube API.

---

## 2. Configuración de Instagram Graph API — Reels (Meta for Developers)

1. Ingresa a [Meta for Developers](https://developers.facebook.com/) y crea una App de tipo **Empresa (Business)**.
2. Agrega los productos **Inicio de sesión con Facebook para empresas** e **Instagram Graph API**.
3. Solicita los siguientes permisos en **Revisión de la App (App Review)**:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `pages_show_list`
4. Copia el ID de la aplicación y la clave secreta en `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`.
5. **Requisitos Técnicos y Limitaciones de Meta:**
   - **Cuenta Profesional Obligatoria:** La API de Instagram **no** permite publicar en cuentas personales; el cliente debe tener una cuenta **Instagram Business** o **Creator** vinculada a una Página de Facebook.
   - **URL Pública del Video:** Instagram Graph API descarga el video desde `publicVideoUrl` (generada por nuestro bucket S3/R2).
   - **Límite de tasa:** Máximo **50 publicaciones creadas por API cada 24 horas** por cuenta de Instagram.

---

## 3. Configuración de TikTok Content Posting API (TikTok for Developers)

1. Ingresa a [TikTok for Developers](https://developers.tiktok.com/) y crea una aplicación.
2. Habilita el kit **Login Kit** y **Content Posting API** (Direct Post).
3. Solicita los scopes:
   - `user.info.basic`
   - `video.publish`
   - `video.upload`
4. Configura el dominio verificado de tu bucket S3/Cloudflare R2 en la sección **URL Prefix Verification** de TikTok para permitir `PULL_FROM_URL`.
5. Coloca `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET` en `.env`.
6. **Limitaciones y Auditoría de TikTok:**
   - Mientras la app no haya pasado la auditoría de seguridad de TikTok (*Sandbox / Unaudited*), los videos publicados mediante API se suben únicamente con visibilidad privada (`SELF_ONLY`) en cuentas autorizadas en el Sandbox.
   - Una vez aprobada la auditoría comercial, TikTok habilita `PUBLIC_TO_EVERYONE` y exige mostrar en la UI de subida los selectores de privacidad, comentarios y Dúo/Pegar (ya incluidos en `VideoUploadScreen.kt`).

---

## 4. Despliegue en Producción (Docker Compose / Cloud)

1. Clona el repositorio en tu servidor Linux con Docker y Docker Compose instalados.
2. Copia `.env.example` a `.env` y define los secretos (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OAUTH_ENCRYPTION_KEY`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`) y `PUBLIC_APP_URL`. El servidor no arranca en producción si falta alguno o si conserva un valor de ejemplo.
3. Configura un proxy inverso con HTTPS obligatorio (Nginx / Caddy / Cloudflare Tunnel).
4. Ejecuta:
   ```bash
   docker compose up -d --build
   ```

---

## 5. Base de datos MySQL y migraciones

ContentSync solo soporta MySQL 8.0.16 o superior. Al arrancar, `node prisma/deploy.js` aplica las migraciones pendientes.

**Bases existentes** (creadas con `prisma db push` o importando un dump): Prisma las rechaza con `P3005` porque no tienen historial. El script lo detecta, registra `20261022000000_init_3nf_schema` como línea base sin ejecutarla, y aplica el resto. Requiere que esa base tenga el esquema de esa línea base. Hacé una copia de seguridad antes:

```bash
mysqldump --single-transaction --no-tablespaces -u USUARIO -p NOMBRE_BASE > copia.sql
```

## 6. Despliegue en Render

`render.yaml` declara el servicio y las variables que debés cargar en el panel. Antes del primer despliegue con esta versión:

1. Generá secretos propios si todavía usás valores de ejemplo. Cambiar `OAUTH_ENCRYPTION_KEY` obliga a reconectar las cuentas de redes de cada cliente.
2. Definí `PUBLIC_APP_URL` si usás un dominio propio (de lo contrario se toma `RENDER_EXTERNAL_URL`).
3. Hacé una copia de seguridad de la base: el arranque aplicará las migraciones pendientes.
4. Agregá en cada consola de desarrollador el callback correspondiente: `https://TU_DOMINIO/api/v1/platforms/oauth/{youtube|instagram|tiktok}/callback` y `https://TU_DOMINIO/api/v1/auth/oauth/{facebook|github}/callback`.

El disco del plan gratuito de Render es efímero: los videos subidos se pierden al reiniciar. Para producción, apuntá `UPLOAD_DIR` a un disco persistente.

## 7. Firma del APK

La clave de firma identifica a la app para siempre: si se pierde, los usuarios no pueden actualizar sin desinstalar. Guardá una copia de `android/signing/contentsync-release.jks` y de `android/keystore.properties` fuera del equipo, en un gestor de contraseñas o similar.

Para el acceso con Google en la app, registrá el SHA-1 de esa clave en un cliente OAuth de tipo Android de Google Cloud (paquete `com.contentsync.app`):

```bash
keytool -list -v -keystore android/signing/contentsync-release.jks -alias contentsync
```

## 8. Sesiones y dominio

El refresh token es una cookie `httpOnly` con `SameSite=Strict`, marcada `Secure` cuando `PUBLIC_APP_URL` usa HTTPS. Por eso la web y la API deben servirse desde el mismo sitio, como hace este proyecto.

## 9. Almacenamiento de videos

Sin S3, los videos quedan en el disco de Render y se borran al reiniciar. Con `S3_ENDPOINT`, `S3_ACCESS_KEY` y `S3_SECRET_KEY` definidas, el servidor valida cada archivo y lo guarda en `clients/<cliente>/` dentro del bucket.

Con Supabase Storage:

| Variable | Valor |
| --- | --- |
| `S3_ENDPOINT` | `https://<proyecto>.storage.supabase.co/storage/v1/s3` |
| `S3_PUBLIC_URL` | `https://<proyecto>.supabase.co/storage/v1/object/public/<bucket>` |
| `S3_BUCKET` | Nombre del bucket, que debe ser público |
| `S3_REGION` | Región que indica Storage > S3 en Supabase |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Claves de Storage > S3 en Supabase |
| `UPLOAD_MAX_MB` | `50` en el plan Free |

El plan Free admite 50 MB por archivo. Un video más pesado se rechaza con un aviso, así que conviene exportarlo comprimido o usar un plan con un límite mayor.

