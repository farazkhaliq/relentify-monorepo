# 29chat — Detailed Build Plan

Standalone webchat product (Tawk.to competitor). 15 build phases.

**Master plan**: `/opt/relentify-monorepo/PLANS/communications-platform-master-plan.md`
**This is deliverable 1 of 4.** When 29chat is complete, proceed to → `30connect-build.md`

---

## Phase 1: Scaffold + Database + Docker + Caddy

### 1.1 Create app directory and config files

**`apps/29chat/package.json`** — name: `"chat"`, port 3029
```json
{
  "name": "chat",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3029",
    "build": "next build",
    "start": "next start -p 3029",
    "lint": "next lint"
  },
  "dependencies": {
    "@relentify/auth": "workspace:*",
    "@relentify/config": "workspace:*",
    "@relentify/database": "workspace:*",
    "@relentify/ui": "workspace:*",
    "@relentify/utils": "workspace:*",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.475.0",
    "next": "15.5.14",
    "pg": "^8.20.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "stripe": "^17.7.0",
    "swr": "^2.4.1",
    "uuid": "^11.1.0",
    "web-push": "^3.6.7",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.1",
    "@types/node": "^22.19.15",
    "@types/pg": "^8.15.6",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/uuid": "^10.0.0",
    "@types/web-push": "^3.6.4",
    "autoprefixer": "^10.4.27",
    "postcss": "^8.5.8",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.9.3"
  }
}
```

**`apps/29chat/next.config.js`** — copy 28timesheets pattern exactly
```js
const path = require('path')
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ["@relentify/ui", "@relentify/database", "@relentify/auth", "@relentify/config", "@relentify/utils"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig
```

**`apps/29chat/postcss.config.js`**
```js
module.exports = { plugins: { '@tailwindcss/postcss': {} } }
```

**`apps/29chat/tsconfig.json`** — copy from 28timesheets

**`apps/29chat/.env.example`**
```
DATABASE_URL=postgresql://relentify_user:PASSWORD@infra-postgres:5432/relentify
JWT_SECRET=shared-jwt-secret
NEXT_PUBLIC_APP_URL=https://chat.relentify.com
CRON_SECRET=cron-secret
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_BRANDING=
STRIPE_PRICE_AI=
AI_KEY_ENCRYPTION_SECRET=
AI_DEFAULT_API_URL=https://api.openai.com/v1/chat/completions
AI_DEFAULT_API_KEY=
AI_DEFAULT_MODEL=gpt-4o-mini
```

### 1.2 Dockerfile

Copy 28timesheets Dockerfile pattern. Key difference: `turbo prune chat --docker` (not `timesheets`). No prisma generate step needed.

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune chat --docker

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
COPY --from=deps /app/apps/29chat/node_modules ./apps/29chat/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
WORKDIR /app/apps/29chat
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/29chat/public ./apps/29chat/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/29chat/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/29chat/.next/static ./apps/29chat/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "apps/29chat/server.js"]
```

### 1.3 docker-compose.yml

```yaml
services:
  web:
    container_name: 29chat
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 256M
    build:
      context: ../../
      dockerfile: apps/29chat/Dockerfile
    restart: always
    env_file:
      - .env
    volumes:
      - /opt/29chat-uploads:/app/uploads
    ports:
      - "3029:3000"
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - infra_default

networks:
  infra_default:
    name: infra_default
    external: true
```

### 1.4 Database migration

**`apps/29chat/database/migrations/001_core_tables.sql`**

9 tables with `chat_` prefix:

```sql
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
```

### 1.5 Core source files

**`src/lib/pool.ts`** — copy from 28timesheets
```typescript
import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export default pool
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows as T[]
}
```

**`src/lib/auth.ts`** — copy from 25crm pattern
```typescript
import { verifyAuthToken, AUTH_COOKIE_NAME } from '@relentify/auth'
import { cookies } from 'next/headers'
import pool from './pool'

export interface AuthUser {
  userId: string; email: string; userType: string; fullName: string; activeEntityId: string | null
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null
  const payload = await verifyAuthToken(token, process.env.JWT_SECRET || 'fallback-dev-secret')
  if (!payload) return null
  const result = await pool.query('SELECT id FROM entities WHERE user_id = $1 LIMIT 1', [(payload as any).userId])
  return { ...(payload as any), activeEntityId: result.rows[0]?.id || null }
}
```

**`src/lib/cors.ts`** — CORS helper for widget API routes
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
export function corsOptions() {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**`src/middleware.ts`** — based on 25crm, adds widget route bypass
- Allow: `/_next`, `/api/widget`, `/api/health`, `/api/webhooks`, `/widget.js`, static files
- Protect: `/(app)/*` — check JWT, redirect to `auth.relentify.com`
- Skip: `/api/*` (API routes handle their own auth)

**`src/app/layout.tsx`** — copy from 25crm (ThemeProvider, THEME_SCRIPT, Inter, Toaster)
**`src/app/globals.css`** — copy from 25crm (`@import "tailwindcss"`, `@custom-variant dark`, `@source`)

**`src/app/api/health/route.ts`**
```typescript
import { NextResponse } from 'next/server'
export async function GET() { return NextResponse.json({ status: 'ok' }) }
```

**`src/app/(app)/layout.tsx`** — NavShell + TopBar with links: Inbox, Tickets, Knowledge Base, Analytics, Settings

**`src/app/(app)/inbox/page.tsx`** — placeholder "Coming soon"

**`src/hooks/use-api.ts`** — copy from 25crm (useApiCollection, useApiDoc, apiCreate, apiUpdate, apiDelete)

### 1.6 Build and deploy steps

1. Create all files listed above
2. `cd /opt/relentify-monorepo && pnpm install`
3. Run migration: `cat apps/29chat/database/migrations/001_core_tables.sql | docker exec -i infra-postgres psql -U relentify_user -d relentify`
4. Create `.env` from `.env.example` with real values
5. Verify build: `pnpm --filter chat build`
6. Create uploads dir: `mkdir -p /opt/29chat-uploads`
7. Docker build: `cd /opt/relentify-monorepo/apps/29chat && docker compose build --no-cache`
8. Docker up: `docker compose up -d`
9. Verify health: `curl http://localhost:3029/api/health`
10. Add Caddy block for `chat.relentify.com`:
```
chat.relentify.com {
    reverse_proxy 29chat:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        flush_interval -1
    }
}
```
11. Reload Caddy: `docker exec infra-caddy caddy reload --config /etc/caddy/Caddyfile`
12. Verify: `curl https://chat.relentify.com/api/health`
13. `docker builder prune -f`
14. Update monorepo CLAUDE.md — add 29chat to Apps table
15. Update `/root/.claude/CLAUDE.md` — add chat.relentify.com to domain→container map

---

## Phase 2: Public Widget API

### Services to create
| File | Functions |
|------|-----------|
| `src/lib/services/visitor.service.ts` | `getOrCreateVisitor(entityId, fingerprint, data)`, `updateVisitor(id, data)`, `getVisitorById(id, entityId)`, `banVisitor(id, entityId)` |
| `src/lib/services/session.service.ts` | `createSession(entityId, visitorId, data)`, `getSessionById(id)`, `getSessionMessages(sessionId, since?)`, `updateSession(id, data)`, `listSessions(entityId, filters)`, `rateSession(id, rating, comment?)` |
| `src/lib/services/message.service.ts` | `createMessage(data)`, `getMessages(sessionId, since?)` |
| `src/lib/services/config.service.ts` | `getConfig(entityId)`, `getPublicConfig(entityId)`, `upsertConfig(entityId, data)`, `ensureConfig(entityId)` |
| `src/lib/services/upload.service.ts` | `handleFileUpload(file, entityId)` → store to `/app/uploads/chat/{entityId}/{uuid}.ext`, return URL |

### API routes to create
| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/widget/config` | GET | No | `?entity_id=` → public config (colours, greeting, hours, branding). Strips secrets. |
| `/api/widget/session` | POST | No | `{entity_id, fingerprint, name?, email?, user_agent?, page_url?}` → create/resume session |
| `/api/widget/session/[id]/messages` | GET, POST | No | `GET ?since=ISO` / `POST {body, attachment?}` |
| `/api/widget/session/[id]/identify` | POST | No | `{name, email}` → update visitor |
| `/api/widget/session/[id]/rate` | POST | No | `{rating: 1-5, comment?}` → CSAT |
| `/api/widget/session/[id]/upload` | POST | No | Multipart file upload, max 10MB, return URL |
| `/api/widget/knowledge` | GET | No | `?entity_id=&q=` → PG full-text search on published articles |
| `/api/widget/visitors` | GET | No | `?entity_id=` → live visitor list (heartbeat within 2min) |
| `/api/widget/heartbeat` | POST | No | `{visitor_id, page_url}` → update page_url + last_seen_at |

All widget routes return CORS headers. All have OPTIONS handlers.

### Key implementation details
- `getOrCreateVisitor`: `INSERT ... ON CONFLICT (entity_id, fingerprint) DO UPDATE SET last_seen_at = NOW(), page_url = $x RETURNING *`
- `createSession`: check for existing open session for this visitor, return it if found
- `getPublicConfig`: returns only `widget_colour, widget_position, widget_greeting, widget_offline_message, widget_avatar_url, widget_show_branding, widget_i18n, pre_chat_form_enabled, pre_chat_fields, operating_hours, departments, business_name`
- File upload: write to disk at `/app/uploads/chat/{entityId}/{uuid}.{ext}`. Serve via `/api/uploads/[...path]` route.
- Rate limit: simple in-memory Map keyed by IP, 60 req/min, reset every minute

---

## Phase 3: SSE Real-Time + Polling Fallback

### Files to create
| File | Purpose |
|------|---------|
| `src/lib/services/sse.service.ts` | SSEManager singleton — Map<id, Set<Controller>>. `addConnection`, `removeConnection`, `broadcast`, `broadcastEntity`. Keepalive every 30s. |
| `src/app/api/widget/session/[id]/stream/route.ts` | SSE for widget. No auth. Events: `new_message`, `typing`, `session_updated`. |
| `src/app/api/widget/session/[id]/typing/route.ts` | POST. No auth. Broadcasts `typing` event via SSE. |
| `src/app/api/sessions/[id]/stream/route.ts` | SSE for agent. Auth required. Same events. |
| `src/app/api/sessions/[id]/typing/route.ts` | POST. Auth required. Broadcasts `typing`. |
| `src/app/api/events/route.ts` | SSE for agent dashboard. Auth required. Entity-scoped events: `new_session`, `session_assigned`, `session_resolved`. |

### SSE route pattern
```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': keepalive\n\n'))
      sseManager.addConnection(id, controller)
      req.signal.addEventListener('abort', () => sseManager.removeConnection(id, controller))
    }
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' }
  })
}
```

### Integration
- `message.service.ts` → after `createMessage()`, call `sseManager.broadcast(sessionId, 'new_message', message)`. Skip for `sender_type = 'note'` (internal notes not sent to widget).
- `session.service.ts` → after `createSession()`, call `sseManager.broadcastEntity(entityId, 'new_session', session)`
- Polling fallback: widget uses `GET /messages?since=TS` every 3s when EventSource is closed

---

## Phase 4: Embeddable widget.js

### File: `apps/29chat/public/widget.js`

~15KB vanilla JS IIFE with Shadow DOM. Full architecture in master plan. Key features:
1. Read `data-entity-id` from script tag
2. Fetch config, render floating button + chat panel in Shadow DOM
3. Browser fingerprint (canvas hash + screen + timezone) → localStorage
4. Session create/resume on first message
5. SSE with 3s polling fallback
6. Pre-chat form, file upload, KB search tab
7. CSAT rating prompt on resolve
8. Heartbeat every 30s (page_url + last_seen_at)
9. Trigger message support (system messages from server)
10. Multi-language via config.widget_i18n
11. "Powered by Relentify" badge when `widget_show_branding === true`
12. Public API: `window.RelentifyChat.open/close/toggle/identify/destroy/setLanguage`

---

## Phase 5: Agent Dashboard

### Files to create

**Hooks**: `src/hooks/use-sse.ts` — custom hook for EventSource lifecycle + reconnection

**Components**:
| Component | Purpose |
|-----------|---------|
| `src/components/inbox/SessionList.tsx` | Left panel — filterable list with status badges, unread count, visitor name, last message preview |
| `src/components/inbox/SessionFilters.tsx` | Status filter (open/assigned/waiting/resolved/all), department, search |
| `src/components/inbox/ChatThread.tsx` | Message list. Different styling for visitor/agent/ai/system/note. Auto-scroll. |
| `src/components/inbox/ReplyInput.tsx` | Textarea, send button, note toggle, canned response picker, file upload |
| `src/components/inbox/VisitorSidebar.tsx` | Visitor info (name, email, IP, browser, page URL, custom data), session metadata, action buttons (resolve, reassign, toggle AI, ban) |
| `src/components/inbox/CannedResponsePicker.tsx` | Dropdown from config.canned_responses |

**Pages**:
| Page | Purpose |
|------|---------|
| `src/app/(app)/inbox/page.tsx` | 3-column layout: SessionList | ChatThread | VisitorSidebar |
| `src/app/(app)/inbox/[sessionId]/page.tsx` | Session detail (server component loads data, client components for interactivity) |
| `src/app/(app)/visitors/page.tsx` | Real-time visitor monitoring (who's on site, current page, duration) |

**API routes**:
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sessions` | GET | `?status=&department=&search=&page=` — list sessions for entity |
| `/api/sessions/[id]` | GET, PATCH | Detail + visitor info. PATCH: `{status, assigned_agent_id, department}` |
| `/api/sessions/[id]/messages` | GET, POST | Agent reads/sends messages. POST: `{body, sender_type?}` (defaults to 'agent') |
| `/api/agents` | GET | List users for entity (for reassignment dropdown) |
| `/api/export/[sessionId]` | GET | Export conversation as text or JSON |
| `/api/visitors` | GET | Live visitors (auth) — `WHERE last_seen_at > NOW() - INTERVAL '2 minutes'` |
| `/api/visitors/[id]/ban` | POST | Ban/unban visitor |

### Collision detection
- When agent opens a session, broadcast `agent_viewing` event via SSE
- Show "Agent X is viewing this" in the chat thread header
- Implemented in `use-sse.ts` hook — listen for `agent_viewing` events on session stream

---

## Phase 6: Auto-Routing + Departments

### File: `src/lib/services/routing.service.ts`

Functions:
- `assignAgent(entityId, sessionId)` — implements round-robin or least-busy
- Round-robin: use `chat_config.last_assigned_agent_id`, pick next agent in list
- Least-busy: `COUNT(*) FILTER (WHERE status IN ('open','assigned','waiting'))` per agent, pick lowest
- Department routing: if session has department, only consider agents in that department
- No agents available: leave as `open`, broadcast `new_session` to all agents via entity SSE
- Called from: `session.service.ts` on new session, `PATCH /api/sessions/[id]` on manual reassignment

---

## Phase 7: Knowledge Base

### Files
| File | Purpose |
|------|---------|
| `src/lib/services/knowledge.service.ts` | `listArticles`, `getArticleById`, `getArticleBySlug`, `createArticle`, `updateArticle`, `deleteArticle`, `searchArticles` |
| `src/app/api/knowledge/route.ts` | GET `?category=&published=` / POST (auth) |
| `src/app/api/knowledge/[id]/route.ts` | GET / PATCH / DELETE (auth) |
| `src/app/(app)/knowledge/page.tsx` | Article list + editor page |
| `src/components/knowledge/ArticleList.tsx` | Table with status badge, category, sort order |
| `src/components/knowledge/ArticleEditor.tsx` | Create/edit: title, slug (auto-gen), body (textarea), category, published toggle, language |

### Search (PG full-text)
```sql
SELECT * FROM chat_knowledge_articles
WHERE entity_id = $1 AND published = TRUE
  AND (to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english', $2)
       OR title ILIKE '%' || $2 || '%')
ORDER BY ts_rank(to_tsvector('english', title || ' ' || body), plainto_tsquery('english', $2)) DESC
LIMIT 10
```

---

## Phase 8: AI Integration

### Files
| File | Purpose |
|------|---------|
| `src/lib/services/ai.service.ts` | `generateAIReply(messages, config)` — generic HTTP fetch to OpenAI-compatible API |
| `src/lib/services/ai-usage.service.ts` | `incrementUsage(entityId, tokensIn, tokensOut)`, `getUsage(entityId, month)` |
| `src/lib/crypto.ts` | `encryptApiKey(key)`, `decryptApiKey(encrypted)` — AES-256-GCM via Node crypto |

### AI config resolution
1. If entity has BYOK config (ai_api_url + ai_api_key): use customer's key (decrypt first)
2. If entity is on AI plan but no BYOK: use platform default (env: `AI_DEFAULT_API_URL`, `AI_DEFAULT_API_KEY`, `AI_DEFAULT_MODEL`)
3. If entity not on AI plan: AI disabled

### Message flow
When visitor sends message AND `ai_enabled = true` AND entity plan allows AI:
1. Check `ai_escalate_keywords` — if match, skip AI, call `assignAgent()`, send system message "Connecting you with an agent..."
2. Search knowledge articles for context → prepend to system prompt
3. Call `generateAIReply()` with last 20 messages in session
4. Create message with `sender_type: 'ai'`
5. Increment `chat_ai_usage`
6. On AI failure: log error, fall back to human agent routing

---

## Phase 9: Automated Triggers

### Files
| File | Purpose |
|------|---------|
| `src/lib/services/trigger.service.ts` | `evaluateTriggers(entityId, visitorContext)` → returns actions to execute |
| `src/app/api/triggers/route.ts` | GET / POST (auth) |
| `src/app/api/triggers/[id]/route.ts` | GET / PATCH / DELETE (auth) |

### Trigger conditions (JSONB)
- `time_on_page >= N seconds`
- `page_url matches pattern`
- `visit_count >= N`
- `referrer matches pattern`

### Actions (JSONB)
- `send_message`: auto-send a system message via SSE
- `open_widget`: tell widget to open automatically

### Evaluation
- Widget sends visitor context with heartbeats
- Server evaluates triggers on heartbeat
- Each trigger fires once per visitor per session (tracked in `session.metadata.fired_triggers[]`)

---

## Phase 10: Ticketing

### Files
| File | Purpose |
|------|---------|
| `src/lib/services/ticket.service.ts` | CRUD, status transitions, assignment, merge |
| `src/app/api/tickets/route.ts` | GET `?status=&priority=&department=` / POST (auth) |
| `src/app/api/tickets/[id]/route.ts` | GET / PATCH / DELETE (auth) |
| `src/app/api/tickets/[id]/messages/route.ts` | GET / POST — reply thread (stored as chat_messages linked to ticket's session) |
| `src/app/(app)/tickets/page.tsx` | Ticket list with filters |
| `src/app/(app)/tickets/[id]/page.tsx` | Ticket detail with reply thread |

### Ticket creation flows
- Offline form submission → creates ticket (not session)
- Agent clicks "Convert to Ticket" on a chat session → creates ticket linked to session
- Via API: `POST /api/tickets`

### Ticket merge
- `POST /api/tickets/[id]/merge` with `{merge_into_id}` — combines messages, closes source ticket

---

## Phase 11: SLA Management

### Files
| File | Purpose |
|------|---------|
| `src/lib/services/sla.service.ts` | `checkSLAs(entityId)`, `getSLAPolicies(entityId)`, `createSLAPolicy`, `updateSLAPolicy`, `deleteSLAPolicy` |
| `src/app/api/sla/route.ts` | GET / POST (auth) |
| `src/app/api/sla/[id]/route.ts` | PATCH / DELETE (auth) |

### SLA policies stored in chat_config
```json
{
  "sla_policies": [
    {
      "id": "uuid",
      "name": "Standard",
      "conditions": {"priority": ["medium","low"]},
      "first_response_minutes": 60,
      "resolution_minutes": 1440,
      "business_hours_only": true
    }
  ]
}
```

No separate table — stored as JSONB array in `chat_config`. SLA checking runs as a cron job (`POST /api/cron/sla-check`) every minute, queries sessions without first reply or unresolved past target, sends breach notifications via SSE + push.

---

## Phase 12: Customer Self-Service Portal

### Files
| File | Purpose |
|------|---------|
| `src/app/(portal)/login/page.tsx` | Magic link login form (enter email) |
| `src/app/(portal)/verify/page.tsx` | Magic link verification |
| `src/app/(portal)/dashboard/page.tsx` | Ticket list + KB search |
| `src/app/(portal)/tickets/[id]/page.tsx` | Ticket detail + reply |
| `src/app/api/portal/login/route.ts` | POST {email} → send magic link |
| `src/app/api/portal/verify/route.ts` | GET ?token= → verify, set cookie |
| `src/app/api/portal/tickets/route.ts` | GET / POST — visitor's tickets |
| `src/app/api/portal/tickets/[id]/route.ts` | GET / POST reply |

### Magic link
- Generate JWT with visitor email + expiry (15min)
- Send email via platform email service (or log to console in dev)
- On verify: set `chat_portal_token` cookie
- Portal middleware checks this cookie for `/(portal)/*` routes (except login/verify)

---

## Phase 13: Public REST API + Webhooks + Push Notifications

### Public REST API
API key auth: `Authorization: Bearer <api_key>`. Keys stored in a new `chat_api_keys` table (add to migration or create migration 002).

Routes mirror the authenticated dashboard routes but use API key auth instead of JWT:
- `GET/POST /api/v1/sessions`
- `GET/PATCH /api/v1/sessions/[id]`
- `GET/POST /api/v1/sessions/[id]/messages`
- `GET/POST /api/v1/tickets`
- `GET/PATCH /api/v1/tickets/[id]`
- `GET /api/v1/visitors`
- `GET /api/v1/analytics`

### Webhook dispatch
| File | Purpose |
|------|---------|
| `src/lib/services/webhook.service.ts` | `dispatchWebhook(entityId, event, payload)` — fire-and-forget, HMAC signature, 3 retries with exponential backoff |

Events: `chat.session.created`, `chat.session.resolved`, `chat.message.created`, `chat.visitor.identified`, `chat.ticket.created`, `chat.ticket.resolved`, `chat.rating.submitted`

### Web Push
| File | Purpose |
|------|---------|
| `src/lib/services/push.service.ts` | `sendPush(subscription, title, body, url)`, `sendToEntity(entityId, title, body, url)` |
| `src/app/api/push/subscribe/route.ts` | POST — agent subscribes (stores subscription in DB) |

Push on: new session (if unviewed after 60s), SLA breach, ticket assigned.

---

## Phase 14: Settings + Analytics + QA

### Settings page
`src/app/(app)/settings/page.tsx` — tabbed interface

| Tab Component | Purpose |
|---------------|---------|
| `WidgetSettings.tsx` | Colour, position, greeting, offline msg, avatar, branding (read-only if free), i18n |
| `AISettings.tsx` | Enable/disable, API URL, key (masked), model, system prompt, temperature, escalation keywords |
| `BusinessSettings.tsx` | Name, description, timezone, operating hours (per-day editor), departments |
| `RoutingSettings.tsx` | Method (round-robin/least-busy), auto-assign toggle |
| `CannedResponseSettings.tsx` | CRUD for canned responses (shortcut + text, JSONB array) |
| `TriggerSettings.tsx` | Trigger rules CRUD (or separate page) |
| `WebhookSettings.tsx` | Webhook endpoint management |
| `NotificationSettings.tsx` | Push notification preferences |
| `BillingSettings.tsx` | Current plan, upgrade buttons, Stripe portal link |

### API routes for settings
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/config` | GET, PATCH | Full config / update fields |
| `/api/canned-responses` | GET, PATCH | Convenience wrapper |

### Analytics
| File | Purpose |
|------|---------|
| `src/lib/services/analytics.service.ts` | SQL queries: session count, avg response time, resolution rate, CSAT avg, sessions/day, message breakdown, agent leaderboard, busiest hours, AI usage, trigger performance, ticket stats |
| `src/app/api/analytics/route.ts` | GET `?from=&to=` |
| `src/app/(app)/analytics/page.tsx` | Date range picker + KPI cards + charts |
| `src/components/analytics/AnalyticsCards.tsx` | StatsCards |
| `src/components/analytics/AnalyticsCharts.tsx` | Using Chart from @relentify/ui |

### Basic QA
| File | Purpose |
|------|---------|
| `src/app/(app)/quality/page.tsx` | QA dashboard — select conversations, rate on rubric |
| `src/app/api/quality/route.ts` | GET reviews / POST new review |

QA reviews stored as JSONB in session metadata (no separate table for v1). Fields: reviewer_id, scores (helpfulness, accuracy, tone: 1-5), notes, reviewed_at.

---

## Phase 15: Stripe Billing + MCP Tests + E2E Tests + Infrastructure

### Stripe
| File | Purpose |
|------|---------|
| `src/lib/stripe.ts` | SDK init, `createAddonCheckout(entityId, addon)`, `constructWebhookEvent` |
| `src/lib/tiers.ts` | Plan definitions. `canAccess(plan, feature)` for 'remove_branding' and 'ai_replies' |
| `src/app/api/billing/route.ts` | GET current plan / POST create checkout |
| `src/app/api/billing/portal/route.ts` | POST create Stripe portal session |
| `src/app/api/webhooks/stripe/route.ts` | POST — handles `checkout.session.completed`, `customer.subscription.deleted` |

Plans: `free`, `branding` (£24.99), `ai` (£24.99), `branding_ai` (both active).
Addons are separate Stripe subscriptions — customer can have 0, 1, or 2 active.

### MCP Tests
Create `/opt/infra/mcp/29chat-mcp/` following 22accounting pattern. Test coverage:
- Health, widget config, session CRUD, messages, identify, rate, upload, knowledge search
- Auth: sessions, agents, config, knowledge CRUD, tickets, analytics, billing, export
- SSE: verify `text/event-stream` content type
- Triggers, webhooks, push subscription
- Cleanup

### E2E Tests
Add to `/opt/infra/e2e-tests/`:
- Widget loads on test page, sends message, agent sees in inbox
- Agent replies, visitor sees via SSE
- File upload, CSAT rating, knowledge search
- Trigger fires auto-message
- Offline form → ticket → agent resolves
- Settings save correctly
- Analytics page loads

### Infrastructure
- Caddy block (already added in Phase 1)
- Update CLAUDE.md files
- Create 29chat CLAUDE.md documenting the app
- `docker builder prune -f`

---

## File Count Summary

| Category | Count |
|----------|-------|
| Config files (package.json, next.config, tsconfig, postcss, docker, .env) | 6 |
| Migration SQL | 1 |
| Core lib (pool, auth, cors, crypto) | 4 |
| Services | ~15 |
| API routes | ~35 |
| Pages | ~12 |
| Components | ~20 |
| Hooks | 2 |
| Widget | 1 |
| **Total** | **~96 files** |
