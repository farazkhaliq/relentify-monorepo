-- 29chat migration 002: API keys + push subscriptions
-- Run: cat apps/29chat/database/migrations/002_api_keys_and_push.sql | docker exec -i infra-postgres psql -U relentify_user -d relentify

CREATE TABLE IF NOT EXISTS chat_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{"read","write"}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  user_id UUID NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA policies column (safe if already exists)
DO $$ BEGIN
  ALTER TABLE chat_config ADD COLUMN IF NOT EXISTS sla_policies JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX idx_chat_api_keys_entity ON chat_api_keys(entity_id);
CREATE INDEX idx_chat_push_subs_entity ON chat_push_subscriptions(entity_id);
