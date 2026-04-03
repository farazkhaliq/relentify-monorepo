# 20marketing Vite → Next.js Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 20marketing Vite SPA to Next.js App Router, replacing the local Navbar/ThemeSwitcher with the shared `TopBar` from `@relentify/ui`, so all Relentify apps share identical navigation.

**Architecture:** Next.js 15 App Router with `'use client'` pages (all pages use hooks like `useTheme`, `useRegion`, framer-motion). Root layout provides `ThemeProvider` + `RegionProvider` from `@relentify/ui`. Shared `TopBar` replaces local `Navbar`. Local `Footer` stays (marketing-specific). Static export NOT used — server runs as standalone Node.js (same Docker pattern as other apps).

**Tech Stack:** Next.js 15, `@relentify/ui` (TopBar, ThemeProvider, RegionProvider, useTheme, useRegion), Tailwind v4, framer-motion (motion), gsap (Home only), lucide-react, posthog-js, @sentry/react.

**Current state:** Vite + React Router SPA, 16 routes, ~4000 LOC, all pages are client-side rendered with no data fetching (except one IP geolocation call for region detection).

---

## File Structure (what changes)

### Files to CREATE (Next.js app structure)

```
apps/20marketing/
├── app/
│   ├── layout.tsx                    # Root layout — ThemeProvider, RegionProvider, TopBar, Footer, analytics
│   ├── globals.css                   # Copied from src/styles/globals.css
│   ├── page.tsx                      # Home (wraps existing Home.tsx as client component)
│   ├── accounting/page.tsx
│   ├── inventory/page.tsx
│   ├── crm/page.tsx
│   ├── reminders/page.tsx
│   ├── timesheets/page.tsx
│   ├── esign/page.tsx
│   ├── payroll/page.tsx
│   ├── blog/page.tsx
│   ├── privacy/page.tsx
│   ├── alternatives/page.tsx
│   ├── xero-alternative/page.tsx
│   ├── xero-v-relentify/page.tsx
│   ├── quickbooks-alternative/page.tsx
│   ├── quickbooks-v-relentify/page.tsx
│   ├── components/
│   │   ├── RegionSwitcher.tsx        # Extracted from old Navbar — region dropdown, 'use client'
│   │   ├── Footer.tsx                # Migrated from src/app/components/Footer.tsx
│   │   ├── Logo.tsx                  # Migrated from src/app/components/Logo.tsx
│   │   ├── CookieBanner.tsx          # Migrated from src/app/components/CookieBanner.tsx
│   │   ├── Analytics.tsx             # Combined GA + PostHog, 'use client'
│   │   └── ChatWidget.tsx            # Chatwoot script loader, 'use client'
│   └── lib/
│       └── themes.ts                 # Migrated from src/app/themes.ts (until moved to @relentify/ui)
├── next.config.js                    # output: 'standalone', transpilePackages
├── postcss.config.js                 # @tailwindcss/postcss
├── Dockerfile                        # Rewritten for Next.js standalone (same pattern as 22accounting)
├── docker-compose.yml                # Updated
├── package.json                      # Updated dependencies
├── tsconfig.json                     # Updated for Next.js
└── public/
    └── favicon.svg                   # Keep as-is
```

### Files to DELETE (old Vite structure)

```
src/                                  # Entire directory (after migration verified)
├── app/App.tsx                       # Replaced by app/layout.tsx
├── app/main.tsx                      # Not needed in Next.js
├── app/themes.ts                     # Moved to app/lib/themes.ts
├── app/lib/utils.ts                  # Use from @relentify/ui
├── app/components/Navbar.tsx          # Replaced by shared TopBar
├── app/components/ThemeSwitcher.tsx   # Built into TopBar
├── app/components/Footer.tsx          # Moved to app/components/Footer.tsx
├── app/components/Logo.tsx            # Moved to app/components/Logo.tsx
├── app/components/CookieBanner.tsx    # Moved to app/components/CookieBanner.tsx
├── app/components/GoogleAnalytics.tsx # Merged into Analytics.tsx
├── app/components/PostHogAnalytics.tsx # Merged into Analytics.tsx
├── app/pages/*.tsx                   # Each moved to app/<route>/page.tsx
├── styles/globals.css                # Moved to app/globals.css
└── styles/themes.ts                  # Duplicate, deleted
index.html                            # Replaced by Next.js layout
vite.config.ts                        # Replaced by next.config.js
nginx.conf                            # Not needed (Next.js serves itself)
```

### Key migration patterns

Every page component currently does:
```tsx
// OLD (Vite)
import { useTheme, useRegion, formatPrice } from '../App';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
```

Becomes:
```tsx
// NEW (Next.js)
'use client';
import { useTheme, useRegion } from '@relentify/ui';
import { cn, formatPrice } from '@relentify/ui';
import Link from 'next/link';
```

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: `apps/20marketing/next.config.js`
- Create: `apps/20marketing/postcss.config.js`
- Create: `apps/20marketing/tsconfig.json` (overwrite)
- Modify: `apps/20marketing/package.json`

- [ ] **Step 1: Update package.json**

Replace Vite dependencies with Next.js. Keep all existing runtime deps (motion, gsap, lucide-react, etc).

```json
{
  "name": "marketing",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3020",
    "build": "next build",
    "start": "next start --port 3020"
  },
  "dependencies": {
    "@relentify/ui": "workspace:*",
    "@sentry/react": "^10.47.0",
    "clsx": "^2.1.1",
    "framer-motion": "^11.18.2",
    "gsap": "^3.14.2",
    "lucide-react": "^0.400.0",
    "motion": "^11.18.2",
    "next": "15.3.1",
    "posthog-js": "^1.363.1",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.1",
    "@types/react": "^19.2.14",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.9.3"
  }
}
```

Note: `react-router-dom` removed. `@relentify/ui` added. `next` added.

- [ ] **Step 2: Create next.config.js**

```js
const path = require('path')
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@relentify/ui'],
}
module.exports = nextConfig
```

- [ ] **Step 3: Create postcss.config.js**

```js
module.exports = {
  plugins: { '@tailwindcss/postcss': {} },
}
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "src"]
}
```

- [ ] **Step 5: Run pnpm install from monorepo root**

```bash
cd /opt/relentify-monorepo && pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add apps/20marketing/package.json apps/20marketing/next.config.js apps/20marketing/postcss.config.js apps/20marketing/tsconfig.json
git commit -m "[20marketing] scaffold Next.js project structure"
```

---

## Task 2: Create root layout with shared TopBar

**Files:**
- Create: `apps/20marketing/app/layout.tsx`
- Create: `apps/20marketing/app/globals.css`
- Create: `apps/20marketing/app/lib/themes.ts`
- Create: `apps/20marketing/app/components/RegionSwitcher.tsx`
- Create: `apps/20marketing/app/components/Logo.tsx`
- Create: `apps/20marketing/app/components/Footer.tsx`
- Create: `apps/20marketing/app/components/Analytics.tsx`
- Create: `apps/20marketing/app/components/ChatWidget.tsx`
- Create: `apps/20marketing/app/components/CookieBanner.tsx`

- [ ] **Step 1: Copy globals.css**

```bash
cp apps/20marketing/src/styles/globals.css apps/20marketing/app/globals.css
```

- [ ] **Step 2: Copy themes.ts**

```bash
mkdir -p apps/20marketing/app/lib
cp apps/20marketing/src/app/themes.ts apps/20marketing/app/lib/themes.ts
```

- [ ] **Step 3: Create Logo.tsx**

Copy from `src/app/components/Logo.tsx`, add `'use client'` directive. Keep unchanged — it's a pure SVG component that accepts `className`.

- [ ] **Step 4: Create RegionSwitcher.tsx**

Extract the region dropdown from the old Navbar.tsx into a standalone `'use client'` component. It uses `useRegion` from `@relentify/ui` (which must match the local hook signature — verify `setRegion` and `region` are available). If `@relentify/ui`'s `useRegion` doesn't expose `setRegion`, use the local themes.ts version and wire it into a local context in layout.tsx.

The RegionSwitcher renders:
- Current flag icon + region code
- Dropdown on hover with all 6 regions (UK, USA, Canada, Australia, NZ, EU)
- Each option shows flag + name
- Clicking sets the region via `setRegion()`

This component is passed to the TopBar's `navLinks` slot (after the Apps dropdown).

- [ ] **Step 5: Create Footer.tsx**

Copy from `src/app/components/Footer.tsx`, add `'use client'` directive. Change all `<Link to="...">` to `<Link href="...">` (Next.js Link). Change `import { Link } from 'react-router-dom'` to `import Link from 'next/link'`. Change `import { useTheme } from '../App'` to `import { useTheme } from '@relentify/ui'`.

- [ ] **Step 6: Create Analytics.tsx**

Combine GoogleAnalytics.tsx and PostHogAnalytics.tsx into one `'use client'` component. Change `import.meta.env.VITE_*` to `process.env.NEXT_PUBLIC_*`. Use Next.js `<Script>` component for GA. PostHog initialises in useEffect as before.

- [ ] **Step 7: Create ChatWidget.tsx**

`'use client'` component that loads the Chatwoot SDK script. Move the inline script from `index.html` into a useEffect.

```tsx
'use client';
import { useEffect } from 'react';

export default function ChatWidget() {
  useEffect(() => {
    (window as any).chatwootSettings = {
      position: 'right',
      type: 'expanded_bubble',
      launcherTitle: 'Chat with us',
      showPopoutButton: false,
      darkMode: 'auto',
    };
    const s = document.createElement('script');
    s.src = 'https://chat.relentify.com/packs/js/sdk.js';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      (window as any).chatwootSDK?.run({
        websiteToken: 'ca9Jcc8BiJQD68gdgCyYPqKA',
        baseUrl: 'https://chat.relentify.com',
      });
    };
    document.head.appendChild(s);
    return () => { document.head.removeChild(s); };
  }, []);
  return null;
}
```

- [ ] **Step 8: Create CookieBanner.tsx**

Copy from `src/app/components/CookieBanner.tsx`, add `'use client'` directive. Change `import { useTheme } from '../App'` to `import { useTheme } from '@relentify/ui'`.

- [ ] **Step 9: Create root layout.tsx**

This is the key file. It replaces `App.tsx` + `index.html`:

```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { THEME_SCRIPT, ThemeProvider } from '@relentify/ui';
// RegionProvider may need to come from local context if @relentify/ui's
// doesn't support the marketing-specific region features
import { TopBar, TopBarLink, TopBarDropdown, Logo } from '@relentify/ui';
import Footer from './components/Footer';
import Analytics from './components/Analytics';
import ChatWidget from './components/ChatWidget';
import CookieBanner from './components/CookieBanner';
import RegionSwitcher from './components/RegionSwitcher';

export const metadata: Metadata = {
  title: 'Relentify — Business Software Built for Growth',
  description: 'Accounting, property inventories, CRM, and more. Built for small businesses.',
  // ... SEO metadata from old App.tsx
};

const appItems = [
  { label: 'Accounting', href: '/accounting' },
  { label: 'Property Inventories', href: '/inventory' },
  { label: 'CRM', href: '/crm' },
  { label: 'Reminders', href: '/reminders' },
  { label: 'Timesheets', href: '/timesheets' },
  { label: 'E-Sign', href: '/esign' },
  { label: 'Payroll & HR', href: '/payroll' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider initialPreset="B">
          {/* TopBar — shared with all other Relentify apps */}
          <header>
            <TopBar
              logo={
                <a href="/" className="no-underline flex items-center gap-3 text-xl font-bold tracking-tighter text-[var(--theme-text)]">
                  <Logo className="w-6 h-6" />
                  <span>RELENTIFY</span>
                </a>
              }
              navLinks={
                <>
                  <TopBarDropdown label="Apps" items={appItems} />
                  <TopBarLink href="/blog">Blog</TopBarLink>
                  <RegionSwitcher />
                </>
              }
            >
              {/* Right side: Login link (TopBar auto-includes dark mode toggle) */}
              <a
                href="https://auth.relentify.com/login?redirect=https://relentify.com/portal"
                className="text-xs font-bold uppercase tracking-widest text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-all no-underline"
              >
                Login
              </a>
            </TopBar>
          </header>

          <main className="pt-24">
            {children}
          </main>

          <Footer />

          <Suspense>
            <Analytics />
          </Suspense>
          <ChatWidget />
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Key decisions:**
- TopBar from `@relentify/ui` replaces local Navbar — dark mode toggle is built in
- Apps dropdown uses `TopBarDropdown` (matches CRM, accounting, etc.)
- RegionSwitcher is a custom marketing component passed as a navLink
- "Contact" nav link removed — Chatwoot bubble replaces it
- Login link passed as TopBar children (right side)
- `ThemeProvider` with `initialPreset="B"` (emerald green)

- [ ] **Step 10: Verify layout renders**

```bash
cd apps/20marketing && npx next dev --port 3020
```

Visit `http://localhost:3020` — should see the TopBar with RELENTIFY logo, Apps dropdown, Blog link, region switcher, dark mode toggle, and Login. Page content will be empty until pages are migrated.

- [ ] **Step 11: Commit**

```bash
git add apps/20marketing/app/
git commit -m "[20marketing] create Next.js root layout with shared TopBar"
```

---

## Task 3: Migrate pages

Each page follows the same pattern:
1. Copy from `src/app/pages/X.tsx` to `app/<route>/page.tsx`
2. Add `'use client'` directive
3. Change imports:
   - `from '../App'` → `from '@relentify/ui'`
   - `from '../lib/utils'` → `from '@relentify/ui'`
   - `from 'react-router-dom'` → `from 'next/link'`
   - `<Link to="...">` → `<Link href="...">`
4. Wrap in `export default function Page()` if not already

**Files (16 pages):**

| Source | Destination |
|--------|------------|
| `src/app/pages/Home.tsx` | `app/page.tsx` |
| `src/app/pages/Accounting.tsx` | `app/accounting/page.tsx` |
| `src/app/pages/Inventory.tsx` | `app/inventory/page.tsx` |
| `src/app/pages/CRM.tsx` | `app/crm/page.tsx` |
| `src/app/pages/Reminders.tsx` | `app/reminders/page.tsx` |
| `src/app/pages/Timesheets.tsx` | `app/timesheets/page.tsx` |
| `src/app/pages/ESign.tsx` | `app/esign/page.tsx` |
| `src/app/pages/Payroll.tsx` | `app/payroll/page.tsx` |
| `src/app/pages/Blog.tsx` | `app/blog/page.tsx` |
| `src/app/pages/Privacy.tsx` | `app/privacy/page.tsx` |
| `src/app/pages/alternatives/AlternativesHub.tsx` | `app/alternatives/page.tsx` |
| `src/app/pages/alternatives/XeroAlternative.tsx` | `app/xero-alternative/page.tsx` |
| `src/app/pages/alternatives/XeroVsRelentify.tsx` | `app/xero-v-relentify/page.tsx` |
| `src/app/pages/alternatives/QuickBooksAlternative.tsx` | `app/quickbooks-alternative/page.tsx` |
| `src/app/pages/alternatives/QuickBooksVsRelentify.tsx` | `app/quickbooks-v-relentify/page.tsx` |

- [ ] **Step 1: Create route directories**

```bash
cd apps/20marketing
mkdir -p app/{accounting,inventory,crm,reminders,timesheets,esign,payroll,blog,privacy,alternatives,xero-alternative,xero-v-relentify,quickbooks-alternative,quickbooks-v-relentify}
```

- [ ] **Step 2: Migrate Home.tsx → app/page.tsx**

This is the largest page (579 lines). Special considerations:
- Uses `gsap` + `ScrollTrigger` — must be client-side only
- Has `openChat()` function that calls `$chatwoot.toggle()` — keep as-is
- Uses `useRef`, `useState`, `useEffect` — all fine in `'use client'`

Copy the file, add `'use client'`, do the import replacements:
```bash
cp src/app/pages/Home.tsx app/page.tsx
```

Then edit `app/page.tsx`:
- Line 1: Add `'use client';`
- Change: `import { useTheme, useRegion, formatPrice } from '../App';` → `import { useTheme, useRegion, formatPrice } from '@relentify/ui';`
- Change: `import { cn } from '../lib/utils';` → `import { cn } from '@relentify/ui';`
- Change: `import { Link } from 'react-router-dom';` → `import Link from 'next/link';`
- Change all: `<Link to="` → `<Link href="`
- Rename export if needed: `export default function Home()` → `export default function Page()` (or keep name, Next.js accepts any default export)

- [ ] **Step 3: Migrate remaining 15 pages**

Apply the same 5-line import pattern to each. Most pages are simpler than Home (no gsap, no special hooks). Use a script or do manually:

For each page file, the changes are identical:
1. Add `'use client';` as first line
2. `from '../App'` → `from '@relentify/ui'`
3. `from '../lib/utils'` → `from '@relentify/ui'`
4. `from 'react-router-dom'` → `from 'next/link'`
5. `<Link to=` → `<Link href=`
6. For alternatives pages: `from '../../App'` → `from '@relentify/ui'` (they're one level deeper)

- [ ] **Step 4: Verify all pages load**

```bash
cd apps/20marketing && npx next dev --port 3020
```

Visit each route manually:
- `http://localhost:3020/` (Home)
- `http://localhost:3020/accounting`
- `http://localhost:3020/inventory`
- etc.

Check console for errors. Common issues:
- Missing `formatPrice` export from `@relentify/ui` — verify it's exported
- `useRegion` hook signature mismatch — verify `setRegion` is available
- gsap SSR errors on Home — should be fine with `'use client'` but check

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "[20marketing] migrate all 16 pages to Next.js App Router"
```

---

## Task 4: Environment variables

**Files:**
- Create: `apps/20marketing/.env` (or `.env.local`)

- [ ] **Step 1: Create .env with Next.js naming**

Vite uses `VITE_*`, Next.js uses `NEXT_PUBLIC_*` for client-side vars:

```env
NEXT_PUBLIC_SENTRY_DSN=<from current .env>
NEXT_PUBLIC_GA_MEASUREMENT_ID=<from current .env>
NEXT_PUBLIC_POSTHOG_KEY=<from current .env>
NEXT_PUBLIC_POSTHOG_HOST=<from current .env>
```

- [ ] **Step 2: Update Analytics.tsx references**

In `app/components/Analytics.tsx`, ensure all `import.meta.env.VITE_*` references are changed to `process.env.NEXT_PUBLIC_*`.

- [ ] **Step 3: Commit**

```bash
git add apps/20marketing/.env
git commit -m "[20marketing] add Next.js environment variables"
```

---

## Task 5: Dockerfile + Docker Compose

**Files:**
- Rewrite: `apps/20marketing/Dockerfile`
- Modify: `apps/20marketing/docker-compose.yml`
- Delete: `apps/20marketing/nginx.conf`

- [ ] **Step 1: Rewrite Dockerfile**

Follow the monorepo Next.js Docker pattern from CLAUDE.md. Key change: no more nginx — Next.js standalone server.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune marketing --docker

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
COPY --from=deps /app/apps/20marketing/node_modules ./apps/20marketing/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
WORKDIR /app/apps/20marketing
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/20marketing/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/20marketing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/20marketing/.next/static ./apps/20marketing/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/20marketing/server.js"]
```

- [ ] **Step 2: Update docker-compose.yml**

Change health check from nginx wget to Next.js:

```yaml
services:
  web:
    build:
      context: ../../
      dockerfile: apps/20marketing/Dockerfile
    container_name: 20marketing
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 384M
    env_file:
      - .env
    expose:
      - 3000
    networks:
      - infra_default
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:3000/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  infra_default:
    name: infra_default
    external: true
```

Note: Port mapping removed (Caddy handles routing). Memory bumped to 384M (Next.js uses more than nginx).

- [ ] **Step 3: Delete nginx.conf**

```bash
rm apps/20marketing/nginx.conf
```

- [ ] **Step 4: Commit**

```bash
git add apps/20marketing/Dockerfile apps/20marketing/docker-compose.yml
git rm apps/20marketing/nginx.conf
git commit -m "[20marketing] rewrite Docker for Next.js standalone"
```

---

## Task 6: Build, test, deploy

- [ ] **Step 1: Run pnpm install from monorepo root**

```bash
cd /opt/relentify-monorepo && pnpm install
```

- [ ] **Step 2: Test local build**

```bash
cd apps/20marketing && pnpm build
```

Fix any build errors. Common issues:
- Missing exports from `@relentify/ui` (formatPrice, cn, useRegion)
- TypeScript errors from import changes
- gsap SSR issues (should be fine with 'use client')

- [ ] **Step 3: Docker build**

```bash
cd /opt/relentify-monorepo/apps/20marketing
docker compose down
docker compose build --no-cache
```

- [ ] **Step 4: Deploy**

```bash
docker compose up -d
docker logs 20marketing --tail 50
```

- [ ] **Step 5: Verify live site**

Check `https://relentify.com`:
- TopBar renders with shared design (floating pill, glass blur)
- Apps dropdown works
- Region switcher works
- Dark mode toggle in navbar works
- All 16 routes load correctly
- Chatwoot widget appears
- Mobile responsive (hamburger menu)

- [ ] **Step 6: Clean up old Vite files**

Once everything is verified working:

```bash
rm -rf apps/20marketing/src
rm apps/20marketing/vite.config.ts
rm apps/20marketing/index.html
```

- [ ] **Step 7: Final commit**

```bash
git add -A apps/20marketing/
git commit -m "[20marketing] complete Vite to Next.js migration — shared TopBar unified"
```

---

## Task 7: Update documentation

- [ ] **Step 1: Update apps/20marketing/CLAUDE.md**

Change references from Vite to Next.js, update file structure, remove React Router references.

- [ ] **Step 2: Update /opt/relentify-monorepo/CLAUDE.md**

Change the app table entry from "Vite + React Router" to "Next.js App Router". Update the Docker rebuild pattern if needed.

- [ ] **Step 3: Commit**

```bash
git add apps/20marketing/CLAUDE.md CLAUDE.md
git commit -m "[20marketing] update docs for Next.js migration"
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `@relentify/ui` missing `formatPrice`/`useRegion`/`cn` exports | Check exports first; if missing, add them or keep local copies temporarily |
| gsap SSR crash on Home page | `'use client'` directive prevents SSR; gsap loads client-side only |
| Theme injection timing (CSS vars set by JS) | `THEME_SCRIPT` runs before React hydration — same pattern as 22accounting |
| Chatwoot widget double-loads | Single `ChatWidget` component in layout, not in `index.html` |
| Build cache bloat on VPS | `docker builder prune -f` after build |
| Memory increase (Next.js > nginx) | Bumped to 384M limit (from 256M) |

## Verification checklist

- [ ] TopBar matches other apps (floating pill, glass blur, dark toggle right side)
- [ ] All 16 routes return 200
- [ ] Dark mode toggle works
- [ ] Region switcher works (prices change)
- [ ] Chatwoot widget loads
- [ ] Mobile responsive (hamburger menu)
- [ ] No floating ThemeSwitcher button
- [ ] MCP tests pass (if any exist for 20marketing)
- [ ] `docker stats` shows 20marketing within 384M limit
