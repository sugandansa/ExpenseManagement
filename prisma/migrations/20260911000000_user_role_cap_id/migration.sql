-- AlterTable (additive only; existing rows keep NULL role_cap_id)
ALTER TABLE `users` ADD COLUMN `role_cap_id` INT NULL;

-- CreateIndex
CREATE INDEX `users_role_cap_id_idx` ON `users`(`role_cap_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_cap_id_fkey` FOREIGN KEY (`role_cap_id`) REFERENCES `role_caps`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
