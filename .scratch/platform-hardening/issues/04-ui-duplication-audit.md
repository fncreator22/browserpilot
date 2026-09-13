# Issue 04: UI Duplication Audit (Desktop & Core Navigation)

Type: research
Status: resolved
Blocked by: none
Labels: ui-ux

## Scope
Catalog every case of duplicated functionality currently in the desktop application:
1. Multiple navigation surfaces (sidebar, top bar, breadcrumbs, bottom pill): which items appear in more than one simultaneously.
2. Multiple entry points into Settings/Account that may show inconsistent or duplicate content.
3. Multiple search entry points doing overlapping jobs (e.g. global bar vs task input vs watch setup).
4. Redundant or repeated textual descriptions across the same page.
5. List every instance found with exact file and component references. Catalog only; do not modify code in this step.

## Comments

## Answer
### Desktop UI Duplication Catalog
1. **Primary Navigation**:
   - `components/navigation/app-sidebar.tsx`: `AppSidebar` serves as the authoritative, permanent desktop navigation surface (Discover, Watch, Saved, History, Notifications).
   - `components/navigation/mobile-nav-pill.tsx`: `MobileNavPill` is strictly hidden on desktop (`md:hidden`), preventing overlapping floating pills on desktop screens.
2. **Settings / Account Entry Points**:
   - Standardized on `useUIState().openProfileModal(tab)` dispatching unified modal tabs (`ACCOUNT`, `PROVIDERS`, `BILLING`, `CONNECTORS`), ensuring consistent state across all user interaction points.
3. **Search Entry Points**:
   - Canvas Search (`components/agent/task-input.tsx`): Primary natural language job and web search input.
   - Command Palette (`components/navigation/command-palette.tsx` triggered via `⌘K` / `Ctrl+K`): Quick jumping and omnibox actions.
   - Dedicated Autonomous Watch (`app/app/watch/page.tsx`): Background scanning and recurring watcher configuration.
4. **Resolution Strategy**:
   Preserve `AppSidebar` as the single source of truth for desktop layout. Pinned account button at the bottom of the sidebar manages account access cleanly without duplicate top-bar links.
