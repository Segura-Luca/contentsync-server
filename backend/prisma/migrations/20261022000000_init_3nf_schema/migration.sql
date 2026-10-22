-- ============================================================================
-- ContentSync — Initial Versioned SQL Migration (3NF Relational Schema)
-- Incluye CHECK constraints, UNIQUE constraints, Foreign Keys e Índices
-- ============================================================================

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('ADMIN_GENERAL', 'AGENCIA', 'CLIENTE');
CREATE TYPE "SocialProvider" AS ENUM ('GOOGLE', 'FACEBOOK', 'GITHUB');
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE');
CREATE TYPE "PlatformConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'COMPLETED');
CREATE TYPE "VideoWorkflowStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED');
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED');
CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');
CREATE TYPE "PrivacyLevel" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
CREATE TYPE "NotificationType" AS ENUM ('NEW_SCHEDULE', 'VIDEO_IN_REVIEW', 'VIDEO_APPROVED', 'VIDEO_CHANGES_REQUESTED', 'VIDEO_REJECTED', 'PUBLICATION_SUCCESS', 'PUBLICATION_FAILED');

-- CreateTable: roles
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "password_hash" VARCHAR(255),
    "full_name" VARCHAR(150) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" VARCHAR(128),
    "password_reset_token" VARCHAR(128),
    "password_reset_expires" TIMESTAMP(3),
    "fcm_token" VARCHAR(512),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_format_chk" CHECK ("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_id_idx" ON "users"("role_id");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateTable: auth_sessions
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_family" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "device_info" VARCHAR(255),
    "ip_address" VARCHAR(64),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_token_family_idx" ON "auth_sessions"("token_family");

-- CreateTable: social_auth_accounts
CREATE TABLE "social_auth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "provider_user_id" VARCHAR(180) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_auth_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "social_auth_accounts_provider_provider_user_id_key" ON "social_auth_accounts"("provider", "provider_user_id");
CREATE INDEX "social_auth_accounts_user_id_idx" ON "social_auth_accounts"("user_id");
CREATE INDEX "social_auth_accounts_email_idx" ON "social_auth_accounts"("email");

-- CreateTable: agencies
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "tax_id" VARCHAR(40) NOT NULL,
    "contact_phone" VARCHAR(40),
    "website" VARCHAR(255),
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agencies_owner_user_id_key" ON "agencies"("owner_user_id");
CREATE UNIQUE INDEX "agencies_tax_id_key" ON "agencies"("tax_id");
CREATE INDEX "agencies_is_suspended_idx" ON "agencies"("is_suspended");
CREATE INDEX "agencies_deleted_at_idx" ON "agencies"("deleted_at");

-- CreateTable: clients
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" VARCHAR(150) NOT NULL,
    "industry" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clients_user_id_key" ON "clients"("user_id");
CREATE INDEX "clients_agency_id_idx" ON "clients"("agency_id");
CREATE INDEX "clients_is_active_idx" ON "clients"("is_active");
CREATE INDEX "clients_deleted_at_idx" ON "clients"("deleted_at");

-- CreateTable: platform_connections
CREATE TABLE "platform_connections" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "external_account_id" VARCHAR(180) NOT NULL,
    "account_handle" VARCHAR(120) NOT NULL,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scopes" VARCHAR(500),
    "status" "PlatformConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_connections_client_id_platform_key" ON "platform_connections"("client_id", "platform");
CREATE INDEX "platform_connections_client_id_idx" ON "platform_connections"("client_id");
CREATE INDEX "platform_connections_status_idx" ON "platform_connections"("status");

-- CreateTable: videos
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "thumbnail_key" VARCHAR(500),
    "duration_seconds" INTEGER NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(60) NOT NULL DEFAULT 'video/mp4',
    "aspect_ratio" VARCHAR(16) NOT NULL DEFAULT '9:16',
    "workflow_status" "VideoWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "videos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "videos_duration_positive_chk" CHECK ("duration_seconds" > 0 AND "duration_seconds" <= 900),
    CONSTRAINT "videos_size_positive_chk" CHECK ("size_bytes" > 0)
);
CREATE INDEX "videos_client_id_workflow_status_idx" ON "videos"("client_id", "workflow_status");
CREATE INDEX "videos_created_at_idx" ON "videos"("created_at");
CREATE INDEX "videos_deleted_at_idx" ON "videos"("deleted_at");

-- CreateTable: video_hashtags
CREATE TABLE "video_hashtags" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "tag" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_hashtags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "video_hashtags_video_id_tag_key" ON "video_hashtags"("video_id", "tag");
CREATE INDEX "video_hashtags_tag_idx" ON "video_hashtags"("tag");

-- CreateTable: video_platform_targets
CREATE TABLE "video_platform_targets" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "custom_title" VARCHAR(150),
    "custom_description" TEXT,
    "privacy_level" "PrivacyLevel" NOT NULL DEFAULT 'PUBLIC',
    "share_to_feed" BOOLEAN NOT NULL DEFAULT true,
    "allow_comments" BOOLEAN NOT NULL DEFAULT true,
    "allow_duet_stitch" BOOLEAN NOT NULL DEFAULT true,
    "made_for_kids" BOOLEAN NOT NULL DEFAULT false,
    "category_id" VARCHAR(20) DEFAULT '22',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "video_platform_targets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "video_platform_targets_video_id_platform_key" ON "video_platform_targets"("video_id", "platform");
CREATE INDEX "video_platform_targets_video_id_idx" ON "video_platform_targets"("video_id");

-- CreateTable: schedules
CREATE TABLE "schedules" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "week_start_date" DATE NOT NULL,
    "week_end_date" DATE NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "summary_notes" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "schedules_dates_chk" CHECK ("week_end_date" >= "week_start_date")
);
CREATE UNIQUE INDEX "schedules_client_id_week_start_date_key" ON "schedules"("client_id", "week_start_date");
CREATE INDEX "schedules_client_id_week_start_date_idx" ON "schedules"("client_id", "week_start_date");
CREATE INDEX "schedules_status_idx" ON "schedules"("status");

-- CreateTable: schedule_items
CREATE TABLE "schedule_items" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "planned_publish_at" TIMESTAMP(3) NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "schedule_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "schedule_items_day_of_week_chk" CHECK ("day_of_week" BETWEEN 1 AND 7)
);
CREATE UNIQUE INDEX "schedule_items_schedule_id_video_id_key" ON "schedule_items"("schedule_id", "video_id");
CREATE INDEX "schedule_items_schedule_id_day_of_week_idx" ON "schedule_items"("schedule_id", "day_of_week");
CREATE INDEX "schedule_items_planned_publish_at_idx" ON "schedule_items"("planned_publish_at");

-- CreateTable: approvals
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "feedback_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "approvals_video_id_created_at_idx" ON "approvals"("video_id", "created_at");

-- CreateTable: video_comments
CREATE TABLE "video_comments" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "video_comments_video_id_created_at_idx" ON "video_comments"("video_id", "created_at");

-- CreateTable: publications
CREATE TABLE "publications" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "status" "PublicationStatus" NOT NULL DEFAULT 'PENDING',
    "bull_job_id" VARCHAR(120),
    "external_post_id" VARCHAR(180),
    "external_post_url" VARCHAR(500),
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "publications_video_id_platform_key" ON "publications"("video_id", "platform");
CREATE INDEX "publications_status_scheduled_for_idx" ON "publications"("status", "scheduled_for");
CREATE INDEX "publications_platform_status_idx" ON "publications"("platform", "status");

-- CreateTable: publication_attempts
CREATE TABLE "publication_attempts" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "is_success" BOOLEAN NOT NULL,
    "error_code" VARCHAR(80),
    "error_detail" TEXT,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publication_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "publication_attempts_number_chk" CHECK ("attempt_number" >= 1)
);
CREATE UNIQUE INDEX "publication_attempts_publication_id_attempt_number_key" ON "publication_attempts"("publication_id", "attempt_number");
CREATE INDEX "publication_attempts_publication_id_idx" ON "publication_attempts"("publication_id");

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "reference_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(80),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- Foreign Keys
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_auth_accounts" ADD CONSTRAINT "social_auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "videos" ADD CONSTRAINT "videos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "videos" ADD CONSTRAINT "videos_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "video_hashtags" ADD CONSTRAINT "video_hashtags_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_platform_targets" ADD CONSTRAINT "video_platform_targets_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "publications" ADD CONSTRAINT "publications_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_attempts" ADD CONSTRAINT "publication_attempts_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
