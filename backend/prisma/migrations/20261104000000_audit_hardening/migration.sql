-- Endurecimiento de la auditoría: caducidad e intentos de OTP, caducidad de invitaciones,
-- configuración editable y restricciones CHECK que existían solo en la migración PostgreSQL.
-- Los códigos OTP pasan a guardarse como HMAC: los pendientes en texto plano se invalidan.

-- AlterTable
ALTER TABLE `users` ADD COLUMN `otp_failed_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `verification_expires` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `clients` ADD COLUMN `confirmation_expires_at` DATETIME(3) NULL;

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
ALTER TABLE `app_settings` ADD CONSTRAINT `app_settings_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Invalidar códigos de un solo uso en texto plano (ahora se guardan como HMAC).
UPDATE `users` SET `password_reset_token` = NULL, `password_reset_expires` = NULL WHERE `password_reset_token` IS NOT NULL;
UPDATE `users` SET `verification_token` = NULL WHERE `verification_token` IS NOT NULL;

-- Las invitaciones pendientes vencen 7 días después de esta migración.
UPDATE `clients` SET `confirmation_expires_at` = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 7 DAY)
WHERE `confirmation_token` IS NOT NULL AND `confirmation_status` = 'PENDING';

-- Restricciones CHECK (MySQL 8.0.16+).
ALTER TABLE `videos`
  ADD CONSTRAINT `videos_duration_positive_chk` CHECK (`duration_seconds` > 0),
  ADD CONSTRAINT `videos_size_positive_chk` CHECK (`size_bytes` > 0);
ALTER TABLE `schedules`
  ADD CONSTRAINT `schedules_dates_chk` CHECK (`week_end_date` >= `week_start_date`);
ALTER TABLE `schedule_items`
  ADD CONSTRAINT `schedule_items_day_of_week_chk` CHECK (`day_of_week` BETWEEN 1 AND 7);
ALTER TABLE `publication_attempts`
  ADD CONSTRAINT `publication_attempts_number_chk` CHECK (`attempt_number` >= 1);
