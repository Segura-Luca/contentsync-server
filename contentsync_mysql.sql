-- ContentSync: esquema MySQL 8+ y control de migraciones. Sin datos de usuarios.
-- Datos de demostracion: npm run prisma:seed (requiere SEED_DEFAULT_PASSWORD).
CREATE DATABASE IF NOT EXISTS `contentsync` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `contentsync`;

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
    `verification_expires` DATETIME(3) NULL,
    `password_reset_token` VARCHAR(128) NULL,
    `password_reset_expires` DATETIME(3) NULL,
    `otp_failed_attempts` INTEGER NOT NULL DEFAULT 0,
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
    `confirmation_expires_at` DATETIME(3) NULL,
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
    `confirmed_at` DATETIME(3) NULL,
    `confirmed_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `schedules_client_id_week_start_date_idx`(`client_id`, `week_start_date`),
    INDEX `schedules_status_idx`(`status`),
    INDEX `schedules_confirmed_by_user_id_idx`(`confirmed_by_user_id`),
    UNIQUE INDEX `schedules_client_id_week_start_date_key`(`client_id`, `week_start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_items` (
    `id` VARCHAR(36) NOT NULL,
    `schedule_id` VARCHAR(36) NOT NULL,
    `day_of_week` INTEGER NOT NULL,
    `content_type` ENUM('REEL', 'CAROUSEL', 'STORY', 'POST', 'VIDEO', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `block_title` VARCHAR(160) NOT NULL DEFAULT 'Bloque de contenido',
    `note_color` VARCHAR(30) NOT NULL DEFAULT 'AMBER',
    `notes` TEXT NULL,
    `caption` TEXT NULL,
    `planned_time` VARCHAR(10) NOT NULL DEFAULT '18:00',
    `review_status` ENUM('IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED') NOT NULL DEFAULT 'IN_REVIEW',
    `production_status` ENUM('PENDING', 'RECORDED', 'EDITED', 'UPLOADED') NOT NULL DEFAULT 'PENDING',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `schedule_items_schedule_id_day_of_week_sort_order_idx`(`schedule_id`, `day_of_week`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_item_media` (
    `id` VARCHAR(36) NOT NULL,
    `schedule_item_id` VARCHAR(36) NOT NULL,
    `kind` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(60) NOT NULL,
    `size_bytes` BIGINT NOT NULL DEFAULT 0,
    `original_name` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `schedule_item_media_schedule_item_id_position_idx`(`schedule_item_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `block_reviews` (
    `id` VARCHAR(36) NOT NULL,
    `schedule_item_id` VARCHAR(36) NOT NULL,
    `reviewer_user_id` VARCHAR(36) NOT NULL,
    `decision` ENUM('APPROVED', 'CHANGES_REQUESTED', 'REJECTED') NOT NULL,
    `feedback_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `block_reviews_schedule_item_id_created_at_idx`(`schedule_item_id`, `created_at`),
    INDEX `block_reviews_reviewer_user_id_idx`(`reviewer_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `block_comments` (
    `id` VARCHAR(36) NOT NULL,
    `schedule_item_id` VARCHAR(36) NOT NULL,
    `author_user_id` VARCHAR(36) NOT NULL,
    `message` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `block_comments_schedule_item_id_created_at_idx`(`schedule_item_id`, `created_at`),
    INDEX `block_comments_author_user_id_idx`(`author_user_id`),
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
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `content_ideas_agency_id_section_id_idx`(`agency_id`, `section_id`),
    INDEX `content_ideas_agency_id_client_id_idx`(`agency_id`, `client_id`),
    INDEX `content_ideas_is_pinned_created_at_idx`(`is_pinned`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_idea_proposals` (
    `id` VARCHAR(36) NOT NULL,
    `agency_id` VARCHAR(36) NOT NULL,
    `client_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `content` TEXT NOT NULL,
    `reference_url` VARCHAR(500) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `responded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `client_idea_proposals_agency_id_status_idx`(`agency_id`, `status`),
    INDEX `client_idea_proposals_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` ENUM('NEW_SCHEDULE', 'SCHEDULE_DUPLICATED', 'SCHEDULE_CONFIRMED', 'BLOCK_IN_REVIEW', 'BLOCK_APPROVED', 'BLOCK_CHANGES_REQUESTED', 'BLOCK_REJECTED', 'BLOCK_COMMENT', 'CLIENT_CONFIRMATION_REQUEST', 'CLIENT_CONFIRMATION_RESPONSE', 'IDEA_PROPOSED', 'IDEA_ACCEPTED', 'IDEA_REJECTED') NOT NULL,
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

-- CreateTable
CREATE TABLE `app_settings` (
    `key` VARCHAR(80) NOT NULL,
    `value` TEXT NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `app_settings_updated_by_user_id_idx`(`updated_by_user_id`),
    PRIMARY KEY (`key`)
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
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_confirmed_by_user_id_fkey` FOREIGN KEY (`confirmed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_duplicated_from_id_fkey` FOREIGN KEY (`duplicated_from_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_items` ADD CONSTRAINT `schedule_items_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_item_media` ADD CONSTRAINT `schedule_item_media_schedule_item_id_fkey` FOREIGN KEY (`schedule_item_id`) REFERENCES `schedule_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `block_reviews` ADD CONSTRAINT `block_reviews_schedule_item_id_fkey` FOREIGN KEY (`schedule_item_id`) REFERENCES `schedule_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `block_reviews` ADD CONSTRAINT `block_reviews_reviewer_user_id_fkey` FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `block_comments` ADD CONSTRAINT `block_comments_schedule_item_id_fkey` FOREIGN KEY (`schedule_item_id`) REFERENCES `schedule_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `block_comments` ADD CONSTRAINT `block_comments_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE `client_idea_proposals` ADD CONSTRAINT `client_idea_proposals_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_idea_proposals` ADD CONSTRAINT `client_idea_proposals_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_settings` ADD CONSTRAINT `app_settings_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('801f0bde-3e9f-411f-9841-11cc3ad8b72e','2a1028f7426c71610d7f3b95cec8aca1591b14a16f9d5aa179b7287513bbd3ed',NOW(3),'20261022000000_init_3nf_schema',NULL,NULL,NOW(3),1),
('21a2991b-0637-469a-8fb2-5cc392d3deec','e8ba394ed446fcf1033b6b6f8ccb6559cc4804f752ad857dd09ba538fbb10ca1',NOW(3),'20261104000000_audit_hardening',NULL,NULL,NOW(3),1),
('526aaf80-3694-4c9f-ad82-5b255538ab6f','5357021936c2c607189ae30940d484384b4b9d0a4b0c21e9961f4348c34e1d67',NOW(3),'20261104010000_drop_bull_job_id',NULL,NULL,NOW(3),1),
('235fe371-ead1-44b1-a7dc-69e8cb0e5636','b2e611d26b0331ca193fbf42ca3e624c0e6399d49d8511e12b5ddb49cbc32073',NOW(3),'20261106000000_collaboration_workspace',NULL,NULL,NOW(3),1),
('fd14e615-28a7-4800-a457-d072f98231d7','b3ae151566a1c050394465b3efa02ed58ac4e1fa30a92a18d6d8ce1db2be158a',NOW(3),'20261106120000_week_status_and_cleanup',NULL,NULL,NOW(3),1),
('92c93f52-8c8d-4490-bda7-9172d65375ea','83814d3e868c3ca3f176a54617cfc99bccc1b5122d3bdc5881a66460fa8c887d',NOW(3),'20261106180000_client_idea_proposals',NULL,NULL,NOW(3),1);
