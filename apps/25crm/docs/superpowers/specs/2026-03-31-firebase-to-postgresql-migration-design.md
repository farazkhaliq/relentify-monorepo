# Firebase to PostgreSQL Migration — 25crm

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Remove all Firebase (Firestore, Auth, Storage) from 25crm and migrate to PostgreSQL + local file storage + JWT auth.

---

## Context

25crm is a Next.js CRM app for letting agents, running at crm.relentify.com (container `25crm`, port 3025). It currently uses Firebase Firestore as its primary data store (13 collections), Firebase Auth for portal login, and Firebase Storage for file uploads. The API layer (13 routes) already reads from PostgreSQL via `crm.service.ts`, but the client-side components (30+) still read/write directly to Firestore via `useCollection`/`useDoc` hooks.

The goal is to remove Firebase entirely and run 100% on the shared `infra-postgres` instance, matching the architecture of the other Relentify apps.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File storage | Local disk (Docker volume) | Simplest, no external dependency. Can move to S3 later. |
| Portal auth | Separate `crm_portal_users` table | Keeps portal users isolated from staff users in the shared `users` table. |
| Missing Firestore collections | Create PostgreSQL tables for all 8 | Full parity — all existing UI needs backing tables. |
| Entity scoping | Standardise on `entity_id` | Matches the rest of the Relentify ecosystem. Migration 001 tables need `entity_id` added. |
| Real-time updates | SWR with 15-second polling | Near-real-time feel without WebSocket complexity. Can upgrade later. |
| Migration strategy | Incremental (component-by-component) | App stays deployable throughout. Firebase removed as final cleanup step. |

---

## 1. Database Connection Fix

**Problem:** `/src/lib/db.ts` wraps Prisma's `$queryRawUnsafe()`, which passes all parameters as text type, breaking UUID column comparisons.

**Fix:** Replace with a direct `pg.Pool` instance:

```typescript
// src/lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default pool

export async function query(text: string, params?: any[]) {
  const result = await pool.query(text, params)
  return result.rows
}
```

Add `pg` and `@types/pg` to `package.json`. Keep the `@relentify/database` import only for Prisma-model operations (User lookups in auth.ts).

---

## 2. Entity Scoping Standardisation

### Alter existing tables

Add `entity_id` column to tables from migration 001:

- `crm_contacts` — add `entity_id UUID NOT NULL`, FK to `entities`, index
- `crm_properties` — add `entity_id UUID NOT NULL`, FK to `entities`, index
- `crm_tenancies` — add `entity_id UUID NOT NULL`, FK to `entities`, index
- `crm_notifications` — add `entity_id UUID NOT NULL`, FK to `entities`, index

Backfill strategy: for each row, resolve `entity_id` from the user's default entity (`SELECT id FROM entities WHERE user_id = row.user_id AND is_default = true`). If no default entity exists, create one.

### Resolve activeEntityId

Update `getAuthUser()` in `/src/lib/auth.ts` to query the user's active entity:

```typescript
// After JWT verification, resolve entity
const entityResult = await pool.query(
  'SELECT id FROM entities WHERE user_id = $1 LIMIT 1',
  [payload.userId]
)
const activeEntityId = entityResult.rows[0]?.id || null
```

This unblocks all entity-scoped queries across the app.

---

## 3. New PostgreSQL Tables

### crm_communications

```sql
CREATE TABLE crm_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('Email', 'Call', 'WhatsApp', 'SMS', 'Note')),
  direction VARCHAR(10) CHECK (direction IN ('Inbound', 'Outbound')),
  subject VARCHAR(500),
  body TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_communications_entity ON crm_communications(entity_id);
CREATE INDEX idx_crm_communications_contact ON crm_communications(contact_id);
```

### crm_documents

```sql
CREATE TABLE crm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  related_type VARCHAR(50) NOT NULL,
  related_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_documents_entity ON crm_documents(entity_id);
CREATE INDEX idx_crm_documents_related ON crm_documents(related_type, related_id);
```

### crm_transactions

```sql
CREATE TABLE crm_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES crm_tenancies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('Rent', 'Deposit', 'Fee', 'Payout', 'Refund', 'Other')),
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Failed', 'Cancelled')),
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_transactions_entity ON crm_transactions(entity_id);
CREATE INDEX idx_crm_transactions_tenancy ON crm_transactions(tenancy_id);
```

### crm_workflow_rules

```sql
CREATE TABLE crm_workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  conditions JSONB DEFAULT '{}',
  actions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_workflow_rules_entity ON crm_workflow_rules(entity_id);
```

### crm_bank_accounts

```sql
CREATE TABLE crm_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  sort_code VARCHAR(10),
  account_number VARCHAR(20),
  bank_name VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_bank_accounts_entity ON crm_bank_accounts(entity_id);
```

### crm_audit_logs

```sql
CREATE TABLE crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('Create', 'Update', 'Delete', 'Login', 'Logout')),
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_audit_logs_entity ON crm_audit_logs(entity_id);
CREATE INDEX idx_crm_audit_logs_created ON crm_audit_logs(created_at DESC);
```

No UPDATE or DELETE permissions on this table — append-only by convention (enforced at API layer).

### crm_user_profiles

```sql
CREATE TABLE crm_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, user_id)
);
CREATE INDEX idx_crm_user_profiles_entity ON crm_user_profiles(entity_id);
CREATE INDEX idx_crm_user_profiles_user ON crm_user_profiles(user_id);
```

### crm_portal_users

```sql
CREATE TABLE crm_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('Tenant', 'Landlord')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, entity_id)
);
CREATE INDEX idx_crm_portal_users_entity ON crm_portal_users(entity_id);
CREATE INDEX idx_crm_portal_users_email ON crm_portal_users(email);
```

---

## 4. File Storage

### Infrastructure

- Docker volume: `/opt/25crm-uploads/` mounted into the `25crm` container at `/app/uploads`
- Add to `docker-compose.yml`:
  ```yaml
  volumes:
    - /opt/25crm-uploads:/app/uploads
  ```

### Upload endpoint

`POST /api/uploads` — multipart form data:
- Validates auth (staff or portal user)
- Validates file size (max 10MB) and mime type
- Saves to `/app/uploads/{entityId}/{uuid}.{ext}`
- Returns `{ path: "entityId/uuid.ext" }`

### Serving files

`GET /api/uploads/[...path]` — streams file from disk with correct Content-Type header. Auth-gated (must belong to same entity).

### Migration from Firebase Storage

Existing files in Firebase Storage are not migrated automatically. The `crm_documents` rows in Firestore reference `firebasestorage.googleapis.com` URLs. New uploads go to local storage. Old URLs continue to work until Firebase project is decommissioned (manual cutover if needed).

---

## 5. API Layer — Full CRUD

### Standard pattern per entity

Each entity gets a service file and route handlers:

```
src/lib/services/{entity}.service.ts    — getAll, getById, create, update, delete
src/app/api/{entity}/route.ts           — GET (list), POST (create)
src/app/api/{entity}/[id]/route.ts      — GET (by id), PATCH (update), DELETE (delete)
```

### Entities

| Entity | Service | Routes | Notes |
|--------|---------|--------|-------|
| contacts | crm-contacts.service.ts | /api/contacts, /api/contacts/[id] | Full CRUD |
| properties | property.service.ts (exists) | /api/properties, /api/properties/[id] | Extend existing |
| tenancies | crm-tenancies.service.ts | /api/tenancies, /api/tenancies/[id] | Include tenant assignment |
| maintenance | crm-maintenance.service.ts | /api/maintenance, /api/maintenance/[id] | Full CRUD |
| tasks | crm-tasks.service.ts | /api/tasks, /api/tasks/[id] | Full CRUD |
| communications | crm-communications.service.ts | /api/communications, /api/communications/[id] | Full CRUD |
| documents | crm-documents.service.ts | /api/documents, /api/documents/[id] | Create links to uploaded files |
| transactions | crm-transactions.service.ts | /api/transactions, /api/transactions/[id] | Full CRUD |
| workflow-rules | crm-workflow-rules.service.ts | /api/workflow-rules, /api/workflow-rules/[id] | Full CRUD |
| bank-accounts | crm-bank-accounts.service.ts | /api/bank-accounts, /api/bank-accounts/[id] | Full CRUD |
| notifications | crm-notifications.service.ts | /api/notifications, /api/notifications/[id] | GET list, PATCH (mark read), no create via API |
| audit-logs | crm-audit-logs.service.ts | /api/audit-logs | GET only (append-only) |
| user-profiles | crm-user-profiles.service.ts | /api/user-profiles, /api/user-profiles/[id] | Admin-only management |

### Audit logging

Server-side `logAuditEvent()` function called in POST/PATCH/DELETE handlers:

```typescript
export async function logAuditEvent(
  entityId: string,
  userId: string,
  action: 'Create' | 'Update' | 'Delete',
  resourceType: string,
  resourceId: string,
  details?: Record<string, any>
) {
  await query(
    `INSERT INTO crm_audit_logs (entity_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entityId, userId, action, resourceType, resourceId, details ? JSON.stringify(details) : '{}']
  )
}
```

---

## 6. Client-Side Migration

### SWR setup

Add `swr` to `package.json`. Create shared hooks:

```typescript
// src/hooks/use-api.ts
import useSWR, { mutate } from 'swr'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
})

export function useApiCollection<T>(path: string) {
  const { data, error, isLoading } = useSWR<T[]>(path, fetcher, {
    refreshInterval: 15000,
  })
  return { data: data || [], isLoading, error }
}

export function useApiDoc<T>(path: string | null) {
  const { data, error, isLoading } = useSWR<T>(path, fetcher, {
    refreshInterval: 15000,
  })
  return { data, isLoading, error }
}

export async function apiCreate(path: string, body: any) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  mutate(path)
  return res.json()
}

export async function apiUpdate(path: string, body: any) {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  // Mutate both the item and the list
  mutate(path)
  mutate(path.replace(/\/[^/]+$/, ''))
  return res.json()
}

export async function apiDelete(path: string) {
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  mutate(path.replace(/\/[^/]+$/, ''))
}
```

### Component migration pattern

For each component:

1. Remove Firebase imports (`useCollection`, `useFirestore`, `collection`, `query`, etc.)
2. Replace with `useApiCollection`/`useApiDoc` hook
3. Replace `addDocumentNonBlocking`/`updateDocumentNonBlocking`/`deleteDocumentNonBlocking` with `apiCreate`/`apiUpdate`/`apiDelete`
4. Remove `logAuditEvent` calls from client (now server-side)
5. Adjust field names from Firestore camelCase to PostgreSQL snake_case where needed

---

## 7. Portal Auth

### Login flow

`POST /api/portal/auth/login`:
1. Receive `{ email, password }`
2. Query `crm_portal_users` by email
3. Verify bcrypt hash
4. Issue JWT with `{ portalUserId, entityId, contactId, role }`
5. Set `crm_portal_token` HttpOnly cookie
6. Return portal user profile

### Signup flow

`POST /api/portal/auth/signup`:
1. Receive `{ email, password, fullName, role, entityId }`
2. Validate entity exists
3. Hash password with bcrypt
4. Create `crm_portal_users` row
5. Create corresponding `crm_contacts` row (type matches role)
6. Link via `contact_id`
7. Issue JWT, set cookie

### Portal middleware

Update `/src/middleware.ts` to check `crm_portal_token` for `/portal/*` routes (excluding `/portal/login` and `/portal/signup`).

### Portal data access

Portal pages query the same API endpoints but are scoped by the portal user's `entity_id` and `contact_id`. Portal users can only see their own data (their tenancies, maintenance requests, documents, transactions).

---

## 8. Firebase Removal (Final Step)

### Files to delete

```
src/firebase/                          # 11 files (config, provider, hooks, audit, errors)
firestore.rules                        # 404 lines
storage.rules                          # Firestore storage rules
apphosting.yaml                        # Firebase App Hosting config
firebase.json                          # Firebase project config (if exists)
.firebaserc                            # Firebase project alias (if exists)
src/components/FirebaseErrorListener.tsx
```

### package.json changes

Remove:
- `firebase` (^12.10.0)
- `firebase-admin` (^13.7.0)

This also eliminates the 4 HIGH CVEs in `node-forge@1.3.3` (transitive via `firebase-admin`).

### Code cleanup

- Remove `<FirebaseClientProvider>` from `/src/app/layout.tsx`
- Remove `firebasestorage.googleapis.com` from `next.config.ts` remotePatterns
- Remove any remaining Firebase imports across all components
- Delete `/api/listings` route (Firebase holdover) or rewrite to PostgreSQL

---

## 9. Migration Order

Each step produces a deployable build. MCP tests run after each step.

1. **DB connection fix + entity scoping** — prerequisite for everything
2. **SWR infrastructure + useApi hooks** — shared client utilities
3. **Contacts** — simplest CRUD, proves the full pattern end-to-end
4. **Properties** — extend existing CRUD, add SWR
5. **Tenancies** — includes tenant assignment (many-to-many)
6. **Maintenance requests** — standard CRUD
7. **Tasks** — standard CRUD
8. **Communications** — new table + CRUD
9. **Documents + file upload** — new table + upload endpoint + local storage
10. **Transactions** — new table + CRUD
11. **Bank accounts + workflow rules** — new tables + CRUD
12. **Audit logs + notifications** — new tables + server-side audit, notification endpoints
13. **User profiles** — new table + admin management
14. **Portal auth migration** — portal_users table, login/signup, middleware
15. **Dashboard/reports** — rewire client to use SWR (API already PostgreSQL)
16. **Firebase removal + cleanup** — delete all Firebase code and dependencies
17. **MCP test suite update** — extend tests to cover new endpoints

---

## 10. Testing Strategy

- **MCP test suite** (25crm-mcp): run after each major step, extend with new endpoint tests
- **Manual smoke test**: after each entity migration, verify list/create/edit/delete in the UI
- **Portal auth**: test login/signup/access-control after step 14
- **File upload**: test upload + retrieval after step 9
- **Full regression**: after Firebase removal (step 16), verify all pages load and all CRUD works
