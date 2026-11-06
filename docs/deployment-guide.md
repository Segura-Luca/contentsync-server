# Guía de Despliegue — ContentSync

ContentSync no se conecta con redes sociales ni publica contenido: agencias y clientes se comunican, revisan y confirman cronogramas dentro de la plataforma. Por eso no hace falta ninguna app de desarrollador de YouTube, Instagram o TikTok.

## 1. Inicio de sesión con Google, Facebook y GitHub

Es opcional. Cada proveedor se activa al cargar sus variables (`.env.example`):

- **Google:** `GOOGLE_AUTH_CLIENT_ID`, un cliente OAuth de tipo Web. Para la app de Android hace falta además un cliente de tipo Android en el mismo proyecto, con el paquete `com.contentsync.app` y el SHA-1 de la clave de firma (sección 5).
- **Facebook:** `FACEBOOK_AUTH_APP_ID` y `FACEBOOK_AUTH_APP_SECRET`.
- **GitHub:** `GITHUB_AUTH_CLIENT_ID` y `GITHUB_AUTH_CLIENT_SECRET`.

## 2. Despliegue con Docker Compose

1. Cloná el repositorio en un servidor Linux con Docker y Docker Compose.
2. Copiá `.env.example` a `.env` y definí los secretos (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`).
3. Configurá un proxy inverso con HTTPS obligatorio (Nginx, Caddy o Cloudflare Tunnel).
4. Ejecutá:
   ```bash
   docker compose up -d --build
   ```

## 3. Base de datos MySQL y migraciones

ContentSync solo soporta MySQL 8.0.16 o superior, o un servicio compatible como TiDB Cloud. Al arrancar, `node prisma/deploy.js` aplica las migraciones pendientes.

**Bases existentes** (creadas con `prisma db push` o importando un dump): Prisma las rechaza con `P3005` porque no tienen historial. El script registra la línea base como aplicada sin ejecutarla y luego aplica lo pendiente, sin borrar datos.

**Antes de actualizar a la versión 2.0**, hacé una copia de la base:

```bash
mysqldump --single-transaction --no-tablespaces -u USUARIO -p NOMBRE_BASE > copia.sql
```

La migración `20261106000000_collaboration_workspace` no se puede revertir:

- **Se conserva:** bloques, aprobaciones y comentarios. Cada video que estaba en un bloque pasa a ser un archivo de ese bloque.
- **Se elimina:** cuentas de redes conectadas, publicaciones y sus intentos, hashtags y destinos por red.
- **Se pierde:** los videos que no estaban en ningún bloque, y sus aprobaciones y comentarios. Sus archivos quedan en el almacenamiento: no se borran solos.

## 4. Despliegue en Render

`render.yaml` declara el servicio y las variables que hay que cargar en el panel.

- **Comando de inicio:** tiene que ser `node prisma/deploy.js && node dist/main.js`. El panel puede conservar un comando anterior aunque cambie `render.yaml`.
- **Variables obligatorias:** `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y `PUBLIC_APP_URL` (si usás un dominio propio).
- **Variables que ya no se usan:** `OAUTH_ENCRYPTION_KEY`, `S3_PUBLIC_URL`, `MOCK_PLATFORMS`, `YOUTUBE_*`, `INSTAGRAM_*`, `TIKTOK_*` y `PUBLISH_*`. Se pueden borrar.
- **Plan gratuito:** el servicio se duerme tras unos 15 minutos sin visitas, y la primera visita siguiente tarda cerca de un minuto en abrir. Su disco se borra al reiniciar, así que los archivos tienen que ir a S3 (sección 7).

## 5. Firma del APK

La clave de firma identifica a la app para siempre: si se pierde, los usuarios no pueden actualizar sin desinstalar. Guardá una copia de `android/signing/contentsync-release.jks` y de `android/keystore.properties` fuera del equipo, en un gestor de contraseñas o similar.

Para el acceso con Google en la app, registrá el SHA-1 de esa clave en un cliente OAuth de tipo Android de Google Cloud (paquete `com.contentsync.app`):

```bash
keytool -list -v -keystore android/signing/contentsync-release.jks -alias contentsync
```

## 6. Sesiones y dominio

El refresh token es una cookie `httpOnly` con `SameSite=Strict`, marcada `Secure` cuando `PUBLIC_APP_URL` usa HTTPS. Por eso la web y la API deben servirse desde el mismo sitio, como hace este proyecto.

## 7. Almacenamiento de fotos y videos

Sin S3, los archivos quedan en el disco del servidor. Con `S3_ENDPOINT`, `S3_ACCESS_KEY` y `S3_SECRET_KEY` definidas, el servidor valida cada archivo por su contenido y lo guarda en `clients/<cliente>/` dentro del bucket.

Los archivos se ven solo dentro de la plataforma, con enlaces firmados que vencen a las 12 horas. Por eso **el bucket debería ser privado**.

Con Supabase Storage:

| Variable | Valor |
| --- | --- |
| `S3_ENDPOINT` | `https://<proyecto>.storage.supabase.co/storage/v1/s3` |
| `S3_BUCKET` | Nombre del bucket |
| `S3_REGION` | Región que indica Storage > S3 en Supabase |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Claves de Storage > S3 en Supabase |
| `UPLOAD_MAX_MB` | `50` en el plan Free |

El plan Free admite 50 MB por archivo. Un video más pesado se rechaza con un aviso, así que conviene exportarlo comprimido o usar un plan con un límite mayor.

## 8. Correo en producción

Render bloquea los puertos SMTP en el plan gratuito, así que el correo sale por n8n. Los códigos de 6 dígitos y las invitaciones "Sí, soy yo" usan el mismo webhook, y el relay HTTPS queda como respaldo opcional.

El flujo de n8n necesita dos nodos:

1. **Webhook:** método `POST`, con autenticación **Header Auth**. El nombre de la cabecera es `X-Webhook-Secret` y el valor es el mismo de `N8N_WEBHOOK_SECRET` en Render. Sin esto, cualquiera que conozca la URL puede enviar correos desde tu cuenta.
2. **Gmail (Send a message):** usa lo que recibe, no una plantilla fija.

| Campo del correo | Valor en n8n |
| --- | --- |
| To | `{{ $json.body.to }}` |
| Subject | `{{ $json.body.subject }}` |
| Email Type | HTML |
| Message | `{{ $json.body.html }}` |

Si en Render existe `MAIL_TRANSPORTS_GENERAL` o `MAIL_TRANSPORTS_OTP`, debe incluir `n8n`.
