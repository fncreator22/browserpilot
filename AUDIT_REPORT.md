# Comprehensive System Audit Report — BrowserPilot

**Audit Date**: 2026-08-25  
**Auditor**: Antigravity Quality Assurance & Architecture Agent  
**Scope**: End-to-End Codebase, UI Wiring, API Routes, AI Reasoning, Sandboxing, Persistence, and Security Boundaries.

---

## 📊 Summary of Findings

| Category | Total Count |
| :--- | :--- |
| **FUNCTIONAL** | **11** |
| **PARTIALLY WIRED** | **2** |
| **MOCK / DEMO** | **0** |
| **BROKEN** | **0** |

---

## 📋 End-to-End Feature Audit Matrix (Sections 1–13)

| # | Feature Area | Status | Evidence (file:line) | Notes |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Task submission & Job creation** | **FUNCTIONAL** | [`components/agent/task-input.tsx:74`](file:///c:/Users/sr2ma/Documents/github/browserAI/components/agent/task-input.tsx#L74)<br>[`app/api/jobs/route.ts:20`](file:///c:/Users/sr2ma/Documents/github/browserAI/app/api/jobs/route.ts#L20)<br>[`lib/queue/jobQueue.ts:44`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/queue/jobQueue.ts#L44) | Task submission triggers a real `POST /api/jobs` request, validates schema via Zod, writes a new record to the Prisma DB (`jobs` table), checks multi-tenant rate limits, and dispatches to the BullMQ Redis queue (with automatic in-process background worker execution if Redis is offline). |
| **2** | **Execution status & UplinkLoader** | **FUNCTIONAL** | [`app/app/jobs/[id]/page.tsx:121`](file:///c:/Users/sr2ma/Documents/github/browserAI/app/app/jobs/%5Bid%5D/page.tsx#L121)<br>[`app/api/jobs/[id]/route.ts:16`](file:///c:/Users/sr2ma/Documents/github/browserAI/app/api/jobs/%5Bid%5D/route.ts#L16)<br>[`components/threeui/uplink-execution-visualizer.tsx:128`](file:///c:/Users/sr2ma/Documents/github/browserAI/components/threeui/uplink-execution-visualizer.tsx#L128) | The UplinkLoader shader state (`PLANNING`, `RUNNING`, `VERIFYING`, `SUCCESS`, `BLOCKED`) is dynamically driven by real `job.status` fetched from the Prisma database via `GET /api/jobs/:id` polling. No hardcoded timer sequence is used on the active dashboard. |
| **3** | **Gemini intent classification & planning** | **PARTIALLY WIRED** | [`lib/ai/intent.ts:78`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/intent.ts#L78)<br>[`lib/ai/planner.ts:77`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/planner.ts#L77)<br>[`lib/ai/intent.ts:67`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/intent.ts#L67) | When `GEMINI_API_KEY` is present, it executes live structured Gemini 2.5 Flash API calls (`@google/genai`). However, if the API key is missing or invalid, an offline deterministic heuristic fallback activates silently to allow test suites to pass rather than failing fast in strict production mode. |
| **4** | **Playwright execution (8 Tools)** | **FUNCTIONAL** | [`worker/executor.ts:38`](file:///c:/Users/sr2ma/Documents/github/browserAI/worker/executor.ts#L38)<br>[`worker/browser.ts:60`](file:///c:/Users/sr2ma/Documents/github/browserAI/worker/browser.ts#L60) | All 8 tools (`browser.navigate`, `browser.inspect`, `browser.click`, `browser.fill`, `browser.press`, `browser.extractText`, `browser.screenshot`, `browser.getState`) execute against real Chromium instances in headless incognito browser contexts. Screenshots are saved to disk as real binary PNG files. Step count and elapsed times are calculated dynamically. |
| **5** | **Guards & Verifiers (4 Engines)** | **FUNCTIONAL** | [`lib/capabilities/guard.ts:73`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/capabilities/guard.ts#L73)<br>[`lib/verification/planValidator.ts:72`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/verification/planValidator.ts#L72)<br>[`worker/interaction-guard.ts:80`](file:///c:/Users/sr2ma/Documents/github/browserAI/worker/interaction-guard.ts#L80)<br>[`lib/verification/resultVerifier.ts:38`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/verification/resultVerifier.ts#L38) | All 4 guards are active and inspect real page and action states. Pre-flight Capability Guard halts private login and CAPTCHA bypass intents; Plan Validator rejects non-whitelisted domains and protocol violations; Interaction Guard auto-dismisses modal overlays and halts on verification walls; Result Verifier validates extracted DOM payloads. |
| **6** | **Recovery loop & retry bounds** | **FUNCTIONAL** | [`worker/recovery.ts:34`](file:///c:/Users/sr2ma/Documents/github/browserAI/worker/recovery.ts#L34)<br>[`worker/index.ts:133`](file:///c:/Users/sr2ma/Documents/github/browserAI/worker/index.ts#L133) | When the Result Verifier detects missing target data and returns `RECOVER`, the recovery loop re-enters Gemini for an alternate action plan, validates it through the Plan Validator, and retries with a strict 2-attempt cap before cleanly falling back to `PARTIAL`. |
| **7** | **Queue / Worker (BullMQ + Redis)** | **FUNCTIONAL** | [`lib/queue/jobQueue.ts:76`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/queue/jobQueue.ts#L76)<br>[`worker/index.ts:200`](file:///c:/Users/sr2ma/Documents/github/browserAI/worker/index.ts#L200) | `POST /api/jobs` returns immediately in ~20ms, decoupling request handling from browser execution. When Redis is running, BullMQ dispatches jobs to workers with configurable concurrency (`WORKER_CONCURRENCY=5`). |
| **8** | **Database persistence (Prisma)** | **FUNCTIONAL** | [`prisma/schema.prisma:9`](file:///c:/Users/sr2ma/Documents/github/browserAI/prisma/schema.prisma#L9)<br>[`lib/db/jobs.ts:29`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/db/jobs.ts#L29)<br>[`tests/run-db-persistence-test.ts:18`](file:///c:/Users/sr2ma/Documents/github/browserAI/tests/run-db-persistence-test.ts#L18) | Real relational persistence in SQLite (`dev.db`) / PostgreSQL. The `jobs`, `job_steps`, `observations`, and `artifacts` tables store complete execution records that survive server process restarts. |
| **9** | **Artifact storage (Screenshots)** | **FUNCTIONAL** | [`lib/storage/index.ts:20`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/storage/index.ts#L20)<br>[`app/api/artifacts/[jobId]/[filename]/route.ts:10`](file:///c:/Users/sr2ma/Documents/github/browserAI/app/api/artifacts/%5BjobId%5D/%5Bfilename%5D/route.ts#L10) | Screenshot image buffers are written directly to `storage/artifacts/<jobId>/<filename>` on the local filesystem. The DB stores only the `storageKey` path, and `/api/artifacts/:jobId/:filename` authenticates tenant ownership and serves the raw binary buffer. |
| **10** | **Authentication (NextAuth.js)** | **FUNCTIONAL** | [`lib/auth/authOptions.ts:7`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/auth/authOptions.ts#L7)<br>[`middleware.ts:3`](file:///c:/Users/sr2ma/Documents/github/browserAI/middleware.ts#L3)<br>[`app/login/page.tsx:32`](file:///c:/Users/sr2ma/Documents/github/browserAI/app/login/page.tsx#L32) | NextAuth handles JWT sessions, bcrypt password verification, and GitHub OAuth fallback. Next.js middleware gates `/app/:path*` routes and redirects unauthenticated users to `/login`. |
| **11** | **Multi-user tenant isolation** | **FUNCTIONAL** | [`lib/db/jobs.ts:43`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/db/jobs.ts#L43)<br>[`lib/auth/limits.ts:32`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/auth/limits.ts#L32)<br>[`tests/integration/multiUser.test.ts:11`](file:///c:/Users/sr2ma/Documents/github/browserAI/tests/integration/multiUser.test.ts#L11) | All job list queries, direct ID lookups, timeline event streams, artifact downloads, and cancellation endpoints enforce `job.userId === session.user.id`. Per-user concurrency limits (2 active jobs) and rate limits (20 jobs/hr) are enforced. |
| **12** | **Error/Status human messaging** | **FUNCTIONAL** | [`lib/verification/errorMapper.ts:33`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/verification/errorMapper.ts#L33)<br>[`components/execution/blocked-state-card.tsx:28`](file:///c:/Users/sr2ma/Documents/github/browserAI/components/execution/blocked-state-card.tsx#L28) | All internal Playwright timeouts, selector failures, and security guard halts map to the exact 7 human-readable error messages from §26 without exposing raw stack traces or internal enums to the client. |
| **13** | **Telemetry & UI metrics** | **PARTIALLY WIRED** | [`app/app/jobs/[id]/page.tsx:435`](file:///c:/Users/sr2ma/Documents/github/browserAI/app/app/jobs/%5Bid%5D/page.tsx#L435) | While duration (seconds) and step progress are 100% computed from real timestamps and observations, Level 3 "Estimated Tokens" (`Math.min(1200 + steps * 450, 6000)`) and "Memory" (`140 MB`) use heuristic formula approximations rather than container cgroup stats or Gemini token usage metadata. |

---

## 🔍 Codebase Sweep Results (Section 14)

1. **`lib/ai/intent.ts:67` & `lib/ai/planner.ts:87`**:
   - *Code*: `if (!ai) { return deterministicFallback; }`
   - *Judgment*: **REAL ISSUE (LOW RISK)** — Allows offline CI tests to run without API keys, but could mask a missing or malformed `GEMINI_API_KEY` in production by silently returning a deterministic test plan instead of throwing an explicit configuration error.
2. **`app/app/jobs/[id]/page.tsx:435`**:
   - *Code*: `tokensUsed={Math.min(1200 + job.observations.length * 450, 6000)} memoryMb={140}`
   - *Judgment*: **REAL ISSUE (POLISH)** — Level 3 worker metrics use a step-based estimation formula for tokens and memory instead of binding to exact `usageMetadata` from Gemini responses.
3. **`lib/queue/store.ts`**:
   - *Code*: In-memory `jobStore` singleton class.
   - *Judgment*: **FALSE POSITIVE / HARMLESS** — Dual-written in `worker/index.ts` from the pre-Prisma stage. The API routes and UI read strictly from Prisma DB (`prisma.job`), so this in-memory store is inert.
4. **`components/threeui/uplink-execution-visualizer.tsx:203`**:
   - *Code*: `interactiveControls` state stepper prop.
   - *Judgment*: **FALSE POSITIVE / HARMLESS** — An optional testing toolbar that is disabled by default on the `/app/jobs/[id]` execution dashboard. The live dashboard binds strictly to `job.status`.
5. **`components/execution/execution-logs.tsx:37` & `components/result/result-card.tsx:54`**:
   - *Code*: `setTimeout(() => setCopied(false), 2000)`
   - *Judgment*: **FALSE POSITIVE** — Standard clipboard "Copied!" button timeout, not simulating asynchronous backend work.
6. **`worker/browser.ts:117` & `worker/interaction-guard.ts:228`**:
   - *Code*: `await page.close().catch(() => {})`, `try { ... } catch {}`
   - *Judgment*: **FALSE POSITIVE** — Defensive cleanup handles already-closed browser pages or detached DOM elements during safe modal dismissal.

---

## 🎯 Priority Fix List

For the subsequent targeted fix pass, the findings are prioritized below:

### Priority 1: Core Flow & LLM Strictness
1. **Gemini Strict Mode vs Test Fallback ([lib/ai/intent.ts](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/intent.ts) & [lib/ai/planner.ts](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/planner.ts))**:
   - *Issue*: Silent fallback to deterministic plan when `GEMINI_API_KEY` is missing or invalid.
   - *Action*: In production environment (`NODE_ENV === "production"`), throw a clear `MISSING_GEMINI_API_KEY` configuration error instead of silently falling back to test data. Restrict deterministic mock fallback strictly to test runners (`NODE_ENV === "test"` or `IS_TEST_HARNESS === "true"`).

### Priority 2: Telemetry Precision
2. **Real Token Usage Metrics ([app/app/jobs/[id]/page.tsx](file:///c:/Users/sr2ma/Documents/github/browserAI/app/app/jobs/%5Bid%5D/page.tsx))**:
   - *Issue*: Estimated tokens and memory in Level 3 disclosure.
   - *Action*: Capture actual `response.usageMetadata.totalTokenCount` from Gemini 2.5 API responses in `lib/ai/planner.ts` and `lib/ai/synthesizer.ts`, store `tokensUsed` in `prisma.job`, and bind Level 3 metrics directly to the persisted token count.

### Priority 3: Code Cleanup & Legacy Deprecation
3. **Deprecate In-Memory `jobStore` ([lib/queue/store.ts](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/queue/store.ts))**:
   - *Issue*: Dual-writing to both Prisma DB and legacy in-memory cache.
   - *Action*: Remove `jobStore` updates from `worker/index.ts` and `lib/queue/jobQueue.ts`, relying 100% on Prisma database transactions.
