-- Store stable browser device ID and client-side fraud header data per user
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hmrc_device_id TEXT,
  ADD COLUMN IF NOT EXISTS hmrc_client_info JSONB;
