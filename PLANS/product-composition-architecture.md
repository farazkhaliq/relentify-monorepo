# Product Composition Architecture Plan

## The Problem

We have 3 products with a superset relationship:

```
CRM ⊃ Connect ⊃ Chat
```

- **Chat** = webchat widget + agent inbox + AI + ticketing + KB + billing
- **Connect** = everything in Chat + WhatsApp + email + SMS + voice + bots + workflows + advanced QA
- **CRM** = everything in Connect + contacts + properties + tenancies + maintenance + documents + transactions

Each is sold separately at different price points. Each has its own domain. But the inner product must be **fully functional** inside the outer product — not a thin wrapper, not an iframe, the real thing.

**Current state:** 3 separate apps with duplicated code. Updating chat session logic means changing it in 3 places. This doesn't scale.

---

## Options

### Option A: Micro-Frontend (iframe / Module Federation)

**How:** Connect embeds Chat's inbox as an iframe or Webpack Module Federation remote. CRM embeds Connect the same way.

**Pros:**
- Each app is truly independent — deploy separately
- No shared code to maintain
- Tech stack can differ

**Cons:**
- Iframes are terrible UX (no shared auth state, scroll issues, styling mismatches)
- Module Federation is complex, brittle, and Next.js support is experimental
- Three separate Docker containers, three builds, three deploys for one feature change
- Auth/session sharing is painful
- Performance: loading 3 apps worth of JS

**Verdict:** Over-engineered for a solo dev. Solves an organisational problem (multiple teams) that doesn't exist here.

---

### Option B: Shared Packages (Current Approach, Completed)

**How:** Extract services + components into `packages/chat/` and `packages/connect/`. Each app imports and wires up.

**Pros:**
- Clean separation
- Each app can customise

**Cons:**
- Packages are incomplete (only cover ~65% of actual logic)
- Services need pool injection, SSE wiring, app-specific orchestration
- **Doesn't share UI** — each app still needs its own inbox page, session list, chat thread, etc.
- Components are the hard part, not services. Rebuilding the inbox UI in each app defeats the purpose.
- Updating a component means updating it in the package AND verifying it works in 3 different app contexts
- The "shared service factory" pattern adds complexity without solving the real problem (UI duplication)

**Verdict:** Looks clean on paper but doesn't actually solve the composition problem. You still have 3 copies of the inbox.

---

### Option C: Single App, Multiple Domains, Feature Flags ⭐ RECOMMENDED

**How:** One Next.js app handles all 3 domains. Middleware routes by hostname. Features unlocked by the entity's plan tier.

```
chat.relentify.com    → same app, plan="chat_free|chat_branding|chat_ai"
connect.relentify.com → same app, plan="connect_starter|...|connect_enterprise"  
crm.relentify.com     → same app, plan="crm_standard|crm_professional"
```

**Architecture:**

```
apps/platform/
├── src/
│   ├── middleware.ts          # Routes by hostname → product context
│   ├── lib/
│   │   ├── product-context.ts # { product: 'chat'|'connect'|'crm', plan, features }
│   │   ├── feature-flags.ts   # canAccess(product, feature) → boolean
│   │   └── services/          # ONE copy of every service
│   ├── app/
│   │   ├── (chat)/            # Chat-only pages (widget config, embed snippet)
│   │   ├── (connect)/         # Connect-only pages (channels, bots, workflows, voice)
│   │   ├── (crm)/             # CRM-only pages (contacts, properties, tenancies)
│   │   ├── (shared)/          # Shared pages (inbox, tickets, knowledge, analytics, settings)
│   │   │   ├── inbox/
│   │   │   ├── tickets/
│   │   │   ├── knowledge/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   └── api/               # ONE set of API routes
│   ├── components/
│   │   ├── inbox/             # ONE inbox implementation
│   │   ├── chat/              # Chat-specific components
│   │   ├── connect/           # Connect-specific components (channel filter, bot builder)
│   │   └── crm/               # CRM-specific components (contacts, properties)
│   └── hooks/
├── public/
│   └── widget.js              # Chat widget (served from all domains)
├── Dockerfile
└── docker-compose.yml
```

**Middleware routes by hostname:**

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  
  if (host.startsWith('chat.')) {
    // Chat product — show chat nav, hide connect/crm features
    req.headers.set('x-product', 'chat')
  } else if (host.startsWith('connect.')) {
    // Connect product — show chat + connect nav, hide CRM features
    req.headers.set('x-product', 'connect')
  } else if (host.startsWith('crm.')) {
    // CRM product — show everything
    req.headers.set('x-product', 'crm')
  }
}
```

**Layout adapts by product:**

```typescript
// app/(shared)/layout.tsx
export default function SharedLayout({ children }) {
  const product = getProductContext() // reads x-product header or cookie
  
  return (
    <NavShell topbar={
      <TopBar navLinks={
        <>
          <TopBarLink href="/inbox">Inbox</TopBarLink>
          <TopBarLink href="/tickets">Tickets</TopBarLink>
          
          {/* Connect features — hidden on chat-only */}
          {product !== 'chat' && <>
            <TopBarLink href="/channels">Channels</TopBarLink>
            <TopBarLink href="/bots">Bots</TopBarLink>
            <TopBarLink href="/workflows">Workflows</TopBarLink>
          </>}
          
          {/* CRM features — hidden on chat and connect */}
          {product === 'crm' && <>
            <TopBarLink href="/contacts">Contacts</TopBarLink>
            <TopBarLink href="/properties">Properties</TopBarLink>
          </>}
        </>
      } />
    }>
      {children}
    </NavShell>
  )
}
```

**The inbox is ONE component:**

```typescript
// components/inbox/UnifiedInbox.tsx
export function UnifiedInbox() {
  const { product } = useProductContext()
  
  return (
    <div className="flex h-full">
      <ConversationList 
        showChannelFilter={product !== 'chat'} // Connect/CRM show channel filters
      />
      <ChatThread />
      <Sidebar 
        showCRMLink={product === 'crm'} // CRM shows "View in CRM" link
        showVoiceDialer={product !== 'chat'} // Connect/CRM show click-to-call
      />
    </div>
  )
}
```

**Feature flags control access:**

```typescript
// lib/feature-flags.ts
const PRODUCT_FEATURES = {
  chat: ['inbox', 'tickets', 'knowledge', 'analytics', 'settings', 'widget', 'triggers', 'sla'],
  connect: ['inbox', 'tickets', 'knowledge', 'analytics', 'settings', 'widget', 'triggers', 'sla',
            'channels', 'bots', 'workflows', 'voice', 'templates', 'qa', 'whatsapp', 'email', 'sms'],
  crm: ['inbox', 'tickets', 'knowledge', 'analytics', 'settings', 'widget', 'triggers', 'sla',
        'channels', 'bots', 'workflows', 'voice', 'templates', 'qa', 'whatsapp', 'email', 'sms',
        'contacts', 'properties', 'tenancies', 'maintenance', 'documents', 'transactions'],
}

export function canAccess(product: string, feature: string): boolean {
  return PRODUCT_FEATURES[product]?.includes(feature) ?? false
}
```

**Pros:**
- **ONE codebase.** Update inbox once → all 3 products get the update.
- **ONE Docker container.** Less RAM, less disk, simpler ops on a 3.7GB VPS.
- **ONE build.** No multi-app coordination.
- **ONE set of services, components, API routes.** Zero duplication.
- **Composition is natural.** CRM pages just exist alongside chat/connect pages. No embedding, no iframes, no module federation.
- **Feature flags are simple.** The middleware sets the product context. Components check it. Done.
- **Shared auth, shared DB pool, shared SSE manager.** No cross-app communication needed.
- **Caddy routing stays the same.** Three domains → one container on one port.
- **Marketing site stays separate** (different tech stack, public-facing, no auth).

**Cons:**
- **Large app.** One Next.js app with all pages from all 3 products. Build time grows.
- **Single point of failure.** If the container goes down, all 3 products go down. (Mitigated by health checks + restart.)
- **Route conflicts.** Need to be careful that `/contacts` in CRM doesn't clash with anything in Connect. (Route groups solve this.)
- **Migration effort.** Need to merge 3 existing apps into one. This is the main cost.

---

### Option D: Layered Packages with Full UI

**How:** `packages/chat/` exports entire page-level React components (InboxPage, TicketPage, etc). Each app renders them inside its own layout.

**Pros:**
- Apps stay separate
- Shared UI components

**Cons:**
- Page-level components are tightly coupled to routing, data fetching, auth
- Next.js Server Components in packages is complex (need to handle async data in the package)
- Testing/previewing package components requires a host app
- Still 3 Docker containers, 3 builds

**Verdict:** Possible but awkward. Components that fetch their own data and handle routing don't compose well as library exports.

---

## Recommendation: Option C (Single App)

**Why it wins:**

| Factor | Micro-FE | Shared Pkgs | Single App | Layered Pkgs |
|--------|----------|-------------|------------|--------------|
| Code duplication | High | Medium | **None** | Low |
| Complexity | Very High | Medium | **Low** | High |
| Ops overhead | 3 containers | 3 containers | **1 container** | 3 containers |
| Build time | 3 builds | 3 builds | **1 build** | 3 builds |
| Update propagation | Manual | Manual | **Automatic** | Semi-auto |
| RAM usage | ~768MB | ~768MB | **~256MB** | ~768MB |
| Solo dev friendly | No | Maybe | **Yes** | No |

**For a solo dev on a 3.7GB VPS, one app is the obvious choice.**

---

## Migration Plan

### Phase 1: Create the unified app shell
- Create `apps/platform/` with combined package.json, Dockerfile, docker-compose
- Set up hostname-based middleware routing
- Create product context system (header → cookie → hook)
- Set up route groups: `(chat)/`, `(connect)/`, `(crm)/`, `(shared)/`
- Build the adaptive layout (nav changes by product)
- Port the health endpoint

### Phase 2: Move Chat (29chat) into platform
- Copy all 29chat services → `platform/src/lib/services/chat/`
- Copy all 29chat API routes → `platform/src/app/api/` (widget routes stay at same paths)
- Copy inbox components → `platform/src/components/inbox/`
- Copy pages → `platform/src/app/(shared)/` (inbox, tickets, knowledge, etc.)
- Copy widget.js → `platform/public/widget.js`
- Verify: `chat.relentify.com` serves the platform app, all endpoints work

### Phase 3: Move Connect (30connect) into platform
- Copy all 30connect services → `platform/src/lib/services/connect/`
- Copy channel-specific services (whatsapp, email, sms, facebook, voice)
- Copy webhook routes → `platform/src/app/api/webhooks/`
- Copy connect-specific pages → `platform/src/app/(connect)/` (channels, bots, workflows, templates)
- Merge the inbox: add channel filter + multi-channel compose to existing inbox components
- Verify: `connect.relentify.com` serves the platform app with connect features visible

### Phase 4: Move CRM (25crm) into platform
- Copy CRM services → `platform/src/lib/services/crm/`
- Copy CRM pages → `platform/src/app/(crm)/` (contacts, properties, tenancies, etc.)
- Copy CRM-specific API routes → `platform/src/app/api/crm/`
- Port the portal (tenant/landlord portal with bcrypt auth)
- Verify: `crm.relentify.com` serves the platform app with all features visible

### Phase 5: Retire old apps
- Stop 29chat, 30connect, 25crm containers
- Update Caddy: all 3 domains → platform container
- Clean up: remove old apps from monorepo (or archive)
- Free ~512MB RAM from 2 fewer containers
- Update CLAUDE.md

### Phase 6: Clean up
- Remove `packages/chat/` and `packages/connect/` (no longer needed — code is in the app)
- Deduplicate any remaining service logic
- Combine duplicate SSE managers into one
- Run all MCP + E2E tests against the unified app
- Update all documentation

---

## Docker Setup (Post-Migration)

```yaml
# apps/platform/docker-compose.yml
services:
  web:
    container_name: platform
    build:
      context: ../../
      dockerfile: apps/platform/Dockerfile
    restart: always
    env_file: .env
    ports:
      - "3020:3000"   # or whatever port
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:3000/api/health || exit 1"]
    networks:
      - infra_default
```

```
# Caddyfile — all 3 domains → one container
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

## Risk Mitigation

1. **Build each phase incrementally.** Don't merge all 3 at once. Chat first → verify → Connect → verify → CRM → verify.
2. **Keep old containers running** during migration. Caddy switches domains one at a time.
3. **Run MCP tests after each phase** against the platform app to catch regressions.
4. **Git branch** the migration so main stays deployable.

---

## Decision Needed

**Option C (Single App)** is recommended. The migration is ~3-5 sessions of work but eliminates all future code duplication permanently.

Alternative: if you want to keep the 3 apps separate for now and revisit later, **Option B (Shared Packages)** can be completed to ~90% coverage. But you'll always have 3 copies of the inbox and 3 builds to maintain.

Your call.
