# BrowserPilot — Test Ready & Quality Assurance Matrix

## Overview
BrowserPilot is covered by an automated test suite comprising **16 test suites** across Unit, Integration, and True End-to-End tiers. All tests execute against real runtime environments (including live Playwright Chromium contexts, Turso libSQL cloud adapter, encrypted auth sessions, and structured AI pipeline engines) with zero mock bypasses.

---

## 🚀 Test Runner Execution Commands

### Primary Test Runner
Run the master test matrix verifying all 16 test suites:
```bash
npm test
# Equivalent to:
npx tsx tests/run-all-tests.ts
```

### TypeScript Validation & Production Build
```bash
npm run typecheck    # Strict TypeScript check (tsc --noEmit)
npm run build        # Next.js Turbopack production compilation
```

### Individual Test Suite Commands
| Suite | Command |
|---|---|
| **Plan Validator** | `npx tsx tests/run-validator-test.ts` |
| **Capability Guard** | `npx tsx tests/run-guard-test.ts` |
| **Result Verifier** | `npx tsx tests/run-verifier-recovery-test.ts` |
| **Error Mapper (§26)** | `npx tsx tests/run-error-mapper-test.ts` |
| **Auth & Minimal Schema** | `npx tsx tests/run-auth-test.ts` |
| **Playwright Executor** | `npx tsx tests/run-executor-test.ts` |
| **Multi-User Isolation** | `npx tsx tests/run-multi-user-isolation-test.ts` |
| **Autonomous E2E Pipeline**| `npx tsx tests/run-toolcall-e2e.ts` |
| **Turso Cloud DB Verification** | `npx tsx tests/verify-turso-cloud.ts` |

---

## 📊 16-Suite Test Matrix Summary

### 1. Unit Test Suites (8 Suites)

1. **Unit: Plan Validator** (`tests/unit/planValidator.test.ts`)
   - Validates JSON schema integrity, action taxonomy constraints (`navigate`, `click`, `fill`, `extract`, `screenshot`), URL sanity, and step limits.
   - Rejects illegal payloads and malformed plans.

2. **Unit: Capability Guard** (`tests/unit/capabilityGuard.test.ts`)
   - Enforces security boundaries: blocks non-navigable protocols (`file://`, `ftp://`), dangerous internal endpoints (`localhost`, `169.254.169.254`), and blacklisted malicious domains.

3. **Unit: Result Verifier** (`tests/unit/resultVerifier.test.ts`)
   - Verifies execution outcomes against task criteria.
   - Evaluates screenshot capture fidelity and DOM content extraction completeness.

4. **Unit: Error Mapper (§26)** (`tests/unit/errorMapper.test.ts`)
   - Normalizes raw runtime and browser exceptions into user-friendly diagnostic codes and actionable guidance.

5. **Unit: Gemini Key Fallback Guard** (`tests/unit/geminiGuard.test.ts`)
   - Validates precedence of user-supplied BYOK (Bring-Your-Own-Key) Gemini API keys over system environment variables.

6. **Unit: Email/Password Auth & Minimal Schema** (`tests/unit/auth.test.ts`)
   - Tests bcrypt password hashing, JWT credentials authorization, duplicate email rejection, and user profile data serialization.

7. **Unit: 24-Hour Auto-Purge & Retention** (`tests/unit/cleanup.test.ts`)
   - Validates automatic background purging of expired jobs (older than 24 hours) and associated disk artifacts while preserving active and recent records.

8. **Unit: Fast-Calculated Time Budget** (`tests/unit/timeBudget.test.ts`)
   - Verifies dynamic duration allocation (base 45s up to 300s ceiling) based on task heuristics (visual capture, multi-domain, form complexity).

---

### 2. Integration Test Suites (7 Suites)

9. **Integration: Playwright Executor & Fixture** (`tests/integration/executor.test.ts`)
   - Exercises real Chromium context lifecycle, automated modal/overlay dismissals, DOM clicks, keyboard inputs, text extractions, and full-page screenshot persistence.

10. **Integration: Multi-User Isolation & Limits** (`tests/integration/multiUser.test.ts`)
    - Validates tenant separation across job lists, prevents cross-tenant artifact viewing, blocks unauthorized job modifications, and enforces per-tenant concurrent job caps.

11. **Integration: Real Concurrent User Isolation** (`tests/integration/concurrentUserIsolation.test.ts`)
    - Spins up 3 concurrent tenant accounts executing simultaneous pipelines with independent browser storage, cookies, and database state.

12. **Integration: Worker Concurrency Limit & Queue Throttling** (`tests/integration/workerConcurrencyLimit.test.ts`)
    - Validates queue throttling and limits concurrent browser instances to worker thresholds without resource exhaustion.

13. **Integration: Time Budget Watchdog & Timeout** (`tests/integration/timeBudgetWatchdog.test.ts`)
    - Verifies that hung tasks are cleanly terminated at assigned budget bounds and marked with diagnostic timeouts.

14. **Integration: Immediate Real Failure Propagation** (`tests/integration/immediateFailurePropagation.test.ts`)
    - Confirms that fatal errors (e.g. security policy violations, unreachable hostnames) fail immediately without spinning through unnecessary timeouts.

15. **Integration: Real Job Cancellation & Orphan Process Checks** (`tests/integration/jobCancellation.test.ts`)
    - Verifies cancellation of queued and in-flight jobs, ensuring Chromium processes are immediately terminated with zero orphaned browser sessions.

---

### 3. End-to-End Autonomous Pipeline (1 Suite)

16. **E2E: Full Autonomous Agent Pipeline** (`tests/e2e/autonomousPipeline.test.ts`)
    - Executes the entire lifecycle: natural language goal → intent classification → security capability checks → structured plan generation → real Playwright execution → artifact generation → structured answer synthesis.

---

## 🛡️ Production Assurance & Architecture

- **Database**: Cloud Turso Database via `@prisma/adapter-libsql` and `@libsql/client` (zero native C++ bindings, 100% serverless compatible).
- **Serverless Resilience**: Active SSE streams and direct execution routes (`/api/jobs/[id]/execute`) prevent serverless background freezing on Vercel Serverless Lambdas.
- **Frontend / UI**: Modern Next.js 16 (Turbopack) App Router with `@base-ui/react`, Tailwind CSS, and Lucide React.
- **AI Engine**: `@google/genai` with model routing targeting active `gemini-3.6-flash`.
