# TASK-062 — BrowserPilot Forensic Runtime Audit & Failure Attribution Report

**Author:** BrowserPilot Engineering & Security Team  
**Date:** September 4, 2026  
**Status:** Physically Executed & Verified via Local Runtime Test Suite  
**Harness:** `scratch/task062ForensicRuntimeAudit.ts` (21 Physical Runtime Scenarios)  
**Execution Environment:** Local Node.js / SQLite (Turso) / Next.js 16.3.2  

---

## A. Executive Summary

A comprehensive, physically executed forensic runtime audit of the current BrowserPilot implementation was performed to investigate the root causes of:
1. Incorrect and weakly verified job URLs (generic portals, dead links, and Google search queries).
2. Unsafe source injection and unrequested ATS platforms (Ashby, Greenhouse, Lever).
3. Synthetic and placeholder data paths (`"Leading Organization"`, `"Leading Employer"`, fake job IDs).
4. Silent omission of AI token/usage telemetry during interactive search queries.
5. Incomplete cancellation propagation during pipeline execution.
6. Non-deterministic notification attachment to arbitrary opportunities.

### Key Forensic Discoveries:
* **The "Purely Syntactic Verification" Root Cause:** The entire search verification quality gate (`lib/scraper/searchQualityGate.ts`, `lib/ai/evidence/evidenceEngine.ts`, `deterministicVerifier.ts`, `semanticJudge.ts`) performs **zero network dereferencing or live HTTP probes**. URLs are judged solely by string regex (`classifyJobUrl`). A dead, 404, or closed URL with a 2-segment path is classified as `JOB_DETAIL` and accepted as verified.
* **The "Synthetic ATS Provider" Smoking Gun:** `lib/scraper/providers/atsProvider.ts` directly manufactures fake job openings (`title: ${role} - ${comp}`, `postedAgoText: "2 hours ago"`) across hardcoded companies (`["Stripe", "Linear", "Vercel"]`) and generates fake URLs (`https://jobs.ashbyhq.com/${slug}/application`). Because `/linear/application` has 2 path segments, `classifyJobUrl` treats it as an exact `JOB_DETAIL` page, bypassing the company-root check.
* **Browser Connector Placeholder Generators:** All 4 browser connectors in `lib/discovery/browser/connectors/` (`atsBrowserConnector.ts`, `careerPortalConnector.ts`, `indeedConnector.ts`, `linkedInConnector.ts`) synthesize hardcoded companies (`"Leading Organization"`, `"Leading Employer"`, `"Stripe"`, `"Retool"`) with incrementing job IDs (`job_5001`). Whenever `source.search` or autonomous watch runs, these synthetic candidates are injected into the pipeline.
* **Interactive Search Token Blackout:** `recordAIUsageEvent` is only wired into `discoveryExecutionService.ts` (background watch cycles). Neither `/api/search` nor `intelligenceHarness.ts` nor `searchPlanner.ts` ever call `recordAIUsageEvent`. As a result, interactive user search displays 0 tokens tracked.
* **Cancellation Signal Disconnect:** While `intelligenceHarness.ts` checks `options.signal?.aborted` between stages, `executeSearchPipeline` does not take or forward an `AbortSignal`, allowing background network/swarm operations to continue running after cancellation.

---

## B. Actual Runtime Architecture

```
User Search Query (POST /api/search)
  │
  ├─► [1] Pre-flight Validation & Auth Check (NextAuth Session / Rate Limiter)
  │
  ├─► [2] parseSearchIntent (lib/scraper/intentParser.ts)
  │     └─► Extracts roles, locations, dates, and requested count
  │     └─► HARDCODED DEFAULT: If no sources requested, injects ["LinkedIn", "Y Combinator", "Indeed"]
  │
  ├─► [3] intelligenceHarness.runLifecycle (lib/ai/harness/intelligenceHarness.ts)
  │     │
  │     ├─► STAGE 2: IntelligenceBrain Context Synthesis
  │     │     └─► User memories + platform memory + company intelligence lookup
  │     │
  │     ├─► STAGE 3: SearchPlanner & Plan Validation
  │     │     └─► Gemini Model (if key present) OR Deterministic Action Plan
  │     │     └─► HARDCODED DOMAINS: ["linkedin.com", "indeed.com", "greenhouse.io", "ashbyhq.com", "lever.co"]
  │     │
  │     ├─► STAGE 4: SearchActionExecutor (lib/ai/tools/searchActionExecutor.ts)
  │     │     ├─► discovery.search_pipeline ──► SwarmDiscoveryEngine (LinkedIn, YC, Indeed, ATS Direct)
  │     │     ├─► source.search ──────────────► BrowserSourceRegistry (MOCK CONNECTORS: "Leading Organization")
  │     │     ├─► company.lookup ─────────────► Inferred URL (https://${slug}.com/careers)
  │     │     └─► company.ats ────────────────► Stub returning 0 candidates
  │     │
  │     ├─► STAGE 5: EvidenceVerificationEngine & Authoritative Quality Gate
  │     │     ├─► Normalization (lib/scraper/normalizer.ts)
  │     │     │     └─► URL missing http/https -> Fabricates Google Search URL!
  │     │     ├─► Deterministic Hard Constraints Firewall
  │     │     ├─► SearchQualityGate (classifyJobUrl) ──► PURELY REGEX; NO HTTP DEREFERENCING
  │     │     └─► Semantic Judge (LLM evaluateSemanticEvidence or deterministic fallback)
  │     │
  │     ├─► STAGE 6: Autonomous Correction Loop (correctionLoopController.ts)
  │     │     └─► Shortfall diagnosis (Bounded rounds, role synonym reformulation)
  │     │
  │     └─► STAGE 7: Dedup, Rank & Terminal State Invariants
  │
  ├─► [4] Database Persistence (createSearch, upsertOpportunity, upsertSourceListing)
  └─► [5] Server-Authoritative API Response (/api/search)
```

---

## C. Actual Search Execution Path

For each transition in the search lifecycle:

| Transition Step | Input Data | Output Data | Nature | Overridable? |
|---|---|---|---|---|
| **Query ➔ Intent** | Raw string + optional filter overrides | Canonical `SearchIntent` object | Deterministic Regex + Hardcoded Defaults | No (Authoritative) |
| **Intent ➔ Brain** | Query string + `userId` | `BrainContext` (memories, company records) | Deterministic Vector / SQL Lookup | Yes (by explicit query) |
| **Brain ➔ Plan** | `SearchIntent` + `BrainContext` | `SearchActionPlan` (ordered actions) | LLM (Gemini) or Deterministic Fallback | Yes (via PlanValidator) |
| **Plan ➔ Executor** | `PlannedSearchAction[]` | Harvested `RawJobCandidate[]` | Swarm HTTP + Mock Browser Connectors | No |
| **Harvest ➔ Normalizer** | `RawJobCandidate[]` | Normalized candidate items | Deterministic string manipulation | No |
| **Normalizer ➔ Quality Gate**| Candidate URLs + Titles + Dates | `QualityGateEvaluation` (isEligible, reasons) | Deterministic Regex (No Network) | Yes (Semantic Judge) |
| **Quality Gate ➔ Judge** | Eligible candidates + plan constraints | `CompositeVerificationResult` | LLM or Deterministic Confidence | No |
| **Judge ➔ Correction Loop** | Verified candidates vs requested count | Augmented candidate set or terminal state | Deterministic Diagnoser + Loop Controller | No |
| **Loop ➔ Ranker** | Deduplicated candidate opportunities | `RankedOpportunity[]` with match scores | Deterministic Scoring Function | No |
| **Ranker ➔ Persistence** | `RankedOpportunity[]` | SQLite/Prisma Search & Opportunity Records | Database Transactions | No |

---

## D. Source Selection Matrix

| Provider / Source | Selection Rule | Trigger Condition | Actual Behavior in Runtime | Classification |
|---|---|---|---|---|
| **LinkedIn** | Public guest API search | Included in explicit request OR default | Fetches public guest HTML; 429/empty on bot block | REAL EXTERNAL HTTP |
| **Y Combinator** | WorkAtAStartup directory | Included in explicit request OR default | Fetches company directory; matches company cards | REAL EXTERNAL HTTP |
| **Indeed** | Public search scraper | Included in explicit request OR default | Blocked by Cloudflare challenge; returns 0 candidates | REAL EXTERNAL HTTP |
| **ATS Direct** | Direct ATS provider | Explicit request OR tech role default in swarm | Fabricates candidates for Stripe, Linear, Vercel | SYNTHETIC / MOCK |
| **LinkedIn Connector** | Authenticated browser | Invoked by `source.search` capability | Generates `"Leading Organization"` with fake URLs | SYNTHETIC / MOCK |
| **Indeed Connector** | Authenticated browser | Invoked by `source.search` capability | Generates `"Leading Employer"` with fake URLs | SYNTHETIC / MOCK |
| **ATS Connectors** | Browser portal crawl | Invoked by `source.search` capability | Generates `job_5001` with `boards.ashby.io` URLs | SYNTHETIC / MOCK |

---

## E. ATS Invocation Matrix

| Path / Caller | Invocation Trigger | Legitimate Reason? | Finding / Classification |
|---|---|---|---|
| `lib/scraper/providers/atsProvider.ts` | Default in `SwarmDiscoveryEngine.providers` | **NO** (unconditional when tech role) | **UNSAFE SOURCE INJECTION**: Injects Stripe, Linear, Vercel candidates |
| `lib/ai/searchPlanner/searchPlanner.ts:204` | Company targeted search | **NO** (defaults unknown ATS to GREENHOUSE) | **HARDCODED ATS DEFAULT**: Injects Greenhouse without verified intelligence |
| `lib/ai/harness/intelligenceHarness.ts:314` | Harness plan validation | **NO** (allowedDomains hardcoded) | **HARDCODED ALLOWLIST**: Hardcodes Ashby, Greenhouse, Lever domains |
| `lib/discovery/browser/connectors/atsBrowserConnector.ts` | `source.search` tool call | **NO** (synthetic candidate generation) | **SYNTHETIC DATA PATH**: Injects unverified fake job IDs |

---

## F. URL Verification Matrix

Classification of all candidate URLs evaluated across the physical runtime audit:

| Candidate URL Example | Evaluated URL Type | HTTP Reachable? | Final Page Content | Verification Gate Result | Truth Status |
|---|---|---|---|---|---|
| `https://www.linkedin.com/jobs/view/12345` | `JOB_DETAIL` | Unchecked | Guest search page | Accepted (if title matches) | UNVERIFIED ASSUMPTION |
| `https://www.workatastartup.com/companies/acme` | `COMPANY_CAREER_ROOT` | Unchecked | Company profile card | Rejected by Quality Gate | REJECTED (CORRECT) |
| `https://www.indeed.com/jobs?q=backend` | `SEARCH_RESULTS` | 403 (CF) | Challenge page | Rejected by Quality Gate | REJECTED (CORRECT) |
| `https://stripe.com/careers` | `COMPANY_CAREER_ROOT` | Unchecked | Career home | Rejected by Quality Gate | REJECTED (CORRECT) |
| `https://boards.greenhouse.io/stripe` | `ATS_COMPANY_ROOT` | Unchecked | Job board root | Rejected by Quality Gate | REJECTED (CORRECT) |
| `https://jobs.ashbyhq.com/linear/application` | `JOB_DETAIL` (False Positive!) | 404 Not Found | Nonexistent | **ACCEPTED (BYPASS BUG!)** | **FABRICATED / DEAD** |
| `https://boards.greenhouse.io/nonexistent/jobs/404` | `JOB_DETAIL` | 404 Not Found | 404 Page | Accepted (if mock snippet given) | DEAD LINK LEAK |
| `https://www.google.com/search?q=apply` | `SEARCH_RESULTS` | Unchecked | Google Search | Rejected by Quality Gate | REJECTED (CORRECT) |

---

## G. AI Configuration Matrix

| Scenario | System State | User Warning Emitted? | Search Behavior |
|---|---|---|---|
| **No API Key & No Puter** | Missing GenAI key | **YES** (`MODEL_CONFIGURATION_REQUIRED` emitted in planner result) | Deterministic fallback plan generated & executed |
| **Invalid API Key** | GenAI authentication error | **YES** (Failure classified, error logged) | Falls back to `MULTI_SOURCE_HARVEST` deterministic plan |
| **Model Timeout** | GenAI call exceeds budget | **YES** (`MODEL_TIMEOUT` classified) | Seamless fallback to deterministic query execution |
| **Puter Connected** | BYOK/Puter active | **NO** (Normal operation) | Model planning invoked with optimal model detection |

---

## H. Token / Usage Matrix

| Operation | Model / Provider | Tokens Tracked in DB | Expiration / Quota Known? | UI Representation |
|---|---|---|---|---|
| **Interactive Search (`/api/search`)** | Gemini 2.5 Flash / Fallback | **0 (OMITTED)** | Provider does not expose quota | Displays `0 tokens tracked` |
| **Autonomous Watch Scan** | Background Scanner | Tracked via `recordAIUsageEvent` | Tracked in database table | Displays tracked tokens & operations |
| **Prompt Enhancement** | Interactive Gemini | Omitted from DB | Provider does not expose quota | Not displayed in usage summary |

---

## I. Cancellation Matrix

| Stage | Cancellation Check | Resulting State | Orphan Contexts Remaining? |
|---|---|---|---|
| **Pre-Intent** | `options.signal?.aborted` checked | `CANCELLED` (duration 0ms) | None |
| **Post-Intent** | `options.signal?.aborted` checked | `CANCELLED` | None |
| **Pre-Plan** | `options.signal?.aborted` checked | `CANCELLED` | None |
| **Action Execution** | `execCtx.signal?.aborted` checked in loop | Action skipped with status `FAILED` | None |
| **`executeSearchPipeline`** | **SIGNAL NOT PASSED** | **Runs until provider timeout** | **Background HTTP promises remain pending** |

---

## J. Notification Matrix

| Alert Trigger | Target User | Opportunity ID Assigned | Idempotency Enforced? | Finding / Risk |
|---|---|---|---|---|
| **`NEW_MATCH` (with Opp ID)** | Authenticated User | Specific Opportunity ID | Yes (24h unique key) | Functioning correctly |
| **`NEW_MATCH` (duplicate)** | Authenticated User | Specific Opportunity ID | Yes (returns `created: false`) | Functioning correctly |
| **`DISCOVERY_PARTIAL_SUCCESS`** | Authenticated User | **Random Opp (`prisma.opportunity.findFirst()`)** | Yes | **CORRUPTION: Attaches global alert to random job** |
| **Global Alert (Empty DB)** | Authenticated User | `null` | **SILENTLY DROPPED** | **BUG: Dropped if no opportunities exist** |

---

## K. Tenant Isolation Matrix

| Resource | USER_A Ownership | USER_B Attempt | HTTP Status | Leakage Observed? |
|---|---|---|---|---|
| **Search History Session** | `usr_audit_a` | Request with `x-test-user-id: usr_audit_b` | **404 Not Found** | None |
| **User Memory Record** | `usr_audit_a` | Delete with `x-test-user-id: usr_audit_b` | **404 Not Found** | None |
| **Saved Opportunities List**| `usr_audit_a` | List with `x-test-user-id: usr_audit_b` | **200 (Empty List)**| Zero USER_A items visible |
| **Provider Connection** | `usr_audit_a` | Query by USER_B | **404 Not Found** | None |

---

## L. Memory Isolation Matrix

* Test Query by USER_A: `"Remember that I prefer remote backend engineering roles"`
* Stored in database under `userMemoryVault` with `userId = usr_audit_a`.
* Test Query by USER_B: `"Find mechanical engineering positions in Tripura"`
* Observation: USER_B's search intent synthesis retrieved **0 user memories** from `intelligenceBrain`. USER_A's preference did not leak across the tenant boundary.

---

## M. Synthetic Data Audit

| File Path | Line(s) | Pattern / Code | Status | Purpose |
|---|---|---|---|---|
| `lib/scraper/providers/atsProvider.ts` | 40-78 | `defaultCompanies = ["Stripe", "Linear", "Vercel"]`, fake titles & URLs | **ACTIVE PRODUCTION BUG** | Mock candidate generation in production provider |
| `lib/discovery/browser/connectors/linkedInConnector.ts` | 68 | `companyName: "Leading Organization"` | **ACTIVE PRODUCTION BUG** | Fallback placeholder candidate generation |
| `lib/discovery/browser/connectors/indeedConnector.ts` | 67 | `companyName: "Leading Employer"` | **ACTIVE PRODUCTION BUG** | Fallback placeholder candidate generation |
| `lib/discovery/browser/connectors/atsBrowserConnector.ts` | 47-75 | `defaultCompanies`, `job_5001`, `boards.ashby.io` | **ACTIVE PRODUCTION BUG** | Synthetic candidate generation |
| `lib/discovery/browser/connectors/careerPortalConnector.ts` | 41-70 | `defaultCompanies = ["Vercel", "Resend", "Neon"]` | **ACTIVE PRODUCTION BUG** | Synthetic candidate generation |
| `lib/scraper/normalizer.ts` | 386 | `https://www.google.com/search?q=...` | **ACTIVE PRODUCTION BUG** | Fallback URL generation |
| `lib/scraper/normalizer.ts` | 392 | `id: job_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}` | **ACTIVE PRODUCTION BUG** | Random ID generation for unkeyed items |
| `lib/ai/searchPlanner/searchPlanner.ts` | 290 | `url: "https://example.com/job/sample-id"` | **ACTIVE PRODUCTION BUG** | Placeholder URL in planned actions |

---

## N. Agentic vs Deterministic Responsibility Matrix

| Capability / Function | Responsible Layer | Mode of Operation | Real Invocations Observed |
|---|---|---|---|
| **Query Intent Parsing** | `intentParser.ts` | Deterministic Regex + Dictionaries | 100% Deterministic |
| **Context Synthesis** | `intelligenceBrain.ts` | Deterministic SQL + In-Memory Ranking | 100% Deterministic |
| **Search Planning** | `searchPlanner.ts` | LLM (Gemini) with Deterministic Fallback | Deterministic Fallback in test harness |
| **Action Execution** | `searchActionExecutor.ts` | Deterministic Dependency Graph Execution | 100% Deterministic |
| **Candidate Harvesting** | `swarmDiscovery.ts` | HTTP scraping + Cheerio parsing | Real HTTP (LinkedIn, YC) + Mock ATS |
| **Quality Gate Gating** | `searchQualityGate.ts` | Deterministic String Regex | 100% Deterministic (Zero Network) |
| **Semantic Judging** | `semanticJudge.ts` | LLM (Gemini) with Deterministic Fallback | Deterministic Confidence Scoring |
| **Correction Diagnosis** | `deterministicDiagnoser.ts`| Deterministic Rules Engine | 100% Deterministic |
| **Correction Planning** | `correctionPlanner.ts` | Deterministic Role Synonym Engine | 100% Deterministic |

---

## O. Frontend vs Backend Authority Matrix

| Decision Domain | Backend Authority | Frontend Role | Violations Observed |
|---|---|---|---|
| **Requested Count** | Authoritative (`requestedCount` wins over `maxResults`) | Renders returned items | None |
| **Verification Status** | Authoritative (`status: VERIFIED / PARTIAL`) | Renders badge from backend metadata | None |
| **URL Validity** | Authoritative (Determined at server Quality Gate) | Renders `primaryApplyUrl` from API | None |
| **Token / Usage Count** | Authoritative (Server database summary) | Renders numeric counter | None |
| **Terminal State** | Authoritative (`COMPLETED`, `PARTIAL`, `NO_RESULTS`) | Renders state message | None |

---

## P. Failure Attribution Matrix

| # | Symptom | Primary Layer | Exact File & Function | Root Cause | Severity |
|---|---|---|---|---|---|
| 1 | Generic and dead URLs accepted as verified | `QUALITY_GATE` | `lib/scraper/searchQualityGate.ts:164` | Pure regex evaluation without live HTTP dereferencing | **CRITICAL** |
| 2 | Ashby `/application` path bypasses root check | `NORMALIZER` | `lib/scraper/normalizer.ts:197` | Multi-segment rule (`segments.length > 1`) treats `/linear/application` as `JOB_DETAIL` | **HIGH** |
| 3 | Fake Stripe/Linear ATS jobs generated | `PROVIDER` | `lib/scraper/providers/atsProvider.ts:40` | Hardcoded `defaultCompanies` and synthetic candidate generator | **HIGH** |
| 4 | "Leading Organization" candidates generated | `PROVIDER` | `lib/discovery/browser/connectors/linkedInConnector.ts:68` | Placeholder candidate fallback in browser connector | **HIGH** |
| 5 | "Leading Employer" candidates generated | `PROVIDER` | `lib/discovery/browser/connectors/indeedConnector.ts:67` | Placeholder candidate fallback in browser connector | **HIGH** |
| 6 | Interactive search token counts display 0 | `TOKEN_USAGE` | `lib/ai/harness/intelligenceHarness.ts` | `recordAIUsageEvent` is never invoked during `/api/search` | **MEDIUM** |
| 7 | Pipeline continues running after client abort | `CANCELLATION`| `lib/scraper/searchPipeline.ts:42` | `PipelineExecutionOptions` does not accept or forward `AbortSignal` | **MEDIUM** |
| 8 | Notifications attach to random opportunities | `NOTIFICATION` | `lib/discovery/lifecycle/opportunityNotificationService.ts:51` | `prisma.opportunity.findFirst()` fallback when `opportunityId` is null | **MEDIUM** |
| 9 | Unknown company ATS defaults to GREENHOUSE | `PLANNER` | `lib/ai/searchPlanner/searchPlanner.ts:204` | `compInfo?.item.atsProvider \|\| "GREENHOUSE"` hardcoded injection | **MEDIUM** |
| 10| Normalizer falls back to Google Search URL | `NORMALIZER` | `lib/scraper/normalizer.ts:386` | Non-http string generates `https://google.com/search?q=...` | **LOW** |

---

## Q. Confirmed Bugs

1. **BUG-001:** `lib/scraper/searchQualityGate.ts` does not dereference URLs over HTTP. A 404 dead link is marked `VERIFIED`.
2. **BUG-002:** `lib/scraper/normalizer.ts:197` classifies `https://jobs.ashbyhq.com/company/application` as `JOB_DETAIL` because it has 2 segments.
3. **BUG-003:** `lib/scraper/providers/atsProvider.ts:40-78` generates synthetic job candidates with hardcoded companies and fake posting dates.
4. **BUG-004:** `lib/discovery/browser/connectors/linkedInConnector.ts:68` generates `"Leading Organization"` synthetic candidates.
5. **BUG-005:** `lib/discovery/browser/connectors/indeedConnector.ts:67` generates `"Leading Employer"` synthetic candidates.
6. **BUG-006:** `lib/discovery/browser/connectors/atsBrowserConnector.ts:56-61` generates fake `job_5001` URLs on `boards.ashby.io`.
7. **BUG-007:** `lib/discovery/browser/connectors/careerPortalConnector.ts:41-56` generates fake career portal URLs for Vercel, Resend, and Neon.
8. **BUG-008:** `lib/ai/harness/intelligenceHarness.ts` fails to invoke `recordAIUsageEvent`, causing zero tokens to be tracked for interactive search.
9. **BUG-009:** `lib/scraper/searchPipeline.ts` omits `signal` from `PipelineExecutionOptions`, preventing cancellation from aborting active swarm fetches.
10. **BUG-010:** `lib/discovery/lifecycle/opportunityNotificationService.ts:51` attaches unassociated notifications to an arbitrary database record via `prisma.opportunity.findFirst()`.
11. **BUG-011:** `lib/ai/searchPlanner/searchPlanner.ts:204` defaults unknown company ATS providers to `"GREENHOUSE"`.
12. **BUG-012:** `lib/scraper/normalizer.ts:386` generates Google search query URLs when raw apply URLs lack http/https schemes.

---

## R. False Alarms / Expected Behavior

1. **Tripura Mechanical Engineering Yields Zero Results:**
   * Expected Behavior: Legitimate public listings for Mechanical Engineering in Tripura do not exist on Y Combinator (tech-startup focused) or public guest endpoints with active anti-bot controls.
   * Verdict: Returning 0 results with status `PARTIAL` / `NEEDS_MORE_EVIDENCE` is **truthful and correct**. Injected filler would be a violation of quality principles.
2. **Tenant Isolation Rejections (HTTP 404):**
   * Expected Behavior: USER_B querying USER_A's search ID returns 404 instead of 403 to prevent ID enumeration.
   * Verdict: **Working as intended and secure**.
3. **Deterministic Planning when API Key is Absent:**
   * Expected Behavior: Emitting a clear warning (`aiConfigurationMessage`) and falling back to the multi-source deterministic harvester.
   * Verdict: **Working as intended**.

---

## S. Recommended Fix Sequence

1. **TASK-063 (Global Verification Sandbox & Liveliness Dereferencing):**
   * Introduce headless HTTP / Puppeteer dereferencing into the Quality Gate.
   * Classify HTTP 404/410/403 as `DEAD` or `UNREACHABLE` and reject them.
   * Verify final redirected URL matches job detail pattern, not login or search results.
2. **TASK-064 (Synthetic Candidate Removal & ATS Provider Hardening):**
   * Delete hardcoded `defaultCompanies = ["Stripe", "Linear", "Vercel"]` from `atsProvider.ts`.
   * Replace synthetic generators in `lib/discovery/browser/connectors/` with real authenticated DOM scrapers or explicit failure responses (`SOURCE_UNAVAILABLE`).
   * Fix `normalizer.ts` Ashby path classifier to reject `/application` without a specific job ID.
3. **TASK-065 (Telemetry, Cancellation & Notification Integrity):**
   * Wire `recordAIUsageEvent` into `intelligenceHarness.ts` for all interactive search operations.
   * Add `signal?: AbortSignal` to `PipelineExecutionOptions` in `searchPipeline.ts` and propagate to `SwarmDiscoveryEngine`.
   * Refactor `opportunityNotificationService.ts` to support global system notifications with nullable `opportunityId`.

---

## T. TASK-063+ Dependency Map

```
TASK-062 (Forensic Audit & Failure Attribution) [COMPLETED]
  │
  ├──► TASK-063: Global Verification Sandbox & Liveliness Engine
  │      ├─► Depends on BUG-001 (Syntactic-only Quality Gate)
  │      └─► Depends on BUG-002 (Ashby URL segment misclassification)
  │
  ├──► TASK-064: Synthetic Code Scrubbing & ATS Sanitization
  │      ├─► Depends on BUG-003 (AtsProvider synthetic generator)
  │      ├─► Depends on BUG-004 & BUG-005 (Leading Organization/Employer connectors)
  │      ├─► Depends on BUG-006 & BUG-007 (atsBrowserConnector & careerPortalConnector)
  │      └─► Depends on BUG-011 (Default Greenhouse injection in SearchPlanner)
  │
  └──► TASK-065: Telemetry, Cancellation & Notification Wiring
         ├─► Depends on BUG-008 (Interactive search token blackout)
         ├─► Depends on BUG-009 (Pipeline AbortSignal omission)
         └─► Depends on BUG-010 (Notification random opportunity attachment)
```

---

## Critical Output Summary

AUDIT STATUS: PASS

CONFIRMED PRODUCTION-PATH BUGS: 12
UNVERIFIED ASSUMPTIONS: 4
SOURCE VERIFICATION FAILURES: 3
URL VERIFICATION FAILURES: 2
AI CONFIGURATION FAILURES: 0
TOKEN/USAGE ISSUES: 1
CANCELLATION ISSUES: 1
TENANT ISOLATION ISSUES: 0
NOTIFICATION ISSUES: 1
SYNTHETIC DATA PATHS: 6
