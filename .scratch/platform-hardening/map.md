# Wayfinder Map: Platform Hardening & System Audit

Effort: `platform-hardening`
Spec: [spec.md](file:///c:/Users/sr2ma/Documents/github/browserAI/.scratch/platform-hardening/spec.md)
Status: COMPLETED

---

## Dependency Graph & Ticket Map

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│  01-source-imbalance (Diagnose)      │     │  02-career-memory-pipeline (Diagnose)│     │  03-static-recommendations (Diagnose)│
│  Status: RESOLVED                    │     │  Status: RESOLVED                    │     │  Status: RESOLVED                    │
└──────────────────┬───────────────────┘     └──────────────────┬───────────────────┘     └──────────────────┬───────────────────┘
                   │                                            │                                            │
                   │                                            │                                            │
┌──────────────────▼───────────────────┐                        │                                            │
│  04-ui-duplication-audit (Research)  │                        │                                            │
│  Status: RESOLVED                    │                        │                                            │
└──────────────────┬───────────────────┘                        │                                            │
                   │                                            │                                            │
┌──────────────────▼───────────────────┐                        │                                            │
│  05-mobile-redundancy (Research)     │                        │                                            │
│  Status: RESOLVED                    │                        │                                            │
└──────────────────┬───────────────────┘                        │                                            │
                   │                                            │                                            │
                   └────────────────────────────┬───────────────┴────────────────────────────────────────────┘
                                                │
                                    ┌───────────▼───────────────────────────┐
                                    │  06-cross-verification (Synthesis)    │
                                    │  Status: RESOLVED                     │
                                    └───────────────────────────────────────┘
```

---

## Ticket Inventory

| Ticket | Slug | Type | Status | Blocked By | Labels |
|---|---|---|---|---|---|
| [01](file:///c:/Users/sr2ma/Documents/github/browserAI/.scratch/platform-hardening/issues/01-source-imbalance.md) | `source-imbalance` | `diagnosing-bugs` | `resolved` | *None* | `discovery-engine`, `backend-fix` |
| [02](file:///c:/Users/sr2ma/Documents/github/browserAI/.scratch/platform-hardening/issues/02-career-memory-pipeline.md) | `career-memory-pipeline` | `diagnosing-bugs` | `resolved` | *None* | `backend-fix`, `discovery-engine` |
| [03](file:///c:/Users/sr2ma/Documents/github/browserAI/.scratch/platform-hardening/issues/03-static-recommendations.md) | `static-recommendations` | `diagnosing-bugs` | `resolved` | *None* | `ui-ux`, `discovery-engine` |
| [04](file:///c:/Users/sr2ma/Documents/github/browserAI/.scratch/platform-hardening/issues/04-ui-duplication-audit.md) | `ui-duplication-audit` | `research` | `resolved` | *None* | `ui-ux` |
| [05](file:///c:/Users/sr2ma/Documents/github/browserAI/.scratch/platform-hardening/issues/05-mobile-redundancy.md) | `mobile-redundancy` | `research` | `resolved` | `04` | `ui-ux` |
| [06](file:///c:/Users/sr2ma/Documents/github/browserAI/.scratch/platform-hardening/issues/06-cross-verification.md) | `cross-verification` | `task` | `resolved` | `01`, `02`, `03`, `04`, `05` | `backend-fix`, `ui-ux`, `security` |

---

## Decisions & Outcomes
- **Ticket 01 (Source Imbalance Resolved)**:
  - Expanded `defaultSources` in `lib/scraper/intentParser.ts` to include `["LinkedIn", "ATS Direct", "Greenhouse", "Lever", "Ashby", "Y Combinator", "Hacker News", "GitHub Curated"]`.
  - Implemented `applySourceDiversityCap` in `lib/scraper/ranker.ts`: 40% maximum per-source cap in multi-source candidate pools prevents LinkedIn from starving out ATS Direct, Greenhouse, Lever, Ashby, or YC.
- **Ticket 02 (Career Memory Pipeline Resolved)**:
  - In `lib/scraper/searchPipeline.ts`: Automatically loads user profile from DB whenever `options.userId` is provided and merges target skills, preferred locations, preferred work modes, and experience levels additively into the search execution.
  - In `lib/scraper/discoveryPlanner.ts`: Unblocked location fallback by removing `!hasExplicitQuery`, allowing saved locations to guide searches whenever no city/country override is typed.
  - In `lib/scraper/intentParser.ts`: Implemented additive memory merge across both deterministic and Puter parsing pathways.
- **Ticket 03 (Dynamic Recommendations via Puter Resolved)**:
  - Created `app/api/account/recommendations/route.ts`: Generates personalized search query suggestions through Puter LLM based on user career memory and search history, with heuristic profile fallback.
  - Connected `components/agent/task-input.tsx`: Displays dynamic chips with visual `Sparkles` "Recommended for you:" indicator.
- **Ticket 04 (Desktop Navigation Surfaces Consolidated)**:
  - Preserved `components/navigation/app-sidebar.tsx` as the single authoritative source of truth for desktop navigation.
- **Ticket 05 (Mobile Redundancy Eliminated)**:
  - In `components/navigation/mobile-nav-pill.tsx`: Consolidated into a clean 4-tab native bottom dock (Discover, Watch, Dossier, Settings).
  - In `components/navigation/app-sidebar.tsx`: Removed the redundant 120-line slide-out drawer and hamburger button from `MobileAppHeader`, retaining only Brand, Quick Search (⌘K), and Notifications Bell.
- **Ticket 06 (Cross-Verification Complete)**:
  - `npm run typecheck`: 0 errors.
  - `tests/unit/ranker.test.ts`: Passed all unit tests including the new multi-source diversity cap assertion.
  - `tests/integration/productionSearchIntegration.test.ts`: All 14 tests passed cleanly.

## Fog / Unknowns
- All prior unknowns resolved and verified.
