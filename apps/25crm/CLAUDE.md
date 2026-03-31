# ⚠️ MANDATORY: Remove Firebase — Use PostgreSQL Only

**25crm must have zero Firebase dependencies. This is a hard requirement, not optional.**

Firebase was used in the original reference app but must NOT exist in this rebuild. Every piece of Firebase must be replaced with PostgreSQL + the shared `@relentify/database` / `@relentify/auth` packages.

## What needs removing

- `firebase` and `firebase-admin` packages from `package.json`
- All files under `src/firebase/` — delete the entire directory
- All Firebase imports in components, hooks, pages, and API routes
- `src/components/FirebaseErrorListener.tsx`
- `firestore.rules`, `storage.rules`, `apphosting.yaml` — delete these
- The `firebase` key in env files

## What replaces it

| Firebase feature | Replacement |
|---|---|
| Auth (login, sessions, JWT) | `@relentify/auth` (JWT-based, already used by other apps) |
| Firestore real-time listeners (`use-doc`, `use-collection`) | PostgreSQL via `@relentify/database` — polling or server-sent events if real-time needed |
| Portal auth (tenant/landlord login) | `@relentify/auth` — same JWT pattern |
| Firebase audit logging | PostgreSQL audit table (already exists in other apps) |
| Firebase error reporting | Standard Next.js error boundaries |

## Auth pattern to use

See `21auth` and `22accounting` for the correct PostgreSQL + JWT auth pattern. Do not invent a new one.

## Status

As of 2026-03-29: Firebase still present. Migration plan below is the authorised approach — execute in one dedicated session.

---

## Migration Plan: Firebase → PostgreSQL

### Context

- The vulnerability audit flagged 4 HIGH CVEs in `node-forge@1.3.3`, pulled in by `firebase-admin`. The correct fix is not a pnpm override — it is full Firebase removal.
- PostgreSQL tables (`crm_contacts`, `crm_properties`, `crm_tenancies`, `crm_tenancy_tenants`, `crm_maintenance_requests`, `crm_tasks`, `crm_notifications`) already exist.
- API routes under `/api/` already read from PostgreSQL via `crm.service.ts`.
- `@relentify/auth` JWT auth is already wired for staff (server-side).
- The only thing still using Firebase is: real-time client subscriptions (`useDoc`/`useCollection`), portal auth (email+password login/signup), and audit logging.

### Step 1 — Remove packages and config files

```bash
pnpm remove firebase firebase-admin --filter 25crm
```

Delete these files:
- `src/firebase/` (entire directory — 11 files)
- `src/components/FirebaseErrorListener.tsx`
- `firestore.rules`
- `storage.rules`
- `apphosting.yaml`

### Step 2 — Replace real-time subscriptions with polling

Every page that uses `useDoc()` or `useCollection()` must switch to standard `fetch` + `useEffect` or SWR. The existing API routes already serve the data. Pattern:

```tsx
// Before (Firebase)
const { data } = useCollection<Contact>(`organizations/${orgId}/contacts`)

// After (API polling — 30s interval is fine for CRM data)
const [contacts, setContacts] = useState([])
useEffect(() => {
  const load = () => fetch('/api/contacts').then(r => r.json()).then(setContacts)
  load()
  const id = setInterval(load, 30_000)
  return () => clearInterval(id)
}, [])
```

If true real-time push is needed for a specific view later, use Server-Sent Events (SSE) from a `/api/stream/[resource]` route — but do not add this now unless a page requires it. Polling is sufficient for MVP.

### Step 3 — Replace portal auth (tenant/landlord login)

The portal currently uses Firebase `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`.

Replace with a dedicated portal auth flow backed by PostgreSQL:

1. Add a `portal_users` table (or reuse `crm_contacts` with a `portal_password_hash` + `portal_role` column — check which fits better at the time).
2. Create API routes:
   - `POST /api/portal/login` — bcrypt verify, return JWT via `@relentify/auth`
   - `POST /api/portal/signup` — create portal user record, link to `contactId`, return JWT
3. Replace `src/portal/login` and `src/portal/signup` pages to POST to those routes.
4. Portal middleware: validate JWT cookie using `@relentify/auth` (same pattern as staff auth in `src/lib/auth.ts`).

See `21auth` for the canonical login/signup page pattern.

### Step 4 — Replace audit logging

`src/firebase/audit.ts` writes to Firestore. Replace with a direct PostgreSQL insert.

Add a `crm_audit_logs` table if it does not already exist:
```sql
CREATE TABLE crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,          -- 'Created' | 'Updated' | 'Deleted'
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Replace `logAuditEvent()` calls with a direct `pool.query(INSERT ...)` call. Keep the fire-and-forget pattern (no await, catch silently).

### Step 5 — Remove FirebaseClientProvider from layout

In `src/app/layout.tsx` (or wherever `<FirebaseClientProvider>` wraps the tree), remove it and the import. The `<SharedAuthProvider>` and `<ThemeProvider>` stay.

### Step 6 — Run pnpm install and verify

```bash
cd /opt/relentify-monorepo
pnpm install
pnpm audit   # must return: No known vulnerabilities found
```

Then rebuild and redeploy:
```bash
cd /opt/25crm
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs 25crm --tail 50
```

### Files to touch (summary)

| Action | Target |
|--------|--------|
| Delete | `src/firebase/` (all 11 files) |
| Delete | `src/components/FirebaseErrorListener.tsx` |
| Delete | `firestore.rules`, `storage.rules`, `apphosting.yaml` |
| Edit | `package.json` — remove `firebase`, `firebase-admin` |
| Edit | `src/app/layout.tsx` — remove `FirebaseClientProvider` |
| Edit | 30+ pages/components — replace `useDoc`/`useCollection` with fetch |
| Create | `src/lib/audit.ts` — PostgreSQL-backed audit logger |
| Create | `src/app/api/portal/login/route.ts` + `signup/route.ts` |
| Edit | `src/app/portal/login/page.tsx` + `signup/page.tsx` — use new API |
| Edit | Portal middleware — switch to `@relentify/auth` JWT |

---

---

# Current PostgreSQL Implementation

## API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health check |
| GET | `/api/me` | Yes | Current user info |
| GET/POST | `/api/contacts` | Yes | List / create contacts |
| GET/POST | `/api/properties` | Yes | List / create properties |
| GET/PATCH | `/api/properties/[id]` | Yes | Get / update property |
| GET/POST | `/api/tenancies` | Yes | List / create tenancies |
| GET/PATCH/DELETE | `/api/tenancies/[id]` | Yes | Get / update / delete tenancy |
| GET/POST | `/api/tasks` | Yes | List / create tasks |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Yes | Get / update / delete task |
| GET/POST | `/api/maintenance` | Yes | List / create maintenance requests |
| GET/PATCH/DELETE | `/api/maintenance/[id]` | Yes | Get / update / delete maintenance request |
| GET/POST | `/api/listings` | Yes | List / create listings |
| GET | `/api/notifications` | Yes | List notifications |
| GET | `/api/reports/dashboard-stats` | Yes | Dashboard KPI stats |
| GET | `/api/reports/recent-activity` | Yes | Recent activity feed |

**Total**: 13 route files

## UI Pages

### Staff App (auth required)
| Path | Purpose |
|------|---------|
| `/` | Landing / redirect |
| `/(auth)/login` | Staff login |
| `/(auth)/signup` | Staff signup |
| `/(auth)/join` | Join organisation invitation |
| `/(auth)/forgot-password` | Password reset |
| `/(app)/dashboard` | Main dashboard (KPIs, activity, charts) |
| `/(app)/contacts` | Contact list (grid/table) |
| `/(app)/contacts/[contactId]` | Contact detail |
| `/(app)/properties` | Property list (grid/table) |
| `/(app)/properties/[propertyId]` | Property detail (tenancies, maintenance, docs) |
| `/(app)/tenancies` | Tenancy list (kanban/table) |
| `/(app)/tenancies/[tenancyId]` | Tenancy detail |
| `/(app)/maintenance` | Maintenance requests (kanban/table) |
| `/(app)/maintenance/[maintenanceId]` | Maintenance detail |
| `/(app)/tasks` | Task list (kanban/table) |
| `/(app)/communications` | Email / Calls / WhatsApp |
| `/(app)/documents` | Document management |
| `/(app)/reports` | Reports (P&L, landlord, vacancy, arrears, maintenance) |
| `/(app)/audit-log` | Audit trail |
| `/(app)/settings` | Settings (profile, org, users, workflows, bank) |

### Tenant/Landlord Portal (separate auth)
| Path | Purpose |
|------|---------|
| `/portal/login` | Portal login |
| `/portal/signup` | Portal signup |
| `/portal/dashboard` | Tenant/landlord dashboard |
| `/portal/maintenance` | Submit/view maintenance (tenant) |
| `/portal/documents` | View linked documents |
| `/portal/financials` | Transaction history (landlord) |

**Total**: 26 pages (20 staff + 6 portal)

## PostgreSQL Tables (already created)

- `crm_contacts` — id, first_name, last_name, email, phone, contact_type, mailing_address, organization_id
- `crm_properties` — id, address, city, postcode, property_type, bedrooms, bathrooms, rent_amount, status, landlord_ids, organization_id
- `crm_tenancies` — id, property_id, tenant_ids, rent_amount, deposit_amount, start_date, end_date, status, pipeline_status, organization_id
- `crm_tenancy_tenants` — tenancy_id, contact_id (join table)
- `crm_maintenance_requests` — id, property_id, reporter_contact_id, description, priority, status, organization_id
- `crm_tasks` — id, title, description, due_date, assignee_id, priority, status, linked entities, organization_id
- `crm_notifications` — id, user_id, message, read, organization_id

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/crm.service.ts` | Shared PostgreSQL queries (dashboard, tasks, notifications) |
| `src/lib/services/maintenance.service.ts` | Maintenance CRUD (full: list, get, create, update, delete) |
| `src/lib/services/tasks.service.ts` | Tasks CRUD (full: list, get, create, update, delete) |
| `src/lib/auth.ts` | JWT auth (staff) via `@relentify/auth` |
| `src/app/api/*/route.ts` | API route handlers |
| `docker-compose.yml` | Container config (port 3025) |

## Current Status (2026-03-31)

- Firebase packages still present — migration not yet executed
- API routes already read from PostgreSQL via `crm.service.ts` and dedicated service files
- Staff auth uses `@relentify/auth` JWT
- Portal auth still uses Firebase (needs migration)
- Real-time subscriptions (`useDoc`/`useCollection`) still use Firestore (needs migration to polling)
- **Migrated to API + SWR**: contacts, tenancies, properties, maintenance, tasks (full CRUD + components)
- **Maintenance**: service at `src/lib/services/maintenance.service.ts`, API at `/api/maintenance` + `/api/maintenance/[id]`, all 5 components migrated from Firebase to API calls

---

# Original Firebase Relentify CRM — Reference Notes

This document describes what the **original Firebase-based Relentify estate agency CRM** (`farazkhaliq/relentify-estateagencycrm`) was designed to do. It is written as a functional reference so we can compare it against what `25crm` currently does and identify gaps to close.

Source: `/opt/relentify-crm` (cloned from the private GitHub repo, not installed or running).

---

## What It Was

A **multi-tenant SaaS CRM for UK estate agents and letting agencies**. Each agency gets its own organisation with isolated data. Staff log in to manage their portfolio. Tenants and landlords get a separate read-only portal.

Tech: Next.js (App Router), Firebase (Firestore + Auth + Storage), Genkit AI (Google), Tailwind CSS + shadcn/ui.

---

## Navigation / Sidebar Structure

Collapsible sidebar (icons + labels, collapses to icons only):

```
[Org Logo / Name]  ← links to /dashboard

Dashboard
Contacts

── Management ──
Properties
Tenancies
Maintenance

── Operations ──
Communications
Tasks
Documents
Transactions
Reports

── System ──
Settings
Audit Log
```

Top bar: Global Search | Theme Toggle | Notification Bell | User Nav

---

## Pages & What They Do

### `/dashboard`
Overview hub. Shows:
- **DashboardStats** — 4 KPI cards (total properties, active tenancies, open tasks, pending maintenance)
- **RecentActivity** — live feed of recent creates/updates across all modules
- **TasksOverview** — count of tasks by status
- **PropertyStatusChart** — pie/bar of property statuses (Available / Occupied / Let Agreed / Under Offer)
- **MaintenancePriorityChart** — breakdown of open requests by priority (Urgent / High / Medium / Low)
- **TransactionSummaryChart** — income vs expense trends

---

### `/contacts`
All people in the system. Two views: **Grid** (avatar cards) and **List** (table).

Filter by contact type:
- **Lead** — prospective tenant or enquirer
- **Tenant** — active renter
- **Landlord** — property owner
- **Contractor** — maintenance/repair person

Clicking a contact goes to `/contacts/[contactId]`.

**Add Contact form fields:**
- First name, Last name (required)
- Email (required, validated)
- Phone (required)
- Contact Type (Lead / Tenant / Landlord / Contractor)
- Mailing Address: Address Line 1, Address Line 2, City, Postcode, Country (default: United Kingdom)

**Built-in automation:** When a **Lead** contact is created, the system automatically creates a follow-up task assigned to the creating user, due 3 days from now, titled "Follow up with [Name]". This is baked into the add-contact flow.

Every contact creation is logged to the audit trail.

---

### `/properties`
All properties in the portfolio. Two views: **Grid** (image cards) and **List** (table).

Grid cards show: property photo, address, city/postcode, rent (GBP/month), property type, status badge.

Property statuses: **Available**, **Occupied**, **Let Agreed**, **Under Offer**

**Add Property form fields:**
- Address Line 1, City, Postcode
- Property Type (House / Apartment / Bungalow / Maisonette / Commercial)
- Number of Bedrooms, Number of Bathrooms
- Rent Amount (GBP/month)
- Status
- Landlord IDs (link to one or more Landlord contacts)
- Image upload (or AI-generated placeholder)
- Description (can be AI-generated — see AI features below)

Clicking a property goes to `/properties/[propertyId]` — full detail view with linked tenancies, maintenance, documents, transactions.

---

### `/tenancies`
Tenancy agreements. Two views: **Board** (Kanban) and **Table**.

**Pipeline stages (Kanban columns):**
1. Application Received
2. Referencing
3. Awaiting Guarantor
4. Contract Signed
5. Awaiting Payment
6. Complete

Each card shows: property address, tenant name(s), rent amount.

**Tenancy statuses** (separate from pipeline): Active / Ended / Arrears / Pending

**Add Tenancy form:** Select property, select tenant(s), set rent amount, deposit amount, start date, end date.

Clicking a tenancy goes to `/tenancies/[tenancyId]`.

---

### `/maintenance`
Maintenance requests. Two views: **Board** (Kanban by status) and **Table**.

**Status columns (Kanban):**
New → In Progress → Awaiting Parts → On Hold → Completed / Cancelled

**Priorities:** Urgent, High, Medium, Low

Filters: by property, by priority.

Clicking a request goes to `/maintenance/[maintenanceId]`.

Can also be created by portal users (tenants).

---

### `/communications`
Three tabs: **Email**, **Calls**, **WhatsApp**

#### Email tab
Split-pane layout: inbox list (left) + email reader (right).

Inbox shows: unread indicator (blue dot), sender address, subject, body preview, relative timestamp.

Email reader shows: full from/to/timestamp, subject, full body.

**Toolbar actions:**
- Reply, Reply All, Forward
- Mark as Unread
- Create Task (pre-fills task title/description from email subject/body)
- Link to Entity (link email to contacts, properties, tenancies)
- Archive
- Delete (move to Trash)

**Entity links shown as badges** below the subject: linked contacts, linked property, linked tenancy.

**AI Assistant panel** (only if `organization.aiEnabled = true`):
- Auto-runs when an email is selected
- Shows: summary sentence, category badge (Maintenance / New Enquiry / Payment / General)
- Suggested action button:
  - "Create Maintenance Task" — if email describes a repair/problem
  - "Create Follow-up Task" — if it's an enquiry needing a reply
  - "Archive Email" — if it's informational and needs no action
- AI also suggests contacts and properties to link (with one-click "Link" buttons)

Email status lifecycle: Received → (auto-set to) Read when opened → Archived / Trashed by user

#### Calls tab
Table of logged calls: contact(s), summary, direction (Inbound/Outbound), date. Button: **Log Call** (opens LogCommunicationDialog).

#### WhatsApp tab
Same as Calls but for WhatsApp messages. Button: **Log Message**.

---

### `/tasks`
To-do items. Two views: **Board** (Kanban: Open / In Progress / Completed) and **Table**.

Table supports sortable columns. Default view shows all tasks; can filter by assignee, priority.

**Add Task form fields:**
- Title, Description
- Due date
- Assignee (staff user)
- Priority (High / Medium / Low)
- Status (Open / In Progress / Completed)
- Link to: Communication, Property, Contact, Tenancy (all optional)

Tasks can be created directly, from the Communications page, or automatically (e.g. when a Lead is added).

---

### `/documents`
Centralised file storage (metadata in Firestore, files in Firebase Storage).

List/grid of uploaded documents. Each shows: filename, upload date, uploader, file size, tags, linked entities.

Filters: by property, by contact, by uploader.

**Add Document:** file upload, description, tags, link to properties/contacts/tenancies.

Actions: download, edit metadata (description/tags/links), delete.

---

### `/transactions`
All financial movements. Table view with sortable columns.

**Transaction types:**
- Rent Payment
- Management Fee
- Commission
- Landlord Payout
- Contractor Payment
- Agency Expense
- Deposit

**Filters:** by type, by property, by status (Reconciled / Unreconciled).

**Reconciliation:** Each row has a toggle switch to mark as reconciled/unreconciled (non-blocking update, doesn't reload page).

**Export to CSV:** Downloads current filtered view with columns: Date, Type, Description, Property, From, To, Status, Amount, Currency.

Add Transaction dialog; click a row to edit transaction.

Columns: Date, Type, Description, Property (link), From (contact link), To (contact link), Status (reconcile toggle), Amount.

---

### `/reports`
Five pre-built reports displayed as cards on a single page:

1. **Profit & Loss** — income vs expenses, configurable date range
2. **Landlord Statement** — per-landlord breakdown of transactions, properties, balances
3. **Vacancy Report** — properties without active tenancies, duration vacant
4. **Arrears Report** — tenancies with Arrears status, amount owed
5. **Maintenance Report** — open requests by status/priority

---

### `/settings`

All users see:
- **My Profile** tab — edit name, email, profile image
- **Password** tab — change password

Admins additionally see:
- **Organization** tab — org name, logo, timezone, AI features toggle
- **User Management** tab — list all staff, change role (Admin ↔ Staff), remove user
- **Workflows** tab — automation rules (triggers → actions)
- **Bank Accounts** tab — add/edit bank account details for payouts

---

### `/audit-log`
Immutable log of all Create/Update/Delete actions across the system.

Columns: User, Action, Entity Type, Entity ID/Name, Timestamp, Changes.

Firestore rules: create is allowed, update/delete is denied — it can only grow.

Visible to all staff.

---

## Portal (External User Access)

Separate app section at `/portal/` for tenants and landlords (not staff).

Portal users log in/sign up separately from staff. On signup they link their Firebase account to a contact record within the organisation.

Firestore structure: `portalUserProfiles/{uid}` → `{ organizationId, contactId, firstName }`

### Tenant Portal Dashboard (`/portal/dashboard`)
Shows:
- **Your Rented Property** card — address, city/postcode, bedrooms, bathrooms, rent/month
- **Your Tenancy** card — status badge, term dates (start → end)

### Landlord Portal Dashboard (`/portal/dashboard`)
Shows:
- **Financials** card — Income / Expenses / Net for selected time range (Last 30 days / Last 90 days / This Year). Income = Rent Payments; Expenses = Management Fees + Contractor Payments.
- **Open Maintenance Requests** — table of active issues across landlord's properties (property, issue description, status)
- **Your Properties** — list of properties with status badges

### Portal `/portal/maintenance`
Tenants can submit and view their own maintenance requests.

### Portal `/portal/documents`
Tenants/landlords can view documents linked to them (tenancy agreements, statements, notices).

### Portal `/portal/financials`
Detailed transaction history for landlords.

---

## Firestore Data Structure

All CRM data lives under: `organizations/{organizationId}/`

| Collection | Key Fields |
|---|---|
| `contacts` | id, firstName, lastName, email, phone, contactType (Lead/Tenant/Landlord/Contractor), mailingAddress, organizationId, createdAt |
| `properties` | id, addressLine1, city, postcode, propertyType, numberOfBedrooms, numberOfBathrooms, rentAmount, status, landlordIds[], imageUrl, imageHint, description, organizationId |
| `tenancies` | id, propertyId, tenantIds[], rentAmount, depositAmount, startDate, endDate, status, pipelineStatus, organizationId |
| `maintenanceRequests` | id, propertyId, reporterContactId, description, reportedDate, priority, status, organizationId |
| `transactions` | id, transactionType, amount, currency, transactionDate, description, relatedPropertyId, relatedTenancyId, payerContactId, payeeContactId, reconciled, organizationId |
| `communications` | id, communicationType, subject, body, fromAddress, toAddresses[], direction, timestamp, status, relatedContactIds[], relatedPropertyId, relatedTenancyId, organizationId |
| `tasks` | id, title, description, dueDate, assignedToUserId, createdByUserId, priority, status, relatedCommunicationId, relatedPropertyId, relatedContactId, relatedTenancyId, organizationId |
| `documents` | id, fileName, filePath, fileSize, uploadDate, uploadedByUserId, description, tags[], propertyIds[], tenancyIds[], contactIds[], organizationId |
| `userProfiles` | id, firstName, lastName, email, role (Admin/Staff), organizationId |
| `workflowRules` | id, trigger, action, conditions, enabled, organizationId |
| `bankAccounts` | id, accountName, accountNumber, sortCode, bankName, organizationId |
| `auditLogs` | id, userId, action, entityType, entityId, entityName, timestamp, organizationId |

Top-level collections:
- `organizations/{orgId}` — org name, logoUrl, aiEnabled, timezone
- `portalUserProfiles/{uid}` — organizationId, contactId, firstName

---

## AI Features (Genkit / Google GenAI)

### 1. Email Analysis (`analyzeCommunication`)
Triggered automatically when an email is selected in Communications (if `organization.aiEnabled`).

**Input:** subject, body

**Output:**
- `summary` — one-sentence description of email purpose
- `suggestedCategory` — Maintenance / New Enquiry / Payment / General
- `suggestedAction` — Create Maintenance Task / Create Follow-up Task / Archive / None
- `potentialContactName` — person mentioned in body (not signature)
- `potentialPropertyName` — property address mentioned in body
- `isReplyOrForward` — boolean

Used to show an AI Assistant panel in the email reader with action buttons and suggested entity links.

### 2. Property Description Generation (`generatePropertyDescription`)
Called from the Add/Edit Property dialog.

**Input:** propertyType, city, numberOfBedrooms, numberOfBathrooms, description (optional existing notes)

**Output:** Full marketing copy for a lettings advert. Paragraph format, no title.

---

## User Roles

Only **two roles** in the actual code:

| Role | Access |
|---|---|
| **Admin** | Full access including Settings (org/users/workflows/bank accounts), can change other users' roles |
| **Staff** | Access to all CRM modules; cannot access admin Settings tabs; cannot change roles |

Staff UI shows only the "My Profile" tab in Settings. Admin UI shows all 5 tabs.

---

## Built-in Workflow Automation

One hardcoded workflow in the original:

> **When a Lead contact is created** → automatically create a task titled "Follow up with [Name]", assigned to the creating user, due in 3 days, priority Medium, status Open, linked to the new contact.

The Settings → Workflows tab was designed to allow admins to create additional automation rules (trigger → action), but the UI for that was in progress.

---

## Global Search

A `GlobalSearch` dialog component exists and is mounted in the top bar. Intended to search across contacts, properties, tenancies.

---

## Notification Bell

`NotificationBell` component in top bar. Reads from `organizations/{orgId}/notifications` collection filtered to current user. Shows unread count badge.

---

## Key Workflows the App Was Designed to Support

1. **Onboard a property** — add property, link landlord, set status to Available
2. **Process a tenancy application** — create tenancy at "Application Received", move through pipeline stages to Complete
3. **Handle a maintenance request** — staff or tenant creates request, staff moves it through New → In Progress → Completed, logs contractor cost as a Transaction
4. **Email-driven task creation** — receive email, AI suggests action, one click creates linked task
5. **Financial reconciliation** — log rent payments and fees as transactions, toggle reconciled, export to CSV for accounting
6. **Landlord self-service** — landlord logs into portal, sees their property income, open maintenance issues, documents
7. **Tenant self-service** — tenant logs into portal, sees their property and tenancy details, submits maintenance requests

---

## What This Means for 25crm

The original app was a **complete, working estate agency CRM** built on Firebase. The `25crm` app in the monorepo is the rebuilt version (PostgreSQL + Prisma instead of Firestore, shared `@relentify/ui` library, etc.).

When comparing 25crm against this reference, check for:
- Are all 9 modules present and functional? (Properties, Contacts, Tenancies, Maintenance, Communications, Tasks, Documents, Transactions, Reports)
- Does the tenancy pipeline have all 6 stages?
- Does Communications have Email + Calls + WhatsApp tabs?
- Is the AI email analysis wired up?
- Is the AI property description generation wired up?
- Does the Lead auto-task workflow exist?
- Does the landlord/tenant portal exist?
- Are all 5 reports implemented?
- Is the audit log present and append-only?
- Does the notification bell work?
- Does global search work?
- Are the Settings tabs (org / users / workflows / bank accounts) all implemented for admins?
