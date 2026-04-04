-- Migration 020: File acc_attachments

-- Main metadata table — never stores binary data
CREATE TABLE IF NOT EXISTS acc_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  record_type  TEXT NOT NULL,   -- 'bill' | 'expense' | 'mileage' | 'bank_transaction'
  record_id    UUID NOT NULL,
  file_key     TEXT NOT NULL,   -- logical key used by all backends (R2 object key or UUID path)
  file_name    TEXT NOT NULL,   -- original filename shown to user
  file_size    INTEGER,         -- post-compression bytes
  mime_type    TEXT,            -- mime type after compression (may differ from upload)
  uploaded_by  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_record
  ON acc_attachments(entity_id, record_type, record_id);

-- Postgres storage backend: binary data lives here, not in acc_attachments
-- Only populated when STORAGE_BACKEND=postgres (default)
CREATE TABLE IF NOT EXISTS acc_attachment_data (
  attachment_id UUID PRIMARY KEY REFERENCES acc_attachments(id) ON DELETE CASCADE,
  data          BYTEA NOT NULL
);
