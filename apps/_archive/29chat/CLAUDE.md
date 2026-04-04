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

# 29chat

Standalone webchat product (Tawk.to competitor). Embeddable widget + agent dashboard + AI auto-reply.

Container: `29chat` on port 3029 → chat.relentify.com
DB: `infra-postgres` → `relentify` database, `relentify_user` — all tables prefixed `chat_`
Monorepo: `/opt/relentify-monorepo/apps/29chat/`

---

## Architecture

- **Next.js 15 App Router** — pages under `app/`, APIs under `app/api/`
- **Raw SQL** via `pg` — no Prisma ORM, uses `src/lib/pool.ts` (Pool, query)
- **Auth** — `getAuthUser()` from `src/lib/auth.ts`, checks JWT cookie via `@relentify/auth`
- **CORS** — `src/lib/cors.ts` for widget API routes (public, cross-origin)
- **Widget** — embeddable JS loaded via `<script>` tag, Shadow DOM, SSE real-time

---

## Database Tables (chat_* prefix, 9 tables)

| Table | Purpose |
|-------|---------|
| `chat_visitors` | Website visitors tracked by fingerprint |
| `chat_config` | Per-entity widget config (appearance, AI, routing, billing) |
| `chat_sessions` | Chat conversations between visitor and agent |
| `chat_messages` | Individual messages within sessions |
| `chat_ai_usage` | Monthly AI token/reply counters |
| `chat_knowledge_articles` | Knowledge base articles for self-service |
| `chat_tickets` | Support tickets (from chat or standalone) |
| `chat_triggers` | Automated trigger rules (conditions → actions) |
| `chat_webhooks` | Outbound webhook subscriptions |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/pool.ts` | Postgres pool + query wrapper |
| `src/lib/auth.ts` | JWT auth via `@relentify/auth` |
| `src/lib/cors.ts` | CORS headers for widget API routes |
| `src/middleware.ts` | Auth middleware (bypasses widget/API/static routes) |
| `src/hooks/use-api.ts` | SWR-based API hooks (useApiCollection, useApiDoc, apiCreate, etc.) |

---

## Env Vars

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | JWT signing secret (shared across monorepo) |
| `NEXT_PUBLIC_APP_URL` | Public URL (https://chat.relentify.com) |
| `CRON_SECRET` | Cron job authentication |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `STRIPE_SECRET_KEY` | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `AI_KEY_ENCRYPTION_SECRET` | Encrypt customer AI API keys at rest |
| `AI_DEFAULT_API_URL` | Default AI endpoint |
| `AI_DEFAULT_API_KEY` | Default AI API key |
| `AI_DEFAULT_MODEL` | Default AI model (gpt-4o-mini) |

---

## Migrations

Located at `database/migrations/`. Run via:
```bash
cat apps/29chat/database/migrations/NNN_*.sql | docker exec -i infra-postgres psql -U relentify_user -d relentify
```

| File | Content |
|------|---------|
| `001_core_tables.sql` | All 9 chat_* tables + 13 indexes |

---

## API Routes

### Widget API (public, CORS-enabled, rate-limited)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/widget/config?entity_id=` | Public widget config (colours, greeting, hours) |
| POST | `/api/widget/session` | Create/resume session (entity_id + fingerprint) |
| GET | `/api/widget/session/[id]/messages?since=` | Get messages (filters out internal notes) |
| POST | `/api/widget/session/[id]/messages` | Send visitor message |
| POST | `/api/widget/session/[id]/identify` | Update visitor name/email |
| POST | `/api/widget/session/[id]/rate` | CSAT rating (1-5) |
| POST | `/api/widget/session/[id]/upload` | File upload (max 10MB) |
| GET | `/api/widget/knowledge?entity_id=&q=` | Knowledge base search |
| GET | `/api/widget/visitors?entity_id=` | Live visitors (last 2min) |
| POST | `/api/widget/heartbeat` | Update visitor page_url + last_seen_at |

### Agent API (auth required)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sessions?status=&search=&page=` | List sessions for entity |
| GET/PATCH | `/api/sessions/[id]` | Session detail + visitor info / update status/agent/dept |
| GET/POST | `/api/sessions/[id]/messages` | Read/send agent messages (POST: sender_type defaults to 'agent') |
| GET | `/api/agents` | List users for entity (reassignment dropdown) |
| GET | `/api/export/[sessionId]?format=text\|json` | Export conversation |
| GET | `/api/visitors` | Live visitors (auth) |
| POST | `/api/visitors/[id]/ban` | Ban/unban visitor |
| GET/PATCH | `/api/config` | Full config for entity (GET) / update settings (PATCH) |
| GET/POST | `/api/knowledge` | List/create knowledge articles |
| GET/PATCH/DELETE | `/api/knowledge/[id]` | Article detail/update/delete |

### SSE Streams
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/widget/session/[id]/stream` | No | SSE for widget (new_message, typing, session_updated) |
| POST | `/api/widget/session/[id]/typing` | No | Visitor typing indicator |
| GET | `/api/sessions/[id]/stream` | Yes | SSE for agent (same events + agent_viewing) |
| POST | `/api/sessions/[id]/typing` | Yes | Agent typing indicator |
| GET | `/api/events` | Yes | Dashboard SSE (new_session, session_assigned, session_resolved) |

### Internal
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/uploads/[...path]` | Serve uploaded files |

---

## Services

| File | Functions |
|------|-----------|
| `src/lib/services/visitor.service.ts` | getOrCreateVisitor, updateVisitor, getVisitorById, banVisitor, getLiveVisitors |
| `src/lib/services/session.service.ts` | createSession, getSessionById, updateSession, listSessions, rateSession |
| `src/lib/services/message.service.ts` | createMessage, getMessages |
| `src/lib/services/config.service.ts` | getConfig, getPublicConfig, ensureConfig, upsertConfig |
| `src/lib/services/upload.service.ts` | handleFileUpload |
| `src/lib/services/routing.service.ts` | assignAgent (round-robin / least-busy) |
| `src/lib/services/knowledge.service.ts` | listArticles, getArticleById, createArticle, updateArticle, deleteArticle, searchArticles |
| `src/lib/services/ai.service.ts` | handleAIReply (escalation, KB context, AI call, fallback) |
| `src/lib/services/ai-usage.service.ts` | incrementUsage, getUsage |
| `src/lib/services/sse.service.ts` | SSEManager singleton (session + entity broadcasting) |
| `src/lib/crypto.ts` | encryptApiKey, decryptApiKey (AES-256-GCM) |

---

## Build Status

### Phase 1: Scaffold + Database + Docker + Caddy — ✅ Complete
- 9 tables created, health endpoint live, Caddy routing active
- TopBar layout with Inbox, Tickets, Knowledge Base, Analytics, Settings nav
- Placeholder inbox page

### Phase 2: Public Widget API — ✅ Complete
- 5 service files, 9 widget API routes, upload serving route
- CORS headers on all widget routes, OPTIONS handlers
- Rate limiter (60 req/min per IP)
- File upload to /app/uploads/chat/{entityId}/{uuid}.ext

### Phase 3: SSE Real-Time + Polling Fallback — ✅ Complete
- SSEManager singleton with session-level and entity-level broadcasting
- Widget SSE: `/api/widget/session/[id]/stream` (no auth, CORS)
- Agent SSE: `/api/sessions/[id]/stream` (auth required, broadcasts agent_viewing)
- Dashboard SSE: `/api/events` (auth required, entity-scoped new_session/assigned/resolved)
- Typing indicators: widget + agent POST routes
- message.service broadcasts `new_message` on createMessage (skips notes)
- session.service broadcasts `new_session`, `session_resolved`, `session_assigned` on updates
- 30s keepalive on all SSE connections
- Caddy `flush_interval -1` for SSE pass-through

### Phase 4: Embeddable widget.js — ✅ Complete
- ~22KB vanilla JS IIFE at `/widget.js` with Shadow DOM isolation
- Embed: `<script src="https://chat.relentify.com/widget.js" data-entity-id="UUID"></script>`
- Features: config fetch, fingerprint generation, session create/resume, SSE + 3s polling fallback
- Pre-chat form (name/email), message send/receive, typing indicators, CSAT rating prompt
- Heartbeat every 30s, unread badge, mobile-responsive (full-screen on small screens)
- "Powered by Relentify" branding (when widget_show_branding = true)
- Public API: `window.RelentifyChat.open/close/toggle/identify/destroy/setLanguage`

### Phase 5: Agent Dashboard — ✅ Complete
- 3-column inbox layout: SessionList | ChatThread + ReplyInput | VisitorSidebar
- 6 components: SessionList, SessionFilters, ChatThread, ReplyInput, VisitorSidebar, CannedResponsePicker
- Session list with status filters, search, status badges, time-ago
- Chat thread with sender-type styling (visitor/agent/ai/system/note), auto-scroll, typing indicators
- Reply input with note toggle, canned response picker, keyboard send (Enter)
- Visitor sidebar with info display, resolve/reopen, agent reassignment, AI toggle, ban/unban
- Live visitors page with browser detection, page URL, time-ago
- Agent collision detection via SSE (agent_viewing events)
- use-sse.ts hook with auto-reconnection (3s retry)
- Authenticated API routes: sessions list/detail/messages, agents, export (text/JSON), visitors, ban
- Config API route (GET/PATCH) for authenticated agent settings

### Phase 6: Auto-Routing + Departments — ✅ Complete
- routing.service.ts: round-robin (tracks last_assigned_agent_id) and least-busy (counts active sessions)
- Auto-assigns agent on new session creation (async, non-blocking)
- Sends system message when agent joins chat
- Integrated into session.service.ts createSession()

### Phase 7: Knowledge Base — ✅ Complete
- knowledge.service.ts: CRUD + PG full-text search (ts_rank + ILIKE fallback)
- API routes: GET/POST /api/knowledge, GET/PATCH/DELETE /api/knowledge/[id]
- Knowledge page with ArticleList (table) + ArticleEditor (create/edit form)
- Auto-slug generation from title, category, published toggle, sort order, language
- Widget knowledge search already wired (Phase 2) via /api/widget/knowledge

### Phase 8: AI Integration — ✅ Complete
- ai.service.ts: handleAIReply() with full message flow (escalation keywords → KB context → AI API → fallback)
- BYOK support: entity's encrypted API key or platform defaults
- crypto.ts: AES-256-GCM encrypt/decrypt for customer API keys
- ai-usage.service.ts: monthly token + reply tracking (incrementUsage, getUsage)
- Escalation: checks ai_escalate_keywords, routes to human agent if match
- KB context: searches knowledge articles, prepends to system prompt
- Triggered async on visitor message when session.ai_enabled = true
- On AI failure: falls back to human agent routing

### Phase 9: Automated Triggers — ✅ Complete
- trigger.service.ts: CRUD + evaluateTriggers (conditions: time_on_page, page_url, visit_count, referrer)
- Actions: send_message (system message via SSE), open_widget (SSE trigger_action)
- Each trigger fires once per session (tracked in session.metadata.fired_triggers[])
- Evaluation integrated into heartbeat endpoint (visitor sends context with heartbeats)
- API routes: GET/POST /api/triggers, GET/PATCH/DELETE /api/triggers/[id]

### Phase 10: Ticketing — ✅ Complete
- ticket.service.ts: CRUD, status transitions, assignment, merge (combines messages, closes source)
- Ticket list page with status/priority filters, ticket detail page with reply thread
- Messages stored as chat_messages linked to ticket's session
- Ticket merge: POST /api/tickets/[id]/merge with {merge_into_id}
- API routes: GET/POST /api/tickets, GET/PATCH/DELETE /api/tickets/[id], GET/POST /api/tickets/[id]/messages

### Phase 11: SLA Management — ✅ Complete
- sla.service.ts: policies stored as JSONB in chat_config (no separate table)
- Checks first_response and resolution SLA breaches
- Cron route: POST /api/cron/sla-check (checks all entities, broadcasts breaches via SSE)
- API routes: GET/POST /api/sla, PATCH/DELETE /api/sla/[id]

### Phase 12: Customer Self-Service Portal — ✅ Complete
- Magic link login (JWT, 15min expiry, logs to console in dev)
- Portal pages at /portal/: login, verify, dashboard (ticket list), ticket detail with reply
- Portal API: POST /api/portal/login, GET /api/portal/verify, GET/POST /api/portal/tickets, GET/POST /api/portal/tickets/[id]
- Middleware bypasses /portal/* routes for separate auth flow
- Portal cookie: chat_portal_token (7-day expiry)

### Phase 13: Public REST API + Webhooks + Push — ✅ Complete
- API key auth: SHA-256 hashed keys in chat_api_keys table, Bearer token auth
- v1 REST API: GET/POST /api/v1/sessions, /sessions/[id], /sessions/[id]/messages, /tickets, /tickets/[id], /visitors, /analytics
- webhook.service.ts: HMAC-signed dispatch, 3 retries with exponential backoff
- push.service.ts: web-push via VAPID keys, subscribe/unsubscribe routes
- API key management: GET/POST /api/api-keys, DELETE /api/api-keys/[id]

### Phase 14: Settings + Analytics + QA — ✅ Complete
- Settings page with 9 tabs: Widget, AI, Business, Routing, Canned Responses, Triggers, Webhooks, API Keys, Billing
- analytics.service.ts: 10 SQL queries (session count, avg response, resolution rate, CSAT, sessions/day, message breakdown, agent leaderboard, busiest hours, AI usage, ticket stats)
- Analytics page with date range (7/30/90 days), KPI cards, breakdown panels
- QA page: review sessions on rubric (helpfulness/accuracy/tone 1-5), stored as JSONB in session.metadata

### Phase 15: Stripe Billing — ✅ Complete
- tiers.ts: plan definitions (free/branding/ai/branding_ai), canAccess(plan, feature)
- stripe.ts: createAddonCheckout, createPortalSession, constructWebhookEvent
- Billing API: GET /api/billing (current plan), POST /api/billing (create checkout), POST /api/billing/portal
- Webhook handler: POST /api/webhooks/stripe (checkout.session.completed → upgrade, subscription.deleted → downgrade)
- Plans: free, branding (£24.99/mo), ai (£24.99/mo), branding_ai (both)
