-- BullMQ se retiró: la columna ya no tiene uso.
ALTER TABLE `publications` DROP COLUMN `bull_job_id`;
