ALTER TABLE `sub_categories`
  ADD COLUMN `monthly_cap` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `name`;

UPDATE `sub_categories` SET `monthly_cap` = 15000.00 WHERE `id` IN (1, 2);
UPDATE `sub_categories` SET `monthly_cap` = 10000.00 WHERE `id` = 3;
UPDATE `sub_categories` SET `monthly_cap` = 20000.00 WHERE `id` = 4;
UPDATE `sub_categories` SET `monthly_cap` = 10000.00 WHERE `id` = 5;
UPDATE `sub_categories` SET `monthly_cap` = 30000.00 WHERE `id` = 6;
