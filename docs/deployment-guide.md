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
2. Copia `.env.example` a `.env` y reemplaza todos los secretos (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OAUTH_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`).
3. Configura un proxy inverso con HTTPS obligatorio (Nginx / Caddy / Cloudflare Tunnel).
4. Ejecuta:
   ```bash
   docker compose up -d --build
   docker compose exec backend npx prisma migrate deploy
   docker compose exec backend npm run prisma:seed
   ```
