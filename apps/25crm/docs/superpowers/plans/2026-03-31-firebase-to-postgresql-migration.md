# Firebase to PostgreSQL Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Firebase dependencies from 25crm and migrate to PostgreSQL + local file storage + JWT portal auth.

**Architecture:** Incremental component-by-component migration. Each task produces a deployable build. Firebase and PostgreSQL coexist during migration. Firebase is deleted as the final step. All client-side Firestore subscriptions are replaced with SWR (15s polling). All writes go through API routes. Portal auth moves to a dedicated `crm_portal_users` table with bcrypt + JWT.

**Tech Stack:** Next.js 15 (App Router), PostgreSQL 15 (via `pg` pool), SWR for client data fetching, bcrypt for portal passwords, `@relentify/auth` for JWT.

**Spec:** `docs/superpowers/specs/2026-03-31-firebase-to-postgresql-migration-design.md`

**Important conventions:**
- All raw SQL uses `pg.Pool` directly (NOT Prisma `$queryRawUnsafe`)
- All API routes check `getAuthUser()` and require `auth.activeEntityId`
- All mutations call `logAuditEvent()` server-side
- Next.js 15: `params` is a Promise in route handlers — must `await params`
- Entity scoping: all queries filter by `entity_id`
- Monorepo build: `docker compose build` from `/opt/relentify-monorepo/apps/25crm/`

---

## File Structure Overview

### New files to create

```
src/lib/pool.ts                              — pg.Pool instance (replaces db.ts)
src/lib/audit.ts                             — Server-side audit logging to PostgreSQL
src/hooks/use-api.ts                         — SWR hooks + mutation helpers
src/app/api/contacts/[id]/route.ts           — GET/PATCH/DELETE single contact
src/app/api/tenancies/[id]/route.ts          — GET/PATCH/DELETE single tenancy
src/app/api/maintenance/[id]/route.ts        — GET/PATCH/DELETE single maintenance
src/app/api/tasks/[id]/route.ts              — GET/PATCH/DELETE single task
src/app/api/communications/route.ts          — GET/POST communications
src/app/api/communications/[id]/route.ts     — GET/PATCH/DELETE single communication
src/app/api/documents/route.ts               — GET/POST documents
src/app/api/documents/[id]/route.ts          — GET/PATCH/DELETE single document
src/app/api/transactions/route.ts            — GET/POST transactions
src/app/api/transactions/[id]/route.ts       — GET/PATCH/DELETE single transaction
src/app/api/workflow-rules/route.ts          — GET/POST workflow rules
src/app/api/workflow-rules/[id]/route.ts     — GET/PATCH/DELETE single workflow rule
src/app/api/bank-accounts/route.ts           — GET/POST bank accounts
src/app/api/bank-accounts/[id]/route.ts      — GET/PATCH/DELETE single bank account
src/app/api/audit-logs/route.ts              — GET audit logs (read-only)
src/app/api/user-profiles/route.ts           — GET/POST user profiles
src/app/api/user-profiles/[id]/route.ts      — GET/PATCH single user profile
src/app/api/uploads/route.ts                 — POST file upload
src/app/api/uploads/[...path]/route.ts       — GET serve uploaded file
src/app/api/portal/auth/login/route.ts       — POST portal login
src/app/api/portal/auth/signup/route.ts      — POST portal signup
src/app/api/portal/auth/me/route.ts          — GET current portal user
src/lib/services/contacts.service.ts         — Full CRUD for contacts
src/lib/services/tenancies.service.ts        — Full CRUD for tenancies
src/lib/services/maintenance.service.ts      — Full CRUD for maintenance
src/lib/services/tasks.service.ts            — Full CRUD for tasks
src/lib/services/communications.service.ts   — Full CRUD for communications
src/lib/services/documents.service.ts        — Full CRUD for documents
src/lib/services/transactions.service.ts     — Full CRUD for transactions
src/lib/services/workflow-rules.service.ts   — Full CRUD for workflow rules
src/lib/services/bank-accounts.service.ts    — Full CRUD for bank accounts
src/lib/services/audit-logs.service.ts       — Read-only for audit logs
src/lib/services/user-profiles.service.ts    — CRUD for user profiles
src/lib/services/notifications.service.ts    — Read/update for notifications
src/lib/services/portal-auth.service.ts      — Portal user auth (login/signup)
migrations/003_entity_scoping.sql            — Add entity_id to migration 001 tables
migrations/004_new_tables.sql                — All 8 new tables
```

### Files to modify

```
src/lib/db.ts                                — Replace Prisma wrapper with pg.Pool re-export
src/lib/auth.ts                              — Resolve activeEntityId from DB
src/lib/services/crm.service.ts              — Fix pool import (use new pool.ts)
src/lib/services/property.service.ts         — Fix pool import
package.json                                 — Add pg, @types/pg, swr, bcryptjs, @types/bcryptjs; remove firebase, firebase-admin
docker-compose.yml                           — Add uploads volume
next.config.ts                               — Remove firebasestorage.googleapis.com
src/app/layout.tsx                           — Remove FirebaseClientProvider
src/middleware.ts                             — Add portal auth check for /portal/* routes
src/hooks/use-user-profile.ts                — Replace Firebase with useSharedAuth
src/hooks/use-organization.ts                — Replace Firebase with useSharedAuth
src/hooks/use-portal-user-profile.ts         — Replace Firebase with API fetch
30+ component files                          — Replace Firebase with SWR + API calls
14+ page files                               — Replace Firebase with SWR + API calls
7 portal page files                          — Replace Firebase auth with JWT
```

### Files to delete (final step)

```
src/firebase/                                — All 11 files
src/components/FirebaseErrorListener.tsx
firestore.rules
storage.rules
apphosting.yaml
```

---

## Task 0: Install Dependencies and Fix DB Connection

**Files:**
- Modify: `apps/25crm/package.json`
- Create: `apps/25crm/src/lib/pool.ts`
- Modify: `apps/25crm/src/lib/db.ts`
- Modify: `apps/25crm/src/lib/services/crm.service.ts:1`
- Modify: `apps/25crm/src/lib/services/property.service.ts:1`

- [ ] **Step 1: Install pg, swr, bcryptjs**

```bash
cd /opt/relentify-monorepo
pnpm add pg swr bcryptjs --filter 25crm
pnpm add -D @types/pg @types/bcryptjs --filter 25crm
pnpm install
```

- [ ] **Step 2: Create pool.ts — the real pg.Pool**

Create `apps/25crm/src/lib/pool.ts`:

```typescript
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default pool

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows as T[]
}
```

- [ ] **Step 3: Update db.ts to re-export pool**

Replace `apps/25crm/src/lib/db.ts` with:

```typescript
import { db } from '@relentify/database'
export { db }

// For raw SQL queries, use pool directly
export { default as pool, query } from './pool'
```

The `db` export is kept for Prisma operations in `auth.ts`. All raw SQL uses `pool`/`query`.

- [ ] **Step 4: Update crm.service.ts import**

In `apps/25crm/src/lib/services/crm.service.ts`, change line 1:

```typescript
// Before
import pool from '../db';

// After
import pool from '../pool';
```

- [ ] **Step 5: Update property.service.ts import**

In `apps/25crm/src/lib/services/property.service.ts`, change line 1:

```typescript
// Before
import pool from '../db';

// After
import pool from '../pool';
```

- [ ] **Step 6: Verify existing API routes still work**

```bash
cd /opt/relentify-monorepo/apps/25crm
docker compose down && docker compose build --no-cache && docker compose up -d
sleep 5
curl -s http://localhost:3025/api/health | head -20
docker logs 25crm --tail 20
```

Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/25crm/package.json apps/25crm/src/lib/pool.ts apps/25crm/src/lib/db.ts apps/25crm/src/lib/services/crm.service.ts apps/25crm/src/lib/services/property.service.ts pnpm-lock.yaml
git commit -m "[25crm] Fix DB connection: replace Prisma wrapper with pg.Pool"
```

---

## Task 1: Entity Scoping + Auth Fix

**Files:**
- Create: `apps/25crm/migrations/003_entity_scoping.sql`
- Modify: `apps/25crm/src/lib/auth.ts`
- Modify: `apps/25crm/src/app/api/me/route.ts`

- [ ] **Step 1: Create entity scoping migration**

Create `apps/25crm/migrations/003_entity_scoping.sql`:

```sql
-- Migration 003: Standardise entity scoping
-- Adds entity_id to tables that only had user_id

-- Step 1: Add nullable entity_id columns
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE crm_properties ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE crm_tenancies ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE crm_notifications ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Step 2: Backfill entity_id from user's first entity
UPDATE crm_contacts c
SET entity_id = (SELECT e.id FROM entities e WHERE e.user_id = c.user_id LIMIT 1)
WHERE c.entity_id IS NULL;

UPDATE crm_properties p
SET entity_id = (SELECT e.id FROM entities e WHERE e.user_id = p.user_id LIMIT 1)
WHERE p.entity_id IS NULL;

UPDATE crm_tenancies t
SET entity_id = (SELECT e.id FROM entities e WHERE e.user_id = t.user_id LIMIT 1)
WHERE t.entity_id IS NULL;

UPDATE crm_notifications n
SET entity_id = (SELECT e.id FROM entities e WHERE e.user_id = n.user_id LIMIT 1)
WHERE n.entity_id IS NULL;

-- Step 3: Add FK constraints and indexes (only if entity_id column was just added)
-- Note: If entity_id already existed on some tables from migration 002, these are safe IF NOT EXISTS

DO $$
BEGIN
  -- Only add NOT NULL constraint if all rows have been backfilled
  -- If any rows still have NULL entity_id, they belong to users without entities — skip constraint
  IF NOT EXISTS (SELECT 1 FROM crm_contacts WHERE entity_id IS NULL LIMIT 1) THEN
    ALTER TABLE crm_contacts ALTER COLUMN entity_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM crm_properties WHERE entity_id IS NULL LIMIT 1) THEN
    ALTER TABLE crm_properties ALTER COLUMN entity_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM crm_tenancies WHERE entity_id IS NULL LIMIT 1) THEN
    ALTER TABLE crm_tenancies ALTER COLUMN entity_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_entity ON crm_contacts(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_properties_entity ON crm_properties(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_tenancies_entity ON crm_tenancies(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_entity ON crm_notifications(entity_id);
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-monorepo/apps/25crm/migrations/003_entity_scoping.sql
```

Verify:

```bash
docker exec infra-postgres psql -U relentify_user -d relentify -c "\d crm_contacts" | grep entity_id
```

Expected: `entity_id | uuid | not null`

- [ ] **Step 3: Fix getAuthUser() to resolve activeEntityId**

Replace `apps/25crm/src/lib/auth.ts`:

```typescript
import { verifyAuthToken, AUTH_COOKIE_NAME } from '@relentify/auth'
import { cookies } from 'next/headers'
import pool from './pool'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret'

export interface JWTPayload {
  userId: string
  email: string
  userType: string
  fullName: string
}

export interface AuthUser extends JWTPayload {
  activeEntityId: string | null
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  const payload = await verifyAuthToken(token, JWT_SECRET)
  return payload as unknown as JWTPayload
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  try {
    const rows = await pool.query(
      'SELECT id FROM entities WHERE user_id = $1 LIMIT 1',
      [payload.userId]
    )
    const activeEntityId = rows.rows[0]?.id || null

    return {
      ...payload,
      activeEntityId,
    }
  } catch (err) {
    console.error('Error fetching user active entity:', err)
    return {
      ...payload,
      activeEntityId: null,
    }
  }
}
```

- [ ] **Step 4: Update /api/me to return activeEntityId**

Read and update `apps/25crm/src/app/api/me/route.ts` to include `activeEntityId` from the auth resolver. The route should use `getAuthUser()` and return the full user object including `activeEntityId`.

- [ ] **Step 5: Rebuild and verify**

```bash
cd /opt/relentify-monorepo/apps/25crm
docker compose down && docker compose build --no-cache && docker compose up -d
sleep 5
curl -s http://localhost:3025/api/health
docker logs 25crm --tail 20
```

- [ ] **Step 6: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/25crm/migrations/003_entity_scoping.sql apps/25crm/src/lib/auth.ts apps/25crm/src/app/api/me/route.ts
git commit -m "[25crm] Standardise entity scoping + fix activeEntityId resolution"
```

---

## Task 2: Create All New PostgreSQL Tables

**Files:**
- Create: `apps/25crm/migrations/004_new_tables.sql`

- [ ] **Step 1: Create migration with all 8 new tables**

Create `apps/25crm/migrations/004_new_tables.sql`:

```sql
-- Migration 004: New tables for full Firebase parity
-- Tables: communications, documents, transactions, workflow_rules, bank_accounts,
--         audit_logs, user_profiles, portal_users

-- Ensure update trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Communications
CREATE TABLE IF NOT EXISTS crm_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('Email', 'Call', 'WhatsApp', 'SMS', 'Note')),
  direction VARCHAR(10) CHECK (direction IN ('Inbound', 'Outbound')),
  subject VARCHAR(500),
  body TEXT,
  status VARCHAR(20) DEFAULT 'Received',
  related_property_id UUID REFERENCES crm_properties(id) ON DELETE SET NULL,
  related_tenancy_id UUID REFERENCES crm_tenancies(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_communications_entity ON crm_communications(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_communications_contact ON crm_communications(contact_id);
CREATE TRIGGER update_crm_communications_updated_at BEFORE UPDATE ON crm_communications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Documents
CREATE TABLE IF NOT EXISTS crm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  related_type VARCHAR(50) NOT NULL,
  related_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_documents_entity ON crm_documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_related ON crm_documents(related_type, related_id);
CREATE TRIGGER update_crm_documents_updated_at BEFORE UPDATE ON crm_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Transactions
CREATE TABLE IF NOT EXISTS crm_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES crm_tenancies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  related_property_id UUID REFERENCES crm_properties(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('Rent Payment', 'Management Fee', 'Commission', 'Landlord Payout', 'Contractor Payment', 'Agency Expense', 'Deposit')),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GBP',
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Failed', 'Cancelled')),
  reconciled BOOLEAN DEFAULT false,
  description TEXT,
  payer_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  payee_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_entity ON crm_transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_tenancy ON crm_transactions(tenancy_id);
CREATE TRIGGER update_crm_transactions_updated_at BEFORE UPDATE ON crm_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Workflow Rules
CREATE TABLE IF NOT EXISTS crm_workflow_rules (
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
CREATE INDEX IF NOT EXISTS idx_crm_workflow_rules_entity ON crm_workflow_rules(entity_id);
CREATE TRIGGER update_crm_workflow_rules_updated_at BEFORE UPDATE ON crm_workflow_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Bank Accounts
CREATE TABLE IF NOT EXISTS crm_bank_accounts (
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
CREATE INDEX IF NOT EXISTS idx_crm_bank_accounts_entity ON crm_bank_accounts(entity_id);
CREATE TRIGGER update_crm_bank_accounts_updated_at BEFORE UPDATE ON crm_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Audit Logs (append-only — no update trigger)
CREATE TABLE IF NOT EXISTS crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('Create', 'Update', 'Delete', 'Login', 'Logout')),
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  resource_name VARCHAR(255),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_entity ON crm_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_created ON crm_audit_logs(created_at DESC);

-- 7. User Profiles (staff roles per entity)
CREATE TABLE IF NOT EXISTS crm_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_user_profiles_entity ON crm_user_profiles(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_user_profiles_user ON crm_user_profiles(user_id);
CREATE TRIGGER update_crm_user_profiles_updated_at BEFORE UPDATE ON crm_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Portal Users (separate from staff)
CREATE TABLE IF NOT EXISTS crm_portal_users (
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
CREATE INDEX IF NOT EXISTS idx_crm_portal_users_entity ON crm_portal_users(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_portal_users_email ON crm_portal_users(email);
CREATE TRIGGER update_crm_portal_users_updated_at BEFORE UPDATE ON crm_portal_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-monorepo/apps/25crm/migrations/004_new_tables.sql
```

- [ ] **Step 3: Verify all tables exist**

```bash
docker exec infra-postgres psql -U relentify_user -d relentify -c "\dt crm_*"
```

Expected: 15 tables (7 existing + 8 new):
- crm_contacts, crm_properties, crm_tenancies, crm_tenancy_tenants, crm_maintenance_requests, crm_tasks, crm_notifications
- crm_communications, crm_documents, crm_transactions, crm_workflow_rules, crm_bank_accounts, crm_audit_logs, crm_user_profiles, crm_portal_users

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/25crm/migrations/004_new_tables.sql
git commit -m "[25crm] Create 8 new PostgreSQL tables for full Firebase parity"
```

---

## Task 3: SWR Infrastructure + Audit Logger + Shared Hooks

**Files:**
- Create: `apps/25crm/src/hooks/use-api.ts`
- Create: `apps/25crm/src/lib/audit.ts`
- Modify: `apps/25crm/src/hooks/use-user-profile.ts`
- Modify: `apps/25crm/src/hooks/use-organization.ts`

- [ ] **Step 1: Create the SWR hooks and mutation helpers**

Create `apps/25crm/src/hooks/use-api.ts`:

```typescript
'use client'

import useSWR, { mutate } from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json()
}

export function useApiCollection<T = any>(path: string | null) {
  const { data, error, isLoading, mutate: boundMutate } = useSWR<T[]>(
    path,
    fetcher,
    { refreshInterval: 15000 }
  )
  return { data: data || [], isLoading, error, mutate: boundMutate }
}

export function useApiDoc<T = any>(path: string | null) {
  const { data, error, isLoading, mutate: boundMutate } = useSWR<T>(
    path,
    fetcher,
    { refreshInterval: 15000 }
  )
  return { data: data ?? null, isLoading, error, mutate: boundMutate }
}

export async function apiCreate<T = any>(path: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  mutate(path)
  return data
}

export async function apiUpdate<T = any>(path: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  // Mutate both the item URL and the list URL
  mutate(path)
  const listPath = path.replace(/\/[^/]+$/, '')
  mutate(listPath)
  return data
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  const listPath = path.replace(/\/[^/]+$/, '')
  mutate(listPath)
}
```

- [ ] **Step 2: Create server-side audit logger**

Create `apps/25crm/src/lib/audit.ts`:

```typescript
import pool from './pool'

export async function logAuditEvent(
  entityId: string,
  userId: string,
  action: 'Create' | 'Update' | 'Delete',
  resourceType: string,
  resourceId: string,
  resourceName?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO crm_audit_logs (entity_id, user_id, action, resource_type, resource_id, resource_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entityId, userId, action, resourceType, resourceId, resourceName || null, details ? JSON.stringify(details) : '{}']
    )
  } catch (err) {
    // Fire-and-forget — log but don't throw
    console.error('Audit log failed:', err)
  }
}
```

- [ ] **Step 3: Rewrite use-user-profile.ts to use SharedAuth instead of Firebase**

Replace `apps/25crm/src/hooks/use-user-profile.ts`:

```typescript
'use client'

import { useSharedAuth } from '@/hooks/use-shared-auth'

export function useUserProfile() {
  const { user, isUserLoading, error } = useSharedAuth()

  const userProfile = user ? {
    uid: user.id,
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.userType === 'sole_trader' || user.userType === 'admin' ? 'Admin' : 'Staff',
    organizationId: user.activeEntityId,
    activeEntityId: user.activeEntityId,
  } : null

  return {
    userProfile,
    isAdmin: user?.userType === 'sole_trader' || user?.userType === 'admin',
    isLoading: isUserLoading,
    error,
  }
}
```

- [ ] **Step 4: Rewrite use-organization.ts to use SharedAuth**

Replace `apps/25crm/src/hooks/use-organization.ts`:

```typescript
'use client'

import { useUserProfile } from '@/hooks/use-user-profile'

export function useOrganization() {
  const { userProfile, isLoading, error } = useUserProfile()

  const organization = userProfile?.activeEntityId ? {
    id: userProfile.activeEntityId,
    name: 'My Organization',
    aiEnabled: true,
  } : null

  return {
    organization,
    isLoading,
    error,
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/25crm/src/hooks/use-api.ts apps/25crm/src/lib/audit.ts apps/25crm/src/hooks/use-user-profile.ts apps/25crm/src/hooks/use-organization.ts
git commit -m "[25crm] Add SWR hooks, audit logger, fix user profile hooks"
```

---

## Task 4: Contacts — Full CRUD API + Component Migration

This is the first entity migration and establishes the pattern for all subsequent entities.

**Files:**
- Create: `apps/25crm/src/lib/services/contacts.service.ts`
- Modify: `apps/25crm/src/app/api/contacts/route.ts`
- Create: `apps/25crm/src/app/api/contacts/[id]/route.ts`
- Modify: `apps/25crm/src/components/add-contact-dialog.tsx`
- Modify: `apps/25crm/src/components/edit-contact-dialog.tsx`
- Modify: `apps/25crm/src/app/(app)/contacts/page.tsx`
- Modify: `apps/25crm/src/app/(app)/contacts/[contactId]/page.tsx`

- [ ] **Step 1: Create contacts.service.ts with full CRUD**

Create `apps/25crm/src/lib/services/contacts.service.ts`:

```typescript
import pool from '../pool'

export interface Contact {
  id: string
  entity_id: string
  user_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  contact_type: 'Lead' | 'Tenant' | 'Landlord' | 'Contractor' | 'Guarantor'
  status: 'Active' | 'Inactive' | 'Archived'
  address_line1?: string
  address_line2?: string
  city?: string
  postcode?: string
  country?: string
  notes?: string
  created_at: Date
  updated_at: Date
}

export async function getAllContacts(entityId: string): Promise<Contact[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_contacts WHERE entity_id = $1 ORDER BY last_name ASC, first_name ASC',
    [entityId]
  )
  return rows
}

export async function getContactById(id: string, entityId: string): Promise<Contact | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_contacts WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return rows[0] || null
}

export async function createContact(contact: Partial<Contact>): Promise<Contact> {
  const { entity_id, user_id, first_name, last_name, email, phone, contact_type, status, address_line1, address_line2, city, postcode, country, notes } = contact
  const { rows } = await pool.query(
    `INSERT INTO crm_contacts (entity_id, user_id, first_name, last_name, email, phone, contact_type, status, address_line1, address_line2, city, postcode, country, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [entity_id, user_id, first_name, last_name, email || null, phone || null, contact_type || 'Lead', status || 'Active', address_line1 || null, address_line2 || null, city || null, postcode || null, country || 'United Kingdom', notes || null]
  )
  return rows[0]
}

export async function updateContact(id: string, entityId: string, updates: Partial<Contact>): Promise<Contact | null> {
  const fields = Object.keys(updates).filter(k => !['id', 'entity_id', 'user_id', 'created_at'].includes(k))
  if (fields.length === 0) return getContactById(id, entityId)

  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => (updates as any)[f])

  const { rows } = await pool.query(
    `UPDATE crm_contacts SET ${setClause}, updated_at = NOW() WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteContact(id: string, entityId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_contacts WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
```

- [ ] **Step 2: Update /api/contacts/route.ts — add POST handler**

Replace `apps/25crm/src/app/api/contacts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllContacts, createContact } from '@/lib/services/contacts.service'
import { createTask } from '@/lib/services/tasks.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contacts = await getAllContacts(auth.activeEntityId)
  return NextResponse.json(contacts)
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const contact = await createContact({
    ...body,
    entity_id: auth.activeEntityId,
    user_id: auth.userId,
  })

  await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'Contact', contact.id, `${contact.first_name} ${contact.last_name}`)

  // Auto-create follow-up task for Lead contacts
  if (contact.contact_type === 'Lead') {
    try {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      await createTask({
        entity_id: auth.activeEntityId,
        user_id: auth.userId,
        title: `Follow up with ${contact.first_name} ${contact.last_name}`,
        description: `Auto-created: follow up with new lead ${contact.first_name} ${contact.last_name}`,
        due_date: dueDate,
        priority: 'Medium',
        status: 'To Do',
        related_type: 'Contact',
        related_id: contact.id,
      })
    } catch (err) {
      console.error('Failed to auto-create lead task:', err)
    }
  }

  return NextResponse.json(contact, { status: 201 })
}
```

Note: This references `createTask` from tasks.service.ts which will be created in Task 8. Until then, wrap the auto-task creation in try/catch so it fails gracefully. The tasks.service.ts will be created in Task 8 — come back and verify this works after that task.

- [ ] **Step 3: Create /api/contacts/[id]/route.ts**

Create `apps/25crm/src/app/api/contacts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getContactById, updateContact, deleteContact } from '@/lib/services/contacts.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const contact = await getContactById(id, auth.activeEntityId)
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(contact)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const contact = await updateContact(id, auth.activeEntityId, body)
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await logAuditEvent(auth.activeEntityId, auth.userId, 'Update', 'Contact', id, `${contact.first_name} ${contact.last_name}`, body)

  return NextResponse.json(contact)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const contact = await getContactById(id, auth.activeEntityId)
  const deleted = await deleteContact(id, auth.activeEntityId)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (contact) {
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Delete', 'Contact', id, `${contact.first_name} ${contact.last_name}`)
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Migrate add-contact-dialog.tsx**

Read the current `apps/25crm/src/components/add-contact-dialog.tsx` and rewrite it to:
1. Remove ALL Firebase imports (`useAuth`, `useFirestore`, `useMemoFirebase`, `collection`, `doc`, `setDoc`, `addDoc`, `serverTimestamp`, `logAuditEvent` from firebase)
2. Import `{ apiCreate }` from `@/hooks/use-api`
3. Import `{ useUserProfile }` from `@/hooks/use-user-profile`
4. Replace the Firebase write logic with: `await apiCreate('/api/contacts', formData)`
5. Remove the client-side audit log call (it's now server-side)
6. Remove the client-side auto-task creation for Leads (it's now server-side)
7. Keep all form fields and UI unchanged
8. On success, show toast and close dialog

- [ ] **Step 5: Migrate edit-contact-dialog.tsx**

Read the current file and rewrite it to:
1. Remove ALL Firebase imports
2. Import `{ apiUpdate, apiDelete }` from `@/hooks/use-api`
3. Replace `updateDocumentNonBlocking` with `await apiUpdate('/api/contacts/' + contactId, formData)`
4. Replace `deleteDocumentNonBlocking` with `await apiDelete('/api/contacts/' + contactId)`
5. Keep all form fields and UI unchanged

- [ ] **Step 6: Migrate contacts list page**

Read `apps/25crm/src/app/(app)/contacts/page.tsx` and rewrite it to:
1. Remove ALL Firebase imports
2. Import `{ useApiCollection }` from `@/hooks/use-api`
3. Replace `useCollection` call with: `const { data: contacts, isLoading } = useApiCollection('/api/contacts')`
4. Keep all UI (grid/list views, filters) unchanged

- [ ] **Step 7: Migrate contact detail page**

Read `apps/25crm/src/app/(app)/contacts/[contactId]/page.tsx` and rewrite it to:
1. Remove ALL Firebase imports
2. Use `useApiDoc('/api/contacts/' + contactId)` for the contact
3. Use `useApiCollection('/api/tenancies?contact_id=' + contactId)` for linked tenancies (or fetch from API if filter param exists)
4. For linked maintenance/communications — these will use their own APIs once created. For now, show empty arrays as placeholders with a TODO comment.
5. Keep all UI unchanged

- [ ] **Step 8: Rebuild and verify contacts CRUD**

```bash
cd /opt/relentify-monorepo/apps/25crm
docker compose down && docker compose build --no-cache && docker compose up -d
sleep 5
docker logs 25crm --tail 30
```

Test the contacts API:
```bash
curl -s http://localhost:3025/api/contacts | head -5
```

- [ ] **Step 9: Run MCP tests**

```bash
cd /opt/infra/mcp/25crm-mcp && source venv/bin/activate && python3 run_tests.py
```

Report results. Fix any failures before proceeding.

- [ ] **Step 10: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/25crm/src/lib/services/contacts.service.ts apps/25crm/src/app/api/contacts/ apps/25crm/src/components/add-contact-dialog.tsx apps/25crm/src/components/edit-contact-dialog.tsx apps/25crm/src/app/\(app\)/contacts/
git commit -m "[25crm] Migrate contacts: full CRUD API + SWR client"
```

---

## Task 5: Properties — Extend CRUD + Component Migration

**Files:**
- Modify: `apps/25crm/src/lib/services/property.service.ts` (already has full CRUD)
- Modify: `apps/25crm/src/app/api/properties/route.ts` (add POST)
- Modify: `apps/25crm/src/app/api/properties/[id]/route.ts` (add audit logging)
- Modify: `apps/25crm/src/components/add-property-dialog.tsx`
- Modify: `apps/25crm/src/components/edit-property-dialog.tsx`
- Modify: `apps/25crm/src/app/(app)/properties/page.tsx`
- Modify: `apps/25crm/src/app/(app)/properties/[propertyId]/page.tsx`

- [ ] **Step 1: Add POST to /api/properties/route.ts**

Read current file, add a POST handler that calls `createProperty()` from property.service.ts + `logAuditEvent()`. Pattern matches Task 4 Step 2.

- [ ] **Step 2: Add audit logging to /api/properties/[id]/route.ts**

Read current file, add `logAuditEvent()` calls to PATCH and DELETE handlers.

- [ ] **Step 3: Migrate add-property-dialog.tsx**

Remove Firebase imports. Replace Firestore writes with `apiCreate('/api/properties', formData)`. For image upload — use a file input that POSTs to `/api/uploads` (to be created in Task 10). For now, accept `image_url` as a text URL field. Remove Firebase Storage usage.

- [ ] **Step 4: Migrate edit-property-dialog.tsx**

Remove Firebase imports. Use `apiUpdate`/`apiDelete`.

- [ ] **Step 5: Migrate properties list page**

Replace Firebase with `useApiCollection('/api/properties')`.

- [ ] **Step 6: Migrate property detail page**

Replace Firebase with `useApiDoc('/api/properties/' + propertyId)`. Linked tenancies/maintenance will use their APIs.

- [ ] **Step 7: Rebuild, verify, run MCP tests, commit**

Same pattern as Task 4 Steps 8-10. Commit message: `[25crm] Migrate properties: extend CRUD API + SWR client`

---

## Task 6: Tenancies — Full CRUD + Component Migration

**Files:**
- Create: `apps/25crm/src/lib/services/tenancies.service.ts`
- Modify: `apps/25crm/src/app/api/tenancies/route.ts`
- Create: `apps/25crm/src/app/api/tenancies/[id]/route.ts`
- Modify: `apps/25crm/src/components/add-tenancy-dialog.tsx`
- Modify: `apps/25crm/src/components/edit-tenancy-dialog.tsx`
- Modify: `apps/25crm/src/app/(app)/tenancies/page.tsx`
- Modify: `apps/25crm/src/app/(app)/tenancies/[tenancyId]/page.tsx`

- [ ] **Step 1: Create tenancies.service.ts**

Full CRUD following contacts.service.ts pattern. `createTenancy` must also insert into `crm_tenancy_tenants` join table if `tenant_ids` is provided. `updateTenancy` must update the join table. `deleteTenancy` cascades via FK.

Key fields: `entity_id, user_id, property_id, tenant_ids[], rent_amount, deposit_amount, start_date, end_date, status, pipeline_status`

The `getAllTenancies` query already exists in crm.service.ts — move it here with the JOIN for property_address and tenant arrays.

- [ ] **Step 2: Add POST to /api/tenancies/route.ts + create [id]/route.ts**

Same pattern as contacts. POST creates tenancy + tenant links. PATCH updates. DELETE removes.

- [ ] **Step 3: Migrate tenancy components and pages**

Replace Firebase with SWR + API calls. The Kanban view uses `pipeline_status` — keep the field mapping unchanged.

- [ ] **Step 4: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate tenancies: full CRUD API + SWR client`

---

## Task 7: Maintenance Requests — Full CRUD + Component Migration

**Files:**
- Create: `apps/25crm/src/lib/services/maintenance.service.ts`
- Modify: `apps/25crm/src/app/api/maintenance/route.ts`
- Create: `apps/25crm/src/app/api/maintenance/[id]/route.ts`
- Modify: `apps/25crm/src/components/add-maintenance-request-dialog.tsx`
- Modify: `apps/25crm/src/components/edit-maintenance-dialog.tsx`
- Modify: `apps/25crm/src/app/(app)/maintenance/page.tsx`
- Modify: `apps/25crm/src/app/(app)/maintenance/[maintenanceId]/page.tsx`

- [ ] **Step 1: Create maintenance.service.ts with full CRUD**

Key fields: `entity_id, user_id, property_id, title, description, priority, status, reported_by_id, assigned_to_id, reported_date, due_date, estimated_cost, actual_cost`. The `getAllMaintenanceRequests` query already exists in crm.service.ts — move and extend.

- [ ] **Step 2: Add POST to /api/maintenance/route.ts + create [id]/route.ts**

- [ ] **Step 3: Migrate maintenance components and pages**

- [ ] **Step 4: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate maintenance: full CRUD API + SWR client`

---

## Task 8: Tasks — Full CRUD + Component Migration

**Files:**
- Create: `apps/25crm/src/lib/services/tasks.service.ts`
- Modify: `apps/25crm/src/app/api/tasks/route.ts`
- Create: `apps/25crm/src/app/api/tasks/[id]/route.ts`
- Modify: `apps/25crm/src/components/add-task-dialog.tsx`
- Modify: `apps/25crm/src/components/edit-task-dialog.tsx`
- Modify: `apps/25crm/src/app/(app)/tasks/page.tsx`

- [ ] **Step 1: Create tasks.service.ts with full CRUD**

Key fields: `entity_id, user_id, title, description, due_date, priority, status, related_type, related_id`.

Export `createTask` — this is referenced by contacts route.ts (Task 4) for auto-creating Lead follow-up tasks.

- [ ] **Step 2: Add POST to /api/tasks/route.ts + create [id]/route.ts**

- [ ] **Step 3: Migrate task components and pages**

- [ ] **Step 4: Verify the Lead auto-task from Task 4 now works end-to-end**

Create a Lead contact via the API and verify a task is auto-created:
```bash
# After creating a Lead contact, check tasks
curl -s http://localhost:3025/api/tasks | python3 -m json.tool | head -20
```

- [ ] **Step 5: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate tasks: full CRUD API + SWR client`

---

## Task 9: Communications — New Table + Full CRUD + Component Migration

**Files:**
- Create: `apps/25crm/src/lib/services/communications.service.ts`
- Create: `apps/25crm/src/app/api/communications/route.ts`
- Create: `apps/25crm/src/app/api/communications/[id]/route.ts`
- Modify: `apps/25crm/src/components/log-communication-dialog.tsx`
- Modify: `apps/25crm/src/app/(app)/communications/page.tsx`

- [ ] **Step 1: Create communications.service.ts**

Key fields: `entity_id, contact_id, user_id, type, direction, subject, body, status, related_property_id, related_tenancy_id, sent_at`.

- [ ] **Step 2: Create API routes**

- [ ] **Step 3: Migrate communication components and pages**

The communications page has Email/Calls/WhatsApp tabs. The `type` field in the API filters by tab. Replace all Firestore queries with `useApiCollection('/api/communications?type=Email')` etc.

- [ ] **Step 4: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate communications: new table + full CRUD API + SWR client`

---

## Task 10: Documents + File Upload — New Table + Storage + Component Migration

**Files:**
- Create: `apps/25crm/src/lib/services/documents.service.ts`
- Create: `apps/25crm/src/app/api/documents/route.ts`
- Create: `apps/25crm/src/app/api/documents/[id]/route.ts`
- Create: `apps/25crm/src/app/api/uploads/route.ts`
- Create: `apps/25crm/src/app/api/uploads/[...path]/route.ts`
- Modify: `apps/25crm/docker-compose.yml`
- Modify: `apps/25crm/src/components/add-document-dialog.tsx`
- Modify: `apps/25crm/src/components/edit-document-dialog.tsx`
- Modify: `apps/25crm/src/app/(app)/documents/page.tsx`

- [ ] **Step 1: Add uploads volume to docker-compose.yml**

Add to the `web` service in `apps/25crm/docker-compose.yml`:

```yaml
    volumes:
      - /opt/25crm-uploads:/app/uploads
```

Create the host directory:
```bash
mkdir -p /opt/25crm-uploads
```

- [ ] **Step 2: Create upload API route**

Create `apps/25crm/src/app/api/uploads/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = '/app/uploads'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'bin'
  const fileName = `${randomUUID()}.${ext}`
  const entityDir = join(UPLOAD_DIR, auth.activeEntityId)

  await mkdir(entityDir, { recursive: true })
  const filePath = join(entityDir, fileName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return NextResponse.json({
    path: `${auth.activeEntityId}/${fileName}`,
    name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  })
}
```

- [ ] **Step 3: Create file serving route**

Create `apps/25crm/src/app/api/uploads/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { lookup } from 'mime-types'

const UPLOAD_DIR = '/app/uploads'

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path: pathSegments } = await params
  const filePath = join(UPLOAD_DIR, ...pathSegments)

  // Security: ensure path starts with user's entity directory
  if (!filePath.startsWith(join(UPLOAD_DIR, auth.activeEntityId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await stat(filePath)
    const buffer = await readFile(filePath)
    const mimeType = lookup(filePath) || 'application/octet-stream'
    return new NextResponse(buffer, {
      headers: { 'Content-Type': mimeType },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

Note: `mime-types` package needed. Add it:
```bash
cd /opt/relentify-monorepo && pnpm add mime-types --filter 25crm && pnpm add -D @types/mime-types --filter 25crm && pnpm install
```

- [ ] **Step 4: Create documents.service.ts and API routes**

Standard CRUD pattern. `createDocument` stores the `file_path` returned from the upload endpoint.

- [ ] **Step 5: Migrate document components and pages**

Replace Firebase Storage uploads with: POST file to `/api/uploads`, then POST document metadata to `/api/documents` with the returned `file_path`.

- [ ] **Step 6: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate documents: file upload + new table + full CRUD API + SWR client`

---

## Task 11: Transactions — New Table + Full CRUD + Component Migration

**Files:**
- Create: `apps/25crm/src/lib/services/transactions.service.ts`
- Create: `apps/25crm/src/app/api/transactions/route.ts`
- Create: `apps/25crm/src/app/api/transactions/[id]/route.ts`
- Modify: `apps/25crm/src/components/add-transaction-dialog.tsx`
- Modify: `apps/25crm/src/components/edit-transaction-dialog.tsx`
- Modify: `apps/25crm/src/app/(app)/transactions/page.tsx`

- [ ] **Step 1: Create transactions.service.ts**

Key fields: `entity_id, tenancy_id, contact_id, related_property_id, type, amount, currency, status, reconciled, description, payer_contact_id, payee_contact_id, transaction_date`.

Include a `toggleReconciled(id, entityId)` function for the reconciliation toggle.

- [ ] **Step 2: Create API routes**

The PATCH route should support `{ reconciled: true/false }` for the toggle.

- [ ] **Step 3: Migrate transaction components and pages**

The reconciliation toggle calls `apiUpdate('/api/transactions/' + id, { reconciled: !current })`.

- [ ] **Step 4: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate transactions: new table + full CRUD API + SWR client`

---

## Task 12: Bank Accounts + Workflow Rules — New Tables + CRUD + Settings Migration

**Files:**
- Create: `apps/25crm/src/lib/services/bank-accounts.service.ts`
- Create: `apps/25crm/src/lib/services/workflow-rules.service.ts`
- Create: `apps/25crm/src/app/api/bank-accounts/route.ts`
- Create: `apps/25crm/src/app/api/bank-accounts/[id]/route.ts`
- Create: `apps/25crm/src/app/api/workflow-rules/route.ts`
- Create: `apps/25crm/src/app/api/workflow-rules/[id]/route.ts`
- Modify: `apps/25crm/src/components/add-bank-account-dialog.tsx`
- Modify: `apps/25crm/src/components/add-workflow-rule-dialog.tsx`
- Modify: `apps/25crm/src/components/settings/bank-account-settings.tsx`
- Modify: `apps/25crm/src/components/settings/workflow-settings.tsx`

- [ ] **Step 1: Create service files and API routes for both entities**

Standard CRUD pattern for each.

- [ ] **Step 2: Migrate settings components**

Replace Firebase with SWR + API calls.

- [ ] **Step 3: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate bank accounts + workflow rules: new tables + CRUD + settings`

---

## Task 13: Audit Logs + Notifications + User Profiles

**Files:**
- Create: `apps/25crm/src/lib/services/audit-logs.service.ts`
- Create: `apps/25crm/src/lib/services/notifications.service.ts`
- Create: `apps/25crm/src/lib/services/user-profiles.service.ts`
- Create: `apps/25crm/src/app/api/audit-logs/route.ts`
- Modify: `apps/25crm/src/app/api/notifications/route.ts`
- Create: `apps/25crm/src/app/api/notifications/[id]/route.ts`
- Create: `apps/25crm/src/app/api/user-profiles/route.ts`
- Create: `apps/25crm/src/app/api/user-profiles/[id]/route.ts`
- Modify: `apps/25crm/src/app/(app)/audit-log/page.tsx`
- Modify: `apps/25crm/src/components/notification-bell.tsx`
- Modify: `apps/25crm/src/components/settings/user-management.tsx`
- Modify: `apps/25crm/src/components/organization-settings-form.tsx`
- Modify: `apps/25crm/src/components/profile-settings-form.tsx`
- Modify: `apps/25crm/src/components/password-settings-form.tsx`

- [ ] **Step 1: Create audit-logs.service.ts (read-only)**

```typescript
import pool from '../pool'

export async function getAuditLogs(entityId: string, limit = 100): Promise<any[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_audit_logs WHERE entity_id = $1 ORDER BY created_at DESC LIMIT $2',
    [entityId, limit]
  )
  return rows
}
```

- [ ] **Step 2: Create /api/audit-logs/route.ts (GET only)**

- [ ] **Step 3: Create notifications.service.ts with markAsRead**

```typescript
import pool from '../pool'

export async function getNotifications(userId: string, entityId: string): Promise<any[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_notifications WHERE user_id = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 50',
    [userId, entityId]
  )
  return rows
}

export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'UPDATE crm_notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [id, userId]
  )
  return (rowCount ?? 0) > 0
}
```

- [ ] **Step 4: Update /api/notifications/route.ts + create [id]/route.ts**

- [ ] **Step 5: Create user-profiles.service.ts and API routes**

CRUD for user profiles. Only Admins can update roles.

- [ ] **Step 6: Migrate audit log page**

Replace Firebase with `useApiCollection('/api/audit-logs')`.

- [ ] **Step 7: Migrate notification-bell.tsx**

Replace Firebase with `useApiCollection('/api/notifications')`. Mark-as-read calls `apiUpdate('/api/notifications/' + id, { is_read: true })`.

- [ ] **Step 8: Migrate user-management.tsx**

Replace Firebase with `useApiCollection('/api/user-profiles')` and `apiUpdate` for role changes.

- [ ] **Step 9: Migrate settings forms**

- `organization-settings-form.tsx`: Remove Firebase. For logo upload, use `/api/uploads`. Store org settings via a new `/api/organization-settings` endpoint or inline in the user-profiles logic.
- `profile-settings-form.tsx`: Remove Firebase. Use `apiUpdate` to update the user's profile.
- `password-settings-form.tsx`: Remove Firebase Auth. Password changes go through `@relentify/auth` (the auth app at auth.relentify.com handles password changes). Replace with a link to auth.relentify.com/change-password, or implement a local `/api/change-password` route.

- [ ] **Step 10: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate audit logs, notifications, user profiles, settings forms`

---

## Task 14: Reports — Rewire Client to SWR

**Files:**
- Create: `apps/25crm/src/app/api/reports/profit-loss/route.ts`
- Create: `apps/25crm/src/app/api/reports/vacancy/route.ts`
- Create: `apps/25crm/src/app/api/reports/arrears/route.ts`
- Create: `apps/25crm/src/app/api/reports/maintenance/route.ts`
- Create: `apps/25crm/src/app/api/reports/landlord-statement/route.ts`
- Modify: `apps/25crm/src/components/reports/profit-loss-report.tsx`
- Modify: `apps/25crm/src/components/reports/vacancy-report.tsx`
- Modify: `apps/25crm/src/components/reports/arrears-report.tsx`
- Modify: `apps/25crm/src/components/reports/maintenance-report.tsx`
- Modify: `apps/25crm/src/components/reports/landlord-statement-report.tsx`
- Modify: `apps/25crm/src/app/(app)/reports/page.tsx`

- [ ] **Step 1: Create report API routes**

Each report endpoint queries PostgreSQL and returns aggregated data. Examples:

- **P&L**: Query `crm_transactions` grouped by type, filtered by date range
- **Vacancy**: Query `crm_properties` where status = 'Available'
- **Arrears**: Query `crm_tenancies` where status = 'Arrears'
- **Maintenance**: Query `crm_maintenance_requests` grouped by status/priority
- **Landlord Statement**: Query transactions and properties filtered by landlord contact_id

- [ ] **Step 2: Migrate report components to use SWR**

Replace Firebase queries with `useApiCollection('/api/reports/profit-loss?from=...&to=...')` etc.

- [ ] **Step 3: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate reports: PostgreSQL-backed API routes + SWR client`

---

## Task 15: Dashboard + Global Search + Remaining Components

**Files:**
- Modify: `apps/25crm/src/app/(app)/dashboard/page.tsx`
- Modify: `apps/25crm/src/components/recent-activity.tsx`
- Modify: `apps/25crm/src/components/global-search-dialog.tsx`
- Modify: `apps/25crm/src/components/link-entity-dialog.tsx`

- [ ] **Step 1: Migrate dashboard page**

The dashboard already uses `/api/reports/dashboard-stats` and `/api/reports/recent-activity`. Just replace any remaining Firebase imports with SWR.

- [ ] **Step 2: Migrate recent-activity.tsx**

Replace Firebase with `useApiCollection('/api/reports/recent-activity')`.

- [ ] **Step 3: Migrate global-search-dialog.tsx**

Create a `/api/search?q=term` endpoint that searches contacts, properties, tenancies by name/address. Replace Firebase queries with SWR.

- [ ] **Step 4: Migrate link-entity-dialog.tsx**

Replace Firebase queries with SWR fetches to the relevant API endpoints.

- [ ] **Step 5: Rebuild, verify, run MCP tests, commit**

Commit: `[25crm] Migrate dashboard, search, and remaining components`

---

## Task 16: Portal Auth Migration

**Files:**
- Create: `apps/25crm/src/lib/services/portal-auth.service.ts`
- Create: `apps/25crm/src/app/api/portal/auth/login/route.ts`
- Create: `apps/25crm/src/app/api/portal/auth/signup/route.ts`
- Create: `apps/25crm/src/app/api/portal/auth/me/route.ts`
- Modify: `apps/25crm/src/middleware.ts`
- Modify: `apps/25crm/src/app/portal/login/page.tsx`
- Modify: `apps/25crm/src/app/portal/signup/page.tsx`
- Modify: `apps/25crm/src/app/portal/layout.tsx`
- Modify: `apps/25crm/src/app/portal/dashboard/page.tsx`
- Modify: `apps/25crm/src/app/portal/maintenance/page.tsx`
- Modify: `apps/25crm/src/app/portal/documents/page.tsx`
- Modify: `apps/25crm/src/app/portal/financials/page.tsx`
- Modify: `apps/25crm/src/hooks/use-portal-user-profile.ts`

- [ ] **Step 1: Create portal-auth.service.ts**

```typescript
import pool from '../pool'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret')
const PORTAL_COOKIE = 'crm_portal_token'

export { PORTAL_COOKIE }

export interface PortalUser {
  id: string
  entity_id: string
  contact_id: string | null
  email: string
  full_name: string
  role: 'Tenant' | 'Landlord'
  is_active: boolean
}

export async function loginPortalUser(email: string, password: string): Promise<{ user: PortalUser; token: string } | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_portal_users WHERE email = $1 AND is_active = true',
    [email]
  )
  const user = rows[0]
  if (!user) return null

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return null

  const token = await new SignJWT({
    portalUserId: user.id,
    entityId: user.entity_id,
    contactId: user.contact_id,
    role: user.role,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  // Update last login
  await pool.query('UPDATE crm_portal_users SET last_login_at = NOW() WHERE id = $1', [user.id])

  return {
    user: { id: user.id, entity_id: user.entity_id, contact_id: user.contact_id, email: user.email, full_name: user.full_name, role: user.role, is_active: user.is_active },
    token,
  }
}

export async function signupPortalUser(data: {
  email: string
  password: string
  fullName: string
  role: 'Tenant' | 'Landlord'
  entityId: string
}): Promise<{ user: PortalUser; token: string }> {
  const passwordHash = await bcrypt.hash(data.password, 12)

  // Create contact
  const { rows: contactRows } = await pool.query(
    `INSERT INTO crm_contacts (entity_id, first_name, last_name, email, contact_type, status)
     VALUES ($1, $2, $3, $4, $5, 'Active') RETURNING id`,
    [data.entityId, data.fullName.split(' ')[0], data.fullName.split(' ').slice(1).join(' ') || '', data.email, data.role]
  )
  const contactId = contactRows[0].id

  // Create portal user
  const { rows } = await pool.query(
    `INSERT INTO crm_portal_users (entity_id, contact_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.entityId, contactId, data.email, passwordHash, data.fullName, data.role]
  )
  const user = rows[0]

  const token = await new SignJWT({
    portalUserId: user.id,
    entityId: user.entity_id,
    contactId: user.contact_id,
    role: user.role,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  return {
    user: { id: user.id, entity_id: user.entity_id, contact_id: user.contact_id, email: user.email, full_name: user.full_name, role: user.role, is_active: user.is_active },
    token,
  }
}

export async function verifyPortalToken(token: string): Promise<any | null> {
  try {
    const { jwtVerify } = await import('jose')
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload
  } catch {
    return null
  }
}

export async function getPortalUser(portalUserId: string): Promise<PortalUser | null> {
  const { rows } = await pool.query(
    'SELECT id, entity_id, contact_id, email, full_name, role, is_active FROM crm_portal_users WHERE id = $1 AND is_active = true',
    [portalUserId]
  )
  return rows[0] || null
}
```

- [ ] **Step 2: Create portal auth API routes**

Create `apps/25crm/src/app/api/portal/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { loginPortalUser, PORTAL_COOKIE } from '@/lib/services/portal-auth.service'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  const result = await loginPortalUser(email, password)
  if (!result) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  const response = NextResponse.json(result.user)
  response.cookies.set(PORTAL_COOKIE, result.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })
  return response
}
```

Create `apps/25crm/src/app/api/portal/auth/signup/route.ts` — similar pattern using `signupPortalUser`.

Create `apps/25crm/src/app/api/portal/auth/me/route.ts` — reads `PORTAL_COOKIE`, verifies JWT, returns portal user profile.

- [ ] **Step 3: Update middleware.ts for portal auth**

Update `apps/25crm/src/middleware.ts` to check the portal cookie for `/portal/*` routes (excluding `/portal/login` and `/portal/signup`):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, getRedirectUrl, AUTH_COOKIE_NAME } from '@relentify/auth'

const PORTAL_COOKIE = 'crm_portal_token'
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow static, API, and public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Portal routes — separate auth
  if (pathname.startsWith('/portal')) {
    if (pathname === '/portal/login' || pathname === '/portal/signup') {
      return NextResponse.next()
    }
    const portalToken = req.cookies.get(PORTAL_COOKIE)?.value
    if (!portalToken) {
      return NextResponse.redirect(new URL('/portal/login', req.url))
    }
    // Token verification happens in the page/layout, not middleware (jose not available in edge)
    return NextResponse.next()
  }

  // Staff routes — existing auth
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  const publicUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || 'crm.relentify.com'}${req.nextUrl.pathname}${req.nextUrl.search}`

  if (!token) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  const payload = await verifyAuthToken(token, JWT_SECRET)
  if (!payload) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Migrate portal login/signup pages**

Replace Firebase `signInWithEmailAndPassword` with a POST to `/api/portal/auth/login`. Replace `createUserWithEmailAndPassword` with a POST to `/api/portal/auth/signup`. On success, redirect to `/portal/dashboard`.

- [ ] **Step 5: Rewrite use-portal-user-profile.ts**

Replace `apps/25crm/src/hooks/use-portal-user-profile.ts`:

```typescript
'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null)

export function usePortalUserProfile() {
  const { data, isLoading, error } = useSWR('/api/portal/auth/me', fetcher)

  return {
    portalUserProfile: data || null,
    isLoading,
    error,
  }
}
```

- [ ] **Step 6: Migrate portal layout and pages**

Replace Firebase with `usePortalUserProfile()` and `useApiCollection` for portal data:
- Dashboard: fetch tenancies, properties, transactions filtered by portal user's contact_id
- Maintenance: `useApiCollection('/api/maintenance?reporter_id=' + contactId)`
- Documents: `useApiCollection('/api/documents?contact_id=' + contactId)`
- Financials: `useApiCollection('/api/transactions?contact_id=' + contactId)`

Note: API routes need to support these query params for portal filtering. Add the filter support when creating the routes.

- [ ] **Step 7: Rebuild, verify portal auth flow, run MCP tests, commit**

Test login:
```bash
# Create a test portal user first (via psql), then test login
curl -X POST http://localhost:3025/api/portal/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"test123"}'
```

Commit: `[25crm] Migrate portal auth: bcrypt + JWT + dedicated crm_portal_users table`

---

## Task 17: Firebase Removal + Final Cleanup

**Files:**
- Delete: `apps/25crm/src/firebase/` (entire directory — 11 files)
- Delete: `apps/25crm/src/components/FirebaseErrorListener.tsx`
- Delete: `apps/25crm/firestore.rules`
- Delete: `apps/25crm/storage.rules`
- Delete: `apps/25crm/apphosting.yaml`
- Delete: `apps/25crm/src/app/api/listings/route.ts` (Firebase holdover)
- Modify: `apps/25crm/package.json`
- Modify: `apps/25crm/src/app/layout.tsx`
- Modify: `apps/25crm/next.config.ts`

- [ ] **Step 1: Remove firebase packages**

```bash
cd /opt/relentify-monorepo
pnpm remove firebase firebase-admin --filter 25crm
pnpm install
```

- [ ] **Step 2: Delete Firebase files**

```bash
rm -rf /opt/relentify-monorepo/apps/25crm/src/firebase/
rm -f /opt/relentify-monorepo/apps/25crm/src/components/FirebaseErrorListener.tsx
rm -f /opt/relentify-monorepo/apps/25crm/firestore.rules
rm -f /opt/relentify-monorepo/apps/25crm/storage.rules
rm -f /opt/relentify-monorepo/apps/25crm/apphosting.yaml
rm -f /opt/relentify-monorepo/apps/25crm/src/app/api/listings/route.ts
```

- [ ] **Step 3: Remove FirebaseClientProvider from layout.tsx**

Edit `apps/25crm/src/app/layout.tsx` — remove the import and the `<FirebaseClientProvider>` wrapper:

```typescript
import type {Metadata} from 'next';
import { Inter } from 'next/font/google'
import './globals.css';
import { Toaster, ThemeProvider, THEME_SCRIPT } from '@relentify/ui';
import { SharedAuthProvider } from '@/hooks/use-shared-auth';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'Relentify CRM',
  description: 'A modular, multi-tenant SaaS platform for lettings agencies.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        <ThemeProvider>
          <SharedAuthProvider>
            {children}
            <Toaster />
          </SharedAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Remove firebasestorage.googleapis.com from next.config.ts**

Edit `apps/25crm/next.config.ts` — remove the Firebase Storage remote pattern:

```typescript
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Verify NO Firebase imports remain**

```bash
cd /opt/relentify-monorepo/apps/25crm
grep -r "firebase" src/ --include="*.ts" --include="*.tsx" -l
grep -r "@/firebase" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: no results. If any files still import Firebase, fix them.

- [ ] **Step 6: Full rebuild and verify**

```bash
cd /opt/relentify-monorepo/apps/25crm
docker compose down && docker compose build --no-cache && docker compose up -d
sleep 10
docker logs 25crm --tail 50
curl -s http://localhost:3025/api/health
```

Check for any build errors or runtime crashes.

- [ ] **Step 7: Run pnpm audit**

```bash
cd /opt/relentify-monorepo
pnpm audit
```

The 4 HIGH CVEs from `node-forge` (via `firebase-admin`) should be gone.

- [ ] **Step 8: Run MCP tests**

```bash
cd /opt/infra/mcp/25crm-mcp && source venv/bin/activate && python3 run_tests.py
```

All tests should pass.

- [ ] **Step 9: Clean up docker build cache**

```bash
docker builder prune -f
```

- [ ] **Step 10: Commit**

```bash
cd /opt/relentify-monorepo
git add -A apps/25crm/
git commit -m "[25crm] Remove Firebase: zero Firebase dependencies, 100% PostgreSQL"
```

---

## Task 18: Update CLAUDE.md + MCP Test Extension

**Files:**
- Modify: `apps/25crm/CLAUDE.md`
- Modify: `/opt/infra/mcp/25crm-mcp/` (test files)
- Modify: `/root/.claude/CLAUDE.md`

- [ ] **Step 1: Update 25crm CLAUDE.md**

Remove the "MANDATORY: Remove Firebase" section (it's done). Update the API routes table with all new endpoints. Update the status section to reflect the completed migration.

- [ ] **Step 2: Extend MCP test suite**

Add tests for the new API endpoints:
- CRUD tests for communications, documents, transactions, bank accounts, workflow rules
- Portal auth login/signup tests
- Audit log read test
- File upload test

Run the extended suite:
```bash
cd /opt/infra/mcp/25crm-mcp && source venv/bin/activate && python3 run_tests.py
```

- [ ] **Step 3: Update global CLAUDE.md**

Update the 25crm MCP test count in `/root/.claude/CLAUDE.md`.

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/25crm/CLAUDE.md
cd /root/.claude
git add CLAUDE.md
git commit -m "[25crm] Update docs: Firebase migration complete, MCP tests extended"
```

---

## Summary

| Task | Entity/Feature | New API Routes | Components Migrated |
|------|---------------|----------------|---------------------|
| 0 | DB connection fix | 0 | 0 |
| 1 | Entity scoping + auth | 0 | 0 |
| 2 | New tables (8) | 0 | 0 |
| 3 | SWR + audit + hooks | 0 | 2 hooks |
| 4 | Contacts | 2 (list+create, get+update+delete) | 4 (add, edit, list, detail) |
| 5 | Properties | 1 (add POST) | 4 |
| 6 | Tenancies | 2 | 4 |
| 7 | Maintenance | 2 | 4 |
| 8 | Tasks | 2 | 3 |
| 9 | Communications | 2 | 2 |
| 10 | Documents + uploads | 4 | 3 |
| 11 | Transactions | 2 | 3 |
| 12 | Bank accounts + workflows | 4 | 4 |
| 13 | Audit + notifications + profiles | 5 | 6 |
| 14 | Reports | 5 | 6 |
| 15 | Dashboard + search + misc | 1 | 4 |
| 16 | Portal auth | 3 | 8 |
| 17 | Firebase removal | 0 | 1 (layout) |
| 18 | Docs + MCP tests | 0 | 0 |
| **Total** | | **~35 route files** | **~52 component/page files** |
