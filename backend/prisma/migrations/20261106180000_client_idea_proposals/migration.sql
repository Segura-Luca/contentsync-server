-- Ideas que los clientes le proponen a su agencia.
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

ALTER TABLE `client_idea_proposals`
    ADD CONSTRAINT `client_idea_proposals_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `client_idea_proposals`
    ADD CONSTRAINT `client_idea_proposals_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Avisos nuevos. Se usa una columna nueva, igual que en la migración anterior, porque funciona en MySQL y en TiDB.
ALTER TABLE `notifications`
    ADD COLUMN `type_new` ENUM('NEW_SCHEDULE', 'SCHEDULE_DUPLICATED', 'SCHEDULE_CONFIRMED', 'BLOCK_IN_REVIEW', 'BLOCK_APPROVED', 'BLOCK_CHANGES_REQUESTED', 'BLOCK_REJECTED', 'BLOCK_COMMENT', 'CLIENT_CONFIRMATION_REQUEST', 'CLIENT_CONFIRMATION_RESPONSE', 'IDEA_PROPOSED', 'IDEA_ACCEPTED', 'IDEA_REJECTED') NOT NULL DEFAULT 'NEW_SCHEDULE';

UPDATE `notifications` SET `type_new` = `type`;

ALTER TABLE `notifications` DROP COLUMN `type`;
ALTER TABLE `notifications` RENAME COLUMN `type_new` TO `type`;
ALTER TABLE `notifications` ALTER COLUMN `type` DROP DEFAULT;
