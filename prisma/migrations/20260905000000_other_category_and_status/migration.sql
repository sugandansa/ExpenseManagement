-- Allow "Other" claims without a catalog category/subcategory
ALTER TABLE `expense_claims`
  MODIFY `category_id` INT NULL,
  MODIFY `sub_category_id` INT NULL,
  ADD COLUMN `other_category` VARCHAR(120) NULL AFTER `note`;

-- Align claim status vocabulary with product: Pending / Flagged / Approved / Paid
UPDATE `expense_claims` SET `status` = 'pending' WHERE `status` IN ('tagged', 'submitted');
UPDATE `expense_claims` SET `status` = 'paid' WHERE `status` = 'settled';
UPDATE `claim_events` SET `status` = 'pending' WHERE `status` IN ('tagged', 'submitted');
UPDATE `claim_events` SET `status` = 'paid' WHERE `status` = 'settled';
