-- database/migrations/029_api_keys.sql

-- API key storage
CREATE TABLE acc_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  name          VARCHAR(100) NOT NULL,
  key_hash      VARCHAR(64) NOT NULL UNIQUE,
  key_prefix    VARCHAR(8)  NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  is_test_mode  BOOLEAN DEFAULT FALSE,
  allowed_ips   TEXT[],
  last_used_at  TIMESTAMPTZ,
  rotated_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash      ON acc_api_keys(key_hash);
CREATE INDEX idx_api_keys_entity_id ON acc_api_keys(entity_id);

-- Webhook endpoint registry
CREATE TABLE acc_webhook_endpoints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id  UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  secret     VARCHAR(64) NOT NULL,
  events     TEXT[] NOT NULL DEFAULT '{}',
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_endpoints_entity ON acc_webhook_endpoints(entity_id);

-- Webhook delivery attempts
CREATE TABLE acc_webhook_deliveries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id      UUID REFERENCES acc_webhook_endpoints(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  payload          JSONB NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending | delivered | failed | dead_lettered
  status_code      INTEGER,
  retry_count      INTEGER DEFAULT 0,
  next_retry_at    TIMESTAMPTZ DEFAULT NOW(),
  delivered_at     TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_pending
  ON acc_webhook_deliveries(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_webhook_deliveries_endpoint
  ON acc_webhook_deliveries(endpoint_id, created_at DESC);

-- API request log
CREATE TABLE acc_api_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      UUID REFERENCES acc_api_keys(id) ON DELETE SET NULL,
  entity_id   UUID NOT NULL,
  endpoint    TEXT NOT NULL,
  method      TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_requests_key_id    ON acc_api_requests(key_id, created_at DESC);
CREATE INDEX idx_api_requests_entity_id ON acc_api_requests(entity_id, created_at DESC);
-- Partition hint: rows older than 90 days can be archived
