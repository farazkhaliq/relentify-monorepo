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

### Written ✅ (20 articles)

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

### Still needed ❌ (priority order for launch)

**Customers & Suppliers**
| Slug | Feature |
|------|---------|
| `update-customer` | Edit or deactivate a customer |
| `update-supplier` | Edit or deactivate a supplier |

**Invoicing & Quotes**
| Slug | Feature |
|------|---------|
| `void-invoice` | Void an invoice |
| `void-credit-note` | Void a credit note |
| `attachments` | Attach receipts/files to invoices, bills, expenses |
| `comments` | Add comments and view activity on transactions |

**Expenses & Mileage**
| Slug | Feature |
|------|---------|
| `mileage-expense` | Log a mileage claim |
| `expense-approval-settings` | Enable/disable expense approval workflow |

**Purchase Orders**
| Slug | Feature |
|------|---------|
| `create-purchase-order` | Create a purchase order |
| `submit-purchase-order` | Submit a PO for approval |
| `approve-purchase-order` | Approve or reject a PO |
| `purchase-order-settings` | Enable PO approval workflow |

**Projects**
| Slug | Feature |
|------|---------|
| `create-project` | Create a project |
| `assign-costs-to-project` | Link bills and expenses to a project |

**Chart of Accounts**
| Slug | Feature |
|------|---------|
| `chart-of-accounts` | View and understand your chart of accounts |
| `create-account` | Create a custom account |
| `deactivate-account` | Deactivate an account |

**Banking**
| Slug | Feature |
|------|---------|
| `connect-bank` | Connect a bank account |
| `sync-transactions` | Sync and categorise bank transactions |

**Reports**
| Slug | Feature |
|------|---------|
| `aged-receivables` | Aged receivables — chase outstanding invoices |
| `aged-payables` | Aged payables — monitor what you owe |
| `general-ledger` | General ledger — full transaction history |
| `cash-flow` | Cash flow statement |
| `kpi-dashboard` | KPI dashboard — key business metrics |
| `health-score` | Financial health score — what it means |
| `custom-report` | Build a custom report |

**Multi-Entity & Access Control**
| Slug | Feature |
|------|---------|
| `multi-entity` | Create and switch between organisations |
| `accountant-access` | Invite your accountant, manage permissions |
| `period-lock` | Lock a period to prevent back-dating |

**Settings & Compliance**
| Slug | Feature |
|------|---------|
| `company-settings` | Update company name, address, VAT number, financial year |
| `audit-log` | View the audit log |

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

## Article Automation (not yet built)

**Goal**: Keep articles accurate as 22accounting evolves — automatically detect
when app behaviour changes and update the relevant MDX.

**Planned implementation**: `scripts/update-help-articles.ts` at monorepo root

```
1. Read all MDX files in apps/26help/content/
2. Run MCP test suite: cd /opt/infra/mcp/22accounting-mcp && python3 run_tests.py
3. Call Claude API (claude-sonnet-4-6) with:
     - existing article content
     - MCP test output (proves current behaviour)
     - git diff of recent app changes (context for what changed)
4. Write updated MDX back to disk (preserve frontmatter, update body only)
5. Rebuild and redeploy 26help
```

**Trigger options** (implement both):
- Weekly cron: `0 9 * * 1` — catches drift even without a deploy
- Post-deploy hook: run after every successful 22accounting rebuild

**Log**: `/var/log/help-articles.log`

This is a separate task — implement after videos are done and all articles exist.

---

## Other Product Categories (future)

The same article + video requirement applies to each product when launched:

| Category | Status |
|----------|--------|
| `accounting` | 20/~35 articles written — see above |
| `crm` | Placeholder articles exist — need full coverage when 25crm launches |
| `reminders` | Placeholder articles exist — need full coverage when 24reminders launches |
| `api` | Placeholder articles exist — needs developer-focused coverage |
| `migration` | Placeholder articles exist — needs coverage for CSV import, data migration flows |
