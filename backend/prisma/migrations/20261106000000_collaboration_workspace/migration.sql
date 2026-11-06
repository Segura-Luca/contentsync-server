-- ContentSync deja de publicar en redes: pasa a ser un espacio de trabajo entre agencias y clientes.
-- El bloque del cronograma es ahora la unidad de revisión, con tipo de contenido y varias fotos o videos.
-- Primero se copia lo que sigue teniendo sentido y recién al final se elimina lo relacionado con publicar.

-- 1. Bloques
ALTER TABLE `schedule_items`
    ADD COLUMN `content_type` ENUM('REEL', 'CAROUSEL', 'STORY', 'POST', 'VIDEO', 'OTHER') NOT NULL DEFAULT 'OTHER',
    ADD COLUMN `caption` TEXT NULL,
    ADD COLUMN `review_status` ENUM('IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED') NOT NULL DEFAULT 'IN_REVIEW';

-- 2. Fotos y videos de cada bloque
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

ALTER TABLE `schedule_item_media` ADD CONSTRAINT `schedule_item_media_schedule_item_id_fkey` FOREIGN KEY (`schedule_item_id`) REFERENCES `schedule_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Revisiones y comentarios por bloque
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

ALTER TABLE `block_reviews` ADD CONSTRAINT `block_reviews_schedule_item_id_fkey` FOREIGN KEY (`schedule_item_id`) REFERENCES `schedule_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `block_reviews` ADD CONSTRAINT `block_reviews_reviewer_user_id_fkey` FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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

ALTER TABLE `block_comments` ADD CONSTRAINT `block_comments_schedule_item_id_fkey` FOREIGN KEY (`schedule_item_id`) REFERENCES `schedule_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `block_comments` ADD CONSTRAINT `block_comments_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Confirmación del cronograma por parte del cliente
ALTER TABLE `schedules`
    ADD COLUMN `confirmed_at` DATETIME(3) NULL,
    ADD COLUMN `confirmed_by_user_id` VARCHAR(36) NULL;

CREATE INDEX `schedules_confirmed_by_user_id_idx` ON `schedules`(`confirmed_by_user_id`);
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_confirmed_by_user_id_fkey` FOREIGN KEY (`confirmed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Copiar los datos de los videos a sus bloques. Un video suelto, sin bloque, no tiene dónde quedar.
INSERT INTO `schedule_item_media` (`id`, `schedule_item_id`, `kind`, `storage_key`, `mime_type`, `size_bytes`, `description`, `position`, `created_at`)
SELECT UUID(), si.`id`, 'VIDEO', v.`storage_key`, v.`mime_type`, v.`size_bytes`, v.`description`, 0, v.`created_at`
FROM `schedule_items` si
JOIN `videos` v ON v.`id` = si.`video_id` AND v.`deleted_at` IS NULL;

UPDATE `schedule_items` si
JOIN `videos` v ON v.`id` = si.`video_id`
SET si.`content_type` = 'REEL',
    si.`caption` = v.`description`,
    si.`review_status` = CASE v.`workflow_status`
        WHEN 'CHANGES_REQUESTED' THEN 'CHANGES_REQUESTED'
        WHEN 'REJECTED' THEN 'REJECTED'
        WHEN 'APPROVED' THEN 'APPROVED'
        WHEN 'SCHEDULED' THEN 'APPROVED'
        WHEN 'PUBLISHED' THEN 'APPROVED'
        ELSE 'IN_REVIEW'
    END;

INSERT INTO `block_reviews` (`id`, `schedule_item_id`, `reviewer_user_id`, `decision`, `feedback_notes`, `created_at`)
SELECT UUID(), si.`id`, a.`reviewer_user_id`, a.`decision`, a.`feedback_notes`, a.`created_at`
FROM `approvals` a
JOIN `schedule_items` si ON si.`video_id` = a.`video_id`;

INSERT INTO `block_comments` (`id`, `schedule_item_id`, `author_user_id`, `message`, `created_at`)
SELECT UUID(), si.`id`, c.`author_user_id`, c.`message`, c.`created_at`
FROM `video_comments` c
JOIN `schedule_items` si ON si.`video_id` = c.`video_id`;

-- 6. Avisos: tipos nuevos. Se reemplaza la columna porque modificar un ENUM no se comporta igual en todos los motores.
DELETE FROM `notifications` WHERE `type` IN ('PUBLICATION_SUCCESS', 'PUBLICATION_FAILED');

ALTER TABLE `notifications`
    ADD COLUMN `type_new` ENUM('NEW_SCHEDULE', 'SCHEDULE_DUPLICATED', 'SCHEDULE_CONFIRMED', 'BLOCK_IN_REVIEW', 'BLOCK_APPROVED', 'BLOCK_CHANGES_REQUESTED', 'BLOCK_REJECTED', 'BLOCK_COMMENT', 'CLIENT_CONFIRMATION_REQUEST', 'CLIENT_CONFIRMATION_RESPONSE') NOT NULL DEFAULT 'NEW_SCHEDULE';

UPDATE `notifications`
SET `type_new` = CASE `type`
    WHEN 'NEW_SCHEDULE' THEN 'NEW_SCHEDULE'
    WHEN 'SCHEDULE_DUPLICATED' THEN 'SCHEDULE_DUPLICATED'
    WHEN 'VIDEO_IN_REVIEW' THEN 'BLOCK_IN_REVIEW'
    WHEN 'VIDEO_APPROVED' THEN 'BLOCK_APPROVED'
    WHEN 'VIDEO_CHANGES_REQUESTED' THEN 'BLOCK_CHANGES_REQUESTED'
    WHEN 'VIDEO_REJECTED' THEN 'BLOCK_REJECTED'
    WHEN 'CLIENT_CONFIRMATION_REQUEST' THEN 'CLIENT_CONFIRMATION_REQUEST'
    WHEN 'CLIENT_CONFIRMATION_RESPONSE' THEN 'CLIENT_CONFIRMATION_RESPONSE'
    ELSE 'NEW_SCHEDULE'
END;

ALTER TABLE `notifications` DROP COLUMN `type`;
ALTER TABLE `notifications` RENAME COLUMN `type_new` TO `type`;
ALTER TABLE `notifications` ALTER COLUMN `type` DROP DEFAULT;

-- 7. Ajustes guardados que ya no existen
DELETE FROM `app_settings` WHERE `key` IN ('requireClientApproval', 'publishMaxAttempts', 'publishRetryDelaySeconds', 'platformLimits');

-- 8. Quitar lo relacionado con publicar. Las tablas hijas van antes que las que referencian.
DROP TABLE IF EXISTS `publication_attempts`;
DROP TABLE IF EXISTS `publications`;
DROP TABLE IF EXISTS `video_platform_targets`;
DROP TABLE IF EXISTS `video_hashtags`;
DROP TABLE IF EXISTS `video_comments`;
DROP TABLE IF EXISTS `approvals`;
DROP TABLE IF EXISTS `platform_connections`;

-- La base de producción se creó con `db push`: se comprueba que la relación exista antes de quitarla.
SET @has_video_fk := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_items' AND CONSTRAINT_NAME = 'schedule_items_video_id_fkey'
);
SET @drop_video_fk := IF(@has_video_fk > 0, 'ALTER TABLE `schedule_items` DROP FOREIGN KEY `schedule_items_video_id_fkey`', 'SELECT 1');
PREPARE drop_video_fk_stmt FROM @drop_video_fk;
EXECUTE drop_video_fk_stmt;
DEALLOCATE PREPARE drop_video_fk_stmt;

DROP INDEX `schedule_items_video_id_idx` ON `schedule_items`;
DROP INDEX `schedule_items_planned_publish_at_idx` ON `schedule_items`;
ALTER TABLE `schedule_items` DROP COLUMN `video_id`;
ALTER TABLE `schedule_items` DROP COLUMN `planned_publish_at`;
ALTER TABLE `schedule_items` DROP COLUMN `auto_publish`;

DROP TABLE IF EXISTS `videos`;

ALTER TABLE `schedule_duplication_logs` RENAME COLUMN `include_videos` TO `include_media`;
ALTER TABLE `content_ideas` DROP COLUMN `platforms`;
