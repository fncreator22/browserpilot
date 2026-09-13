# Specification: AI Token and Monthly Operations Quota Enforcement

Status: ready-for-human  
Labels: billing, backend-fix, discovery-engine  

## Overview
BrowserPilot defines subscription tiers (`FREE`, `PREMIUM`, `ENTERPRISE`) with defined limits on monthly AI operations (`Plan.maxMonthlyAIOperations`: 100 for FREE, 2,500 for PREMIUM, 50,000 for ENTERPRISE). While these fields exist in the database and Prisma schema, they are not currently enforced in the primary search request path (`POST /api/search`), allowing free-tier users to trigger unlimited AI-assisted searches.

This effort extends the server-authoritative `PlanCapability` system built in TASK-070 with a new `MONTHLY_AI_OPERATIONS` capability key to enforce quota limits prior to dispatching searches.

---

## Clarifying Questions (Grilling Round 1)

### ❓ Q1 - Reset Period Boundary: Calendar-Month vs Rolling 30-Day vs Billing Cycle
When does a user's monthly AI operation count reset?
- **Option A (Calendar-Month)**: Resets on the 1st of every calendar month at 00:00:00 UTC for all users.
- **Option B (Rolling 30 Days)**: Considers the last 30 days (`timestamp >= Date.now() - 30 * 86400 * 1000`).
- **Option C (Subscription Billing Cycle with Free Fallback)**: For paid subscribers, resets on their active `subscription.currentPeriodStart` date; for Free users (no active subscription), resets on the 1st of the calendar month.

➡️ **Recommended Answer**: **Option C** (Subscription billing cycle for paid users, calendar month for Free tier). This prevents paid users from experiencing mid-cycle quota resets out-of-sync with their billing invoice, while keeping Free-tier resets predictable on the 1st of each month.

---

### ❓ Q2 - Quota Counting Unit: Search Runs vs Underlying LLM Calls vs Raw Tokens
What constitutes one consumed unit of `MONTHLY_AI_OPERATIONS`?
- **Option A (Per Discovery Search)**: Each AI-assisted search run counts as 1 operation against the quota.
- **Option B (Per AIUsageEvent Record)**: Each individual LLM call (e.g. intent parsing, prompt enhancement, dossier synthesis) creates an `AIUsageEvent` and increments the operations counter by 1.
- **Option C (Token-Weighted Operations)**: Sum of `totalTokens` divided by an exchange factor.

➡️ **Recommended Answer**: **Option B** (Per `AIUsageEvent` record). BrowserPilot's database model already records granular `AIUsageEvent` entries with `provider`, `model`, `promptTokens`, and `completionTokens`. Counting `AIUsageEvent` rows directly reflects real AI workloads and aligns with `lib/billing/usagePolicyService.ts` (`prisma.aIUsageEvent.count({ where: { userId, timestamp: { gte: periodStart } } })`).

---

### ❓ Q3 - Handling In-Progress Searches when Quota is Depleted
What happens if a user starts a search with quota remaining, but consumes the final allowed operation during execution?
- **Option A (Upfront Gate Check)**: Check quota before queueing/dispatching the search in `POST /api/search`. If the user has at least 1 operation remaining, the search is admitted and allowed to finish.
- **Option B (Mid-Execution Hard Abort)**: Every intermediate LLM call checks quota; if exhausted mid-search, throws a quota error and halts execution.
- **Option C (Graceful Degradation to Deterministic Discovery)**: If quota is exhausted before or during search, degrade to 100% deterministic regex parsing and raw ATS connectors without external LLM calls.

➡️ **Recommended Answer**: **Option A** (Upfront gate check at search dispatch) with **Option C** as fallback. Rejecting upfront with a clean error prevents partial broken states and wasted compute, while deterministic zero-cost parsing remains available for basic lookups.

---

### ❓ Q4 - User Experience: Warning Thresholds vs Hard Limit Rejection Shape
How should approaching or reaching the quota be communicated to the client?
- **Rejection Shape**: Mirror the `MAX_CONCURRENT_SEARCHES` pattern:
  - HTTP `429 Too Many Requests` (or `403 Forbidden`)
  - Payload:
    ```json
    {
      "error": "QUOTA_EXCEEDED",
      "code": "MONTHLY_AI_OPERATIONS_LIMIT_EXCEEDED",
      "message": "You have reached your monthly AI operations limit of 100 for the FREE plan. Resets on 2026-10-01.",
      "currentUsage": 100,
      "limit": 100,
      "upgradeUrl": "/app/plans"
    }
    ```
- **Warning Headers / Metadata**: Include `x-quota-remaining` and `x-quota-limit` headers, or return a warning in the search response when usage exceeds 80%.

➡️ **Recommended Answer**: Hard rejection with HTTP 429 using the exact schema above, plus returning `quota: { used, limit, remaining }` in `/api/account/usage` and `/api/search` response metadata.

---

### ❓ Q5 - BYOK (Bring Your Own Key) Policy
Does usage of personal API keys (user's custom Gemini API key or Puter token configured in user settings) count against the platform's `MONTHLY_AI_OPERATIONS` quota?
- **Option A (Platform Quota Only)**: BYOK calls bypass the platform quota since the user pays Google/Puter directly and BrowserPilot incurs zero LLM API cost.
- **Option B (Strict Plan Metering)**: All AI features are metered by plan tier regardless of whether platform keys or BYOK keys are used.

➡️ **Recommended Answer**: **Option A** (BYOK calls bypass platform quota or have unlimited operations). This strongly incentivizes users to adopt BYOK, lowers BrowserPilot's platform inference costs, and is a common standard in developer tools.

---

## Planned Technical Implementation

1. **Seed `MONTHLY_AI_OPERATIONS` into `PlanCapability`**:
   - `FREE`: enabled = true, limitValue = 100
   - `PREMIUM`: enabled = true, limitValue = 2,500
   - `ENTERPRISE`: enabled = true, limitValue = 50,000
   - Deny-by-default for missing plans or unseeded capabilities.
2. **Quota Evaluation Service**:
   - Query user's current period usage from `AIUsageEvent` (or fallback to `Search` count if LLM wasn't invoked).
   - Compare against `getCapabilityLimit(userId, "MONTHLY_AI_OPERATIONS")`.
3. **Integration in `POST /api/search`**:
   - Prior to queueing or dispatching `swarmDiscovery`, check `MONTHLY_AI_OPERATIONS`.
   - Reject with HTTP 429 if at or above limit.
4. **TDD Test Suite**:
   - Write integration test reproducing free-tier user at 100 operations.
   - Assert rejection with clear metadata and upgrade prompt.
   - Verify premium upgrade unblocks search.

## Verified Test Results (TDD)

Integration test: [`tests/integration/monthlyAiQuotaEnforcement.test.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/tests/integration/monthlyAiQuotaEnforcement.test.ts)

1. **Step 1: Free-Tier Quota Block**
   - User with 100 `AIUsageEvent` rows in the current calendar month attempted a search.
   - Route rejected with `HTTP 429 Too Many Requests`.
   - Payload:
     ```json
     {
       "error": "QUOTA_EXCEEDED",
       "code": "MONTHLY_AI_OPERATIONS_LIMIT_EXCEEDED",
       "message": "You have reached your monthly AI operations limit of 100...",
       "currentUsage": 100,
       "limit": 100,
       "resetsAt": "...",
       "upgradeUrl": "/app/plans"
     }
     ```
   - Headers verified: `x-quota-remaining: 0`, `x-quota-limit: 100`.

2. **Step 2: BYOK Bypass**
   - BYOK user with 100 operations attempted a search.
   - Bypassed platform `MONTHLY_AI_OPERATIONS` quota and dispatched search successfully (`HTTP 200`).

3. **Step 3: BYOK Concurrency Enforcement**
   - Same BYOK user with an active `RUNNING` search attempted a second concurrent search.
   - Route rejected with `HTTP 429` and `error: "CONCURRENT_SEARCH_LIMIT_EXCEEDED"`.
   - Concurrency limits (`MAX_CONCURRENT_SEARCHES = 1` for Free) strictly apply to BYOK users.

4. **Step 4: Premium Plan Upgrade**
   - Blocked Free user upgraded to `PREMIUM` (`limitValue: 2,500`).
   - Re-attempted search succeeded with `HTTP 200`.

5. **Regression Verification**:
   - [`tests/integration/concurrencyAndPriorityExecution.test.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/tests/integration/concurrencyAndPriorityExecution.test.ts) passed with 100% success.
   - `npm run typecheck` passed with 0 errors.
