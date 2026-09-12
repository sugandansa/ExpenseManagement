-- AlterTable
ALTER TABLE `users` ADD COLUMN `email` VARCHAR(160) NULL;

-- AlterTable
ALTER TABLE `role_caps` ADD COLUMN `description` VARCHAR(255) NULL;
