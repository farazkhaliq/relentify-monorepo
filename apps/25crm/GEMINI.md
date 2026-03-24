# Relentify CRM - Gemini Context

This is the project context for Gemini.

## Project Overview
Next.js 15 application for Estate Agency CRM, part of the Relentify ecosystem.

## Build & Deployment
- **Port:** 3000 (Internal), 3008 (Host)
- **Domain:** crm.relentify.com
- **Deployment:** Docker container (`relentify-crm`) on `infra_default` network.
- **Output:** Standalone mode enabled in `next.config.ts`.

## Core Technologies
- Next.js 15
- Tailwind CSS
- Firebase
- Lucide React
- Radix UI

## Key Files
- `next.config.ts`: Configuration for standalone output.
- `docker-compose.yml`: Docker setup.
- `src/firebase/config.ts`: Firebase configuration.
- `src/app/globals.css`: Styling.

## THE GOLD STANDARD

### 📂 Folder Map
- `/src/components/layout`: Core application scaffolding.
  - `Sidebar.tsx`, `TopBar.tsx`, `Footer.tsx`, `NavShell.tsx`, `ThemeProvider.tsx`, `RegionProvider.tsx`, `ScrollToTop.tsx`
- `/src/components/ui`: Atomic and Molecular UI components.
  - **Atoms**: `Button`, `Input`, `Select`, `Checkbox`, `Label`, `Badge`, `Logo`, `ThemeToggleButton`, `NoiseOverlay`
  - **Molecules**: `Card`, `Tabs`, `Dropdown`, `Popover`, `Toast`, `Command`, `UserMenu`, `TopBarSearch`, `SearchInput`
  - **Organisms**: `StatsCard`, `Table`, `SupplierCombobox`, `CustomerCombobox`, `FilterGroup`, `PageHeader`
- `/src/hooks`: Business and UI logic.
  - `useTheme.ts`, `useRegion.ts`
- `/src/lib`: Shared utilities.
  - `utils.ts` (Tailwind Merge / CLSX)
- `/src/styles`: Styling engine.
  - `globals.css` (Tailwind 4.0 CSS-first configuration)
  - `themes.ts` (Dynamic theme presets A-D)

### 🧱 Component Inventory
| Category | Components |
| :--- | :--- |
| **Navigation** | Sidebar, TopBar, NavShell, UserMenu, ScrollToTop |
| **Form** | Button, Input, Select, Checkbox, Label, SupplierCombobox, CustomerCombobox, SearchInput |
| **Data Display** | Table, StatsCard, Badge, Card, Tabs, PageHeader |
| **Feedback/Overlay** | Toast, Command, Popover, Dropdown, NoiseOverlay |
| **System** | ThemeProvider, RegionProvider, ThemeToggleButton, Logo |

### 🎨 The Token Map (Design DNA)
#### Colors (CSS Variables)
- `--theme-primary`: `#000000` (Core branding)
- `--theme-accent`: `#10B981` (Interactions/Emerald)
- `--theme-success`: `#10B981` (Success states)
- `--theme-warning`: `#F59E0B` (Warning states/Amber)
- `--theme-destructive`: `#EF4444` (Error states/Red)
- `--theme-background`: `#F8F9FB` (Light Cinematic) / `#000000` (Dark)
- `--theme-card`: `rgba(255, 255, 255, 0.9)` / `rgba(26, 26, 26, 0.6)`
- `--theme-border`: `rgba(0, 0, 0, 0.04)` / `rgba(255, 255, 255, 0.08)`
- `--theme-text`: `#000000` / `#FFFFFF`
- `--theme-text-muted`: `60% opacity`
- `--theme-text-dim`: `30-40% opacity`

#### Shadows & Effects
- `--shadow-cinematic`: Deep, soft multi-layered shadow (0 20px 50px).
- `.glass-panel`: `backdrop-filter: blur(64px)` with high-transparency borders.
- `.rounded-cinematic`: `rounded-[2rem]` (mobile) to `rounded-[3rem]` (desktop).

#### Typography
- **Sans**: `Inter`, ui-sans-serif.
- **Mono**: `JetBrains Mono`.
- **Specialty**: `Playfair Display` (Premium), `Space Grotesk` (Utility).

### 🛠️ Functional Blueprint

#### 1. Folder Logic (UI2 Source-of-Truth)
| Directory | The Folder's Job (Functional Evidence) | The Mirror Rule (App Implementation) |
| :--- | :--- | :--- |
| **`/layout`** | Orchestrates the global application frame, theme context, and regional settings. Handles the shell that wraps all pages and provides the standard `NavShell`. | Apps **MUST** replace local layout wrappers with `NavShell`. `app/layout.tsx` **MUST** be wrapped in `ThemeProvider`. |
| **`/ui`** | Provides reusable, stateless UI primitives (Atoms/Molecules) that strictly adhere to design tokens. | Local components **MUST** be deleted if they exist in UI2. All UI imports **MUST** point to `@relentify/ui2`. |
| **`/hooks`** | Exposes UI state (theme, region, navigation) and logic. Ensures state consistency across the ecosystem. | Apps **MUST** use these hooks (e.g., `useTheme`) for any UI-related logic. Local state for these is forbidden. |
| **`/styles`** | The engine for design tokens and Tailwind 4.0 CSS-first configuration. Defines the CSS variable system. | Apps **MUST** import UI2 `globals.css` and use the defined CSS variables. No local hex codes allowed. |
| **`/lib`** | Shared utilities (e.g., `cn` for Tailwind class merging). | Apps **MUST** use the UI2 `cn` utility for consistent class merging. |

#### 2. Hardcoding & Token Enforcement
To ensure a functionally identical migration to `relentify-ui2`, the following strict rules apply for "rooting out" hardcoded values:

- **Look & Feel Inheritance**:
  - **Colors**: Use `var(--theme-*)` variables for all colors (e.g., `text-[var(--theme-accent)]`). Never use hex codes like `#10B981`.
  - **Corners**: Apply `.rounded-cinematic` for all container corners (responsive 2rem to 3rem).
  - **Shadows**: Use `.shadow-cinematic` for deep, soft depth.
  - **Surfaces**: Use `.glass-panel` for translucent/blur effects.
  - **Motion**: Use `transition-all duration-700` for theme-aware transitions.
  - **Hover**: Use `.magnetic-btn` (scale-103) for interactive elements.

- **Import Discipline**:
  - Any local component found in `src/components/ui/` that is also in the `Component Inventory` above is considered **Technical Debt** and must be deleted immediately.

