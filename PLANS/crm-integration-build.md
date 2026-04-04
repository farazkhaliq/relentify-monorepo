# CRM Integration — Detailed Build Plan

Embed Connect into 25crm natively. Replaces old read-only communications + removes Gemini.

**Master plan**: `/opt/relentify-monorepo/PLANS/communications-platform-master-plan.md`
**Depends on**: 29chat + 30connect (both must be built and deployed)
**This is deliverable 3 of 4.** Can be done in parallel with → `marketing-pages-build.md`
**Previous**: `29chat-build.md` → `30connect-build.md` → **this**

---

## Overview

This is one phase with 7 steps. It's a refactor of 25crm, not a new app.

**What happens:**
1. Extract shared code into `@relentify/chat` and `@relentify/connect` packages
2. Add Connect's unified inbox to CRM as a built-in module
3. Remove old read-only communications system + Gemini AI dependency
4. Link chat/conversations to CRM contacts automatically

**Result:** CRM users get full multi-channel inbox (chat, email, WhatsApp, SMS, voice, Facebook, Instagram) from within the CRM app, using shared components and services. No API calls between apps — shared code.

---

## Step 1: Extract `@relentify/chat` package

Create `packages/chat/` from 29chat services and components.

### Structure
```
packages/chat/
├── package.json            # @relentify/chat, workspace:*
├── tsconfig.json
├── src/
│   ├── services/
│   │   ├── visitor.service.ts
│   │   ├── session.service.ts
│   │   ├── message.service.ts
│   │   ├── config.service.ts
│   │   ├── knowledge.service.ts
│   │   ├── routing.service.ts
│   │   ├── ai.service.ts
│   │   ├── ai-usage.service.ts
│   │   ├── analytics.service.ts
│   │   ├── sse.service.ts
│   │   ├── trigger.service.ts
│   │   ├── ticket.service.ts
│   │   ├── webhook.service.ts
│   │   ├── upload.service.ts
│   │   ├── push.service.ts
│   │   ├── sla.service.ts
│   │   └── qa.service.ts
│   ├── components/
│   │   ├── ChatThread.tsx
│   │   ├── ReplyInput.tsx
│   │   ├── SessionList.tsx
│   │   ├── VisitorSidebar.tsx
│   │   ├── VisitorMonitor.tsx
│   │   ├── CannedResponsePicker.tsx
│   │   ├── TicketList.tsx
│   │   ├── TicketDetail.tsx
│   │   └── SLABadge.tsx
│   ├── hooks/
│   │   └── use-sse.ts
│   ├── types.ts
│   ├── crypto.ts
│   └── index.ts
```

### Process
1. Create `packages/chat/package.json` with deps: `pg`, `web-push`, `uuid`, `zod`
2. Move service files from `apps/29chat/src/lib/services/` → `packages/chat/src/services/`
3. Move shared components from `apps/29chat/src/components/inbox/` → `packages/chat/src/components/`
4. Move hooks from `apps/29chat/src/hooks/use-sse.ts` → `packages/chat/src/hooks/`
5. Update `apps/29chat/` — replace local imports with `import { ... } from '@relentify/chat'`
6. Add `@relentify/chat` to `apps/29chat/package.json` dependencies
7. `pnpm install` at root
8. Verify 29chat still builds: `pnpm --filter chat build`
9. Run 29chat MCP tests — all must pass
10. Docker rebuild 29chat, verify deployed app still works

### Important: Pool dependency
Services need a database pool. Two options:
- **Option A**: Services accept `pool` as a parameter (dependency injection). Each app passes its own pool.
- **Option B**: Services import from a shared config that reads `DATABASE_URL` from env.

**Option A is cleaner** — services are pure functions that take a pool. The package exports service factories:
```typescript
// packages/chat/src/services/session.service.ts
export function createSessionService(pool: Pool) {
  return {
    async createSession(entityId: string, visitorId: string) { /* uses pool */ },
    async listSessions(entityId: string, filters: any) { /* uses pool */ },
  }
}
```

Each app initialises services once:
```typescript
// apps/29chat/src/lib/services.ts
import pool from './pool'
import { createSessionService, createMessageService, ... } from '@relentify/chat'
export const sessionService = createSessionService(pool)
export const messageService = createMessageService(pool)
```

---

## Step 2: Extract `@relentify/connect` package

Create `packages/connect/` from 30connect services and components.

### Structure
```
packages/connect/
├── package.json            # @relentify/connect, depends on @relentify/chat
├── tsconfig.json
├── src/
│   ├── services/
│   │   ├── conversation.service.ts
│   │   ├── whatsapp.service.ts
│   │   ├── email-channel.service.ts
│   │   ├── sms.service.ts
│   │   ├── facebook.service.ts
│   │   ├── channel.service.ts
│   │   ├── template.service.ts
│   │   ├── bot.service.ts
│   │   ├── workflow.service.ts
│   │   └── voice.service.ts
│   ├── components/
│   │   ├── UnifiedInbox.tsx
│   │   ├── ConversationThread.tsx
│   │   ├── ChannelSelector.tsx
│   │   ├── ComposeMessage.tsx
│   │   ├── BotBuilder.tsx
│   │   ├── WorkflowBuilder.tsx
│   │   ├── VoicePanel.tsx
│   │   └── VoiceDialer.tsx
│   └── index.ts            # Re-exports @relentify/chat + connect additions
```

### Process
Same as Step 1 but for 30connect → `packages/connect/`. Update 30connect imports. Verify build + tests.

---

## Step 3: Add Connect to CRM

### Changes to `apps/25crm/package.json`
Add dependencies:
```json
"@relentify/chat": "workspace:*",
"@relentify/connect": "workspace:*"
```

### Changes to CRM layout (`apps/25crm/src/app/(app)/layout.tsx`)
Add "Inbox" to the Operations dropdown (or as a top-level nav item):
```tsx
const operationsItems = [
  { label: 'Inbox', href: '/inbox' },          // NEW
  { label: 'Communications', href: '/communications' }, // KEPT for now (archive)
  { label: 'Tasks', href: '/tasks' },
  // ...
]
```

### New CRM pages
```
apps/25crm/src/app/(app)/inbox/page.tsx              # Uses <UnifiedInbox> from @relentify/connect
apps/25crm/src/app/(app)/inbox/[conversationId]/page.tsx  # Conversation detail
```

These pages render the same components as 30connect but within CRM's layout. They use CRM's `getAuthUser()` — same entity_id, same users table.

### New CRM API routes
```
apps/25crm/src/app/api/chat/
├── sessions/route.ts                    # Thin wrapper → @relentify/chat sessionService
├── sessions/[id]/route.ts
├── sessions/[id]/messages/route.ts
├── sessions/[id]/stream/route.ts        # SSE
├── conversations/route.ts               # Thin wrapper → @relentify/connect conversationService
├── conversations/[id]/route.ts
├── conversations/[id]/messages/route.ts
├── conversations/[id]/stream/route.ts   # SSE
├── events/route.ts                      # SSE — new session/conversation notifications
├── voice/token/route.ts                 # Twilio Client token for CRM agents
└── voice/outbound/route.ts              # Initiate call from CRM
```

These are thin wrappers — `getAuthUser()` → service call → `NextResponse.json()`. The actual logic lives in the shared packages.

### CRM service initialisation
```typescript
// apps/25crm/src/lib/chat-services.ts
import pool from './pool'
import { createSessionService, createMessageService, createConfigService } from '@relentify/chat'
import { createConversationService, createVoiceService } from '@relentify/connect'

export const chatSessionService = createSessionService(pool)
export const chatMessageService = createMessageService(pool)
export const chatConfigService = createConfigService(pool)
export const conversationService = createConversationService(pool)
export const voiceService = createVoiceService(pool)
```

---

## Step 4: Remove old communications

### Delete files
- `src/lib/services/communications.service.ts`
- `src/app/api/communications/route.ts`
- `src/app/api/communications/[id]/route.ts`
- `src/app/(app)/communications/page.tsx` → replace with archive view (see Step 6)
- `src/components/log-communication-dialog.tsx`
- `src/ai/flows/analyze-communication-flow.ts`
- `src/ai/flows/generate-property-description.ts` (if also uses Gemini)
- `src/ai/genkit.ts`

### Remove Gemini dependency
- Remove `@google/generative-ai` from `apps/25crm/package.json`
- Remove `genkit` and related packages if present
- `pnpm install` to update lockfile

### Replace with generic AI
If CRM still needs AI features (property descriptions, communication analysis), replace Gemini calls with `@relentify/chat`'s generic HTTP AI service:
```typescript
import { createAIService } from '@relentify/chat'
const aiService = createAIService()
const result = await aiService.generateAIReply(messages, { apiUrl: AI_DEFAULT_URL, apiKey: AI_DEFAULT_KEY, ... })
```

---

## Step 5: Contact detail — conversation history

### Changes to `apps/25crm/src/app/(app)/contacts/[contactId]/page.tsx`

Add a "Conversations" tab/section:
- Query: `SELECT * FROM connect_conversations WHERE contact_email = $1 AND entity_id = $2`
- Also: `SELECT cs.* FROM chat_sessions cs JOIN chat_visitors cv ON cs.visitor_id = cv.id WHERE cv.email = $1 AND cv.entity_id = $2`
- Show conversation list with channel indicators
- Click to view full conversation thread (inline or navigate to /inbox/[id])
- Click-to-call button (if voice configured)

### API route
```
apps/25crm/src/app/api/contacts/[id]/conversations/route.ts
```
Queries both `connect_conversations` and `chat_sessions` where email matches.

---

## Step 6: Auto-link visitors to CRM contacts

### When a chat visitor identifies by email
In `@relentify/chat` visitor.service.ts `updateVisitor()`:
- After email is set, query `crm_contacts WHERE email = $1 AND entity_id = $2`
- If match found, store `crm_contact_id` in `chat_visitors.custom_data`
- This enables the CRM contact page to show chat history

### When a connect conversation has contact_email
Similar auto-link: match against `crm_contacts` by email.

### Bidirectional
- From CRM contact → see all conversations
- From inbox conversation → see CRM contact profile (if linked)

---

## Step 7: Old crm_communications as archive

### Replace communications page
Instead of deleting `/communications` entirely, replace it with:
- A read-only archive view of old `crm_communications` data
- Header: "Legacy Communications Archive — new messages are in Inbox"
- Link to `/inbox` for the new unified inbox

### OR: Merge old data into new view
- Create a SQL view or UNION query that combines:
  - Old `crm_communications` records (as historical entries)
  - New `connect_messages` + `chat_messages` (as live data)
- Display unified timeline on contact detail page

### Recommendation
Keep old `/communications` as archive with a banner pointing to `/inbox`. Don't try to merge data formats — they're structurally different. The old data stays readable; new conversations go to the unified inbox.

---

## Verification

1. CRM nav shows "Inbox" link
2. `/inbox` shows unified inbox with all channels (same as 30connect)
3. Agent can reply via chat, email, WhatsApp from within CRM
4. Click-to-call works from contact page
5. Contact detail page shows conversation history across all channels
6. Old `/communications` page shows archive with banner
7. Gemini dependency removed (`pnpm ls @google/generative-ai` returns nothing)
8. `@relentify/chat` and `@relentify/connect` packages build correctly
9. 29chat still works (import paths updated)
10. 30connect still works (import paths updated)
11. 25crm builds: `pnpm --filter crm build`
12. All MCP tests pass: 25crm, 29chat, 30connect
13. All E2E tests pass

---

## Risks

1. **Package extraction breaks imports**: Need thorough testing after each move. Run MCP tests after every step.
2. **Pool dependency**: Service factories need to accept pool as parameter. Don't create circular dependencies.
3. **SSE in CRM**: CRM now has SSE endpoints. Verify they work through Caddy (already has `flush_interval -1` for chat.relentify.com — need same for crm.relentify.com).
4. **Twilio Client SDK in CRM**: CRM layout needs to load Twilio Voice SDK if voice is configured. Only load when needed (dynamic import).
5. **Old data migration**: Don't try to migrate `crm_communications` rows into `connect_messages`. Keep them separate. The archive view handles backward compat.
