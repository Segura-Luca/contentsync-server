# ContentSync — Comunicación entre agencias y clientes

**ContentSync** conecta a agencias de marketing con sus clientes para comunicarse, pedir revisiones, confirmar cronogramas y tener todo organizado. Incluye una **web**, una **app Android en Kotlin con WebView** y un **backend en NestJS con MySQL en 3FN**.

La agencia arma el cronograma de la semana con bloques de contenido: cada uno dice qué es (reel, carrusel, historia, publicación, video u otro), de qué trata, en qué estado está (pendiente, grabado, editado o subido) y lleva sus fotos o videos, cada uno con su descripción. El cliente los ve dentro de la plataforma, comenta, aprueba o pide cambios, y confirma la semana.

ContentSync **no publica en redes sociales**: la agencia publica por su cuenta lo que el cliente aprobó.

---

## 1. Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **App Android (`android/`)** | Kotlin y WebView conectado a la app web, selector de fotos y videos de la galería, acceso con Google por `CredentialManager` y sesión persistente con `CookieManager`. `minSdk = 26`, `targetSdk = 34`. |
| **Backend (`backend/`)** | Node.js + TypeScript, NestJS 10, OpenAPI / Swagger (`/api/v1/docs`), validación estricta con `class-validator`, seguridad HTTP con `helmet`, Rate Limiting (`@nestjs/throttler`), cifrado de tokens con `AES-256-GCM` y hash de contraseñas con **Argon2id**. |
| **Base de Datos** | **MySQL 8.0.16+** (también MySQL 9) normalizada en **3FN** con Prisma ORM, migraciones SQL versionadas (`prisma/migrations/`), restricciones `CHECK`/`UNIQUE`, borrado lógico (`deleted_at`) y script de `seed.ts`. |
| **Almacenamiento** | Disco local (`UPLOAD_DIR`) o S3 compatible (Supabase, Cloudflare R2, MinIO), con archivos validados por su contenido y enlaces firmados de 12 horas. |

---

## 2. Justificación de Seguridad en Autenticación

Se implementó **Autenticación Propia con JWT (Access Token corto de 15m + Refresh Token rotativo de 7d)** en lugar de delegar a Firebase Auth por tres razones de arquitectura y seguridad:
1. **Aislamiento Multi-Tenant Estricto en el Token y Base de Datos:** Nuestros Guards validan en cada request el rol (`ADMIN_GENERAL`, `AGENCIA`, `CLIENTE`) y la propiedad del recurso (`agencyId` y `clientId`) directamente contra MySQL sin depender de sincronización externa de *Custom Claims*.
2. **Rotación de Refresh Tokens con Detección de Reuso (Token Family Reuse Detection):** Cada refresh token se guarda hasheado con Argon2id en `auth_sessions` bajo un `token_family`. Si un token ya rotado vuelve a enviarse, el backend detecta robo de credenciales y revoca toda la familia de sesiones del usuario.
3. **Login social vinculado por correo:** Google, Facebook y GitHub autentican al usuario en la app (`social_auth_accounts`), vinculando por email para evitar duplicados.

---

## 3. Roles y Permisos (RBAC) y Cuentas de Prueba (Seeds)

El script `backend/prisma/seed.ts` carga estos usuarios **solo en entornos de desarrollo**. La contraseña de todos es la que definas en `SEED_DEFAULT_PASSWORD`; el script se niega a correr en producción.

| Rol | Email | Alcance de Permisos |
| :--- | :--- | :--- |
| **`ADMIN_GENERAL`** | `admin@contentsync.io` | Gestiona todo el sistema; crea, edita, suspende y elimina agencias y clientes; ve todo el contenido y logs. |
| **`AGENCIA` (Nova)** | `agencia.nova@contentsync.io` | Crea y administra únicamente sus propios clientes (*Kafecito Roasters* y *UrbanFit*). No ve datos de *Pulso Social Media*. |
| **`AGENCIA` (Pulso)** | `agencia.pulso@contentsync.io` | Crea y administra únicamente sus propios clientes (*TechGear Latam* y *Lumina Deco*). |
| **`CLIENTE`** | `cliente.kafecito@contentsync.io` | Ve únicamente sus cronogramas; puede **APROBAR**, **PEDIR CAMBIOS** o **RECHAZAR** cada bloque, comentar y **CONFIRMAR** la semana. |

---

## 4. Cómo Correr el Backend y la Base de Datos

### Opción A: Con Docker Compose
Levanta MySQL 8.4 y el backend; las migraciones se aplican solas al arrancar (MinIO es opcional: `--profile s3`).
```bash
cp .env.example .env   # definí MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD y los secretos
docker compose up -d --build
```
- **Aplicación y API:** `http://localhost:3000` · `http://localhost:3000/api/v1`
- **Swagger:** `http://localhost:3000/api/v1/docs`

### Opción B: Ejecución Local con Node.js y MySQL
```bash
cd backend
cp ../.env.example .env   # definí DATABASE_URL con tu MySQL
npm install
npx prisma generate
npm run prisma:migrate    # aplica migraciones; adopta bases existentes sin perder datos
SEED_DEFAULT_PASSWORD='ElegíUnaClave2026!' npm run prisma:seed   # opcional: datos de demostración
npm run start:dev
```
El archivo `contentsync_mysql.sql` contiene el mismo esquema, por si preferís importarlo con Workbench.

### Configuración
La aplicación se configura en dos niveles:

| Nivel | Dónde | Qué contiene |
| :--- | :--- | :--- |
| **Infraestructura y secretos** | Variables de entorno, documentadas en [`.env.example`](.env.example). Se validan al arrancar. | Base de datos, URL pública, JWT, correo, almacenamiento e inicio de sesión social. |
| **Reglas de negocio** | **Ajustes** en la app, con una cuenta `ADMIN_GENERAL`. Se guardan en MySQL y se aplican sin reiniciar. | Nombre de la app, registro de agencias, zona horaria, y vigencias e intentos de códigos e invitaciones. |

Cada usuario elige además su propia zona horaria.

### Ejecutar Tests del Backend (Unitarios + E2E)
```bash
cd backend
npm test
npm run test:e2e
```

---

## 5. Cómo Compilar y Generar el APK de Android (Debug y Release Firmado)

Desde la carpeta `android/` (o abriendo la carpeta `android` en Android Studio):

```bash
cd android
# Generar APK Debug y APK Release ofuscado con R8/ProGuard
./gradlew assembleDebug assembleRelease
```

La URL y el cliente de Google se pasan con `-PWEB_APP_URL=...` y `-PGOOGLE_WEB_CLIENT_ID=...`. El APK Release se firma con `android/keystore.properties` (ver [`keystore.properties.example`](android/keystore.properties.example)) o con las variables `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` y `KEY_PASSWORD`. El keystore nunca debe estar en el repositorio.

Los APKs generados se ubican en:
- **APK Debug:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **APK Release:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 6. Documentación Adicional en `/docs`

- [Arquitectura y Seguridad (`docs/architecture.md`)](docs/architecture.md)
- [Diagrama Entidad-Relación en Mermaid y Justificación 1FN, 2FN y 3FN (`docs/er-diagram.md`)](docs/er-diagram.md)
- [Guía de Despliegue (`docs/deployment-guide.md`)](docs/deployment-guide.md)
- [Auditoría de seguridad y funcionamiento (`docs/auditoria.md`)](docs/auditoria.md)
- [Historial de Versiones (`CHANGELOG.md`)](CHANGELOG.md)
