-- Las semanas pasan a ser de lunes a domingo.
UPDATE `schedules` SET `week_end_date` = DATE_ADD(`week_start_date`, INTERVAL 6 DAY);

-- Estado de producción de cada bloque: en qué etapa está el contenido.
ALTER TABLE `schedule_items`
    ADD COLUMN `production_status` ENUM('PENDING', 'RECORDED', 'EDITED', 'UPLOADED') NOT NULL DEFAULT 'PENDING';

-- Se quita el registro de semanas duplicadas. Duplicar una semana sigue funcionando.
DROP TABLE IF EXISTS `schedule_duplication_logs`;
