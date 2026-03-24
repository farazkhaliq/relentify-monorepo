# Relentify Login - Gemini Context

This is the project context for Gemini.

## Project Overview
Central authentication and application portal for the Relentify ecosystem.

## Build & Deployment
- **Port:** 3000 (Internal), 3010 (Host - assumed from common practice, will check)
- **Domain:** login.relentify.com
- **Deployment:** Docker container (`relentify-login`) on `infra_default` network.

## Database
- PostgreSQL (shared with other apps in the ecosystem).
- Table `app_access` manages user access to apps (accounts, inventory, crm).

## Key Files
- `src/app/portal/page.tsx`: Application list display.
- `.env`: Database connection and app URLs.
- `lib/db.ts`: PostgreSQL connection pool.
- `lib/auth.ts`: Authentication logic.

THE GOLD STANDARD: Structural Hierarchy
Rule of Origin: If a component or style exists in @relentify/ui, it is forbidden to exist within this repository.

Directory | Enforcement Protocol
-- | --
/src/app | Application Domain: Routes and business logic only. No primitive UI definitions.
/src/components/layout | Layout Integration: Must consume <NavShell />, <ThemeProvider />, and <RegionProvider /> from @relentify/ui. No local Sidebar/TopBar logic.
/src/components/ui | The Exclusion Zone: This folder must be EMPTY of any atoms (Buttons, Inputs, Cards). Local components here are only permitted if they are complex, app-specific organisms that cannot be found in the UI inventory.
/src/hooks | State Consumption: Use @relentify/ui hooks. Local hooks are only for unique app-specific data fetching.
/src/styles | The Bridge: globals.css must only contain an @import of the UI stylesheet and app-specific overrides. Zero hardcoded hex/px values.

🎨 THE TOKEN MAP: Design DNA
Absolute Enforcement: Any value not derived from these CSS variables is a migration failure.
Color Palette: --theme-primary, --theme-accent, --theme-background, --theme-card, --theme-border, --theme-text.
Shadows: .shadow-cinematic (Must be inherited via the UI global CSS). Manual Tailwind shadows (e.g., shadow-xl) are illegal.
Geometry: .rounded-cinematic. Manual radii (e.g., rounded-2xl) are illegal.
Surfaces: .glass-panel. Manual backdrop-blurs are illegal.
Typography: Inter (Sans), JetBrains Mono (Mono), Playfair Display (Serif).

🛠️ THE FUNCTIONAL BLUEPRINT
1. The "Consumer" Protocol (No Local Shadows)
Dependency Rule: package.json must list @relentify/ui.
Deletion Rule: Before any code change, the AI must search for local files that duplicate UI atoms. Action: Delete local file -> Update Import to @relentify/ui.
Entry Point Rule: main.tsx or layout.tsx must import @relentify/ui/dist/styles.css (or the package equivalent). If styles are missing, fix the import; do not recreate the CSS locally.

2. Strict Hardcoding Lockdown
To achieve a "Perfect Mirror," the following replacements are non-negotiable:
Zero Hex/RGBA: All color classes must use CSS variables.
Wrong: bg-[#10B981] or bg-green-500.
Right: bg-[var(--theme-accent)].
Zero Arbitrary Spacing: No p-[20px]. Use standard Tailwind spacing scale or UI defined variables.

Class Replacement Table:
shadow-sm/md/lg/xl/2xl $\rightarrow$ shadow-cinematic
rounded-lg/xl/2xl/3xl $\rightarrow$ rounded-cinematic
bg-white/bg-black $\rightarrow$ bg-[var(--theme-background)] or bg-[var(--theme-card)]

3. The Forensic Verification Step
Grep Audit: Search for relentify-ui (v1). Any match = FAILED.
Collision Audit: If src/components/ui/Button.tsx exists = FAILED.
Hardcode Audit: If any .tsx contains # or px (outside of rare SVGs) = FAILED.

---
## COMPLIANCE AUDIT STATUS: CLEAN [2026-03-13]
✅ **Task 1: Exclusion Zone** - /src/components/ui is EMPTY. No local atoms found.
✅ **Task 2: Inheritance** - /app moved to /src/app. globals.css correctly imports @relentify/ui.
✅ **Task 3: Hardcode Purge** - All hex codes, px values, and manual shadows (shadow-xl, shadow-inner, etc.) or radii (rounded-2xl) have been purged and replaced with design tokens.
