# Design System Master File: BrowserPilot

> **LOGIC:** When building a specific page, first check `design-system/browserpilot/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** BrowserPilot  
**Domain:** AI-Native Autonomous Web Discovery, Extraction & Opportunity Verification  
**Archetype:** Developer-Adjacent Verification SaaS (Authoritative, Calm, High-Precision)  
**Standard:** Ponytail Architecture Compliance (Zero Bloat, Native React 19 / Next.js 16, WCAG AA)

---

## 1. Brand Identity & Color Tokens

### Fixed Constraints
- **Light Theme Background:** Warm-neutral off-white (`#F6F6F4`), never stark white (`#FFFFFF`) or yellow cream.
- **Primary Brand Accent:** Deep forest green (`#1F3D2E`), never purple, violet, cyan, or generic dashboard blue (`#2563EB`).
- **Dark Theme Background:** Deep charcoal-forest (`#121714`) with elevated surfaces (`#1A221D`).
- **Visual Tone:** Trustworthy verification ledger, high legibility, calm contrast, zero decorative neon.

### Color Token Table

| Role | Light Mode Hex | Dark Mode Hex | CSS Token | Contrast Ratio (Light) | Standard |
|------|----------------|---------------|-----------|------------------------|----------|
| **Background** | `#F6F6F4` | `#121714` | `--color-background` | Canvas base | - |
| **Foreground** | `#17201B` | `#F1F5F2` | `--color-foreground` | 14.2:1 against bg | WCAG AAA ($\ge 7:1$) |
| **Primary Accent** | `#1F3D2E` | `#34D399` | `--color-primary` | 11.5:1 (white text on primary) | WCAG AAA ($\ge 7:1$) |
| **Primary Foreground** | `#FFFFFF` | `#0A1C12` | `--color-primary-foreground` | 11.5:1 on `#1F3D2E` | WCAG AAA |
| **Card Surface** | `#FFFFFF` | `#1A221D` | `--color-card` | 1.1:1 surface delta | Clean elevation |
| **Card Foreground** | `#17201B` | `#F1F5F2` | `--color-card-foreground` | 15.1:1 against card | WCAG AAA |
| **Muted Surface** | `#EBEBE6` | `#232D27` | `--color-muted` | Subtle grouping fill | - |
| **Muted Foreground** | `#525D56` | `#A3B1A9` | `--color-muted-foreground` | 5.3:1 against bg | WCAG AA ($\ge 4.5:1$) |
| **Border / Divider** | `#E2E2DC` | `#2A3830` | `--color-border` | 1.3:1 subtle line | Visual partition |
| **Input Surface** | `#FFFFFF` | `#151D18` | `--color-input-bg` | Crisp field base | - |
| **Focus Ring** | `#1F3D2E` | `#34D399` | `--color-ring` | High visibility ring | WCAG 2.4.11 |
| **Destructive** | `#B91C1C` | `#F87171` | `--color-destructive` | 5.8:1 against bg | WCAG AA |

---

## 2. Typography Architecture

### Type Families
- **Headings & Display:** `Source Serif 4` (`font-serif`, weights 600, 700) — delivers editorial authority, clarity, and calm credibility.
- **Body & UI Controls:** `Inter` (`font-sans`, weights 400, 500, 600) — clean geometric readability, tabular numeral support.
- **Code, Hashes, Telemetry & Badges:** `Geist Mono` (`font-mono`, weights 400, 500) — monospaced precision for timestamps, IDs, JSON payloads.

### Type Hierarchy

| Element | Font Family | Size / Line Height | Weight | Tracking | Usage |
|---------|-------------|-------------------|--------|----------|-------|
| `Display 1` | `Source Serif 4` | `2.25rem` (36px) / 1.2 | 700 | `-0.02em` | Page hero, main headline |
| `Heading 1` | `Source Serif 4` | `1.75rem` (28px) / 1.25 | 700 | `-0.015em` | Section titles, modal headers |
| `Heading 2` | `Source Serif 4` | `1.25rem` (20px) / 1.3 | 600 | `-0.01em` | Opportunity card titles, deck headers |
| `Heading 3` | `Inter` | `1.0rem` (16px) / 1.4 | 600 | `0` | Card sub-sections, dialog titles |
| `Body Large` | `Inter` | `1.0rem` (16px) / 1.5 | 400 | `0` | Lead paragraphs, key descriptions |
| `Body Base` | `Inter` | `0.875rem` (14px) / 1.5 | 400 / 500 | `0` | Primary table rows, field labels, chat text |
| `Body Small` | `Inter` | `0.75rem` (12px) / 1.4 | 400 / 500 | `+0.01em` | Metadata hints, helper text, chips |
| `Monospace/Meta` | `Geist Mono` | `0.75rem` (12px) / 1.3 | 500 | `+0.02em` | Job hashes, status codes, telemetry |

---

## 3. Opportunity Cards & ATS Visual Language

### ATS Source Chips
Each ATS provider receives a distinct, subtle colored badge combining an accessible icon/glyph, high-contrast label, and distinct tinted background:

| ATS Provider | Text Color | Background Fill | Border Color | Glyph / Indicator | Contrast Ratio |
|--------------|------------|-----------------|--------------|-------------------|----------------|
| **Ashby** | `#5636D6` | `#F0EEFF` | `#D6CEFD` | `⚡` or Ashby token dot | 6.2:1 (AA Pass) |
| **Greenhouse** | `#0D6832` | `#EBF7EE` | `#BCE4C9` | `🌱` or Greenhouse token dot | 6.4:1 (AA Pass) |
| **Lever** | `#0E4399` | `#EBF2FC` | `#BDD7FB` | `◈` or Lever token dot | 6.5:1 (AA Pass) |
| **Workday** | `#A14400` | `#FFF3E6` | `#FCD3A5` | `☀️` or Workday token dot | 6.1:1 (AA Pass) |
| **Direct / Company** | `#1F3D2E` | `#E8EFEA` | `#C3D5CA` | `🏢` or Building token dot | 7.8:1 (AAA Pass) |

### Verification Status Badges (Accessibility Invariant: Never Color Alone)
Every verification state MUST include:
1. Distinct vector SVG icon (Lucide)
2. Descriptive text label
3. Explicit color pill with $\ge 4.5:1$ text contrast

| Verification State | Icon Component | Display Label | Light Pill Styles | Dark Pill Styles |
|--------------------|----------------|---------------|-------------------|------------------|
| `VERIFIED_LIVE` | `ShieldCheck` | "Verified Live" | `bg-emerald-50 text-emerald-800 border-emerald-200` | `bg-emerald-950/50 text-emerald-300 border-emerald-800` |
| `VERIFYING` | `RotateCw` (spin) | "Verifying..." | `bg-amber-50 text-amber-800 border-amber-200` | `bg-amber-950/50 text-amber-300 border-amber-800` |
| `STALE` | `Clock` | "Stale (>14d)" | `bg-slate-100 text-slate-700 border-slate-300` | `bg-slate-900 text-slate-300 border-slate-700` |
| `EXPIRED_CLOSED` | `ShieldAlert` | "Expired / Closed" | `bg-rose-50 text-rose-800 border-rose-200` | `bg-rose-950/50 text-rose-300 border-rose-800` |

### Opportunity Card Structural Zones
1. **Header Row:** Company name + ATS source chip (left), Verification status corner badge (right).
2. **Title Row:** Prominent `Source Serif 4` job title with external link indicator.
3. **Elevated Metadata Row (Fixed predictable slots):**
   - **Slot 1 (Location & Mode):** `MapPin` icon + "San Francisco, CA • Hybrid / Remote"
   - **Slot 2 (Compensation):** `DollarSign` icon + "$160,000 – $210,000 / yr" or "Competitive"
   - **Slot 3 (Freshness):** `Calendar` or `Clock` icon + "Posted 2 days ago"
4. **Skills & Match Row:** High match indicator + concise skills tags.
5. **Action Hierarchy:**
   - **Primary Action (High Contrast):** Solid deep forest green (`bg-[#1F3D2E] text-white hover:bg-[#162D22]`) for "Apply Directly" or "Save Opportunity".
   - **Secondary Actions (Quiet):** Outline or ghost icon buttons for Bookmark toggle, Copy Link, or View Evidence Dossier.

---

## 4. Navigation & Layout Ergonomics

### Universal Responsive Breakpoints
- **Mobile (`< 640px`):**
  - Header: Compact brand logo + Command Palette trigger + User menu.
  - Navigation: Floating rounded bottom pill navigation (`fixed bottom-4 left-1/2 -translate-x-1/2 z-40`) providing thumb reach for Discover, Saved, Watch, and Alerts.
  - Opportunity Cards: Card stack layout, touch targets padded to $\ge 44 \times 44\text{px}$.
  - Tables: Transformed into responsive summary cards, no horizontal cutoff.
- **Tablet (`640px – 1024px`):**
  - Header: Standard top nav bar with icon + label tabs.
  - Content: 2-column balanced grid where appropriate.
- **Desktop (`> 1024px`):**
  - Persistent header with inline status indicators, global `Cmd+K` trigger pill, and full workspace sub-navigation.

### Global Command Palette (`Cmd+K` / `Ctrl+K`)
- **Activation:** `Cmd+K` / `Ctrl+K` keyboard shortcut + visible header button + mobile bottom nav search icon.
- **Direct Action Capabilities:**
  - Run quick search query directly inside the palette and navigate to results.
  - Fast page jumping: Discover (`/app`), Saved (`/app/saved`), Watch (`/app/watch`), Swarm (`/app/swarm`), Notifications (`/app/notifications`).
  - Instant Settings Modal Overlay: Open Profile/Account, AI Providers, Memory, Billing without page redirection.
- **Accessibility:** Full keyboard trap, `role="dialog"`, ARIA live region for results, arrow-key navigation, Escape key dismissal.

### Shared UI State Architecture
- Single lightweight React Context (`UIStateProvider`) wrapping the application tree in `app/layout.tsx`.
- Synchronizes:
  - `unreadNotificationsCount`: Instantly updates header badge, bottom nav badge, and notifications list simultaneously upon read/mark-all actions.
  - `savedCount`: Reflects real-time bookmark toggles across cards and navbar without page reloads.
  - `commandPaletteOpen`: Universal trigger and dismissal.
  - `profileModalOpen`: Universal modal trigger with target tab specification.

---

## 5. Ponytail Accessibility & Anti-Pattern Checklist

### Forbidden Anti-Patterns (Zero Tolerance)
- ❌ **Color as sole indicator:** Never use a plain colored circle or colored text alone to indicate status or severity.
- ❌ **Truncated touch targets:** No interactive clickable area smaller than $44 \times 44\text{px}$ on viewports $<640\text{px}$.
- ❌ **Invisible keyboard focus:** All buttons, links, and inputs must have visible focus rings (`focus-visible:ring-2 focus-visible:ring-[#1F3D2E] focus-visible:outline-none`).
- ❌ **Unstyled table horizontal overflow:** No raw multi-column tables squashed onto mobile screens without card transformation.
- ❌ **Emoji UI icons:** Never use unicode emojis (✨ 🔍 ⚙️ 🏢) for primary UI controls; use Lucide SVG components.
- ❌ **Missing `aria-hidden` on decorative icons:** Every icon next to visible label text must be flagged with `aria-hidden="true"`. Standalone icon buttons must have explicit `aria-label`.
- ❌ **Ignored `prefers-reduced-motion`:** CSS transitions and spinning indicators must disable motion or respect `motion-reduce:animate-none`.

### Pre-Delivery Verification Checklist
- [ ] Light mode text contrast meets WCAG AA ($\ge 4.5:1$) against `#F6F6F4` and `#FFFFFF`.
- [ ] Primary button text contrast meets WCAG AAA ($\ge 7:1$) against `#1F3D2E`.
- [ ] All touch targets on mobile verify $\ge 44 \times 44\text{px}$.
- [ ] `Cmd+K` activates command palette from every page; mobile button activates it on tap.
- [ ] Notification mark-read updates header, bottom pill, and page count in exact sync.
- [ ] Opportunity cards display ATS chip, corner verification badge with icon+text, and fixed metadata slots.
- [ ] Zero TypeScript or runtime regression across existing test harnesses.
