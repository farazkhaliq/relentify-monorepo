# Relentify Communications Platform — Master Plan

## Vision

Replace Chatwoot and build a layered communications platform that competes with Tawk.to (free chat), Intercom (messaging), and Zendesk (full helpdesk). Per-seat pricing like them, but slightly cheaper with slightly more features at every tier.

**Strategy**: Match every feature competitors offer. Be slightly more generous on things that cost us nothing (zero marginal cost features). Charge slightly less per seat. For things that cost us per-use (AI, voice, SMS), either include a bucket or pass usage costs through.

**Four products, same codebase:**
```
CRM ⊃ Connect ⊃ Chat
```

**Four deliverables (separate detailed plans each):**
1. **29chat** — Standalone webchat (Tawk.to competitor)
2. **30connect** — Multi-channel helpdesk (Intercom + Zendesk competitor)
3. **CRM Integration** — Embed Connect into 25crm natively (replaces old read-only comms + removes Gemini)
4. **Marketing Pages** — Comparison/pricing pages on relentify.com

**Key constraints:**
- AI = generic HTTP interface (OpenAI-compatible `fetch()`). No LLM SDK dependencies.
- Voice via Twilio Voice SDK (full VoIP — browser calls, IVR, recording, voicemail)
- Per-seat pricing (matching competitor model), priced in £ with $ shown via region switcher
- Shared code via `@relentify/chat` and `@relentify/connect` packages
- CRM imports Connect directly (not via API)

---

## Pricing

### 29chat (Webchat) — matches Tawk.to's model exactly

| | Tawk.to | Relentify Chat |
|--|---------|---------------|
| Base product | Free | **Free** |
| Remove branding | +$29/mo | **+£24.99/mo** |
| AI Assist | +$29/mo | **+£24.99/mo** |
| Both | $58/mo | **£49.98/mo** |

Everything Tawk.to offers free, we offer free. Same add-on model, slightly cheaper at each level. No bundle — matches Tawk.to's exact pricing structure.

### 30connect (Helpdesk) — 5 tiers, per seat, undercuts Zendesk + Intercom

| Tier | Price (£/agent/mo annual) | Undercuts | Key unlock |
|------|--------------------------|-----------|-----------|
| **Starter** | **£12** | Zendesk Support Team £15 | Email-only helpdesk |
| **Essentials** | **£20** (~$25) | Intercom Essential $29 | Full messaging + chat + social |
| **Growth** | **£39** | Zendesk Suite Team £45 | Omnichannel + AI + voice + SLAs |
| **Professional** | **£75** | Zendesk Suite Professional £89 | Advanced routing, IVR, copilot, QA, workflows |
| **Enterprise** | **£119** | Zendesk Suite Enterprise £139 | Custom roles, audit, sandbox, AI auto-QA |

---

## Competitor Comparison: 29chat vs Tawk.to

For marketing page at `relentify.com/chat`.

| Feature | Tawk.to | Relentify Chat |
|---------|---------|---------------|
| **Free (both)** | | |
| Unlimited agents | ✅ | ✅ |
| Unlimited chat history | ✅ | ✅ |
| Customisable widget | ✅ | ✅ |
| Pre-chat forms | ✅ | ✅ |
| Offline forms | ✅ | ✅ |
| File sharing | ✅ | ✅ |
| Chat ratings (CSAT) | ✅ | ✅ |
| Visitor monitoring | ✅ | ✅ |
| Page tracking | ✅ | ✅ |
| Automated triggers | ✅ | ✅ |
| Canned responses | ✅ | ✅ |
| Knowledge base | ✅ | ✅ |
| Ticketing | ✅ | ✅ |
| Agent internal notes | ✅ | ✅ |
| Chat transfer | ✅ | ✅ |
| Desktop notifications | ✅ | ✅ (Web Push) |
| Analytics & reports | ✅ | ✅ |
| Departments / routing | ✅ | ✅ |
| Webhooks API | ✅ | ✅ |
| JavaScript API | ✅ | ✅ |
| Visitor ban/block | ✅ | ✅ |
| Multi-language widget | ✅ | ✅ |
| Customer portal | ❌ | ✅ |
| SLA management | ❌ | ✅ |
| Collision detection | ❌ | ✅ |
| **Paid add-ons** | | |
| Remove branding | +$29/mo | +£24.99/mo |
| AI Assist (auto-reply, summaries, BYOK) | +$29/mo | +£24.99/mo |

---

## Competitor Comparison: 30connect vs Zendesk

For marketing page at `relentify.com/connect`. Zendesk UK prices from zendesk.co.uk (April 2026).

### Tier 1: Email-Only

| | Zendesk Support Team **£15**/agent | Relentify Starter **£12**/agent |
|--|---|---|
| Email ticketing | ✅ | ✅ |
| Facebook & X | ✅ | ✅ |
| Macros / canned responses | ✅ | ✅ |
| Automations & triggers | ✅ | ✅ |
| Prebuilt analytics | ✅ | ✅ |
| Customer portal | ❌ | ✅ |
| Knowledge base | ❌ | ✅ (1) |
| CSAT surveys | ❌ | ✅ |
| Business hours | ❌ | ✅ |

### Tier 2: Full Suite

| | Zendesk Suite Team **£45**/agent | Relentify Growth **£39**/agent |
|--|---|---|
| Everything below | ✅ | ✅ |
| AI agents | ✅ (5 ARs/agent/mo) | ✅ (10 ARs/agent/mo) |
| Messaging + live chat | ✅ | ✅ |
| Social (Instagram, WhatsApp, Slack) | ✅ | ✅ |
| Phone + call routing | ✅ | ✅ (usage-based) |
| 1 help centre | ✅ | ✅ |
| SLAs | ❌ (needs Professional £89) | ✅ |
| CSAT surveys | ❌ (needs Professional) | ✅ |
| Business hours | ❌ (needs Professional) | ✅ |
| Multiple ticket forms | ❌ (needs Professional) | ✅ |
| Customer portal | ❌ (needs Professional) | ✅ |
| Basic bots (3 flows) | Standard only | ✅ |
| AI overage | $1.50-$2.00/resolution | $0.99/resolution |

### Tier 3: Advanced

| | Zendesk Professional **£89**/agent | Relentify Professional **£75**/agent |
|--|---|---|
| Everything below | ✅ | ✅ |
| SLAs | ✅ | ✅ (already in Growth) |
| CSAT + satisfaction reasons | ✅ | ✅ |
| Skills-based routing | ✅ | ✅ |
| IVR phone menu | ✅ | ✅ |
| Custom reports + real-time | ✅ | ✅ |
| Side conversations | ✅ | ✅ |
| Up to 5 help centres | ✅ | ✅ |
| 100 light agents | ✅ | ✅ |
| Copilot writing tools | ✅ | ✅ |
| AI resolutions | 10/agent, $1.50+ overage | 20/agent, $0.99 overage |
| Unlimited bots | ❌ | ✅ |
| Workflow automation | ❌ | ✅ unlimited |
| Basic QA | ❌ ($35/agent add-on) | ✅ included |
| Scheduled reports | ✅ | ✅ |

### Tier 4: Enterprise

| | Zendesk Enterprise **£139**/agent | Relentify Enterprise **£119**/agent |
|--|---|---|
| Everything below | ✅ | ✅ |
| Custom roles | ✅ | ✅ |
| Audit log | ✅ | ✅ |
| Sandbox environment | ✅ | ✅ |
| Approval workflows | ✅ | ✅ |
| Up to 300 help centres | ✅ | ✅ unlimited |
| Contextual workspaces | ✅ | ✅ |
| Ticket queues | ✅ | ✅ |
| SSO | ✅ | ✅ |
| AI resolutions | 15/agent, $1.50+ overage | 50/agent, $0.99 overage |
| QA + AI scoring | ❌ ($35/agent add-on) | ✅ included |

**Zendesk fully loaded**: Enterprise £139 + Copilot £40 + QA £28 + WFM £20 = **~£227/agent/mo**
**Relentify Enterprise**: **£119/agent/mo** (QA included, copilot included, no WFM yet)

---

## Competitor Comparison: 30connect vs Intercom

For marketing page at `relentify.com/connect`. Intercom charges in USD globally.

### Tier 1: Entry

| | Intercom Essential **$29**/seat | Relentify Essentials **$25**/seat |
|--|---|---|
| Shared inbox | ✅ | ✅ |
| Live chat widget | ✅ | ✅ |
| Email channel | ✅ | ✅ |
| Ticketing | ✅ | ✅ |
| Help centre | ✅ | ✅ |
| Macros / canned responses | ✅ | ✅ |
| Basic bots | ✅ | ✅ (3 bots) |
| Basic reporting | ✅ | ✅ |
| Round-robin routing | Basic | ✅ |
| Facebook/Instagram | ❌ | ✅ |
| Customer portal | ❌ | ✅ |
| CSAT surveys | ❌ | ✅ |
| Business hours | ❌ | ✅ |
| AI auto-reply | +$0.99/resolution | +$0.99/resolution (10 included) |

### Tier 2: Mid

| | Intercom Advanced **$85**/seat | Relentify Professional **£75**/seat |
|--|---|---|
| Everything below | ✅ | ✅ |
| Multiple inboxes | ✅ | ✅ |
| Workflows / automation | ✅ | ✅ unlimited |
| Side conversations | ✅ | ✅ |
| Round-robin assignment | ✅ | ✅ |
| Multilingual help centre | ✅ | ✅ |
| SLAs | ✅ | ✅ (already in Growth) |
| Custom reports | ❌ | ✅ |
| Unlimited bots | ❌ | ✅ |
| Voice (VoIP) | ❌ | ✅ (usage-based) |
| Scheduled reports | ❌ | ✅ |
| Basic QA | ❌ | ✅ |
| AI copilot | +$0.99/use | +$0.99/use (20 included) |

### Tier 3: Top

| | Intercom Expert **$132**/seat | Relentify Enterprise **£119**/seat |
|--|---|---|
| Everything below | ✅ | ✅ |
| Custom roles | ✅ | ✅ |
| Workload management | ✅ | ✅ |
| SSO | ✅ | ✅ |
| Advanced SLAs | ✅ | ✅ |
| QA (AI scoring) | ❌ | ✅ included |
| Audit log | ❌ | ✅ |
| Real-time dashboard | ❌ | ✅ |
| Sandbox | ❌ | ✅ |
| AI copilot | +$0.99/use | +$0.99/use (50 included) |

---

## Connect Feature Scope — Complete Grid

| Feature | Starter £12 | Essentials £20 | Growth £39 | Professional £75 | Enterprise £119 |
|---------|------------|----------------|------------|-------------------|-----------------|
| **Channels** | | | | | |
| Email ticketing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Social (FB, X) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Instagram DMs | ❌ | ✅ | ✅ | ✅ | ✅ |
| Live chat + messaging | ❌ | ✅ | ✅ | ✅ | ✅ |
| WhatsApp | ❌ | ❌ | ✅ | ✅ | ✅ |
| Phone/voice (usage-based) | ❌ | ❌ | ✅ | ✅ | ✅ |
| SMS (usage-based) | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Ticketing** | | | | | |
| Ticket views + filters | ✅ | ✅ | ✅ | ✅ | ✅ |
| Macros / canned responses | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tags + custom fields | ✅ | ✅ | ✅ | ✅ | ✅ |
| Automations + triggers | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multiple ticket forms | ❌ | ❌ | ✅ | ✅ | ✅ |
| Custom ticket statuses | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ticket merging | ✅ | ✅ | ✅ | ✅ | ✅ |
| Collision detection | ✅ | ✅ | ✅ | ✅ | ✅ |
| Side conversations | ❌ | ❌ | ❌ | ✅ | ✅ |
| Light agents (view-only) | ❌ | ❌ | ❌ | 100 | Unlimited |
| Approval workflows | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Self-Service** | | | | | |
| Knowledge base | 1 | 1 | 1 | 5 | Unlimited |
| Customer portal | ✅ | ✅ | ✅ | ✅ | ✅ |
| CSAT surveys | ✅ | ✅ | ✅ | ✅ | ✅ |
| Business hours | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AI** | | | | | |
| AI resolutions included/agent/mo | 0 | 10 | 10 | 20 | 50 |
| AI overage rate | — | $0.99 | $0.99 | $0.99 | $0.99 |
| Basic bots (flows) | ❌ | 3 | 3 | Unlimited | Unlimited |
| Copilot writing tools | ❌ | ❌ | ❌ | ✅ | ✅ |
| AI copilot (agent assist) | ❌ | ❌ | ❌ | $0.99/use | Included in bucket |
| AI auto-QA scoring | ❌ | ❌ | ❌ | ❌ | ✅ |
| BYOK (own AI key) | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Routing** | | | | | |
| Round-robin | ❌ | ✅ | ✅ | ✅ | ✅ |
| Least-busy | ❌ | ✅ | ✅ | ✅ | ✅ |
| Skills-based routing | ❌ | ❌ | ❌ | ✅ | ✅ |
| IVR phone menu | ❌ | ❌ | ❌ | ✅ | ✅ |
| Ticket queues | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Voice (Twilio)** | | | | | |
| Inbound/outbound calls | ❌ | ❌ | ✅ | ✅ | ✅ |
| Call recording | ❌ | ❌ | ✅ | ✅ | ✅ |
| Voicemail | ❌ | ❌ | ✅ | ✅ | ✅ |
| IVR / phone trees | ❌ | ❌ | ❌ | ✅ | ✅ |
| Warm transfer | ❌ | ❌ | ❌ | ✅ | ✅ |
| Call monitoring | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Bots & Automation** | | | | | |
| Bot builder (no-code) | ❌ | 3 flows | 3 flows | Unlimited | Unlimited |
| Workflow automation | ❌ | ❌ | ❌ | Unlimited | Unlimited |
| **Analytics** | | | | | |
| Prebuilt dashboards | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| Real-time dashboard | ❌ | ❌ | ❌ | ✅ | ✅ |
| Scheduled reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Quality** | | | | | |
| Basic QA (manual review) | ❌ | ❌ | ❌ | ✅ | ✅ |
| AI auto-QA scoring | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Admin** | | | | | |
| SLAs | ❌ | ❌ | ✅ | ✅ | ✅ |
| Custom roles | ❌ | ❌ | ❌ | ❌ | ✅ |
| Audit log | ❌ | ❌ | ❌ | ❌ | ✅ |
| Sandbox | ❌ | ❌ | ❌ | ❌ | ✅ |
| SSO | ❌ | ❌ | ❌ | ❌ | ✅ |
| Webhook API | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## What We Build vs What We Skip

### ✅ BUILD

**Ticketing**: email, views, filters, macros, tags, custom fields, multiple forms, custom statuses, merging, collision detection, side conversations, light agents, CSAT, approval workflows

**Live Chat**: widget.js (~15KB, Shadow DOM), pre-chat forms, offline forms, file sharing, triggers, canned responses, internal notes, transfer, visitor monitoring, page tracking, push notifications, multi-language, visitor ban, SSE + polling fallback

**Knowledge Base**: articles, categories, PG full-text search, public page + in-widget, multi-language, draft/published

**AI (Generic HTTP — no SDKs)**: auto-reply, intent detection, copilot (agent assist), ticket summaries, sentiment analysis, auto-QA scoring, escalation keywords, KB context injection

**AI billing model**:
- **Default**: Relentify picks the model (e.g. GPT-4o-mini). Customer just sees "AI enabled". We charge $0.99/resolution, our cost ~$0.05-0.20. Max margin, simplest UX. We can switch providers anytime.
- **Customer choice**: Customer picks from our provider list (e.g. "GPT-4o", "Claude Sonnet", "Llama"). All calls go through our proxy — customer never needs their own key. We bill at markup via Stripe metered usage.
- **BYOK**: Customer provides own API URL + key. Calls still routed through our server so we can meter. We charge a platform fee. Available on higher tiers only.
- All three options use the same generic HTTP interface — just different config source.

**Multi-Channel**: web chat, email (Resend inbound/outbound), WhatsApp Business API, SMS (Twilio), Facebook Messenger, Instagram DMs (Meta Business API)

**Voice (Twilio Voice SDK)**: inbound/outbound browser calls, IVR, call recording, voicemail, queue + hold music, warm transfer, call monitoring, click-to-call, auto-ticket from call

**Bots**: no-code visual flow builder (message, buttons, collect, condition, action, AI reply, delay nodes), bot execution engine with state tracking

**Workflows**: event-driven if/then rules (trigger → conditions → actions), form-based builder, execution logging

**SLAs**: policies with response/resolution targets, business hours, breach notifications, reporting

**Customer Portal**: magic link login, ticket submission, status tracking, KB search, CSAT rating

**QA**: conversation review + scoring rubric, AI auto-scoring, coaching notes, QA dashboard

**Analytics**: prebuilt dashboards, custom reports, real-time (SSE), scheduled delivery, cross-channel, voice, agent leaderboard, busiest hours heatmap

**Admin**: custom roles, audit log, sandbox mode, SSO, approval workflows

**Billing**: Stripe subscriptions, usage-based AI metering, 5 Connect tiers + Chat free/pro

### ⚠️ DEFERRED

Article versioning, content cues (AI suggests articles to write), team publishing (article approval workflow), conditional ticket fields, X/Twitter DMs, LINE/WeChat/Apple Messages, custom dashboard builder (drag-drop), WFM (workforce management), community forums, product tours, HIPAA compliance, custom objects.

### ❌ NOT BUILDING

| Feature | Why |
|---------|-----|
| Hired agents (Tawk.to) | Service business, not software |
| 1,500+ app marketplace | Build webhook API + key integrations instead |

---

## Voice Implementation (Twilio)

### Architecture
```
Browser (Agent) ←→ Twilio Voice SDK (WebRTC) ←→ Twilio ←→ PSTN
```

### Database
```sql
chat_voice_config (entity_id UNIQUE, twilio_account_sid, twilio_auth_token_encrypted,
  twilio_phone_number, voicemail_enabled, recording_enabled, ivr_flow JSONB,
  queue_music_url, max_queue_wait_seconds)

chat_calls (entity_id, session_id, direction, caller_number, callee_number,
  agent_id, status, recording_url, recording_duration_seconds, voicemail_url,
  twilio_call_sid, started_at, answered_at, ended_at)
```

### API routes
- `/api/voice/token` — Twilio Client token for agent browser
- `/api/voice/incoming` — Twilio webhook (TwiML response)
- `/api/voice/status` — call status callback
- `/api/voice/outbound` — initiate outbound call
- `/api/voice/transfer` — warm transfer
- `/api/voice/config` — voice settings

### Cost model
- Twilio: ~£0.01/min outbound, ~£0.007/min inbound (UK)
- Phone number: ~£1/mo
- Usage passed to customer (included in plan or billed via Stripe metered billing)

---

## Package Architecture

```
@relentify/chat (packages/chat/)
├── services: session, message, visitor, config, knowledge, routing, ai, analytics,
│             sse, trigger, ticket, webhook, upload, push, sla, qa
├── components: ChatThread, ReplyInput, SessionList, VisitorSidebar, VisitorMonitor,
│              CannedResponsePicker, TicketList, TicketDetail, CustomerPortal,
│              QAReview, SLADashboard
└── hooks: use-sse, use-api

@relentify/connect (packages/connect/) — depends on @relentify/chat
├── services: conversation, whatsapp, email, sms, facebook, channel, template,
│             bot, workflow, voice
├── components: UnifiedInbox, ConversationThread, ChannelSelector, ComposeMessage,
│              BotBuilder, WorkflowBuilder, VoicePanel, VoiceDialer
└── re-exports @relentify/chat

29chat  → @relentify/chat
30connect → @relentify/connect
25crm   → @relentify/connect (after CRM rebuild)
```

Services start in `apps/29chat/` and get extracted to `packages/chat/` when CRM Integration begins.

---

## Build Order

| # | Deliverable | Detailed Plan File | Depends On | Next |
|---|-------------|-------------------|------------|------|
| 1 | **29chat** | `PLANS/29chat-build.md` | Nothing — start here | → 30connect |
| 2 | **30connect** | `PLANS/30connect-build.md` | 29chat complete | → CRM Integration + Marketing (parallel) |
| 3 | **CRM Integration** | `PLANS/crm-integration-build.md` | 29chat + 30connect | Done (parallel with #4) |
| 4 | **Marketing Pages** | `PLANS/marketing-pages-build.md` | 29chat + 30connect | Done (parallel with #3) |

### 29chat — 15 build phases
1. Scaffold + database (9 tables) + Docker + Caddy
2. Public widget API (config, session, messages, upload, identify, knowledge, visitors)
3. SSE real-time + polling fallback
4. Embeddable widget.js (~15KB, Shadow DOM, full Tawk.to parity)
5. Agent dashboard (inbox, thread, reply, sidebar, notes, collision detection)
6. Auto-routing + departments
7. Knowledge base (CRUD + PG full-text search)
8. AI integration (generic HTTP — auto-reply, intent, copilot, summaries, sentiment)
9. Automated triggers (time, URL, visit count → auto-message)
10. Ticketing (email tickets, offline→ticket, chat→ticket, merge, custom fields/statuses)
11. SLA management (policies, breach notifications, reporting)
12. Customer self-service portal (magic link, ticket view, KB search)
13. Public REST API + webhook API + desktop push notifications
14. Settings pages + analytics + QA basics
15. Stripe billing + MCP tests + E2E tests + infrastructure

### 30connect — 10 build phases
1. Scaffold + database (connect_* tables) + Docker + Caddy
2. Channel integrations (WhatsApp, email, SMS, Facebook/Instagram)
3. Unified multi-channel inbox + conversation management
4. No-code chatbot builder (visual flow editor)
5. Workflow automation (if/then rules)
6. Voice — Twilio (inbound, outbound, IVR, recording, voicemail)
7. Advanced analytics (cross-channel, voice, custom reports, scheduled)
8. Advanced QA (AI scoring, coaching)
9. Settings + Stripe billing (5-tier pricing)
10. MCP tests + E2E tests + infrastructure

### CRM Integration — one phase, does both "add new" and "remove old"
1. Extract `@relentify/chat` → `packages/chat/`, `@relentify/connect` → `packages/connect/`
2. Add Connect nav + unified inbox to 25crm (replaces old read-only comms page)
3. Remove old `communications.service.ts`, `crm_communications` API routes, Gemini dependency
4. Contact detail: full conversation history across all channels, click-to-call
5. Auto-link visitors to CRM contacts by email
6. Old `crm_communications` data kept as read-only archive
7. Full channel management from CRM settings

### Marketing Pages — 4 phases (in apps/20marketing/)
1. `/chat` — landing + Tawk.to comparison table + pricing + widget demo
2. `/connect` — landing + Intercom comparison + Zendesk comparison + pricing
3. `/pricing` — all plans side by side + savings calculator
4. Widget demo page — live interactive widget

---

## Infrastructure

| Resource | Before (Chatwoot) | After (Chat + Connect) |
|----------|-------------------|----------------------|
| Containers | 3 | 2 (29chat + 30connect) |
| Disk | ~2GB | ~400MB |
| RAM | ~800MB | ~300MB |
| Tables | 88 | ~25 (chat_* + connect_*) |
| External deps | Ruby, Redis, Sidekiq | Node.js + Postgres + Twilio |

---

## Verification

1. **29chat**: widget → visitor chats → agent replies → SSE → files → CSAT → triggers → tickets → KB → AI → all tests pass
2. **30connect**: multi-channel inbox → WhatsApp/email/SMS/Facebook → bots → workflows → voice calls → QA → SLAs → all tests pass
3. **CRM**: Chat in nav → inbox works → contact history → visitor linked → existing tests pass
4. **Marketing**: /chat loads → comparison table → pricing → widget demo → /connect → calculator
