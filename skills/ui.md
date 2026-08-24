# UI & Visual Identity Guidelines

## 1. Visual Identity & Design System
- **Theme & Aesthetics**: Dark/light mode support via Tailwind CSS v4 and standard CSS custom properties. Clean, high-contrast, technical, and developer-centric aesthetic.
- **Color Tokens**: Standardized OKLCH / HSL palette mapped to semantic variables (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`).
- **Typography**: Clean sans-serif primary font (`font-sans`) paired with monospaced accents (`font-mono`) for identifiers, status pills, execution metrics, tool names, and code snippets.
- **Spacing & Layout**: Strictly adhere to 4px/8px grid conventions (`gap-2`, `gap-4`, `gap-6`, `p-4`, `p-6`). Keep containers structured and readable.

## 2. Motion & Micro-interactions
- **Purpose-Driven Motion**: Motion must provide immediate feedback on system state changes (transitions between queued, running, evaluating, completed, failed).
- **Reduced Motion**: Always respect `prefers-reduced-motion` media queries (`motion-reduce:transition-none`).
- **Standard Transitions**: Use subtle ease-out transitions (`transition-all duration-200 ease-out`) for hover states, expanding panels, and status chips. Avoid gratuitous or distracting bouncy loops.

## 3. ThreeUI Boundaries
- **UplinkLoader & 3D Visualizers**: `UplinkLoader` and heavy 3D canvas elements are strictly restricted to **Active Execution States only** (when a browser job is actively running or transitioning).
- **Resource Management**: Never render persistent WebGL / ThreeUI loops on idle dashboards, completed results, or static history views. Unmount or pause rendering once a task reaches a terminal state (`COMPLETED`, `FAILED`, `CANCELLED`).

## 4. Progressive Disclosure Hierarchy
All job execution and result views must structure information across four distinct, digestible levels:

```
+-------------------------------------------------------------+
| Level 1: Final Answer & Executive Summary                   |
| (High-level completion status, primary extracted payload)   |
+-------------------------------------------------------------+
| Level 2: Timeline & Milestones                              |
| (Chronological sequence of actions, goal transitions)       |
+-------------------------------------------------------------+
| Level 3: Worker & Job Metrics                               |
| (Execution time, step count, token usage, cost, retries)    |
+-------------------------------------------------------------+
| Level 4: Raw Tool Calls, Logs & DOM Snapshots               |
| (Playwright actions, selector matches, raw JSON responses)  |
+-------------------------------------------------------------+
```

- **Level 1 (Final Answer)**: Prominently displayed for immediate user consumption. Contains direct answer, download links, or primary artifact.
- **Level 2 (Timeline & Milestones)**: Collapsible or structured timeline showing step-by-step agent trajectory with visual success/failure badges.
- **Level 3 (Metrics & Performance)**: Quantitative breakdowns including latency per step, total tokens consumed, model invocations, and browser worker lifecycle stats.
- **Level 4 (Raw Telemetry)**: Detailed developer drawer/accordion containing full JSON logs, tool call payloads, console logs, and visual screenshots.

## 5. Accessibility Baseline (WCAG 2.1 AA)
- Semantic HTML tags (`<main>`, `<nav>`, `<article>`, `<section>`, `<aside>`).
- Full keyboard navigability with visible focus indicators (`outline-ring`).
- Screen-reader accessible status announcements (`aria-live="polite"` for background job state updates).
- Minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text/icons.
