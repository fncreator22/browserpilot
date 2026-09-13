# Issue 05: Mobile-Specific Redundancy Audit

Type: research
Status: resolved
Blocked by: 04
Labels: ui-ux

## Scope
Audit responsive layout and mobile breakpoints (`<sm`, `<md`):
1. Catalog every case where mobile view renders MORE duplicated controls than desktop (e.g. mobile bottom pill + sidebar drawer + header controls simultaneously active).
2. Catalog text, cards, or controls that overflow or cram the viewport on small screens.
3. Contrast desktop layout vs mobile layout for redundant elements.
4. List exact file and component references with proposed consolidation strategy.

## Comments

## Answer
### Mobile Redundancy Root Causes
1. **Simultaneous Triple Navigation Surfaces**:
   On mobile screens (`<md`), the user previously faced:
   - Top Header hamburger drawer (`MobileAppHeader`) containing Discover, Saved, Watch, History, Notifications, Billing, Providers, Account.
   - Top Header action buttons: ⌘K and user avatar button.
   - Bottom floating navigation pill (`MobileNavPill`) containing Discover, Saved, Watch, Alerts, Settings, and a second ⌘K button!
2. **Viewport Crowding**:
   The floating pill at the bottom obscured lower cards on mobile screens and duplicated the hamburger sheet.

### Implemented Consolidation
1. **Single Native Bottom Dock (`components/navigation/mobile-nav-pill.tsx`)**:
   - Streamlined into 4 primary touch targets: **Discover** (`/app`), **Watch** (`/app/watch`), **Dossier** (`/app/dossier`), and **Settings** (`openProfileModal`).
   - Removed redundant ⌘K search trigger from the bottom dock.
2. **Clean Top Bar (`components/navigation/app-sidebar.tsx -> MobileAppHeader`)**:
   - Removed the 120-line duplicate slide-out drawer and hamburger menu button.
   - Retained only Brand Logo, Quick Search (`⌘K`), and Notifications Bell with live unread badge.
   - Result: 0 overlapping navigation drawers, 0 duplicate search buttons, native application mobile feel.
