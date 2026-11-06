# Diagrama Entidad-Relación y Normalización en 3FN — ContentSync

## 1. Justificación de Formas Normales (1FN, 2FN y 3FN)

El esquema relacional de **ContentSync** en MySQL está normalizado hasta la tercera forma normal.

### Primera Forma Normal (1FN) — Atomicidad y ausencia de grupos repetitivos
- **Regla:** todos los atributos contienen valores atómicos, sin listas ni grupos repetitivos.
- **Aplicación en ContentSync:**
  - Las fotos y los videos de un bloque no se guardan en una lista dentro de `schedule_items`: cada archivo es una fila de `schedule_item_media`, con su descripción y su posición.
  - Las revisiones y los comentarios tampoco: cada uno es una fila de `block_reviews` o `block_comments`.

### Segunda Forma Normal (2FN) — Dependencia funcional completa de la clave primaria
- **Regla:** cumple 1FN y todo atributo no clave depende de la clave completa.
- **Aplicación en ContentSync:**
  - Cada tabla usa una clave primaria simple (`id`), así que no hay dependencias parciales.
  - La clave candidata compuesta `(client_id, week_start_date)` de `schedules` identifica una semana: `title` y `status` dependen de la semana completa, no solo del cliente ni solo de la fecha.

### Tercera Forma Normal (3FN) — Ausencia de dependencias transitivas
- **Regla:** cumple 2FN y ningún atributo no clave depende de otro atributo no clave.
- **Aplicación en ContentSync:**
  - **Roles y usuarios:** `users` guarda `role_id`; el nombre y la descripción del rol viven en `roles`.
  - **Jerarquía agencia → cliente → cronograma → bloque → archivo:** cada tabla referencia solo a su padre inmediato. `schedules` no guarda `agency_id`: se obtiene a través de `clients`.
  - **Tipo de archivo:** `schedule_item_media` guarda `mime_type` y `kind` porque el servidor los fija al validar el archivo, y no dependen de otra columna de datos.
  - **Datos personales:** el nombre y el correo de quien comenta viven en `users`; `block_comments` solo guarda `author_user_id`.

---

## 2. Diagrama Entidad-Relación (Mermaid)

```mermaid
erDiagram
    ROLES ||--o{ USERS : "asigna"
    USERS ||--o{ AUTH_SESSIONS : "mantiene"
    USERS ||--o{ SOCIAL_AUTH_ACCOUNTS : "vincula"
    USERS ||--o| AGENCIES : "es dueño de"
    AGENCIES ||--o{ CLIENTS : "administra"
    USERS ||--o| CLIENTS : "representa"
    CLIENTS ||--o{ SCHEDULES : "tiene"
    SCHEDULES ||--o{ SCHEDULE_ITEMS : "contiene"
    SCHEDULE_ITEMS ||--o{ SCHEDULE_ITEM_MEDIA : "muestra"
    SCHEDULE_ITEMS ||--o{ BLOCK_REVIEWS : "se revisa en"
    SCHEDULE_ITEMS ||--o{ BLOCK_COMMENTS : "se conversa en"
    USERS ||--o{ BLOCK_REVIEWS : "decide"
    USERS ||--o{ BLOCK_COMMENTS : "escribe"
    USERS ||--o{ SCHEDULES : "confirma"
    AGENCIES ||--o{ CONTENT_IDEA_SECTIONS : "organiza"
    CONTENT_IDEA_SECTIONS ||--o{ CONTENT_IDEAS : "agrupa"
    CLIENTS |o--o{ CONTENT_IDEAS : "referencia"
    CLIENTS ||--o{ CLIENT_IDEA_PROPOSALS : "propone"
    AGENCIES ||--o{ CLIENT_IDEA_PROPOSALS : "recibe"
    USERS ||--o{ NOTIFICATIONS : "recibe"
    USERS |o--o{ AUDIT_LOGS : "genera"
    USERS |o--o{ APP_SETTINGS : "actualiza"

    ROLES {
        uuid id PK
        enum code UK "ADMIN_GENERAL | AGENCIA | CLIENTE"
        varchar name
    }

    USERS {
        uuid id PK
        uuid role_id FK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar timezone
        boolean email_verified
        boolean is_active
        datetime deleted_at
    }

    AGENCIES {
        uuid id PK
        uuid owner_user_id FK
        varchar name
        varchar tax_id UK
        boolean is_suspended
        datetime deleted_at
    }

    CLIENTS {
        uuid id PK
        uuid agency_id FK
        uuid user_id FK
        varchar company_name
        enum confirmation_status "PENDING | CONFIRMED | REJECTED"
        varchar confirmation_token UK
        datetime confirmation_expires_at
        datetime deleted_at
    }

    SCHEDULES {
        uuid id PK
        uuid client_id FK
        uuid created_by_user_id FK
        uuid duplicated_from_id FK
        date week_start_date
        date week_end_date
        varchar title
        enum status "DRAFT | IN_REVIEW | APPROVED | COMPLETED"
        datetime confirmed_at
        uuid confirmed_by_user_id FK
    }

    SCHEDULE_ITEMS {
        uuid id PK
        uuid schedule_id FK
        int day_of_week
        enum content_type "REEL | CAROUSEL | STORY | POST | VIDEO | OTHER"
        varchar block_title
        text notes "De qué trata el contenido"
        text caption "Texto de la publicación"
        varchar planned_time
        varchar note_color
        enum review_status "IN_REVIEW | CHANGES_REQUESTED | REJECTED | APPROVED"
        enum production_status "PENDING | RECORDED | EDITED | UPLOADED"
    }

    SCHEDULE_ITEM_MEDIA {
        uuid id PK
        uuid schedule_item_id FK
        enum kind "IMAGE | VIDEO"
        varchar storage_key
        varchar mime_type
        bigint size_bytes
        varchar original_name
        text description
        int position
    }

    BLOCK_REVIEWS {
        uuid id PK
        uuid schedule_item_id FK
        uuid reviewer_user_id FK
        enum decision "APPROVED | CHANGES_REQUESTED | REJECTED"
        text feedback_notes
    }

    BLOCK_COMMENTS {
        uuid id PK
        uuid schedule_item_id FK
        uuid author_user_id FK
        text message
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        enum type
        varchar title
        text body
        uuid reference_id
        boolean is_read
    }
```

Las tablas `auth_sessions`, `social_auth_accounts`, `content_idea_sections`, `content_ideas`, `client_idea_proposals`, `audit_logs` y `app_settings` se omiten en el detalle de columnas. Su definición completa está en [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
