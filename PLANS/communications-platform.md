# Relentify Communications Platform — Chat, Connect, CRM

## Context
Replace Chatwoot (2GB disk, 800MB RAM, 3 containers, 88 tables) with a layered product suite. Three products, same database, same ingredients. Each is a separate Next.js app in the monorepo.

## Product Layers

| Product | Domain | Port | What it is | Competitor |
|---------|--------|------|------------|------------|
| **Relentify Chat** | chat.relentify.com | 3029 | Webchat widget + agent inbox | Tawk.to |
| **Relentify Connect** | connect.relentify.com | 3030 | Chat + WhatsApp + Email + SMS unified inbox | Crisp / Intercom |
| **Relentify CRM** | crm.relentify.com | 3025 | Connect + Contacts + Jobs + Bookings + Invoicing + Reports | Any service business |

Under the hood: `CRM ⊃ Connect ⊃ Chat`. Same `chat_*` tables, same API layer.

Note: CRM v1 is built for estate agents (contacts, properties, tenancies). The vision is a general-purpose CRM for any service business — plumbers, hairdressers, dentists, anyone. The property-specific features become one "industry module" alongside others. Chat and Connect are industry-agnostic from day one.

## Pricing

### Relentify Chat — mirrors Tawk.to's pricing structure

Tawk.to's model: free product + paid add-ons. We mirror it exactly, slightly better features, slightly cheaper.

| | Tawk.to | Price | Relentify Chat | Price |
|--|---------|-------|----------------|-------|
| Base product | Free (unlimited agents, chats, history, canned responses, file sharing, visitor monitoring, triggers, KB, analytics) | $0 | Free (same as Tawk.to + pre-chat form, proactive greetings, webhook API, better widget customisation) | £0 |
| Remove branding | Add-on | $29/mo | Add-on | £25/mo |
| AI Assist | Add-on (Apollo bot) | $29/mo | Add-on (provider-agnostic, AI reads KB) | £25/mo |
| Branding + AI bundle | Both add-ons | $58/mo | Bundle | £39/mo |
| BYOK (own LLM key) | N/A | N/A | Available on AI bundle | Included in £39 |
| Hired agents | $1/hr | $1/hr | Not offered | — |

**Why we win:** Slightly cheaper at every tier. Better free (pre-chat form, proactive greetings, webhook API). Better AI (provider-agnostic vs Tawk.to's basic Apollo). Better UX (modern UI, reliable notifications). Not so cheap people think we're rubbish.

### Relentify Connect — mirrors Intercom's pricing structure

Intercom is the market leader (20% share). Their model: per-seat + per-resolution + per-message. People hate the unpredictable costs. We offer flat pricing, slightly cheaper, no per-seat.

| | Intercom | Price | Relentify Connect | Price |
|--|----------|-------|-------------------|-------|
| Base (webchat + email + WhatsApp) | Essential | $29/seat/mo | Starter (unlimited seats) | £25/mo |
| Advanced (automation, routing, teams) | Advanced | $85/seat/mo | Growth (unlimited seats) | £49/mo |
| AI | Fin AI | +$0.99/resolution | AI included | Included in plan |
| WhatsApp outbound | Per-message | $0.03-0.10/msg | Included | Included in plan |
| SMS | Per-message | Varies | Growth only | Included in plan |

**Why we win:** Flat pricing (no per-seat, no per-resolution surprises). A 5-agent team on Intercom Essential = $145/mo. On Connect Starter = £25/mo. No contest. Same core features.

### Relentify CRM — Connect built in natively

CRM is a separate product with its own pricing. Full Connect capabilities are built into the CRM natively (not via API). CRM customers get webchat + WhatsApp + email + SMS as part of their CRM subscription.

### How the three products relate

```
Chat = standalone webchat (own app, own billing)
Connect = standalone multi-channel inbox (own app, own billing)
CRM = full platform with Connect built in natively (not via API)
```

- Chat and Connect are separate apps sold to separate customers
- CRM does NOT call Chat/Connect APIs — CRM includes the Connect code directly as a built-in module
- CRM's communications tab will be rebuilt with Connect's full send/receive engine
- Chat has a public API (for developers embedding the widget)
- Connect has an API (for businesses building custom dashboards)
- CRM customers don't need Chat or Connect subscriptions — it's all included

### What CRM already has (will be rebuilt with Connect code)
The 25crm communications page currently has:
- Email, Call, WhatsApp tabs (read/log only — agents manually record past communications)
- Contact linking, property linking
- AI analysis via Gemini
- `crm_communications` table

This will be replaced by Connect's live send/receive engine when Connect is built.

### AI — provider-agnostic, no Gemini dependency
Build a provider interface. We plug in whatever LLM we want. Customers on BYOK provide their own key and choose their provider. The platform default is our choice and can change anytime.

### Build order
1. **29chat** — standalone Tawk.to competitor (this plan)
2. **CRM integration** — embed Chat code into 25crm (shared components, not API)
3. **30connect** — standalone Intercom competitor (future project)
4. **CRM rebuild** — CRM communications tab rebuilt with Connect's engine natively

## Architecture — 29chat (Phase 1)

### New app: `/opt/relentify-monorepo/apps/29chat/`
- Next.js 15, App Router, same stack as all monorepo apps
- Port 3029, domain `chat.relentify.com`
- Container: `29chat`, on `infra_default` network
- Auth via 21auth (same pattern as all apps)
- Stripe billing (same pattern as 27sign)

### Database — 6 tables (`chat_` prefix in `relentify` DB)

```sql
chat_sessions (
  id, entity_id, visitor_id, assigned_agent_id,
  status (active/waiting/resolved/archived),
  channel (web), ai_enabled,
  metadata JSONB (user agent, referrer URL, page URL),
  created_at, updated_at, resolved_at
)

chat_messages (
  id, session_id, entity_id,
  sender_type (visitor/agent/ai), sender_id,
  body, attachment_url,
  metadata JSONB, created_at
)

chat_visitors (
  id, entity_id, fingerprint, name, email,
  ip_address, user_agent, page_url,
  last_seen_at, created_at
)

chat_config (
  id, entity_id UNIQUE,
  -- Widget settings
  widget_enabled, widget_color, widget_position,
  widget_avatar_url, widget_font_family,
  greeting_message, offline_message,
  pre_chat_form_enabled, pre_chat_fields JSONB,
  branding_hidden,
  -- Business info (feeds AI system prompt)
  business_name, business_description,
  -- AI settings
  ai_enabled, ai_provider, ai_model,
  ai_api_key_encrypted,
  ai_system_prompt, knowledge_base,
  -- Behaviour
  operating_hours JSONB,
  auto_escalate_keywords TEXT[],
  proactive_greeting_enabled, proactive_greeting_delay_seconds,
  auto_route_enabled, auto_route_strategy (round_robin/least_busy),
  -- Canned responses
  canned_responses JSONB,
  created_at, updated_at
)

chat_ai_usage (
  id, entity_id, month ('2026-04'),
  ai_replies, ai_tokens_in, ai_tokens_out,
  UNIQUE(entity_id, month)
)

chat_knowledge_articles (
  id, entity_id, title, body, category,
  sort_order, published, created_at, updated_at
)
```

### 29chat API Routes

**Public (widget — no auth):**
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/widget/config` | GET | Widget fetches config by `?entity=UUID` |
| `/api/widget/session` | POST | Start new session (creates visitor) |
| `/api/widget/session/[id]/messages` | GET/POST | Send/receive; POST triggers AI if enabled |
| `/api/widget/session/[id]/identify` | POST | Visitor provides name/email |
| `/api/widget/session/[id]/stream` | GET | SSE — real-time messages + typing |
| `/api/widget/knowledge` | GET | Public FAQ/knowledge base articles by `?entity=UUID` |

**Authenticated (agent dashboard):**
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/config` | GET/PUT | Widget + AI settings |
| `/api/sessions` | GET | List sessions (filter by status) |
| `/api/sessions/[id]` | GET/PATCH | Detail, assign, resolve |
| `/api/sessions/[id]/messages` | GET/POST | Agent reads/sends messages |
| `/api/sessions/[id]/stream` | GET | SSE for agent |
| `/api/events` | GET | SSE — new session notifications |
| `/api/analytics` | GET | Chat volume, response times, AI usage |
| `/api/canned-responses` | GET/POST/DELETE | Manage canned responses |
| `/api/knowledge` | GET/POST | Manage knowledge base articles |
| `/api/knowledge/[id]` | GET/PUT/DELETE | Individual article |
| `/api/agents` | GET | List agents for assignment |
| `/api/export/[sessionId]` | GET | Export transcript as text/PDF |
| `/api/billing` | GET | Current plan, usage, Stripe portal link |

### 29chat Pages

**Auth:** `/(auth)/login`, `/signup` — via 21auth

**Agent dashboard:**
| Page | Purpose |
|------|---------|
| `/(app)/inbox` | Active/waiting/resolved chats with search + filters |
| `/(app)/inbox/[sessionId]` | Chat thread + reply box + visitor sidebar |
| `/(app)/knowledge` | Knowledge base article editor |
| `/(app)/analytics` | Charts: volume, response time, AI resolution rate, busiest hours |
| `/(app)/settings` | Tabs: Widget, AI, Business, Billing, Canned Responses, Routing |

### Real-time — Server-Sent Events (SSE)

Why SSE not WebSocket:
- Auto-reconnects (built into browser EventSource API — solves Tawk.to's disconnect problem)
- Works through Caddy with zero config
- Simpler server code (ReadableStream in Next.js)
- Sufficient for chat (one-directional server→client push; client→server is POST)

Fallback: if SSE connection drops, widget polls `/messages?since=TIMESTAMP` every 3 seconds until SSE reconnects. This is the belt-and-suspenders that Tawk.to doesn't do.

Agent notification fallback: if agent doesn't view message within 60 seconds, send email notification (uses existing platform email service).

### AI Integration

**File:** `src/lib/services/ai.service.ts`

- Default: no AI (free tier). Agent replies manually.
- Pro: AI enabled, uses platform Gemini key. Cost absorbed by platform (metered in chat_ai_usage).
- Business: BYOK — customer provides own key for OpenAI/Anthropic/Groq/Gemini.

Providers: Gemini (existing `@google/generative-ai`), OpenAI (`openai`), Anthropic (`@anthropic-ai/sdk`), Groq (`groq-sdk`).

System prompt built from: business_name + business_description + ai_system_prompt + knowledge_base articles + operating_hours + auto_escalate_keywords.

### Embeddable Widget — `public/widget.js`

~15KB vanilla JS. Customer pastes:
```html
<script src="https://chat.relentify.com/widget.js" data-entity="ENTITY_UUID"></script>
```

Features:
- Floating button (configurable colour, position, avatar)
- Chat box with message history
- Typing indicator (AI generating / agent typing)
- Pre-chat form (if configured)
- File upload button (pro+)
- Knowledge base search button
- "Powered by Relentify" badge (free) / hidden (pro+)
- Mobile responsive
- localStorage session persistence (returning visitors resume)
- SSE with polling fallback

### Auto-routing (free, no AI cost)

Rule-based, runs on message create:
- **Round robin**: assign to next available agent
- **Least busy**: assign to agent with fewest active sessions
- **No agents available**: mark as "waiting", notify all agents
- **Keyword escalation**: if message matches `auto_escalate_keywords`, mark as urgent + notify
- **Operating hours**: outside hours, show offline_message, queue for next day

### Knowledge Base

Two modes:
1. **Public FAQ page** (free): visitors can search articles via widget. No AI.
2. **AI-powered answers** (pro+): AI reads articles and answers questions conversationally.

Articles stored in `chat_knowledge_articles`. Simple title + body + category. Editor in dashboard.

### Analytics (free = basic, pro = full)

All SQL queries on existing data, zero external cost:

**Basic (free):** total chats today/week/month, active sessions count
**Full (pro):** response time avg/p95, resolution rate, AI vs human resolution, busiest hours heatmap, agent performance, visitor satisfaction (optional CSAT), chat volume trends

## Files to Create

### App scaffold
```
apps/29chat/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── next.config.ts
├── middleware.ts
├── database/migrations/001_chat.sql
├── public/widget.js
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── (auth)/login/page.tsx, signup/page.tsx
│   │   ├── (app)/layout.tsx (TopBar nav)
│   │   ├── (app)/inbox/page.tsx
│   │   ├── (app)/inbox/[sessionId]/page.tsx
│   │   ├── (app)/knowledge/page.tsx
│   │   ├── (app)/analytics/page.tsx
│   │   ├── (app)/settings/page.tsx
│   │   └── api/ (all routes listed above)
│   ├── components/
│   │   ├── chat-inbox-list.tsx
│   │   ├── chat-thread.tsx
│   │   ├── chat-reply-box.tsx
│   │   ├── chat-visitor-sidebar.tsx
│   │   ├── chat-notification-badge.tsx
│   │   ├── knowledge-editor.tsx
│   │   ├── analytics-charts.tsx
│   │   ├── settings-widget-tab.tsx
│   │   ├── settings-ai-tab.tsx
│   │   ├── settings-business-tab.tsx
│   │   ├── settings-routing-tab.tsx
│   │   ├── settings-canned-tab.tsx
│   │   └── settings-billing-tab.tsx
│   ├── lib/
│   │   ├── pool.ts
│   │   ├── auth.ts
│   │   ├── audit.ts
│   │   └── services/
│   │       ├── chat.service.ts (sessions, messages, visitors)
│   │       ├── config.service.ts
│   │       ├── ai.service.ts (multi-provider)
│   │       ├── knowledge.service.ts
│   │       ├── analytics.service.ts
│   │       ├── routing.service.ts
│   │       └── billing.service.ts
│   └── hooks/
│       ├── use-api.ts
│       ├── use-chat-stream.ts (SSE hook)
│       └── use-toast.ts
```

## Phase 2: CRM Integration (after Chat ships)

In 25crm:
- Add "Chat" nav item calling 29chat API
- Contact detail page: show chat history via `GET /api/sessions?email=X`
- Communications tab: include chat messages alongside email/calls
- Auto-link: when visitor identifies by email, match to crm_contacts

## Infrastructure

| Item | Detail |
|------|--------|
| Container | `29chat` on port 3029 |
| Caddy | `chat.relentify.com → 29chat:3000` |
| Database | `chat_*` tables in existing `relentify` DB |
| Image size | ~200MB (same stack as other monorepo apps) |
| RAM | ~150MB |
| Chatwoot removed | -2GB disk, -800MB RAM, -3 containers |
| **Net savings** | **-1.8GB disk, -650MB RAM** |

## Build Phases (for implementation)

1. Scaffold app + database migration + Dockerfile
2. Public widget API (session, messages, config)
3. SSE real-time with polling fallback
4. Embeddable widget JS
5. Agent dashboard (inbox, thread, reply)
6. Auto-routing rules (no AI cost)
7. Knowledge base (articles + public search)
8. AI integration (Gemini first, then BYOK providers)
9. Settings pages (widget, AI, business, routing, canned)
10. Analytics dashboard
11. Stripe billing
12. CRM integration (Phase 2)

## Verification
- Widget loads on test page → send message → agent sees it in inbox
- Agent replies → visitor sees it in real time
- SSE disconnects → widget falls back to polling → reconnects → no missed messages
- AI enabled → visitor gets AI response (pro tier)
- Visitor gives email → visitor record linked
- Knowledge base → visitor searches FAQ
- Auto-routing → new chat assigned to least-busy agent
- Analytics → response time chart shows data
- Export → download transcript
- Stripe → upgrade to pro → branding disappears, AI activates
- MCP tests: full API coverage
- E2E tests: widget flow, agent flow, settings, billing
