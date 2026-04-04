# Help Articles, Developer API, Granular Permissions, Mismatch Flagging

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Complete 26help coverage, add developer API key auth, wire granular permissions across all routes, and add mismatch flagging.

**Architecture:** 4 sequential features. Help articles are content-only (MDX). Developer API adds api_keys table + Bearer auth middleware. Permissions expands existing WorkspacePermissions type and wires checkPermission into ~30 unprotected routes. Mismatch flagging adds detection logic on bill create and bank reconciliation.

**Tech Stack:** Next.js 15, TypeScript, PostgreSQL, MDX, Pagefind

---

## Task 1: Help Articles (27 articles)

**Files:** Create 27 `.mdx` files in `apps/26help/content/accounting/` + 7 in `apps/26help/content/api/`

Follow existing format: frontmatter (title, description, category, order, video, appRoute, relatedArticles) + body (What this does, When to use it, Step by step) + VideoGuide component.

Rebuild 26help container after writing all articles.

---

## Task 2: Developer API

**Files:**
- Create: `app/api/developer/keys/route.ts` (POST, GET)
- Create: `app/api/developer/keys/[id]/route.ts` (DELETE)
- Create: `src/lib/api-key.service.ts`
- Modify: `src/lib/auth.ts` — add API key auth path in getAuthUser
- Modify: `src/lib/tiers.ts` — no change needed (sole_trader+ gating done in route)

**DB migration:**
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
```

**Key format:** `rlk_<32 hex chars>`, stored as SHA-256 hash.

**Auth flow:** Check Authorization header first → hash key → lookup → set auth context → fall back to cookie.

**Rate limiting:** 100 req/min per key, in-memory Map with minute-window reset.

---

## Task 3: Granular Permissions

**Files:**
- Modify: `src/lib/auth.ts` — expand WorkspacePermissions
- Modify: `src/lib/team-defaults.ts` — add defaults for new modules
- Modify: `src/lib/workspace-auth.ts` — no change (already generic)
- Modify: ~30 route files to add checkPermission calls
- Modify: `app/dashboard/team/page.tsx` — permissions editor UI

**New permission modules:** expenses, quotes, creditNotes, journals, po, projects, mileage, vat, coa, audit, entities

**Pattern for each route:**
```ts
const denied = checkPermission(auth, 'module', 'action');
if (denied) return denied;
```

---

## Task 4: Mismatch Flagging

**Files:**
- Create: `src/lib/mismatch.service.ts`
- Create: `app/api/mismatches/route.ts` (GET)
- Create: `app/api/mismatches/[id]/route.ts` (PATCH)
- Modify: `src/lib/bill.service.ts` — add mismatch detection on create
- Modify: `src/lib/banking.service.ts` — add mismatch detection on reconcile

**DB migration:**
```sql
CREATE TABLE mismatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  source_amount DECIMAL(12,2),
  reference_amount DECIMAL(12,2),
  difference DECIMAL(12,2),
  message TEXT,
  status TEXT DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_mismatches_user_status ON mismatches(user_id, status);
```
