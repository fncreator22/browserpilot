# Specification: Autonomous Watch Limits Enforcement per Subscription Tier

Status: ready-for-human  
Labels: backend-fix, billing, discovery-engine  

## Overview
BrowserPilot advertises autonomous Watch limits per subscription tier:
- `FREE`: 1 active watch
- `PREMIUM`: 25 active watches
- `ENTERPRISE`: 500 active watches

While these numbers were listed in `Plan.maxWatches` and shown on the `/app/plans` pricing dashboard, investigation reveals that:
1. `POST /api/discovery/watch` performed zero entitlement or limit checks.
2. The `PlanCapability` system did not include a capability key for watch limits.
3. In PostgreSQL and Prisma schema, `DiscoveryWatch` had `userId String @unique`, making it physically impossible for any user (including Premium/Enterprise) to have more than 1 watch row without hitting a database unique constraint error (`discovery_watches_userId_key`).

## Diagnosing-Bugs Findings

### 1. Is the limit checked anywhere in the real request path?
**No.**
- In `app/api/discovery/watch/route.ts`, the `POST` handler simply called `upsertDiscoveryWatch(userId, { ... })` with no plan lookup, no capability check, and no usage counting.
- `lib/billing/usagePolicyService.ts` defined `evaluateUsageLimit(userId, "CREATE_WATCH")`, but this function was dead code and never imported or invoked by the watch route.

### 2. Is it wired through the PlanCapability system or a separate mechanism?
**Neither.**
- It was completely absent from `PlanCapability` and `lib/billing/entitlementService.ts`.
- It only existed as a passive column on `Plan.maxWatches` and in static plan definitions.
- Furthermore, the Prisma schema had `DiscoveryWatch.userId` marked `@unique`, and PostgreSQL had a unique index `discovery_watches_userId_key`. Any attempt to create a second watch row for the same user threw `P2002: Unique constraint failed on the constraint: discovery_watches_userId_key`.

## Proposed Solution

1. **Schema & Database Index Migration**:
   - In `prisma/schema.prisma`, update `DiscoveryWatch`:
     - Change `userId String @unique` to `userId String`
     - Add `name String @default("Autonomous Watch")` to give watches human-readable labels
     - Add `@@index([userId])`
     - Update `User`: change `discoveryWatch DiscoveryWatch?` to `discoveryWatches DiscoveryWatch[]`
   - In PostgreSQL, execute:
     - `DROP INDEX IF EXISTS "discovery_watches_userId_key";`
     - `CREATE INDEX IF NOT EXISTS "discovery_watches_userId_idx" ON "discovery_watches"("userId");`
   - Regenerate Prisma client (`npx prisma generate`).

2. **Extend `PlanCapability` in `lib/billing/entitlementService.ts`**:
   - Key: `MAX_ACTIVE_WATCHES`
   - Seeded limits:
     - `FREE`: enabled = true, limitValue = 1
     - `PREMIUM`: enabled = true, limitValue = 25
     - `ENTERPRISE`: enabled = true, limitValue = 500
     - Deny-by-default for unknown plans: 0
   - Fallback logic: check explicit `PlanCapability` row, fallback to `plan.maxWatches`, or hardcoded tier defaults.

3. **Multi-Watch Operations in `lib/db/opportunities.ts`**:
   - `getUserDiscoveryWatches(userId)`: returns all watches for the user.
   - `getDiscoveryWatch(userId, watchId?)`: returns the specific watch or the first active watch (preserving backwards compatibility).
   - `createDiscoveryWatch(userId, input)`: creates a new watch record.
   - `updateDiscoveryWatch(userId, watchId, input)`: updates a specific watch.
   - `deleteDiscoveryWatch(userId, watchId)`: deletes or disables a specific watch.
   - `countUserActiveWatches(userId)`: returns `prisma.discoveryWatch.count({ where: { userId, enabled: true } })`.

4. **Enforcement in `app/api/discovery/watch/route.ts`**:
   - `GET /api/discovery/watch`:
     - Returns `{ watch, watches, recentRuns, activeCount, maxWatches }`.
   - `POST /api/discovery/watch`:
     - If `body.id` / `body.watchId` is provided: updates that existing watch.
     - If creating a new watch:
       - Checks active count: `const activeCount = await countUserActiveWatches(userId)`.
       - Checks limit: `const maxWatches = await getCapabilityLimit(userId, "MAX_ACTIVE_WATCHES") ?? 1`.
       - If `activeCount >= maxWatches`: returns `HTTP 429 Too Many Requests`:
         ```json
         {
           "error": "QUOTA_EXCEEDED",
           "code": "ACTIVE_WATCH_LIMIT_EXCEEDED",
           "message": "You have reached your limit of 1 active watch on the FREE plan...",
           "currentUsage": 1,
           "limit": 1,
           "upgradeUrl": "/app/plans"
         }
         ```
       - Otherwise creates the new watch and returns `HTTP 201 Created` with `{ success: true, watch }`.

5. **TDD Test Suite**:
   - `tests/integration/watchLimitsEnforcement.test.ts`:
     - Step 1: Free user creates 1st watch -> succeeds (HTTP 200/201).
     - Step 2: Free user attempts to create 2nd watch -> blocked with HTTP 429 and `ACTIVE_WATCH_LIMIT_EXCEEDED`.
     - Step 3: Premium user creates 5 watches sequentially -> all 5 succeed without issue.

## Verified Test Results (TDD)
- Test suite: `tests/integration/watchLimitsEnforcement.test.ts`
  - Step 1: Free user creates 1st watch -> `HTTP 200`
  - Step 2: Free user creates 2nd watch -> `HTTP 429` with `ACTIVE_WATCH_LIMIT_EXCEEDED`
  - Step 3: Premium user creates 5 distinct watches -> all 5 created successfully (`id: cmtws8icg...`, `cmtws8jh...`, etc.)
  - Step 4: Confirmed 5 active watches in database for Premium user.
- Regression suites:
  - `tests/integration/monetizationEntitlement.test.ts`: PASSED
  - `tests/integration/monthlyAiQuotaEnforcement.test.ts`: PASSED
  - `tests/integration/concurrencyAndPriorityExecution.test.ts`: PASSED
  - `npm run typecheck`: PASSED (0 errors)
