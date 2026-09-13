# Specification: Platform Hardening & Multi-Domain System Audit

## Objective
Conduct a comprehensive, multi-perspective forensic audit of BrowserPilot across 5 critical dimensions:
1. **Source Imbalance**: Disproportionate skew toward LinkedIn despite multi-source scraper capability (Greenhouse, Lever, Ashby, Workday, etc.).
2. **Career Memory Pipeline Application**: Verification of whether saved career memory (roles, skills, comp floor, locations) in Settings is actively read and injected into live searches or is write-only.
3. **Static vs. Dynamic Recommendations**: Audit of sample queries, quick refinement chips, and suggestion pills.
4. **UI Duplication & Control Clutter**: Full catalog of redundant navigation surfaces, search inputs, and modal entry points across desktop.
5. **Mobile-Specific Redundancy**: Breakpoint analysis of overlapping navigation pills, bottom bars, and cluttered mobile views.

## Standards & Governance
- Follow tracker conventions defined in `docs/agents/issue-tracker.md`.
- Use canonical triage roles (`ready-for-agent`, `needs-info`) from `docs/agents/triage-labels.md`.
- Verify actual codebase implementations without guessing or assuming behavior from UI screenshots.
