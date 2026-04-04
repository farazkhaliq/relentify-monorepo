-- Migration 021: Add registered address and bank details to users
-- Needed for PDF documents and remittance advices

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS registered_address TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sort_code          VARCHAR(8),
  ADD COLUMN IF NOT EXISTS account_number     VARCHAR(10);
