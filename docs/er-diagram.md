# Diagrama Entidad-Relación y Normalización en 3FN — ContentSync

## 1. Justificación de Formas Normales (1FN, 2FN y 3FN)

El esquema relacional de **ContentSync** en PostgreSQL fue diseñado rigurosamente aplicando la teoría de normalización relacional hasta **Tercera Forma Normal (3FN)**:

### Primera Forma Normal (1FN) — Atomicidad y ausencia de grupos repetitivos
- **Regla:** Todos los atributos de cada relación contienen valores atómicos (indivisibles), no existen arreglos ni listas separadas por comas, y cada tabla posee una clave primaria (`UUID`) bien definida.
- **Aplicación en ContentSync:**
  - En lugar de guardar un campo `hashtags: "#cafe,#reel"` o `platforms: "INSTAGRAM,TIKTOK"` dentro de la tabla `videos`, se crearon las tablas relacionales `video_hashtags` (`video_id`, `tag`, `position`) y `video_platform_targets` (`video_id`, `platform`, `privacy_level`, `share_to_feed`, etc.).
  - En lugar de guardar un arreglo JSON de intentos de publicación dentro de `publications`, cada ejecución de la cola de trabajos se registra atómicamente en `publication_attempts` (`publication_id`, `attempt_number`, `is_success`, `error_code`, `duration_ms`).

### Segunda Forma Normal (2FN) — Dependencia funcional completa de la clave primaria
- **Regla:** Cumple 1FN y todo atributo que no forma parte de una clave candidata depende por completo de la clave primaria/candidata completa (sin dependencias parciales).
- **Aplicación en ContentSync:**
  - En `video_platform_targets` (clave candidata compuesta `(video_id, platform)`), atributos como `custom_title`, `privacy_level`, `share_to_feed`, `allow_duet_stitch` y `made_for_kids` dependen simultáneamente del video **y** de la plataforma destino. Los datos intrínsecos del archivo de video (`duration_seconds`, `size_bytes`, `storage_key`) permanecen únicamente en `videos`.
  - En `schedule_items` (clave candidata `(schedule_id, video_id)`), los atributos `day_of_week` y `planned_publish_at` dependen de la asignación del video a ese cronograma semanal específico.

### Tercera Forma Normal (3FN) — Ausencia de dependencias transitivas
- **Regla:** Cumple 2FN y ningún atributo no primo depende transitivamente de la clave primaria a través de otro atributo no primo ($A \to B \to C$ está prohibido en la misma tabla).
- **Aplicación en ContentSync:**
  - **Roles y Usuarios:** `users` almacena `role_id` referenciando la tabla `roles` (`code`, `name`, `description`). No se duplica el nombre o descripción del rol en cada fila de `users`.
  - **Jerarquía Agencia → Cliente → Cronograma/Video:**
    - `clients` referencia a su agencia mediante `agency_id` y a su usuario mediante `user_id`. No repite `agency_name` ni `email`.
    - `schedules` y `videos` referencian únicamente `client_id`. No almacenan `agency_id` redundantemente, ya que `video.client_id → client.agency_id` determinaría transitivamente la agencia.
  - **Conexiones OAuth vs Login Social:**
    - Las cuentas para iniciar sesión en la app viven en `social_auth_accounts` asociadas a `users`.
    - Los tokens OAuth para publicar contenido en redes viven en `platform_connections` asociados a `clients`, evitando mezclar identidades de usuario con credenciales operativas de marca.

---

## 2. Diagrama Entidad-Relación Completo (Mermaid)

```mermaid
erDiagram
    ROLES ||--o{ USERS : "assigns"
    USERS ||--o{ AUTH_SESSIONS : "maintains"
    USERS ||--o{ SOCIAL_AUTH_ACCOUNTS : "links"
    USERS ||--o| AGENCIES : "owns"
    AGENCIES ||--o{ CLIENTS : "manages"
    USERS ||--o| CLIENTS : "represents"
    CLIENTS ||--o{ PLATFORM_CONNECTIONS : "authorizes"
    CLIENTS ||--o{ SCHEDULES : "has_weekly"
    CLIENTS ||--o{ VIDEOS : "owns_content"
    SCHEDULES ||--o{ SCHEDULE_ITEMS : "contains"
    VIDEOS ||--o{ SCHEDULE_ITEMS : "scheduled_in"
    VIDEOS ||--o{ VIDEO_PLATFORM_TARGETS : "targets"
    VIDEOS ||--o{ VIDEO_HASHTAGS : "tagged_with"
    VIDEOS ||--o{ APPROVALS : "reviewed_via"
    VIDEOS ||--o{ VIDEO_COMMENTS : "discussed_in"
    VIDEOS ||--o{ PUBLICATIONS : "published_as"
    PUBLICATIONS ||--o{ PUBLICATION_ATTEMPTS : "logs_attempt"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ AUDIT_LOGS : "triggers"

    ROLES {
        uuid id PK
        enum code UK "ADMIN_GENERAL | AGENCIA | CLIENTE"
        varchar name
        varchar description
        timestamp created_at
    }

    USERS {
        uuid id PK
        uuid role_id FK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar timezone
        boolean email_verified
        varchar verification_token
        varchar password_reset_token
        timestamp password_reset_expires
        varchar fcm_token
        boolean is_active
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    AUTH_SESSIONS {
        uuid id PK
        uuid user_id FK
        uuid token_family
        varchar refresh_token_hash
        varchar device_info
        varchar ip_address
        boolean is_revoked
        timestamp expires_at
        timestamp created_at
        timestamp rotated_at
    }

    SOCIAL_AUTH_ACCOUNTS {
        uuid id PK
        uuid user_id FK
        enum provider "GOOGLE | FACEBOOK | GITHUB"
        varchar provider_user_id
        varchar email
        timestamp created_at
    }

    AGENCIES {
        uuid id PK
        uuid owner_user_id FK_UK
        varchar name
        varchar tax_id UK
        varchar contact_phone
        varchar website
        boolean is_suspended
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    CLIENTS {
        uuid id PK
        uuid agency_id FK
        uuid user_id FK_UK
        varchar company_name
        varchar industry
        boolean is_active
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    PLATFORM_CONNECTIONS {
        uuid id PK
        uuid client_id FK
        enum platform "INSTAGRAM | TIKTOK | YOUTUBE"
        varchar external_account_id
        varchar account_handle
        text encrypted_access_token
        text encrypted_refresh_token
        timestamp token_expires_at
        varchar scopes
        enum status "ACTIVE | EXPIRED | REVOKED"
        timestamp created_at
        timestamp updated_at
    }

    VIDEOS {
        uuid id PK
        uuid client_id FK
        uuid uploaded_by_user_id FK
        varchar title
        text description
        varchar storage_key
        varchar thumbnail_key
        int duration_seconds
        bigint size_bytes
        varchar mime_type
        varchar aspect_ratio
        enum workflow_status "DRAFT | IN_REVIEW | CHANGES_REQUESTED | REJECTED | APPROVED | SCHEDULED | PUBLISHED"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    VIDEO_HASHTAGS {
        uuid id PK
        uuid video_id FK
        varchar tag
        int position
        timestamp created_at
    }

    VIDEO_PLATFORM_TARGETS {
        uuid id PK
        uuid video_id FK
        enum platform "INSTAGRAM | TIKTOK | YOUTUBE"
        varchar custom_title
        text custom_description
        enum privacy_level "PUBLIC | UNLISTED | PRIVATE"
        boolean share_to_feed
        boolean allow_comments
        boolean allow_duet_stitch
        boolean made_for_kids
        varchar category_id
        timestamp created_at
        timestamp updated_at
    }

    SCHEDULES {
        uuid id PK
        uuid client_id FK
        uuid created_by_user_id FK
        date week_start_date
        date week_end_date
        varchar title
        text summary_notes
        enum status "DRAFT | IN_REVIEW | APPROVED | COMPLETED"
        timestamp created_at
        timestamp updated_at
    }

    SCHEDULE_ITEMS {
        uuid id PK
        uuid schedule_id FK
        uuid video_id FK
        int day_of_week "CHECK (1..7)"
        timestamp planned_publish_at
        varchar notes
        timestamp created_at
        timestamp updated_at
    }

    APPROVALS {
        uuid id PK
        uuid video_id FK
        uuid reviewer_user_id FK
        enum decision "APPROVED | CHANGES_REQUESTED | REJECTED"
        text feedback_notes
        timestamp created_at
    }

    VIDEO_COMMENTS {
        uuid id PK
        uuid video_id FK
        uuid author_user_id FK
        text message
        int timestamp_sec
        timestamp created_at
    }

    PUBLICATIONS {
        uuid id PK
        uuid video_id FK
        enum platform "INSTAGRAM | TIKTOK | YOUTUBE"
        timestamp scheduled_for
        timestamp published_at
        enum status "PENDING | PROCESSING | PUBLISHED | FAILED"
        varchar bull_job_id
        varchar external_post_id
        varchar external_post_url
        text last_error_message
        timestamp created_at
        timestamp updated_at
    }

    PUBLICATION_ATTEMPTS {
        uuid id PK
        uuid publication_id FK
        int attempt_number
        boolean is_success
        varchar error_code
        text error_detail
        int duration_ms
        timestamp attempted_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        enum type
        varchar title
        text body
        uuid reference_id
        boolean is_read
        timestamp created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        varchar action
        varchar entity_type
        varchar entity_id
        varchar ip_address
        varchar user_agent
        text metadata
        timestamp created_at
    }
```

---

## 3. Restricciones de Integridad, Índices y Borrado Lógico

1. **Restricciones `CHECK` en SQL (`migration.sql`):**
   - `users_email_format_chk`: Valida formato de correo electrónico en motor SQL.
   - `videos_duration_positive_chk`: Garantiza `duration_seconds > 0 AND duration_seconds <= 900`.
   - `videos_size_positive_chk`: Garantiza `size_bytes > 0`.
   - `schedules_dates_chk`: Garantiza `week_end_date >= week_start_date`.
   - `schedule_items_day_of_week_chk`: Garantiza `day_of_week BETWEEN 1 AND 7`.
2. **Restricciones `UNIQUE` compuestas:**
   - `social_auth_accounts(provider, provider_user_id)`
   - `platform_connections(client_id, platform)`
   - `video_hashtags(video_id, tag)`
   - `video_platform_targets(video_id, platform)`
   - `schedules(client_id, week_start_date)`
   - `schedule_items(schedule_id, video_id)`
   - `publications(video_id, platform)`
   - `publication_attempts(publication_id, attempt_number)`
3. **Borrado Lógico (`deleted_at`):**
   - Implementado en `users`, `agencies`, `clients` y `videos` para preservar trazabilidad histórica de publicaciones, aprobaciones y logs de auditoría sin romper integridad referencial.
