-- 29chat core tables (9 tables, chat_ prefix)
-- Run: cat apps/29chat/database/migrations/001_core_tables.sql | docker exec -i infra-postgres psql -U relentify_user -d relentify

-- 1. chat_visitors
CREATE TABLE IF NOT EXISTS chat_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  fingerprint TEXT NOT NULL,
  name TEXT,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  page_url TEXT,
  custom_data JSONB DEFAULT '{}',
  banned BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, fingerprint)
);

-- 2. chat_config (one row per entity)
CREATE TABLE IF NOT EXISTS chat_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL UNIQUE REFERENCES entities(id),
  -- Widget appearance
  widget_colour TEXT DEFAULT '#6366f1',
  widget_position TEXT DEFAULT 'bottom-right' CHECK (widget_position IN ('bottom-right','bottom-left')),
  widget_greeting TEXT DEFAULT 'Hi there! How can we help?',
  widget_offline_message TEXT DEFAULT 'We are currently offline. Leave a message and we will get back to you.',
  widget_avatar_url TEXT,
  widget_show_branding BOOLEAN DEFAULT TRUE,
  widget_i18n JSONB DEFAULT '{}',
  -- Pre-chat form
  pre_chat_form_enabled BOOLEAN DEFAULT FALSE,
  pre_chat_fields JSONB DEFAULT '["name","email"]',
  -- Business info
  business_name TEXT,
  business_timezone TEXT DEFAULT 'Europe/London',
  business_description TEXT,
  operating_hours JSONB DEFAULT '{}',
  departments JSONB DEFAULT '[]',
  -- AI settings
  ai_enabled BOOLEAN DEFAULT FALSE,
  ai_api_url TEXT,
  ai_api_key_encrypted TEXT,
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  ai_system_prompt TEXT DEFAULT 'You are a helpful customer support assistant. Be concise and friendly.',
  ai_max_tokens INTEGER DEFAULT 500,
  ai_temperature NUMERIC(3,2) DEFAULT 0.7,
  ai_auto_reply BOOLEAN DEFAULT FALSE,
  ai_escalate_keywords TEXT[] DEFAULT ARRAY['human','agent','speak to someone','manager'],
  -- Routing
  routing_method TEXT DEFAULT 'round-robin' CHECK (routing_method IN ('round-robin','least-busy')),
  auto_assign BOOLEAN DEFAULT TRUE,
  last_assigned_agent_id UUID,
  -- Canned responses
  canned_responses JSONB DEFAULT '[]',
  -- Billing
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','branding','ai','branding_ai')),
  -- Push notifications
  vapid_public_key TEXT,
  vapid_private_key TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  visitor_id UUID NOT NULL REFERENCES chat_visitors(id),
  assigned_agent_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','assigned','waiting','resolved','closed')),
  channel TEXT DEFAULT 'widget' CHECK (channel IN ('widget','api','email')),
  subject TEXT,
  department TEXT,
  ai_enabled BOOLEAN DEFAULT FALSE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 4. chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor','agent','ai','system','note')),
  sender_id TEXT,
  body TEXT NOT NULL,
  attachment_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. chat_ai_usage
CREATE TABLE IF NOT EXISTS chat_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  month TEXT NOT NULL,
  ai_replies INTEGER DEFAULT 0,
  ai_tokens_in INTEGER DEFAULT 0,
  ai_tokens_out INTEGER DEFAULT 0,
  UNIQUE(entity_id, month)
);

-- 6. chat_knowledge_articles
CREATE TABLE IF NOT EXISTS chat_knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  sort_order INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT FALSE,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, slug)
);

-- 7. chat_tickets
CREATE TABLE IF NOT EXISTS chat_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  visitor_id UUID REFERENCES chat_visitors(id),
  session_id UUID REFERENCES chat_sessions(id),
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  department TEXT,
  assigned_agent_id UUID REFERENCES users(id),
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 8. chat_triggers
CREATE TABLE IF NOT EXISTS chat_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  action JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. chat_webhooks
CREATE TABLE IF NOT EXISTS chat_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  last_delivery_at TIMESTAMPTZ,
  last_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_visitors_entity_fp ON chat_visitors(entity_id, fingerprint);
CREATE INDEX idx_chat_sessions_entity ON chat_sessions(entity_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(entity_id, status);
CREATE INDEX idx_chat_sessions_agent ON chat_sessions(assigned_agent_id);
CREATE INDEX idx_chat_sessions_visitor ON chat_sessions(visitor_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(session_id, created_at);
CREATE INDEX idx_chat_tickets_entity ON chat_tickets(entity_id);
CREATE INDEX idx_chat_tickets_status ON chat_tickets(entity_id, status);
CREATE INDEX idx_chat_knowledge_entity ON chat_knowledge_articles(entity_id, published);
CREATE INDEX idx_chat_triggers_entity ON chat_triggers(entity_id, enabled);
CREATE INDEX idx_chat_webhooks_entity ON chat_webhooks(entity_id, enabled);
CREATE INDEX idx_chat_ai_usage_entity ON chat_ai_usage(entity_id, month);
