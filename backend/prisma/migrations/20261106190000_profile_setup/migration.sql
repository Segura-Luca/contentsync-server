-- Las cuentas creadas con Google, Facebook o GitHub completan sus datos una sola vez al entrar.
ALTER TABLE `users`
    ADD COLUMN `needs_profile_setup` BOOLEAN NOT NULL DEFAULT false;

-- Las que ya se crearon así, sin contraseña y con el nombre automático de agencia, todavía no los completaron.
UPDATE `users` AS u
INNER JOIN `agencies` AS a ON a.`owner_user_id` = u.`id`
INNER JOIN `social_auth_accounts` AS s ON s.`user_id` = u.`id`
SET u.`needs_profile_setup` = true
WHERE u.`password_hash` IS NULL AND a.`name` LIKE 'Agencia de %';
