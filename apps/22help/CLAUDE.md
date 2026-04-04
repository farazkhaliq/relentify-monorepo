# 26help — Relentify Help Centre

Static Next.js site at `help.relentify.com`. Container: `26help` (port 3026).
Source: `/opt/relentify-monorepo/apps/26help/`.
Content: MDX articles in `apps/26help/content/<category>/`.

This is the self-serve documentation hub for all Relentify products. It is a critical
requirement for each product launch — users need help articles and video walkthroughs
before support can be scaled.

---

## Architecture

- **Framework**: Next.js with `output: 'export'` — fully static, no server
- **Search**: Pagefind (runs post-build, indexes HTML → `out/_pagefind/`)
- **Content**: MDX via `next-mdx-remote/rsc`, frontmatter via `gray-matter`
- **Design**: `@relentify/ui` — ThemeProvider, TopBar, Logo, Footer, MotionProvider, Card, Input
- **Theme**: Preset B (Modern/Minimal), shares dark mode cookie with accounting.relentify.com

### Key build note

`COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules` is required
in the builder stage of the Dockerfile. Without it, webpack fails with
`Can't resolve 'tailwindcss' in '/app/packages/ui/src/styles'` because
`packages/ui/src/index.ts` imports its own `globals.css` which contains `@import "tailwindcss"`.

---

## Content Structure

```
apps/26help/content/
  accounting/       ← one MDX file per feature
  crm/
  reminders/
  api/
  migration/
```

### Article frontmatter schema

```yaml
---
title: "Create an Invoice"
description: "Step-by-step guide to creating and sending invoices in Relentify."
category: accounting
videoUrl: "https://assets.relentify.com/help/accounting/create-invoice.mp4"
relatedArticles:
  - send-invoice
  - record-invoice-payment
---
```

`videoUrl` is optional — add it once the recording exists. The `<VideoGuide>` component
is already wired into the article page and will render an inline video player when the
field is present.

---

## Rebuild & Deploy

```bash
cd /opt/relentify-monorepo
docker compose -f apps/26help/docker-compose.yml down
docker compose -f apps/26help/docker-compose.yml build --no-cache
docker compose -f apps/26help/docker-compose.yml up -d
docker logs 26help --tail 30
docker builder prune -f
```

---

## Accounting Articles — Full Feature Coverage Required

Every feature tested by the 22accounting MCP suite (48 tools, 28 UI pages) must have
an article AND a video. The MCP test suite at `/opt/infra/mcp/22accounting-mcp/` is the
authoritative list of what the app can do.

### Written ✅ (51 accounting + 7 API articles, all complete as of 2026-03-31)

| Slug | Feature |
|------|---------|
| `create-invoice` | Create an invoice |
| `send-invoice` | Send an invoice by email |
| `record-invoice-payment` | Record payment against an invoice |
| `create-quote` | Create a quote |
| `convert-quote` | Convert a quote to invoice |
| `create-bill` | Create a bill from a supplier |
| `record-bill-payment` | Record payment against a bill |
| `create-credit-note` | Create a credit note |
| `create-expense` | Log an expense |
| `approve-expense` | Approve or reject an expense |
| `bank-reconciliation` | Reconcile bank transactions |
| `create-journal` | Create a manual journal entry |
| `add-customer` | Add a customer |
| `add-supplier` | Add a supplier |
| `pl-report` | Profit & Loss report |
| `balance-sheet` | Balance sheet report |
| `trial-balance` | Trial balance report |
| `vat-return` | Calculate and review VAT (9-box) |
| `import-opening-balances` | Import opening balances |
| `invite-team-member` | Invite a team member |
| `update-customer` | Edit or deactivate a customer |
| `update-supplier` | Edit or deactivate a supplier |
| `void-invoice` | Void an invoice |
| `expense-approval-settings` | Enable/disable expense approval workflow |
| `create-purchase-order` | Create a purchase order |
| `submit-purchase-order` | Submit a PO for approval |
| `approve-purchase-order` | Approve or reject a PO |
| `purchase-order-settings` | Enable PO approval workflow |
| `chart-of-accounts` | View and understand your chart of accounts |
| `general-ledger` | General ledger — full transaction history |
| `cash-flow` | Cash flow statement |
| `kpi-dashboard` | KPI dashboard — key business metrics |
| `health-score` | Financial health score — what it means |
| `custom-report` | Build a custom report |
| `multi-entity` | Create and switch between organisations |
| `accountant-access` | Invite your accountant, manage permissions |
| `period-lock` | Lock a period to prevent back-dating |
| `company-settings` | Update company name, address, VAT number, financial year |
| `audit-log` | View the audit log |

### API Articles ✅ (7 articles in `content/api/`)

| Slug | Feature |
|------|---------|
| `getting-started` | API introduction, auth, rate limits, error format |
| `invoices-api` | Invoices API endpoints |
| `customers-api` | Customers API endpoints |
| `suppliers-api` | Suppliers API endpoints |
| `bills-api` | Bills API endpoints |
| `reports-api` | Reports API endpoints |
| `webhooks-api` | Webhooks setup, events, HMAC verification, retries |

### Still needed

All articles are written. No gaps remaining.

---

## Videos — Required for Every Article

Every article (both written and pending) needs a short screen-recording embedded via
`videoUrl` in the frontmatter. The `<VideoGuide>` component handles the player — just
supply the URL.

**Hosting**: Upload to S3 or Cloudflare R2. URL pattern:
`https://assets.relentify.com/help/accounting/<slug>.mp4`

**Priority recording order** (highest-traffic flows first):
1. `create-invoice` + `send-invoice` + `record-invoice-payment` — core user flow
2. `bank-reconciliation` — daily active use
3. `vat-return` — time-sensitive, high anxiety
4. `create-bill` + `record-bill-payment`
5. `create-expense` + `approve-expense`
6. `create-quote` + `convert-quote`
7. All remaining articles

**Recording guidelines** (to be established):
- Resolution: 1920×1080, screen only (no webcam)
- Length: 60–120 seconds max per article
- No narration required for MVP — on-screen action is sufficient
- Trim to the exact flow, no idle time

---

## Article Automation ✅ (built 2026-03-31)

**Goal**: Keep articles accurate as 22accounting evolves — automatically detect
when app behaviour changes and update the relevant MDX.

**Script**: `scripts/update-help-articles.sh` at monorepo root

```
1. Run MCP test suite (22accounting-mcp, 48 tests) — captures current app behaviour
2. Gather git log + diff of recent 22accounting changes (last 7 days)
3. Invoke Claude Code CLI (claude -p, Sonnet model) non-interactively with:
     - MCP test output (proves current behaviour)
     - recent git changes (context for what changed)
     - instruction to read all MDX articles and update any that are stale
4. If articles were edited: rebuild + redeploy 26help container, commit changes
```

**Trigger**: Weekly cron — `0 9 * * 1` (every Monday 09:00 UK)
**Log**: `/var/log/help-articles.log`
**Dry run**: `./scripts/update-help-articles.sh --dry-run` (review only, no edits)

**How it works**: Uses the `claude` CLI from the Max subscription (no API key needed).
Claude reads all MDX files via its file tools, compares against MCP test output and
recent code changes, then edits any articles that are inaccurate or incomplete.

---

## Other Product Categories (future)

The same article + video requirement applies to each product when launched:

| Category | Status |
|----------|--------|
| `accounting` | ✅ 51 articles written (2026-03-31) |
| `crm` | Placeholder articles exist — see CRM article plan below |
| `reminders` | Placeholder articles exist — see Reminders article plan below |
| `api` | Placeholder articles exist — needs developer-focused coverage |
| `migration` | Placeholder articles exist — needs coverage for CSV import, data migration flows |

### CRM Articles Needed (when 25crm launches)

| Slug | Feature |
|------|---------|
| `add-contact` | Add a contact (Lead/Tenant/Landlord/Contractor) |
| `manage-properties` | Add and manage properties |
| `create-tenancy` | Create a tenancy agreement |
| `tenancy-pipeline` | Use the tenancy pipeline (Kanban) |
| `maintenance-requests` | Submit and manage maintenance requests |
| `crm-tasks` | Create and manage tasks |
| `communications` | Email, calls, and WhatsApp logging |
| `documents` | Upload and manage documents |
| `crm-reports` | View reports (P&L, landlord, vacancy, arrears, maintenance) |
| `tenant-portal` | Tenant portal — login, maintenance, documents |
| `landlord-portal` | Landlord portal — financials, properties |
| `crm-settings` | Organisation settings and user management |
| `audit-log-crm` | View the CRM audit log |

### Reminders Articles Needed (when 24reminders launches)

| Slug | Feature |
|------|---------|
| `create-task-reminders` | Create a task with priority and due date |
| `workspaces` | Create and manage workspaces |
| `lists` | Organise tasks into lists |
| `subtasks` | Break tasks into subtasks |
| `momentum-mode` | Use momentum mode for focused work |
| `activity-log` | View your activity history |
| `gamification` | Points, streaks, and the leaderboard |

---

## UI Pages

| Path | Purpose |
|------|---------|
| `/` | Help centre home — search + category cards |
| `/[category]` | Category page — list articles in category |
| `/[category]/[article]` | Article detail — MDX content + video |

**Total**: 3 page templates (dynamic routes)

---

## API Routes

None — this is a fully static export (`output: 'export'`). No server-side endpoints.
