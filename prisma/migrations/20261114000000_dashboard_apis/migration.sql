ALTER TABLE `otp_requests` ADD COLUMN `purpose` VARCHAR(20) NOT NULL DEFAULT 'login';
ALTER TABLE `wallet_settlements` ADD COLUMN `notes` VARCHAR(500) NULL;

CREATE TABLE `password_resets` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `consumed_at` DATETIME(3) NULL,
  UNIQUE INDEX `password_resets_token_hash_key` (`token_hash`),
  INDEX `password_resets_user_id_idx` (`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `password_resets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `access_events` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `actor_id` INTEGER NOT NULL,
  `action` VARCHAR(20) NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `access_events_user_id_created_at_idx` (`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `push_subscriptions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `endpoint` VARCHAR(512) NOT NULL,
  `p256dh` VARCHAR(255) NOT NULL,
  `auth` VARCHAR(255) NOT NULL,
  UNIQUE INDEX `push_subscriptions_endpoint_key` (`endpoint`),
  INDEX `push_subscriptions_user_id_idx` (`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `push_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;