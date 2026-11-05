-- ContentSync: esquema base MySQL 8+ (3FN).
-- Reemplaza a la migración original escrita para PostgreSQL, que nunca pudo ejecutarse en MySQL.
-- Las bases MySQL existentes deben marcarla como aplicada: ver docs/deployment-guide.md

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(36) NOT NULL,
    `code` ENUM('ADMIN_GENERAL', 'AGENCIA', 'CLIENTE') NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `timezone` VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `verification_token` VARCHAR(128) NULL,
    `password_reset_token` VARCHAR(128) NULL,
    `password_reset_expires` DATETIME(3) NULL,
    `fcm_token` VARCHAR(512) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_role_id_idx`(`role_id`),
    INDEX `users_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token_family` VARCHAR(36) NOT NULL,
    `refresh_token_hash` VARCHAR(255) NOT NULL,
    `device_info` VARCHAR(255) NULL,
    `ip_address` VARCHAR(64) NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `rotated_at` DATETIME(3) NULL,

    INDEX `auth_sessions_user_id_idx`(`user_id`),
    INDEX `auth_sessions_token_family_idx`(`token_family`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_auth_accounts` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `provider` ENUM('GOOGLE', 'FACEBOOK', 'GITHUB') NOT NULL,
    `provider_user_id` VARCHAR(180) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_auth_accounts_user_id_idx`(`user_id`),
    INDEX `social_auth_accounts_email_idx`(`email`),
    UNIQUE INDEX `social_auth_accounts_provider_provider_user_id_key`(`provider`, `provider_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agencies` (
    `id` VARCHAR(36) NOT NULL,
    `owner_user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `tax_id` VARCHAR(40) NOT NULL,
    `contact_phone` VARCHAR(40) NULL,
    `website` VARCHAR(255) NULL,
    `is_suspended` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `agencies_owner_user_id_key`(`owner_user_id`),
    UNIQUE INDEX `agencies_tax_id_key`(`tax_id`),
    INDEX `agencies_is_suspended_idx`(`is_suspended`),
    INDEX `agencies_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(36) NOT NULL,
    `agency_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `company_name` VARCHAR(150) NOT NULL,
    `industry` VARCHAR(100) NULL,
    `confirmation_status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'CONFIRMED',
    `confirmation_token` VARCHAR(128) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `invited_by_user_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `clients_user_id_key`(`user_id`),
    UNIQUE INDEX `clients_confirmation_token_key`(`confirmation_token`),
    INDEX `clients_agency_id_idx`(`agency_id`),
    INDEX `clients_confirmation_status_idx`(`confirmation_status`),
    INDEX `clients_is_active_idx`(`is_active`),
    INDEX `clients_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_connections` (
    `id` VARCHAR(36) NOT NULL,
    `client_id` VARCHAR(36) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'TIKTOK', 'YOUTUBE') NOT NULL,
    `external_account_id` VARCHAR(180) NOT NULL,
    `account_handle` VARCHAR(120) NOT NULL,
    `encrypted_access_token` TEXT NOT NULL,
    `encrypted_refresh_token` TEXT NULL,
    `token_expires_at` DATETIME(3) NULL,
    `scopes` VARCHAR(500) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `platform_connections_client_id_idx`(`client_id`),
    INDEX `platform_connections_status_idx`(`status`),
    UNIQUE INDEX `platform_connections_client_id_platform_key`(`client_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `videos` (
    `id` VARCHAR(36) NOT NULL,
    `client_id` VARCHAR(36) NOT NULL,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `thumbnail_key` VARCHAR(500) NULL,
    `duration_seconds` INTEGER NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `mime_type` VARCHAR(60) NOT NULL DEFAULT 'video/mp4',
    `aspect_ratio` VARCHAR(16) NOT NULL DEFAULT '9:16',
    `workflow_status` ENUM('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `videos_client_id_workflow_status_idx`(`client_id`, `workflow_status`),
    INDEX `videos_created_at_idx`(`created_at`),
    INDEX `videos_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_hashtags` (
    `id` VARCHAR(36) NOT NULL,
    `video_id` VARCHAR(36) NOT NULL,
    `tag` VARCHAR(80) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `video_hashtags_tag_idx`(`tag`),
    UNIQUE INDEX `video_hashtags_video_id_tag_key`(`video_id`, `tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_platform_targets` (
    `id` VARCHAR(36) NOT NULL,
    `video_id` VARCHAR(36) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'TIKTOK', 'YOUTUBE') NOT NULL,
    `custom_title` VARCHAR(150) NULL,
    `custom_description` TEXT NULL,
    `privacy_level` ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `share_to_feed` BOOLEAN NOT NULL DEFAULT true,
    `allow_comments` BOOLEAN NOT NULL DEFAULT true,
    `allow_duet_stitch` BOOLEAN NOT NULL DEFAULT true,
    `made_for_kids` BOOLEAN NOT NULL DEFAULT false,
    `category_id` VARCHAR(20) NULL DEFAULT '22',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `video_platform_targets_video_id_idx`(`video_id`),
    UNIQUE INDEX `video_platform_targets_video_id_platform_key`(`video_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` VARCHAR(36) NOT NULL,
    `client_id` VARCHAR(36) NOT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `duplicated_from_id` VARCHAR(36) NULL,
    `week_start_date` DATE NOT NULL,
    `week_end_date` DATE NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `summary_notes` TEXT NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'COMPLETED') NOT NULL DEFAULT 'IN_REVIEW',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `schedules_client_id_week_start_date_idx`(`client_id`, `week_start_date`),
    INDEX `schedules_status_idx`(`status`),
    UNIQUE INDEX `schedules_client_id_week_start_date_key`(`client_id`, `week_start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_items` (
    `id` VARCHAR(36) NOT NULL,
    `schedule_id` VARCHAR(36) NOT NULL,
    `video_id` VARCHAR(36) NULL,
    `day_of_week` INTEGER NOT NULL,
    `block_title` VARCHAR(160) NOT NULL DEFAULT 'Bloque de contenido',
    `note_color` VARCHAR(30) NOT NULL DEFAULT 'AMBER',
    `notes` TEXT NULL,
    `planned_time` VARCHAR(10) NOT NULL DEFAULT '18:00',
    `planned_publish_at` DATETIME(3) NULL,
    `auto_publish` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `schedule_items_schedule_id_day_of_week_sort_order_idx`(`schedule_id`, `day_of_week`, `sort_order`),
    INDEX `schedule_items_video_id_idx`(`video_id`),
    INDEX `schedule_items_planned_publish_at_idx`(`planned_publish_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_duplication_logs` (
    `id` VARCHAR(36) NOT NULL,
    `agency_id` VARCHAR(36) NOT NULL,
    `client_id` VARCHAR(36) NOT NULL,
    `source_schedule_id` VARCHAR(36) NOT NULL,
    `target_schedule_id` VARCHAR(36) NOT NULL,
    `duplicated_by_user_id` VARCHAR(36) NOT NULL,
    `blocks_copied_count` INTEGER NOT NULL,
    `include_videos` BOOLEAN NOT NULL DEFAULT false,
    `notes` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `schedule_duplication_logs_agency_id_created_at_idx`(`agency_id`, `created_at`),
    INDEX `schedule_duplication_logs_client_id_created_at_idx`(`client_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_idea_sections` (
    `id` VARCHAR(36) NOT NULL,
    `agency_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(30) NOT NULL DEFAULT 'LIME',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `content_idea_sections_agency_id_sort_order_idx`(`agency_id`, `sort_order`),
    UNIQUE INDEX `content_idea_sections_agency_id_name_key`(`agency_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_ideas` (
    `id` VARCHAR(36) NOT NULL,
    `agency_id` VARCHAR(36) NOT NULL,
    `section_id` VARCHAR(36) NOT NULL,
    `client_id` VARCHAR(36) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `content` TEXT NOT NULL,
    `reference_url` VARCHAR(500) NULL,
    `platforms` VARCHAR(120) NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `content_ideas_agency_id_section_id_idx`(`agency_id`, `section_id`),
    INDEX `content_ideas_agency_id_client_id_idx`(`agency_id`, `client_id`),
    INDEX `content_ideas_is_pinned_created_at_idx`(`is_pinned`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approvals` (
    `id` VARCHAR(36) NOT NULL,
    `video_id` VARCHAR(36) NOT NULL,
    `reviewer_user_id` VARCHAR(36) NOT NULL,
    `decision` ENUM('APPROVED', 'CHANGES_REQUESTED', 'REJECTED') NOT NULL,
    `feedback_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `approvals_video_id_created_at_idx`(`video_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_comments` (
    `id` VARCHAR(36) NOT NULL,
    `video_id` VARCHAR(36) NOT NULL,
    `author_user_id` VARCHAR(36) NOT NULL,
    `message` TEXT NOT NULL,
    `timestamp_sec` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `video_comments_video_id_created_at_idx`(`video_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publications` (
    `id` VARCHAR(36) NOT NULL,
    `video_id` VARCHAR(36) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'TIKTOK', 'YOUTUBE') NOT NULL,
    `scheduled_for` DATETIME(3) NOT NULL,
    `published_at` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `bull_job_id` VARCHAR(120) NULL,
    `external_post_id` VARCHAR(180) NULL,
    `external_post_url` VARCHAR(500) NULL,
    `last_error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `publications_status_scheduled_for_idx`(`status`, `scheduled_for`),
    INDEX `publications_platform_status_idx`(`platform`, `status`),
    UNIQUE INDEX `publications_video_id_platform_key`(`video_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publication_attempts` (
    `id` VARCHAR(36) NOT NULL,
    `publication_id` VARCHAR(36) NOT NULL,
    `attempt_number` INTEGER NOT NULL,
    `is_success` BOOLEAN NOT NULL,
    `error_code` VARCHAR(80) NULL,
    `error_detail` TEXT NULL,
    `duration_ms` INTEGER NOT NULL DEFAULT 0,
    `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `publication_attempts_publication_id_idx`(`publication_id`),
    UNIQUE INDEX `publication_attempts_publication_id_attempt_number_key`(`publication_id`, `attempt_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` ENUM('NEW_SCHEDULE', 'VIDEO_IN_REVIEW', 'VIDEO_APPROVED', 'VIDEO_CHANGES_REQUESTED', 'VIDEO_REJECTED', 'PUBLICATION_SUCCESS', 'PUBLICATION_FAILED', 'CLIENT_CONFIRMATION_REQUEST', 'CLIENT_CONFIRMATION_RESPONSE', 'SCHEDULE_DUPLICATED') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `body` TEXT NOT NULL,
    `reference_id` VARCHAR(36) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_is_read_created_at_idx`(`user_id`, `is_read`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `action` VARCHAR(120) NOT NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` VARCHAR(80) NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` VARCHAR(255) NULL,
    `metadata` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_auth_accounts` ADD CONSTRAINT `social_auth_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agencies` ADD CONSTRAINT `agencies_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_connections` ADD CONSTRAINT `platform_connections_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `videos` ADD CONSTRAINT `videos_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `videos` ADD CONSTRAINT `videos_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_hashtags` ADD CONSTRAINT `video_hashtags_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_platform_targets` ADD CONSTRAINT `video_platform_targets_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_duplicated_from_id_fkey` FOREIGN KEY (`duplicated_from_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_items` ADD CONSTRAINT `schedule_items_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_items` ADD CONSTRAINT `schedule_items_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_duplication_logs` ADD CONSTRAINT `schedule_duplication_logs_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_duplication_logs` ADD CONSTRAINT `schedule_duplication_logs_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_duplication_logs` ADD CONSTRAINT `schedule_duplication_logs_source_schedule_id_fkey` FOREIGN KEY (`source_schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_duplication_logs` ADD CONSTRAINT `schedule_duplication_logs_target_schedule_id_fkey` FOREIGN KEY (`target_schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_duplication_logs` ADD CONSTRAINT `schedule_duplication_logs_duplicated_by_user_id_fkey` FOREIGN KEY (`duplicated_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_idea_sections` ADD CONSTRAINT `content_idea_sections_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_ideas` ADD CONSTRAINT `content_ideas_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_ideas` ADD CONSTRAINT `content_ideas_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `content_idea_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_ideas` ADD CONSTRAINT `content_ideas_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_ideas` ADD CONSTRAINT `content_ideas_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_reviewer_user_id_fkey` FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_comments` ADD CONSTRAINT `video_comments_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_comments` ADD CONSTRAINT `video_comments_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publications` ADD CONSTRAINT `publications_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publication_attempts` ADD CONSTRAINT `publication_attempts_publication_id_fkey` FOREIGN KEY (`publication_id`) REFERENCES `publications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

