# 21auth — Authentication & Onboarding Gateway

**Container**: `21auth` | **Port**: 3021 → 3000 | **Runtime**: Next.js 15 (standalone) | **Database**: PostgreSQL (`infra-postgres`)

Pure authentication gateway at `auth.relentify.com`. Handles registration (with plan selection), login/logout, JWT cookie management, app portal, and accountant invitation acceptance. All pages use the `AuthShell` layout — minimal centred UI with theme toggle.

---

## Tech Stack

- **Next.js 15.5** — App Router, React 19, server + client components
- **pg** — Direct PostgreSQL queries (no ORM)
- **bcryptjs** — Password hashing (12 salt rounds)
- **jsonwebtoken** — JWT signing/verification
- **@relentify/ui** — Shared UI components (Button, Input, Card, Logo)
- **Tailwind CSS v4** — CSS variable-based theming

---

## Deployment

```bash
cd /opt/relentify-monorepo/apps/21auth
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs 21auth --tail 50
```

---

## API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | No | Email + password login, sets JWT cookie |
| POST | `/api/auth/register` | No | Create account with plan selection, sets JWT cookie |
| GET | `/api/auth/logout` | No | Clears cookie, redirects to `/login` |
| GET | `/api/accountant/accept?token=` | No | Fetch invitation details by token |
| POST | `/api/accountant/accept` | No | Accept accountant invitation |
| GET | `/api/health` | No | Health check (`{"status":"ok"}`) |

**Total**: 6 endpoints (5 functional + 1 health)

### POST /api/auth/login

**Body**: `{ email, password }`
**Success** (200): `{ user: { id, email } }` + sets `relentify_token` cookie
**Errors**: 400 (missing fields), 401 (invalid credentials), 403 (account disabled)
**Side effects**: Updates `users.last_login_at`, checks `users.is_active`

### POST /api/auth/register

**Body**: `{ email, password, fullName, tier, userType, firmName?, affiliateId?, refToken? }`
**Success** (201): `{ user: { id, email, tier }, requiresPayment }` + sets cookie
**Errors**: 400 (missing fields, password < 8 chars), 409 (email exists)
**Side effects**:
- Inserts `users` row (email lowercased, bcrypt hash)
- Grants `app_access` for `'accounts'` app
- If `refToken`: auto-accepts accountant invite in `accountant_clients` table, backfills user referral fields

### GET /api/auth/logout

**Response**: Redirect to `https://auth.relentify.com/login`
**Side effects**: Clears `relentify_token` cookie (Max-Age=0)

### GET /api/accountant/accept?token=

**Response** (200): `{ valid: true, clientName, accountantEmail }`
**Errors**: 400 (no token), 404 (not found/not pending)

### POST /api/accountant/accept

**Body**: `{ token }`
**Response** (200): `{ success: true }`
**Side effects**: Links accountant to client user (`users.accountant_user_id`), marks invitation accepted

---

## UI Pages

| Route | Auth | Purpose |
|-------|------|---------|
| `/` | No | Redirects: logged in → `/portal`, logged out → `/login` |
| `/login` | No | Email + password form. Redirects to `?redirect=` param or `/portal` |
| `/register` | No | Two-step: plan selection → account details. Supports `?ref=` and `?refToken=` params |
| `/portal` | Yes | App launcher — shows apps user can access from `app_access` table |
| `/accountant-accept` | No | Accept accountant invitation via `?token=` param |

**Total**: 5 pages

### /register Details

**Step 1 — Plan Selection**:
- Invoicing (Free), Sole Trader (£0.99→£4.99/mo), Small Business (£1.99→£12.50/mo), Medium Business (£4.99→£29/mo), Corporate (£8.99→£49/mo)
- Checkbox: "I'm an accountant" → hides plans, shows firm name field
- Small Business has "Popular" badge

**Step 2 — Account Details**:
- Full Name, Email, Password, Confirm Password
- Button: "Create Free Account" / "Create Account & Pay" / "Create Accountant Account"

### /portal Details

- Fetches `app_access` for current user
- Displays 4 app cards: Accounting, Inventory, CRM, Reminders
- Apps with access: "Open Product →" link
- Apps without access: "Join Waitlist" link (60% opacity)

---

## JWT & Cookies

### Token

**Secret**: `process.env.JWT_SECRET` (fallback: `'fallback-dev-secret'`)
**Expiry**: 7 days
**Payload**: `{ userId, email, userType, fullName, tier? }`

### Cookie

**Name**: `relentify_token`
**Flags**: HttpOnly, SameSite=Lax, Path=/, Domain=`.relentify.com`, Max-Age=604800

Domain `.relentify.com` allows all subdomains to read the token (accounting, inventory, CRM, etc.).

### Verification

```typescript
// src/lib/auth.ts
getAuthUser() → reads cookie → verifyToken() → JWTPayload | null
```

---

## Database Tables

### users

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| email | VARCHAR | Unique, lowercased |
| password_hash | VARCHAR | bcrypt(12) |
| full_name | VARCHAR | Display name |
| user_type | ENUM | `'sole_trader'` / `'accountant'` |
| tier | VARCHAR | `'invoicing'`/`'sole_trader'`/`'small_business'`/`'medium_business'`/`'corporate'`/`'accountant'` |
| business_name | VARCHAR | Accountant firm name (optional) |
| is_active | BOOLEAN | If false, login returns 403 |
| last_login_at | TIMESTAMP | Updated on login |
| affiliate_id | VARCHAR | Referral code (optional) |
| referred_by_accountant_id | UUID | FK → accountant's user.id |
| referral_started_at | TIMESTAMP | When referral began |
| referral_expires_at | TIMESTAMP | 36 months from signup |
| accountant_user_id | UUID | FK → accountant user (set on invitation accept) |
| created_at | TIMESTAMP | Insert time |

### app_access

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| app | VARCHAR | `'accounts'`/`'inventory'`/`'crm'`/`'reminders'` |
| created_at | TIMESTAMP | Insert time |

Unique constraint: `(user_id, app)`. All users get `'accounts'` on registration.

### accountant_invitations

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| token | VARCHAR | Unique invite token |
| accountant_email | VARCHAR | Accountant's email |
| client_user_id | UUID | FK → users.id (the client) |
| status | ENUM | `'pending'`/`'accepted'` |
| accepted_at | TIMESTAMP | NULL until accepted |

### accountant_clients (legacy, used in register refToken path)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| invite_token | VARCHAR | Unique |
| accountant_user_id | UUID | FK → users.id |
| invite_email | VARCHAR | Invited client email |
| client_user_id | UUID | Set after acceptance |
| status | ENUM | `'pending'`/`'active'` |
| accepted_at | TIMESTAMP | NULL until accepted |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/auth/login/route.ts` | Login endpoint |
| `src/app/api/auth/register/route.ts` | Registration endpoint |
| `src/app/api/auth/logout/route.ts` | Logout + cookie clear |
| `src/app/api/accountant/accept/route.ts` | GET + POST accountant invite |
| `src/app/api/health/route.ts` | Health check |
| `src/app/login/page.tsx` | Login form page |
| `src/app/register/page.tsx` | Registration flow page |
| `src/app/portal/page.tsx` | App launcher page |
| `src/app/accountant-accept/page.tsx` | Invitation acceptance page |
| `src/lib/auth.ts` | JWT, password, cookie utilities |
| `src/lib/db.ts` | PostgreSQL Pool + query helper |
| `src/components/layout/AuthShell.tsx` | Shared auth page wrapper |

---

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `DATABASE_URL` | Yes | — |
| `JWT_SECRET` | Yes | `'fallback-dev-secret'` |
| `ACCOUNTS_URL` | No | `https://accounting.relentify.com` |
| `INVENTORY_URL` | No | `https://inventory.relentify.com` |
| `CRM_URL` | No | `https://crm.relentify.com` |
| `REMINDERS_URL` | No | `https://reminders.relentify.com` |

---

## Known Limitations

1. **Forgot password** — Login page links to `/forgot-password` but no route exists
2. **Email verification** — No verification step on register
3. **Rate limiting** — None on auth endpoints
4. **Dual invite tables** — `accountant_invitations` + `accountant_clients` both used — should consolidate
5. **Hardcoded pricing** — Plan prices in register page, should come from Stripe/CMS
6. **No middleware** — Auth checks are per-page via `getAuthUser()`, no global middleware

---

## Feature Status

| Feature | Status |
|---------|--------|
| Login (email + password) | Done |
| Registration (5 tiers + accountant) | Done |
| Logout + cookie clear | Done |
| JWT generation + verification | Done |
| Cross-subdomain cookie (`.relentify.com`) | Done |
| App portal / launcher | Done |
| Accountant invitation acceptance | Done |
| Referral tracking (36-month window) | Done |
| Forgot password | Not built |
| Email verification | Not built |
| Rate limiting | Not built |
| SSO / OAuth | Not built |

---

## MCP Test Server

**Location**: `/opt/infra/mcp/21auth-mcp/`
**Status**: Tests not yet run (container currently stopped)
**Modules**: auth_tests, setup, ui_checks
