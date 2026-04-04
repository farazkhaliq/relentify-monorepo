# 30connect — Detailed Build Plan

Multi-channel helpdesk (Intercom + Zendesk competitor). 10 build phases.

**Master plan**: `/opt/relentify-monorepo/PLANS/communications-platform-master-plan.md`
**Depends on**: 29chat (shares `chat_*` tables, will consume `@relentify/chat` package)
**This is deliverable 2 of 4.** When 30connect is complete, proceed to → `crm-integration-build.md` and `marketing-pages-build.md` (can be done in parallel)

---

## Prerequisites

Before starting 30connect:
1. 29chat must be built and deployed
2. `@relentify/chat` package must be extracted from 29chat (done in CRM Integration Phase 1)
3. OR: services can import directly from 29chat during initial development, then be extracted later

Decision: If CRM Integration hasn't happened yet, 30connect can still be built — it just imports chat services locally and they get extracted to `packages/chat/` when CRM Integration begins.

---

## Phase 1: Scaffold + Database + Docker + Caddy

### App: `apps/30connect/`

Same monorepo pattern as 29chat/28timesheets:
- **Package name**: `"connect"`
- **Port**: 3030
- **Container**: `30connect`
- **Domain**: `connect.relentify.com`
- **Stack**: Next.js 15, App Router, pg, @relentify/ui, @relentify/auth, swr, zod, stripe

Additional dependencies beyond 29chat:
- `twilio` — Voice SDK server-side (TwiML, call management)
- All 29chat services (either via `@relentify/chat` package or direct import during dev)

### Database migration: `001_connect_tables.sql`

8 new tables with `connect_` prefix (in `relentify` database alongside `chat_*` tables):

```sql
-- 1. connect_channels (channel config per entity)
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

-- 2. connect_conversations (unified across all channels)
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

-- 3. connect_messages (unified across channels)
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

-- 4. connect_templates (WhatsApp/email templates)
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

-- 5. connect_bots (bot definitions)
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

-- 6. connect_bot_sessions (active bot conversation state)
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

-- 7. connect_workflows (if/then automation rules)
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

-- 8. connect_workflow_runs (execution log)
CREATE TABLE IF NOT EXISTS connect_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES connect_workflows(id),
  conversation_id UUID REFERENCES connect_conversations(id),
  entity_id UUID NOT NULL REFERENCES entities(id),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  result JSONB DEFAULT '{}',
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
```

### Voice tables (extends chat_* from 29chat migration)

```sql
-- Add to 001_connect_tables.sql or as 002_voice_tables.sql in 29chat

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

CREATE INDEX idx_chat_calls_entity ON chat_calls(entity_id);
CREATE INDEX idx_chat_calls_session ON chat_calls(session_id);
CREATE INDEX idx_chat_calls_conversation ON chat_calls(conversation_id);
```

### App layout

TopBar with links: Inbox, Contacts, Bots, Workflows, Templates, Analytics, Settings

### Deploy steps
Same as 29chat: pnpm install → migration → build → docker → Caddy block → verify health

---

## Phase 2: Channel Integrations

### Services
| File | Purpose |
|------|---------|
| `src/lib/services/channel.service.ts` | Channel config CRUD, `getChannels(entityId)`, `upsertChannel(entityId, type, config)` |
| `src/lib/services/conversation.service.ts` | Unified CRUD: `createConversation`, `listConversations(entityId, filters)`, `getConversationById`, `updateConversation`, reply logic |
| `src/lib/services/whatsapp.service.ts` | Meta WhatsApp Business API: `sendMessage(to, body, config)`, `processWebhook(payload)`, `verifyWebhook(token)` |
| `src/lib/services/email-channel.service.ts` | Outbound via Resend, inbound via webhook. `sendEmail(to, subject, body)`, `processInboundEmail(payload)`. Thread matching via `In-Reply-To` headers. |
| `src/lib/services/sms.service.ts` | Twilio SMS: `sendSMS(to, body, config)`, `processInboundSMS(payload)` |
| `src/lib/services/facebook.service.ts` | Meta Graph API: Messenger + Instagram DMs. `sendMessage(recipientId, text, config)`, `processWebhook(payload)` |
| `src/lib/services/template.service.ts` | Template CRUD: `listTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `sendTemplate(conversationId, templateId, variables)` |

### Webhook routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/webhooks/whatsapp` | GET, POST | WhatsApp verification + inbound messages |
| `/api/webhooks/email` | POST | Inbound email (from Resend/Mailgun) |
| `/api/webhooks/sms` | POST | Inbound SMS (from Twilio) |
| `/api/webhooks/facebook` | GET, POST | Facebook/Instagram verification + messages |

### Channel config JSONB structures

**WhatsApp**:
```json
{
  "phone_number_id": "...",
  "access_token": "encrypted",
  "verify_token": "...",
  "business_account_id": "..."
}
```

**Email**:
```json
{
  "from_address": "support@customer.com",
  "from_name": "Customer Support",
  "resend_api_key": "encrypted",
  "inbound_address": "support-abc123@inbound.relentify.com"
}
```

**SMS**:
```json
{
  "twilio_account_sid": "...",
  "twilio_auth_token": "encrypted",
  "phone_number": "+44..."
}
```

**Facebook/Instagram**:
```json
{
  "page_id": "...",
  "page_access_token": "encrypted",
  "app_secret": "encrypted",
  "instagram_account_id": "..."
}
```

### Inbound message flow (all channels)
1. Webhook receives message from provider
2. Find or create `connect_conversations` record (match by external_id + entity)
3. Create `connect_messages` record
4. If bot active → route to bot engine
5. If no bot → route to agent (via routing service from @relentify/chat)
6. Broadcast via SSE to agent inbox

---

## Phase 3: Unified Multi-Channel Inbox

### Components
| Component | Purpose |
|-----------|---------|
| `src/components/inbox/ConversationList.tsx` | Left panel — all conversations across channels. Channel icon badge. Status, assignee, last message. |
| `src/components/inbox/ChannelFilter.tsx` | Filter by channel (web/whatsapp/email/sms/facebook/instagram/voice/all) |
| `src/components/inbox/ConversationThread.tsx` | Message thread — shows channel indicator per message, supports rich content (images, files) |
| `src/components/inbox/ComposeMessage.tsx` | Reply input with channel selector (reply on same channel, or switch). Template picker for WhatsApp. |
| `src/components/inbox/ContactSidebar.tsx` | Contact info aggregated from all channels. Chat history, email history, call history in tabs. |

### Pages
| Page | Purpose |
|------|---------|
| `src/app/(app)/inbox/page.tsx` | Unified inbox — ConversationList | ConversationThread | ContactSidebar |
| `src/app/(app)/inbox/[conversationId]/page.tsx` | Conversation detail |
| `src/app/(app)/contacts/page.tsx` | Contact list (aggregated from chat_visitors + conversation contacts) |

### API routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/conversations` | GET | `?channel=&status=&assigned=&search=&page=` |
| `/api/conversations` | POST | Create outbound conversation (email/whatsapp/sms) |
| `/api/conversations/[id]` | GET, PATCH | Detail / update (status, assignee, tags, priority) |
| `/api/conversations/[id]/messages` | GET, POST | Read / send message (service routes to correct channel provider) |
| `/api/conversations/[id]/stream` | GET | SSE for conversation |
| `/api/channels` | GET, POST | List / configure channels |
| `/api/channels/[id]` | PATCH, DELETE | Update / remove channel |
| `/api/templates` | GET, POST | Template CRUD |
| `/api/templates/[id]` | PATCH, DELETE | |

### Web chat integration
When a web chat session exists (from 29chat widget), 30connect creates a `connect_conversations` record with `channel = 'web'` and `chat_session_id` pointing to the `chat_sessions` record. Messages flow through both `chat_messages` (for widget SSE) and `connect_messages` (for unified inbox).

---

## Phase 4: No-Code Chatbot Builder

### Services
| File | Purpose |
|------|---------|
| `src/lib/services/bot.service.ts` | Bot CRUD + execution engine |

### Bot flow JSONB structure
```json
{
  "nodes": [
    { "id": "start", "type": "message", "text": "Hi! How can I help?", "next": "menu" },
    { "id": "menu", "type": "buttons", "text": "Choose a topic:", "options": [
      { "label": "Pricing", "next": "pricing" },
      { "label": "Support", "next": "support" },
      { "label": "Talk to human", "next": "handoff" }
    ]},
    { "id": "pricing", "type": "message", "text": "Our plans start at...", "next": "end" },
    { "id": "support", "type": "collect", "field": "email", "prompt": "What's your email?", "next": "ticket" },
    { "id": "ticket", "type": "action", "action": "create_ticket", "next": "end" },
    { "id": "handoff", "type": "action", "action": "handoff_to_agent" },
    { "id": "end", "type": "message", "text": "Thanks! Anything else?" }
  ],
  "trigger": { "type": "new_conversation", "channels": ["web", "whatsapp"] }
}
```

### Node types
- `message` — send text/image to contact
- `buttons` — present button choices
- `collect` — ask for input (name, email, phone, free text), store in `context`
- `condition` — if/else based on context fields or visitor data
- `action` — create_ticket, handoff_to_agent, tag_conversation, set_field, send_webhook
- `ai_reply` — pass conversation to AI service (from @relentify/chat)
- `delay` — wait N seconds before continuing

### Bot execution engine
1. On new conversation (matching trigger): create `connect_bot_sessions` record, start at first node
2. Walk through nodes: send messages, collect inputs, evaluate conditions
3. Store state in `connect_bot_sessions.context` (collected data, current node)
4. On `handoff_to_agent`: end bot session, assign to human via routing service
5. On completion: mark session complete
6. On error: mark errored, fall back to human routing

### Visual builder component
| Component | Purpose |
|-----------|---------|
| `src/components/bots/BotBuilder.tsx` | Canvas with draggable nodes, connectors between nodes. Preview/test mode. |
| `src/components/bots/NodeEditor.tsx` | Side panel — edit node properties when selected |
| `src/components/bots/BotPreview.tsx` | Simulate conversation through the flow |

### Pages + routes
| Page/Route | Purpose |
|------------|---------|
| `src/app/(app)/bots/page.tsx` | Bot list — name, status, trigger, last edited |
| `src/app/(app)/bots/[id]/page.tsx` | Bot builder (visual editor) |
| `/api/bots` | GET, POST |
| `/api/bots/[id]` | GET, PATCH, DELETE |
| `/api/bots/[id]/test` | POST — test run with sample input |

---

## Phase 5: Workflow Automation

### Services
| File | Purpose |
|------|---------|
| `src/lib/services/workflow.service.ts` | Workflow CRUD + execution engine |

### Workflow structure
```json
{
  "trigger_event": "conversation.created",
  "conditions": [
    { "field": "channel", "operator": "equals", "value": "whatsapp" },
    { "field": "contact_email", "operator": "contains", "value": "@enterprise.com" }
  ],
  "actions": [
    { "type": "assign_agent", "config": { "agent_id": "UUID" } },
    { "type": "add_tag", "config": { "tag": "enterprise" } },
    { "type": "send_message", "config": { "message": "An enterprise specialist will help you shortly." } }
  ]
}
```

### Trigger events
- `conversation.created`, `conversation.assigned`, `conversation.resolved`
- `message.created` (by contact, agent, ai, or bot)
- `contact.identified` (email or phone matched)
- `tag.added`
- `sla.breached`

### Action types
- `assign_agent`, `assign_department`
- `send_message`, `send_template` (WhatsApp approved template)
- `add_tag`, `remove_tag`
- `set_priority`, `set_status`
- `create_ticket`
- `send_webhook`
- `send_email_notification`

### Execution engine
- After each trigger event, query `connect_workflows WHERE entity_id = $1 AND enabled = TRUE AND trigger_event = $2`
- Evaluate conditions against the event payload
- Execute matching workflow actions
- Log to `connect_workflow_runs`
- Fire-and-forget, non-blocking

### Pages + routes
| Page/Route | Purpose |
|------------|---------|
| `src/app/(app)/workflows/page.tsx` | Workflow list |
| `src/app/(app)/workflows/[id]/page.tsx` | Workflow editor (form-based: trigger → conditions → actions) |
| `/api/workflows` | GET, POST |
| `/api/workflows/[id]` | GET, PATCH, DELETE |
| `/api/workflows/[id]/test` | POST — evaluate against sample conversation |

---

## Phase 6: Voice (Twilio)

### Services
| File | Purpose |
|------|---------|
| `src/lib/services/voice.service.ts` | Twilio integration: token generation, TwiML responses, call management |

### API routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/voice/token` | GET | Generate Twilio Client token for agent browser (auth) |
| `/api/voice/incoming` | POST | Twilio webhook — inbound call. Returns TwiML (IVR → queue → connect to agent → voicemail) |
| `/api/voice/status` | POST | Twilio status callback (call completed, recording ready) |
| `/api/voice/outbound` | POST | Initiate outbound call from agent (auth) |
| `/api/voice/transfer` | POST | Warm transfer to another agent (auth) |
| `/api/voice/config` | GET, PATCH | Voice settings (auth, admin) |

### Components
| Component | Purpose |
|-----------|---------|
| `src/components/voice/VoicePanel.tsx` | Persistent panel at bottom of inbox — shows active call, hold/mute/transfer buttons, call timer |
| `src/components/voice/VoiceDialer.tsx` | Click-to-call dialer from contact/conversation sidebar |
| `src/components/voice/IVREditor.tsx` | Visual IVR flow editor (similar to bot builder but for phone trees) |

### Twilio Client JS SDK
- Loaded in agent dashboard layout
- Registers agent as a Twilio Client device
- Inbound calls ring in browser
- Outbound calls initiated from browser via `device.connect()`

### Call flow (inbound)
1. Caller dials Twilio phone number
2. Twilio sends webhook to `/api/voice/incoming`
3. Server returns TwiML:
   - If IVR configured: `<Gather>` for menu selection → route to department
   - Queue caller: `<Enqueue>` with hold music
   - Find available agent via routing service
   - Connect to agent's Twilio Client: `<Dial><Client>{agentId}</Client></Dial>`
   - If no agent available after timeout: `<Record>` voicemail
4. Create `chat_calls` record
5. On call end: status callback updates record, stores recording URL
6. Auto-create conversation + ticket

### Call flow (outbound)
1. Agent clicks phone number in sidebar
2. `POST /api/voice/outbound` with callee number
3. Server initiates call via Twilio REST API
4. Connect to agent's Twilio Client
5. Same recording/status handling

---

## Phase 7: Advanced Analytics

### Services
| File | Purpose |
|------|---------|
| `src/lib/services/analytics.service.ts` | SQL queries for cross-channel metrics |

### Metrics
All SQL against `connect_conversations`, `connect_messages`, `chat_calls`:
- Conversations per channel (breakdown chart)
- Response time by channel
- Resolution rate by channel
- Agent leaderboard (cross-channel)
- Bot resolution rate (conversations resolved without human)
- Voice analytics: call volume, avg duration, avg wait time, abandonment rate
- Custom reports: filterable by date range, channel, agent, status
- Scheduled reports: cron sends email with report data

### Pages + routes
| Page/Route | Purpose |
|------------|---------|
| `src/app/(app)/analytics/page.tsx` | Cross-channel dashboard |
| `/api/analytics` | GET `?from=&to=&channel=&metric=` |
| `/api/analytics/schedule` | GET, POST — scheduled report delivery config |

---

## Phase 8: Advanced QA

### Services
| File | Purpose |
|------|---------|
| `src/lib/services/qa.service.ts` | Review CRUD, AI auto-scoring, coaching notes |

### Database
Add `connect_qa_reviews` table:
```sql
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
```

### Scoring rubric (JSONB)
```json
{
  "helpfulness": 4,
  "accuracy": 5,
  "tone": 3,
  "resolution": 4,
  "overall": 4
}
```

### AI auto-scoring
- Pass conversation transcript to AI service (from @relentify/chat)
- System prompt: "Score this customer service conversation on helpfulness, accuracy, tone, resolution (1-5 each). Provide brief coaching feedback."
- Parse response into `ai_score` JSONB field
- Usage metered like other AI calls

### Pages + routes
| Page/Route | Purpose |
|------------|---------|
| `src/app/(app)/quality/page.tsx` | QA dashboard — agent scores over time, trending, filter by agent/date |
| `src/app/(app)/quality/review/[conversationId]/page.tsx` | Review form — read conversation, score, add notes |
| `/api/quality` | GET reviews, POST new review |
| `/api/quality/[id]` | GET, PATCH |
| `/api/quality/auto-score` | POST — trigger AI scoring for a conversation |

---

## Phase 9: Settings + Stripe Billing

### Settings tabs
Same pattern as 29chat settings, plus:
| Tab | Purpose |
|-----|---------|
| ChannelSettings.tsx | Configure WhatsApp, Email, SMS, Facebook/Instagram channels |
| VoiceSettings.tsx | Twilio config, IVR editor, voicemail, recording preferences |
| BotSettings.tsx | Global bot settings (or link to /bots page) |
| WorkflowSettings.tsx | Global workflow settings (or link to /workflows page) |
| BillingSettings.tsx | 5-tier plan display, upgrade/downgrade, Stripe portal |

### Stripe billing
5 tiers: Starter £12, Essentials £20, Growth £39, Professional £75, Enterprise £119 (per seat, annual).

Implementation:
- Stripe Products: one per tier
- Stripe Prices: per-seat, monthly recurring
- Checkout: `mode: 'subscription'`, `quantity` = number of seats
- Seat management: upgrade/downgrade quantity via Stripe API
- AI metering: Stripe metered billing for resolution overage ($0.99/resolution)
- Voice metering: Stripe metered billing for call minutes (pass-through)
- SMS metering: Stripe metered billing for messages (pass-through)

### Feature gating
```typescript
type ConnectPlan = 'starter' | 'essentials' | 'growth' | 'professional' | 'enterprise'

function canAccess(plan: ConnectPlan, feature: string): boolean {
  const gates: Record<string, ConnectPlan[]> = {
    'live_chat': ['essentials','growth','professional','enterprise'],
    'whatsapp': ['growth','professional','enterprise'],
    'voice': ['growth','professional','enterprise'],
    'sms': ['professional','enterprise'],
    'sla': ['growth','professional','enterprise'],
    'bots_unlimited': ['professional','enterprise'],
    'workflows': ['professional','enterprise'],
    'custom_reports': ['professional','enterprise'],
    'copilot': ['professional','enterprise'],
    'custom_roles': ['enterprise'],
    'audit_log': ['enterprise'],
    'sandbox': ['enterprise'],
    'sso': ['enterprise'],
    'qa_ai': ['enterprise'],
  }
  return (gates[feature] || []).includes(plan)
}
```

---

## Phase 10: MCP Tests + E2E Tests + Infrastructure

### MCP Tests
Create `/opt/infra/mcp/30connect-mcp/` — test coverage:
- Health, channel CRUD, conversation CRUD, messages across channels
- Bot CRUD, workflow CRUD, template CRUD
- Voice: token generation, config
- QA: review CRUD, auto-score
- Analytics: all metrics return data
- Billing: plan info, checkout
- Webhook endpoints: WhatsApp, email, SMS, Facebook verify + inbound

### E2E Tests
- WhatsApp: simulate inbound message → appears in inbox → agent replies
- Email: simulate inbound → inbox → reply → outbound
- Bot: trigger bot → walk through flow → handoff to agent
- Workflow: create rule → trigger event → actions execute
- Voice: verify VoIP panel loads, config saves
- QA: score a conversation, view dashboard
- Settings: all tabs save correctly

### Infrastructure
- Caddy block for `connect.relentify.com` (with `flush_interval -1`)
- Update CLAUDE.md files
- Create 30connect CLAUDE.md
- `docker builder prune -f`

---

## File Count Summary

| Category | Count |
|----------|-------|
| Config files | 6 |
| Migrations | 1-2 |
| Core lib | 4 (pool, auth, cors — shared pattern) |
| Services | ~15 |
| API routes | ~40 |
| Pages | ~15 |
| Components | ~25 |
| Hooks | 3 |
| **Total** | **~110 files** |
