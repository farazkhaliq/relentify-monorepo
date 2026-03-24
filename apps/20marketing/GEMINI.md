# Relentify Com2 - Gemini Context

This is the project context for Gemini.

## Project Overview
Next.js 15 application for the main Relentify website with "Cinematic SaaS" aesthetic.

## Build & Deployment
- **Port:** 3000 (Internal), 3009 (Host)
- **Domain:** com2.relentify.com
- **Deployment:** Docker container (`relentify-com2`) on `infra_default` network.
- **Server:** Custom `server.ts` using `express` and `vite` middleware.

## Core Technologies
- React 19
- Tailwind CSS 4
- Vite
- GSAP
- Motion
- Lucide React

## Key Files
- `server.ts`: Custom Express server.
- `vite.config.ts`: Vite configuration.
- `src/themes.ts`: Dynamic theme presets (A, B, C, D).
- `src/index.css`: Cinematic design system.

THE GOLD STANDARD: Structural Hierarchy
Rule of Origin: If a component or style exists in @relentify/ui2, it is forbidden to exist within this repository.

Directory | Enforcement Protocol
-- | --
/src/app | Application Domain: Routes and business logic only. No primitive UI definitions.
/src/components/layout | Layout Integration: Must consume <NavShell />, <ThemeProvider />, and <RegionProvider /> from @relentify/ui2. No local Sidebar/TopBar logic.
/src/components/ui | The Exclusion Zone: This folder must be EMPTY of any atoms (Buttons, Inputs, Cards). Local components here are only permitted if they are complex, app-specific organisms that cannot be found in the UI2 inventory.
/src/hooks | State Consumption: Use @relentify/ui2 hooks. Local hooks are only for unique app-specific data fetching.
/src/styles | The Bridge: globals.css must only contain an @import of the UI2 stylesheet and app-specific overrides. Zero hardcoded hex/px values.

🎨 THE TOKEN MAP: Design DNA
Absolute Enforcement: Any value not derived from these CSS variables is a migration failure.
Color Palette: --theme-primary, --theme-accent, --theme-background, --theme-card, --theme-border, --theme-text.
Shadows: .shadow-cinematic (Must be inherited via the UI2 global CSS). Manual Tailwind shadows (e.g., shadow-xl) are illegal.
Geometry: .rounded-cinematic. Manual radii (e.g., rounded-2xl) are illegal.
Surfaces: .glass-panel. Manual backdrop-blurs are illegal.
Typography: Inter (Sans), JetBrains Mono (Mono), Playfair Display (Serif).

🛠️ THE FUNCTIONAL BLUEPRINT
1. The "Consumer" Protocol (No Local Shadows)
Dependency Rule: package.json must list @relentify/ui2.
Deletion Rule: Before any code change, the AI must search for local files that duplicate UI2 atoms. Action: Delete local file -> Update Import to @relentify/ui2.
Entry Point Rule: main.tsx or layout.tsx must import @relentify/ui2/dist/styles.css (or the package equivalent). If styles are missing, fix the import; do not recreate the CSS locally.

2. Strict Hardcoding Lockdown
To achieve a "Perfect Mirror," the following replacements are non-negotiable:
Zero Hex/RGBA: All color classes must use CSS variables.
Wrong: bg-[#10B981] or bg-green-500.
Right: bg-[var(--theme-accent)].
Zero Arbitrary Spacing: No p-[20px]. Use standard Tailwind spacing scale or UI2 defined variables.

Class Replacement Table:
shadow-sm/md/lg/xl/2xl $\rightarrow$ shadow-cinematic
rounded-lg/xl/2xl/3xl $\rightarrow$ rounded-cinematic
bg-white/bg-black $\rightarrow$ bg-[var(--theme-background)] or bg-[var(--theme-card)]

3. The Forensic Verification Step
Grep Audit: Search for relentify-ui (v1). Any match = FAILED.
Collision Audit: If src/components/ui/Button.tsx exists = FAILED.
Hardcode Audit: If any .tsx contains # or px (outside of rare SVGs) = FAILED.
