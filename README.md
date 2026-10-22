# ContentSync — Plataforma Multi-Red para Agencias de Marketing Digital

**ContentSync** es una solución completa (**App Android nativa en Kotlin + Jetpack Compose + Material 3** y **Backend API REST en Node.js + NestJS + PostgreSQL 3FN + BullMQ**) diseñada para que las agencias de marketing suban un video **una sola vez**, gestionen su aprobación semanal con el cliente, y lo publiquen o programen simultáneamente en **Instagram Reels**, **TikTok** y **YouTube Shorts**.

---

## 1. Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **App Android (`android/`)** | Kotlin, Jetpack Compose, Material 3 (Claro/Oscuro/Sistema), `WindowSizeClass` (adaptativo Teléfonos/Tablets), MVVM + Clean Architecture, Hilt, Navigation Compose, Coroutines + Flow, Retrofit + OkHttp (`TokenRefreshAuthenticator`), Room (caché offline), DataStore, `EncryptedSharedPreferences` (Keystore AES256-GCM), WorkManager (`ResumableVideoUploadWorker`), Coil. `minSdk = 26`, `targetSdk = 34`. |
| **Backend (`backend/`)** | Node.js + TypeScript, NestJS 10, OpenAPI / Swagger (`/api/v1/docs`), validación estricta con `class-validator`, seguridad HTTP con `helmet`, Rate Limiting (`@nestjs/throttler`), cifrado de tokens con `AES-256-GCM` y hash de contraseñas con **Argon2id**. |
| **Base de Datos** | PostgreSQL 16 normalizada en **3FN** con Prisma ORM, migraciones SQL versionadas (`prisma/migrations/`), restricciones `CHECK`/`UNIQUE`, borrado lógico (`deleted_at`) y script de `seed.ts`. |
| **Cola y Almacenamiento** | Redis 7 + BullMQ (programación por zona horaria y reintentos automáticos) + S3 Compatible (MinIO en desarrollo / AWS S3 o Cloudflare R2 en producción) con subida por **URL prefirmada**. |

---

## 2. Justificación de Seguridad en Autenticación

Se implementó **Autenticación Propia con OAuth 2.0 + JWT (Access Token corto de 15m + Refresh Token rotativo de 7d)** en lugar de delegar a Firebase Auth por tres razones de arquitectura y seguridad:
1. **Aislamiento Multi-Tenant Estricto en el Token y Base de Datos:** Nuestros Guards validan en cada request el rol (`ADMIN_GENERAL`, `AGENCIA`, `CLIENTE`) y la propiedad del recurso (`agencyId` y `clientId`) directamente contra PostgreSQL sin depender de sincronización externa de *Custom Claims*.
2. **Rotación de Refresh Tokens con Detección de Reuso (Token Family Reuse Detection):** Cada refresh token se guarda hasheado con Argon2id en `auth_sessions` bajo un `token_family`. Si un token ya rotado vuelve a enviarse, el backend detecta robo de credenciales y revoca toda la familia de sesiones del usuario.
3. **Separación Total entre Login Social y Conexiones OAuth de Publicación:**
   - El login social (Google, Facebook, GitHub) autentica al usuario en la app (`social_auth_accounts`) vinculando por email para evitar duplicados.
   - La conexión de cuentas de **Instagram Reels, TikTok y YouTube Shorts** para publicar se almacena por cliente en `platform_connections` con tokens cifrados en reposo mediante **AES-256-GCM**.

---

## 3. Roles y Permisos (RBAC) y Cuentas de Prueba (Seeds)

El script `backend/prisma/seed.ts` (y los botones de acceso rápido en la pantalla de Login de la app Android) incluyen los siguientes usuarios listos para probar cada jerarquía:

| Rol | Email | Contraseña | Alcance de Permisos |
| :--- | :--- | :--- | :--- |
| **`ADMIN_GENERAL`** | `admin@contentsync.io` | `ContentSync2026!` | Gestiona todo el sistema; crea, edita, suspende y elimina agencias y clientes; ve todo el contenido y logs. |
| **`AGENCIA` (Nova)** | `agencia.nova@contentsync.io` | `ContentSync2026!` | Crea y administra únicamente sus propios clientes (*Kafecito Roasters* y *UrbanFit*). No ve datos de *Pulso Social Media*. |
| **`AGENCIA` (Pulso)** | `agencia.pulso@contentsync.io` | `ContentSync2026!` | Crea y administra únicamente sus propios clientes (*TechGear Latam* y *Lumina Deco*). |
| **`CLIENTE`** | `cliente.kafecito@contentsync.io` | `ContentSync2026!` | Ve únicamente sus cronogramas semanales y videos; puede **APROBAR**, **PEDIR CAMBIOS** o **RECHAZAR** dejando notas. |

---

## 4. Cómo Correr el Backend y la Base de Datos

### Opción A: Con Docker Compose (Recomendado)
Levanta PostgreSQL 16, Redis 7, MinIO (S3) y el Backend NestJS:
```bash
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
```
- **API REST Base URL:** `http://localhost:3000/api/v1`
- **Documentación Interactiva Swagger:** `http://localhost:3000/api/v1/docs`
- **Consola MinIO (S3):** `http://localhost:9001` (`minioadmin` / `minioadmin123`)

### Opción B: Ejecución Local con Node.js
```bash
cd backend
cp ../.env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

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
# Ejecutar tests unitarios (JUnit)
./gradlew testDebugUnitTest

# Generar APK Debug y APK Release firmado + ofuscado con R8/ProGuard
./gradlew assembleDebug assembleRelease
```

Los APKs generados se ubican en:
- **APK Debug:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **APK Release (Firmado):** `android/app/build/outputs/apk/release/app-release.apk`

---

## 6. Documentación Adicional en `/docs`

- [Arquitectura y Seguridad (`docs/architecture.md`)](docs/architecture.md)
- [Diagrama Entidad-Relación en Mermaid y Justificación 1FN, 2FN y 3FN (`docs/er-diagram.md`)](docs/er-diagram.md)
- [Guía de Configuración de Apps de Desarrollador (YouTube, Instagram, TikTok) y Despliegue (`docs/deployment-guide.md`)](docs/deployment-guide.md)
- [Historial de Versiones (`CHANGELOG.md`)](CHANGELOG.md)
