-- Partial settlement tracking on claims
ALTER TABLE `expense_claims`
  ADD COLUMN `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `over_budget_amount`;
