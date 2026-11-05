-- ContentSync: esquema MySQL 8+ y control de migraciones. Sin datos de usuarios.
-- Datos de demostracion: npm run prisma:seed (requiere SEED_DEFAULT_PASSWORD).
CREATE DATABASE IF NOT EXISTS `contentsync` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `contentsync`;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agencies` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tax_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_suspended` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `agencies_owner_user_id_key` (`owner_user_id`),
  UNIQUE KEY `agencies_tax_id_key` (`tax_id`),
  KEY `agencies_is_suspended_idx` (`is_suspended`),
  KEY `agencies_deleted_at_idx` (`deleted_at`),
  CONSTRAINT `agencies_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `app_settings_updated_by_user_id_idx` (`updated_by_user_id`),
  CONSTRAINT `app_settings_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approvals` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reviewer_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `decision` enum('APPROVED','CHANGES_REQUESTED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `feedback_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `approvals_video_id_created_at_idx` (`video_id`,`created_at`),
  KEY `approvals_reviewer_user_id_fkey` (`reviewer_user_id`),
  CONSTRAINT `approvals_reviewer_user_id_fkey` FOREIGN KEY (`reviewer_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `approvals_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_created_at_idx` (`user_id`,`created_at`),
  KEY `audit_logs_entity_type_entity_id_idx` (`entity_type`,`entity_id`),
  CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_sessions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_family` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `refresh_token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_revoked` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rotated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `auth_sessions_user_id_idx` (`user_id`),
  KEY `auth_sessions_token_family_idx` (`token_family`),
  CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agency_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmation_status` enum('PENDING','CONFIRMED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CONFIRMED',
  `confirmation_token` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_at` datetime(3) DEFAULT NULL,
  `invited_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  `confirmation_expires_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clients_user_id_key` (`user_id`),
  UNIQUE KEY `clients_confirmation_token_key` (`confirmation_token`),
  KEY `clients_agency_id_idx` (`agency_id`),
  KEY `clients_confirmation_status_idx` (`confirmation_status`),
  KEY `clients_is_active_idx` (`is_active`),
  KEY `clients_deleted_at_idx` (`deleted_at`),
  CONSTRAINT `clients_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `clients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_idea_sections` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agency_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LIME',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `content_idea_sections_agency_id_name_key` (`agency_id`,`name`),
  KEY `content_idea_sections_agency_id_sort_order_idx` (`agency_id`,`sort_order`),
  CONSTRAINT `content_idea_sections_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_ideas` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agency_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `section_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platforms` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `content_ideas_agency_id_section_id_idx` (`agency_id`,`section_id`),
  KEY `content_ideas_agency_id_client_id_idx` (`agency_id`,`client_id`),
  KEY `content_ideas_is_pinned_created_at_idx` (`is_pinned`,`created_at`),
  KEY `content_ideas_section_id_fkey` (`section_id`),
  KEY `content_ideas_client_id_fkey` (`client_id`),
  KEY `content_ideas_created_by_user_id_fkey` (`created_by_user_id`),
  CONSTRAINT `content_ideas_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `content_ideas_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `content_ideas_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `content_ideas_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `content_idea_sections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('NEW_SCHEDULE','VIDEO_IN_REVIEW','VIDEO_APPROVED','VIDEO_CHANGES_REQUESTED','VIDEO_REJECTED','PUBLICATION_SUCCESS','PUBLICATION_FAILED','CLIENT_CONFIRMATION_REQUEST','CLIENT_CONFIRMATION_RESPONSE','SCHEDULE_DUPLICATED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_is_read_created_at_idx` (`user_id`,`is_read`,`created_at`),
  CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_connections` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` enum('INSTAGRAM','TIKTOK','YOUTUBE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_account_id` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_handle` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `encrypted_access_token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `encrypted_refresh_token` text COLLATE utf8mb4_unicode_ci,
  `token_expires_at` datetime(3) DEFAULT NULL,
  `scopes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','EXPIRED','REVOKED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_connections_client_id_platform_key` (`client_id`,`platform`),
  KEY `platform_connections_client_id_idx` (`client_id`),
  KEY `platform_connections_status_idx` (`status`),
  CONSTRAINT `platform_connections_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `publication_attempts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `publication_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempt_number` int NOT NULL,
  `is_success` tinyint(1) NOT NULL,
  `error_code` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_detail` text COLLATE utf8mb4_unicode_ci,
  `duration_ms` int NOT NULL DEFAULT '0',
  `attempted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `publication_attempts_publication_id_attempt_number_key` (`publication_id`,`attempt_number`),
  KEY `publication_attempts_publication_id_idx` (`publication_id`),
  CONSTRAINT `publication_attempts_publication_id_fkey` FOREIGN KEY (`publication_id`) REFERENCES `publications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `publication_attempts_number_chk` CHECK ((`attempt_number` >= 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `publications` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` enum('INSTAGRAM','TIKTOK','YOUTUBE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduled_for` datetime(3) NOT NULL,
  `published_at` datetime(3) DEFAULT NULL,
  `status` enum('PENDING','PROCESSING','PUBLISHED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',  `external_post_id` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_post_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `publications_video_id_platform_key` (`video_id`,`platform`),
  KEY `publications_status_scheduled_for_idx` (`status`,`scheduled_for`),
  KEY `publications_platform_status_idx` (`platform`,`status`),
  CONSTRAINT `publications_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` enum('ADMIN_GENERAL','AGENCIA','CLIENTE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_duplication_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agency_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_schedule_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_schedule_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duplicated_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `blocks_copied_count` int NOT NULL,
  `include_videos` tinyint(1) NOT NULL DEFAULT '0',
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `schedule_duplication_logs_agency_id_created_at_idx` (`agency_id`,`created_at`),
  KEY `schedule_duplication_logs_client_id_created_at_idx` (`client_id`,`created_at`),
  KEY `schedule_duplication_logs_source_schedule_id_fkey` (`source_schedule_id`),
  KEY `schedule_duplication_logs_target_schedule_id_fkey` (`target_schedule_id`),
  KEY `schedule_duplication_logs_duplicated_by_user_id_fkey` (`duplicated_by_user_id`),
  CONSTRAINT `schedule_duplication_logs_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedule_duplication_logs_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedule_duplication_logs_duplicated_by_user_id_fkey` FOREIGN KEY (`duplicated_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `schedule_duplication_logs_source_schedule_id_fkey` FOREIGN KEY (`source_schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedule_duplication_logs_target_schedule_id_fkey` FOREIGN KEY (`target_schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_items` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `schedule_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `day_of_week` int NOT NULL,
  `block_title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Bloque de contenido',
  `note_color` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AMBER',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `planned_time` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '18:00',
  `planned_publish_at` datetime(3) DEFAULT NULL,
  `auto_publish` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `schedule_items_schedule_id_day_of_week_sort_order_idx` (`schedule_id`,`day_of_week`,`sort_order`),
  KEY `schedule_items_video_id_idx` (`video_id`),
  KEY `schedule_items_planned_publish_at_idx` (`planned_publish_at`),
  CONSTRAINT `schedule_items_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedule_items_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `schedule_items_day_of_week_chk` CHECK ((`day_of_week` between 1 and 7))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedules` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duplicated_from_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `week_start_date` date NOT NULL,
  `week_end_date` date NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary_notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('DRAFT','IN_REVIEW','APPROVED','COMPLETED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_REVIEW',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `schedules_client_id_week_start_date_key` (`client_id`,`week_start_date`),
  KEY `schedules_client_id_week_start_date_idx` (`client_id`,`week_start_date`),
  KEY `schedules_status_idx` (`status`),
  KEY `schedules_created_by_user_id_fkey` (`created_by_user_id`),
  KEY `schedules_duplicated_from_id_fkey` (`duplicated_from_id`),
  CONSTRAINT `schedules_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedules_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `schedules_duplicated_from_id_fkey` FOREIGN KEY (`duplicated_from_id`) REFERENCES `schedules` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `schedules_dates_chk` CHECK ((`week_end_date` >= `week_start_date`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `social_auth_accounts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` enum('GOOGLE','FACEBOOK','GITHUB') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_user_id` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `social_auth_accounts_provider_provider_user_id_key` (`provider`,`provider_user_id`),
  KEY `social_auth_accounts_user_id_idx` (`user_id`),
  KEY `social_auth_accounts_email_idx` (`email`),
  CONSTRAINT `social_auth_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verification_token` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_reset_token` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_reset_expires` datetime(3) DEFAULT NULL,
  `fcm_token` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  `otp_failed_attempts` int NOT NULL DEFAULT '0',
  `verification_expires` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_email_idx` (`email`),
  KEY `users_role_id_idx` (`role_id`),
  KEY `users_deleted_at_idx` (`deleted_at`),
  CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `video_comments` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp_sec` int DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `video_comments_video_id_created_at_idx` (`video_id`,`created_at`),
  KEY `video_comments_author_user_id_fkey` (`author_user_id`),
  CONSTRAINT `video_comments_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `video_comments_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `video_hashtags` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `video_hashtags_video_id_tag_key` (`video_id`,`tag`),
  KEY `video_hashtags_tag_idx` (`tag`),
  CONSTRAINT `video_hashtags_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `video_platform_targets` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` enum('INSTAGRAM','TIKTOK','YOUTUBE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `custom_title` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `custom_description` text COLLATE utf8mb4_unicode_ci,
  `privacy_level` enum('PUBLIC','UNLISTED','PRIVATE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PUBLIC',
  `share_to_feed` tinyint(1) NOT NULL DEFAULT '1',
  `allow_comments` tinyint(1) NOT NULL DEFAULT '1',
  `allow_duet_stitch` tinyint(1) NOT NULL DEFAULT '1',
  `made_for_kids` tinyint(1) NOT NULL DEFAULT '0',
  `category_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '22',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `video_platform_targets_video_id_platform_key` (`video_id`,`platform`),
  KEY `video_platform_targets_video_id_idx` (`video_id`),
  CONSTRAINT `video_platform_targets_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `videos` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_key` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `thumbnail_key` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duration_seconds` int NOT NULL,
  `size_bytes` bigint NOT NULL,
  `mime_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'video/mp4',
  `aspect_ratio` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '9:16',
  `workflow_status` enum('DRAFT','IN_REVIEW','CHANGES_REQUESTED','REJECTED','APPROVED','SCHEDULED','PUBLISHED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `videos_client_id_workflow_status_idx` (`client_id`,`workflow_status`),
  KEY `videos_created_at_idx` (`created_at`),
  KEY `videos_deleted_at_idx` (`deleted_at`),
  KEY `videos_uploaded_by_user_id_fkey` (`uploaded_by_user_id`),
  CONSTRAINT `videos_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `videos_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `videos_duration_positive_chk` CHECK ((`duration_seconds` > 0)),
  CONSTRAINT `videos_size_positive_chk` CHECK ((`size_bytes` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('3da8eab4-c2f2-4f44-9e09-a99992d22f76','2a1028f7426c71610d7f3b95cec8aca1591b14a16f9d5aa179b7287513bbd3ed','2026-11-04 08:34:16.280','20261022000000_init_3nf_schema',NULL,NULL,'2026-11-04 08:34:08.462',1),('73ff3413-12ad-41c8-8750-b6a08fbb9508','e8ba394ed446fcf1033b6b6f8ccb6559cc4804f752ad857dd09ba538fbb10ca1','2026-11-04 08:34:18.030','20261104000000_audit_hardening',NULL,NULL,'2026-11-04 08:34:16.285',1),('30c52830-bd0a-48c9-aa04-0b7d1c465c76','5357021936c2c607189ae30940d484384b4b9d0a4b0c21e9961f4348c34e1d67','2026-11-04 12:00:01.000','20261104010000_drop_bull_job_id',NULL,NULL,'2026-11-04 12:00:00.000',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

