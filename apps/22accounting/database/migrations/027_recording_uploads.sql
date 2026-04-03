-- 027_recording_uploads.sql
-- Run: docker exec -i infra-postgres psql -U relentify_user -d relentify < database/migrations/027_recording_uploads.sql

CREATE TABLE IF NOT EXISTS acc_recording_uploads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  entity_id    UUID REFERENCES entities(id),
  filename     TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL,
  mime_type    TEXT NOT NULL DEFAULT 'video/webm',
  storage_key  TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_recording_uploads_user_id ON acc_recording_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_uploads_entity_id ON acc_recording_uploads(entity_id);
