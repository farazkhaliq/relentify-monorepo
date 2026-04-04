-- 30connect core tables (8 connect_ tables + 2 chat_ voice tables)
-- Run: cat apps/30connect/database/migrations/001_connect_tables.sql | docker exec -i infra-postgres psql -U relentify_user -d relentify

-- 1. connect_channels
CREATE TABLE IF NOT EXISTS connect_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp','email','sms','facebook','instagram')),
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, channel_type)
);

-- 2. connect_conversations
CREATE TABLE IF NOT EXISTS connect_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  channel TEXT NOT NULL CHECK (channel IN ('web','whatsapp','email','sms','facebook','instagram','voice')),
  external_id TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  assigned_agent_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','assigned','waiting','resolved','closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  department TEXT,
  subject TEXT,
  tags TEXT[] DEFAULT '{}',
  chat_session_id UUID REFERENCES chat_sessions(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 3. connect_messages
CREATE TABLE IF NOT EXISTS connect_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES connect_conversations(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id),
  channel TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact','agent','ai','system','bot','note')),
  sender_id TEXT,
  body TEXT NOT NULL,
  attachment_url TEXT,
  external_message_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. connect_templates
CREATE TABLE IF NOT EXISTS connect_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, channel, name)
);

-- 5. connect_bots
CREATE TABLE IF NOT EXISTS connect_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  description TEXT,
  trigger_conditions JSONB DEFAULT '{}',
  flow JSONB NOT NULL DEFAULT '{"nodes":[]}',
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. connect_bot_sessions
CREATE TABLE IF NOT EXISTS connect_bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  bot_id UUID NOT NULL REFERENCES connect_bots(id),
  conversation_id UUID NOT NULL REFERENCES connect_conversations(id),
  current_node_id TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','handed_off','errored')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. connect_workflows
CREATE TABLE IF NOT EXISTS connect_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  conditions JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. connect_workflow_runs
CREATE TABLE IF NOT EXISTS connect_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES connect_workflows(id),
  conversation_id UUID REFERENCES connect_conversations(id),
  entity_id UUID NOT NULL REFERENCES entities(id),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice tables (extend chat_* from 29chat)
CREATE TABLE IF NOT EXISTS chat_voice_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL UNIQUE REFERENCES entities(id),
  twilio_account_sid TEXT,
  twilio_auth_token_encrypted TEXT,
  twilio_phone_number TEXT,
  voicemail_enabled BOOLEAN DEFAULT TRUE,
  voicemail_greeting_url TEXT,
  recording_enabled BOOLEAN DEFAULT TRUE,
  ivr_flow JSONB DEFAULT '{}',
  queue_music_url TEXT,
  max_queue_wait_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  session_id UUID REFERENCES chat_sessions(id),
  conversation_id UUID REFERENCES connect_conversations(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  caller_number TEXT,
  callee_number TEXT,
  agent_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing','in_progress','on_hold','completed','voicemail','missed')),
  recording_url TEXT,
  recording_duration_seconds INTEGER,
  voicemail_url TEXT,
  twilio_call_sid TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QA reviews table
CREATE TABLE IF NOT EXISTS connect_qa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  conversation_id UUID NOT NULL REFERENCES connect_conversations(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  agent_id UUID REFERENCES users(id),
  scores JSONB NOT NULL DEFAULT '{}',
  ai_score JSONB,
  notes TEXT,
  coaching_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_connect_conversations_entity ON connect_conversations(entity_id);
CREATE INDEX idx_connect_conversations_status ON connect_conversations(entity_id, status);
CREATE INDEX idx_connect_conversations_channel ON connect_conversations(entity_id, channel);
CREATE INDEX idx_connect_conversations_agent ON connect_conversations(assigned_agent_id);
CREATE INDEX idx_connect_messages_conversation ON connect_messages(conversation_id);
CREATE INDEX idx_connect_messages_created ON connect_messages(conversation_id, created_at);
CREATE INDEX idx_connect_channels_entity ON connect_channels(entity_id);
CREATE INDEX idx_connect_bots_entity ON connect_bots(entity_id, enabled);
CREATE INDEX idx_connect_bot_sessions_conv ON connect_bot_sessions(conversation_id, status);
CREATE INDEX idx_connect_workflows_entity ON connect_workflows(entity_id, enabled);
CREATE INDEX idx_connect_workflow_runs_wf ON connect_workflow_runs(workflow_id);
CREATE INDEX idx_chat_calls_entity ON chat_calls(entity_id);
CREATE INDEX idx_chat_calls_session ON chat_calls(session_id);
CREATE INDEX idx_chat_calls_conversation ON chat_calls(conversation_id);
CREATE INDEX idx_connect_qa_reviews_entity ON connect_qa_reviews(entity_id);
CREATE INDEX idx_connect_qa_reviews_conv ON connect_qa_reviews(conversation_id);
