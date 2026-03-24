# Relentify Monorepo Migration Plan

This document outlines the detailed, step-by-step strategy to consolidate the Relentify ecosystem into a single, high-performance Turborepo monorepo.

## 1. Executive Summary

**Goal:** Unify 6 applications and shared libraries into one repository to enforce a single source of truth for UI, Database, and Configs.

**Tech Stack Standardization:**
*   **Package Manager:** `pnpm` (Workspaces)
*   **Monorepo Tool:** Turborepo
*   **Framework:** Next.js 15 (App Router)
*   **Library:** React 19
*   **Styling:** Tailwind CSS 4.0
*   **Database:** PostgreSQL + Prisma ORM (Shared)

**Target Structure:**
```text
relentify-monorepo/
├── apps/
│   ├── login        (Auth provider)
│   ├── reminders    (Productivity app)
│   ├── inventory    (Asset management)
│   ├── accounts     (Invoicing & Users)
│   ├── marketing    (Public website)
│   └── crm          (Customer relationship + AI)
└── packages/
    ├── ui           (Shared React components + Tailwind 4 config)
    ├── database     (Shared Prisma Client & Schema)
    ├── typescript   (Shared base tsconfig)
    └── eslint       (Shared linting rules)
```

---

## 2. Detailed Migration Steps

### Phase 1: Foundation & Scaffolding
**Objective:** Create the empty vessel that will hold the apps.

1.  **Initialize Repository:**
    *   Create `relentify-monorepo` folder.
    *   Initialize `pnpm` workspace (`pnpm-workspace.yaml`).
    *   Initialize `turbo` (`turbo.json`).
    *   Install root dev dependencies: `turbo`, `prettier`, `typescript`, `eslint`.

2.  **Create Shared UI Package (`packages/ui`):**
    *   **Action:** Move `relentify-ui2` code to `packages/ui`.
    *   **Fix Dependency Hell:** Move `react`, `react-dom` to `peerDependencies` in `package.json`.
    *   **Fix Linking:** Ensure `package.json` name is `@relentify/ui`.
    *   **Tailwind 4 Setup:** Create `src/styles/globals.css` with `@import "tailwindcss";`.
    *   **Export Config:** Create `tailwind.config.ts` that exports the shared theme/content configuration.

3.  **Create Shared Database Package (`packages/database`):**
    *   **Action:** Create new package with `prisma` dependency.
    *   **Schema Consolidation:**
        *   Take `User`, `Account`, `Session` tables from `relentify-accounts` (SQL).
        *   Take `Inventory` tables from `relentify-inventory` (Prisma).
        *   Take `Task` tables from `relentify-reminders` (SQL).
        *   Merge into one `schema.prisma`.
    *   **Generate Client:** Configure `generator client` to output to `node_modules/@prisma/client`.
    *   **Export:** Export a singleton `db` instance from `src/client.ts`.

---

### Phase 2: Application Migration & Upgrades
**Objective:** Move apps one by one, upgrading them to the standard stack.

#### App 1: Login (`apps/login`)
*   **Move:** Copy `relentify-login` to `apps/login`.
*   **Upgrade:** Run `pnpm up next@latest react@latest react-dom@latest`.
*   **UI Connection:**
    *   Update `package.json`: Add `"@relentify/ui": "workspace:*"` and `"@relentify/database": "workspace:*"`.
    *   Update `next.config.js`: Add `transpilePackages: ["@relentify/ui"]`.
    *   Update `globals.css`: Import shared styles.
*   **Database:** Replace `pg` pool in `src/lib/db.ts` with `import { db } from '@relentify/database'`.

#### App 2: Inventory (`apps/inventory`)
*   **Move:** Copy `relentify-inventory` to `apps/inventory`.
*   **Upgrade:** Run `pnpm up next@latest react@latest`.
*   **Cleanup:** Delete local `prisma/` folder (it now lives in `packages/database`).
*   **Refactor:** Search/Replace local `prisma` imports with `@relentify/database`.
*   **UI Connection:** Same as Login (Transpile + Workspace Link).

#### App 3: Reminders (`apps/reminders`)
*   **Move:** Copy `relentify-reminders2` to `apps/reminders`.
*   **Upgrade:** Update to Next 15 / React 19.
*   **UI Connection:** Replace local UI components with imports from `@relentify/ui`.

#### App 4: Accounts (`apps/accounts`)
*   **Move:** Copy `relentify-accounts` to `apps/accounts`.
*   **Status:** Already on Next 15 / React 19.
*   **Database:** This app has complex SQL. We will map its raw queries to Prisma where possible, or use `db.$queryRaw` via the shared client for complex legacy queries.

#### App 5: Marketing (`apps/marketing`)
*   **Move:** Copy `relentify-com2` (Vite app) to `apps/marketing`.
*   **UI Connection:** Ensure Vite config can resolve the workspace package (may need `alias` config in `vite.config.ts`).

#### App 6: CRM (`apps/crm`) - *The Complex One*
*   **Move:** Copy `relentify-crm` to `apps/crm`.
*   **Upgrade:** It is already on Next 15.5.9.
*   **Tailwind Migration:**
    *   It currently uses Tailwind 3.
    *   **Action:** Uninstall `tailwindcss`, install `@tailwindcss/postcss` (v4).
    *   **Action:** Update CSS imports to use v4 syntax.
*   **Database:** It uses `pg` + `firebase`. We will replace `pg` with `@relentify/database`. Firebase logic remains local for now.
*   **UI Connection:** It has a local Shadcn UI folder. We will selectively replace components (Button, Input) with `@relentify/ui` equivalents to ensure visual consistency.

---

### Phase 3: Validation & Cleanup

1.  **Unified Build:** Run `pnpm build` from root.
    *   *Success Criteria:* All 6 apps build successfully in parallel.
2.  **Lint Check:** Run `pnpm lint`.
3.  **Visual Regression Test:**
    *   Launch `login` and `crm` locally.
    *   Verify they share the exact same button styles and font tokens.

## 3. Risks & Contingencies

*   **Risk:** `react-day-picker` or other UI libs in `crm` might conflict with React 19 or Tailwind 4.
    *   *Contingency:* We may need to use `pnpm.overrides` to force dependency versions, or temporarily keep `crm` on Tailwind 3 (though this breaks the "shared UI" goal).
*   **Risk:** Shared Database Schema becomes too large.
    *   *Contingency:* We can split the schema into multiple files (Prisma doesn't support this natively yet, but we can use tooling) or keep distinct schemas if domains are truly separate.

## 4. Next Steps
Upon approval, I will execute **Phase 1** (Foundation) immediately.
