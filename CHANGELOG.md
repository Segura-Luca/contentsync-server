# Changelog — ContentSync

Todos los cambios relevantes de este proyecto se documentan en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y [Semantic Versioning (SemVer)](https://semver.org/lang/es/).

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
