USE `ExpenseManagement`;

ALTER TABLE `users`
  ADD COLUMN `password_hash` VARCHAR(120) NULL AFTER `monthly_budget`;

ALTER TABLE `categories`
  ADD COLUMN `monthly_cap` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `icon_category`,
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER `created_at`;

ALTER TABLE `expense_claims`
  ADD COLUMN `approved_at` DATETIME(3) NULL AFTER `over_budget_amount`,
  ADD COLUMN `approval_comment` VARCHAR(500) NULL AFTER `approved_at`,
  ADD COLUMN `settlement_id` INT NULL AFTER `approval_comment`,
  ADD KEY `expense_claims_settlement_id_idx` (`settlement_id`);

CREATE TABLE IF NOT EXISTS `role_caps` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role` VARCHAR(80) NOT NULL,
  `monthly_cap` DECIMAL(12,2) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_caps_role_key` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wallet_ledger` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `type` VARCHAR(16) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `claim_id` INT NULL,
  `settlement_id` INT NULL,
  `note` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `wallet_ledger_user_id_created_at_idx` (`user_id`, `created_at`),
  KEY `wallet_ledger_claim_id_fkey` (`claim_id`),
  KEY `wallet_ledger_settlement_id_fkey` (`settlement_id`),
  CONSTRAINT `wallet_ledger_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `wallet_ledger_claim_id_fkey` FOREIGN KEY (`claim_id`) REFERENCES `expense_claims` (`id`),
  CONSTRAINT `wallet_ledger_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `wallet_settlements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `expense_claims`
  ADD CONSTRAINT `expense_claims_settlement_id_fkey`
  FOREIGN KEY (`settlement_id`) REFERENCES `wallet_settlements` (`id`);

UPDATE `categories` SET `monthly_cap` = 40000.00 WHERE `id` = 1;
UPDATE `categories` SET `monthly_cap` = 30000.00 WHERE `id` = 2;
UPDATE `categories` SET `monthly_cap` = 30000.00 WHERE `id` = 3;

INSERT INTO `role_caps` (`role`, `monthly_cap`, `is_active`)
VALUES ('Housekeeping', 15000.00, 1)
ON DUPLICATE KEY UPDATE `monthly_cap` = VALUES(`monthly_cap`);
