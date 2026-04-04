# Unified Platform — Master Plan

**Single source of truth** for the communications platform architecture and migration.

Replaces all previous plans:
- ~~`29chat-build.md`~~ — ✅ Done (15/15 phases)
- ~~`30connect-build.md`~~ — ✅ Done (9/10 phases, core complete)
- ~~`crm-integration-build.md`~~ — ✅ Done (shared packages, inbox in CRM)
- ~~`marketing-pages-build.md`~~ — ✅ Done (4 pages on relentify.com)
- ~~`product-composition-architecture.md`~~ — ✅ Decision made (Option C: Single App)

---

## Architecture Decision

**One app. Three domains. Feature flags.**

```
chat.relentify.com    → apps/platform  (product=chat)
connect.relentify.com → apps/platform  (product=connect)
crm.relentify.com     → apps/platform  (product=crm)
```

Each domain hits the same Next.js app. Middleware reads the hostname and sets `x-product`. The nav, pages, and API routes adapt based on the product context.

```
CRM ⊃ Connect ⊃ Chat
```

- **Chat** customers see: Inbox, Tickets, Knowledge Base, Analytics, Visitors, Settings
- **Connect** customers see: everything above + Channels, Bots, Workflows, Templates, Voice, QA
- **CRM** customers see: everything above + Dashboard, Contacts, Properties, Tenancies, Maintenance, Documents, Transactions, Tasks, Reports, Audit Log

---

## What's Already Built

### ✅ Phase 1: Platform Shell (Complete)

**Container:** `platform` on port 3040 — running and healthy.

**Created files:**
| File | Purpose |
|------|---------|
| `apps/platform/package.json` | Combined deps from 29chat + 30connect + 25crm |
| `apps/platform/src/middleware.ts` | Hostname → product routing, auth check, route protection |
| `apps/platform/src/lib/product-context.ts` | `getProduct()` → reads hostname → returns `'chat' \| 'connect' \| 'crm'` |
| `apps/platform/src/lib/feature-flags.ts` | `canAccess(product, feature)` — CRM ⊃ Connect ⊃ Chat |
| `apps/platform/src/lib/pool.ts` | Shared Postgres pool |
| `apps/platform/src/lib/auth.ts` | JWT auth (same as all monorepo apps) |
| `apps/platform/src/lib/cors.ts` | CORS headers for widget API |
| `apps/platform/src/lib/rate-limit.ts` | Rate limiter |
| `apps/platform/src/app/(shared)/layout.tsx` | Adaptive TopBar — nav items show/hide by product |
| `apps/platform/src/app/(shared)/inbox/page.tsx` | Placeholder inbox |
| `apps/platform/src/app/api/health/route.ts` | Health check |
| `apps/platform/Dockerfile` | Standalone build |
| `apps/platform/docker-compose.yml` | Container config (port 3040, 512MB limit) |

**Route groups:**
- `(shared)/` — pages visible to all products (inbox, tickets, KB, analytics, settings, visitors, quality)
- `(chat)/` — chat-only pages (widget config preview, embed snippet)
- `(connect)/` — connect-only pages (bots, workflows, templates, channels)
- `(crm)/` — CRM-only pages (contacts, properties, tenancies, etc.)
- `portal/` — self-service portal (magic link login, ticket view)

---

## Remaining Work

### Phase 2: Move Chat (29chat) into Platform

**What:** Copy all 29chat services, API routes, components, and pages into the platform app.

**Services to copy** (`apps/29chat/src/lib/services/` → `apps/platform/src/lib/services/chat/`):

| Service | Functions |
|---------|-----------|
| `visitor.service.ts` | getOrCreateVisitor, updateVisitor, getVisitorById, banVisitor, getLiveVisitors |
| `session.service.ts` | createSession, getSessionById, updateSession, listSessions, rateSession |
| `message.service.ts` | createMessage, getMessages |
| `config.service.ts` | getConfig, getPublicConfig, ensureConfig, upsertConfig |
| `knowledge.service.ts` | listArticles, getArticleById, createArticle, updateArticle, deleteArticle, searchArticles |
| `routing.service.ts` | assignAgent (round-robin / least-busy) |
| `ai.service.ts` | handleAIReply (escalation, KB context, AI call, fallback) |
| `ai-usage.service.ts` | incrementUsage, getUsage |
| `trigger.service.ts` | CRUD + evaluateTriggers |
| `ticket.service.ts` | CRUD, merge, status transitions |
| `sla.service.ts` | policies CRUD, checkSLAs |
| `upload.service.ts` | handleFileUpload |
| `webhook.service.ts` | dispatchWebhook (HMAC, retries) |
| `push.service.ts` | sendPush, sendToEntity, subscribe |
| `analytics.service.ts` | getAnalytics (10 SQL queries) |
| `sse.service.ts` | SSEManager singleton |

**Other files to copy:**
- `src/lib/crypto.ts` → `platform/src/lib/crypto.ts`
- `src/lib/api-key-auth.ts` → `platform/src/lib/api-key-auth.ts`
- `src/lib/stripe.ts` → `platform/src/lib/stripe.ts`
- `src/lib/tiers.ts` → `platform/src/lib/tiers.ts`
- `public/widget.js` → `platform/public/widget.js`

**API routes to copy** (preserve exact paths so widget.js URLs don't break):

| Source route | Dest route | Auth |
|-------------|-----------|------|
| `/api/widget/*` | Same | Public (CORS) |
| `/api/sessions/*` | Same | JWT |
| `/api/agents` | Same | JWT |
| `/api/visitors/*` | Same | JWT |
| `/api/tickets/*` | Same | JWT |
| `/api/knowledge/*` | Same | JWT |
| `/api/triggers/*` | Same | JWT |
| `/api/config` | Same | JWT |
| `/api/analytics` | Same | JWT |
| `/api/quality` | Same | JWT |
| `/api/sla/*` | Same | JWT |
| `/api/billing/*` | Same | JWT |
| `/api/api-keys/*` | Same | JWT |
| `/api/push/*` | Same | JWT |
| `/api/export/*` | Same | JWT |
| `/api/events` | Same | JWT (SSE) |
| `/api/uploads/*` | Same | Public |
| `/api/webhooks/stripe` | Same | Stripe sig |
| `/api/cron/*` | Same | Cron secret |
| `/api/v1/*` | Same | API key |
| `/api/portal/*` | Same | Portal cookie |

**Components to copy** (`apps/29chat/src/components/` → `apps/platform/src/components/`):

| Component | Goes to |
|-----------|---------|
| `inbox/SessionList.tsx` | `inbox/SessionList.tsx` |
| `inbox/SessionFilters.tsx` | `inbox/SessionFilters.tsx` |
| `inbox/ChatThread.tsx` | `inbox/ChatThread.tsx` |
| `inbox/ReplyInput.tsx` | `inbox/ReplyInput.tsx` |
| `inbox/VisitorSidebar.tsx` | `inbox/VisitorSidebar.tsx` |
| `inbox/CannedResponsePicker.tsx` | `inbox/CannedResponsePicker.tsx` |
| `knowledge/ArticleList.tsx` | `chat/ArticleList.tsx` |
| `knowledge/ArticleEditor.tsx` | `chat/ArticleEditor.tsx` |

**Pages to copy:**

| Source page | Dest page |
|------------|----------|
| `(app)/inbox/page.tsx` | `(shared)/inbox/page.tsx` — **replace placeholder** |
| `(app)/tickets/page.tsx` | `(shared)/tickets/page.tsx` |
| `(app)/tickets/[id]/page.tsx` | `(shared)/tickets/[id]/page.tsx` |
| `(app)/knowledge/page.tsx` | `(shared)/knowledge/page.tsx` |
| `(app)/analytics/page.tsx` | `(shared)/analytics/page.tsx` |
| `(app)/visitors/page.tsx` | `(shared)/visitors/page.tsx` |
| `(app)/quality/page.tsx` | `(shared)/quality/page.tsx` |
| `(app)/settings/page.tsx` | `(shared)/settings/page.tsx` |
| `portal/*` | `portal/*` |

**Import path changes:**
- `@/lib/services/X` → `@/lib/services/chat/X` (for chat-specific services)
- `@/lib/pool` stays the same (shared)
- `@/lib/auth` stays the same (shared)
- `@/hooks/use-api` stays the same (shared)

**Verification:**
1. Build succeeds
2. `localhost:3040/api/health` returns 200
3. `localhost:3040/api/widget/config?entity_id=X` returns config
4. `localhost:3040/widget.js` serves the widget
5. All authenticated API routes return 401 without auth
6. SSE endpoints return `text/event-stream`

---

### Phase 3: Move Connect (30connect) into Platform

**What:** Copy all 30connect services, API routes, components, and pages. Merge the inbox.

**Services to copy** (`apps/30connect/src/lib/services/` → `apps/platform/src/lib/services/connect/`):

| Service | Functions |
|---------|-----------|
| `channel.service.ts` | getChannels, getChannelByType, upsertChannel, deleteChannel, findEntityByChannelConfig |
| `conversation.service.ts` | createConversation, getConversationById, updateConversation, listConversations, findOrCreateConversation |
| `message.service.ts` (connect) | createMessage, getMessages (for connect_messages table) |
| `whatsapp.service.ts` | sendMessage, verifyWebhook, processWebhook |
| `email-channel.service.ts` | sendEmail, processInboundEmail |
| `sms.service.ts` | sendSMS, processInboundSMS |
| `facebook.service.ts` | sendMessage, verifyWebhook, processWebhook |
| `template.service.ts` | CRUD |
| `bot.service.ts` | CRUD + execution engine |
| `workflow.service.ts` | CRUD + execution engine |
| `voice.service.ts` | TwiML, call records, voice config |
| `qa.service.ts` | review CRUD, AI scoring |
| `analytics.service.ts` (connect) | cross-channel metrics |

**Key merge: The Inbox**

The inbox page needs to work for ALL three products:
- **Chat product:** shows `chat_sessions` only, no channel filter, chat-specific sidebar
- **Connect product:** shows `connect_conversations` (all channels), channel filter, multi-channel compose
- **CRM product:** same as Connect, plus "View in CRM" link on contact sidebar

**Implementation:**
1. The inbox page checks `product` context
2. If `product === 'chat'`: renders the chat-only SessionList + ChatThread
3. If `product !== 'chat'`: renders the multi-channel ConversationList + ConversationThread with channel filter
4. Components accept a `product` prop to conditionally render features

**API routes to copy:**

| Source route | Dest route |
|-------------|-----------|
| `/api/conversations/*` | Same |
| `/api/channels/*` | Same |
| `/api/templates/*` | Same |
| `/api/bots/*` | Same |
| `/api/workflows/*` | Same |
| `/api/voice/*` | Same |
| `/api/webhooks/whatsapp` | Same |
| `/api/webhooks/email` | Same |
| `/api/webhooks/sms` | Same |
| `/api/webhooks/facebook` | Same |

**Connect-only pages** (go into `(connect)/` route group — hidden from Chat customers):

| Page | Purpose |
|------|---------|
| `(connect)/channels/page.tsx` | Channel configuration |
| `(connect)/bots/page.tsx` | Bot list |
| `(connect)/bots/[id]/page.tsx` | Bot builder |
| `(connect)/workflows/page.tsx` | Workflow list |
| `(connect)/workflows/[id]/page.tsx` | Workflow editor |
| `(connect)/templates/page.tsx` | Message templates |

**Verification:**
1. Chat product (`x-product: chat`) shows chat-only inbox, no channel filter
2. Connect product (`x-product: connect`) shows multi-channel inbox with channel filter
3. All webhook endpoints accept POST
4. Voice API routes return proper responses
5. Bot test endpoint works

---

### Phase 4: Move CRM (25crm) into Platform

**What:** Copy all CRM services, API routes, components, and pages.

**Services to copy** (`apps/25crm/src/lib/services/` → `apps/platform/src/lib/services/crm/`):

All CRM service files. These are CRM-specific and don't overlap with chat/connect.

**CRM-only pages** (go into `(crm)/` route group):

| Page | Purpose |
|------|---------|
| `(crm)/dashboard/page.tsx` | CRM dashboard |
| `(crm)/contacts/page.tsx` | Contact list + detail |
| `(crm)/contacts/[contactId]/page.tsx` | Contact detail (with conversation history tab) |
| `(crm)/properties/page.tsx` | Property list |
| `(crm)/properties/[propertyId]/page.tsx` | Property detail |
| `(crm)/tenancies/page.tsx` | Tenancy list |
| `(crm)/maintenance/page.tsx` | Maintenance requests |
| `(crm)/documents/page.tsx` | Document management |
| `(crm)/transactions/page.tsx` | Financial transactions |
| `(crm)/tasks/page.tsx` | Task management |
| `(crm)/reports/page.tsx` | Reports |
| `(crm)/audit-log/page.tsx` | Audit log |
| `(crm)/communications/page.tsx` | Legacy archive (read-only, banner to inbox) |

**CRM API routes:** Copy all from `apps/25crm/src/app/api/` except the `/api/chat/*` routes (those are now shared platform routes).

**CRM-specific components:** Contact dialogs, property forms, tenancy views, etc.

**CRM portal:** The tenant/landlord portal uses bcrypt auth with `crm_portal_users` table. Port the portal routes and middleware.

**Verification:**
1. CRM product sees full nav (Dashboard, Contacts, Properties, etc.)
2. Chat/Connect products don't see CRM routes (middleware redirects to /inbox)
3. Contact detail page shows conversation history
4. Legacy communications archive shows banner
5. CRM portal login works

---

### Phase 5: Deploy Platform, Retire Old Containers

**Steps:**
1. Update Caddy — all 3 domains → `platform:3000` (port 3040 external)
2. Verify all 3 domains work via public URLs
3. Stop old containers: `docker compose down` for 29chat, 30connect, 25crm
4. Free ~768MB RAM (3 × 256MB containers → 1 × 512MB)
5. Run all MCP tests against platform
6. Run all E2E tests against platform

**Caddy config:**
```
chat.relentify.com {
    reverse_proxy platform:3000 { ... flush_interval -1 }
}
connect.relentify.com {
    reverse_proxy platform:3000 { ... flush_interval -1 }
}
crm.relentify.com {
    reverse_proxy platform:3000 { ... flush_interval -1 }
}
```

---

### Phase 6: Clean Up

1. Archive old app directories (don't delete — git history is there)
2. Remove `packages/chat/` and `packages/connect/` (no longer needed)
3. Update monorepo `CLAUDE.md` — apps table, domain map, container map
4. Update global `CLAUDE.md` (`/root/.claude/CLAUDE.md`) — domain→container map
5. Create `apps/platform/CLAUDE.md` — comprehensive reference
6. Update MCP test configs to point to `localhost:3040`
7. Update E2E test configs to point to `localhost:3040`
8. Docker image cleanup
9. Commit everything

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Build time grows (large app) | `turbo prune platform` only includes what's needed; `ignoreBuildErrors` avoids TS blocking |
| Single point of failure | Health check + `restart: always` + Caddy health routing |
| Route conflicts between products | Route groups `(chat)/`, `(connect)/`, `(crm)/` isolate product-specific routes |
| Memory pressure | Platform gets 512MB limit (vs 3×256MB = 768MB before — net savings) |
| Import path changes | Bulk find-replace `@/lib/services/X` → `@/lib/services/chat/X` etc. |
| SSE manager confusion | ONE SSEManager singleton shared across all products (it's the same process) |

---

## Timeline Estimate

| Phase | Effort | What |
|-------|--------|------|
| Phase 1 | ✅ Done | Shell + middleware + layout |
| Phase 2 | ✅ Done | Chat services + routes + components + pages |
| Phase 3 | ✅ Done | Connect services + routes + inbox merge |
| Phase 4 | ✅ Done | CRM services + routes + components + pages |
| Phase 5 | ✅ Done | Deploy + Caddy switch + retire old containers |
| Phase 6 | ✅ Done | Cleanup + docs |

**Migration complete: 2026-04-04** — all 6 phases done in one session.

---

## Post-Migration: Ongoing Development

After migration, all development happens in `apps/platform/`:

- **New chat feature** → add to `services/chat/` + route in `api/` + component in `components/inbox/`
- **New connect feature** → add to `services/connect/` + route in `api/` + page in `(connect)/`
- **New CRM feature** → add to `services/crm/` + route in `api/` + page in `(crm)/`
- **Shared feature** (e.g. better analytics) → add to `services/` + page in `(shared)/`

One build. One deploy. All products updated.
