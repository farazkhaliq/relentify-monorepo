# PLATFORM CONTEXT (INHERITED FROM MONOREPO)

This app is part of the Relentify monorepo.

You MUST follow all platform-level rules defined in the monorepo claude.md, especially:

- All UI must come from @relentify/ui (no local UI components)
- No hardcoded colours or styling outside theme tokens
- Shared auth, database, and architecture must be respected
- Apps must feel like a single unified product

If there is any conflict between this file and the monorepo claude.md:
→ The monorepo claude.md takes precedence

---

# 30connect

Multi-channel helpdesk (Intercom + Zendesk competitor). Unified inbox for web chat, WhatsApp, email, SMS, Facebook, Instagram, and voice.

Container: `30connect` on port 3030 → connect.relentify.com
DB: `infra-postgres` → `relentify` database, `relentify_user` — tables prefixed `connect_` + extends `chat_*`
Monorepo: `/opt/relentify-monorepo/apps/30connect/`

---

## Architecture

- **Next.js 15 App Router** — pages under `app/`, APIs under `app/api/`
- **Raw SQL** via `pg` — no Prisma ORM, uses `src/lib/pool.ts`
- **Auth** — `getAuthUser()` from `src/lib/auth.ts`, JWT via `@relentify/auth`
- **Depends on 29chat** — shares `chat_*` tables, extends with `connect_*` tables
- **Channels**: web (via 29chat widget), WhatsApp, email, SMS, Facebook, Instagram, voice (Twilio)

---

## Database Tables

### connect_* prefix (8 tables)
| Table | Purpose |
|-------|---------|
| `connect_channels` | Channel config per entity (WhatsApp, email, SMS, etc.) |
| `connect_conversations` | Unified conversations across all channels |
| `connect_messages` | Messages within conversations |
| `connect_templates` | WhatsApp/email/SMS message templates |
| `connect_bots` | No-code chatbot definitions (flow JSONB) |
| `connect_bot_sessions` | Active bot conversation state |
| `connect_workflows` | If/then automation rules |
| `connect_workflow_runs` | Workflow execution log |

### Extended chat_* tables (from 29chat, 2 new tables)
| Table | Purpose |
|-------|---------|
| `chat_voice_config` | Twilio config, IVR, voicemail settings per entity |
| `chat_calls` | Call records (inbound/outbound, recording, voicemail) |

### QA table
| Table | Purpose |
|-------|---------|
| `connect_qa_reviews` | QA review scores, AI auto-scores, coaching notes |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/pool.ts` | Postgres pool + query wrapper |
| `src/lib/auth.ts` | JWT auth via `@relentify/auth` |
| `src/middleware.ts` | Auth middleware |
| `src/hooks/use-api.ts` | SWR-based API hooks |

---

## Env Vars

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | JWT signing secret (shared across monorepo) |
| `NEXT_PUBLIC_APP_URL` | Public URL (https://connect.relentify.com) |
| `CRON_SECRET` | Cron job authentication |
| `TWILIO_ACCOUNT_SID` | Twilio for voice/SMS |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |
| `STRIPE_SECRET_KEY` | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |

---

## Migrations

Located at `database/migrations/`. Run via:
```bash
cat apps/30connect/database/migrations/NNN_*.sql | docker exec -i infra-postgres psql -U relentify_user -d relentify
```

| File | Content |
|------|---------|
| `001_connect_tables.sql` | 8 connect_* tables + 2 chat_voice tables + connect_qa_reviews + 16 indexes |

---

## Build Status

### Phase 1: Scaffold + Database + Docker + Caddy — ✅ Complete
- 11 tables created (8 connect_* + 2 chat_voice + 1 QA), 16 indexes
- Health endpoint live, Caddy routing configured
- TopBar layout with Inbox, Contacts, Bots, Workflows, Templates, Analytics, Settings nav
- Placeholder inbox page
- **Note**: DNS A record for connect.relentify.com needs to be created (Caddy block ready, cert will auto-provision once DNS resolves)

### Phase 2: Channel Integrations — ✅ Complete
- 7 services: channel, conversation, message, template, SSE, whatsapp, email-channel, sms, facebook
- 4 channel providers: WhatsApp (Meta API), Email (Resend), SMS (Twilio), Facebook/Instagram (Graph API)
- 4 webhook routes: /api/webhooks/whatsapp (GET verify + POST), /email, /sms (TwiML response), /facebook
- Unified inbound flow: webhook → find/create conversation → create message → SSE broadcast
- Outbound dispatch: agent reply auto-routes to correct channel provider
- API routes: GET/POST /api/conversations, GET/PATCH /conversations/[id], GET/POST /conversations/[id]/messages
- SSE stream: GET /api/conversations/[id]/stream (auth required)
- Channel CRUD: GET/POST /api/channels, PATCH/DELETE /api/channels/[id]
- Template CRUD: GET/POST /api/templates, GET/PATCH/DELETE /api/templates/[id]

### Phase 3: Unified Multi-Channel Inbox — ✅ Complete
- 5 inbox components: ConversationList (channel icons, status badges, search), ChannelFilter (8 channels), ConversationThread (sender-type styling, channel indicator per message), ComposeMessage (note toggle, channel-aware), ContactSidebar (resolve/reopen, assign, tags)
- 3 pages: unified inbox (3-column), conversation detail redirect, contacts list (aggregated)
- Dashboard SSE: /api/events for entity-level events (new_conversation, resolved, assigned)
- Agents API: /api/agents (for reassignment dropdown)
- use-sse.ts hook with auto-reconnect

### Phase 4: No-Code Chatbot Builder — ✅ Complete
- bot.service.ts: CRUD + execution engine (message, buttons, collect, condition, action, ai_reply, delay nodes)
- Bot session state tracked in connect_bot_sessions (current_node_id, context JSONB)
- Execution: walk through nodes, send messages, collect inputs, evaluate conditions, handoff to agent
- Test endpoint: POST /api/bots/[id]/test with sample input, returns conversation simulation
- Bot list page + JSON-based builder page with test panel
- API routes: GET/POST /api/bots, GET/PATCH/DELETE /api/bots/[id], POST /api/bots/[id]/test

### Phase 5: Workflow Automation — ✅ Complete
- workflow.service.ts: CRUD + execution engine
- Triggers: conversation.created, conversation.assigned, conversation.resolved, message.created, contact.identified, tag.added, sla.breached
- Condition evaluation: equals, not_equals, contains, starts_with, in
- Actions: assign_agent, assign_department, send_message, add_tag, set_priority, set_status, send_webhook
- Execution logged to connect_workflow_runs (completed/failed + result JSONB)
- Workflow list page + editor page (trigger selector, conditions/actions JSON editors)
- API routes: GET/POST /api/workflows, GET/PATCH/DELETE /api/workflows/[id]

### Phase 6: Voice (Twilio) — ✅ Complete
- voice.service.ts: TwiML generation, call record CRUD, voice config CRUD
- Inbound: POST /api/voice/incoming (Twilio webhook → TwiML with IVR/queue/voicemail)
- Outbound: POST /api/voice/outbound (agent-initiated via Twilio REST API)
- Status: POST /api/voice/status (call completed, recording ready)
- Transfer: POST /api/voice/transfer (warm transfer via TwiML update)
- Token: GET /api/voice/token (Twilio Client JWT for browser VoIP)
- Config: GET/PATCH /api/voice/config
- Auto-creates conversation + call record on inbound

### Phase 7: Advanced Analytics — ✅ Complete
- analytics.service.ts: conversations per channel, response time by channel, resolution rate by channel, agent leaderboard, bot resolution rate, voice stats (calls, duration, wait, missed)
- Analytics page with date range (7/30/90d), KPI cards, channel breakdowns
- API: GET /api/analytics?from=&to=&channel=

### Phase 8: Advanced QA — ✅ Complete
- qa.service.ts: CRUD for connect_qa_reviews table (scores, AI scores, coaching notes)
- AI auto-scoring: POST /api/quality/auto-score (passes transcript to AI, returns rubric scores)
- QA dashboard with average scores across all reviews
- API: GET/POST /api/quality, GET/PATCH /api/quality/[id], POST /api/quality/auto-score

### Phase 9: Settings + Stripe Billing — ✅ Complete
- Settings page with 5 tabs: Channels, Voice, Bots, Workflows, Billing
- tiers.ts: 5-tier plan (Starter £12 → Enterprise £119/seat/mo) with feature gating
- Billing API: GET/POST /api/billing, POST /api/billing/portal
- Stripe webhook: POST /api/webhooks/stripe
- Templates page: list/create/delete message templates
