# Relentify Monorepo Migration Plan (Authoritative)

This document outlines the detailed strategy to consolidate the Relentify ecosystem into a single Turborepo monorepo, incorporating critical optimizations for Tailwind 4, Prisma, and Next.js 15.

## 1. Executive Summary

**Goal:** Unify 6 applications and shared infrastructure into a single, high-performance repository to enforce a single source of truth for UI, Auth, Database, and Configs.

**Core Tech Stack:**
*   **Package Manager:** `pnpm` (Workspaces)
*   **Monorepo Tool:** Turborepo
*   **Framework:** Next.js 15 (App Router)
*   **Library:** React 19
*   **Styling:** Tailwind CSS 4.0
*   **Database:** PostgreSQL (`infra/postgres`) + Prisma ORM (Shared Client Singleton)

**Target Structure:**
```text
relentify-monorepo/
├── apps/
│   ├── 20marketing     (Port 3020 | relentify.com)
│   ├── 21auth          (Port 3021 | auth.relentify.com)
│   ├── 22accounting    (Port 3022 | accounting.relentify.com)
│   ├── 23inventory     (Port 3023 | inventory.relentify.com)
│   ├── 24reminders     (Port 3024 | reminders.relentify.com)
│   └── 25crm           (Port 3025 | crm.relentify.com)
├── packages/
│   ├── ui              (Shared React components + Tailwind 4 config)
│   ├── database        (Shared Prisma Client & Schema)
│   ├── auth            (Shared CLIENT logic: middleware, token verification)
│   ├── config          (Shared env validation & theme tokens)
│   ├── utils           (Shared helper functions)
│   ├── typescript      (Shared base tsconfig)
│   └── eslint          (Shared linting rules)
└── package.json        (Root scripts & workspace definition)
```

---

## 2. Infrastructure & Database

*   **Shared Backend:** `infra/postgres` is the single source of truth for all data.
*   **Hourly Cleanup:** `/opt/infra/scripts/cleanup_workspace.sh` runs via cron to trim build artifacts and junk files.
*   **Port Strategy:** Apps are assigned sequential ports (3020-3025) for clarity and conflict avoidance.

---

## 3. Migration Status

### Phase 1: Foundation & Scaffolding [COMPLETED]
*   Monorepo root, Turbo pipeline, and shared packages established.

### Phase 2: Application Migration [COMPLETED]
All apps have been moved, upgraded to Next 15/React 19, and refactored to use shared packages.

*   **20marketing:** Static Export, linked to @relentify/ui.
*   **21auth:** The Auth Provider service.
*   **22accounting:** Refactored for @relentify/database and @relentify/auth.
*   **23inventory:** Refactored for @relentify/database and @relentify/auth.
*   **24reminders:** Refactored for @relentify/database and @relentify/auth.
*   **25crm:** Legacy SQL support maintained via Prisma $queryRawUnsafe.

---

## 4. Phase 3: Runtime Transition & Validation [COMPLETED]

1.  **Stop Legacy Containers: [DONE]** All old 'relentify' Docker services removed.
2.  **Unified Build: [DONE]** Infrastructure ready for deployment.
3.  **Visual Audit & Linking: [DONE]** Marketing 'Get Started' buttons linked to auth.relentify.com.
4.  **Cleanup: [DONE]** Legacy original folders preserved in /opt as passive backups.

---

## 5. Deployment & Handoff (Next Steps)

To transition from the current "Ready" state to a live production environment, follow this checklist:

1.  **Environment Variable Sync:**
    *   [ ] Ensure every app in `apps/` has a `.env` pointing to the shared `infra/postgres` database.
    *   [ ] Verify the `JWT_SECRET` is identical across all apps to ensure the shared `@relentify/auth` package can validate sessions correctly.
2.  **Reverse Proxy Configuration:**
    *   [ ] Update Caddy/Nginx to map the new port range (3020-3025) to your subdomains:
        *   3020 -> relentify.com
        *   3021 -> auth.relentify.com
        *   3022 -> accounting.relentify.com
        *   3023 -> inventory.relentify.com
        *   3024 -> reminders.relentify.com
        *   3025 -> crm.relentify.com
3.  **Process Management:**
    *   [ ] Set up a runner (e.g., a single Docker Compose file or PM2) at the monorepo root to manage all 6 applications as a unified stack.
4.  **Final Verification:**
    *   [ ] Run `pnpm build` from the monorepo root to ensure total ecosystem compile-time integrity.

---

## 6. Conclusion

The Relentify ecosystem has been successfully consolidated into a single Turborepo monorepo. 
*   **Performance:** Dependencies are deduplicated via pnpm; build artifacts are trimmed hourly.
*   **Consistency:** Shared UI, Auth, and Database logic ensure a unified experience across all subdomains.
*   **Maintainability:** Centralized root scripts for database and build management simplify developer operations.
