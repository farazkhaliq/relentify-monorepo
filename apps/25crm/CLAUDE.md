# 25crm — Relentify CRM

**Multi-tenant SaaS CRM for UK estate agents and letting agencies.** Each agency gets its own organisation with isolated data. Staff log in to manage their portfolio. Tenants and landlords get a separate read-only portal.

- **Container**: `25crm`, **Port**: 3025, **URL**: crm.relentify.com
- **Stack**: Next.js (App Router), PostgreSQL, SWR, Tailwind CSS + @relentify/ui
- **Auth**: Staff via `@relentify/auth` JWT cookies, Portal via bcrypt + JWT (`crm_portal_users`)
- **Data**: All PostgreSQL via API routes + dedicated service files. Zero Firebase dependencies.

---

## Architecture

| Feature | Implementation |
|---|---|
| Staff auth | `@relentify/auth` JWT via cookies |
| Portal auth | bcrypt + JWT via `crm_portal_users` table |
| Data access | PostgreSQL API routes + SWR on client |
| Audit logging | PostgreSQL `crm_audit_logs` table (append-only) |
| File uploads | Local filesystem via `/api/uploads` |
| Error boundaries | Standard Next.js error boundaries |

---

## API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health check |
| GET | `/api/me` | Yes | Current user info |
| GET/POST | `/api/contacts` | Yes | List (with ?type= filter) / create contacts |
| GET/PATCH/DELETE | `/api/contacts/[id]` | Yes | Get / update / delete contact |
| GET/POST | `/api/properties` | Yes | List / create properties |
| GET/PATCH | `/api/properties/[id]` | Yes | Get / update property |
| GET/POST | `/api/tenancies` | Yes | List / create tenancies |
| GET/PATCH/DELETE | `/api/tenancies/[id]` | Yes | Get / update / delete tenancy |
| GET/POST | `/api/tasks` | Yes | List / create tasks |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Yes | Get / update / delete task |
| GET/POST | `/api/maintenance` | Yes | List / create maintenance requests |
| GET/PATCH/DELETE | `/api/maintenance/[id]` | Yes | Get / update / delete maintenance request |
| GET/POST | `/api/communications` | Yes | List (with ?type= filter) / create communications |
| GET/PATCH/DELETE | `/api/communications/[id]` | Yes | Get / update / delete communication |
| GET/POST | `/api/documents` | Yes | List / create documents |
| GET/PATCH/DELETE | `/api/documents/[id]` | Yes | Get / update / delete document |
| POST | `/api/uploads` | Yes | Upload file (multipart), returns path |
| GET | `/api/uploads/[...path]` | Yes | Serve uploaded file by path |
| GET/POST | `/api/transactions` | Yes | List (with ?type= and ?contact_id= filters) / create transactions |
| GET/PATCH/DELETE | `/api/transactions/[id]` | Yes | Get / update / delete transaction (PATCH supports { reconciled } toggle) |
| GET/POST | `/api/bank-accounts` | Yes | List / create bank accounts |
| GET/PATCH/DELETE | `/api/bank-accounts/[id]` | Yes | Get / update / delete bank account |
| GET/POST | `/api/workflow-rules` | Yes | List / create workflow rules |
| GET/PATCH/DELETE | `/api/workflow-rules/[id]` | Yes | Get / update / delete workflow rule |
| GET | `/api/notifications` | Yes | List notifications (filtered by user + entity) |
| PATCH | `/api/notifications/[id]` | Yes | Mark notification as read |
| GET | `/api/audit-logs` | Yes | List audit logs (read-only) |
| GET | `/api/user-profiles` | Yes | List user profiles for entity |
| PATCH | `/api/user-profiles/[id]` | Yes | Update user profile (role) |
| GET | `/api/reports/dashboard-stats` | Yes | Dashboard KPI stats |
| GET | `/api/reports/recent-activity` | Yes | Recent activity feed |
| GET | `/api/reports/profit-loss` | Yes | P&L report (?from=&to= date range) |
| GET | `/api/reports/vacancy` | Yes | Vacant properties report |
| GET | `/api/reports/arrears` | Yes | Tenancies in arrears with tenant names |
| GET | `/api/reports/maintenance-report` | Yes | Open maintenance summary + chart data |
| GET | `/api/reports/landlord-statement` | Yes | Landlord financial statement (?landlord_id=&from=&to=) |
| GET | `/api/search` | Yes | Global search across contacts, properties, tenancies (?q=term) |
| POST | `/api/portal/auth/login` | No | Portal login (bcrypt verify, sets crm_portal_token cookie) |
| POST | `/api/portal/auth/signup` | No | Portal signup (create portal user, sets cookie) |
| GET/DELETE | `/api/portal/auth/me` | Portal | Get current portal user / logout (clear cookie) |

**Total**: 40 route files

---

## Services

All service files live in `src/lib/services/`.

| File | Purpose |
|------|---------|
| `contacts.service.ts` | Contacts CRUD (list with type filter, get, create, update, delete) |
| `property.service.ts` | Properties CRUD (list, get, create, update) |
| `tenancies.service.ts` | Tenancies CRUD (list, get, create, update, delete) |
| `tasks.service.ts` | Tasks CRUD (list, get, create, update, delete) |
| `maintenance.service.ts` | Maintenance CRUD (list, get, create, update, delete) |
| `communications.service.ts` | Communications CRUD (list with type filter, get, create, update, delete) |
| `documents.service.ts` | Documents CRUD (list, get, create, update, delete) |
| `transactions.service.ts` | Transactions CRUD (list with type/contact filters, get, create, update, delete) |
| `bank-accounts.service.ts` | Bank accounts CRUD (list, get, create, update, delete) |
| `workflow-rules.service.ts` | Workflow rules CRUD (list, get, create, update, delete) |
| `audit-logs.service.ts` | Audit logs read-only (list with user_name join) |
| `notifications.service.ts` | Notifications (list by user+entity, mark-as-read) |
| `user-profiles.service.ts` | User profiles CRUD (list, get, update role) |
| `portal-auth.service.ts` | Portal auth (login, signup, JWT verify, bcrypt) |
| `crm.service.ts` | Shared queries (dashboard stats, recent activity, search) |

Other key files in `src/lib/`:

| File | Purpose |
|------|---------|
| `auth.ts` | JWT auth (staff) via `@relentify/auth` |
| `audit.ts` | Audit log helper (write audit entries) |
| `db.ts` | PostgreSQL pool + query wrapper |
| `pool.ts` | Connection pool config |
| `utils.ts` | Shared utilities |

---

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

---

## PostgreSQL Tables

All 16 `crm_*` tables:

| Table | Key Columns |
|-------|-------------|
| `crm_contacts` | id, first_name, last_name, email, phone, contact_type, mailing_address, organization_id |
| `crm_properties` | id, address, city, postcode, property_type, bedrooms, bathrooms, rent_amount, status, landlord_ids, organization_id |
| `crm_tenancies` | id, property_id, tenant_ids, rent_amount, deposit_amount, start_date, end_date, status, pipeline_status, organization_id |
| `crm_tenancy_tenants` | tenancy_id, contact_id (join table) |
| `crm_tenancy_contacts` | tenancy_id, contact_id (join table) |
| `crm_maintenance_requests` | id, property_id, reporter_contact_id, description, priority, status, organization_id |
| `crm_tasks` | id, title, description, due_date, assignee_id, priority, status, linked entities, organization_id |
| `crm_communications` | id, communication_type, subject, body, from_address, to_addresses, direction, status, related entity IDs, organization_id |
| `crm_documents` | id, file_name, file_path, file_size, upload_date, uploaded_by, description, tags, linked entity IDs, organization_id |
| `crm_transactions` | id, transaction_type, amount, currency, transaction_date, description, related entity IDs, reconciled, organization_id |
| `crm_bank_accounts` | id, account_name, account_number, sort_code, bank_name, organization_id |
| `crm_workflow_rules` | id, trigger, action, conditions, enabled, organization_id |
| `crm_notifications` | id, user_id, message, read, organization_id |
| `crm_audit_logs` | id, user_id, action, entity_type, entity_id, entity_name, timestamp, organization_id |
| `crm_user_profiles` | id, first_name, last_name, email, role (Admin/Staff), organization_id |
| `crm_portal_users` | id, email, password_hash, contact_id, organization_id |

---

## Features

### Core Modules
- **Contacts** -- Lead / Tenant / Landlord / Contractor types. Grid + table views. Lead auto-creates follow-up task.
- **Properties** -- House / Apartment / Bungalow / Maisonette / Commercial. Status: Available / Occupied / Let Agreed / Under Offer. Linked to landlords, tenancies, maintenance.
- **Tenancies** -- Kanban pipeline (Application Received -> Referencing -> Awaiting Guarantor -> Contract Signed -> Awaiting Payment -> Complete). Status: Active / Ended / Arrears / Pending.
- **Maintenance** -- Kanban by status (New -> In Progress -> Awaiting Parts -> On Hold -> Completed / Cancelled). Priorities: Urgent / High / Medium / Low. Tenants can submit via portal.
- **Communications** -- Three tabs: Email, Calls, WhatsApp. Email has inbox/reader split pane with entity linking.
- **Tasks** -- Kanban (Open / In Progress / Completed) + table. Linkable to contacts, properties, tenancies, communications.
- **Documents** -- File upload with metadata, tags, entity linking.
- **Transactions** -- Rent Payment / Management Fee / Commission / Landlord Payout / Contractor Payment / Agency Expense / Deposit. Reconciliation toggle. CSV export.
- **Reports** -- P&L, Landlord Statement, Vacancy, Arrears, Maintenance.

### Other Features
- **Dashboard** -- KPI cards, recent activity, task overview, property/maintenance/transaction charts.
- **Global Search** -- Searches across contacts, properties, tenancies.
- **Notification Bell** -- Unread count badge, filtered by user + entity.
- **Audit Log** -- Immutable log of all CRUD actions.
- **Settings** -- My Profile, Password, Organization, User Management, Workflows, Bank Accounts. Admin-only tabs for org/users/workflows/bank.
- **Tenant/Landlord Portal** -- Separate auth, property/tenancy view, maintenance submission, document access, financial history.

### User Roles
| Role | Access |
|---|---|
| **Admin** | Full access including Settings (org/users/workflows/bank accounts) |
| **Staff** | All CRM modules; My Profile only in Settings |

### Built-in Automation
- **Lead follow-up**: When a Lead contact is created, auto-creates a task "Follow up with [Name]" assigned to the creator, due in 3 days.
- **Workflow Rules**: Admin-configurable trigger -> action rules via Settings.

---

## Current Status (2026-03-31)

- Firebase fully removed -- zero packages, zero imports, zero config files
- All API routes use PostgreSQL via dedicated service files
- Staff auth uses `@relentify/auth` JWT
- Portal auth uses bcrypt + JWT via `crm_portal_users` table
- All UI components use SWR + API routes (no Firestore subscriptions)
- Build succeeds clean; `pnpm audit` clean for 25crm
