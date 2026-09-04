# TASK-066 — Notification Scoping + Ashby Classifier Hardening Architecture Document

## Status

- **Task:** TASK-066
- **Name:** Notification Scoping + Ashby Classifier Hardening
- **Status:** COMPLETED & PHYSICALLY VERIFIED
- **Depends on:** TASK-065
- **AWS Infrastructure:** STRICTLY LOCKED — Zero AWS provisioning, deployment, mutation, scaling, or cloud configuration changes.
- **Ponytail Optimization:** MANDATORY — Zero new npm dependencies, minimal code changes, zero speculative abstraction.
- **Verification Result:** 16/16 Physical Scenarios Passed | Regression 21/21 (TASK-062), 21/21 (TASK-063), 10/10 (TASK-064), 13/13 (TASK-065) | Typecheck 0 Errors | Turbopack Production Build Passed Cleanly.

---

## 1. Executive Summary

Forensic runtime audits under TASK-062 and architectural implementations in TASK-063 through TASK-065 established:
- Verification sandboxing & liveliness checks
- Elimination of synthetic mock connectors and fabricated candidate data
- Authoritative interactive AI usage accounting
- End-to-end cancellation signal propagation

However, two critical production correctness gaps remained in the system:

1. **Unscoped Notification Association (`findFirst()` Arbitrary Fallback):**
   In `lib/discovery/lifecycle/opportunityNotificationService.ts`, when a notification event did not carry an explicit `opportunityId` (e.g. system notifications, search cancellations, global crawl updates), the code previously executed:
   ```typescript
   const opportunity = await prisma.opportunity.findFirst({
     where: { userId: user.id },
     orderBy: { updatedAt: "desc" },
   });
   ```
   This caused global, non-opportunity notifications to be arbitrarily attached to the user's most recently touched opportunity. If the user had no opportunities, notification creation failed or panicked. If the user had opportunities, notifications about general system alerts or search status appeared inside specific opportunity dossiers, creating confusion and invalid data associations.

2. **Ashby URL Misclassification (`/application` classified as `JOB_DETAIL`):**
   In `lib/scraper/normalizer.ts`, Ashby ATS URLs pointing directly to application forms (such as `https://jobs.ashbyhq.com/company/12345/application` or URLs ending in `/application` / `/apply`) were misclassified by regex patterns as `JOB_DETAIL`. Consequently, application forms bypassed the application portal filter, were sent to content scraping pipelines as if they were job description pages, and failed extraction or polluted candidate records with application input field schemas.

TASK-066 eliminates both defects with surgical precision:
- **Zero Fallback & Nullable Notifications:** `opportunityId` on `LifecycleAlert` is now nullable (`String?`). Global/system notifications store `opportunityId: null`. Opportunity-dependent notification types strictly require a valid opportunity, or creation is truthfully rejected.
- **Tenant-Safe Opportunity Authorization:** When `opportunityId` is supplied, the service strictly verifies that the opportunity is associated with the requesting user (`isOpportunityAuthorizedForUser`) before creating the alert, preventing cross-tenant information disclosure.
- **Ashby Classifier Hardening:** The classifier in `lib/scraper/normalizer.ts` explicitly inspects path segments for `application` and `apply`, classifying them as `APPLICATION_PORTAL` before job detail regexes can erroneously match them.

---

## 2. Notification Scoping Architecture & Lifecycle Invariants

### 2.1 Elimination of `prisma.opportunity.findFirst()`
In `lib/discovery/lifecycle/opportunityNotificationService.ts`, the arbitrary fallback query has been completely removed. The service now respects whether an event is intrinsically tied to an opportunity:

```text
Notification Event Request
         │
         ├─── Has opportunityId?
         │         │
         │         ├── YES ──► Tenant Authorization Check (isOpportunityAuthorizedForUser)
         │         │                 │
         │         │                 ├── Authorized ────► Link Alert to exact opportunityId
         │         │                 └── Unauthorized ──► REJECT (created: false, 0 leakage)
         │         │
         │         └── NO ───► Is event type OPPORTUNITY_REQUIRED?
         │                           │
         │                           ├── YES ──► REJECT (created: false, cannot create without opportunity)
         │                           └── NO ───► Create Alert with opportunityId: null (Global/System Scope)
```

### 2.2 Notification Type Taxonomy
Notification types are partitioned into two strict categories:

1. **Opportunity-Required Types:**
   - `NEW_MATCH`
   - `OPPORTUNITY_UPDATED`
   - `OPPORTUNITY_EXPIRING`
   - `OPPORTUNITY_EXPIRED`
   *Invariant:* If `opportunityId` is not provided or null for these types, the alert creation is rejected (`{ created: false }`).

2. **Opportunity-Independent Types:**
   - `SYSTEM`
   - `SEARCH_CANCELLED`
   - `SEARCH_COMPLETED`
   - `DISCOVERY_UPDATE`
   *Invariant:* If `opportunityId` is null, the alert is stored with `opportunityId: null`, `previousStatus: "SYSTEM"`, `newStatus: "SYSTEM"`, and `companyName: "System"`.

### 2.3 Multi-Tenant Opportunity Verification
To guarantee tenant isolation, `isOpportunityAuthorizedForUser` queries tenant association across all relevant relationship tables:
- `savedOpportunity` (user saved or tracked this opportunity)
- `searchResult` (opportunity discovered in user's search session)
- `opportunityDiscoveryEvent` (discovery event generated for user's search)
- `lifecycleAlert` (existing alert for this opportunity under this user)

If an opportunity is not associated with the user, access is denied and no alert is created.

---

## 3. Ashby Classifier Hardening

### 3.1 Root Cause
Ashby uses URLs of the form:
- Job Detail: `https://jobs.ashbyhq.com/{company}/{jobId}`
- Application Portal: `https://jobs.ashbyhq.com/{company}/{jobId}/application`
- Direct Apply: `https://jobs.ashbyhq.com/{company}/{jobId}/apply`

The existing regex in `classifyJobUrl` matched `{company}/{jobId}` paths as `JOB_DETAIL`. Because `/application` was appended as a sub-path, overly greedy job detail patterns or earlier pattern evaluations classified the URL as `JOB_DETAIL` before application portal rules were evaluated.

### 3.2 Hardened Implementation
In `lib/scraper/normalizer.ts`:
```typescript
// Explicit ATS application portal detection for Ashby, Greenhouse, Lever, Workday
if (
  segments.includes("application") ||
  segments.includes("apply") ||
  segments[segments.length - 1] === "application" ||
  segments[segments.length - 1] === "apply" ||
  path.endsWith("/application") ||
  path.endsWith("/apply")
) {
  return "APPLICATION_PORTAL";
}
```

This ensures that:
- `https://jobs.ashbyhq.com/company/12345/application` &rarr; `APPLICATION_PORTAL`
- `https://jobs.ashbyhq.com/company/12345/apply` &rarr; `APPLICATION_PORTAL`
- `https://jobs.ashbyhq.com/company/12345/application?src=linkedin` &rarr; `APPLICATION_PORTAL`
- `https://jobs.ashbyhq.com/company/12345` &rarr; `JOB_DETAIL`
- Redirected URLs terminating at `/application` &rarr; `APPLICATION_PORTAL` (unverified by sandbox truth gate)

---

## 4. Database Schema & Migration Details

### 4.1 Schema Modification
In `prisma/schema.prisma`:
```prisma
model LifecycleAlert {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunityId   String?
  opportunity     Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  type            String
  ...
}
```

### 4.2 Safe SQLite Table Swap Migration
In SQLite/libSQL, `ALTER TABLE ALTER COLUMN` is not supported for removing a `NOT NULL` constraint. In `lib/db/prisma.ts`, `ensureDatabaseSchema` was enhanced to dynamically inspect column metadata (`PRAGMA table_info(lifecycle_alerts)`). If `notnull === 1` is detected on `opportunityId`:
1. Creates temporary table `lifecycle_alerts_task066_swap` with `opportunityId TEXT` (nullable).
2. Copies all existing records across.
3. Drops the old `lifecycle_alerts` table.
4. Renames `lifecycle_alerts_task066_swap` to `lifecycle_alerts`.
5. Re-creates all indexes (`idx_lifecycle_alerts_user_created`, `idx_lifecycle_alerts_opp_type`).
6. Preserves existing data and foreign keys cleanly.

---

## 5. Physical Verification & Acceptance Matrix

Validation was executed via the comprehensive physical test harness:
`scratch/task066NotificationAshbyValidation.ts`

| Scenario | Description | Result |
|---|---|---|
| **SCENARIO 1** | Null opportunityId creates system alert with `opportunityId: null`; invalid null opp rejected | **PASS** |
| **SCENARIO 2** | Exact opportunityId correctly links alert to exact opportunity without fallback | **PASS** |
| **SCENARIO 3** | Cross-tenant opportunity access strictly blocked (0 leakage) | **PASS** |
| **SCENARIO 4** | Search cancellation notification preserves `opportunityId: null` safely | **PASS** |
| **SCENARIO 5** | Discovery notification accurately links to discovered opportunity | **PASS** |
| **SCENARIO 6** | Zero `prisma.opportunity.findFirst()` calls observed across all execution paths | **PASS** |
| **SCENARIO 7** | Ashby `/application` endpoint correctly classified as `APPLICATION_PORTAL` | **PASS** |
| **SCENARIO 8** | Genuine Ashby job detail URL correctly classified as `JOB_DETAIL` | **PASS** |
| **SCENARIO 9** | Ashby URL with query parameters correctly classified as `APPLICATION_PORTAL` | **PASS** |
| **SCENARIO 10** | Redirected Ashby application URL correctly classified as `APPLICATION_PORTAL` and rejected by truth gate | **PASS** |
| **SCENARIO 11** | TASK-063 Verification Sandbox Regression Suite (21/21 passed) | **PASS** |
| **SCENARIO 12** | TASK-064 Synthetic Data Purge Regression Suite (10/10 passed) | **PASS** |
| **SCENARIO 13** | TASK-065 Interactive Usage Cancellation Regression Suite (13/13 passed) | **PASS** |
| **SCENARIO 14** | TASK-062 Forensic Runtime Audit Regression Suite (21/21 passed) | **PASS** |
| **SCENARIO 15** | Full TypeScript Typecheck (`npm run typecheck`: 0 errors) | **PASS** |
| **SCENARIO 16** | Production Build Verification (`npm run build`: Turbopack build succeeds cleanly) | **PASS** |

**Final Verification Summary:**
- Task Validation: **16/16 Passed (100%)**
- Total Combined Regression Scenarios: **81/81 Passed**
- TypeScript Errors: **0**
- Production Build: **CLEAN**

---

## 6. Ponytail Constraints & Cloud Invariant Sign-Off

- **AWS Infrastructure:** Strictly locked. 0 cloud mutations, 0 AWS SDK calls, 0 infrastructure configuration changes.
- **Dependencies:** 0 new npm dependencies added.
- **Code Footprint:** Minimal, surgical changes confined strictly to the identified defects.
- **UI Integrity:** UI components updated defensively to tolerate `opportunityId: null` without redesign or layout breakage.
