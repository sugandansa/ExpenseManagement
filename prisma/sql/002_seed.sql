USE `ExpenseManagement`;

INSERT INTO `users` (`id`, `name`, `phone`, `role`, `department`, `monthly_budget`, `is_active`)
VALUES (101, 'Rajesh', '9876543210', 'employee', 'Housekeeping', 5000.00, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `wallets` (`user_id`, `balance`)
VALUES (101, 2500.00)
ON DUPLICATE KEY UPDATE `balance` = VALUES(`balance`);

INSERT INTO `categories` (`id`, `name`, `icon_category`, `is_active`) VALUES
  (1, 'Travel', 'travel', 1),
  (2, 'Food', 'food', 1),
  (3, 'Office', 'office', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `sub_categories` (`id`, `category_id`, `name`, `is_active`) VALUES
  (1, 1, 'Taxi', 1),
  (2, 1, 'Fuel', 1),
  (3, 1, 'Lodging', 1),
  (4, 2, 'Meals', 1),
  (5, 2, 'Snacks', 1),
  (6, 3, 'Stationery', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `app_settings` (`setting_key`, `setting_value`) VALUES
  ('force_update_android', '1'),
  ('app_update_android', '1'),
  ('force_update_ios', '1.0.0'),
  ('app_update_ios', '1.0.0'),
  ('min_app_version', '1.0.0'),
  ('update_url', 'https://play.google.com/store/apps/details?id=in.schoollift.expense'),
  ('app_version', '2.0.0')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
