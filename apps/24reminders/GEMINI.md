# Relentify Reminders [AUDIT COMPLETE - 2026-03-13]

A high-performance task management and reminder app built for the Relentify ecosystem.

## Migration Status: COMPLIANT
- **Task 1 (The Exclusion Zone):** Verified. Local `/src/components/ui` is purged of atoms. Imports point to `@relentify/ui2`.
- **Task 2 (The Inheritance Check):** Verified. `/app` moved to `/src/app`. `globals.css` inherits from UI2 engine.
- **Task 3 (Hardcode Purge):** Verified. Zero-tolerance scan complete. Hardcoded hex/px replaced with token map variables. Manual shadows/radii replaced with `.shadow-cinematic` and `.rounded-cinematic`.

## Architecture
- **Next.js 14 App Router** (TypeScript)
- **PostgreSQL** (shared `relentify` DB)
- **Auth**: Shared JWT cookie (`relentify_token`) from `login.relentify.com`
- **UI**: Powered by `@relentify/ui` with cinematic dark-mode aesthetics

## Core Logic

### Tasks & Subtasks
- Tasks can be nested indefinitely.
- **Parent Logic**:
  - `due_date`: Derived from the latest due date of its subtasks.
  - `status`: Derived from subtasks (All Completed/Cancelled -> Completed; Any In Progress/Completed -> In Progress).
  - Parent tasks are effectively read-only "containers" for their subtasks.
- **Views**: Table (Excel-style), Kanban, Calendar, Gantt.

### Momentum Mode
- A distraction-free "one task at a time" view.
- Supports completion, snoozing, and skipping.
- **Gamification**:
  - +10 PTS per completed task.
  - Streaks for consecutive daily completions.
  - Badges and leaderboard (planned).

### Reminders
- Channels: Email and Telegram.
- Scalable notification scheduling in the `notifications` table.

## Database Schema
- `workspaces`: Multi-entity support.
- `lists`: Logical grouping of tasks within a workspace.
- `tasks`: Core task data with self-reference for subtasks.
- `task_dependencies`: Linking tasks for auto-adjustments.
- `notifications`: Queue for email/telegram reminders.
- `audit_log`: Full trail for "My Activity" and undo support.
- `gamification`: User scores and streaks.

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
