/**
 * §TASK-066 PHYSICAL VALIDATION HARNESS: NOTIFICATION SCOPING & ASHBY CLASSIFIER HARDENING
 * 
 * Verifies:
 * 1. Null opportunity notification creates opportunity-independent alert (opportunityId = null).
 * 2. Exact opportunity notification creates alert referencing exact opportunityId.
 * 3. Cross-tenant opportunity protection: rejects attaching another tenant's opportunity.
 * 4. Cancellation notification creates alert with opportunityId = null.
 * 5. Discovery notification references exact discovered opportunity.
 * 6. Zero arbitrary findFirst() fallback invocations across all notification paths.
 * 7. Ashby application URL classified as APPLICATION_PORTAL.
 * 8. Real Ashby job-detail URL classified as JOB_DETAIL.
 * 9. Ashby application URL with query parameters classified as APPLICATION_PORTAL.
 * 10. Redirected Ashby URL classified truthfully as APPLICATION_PORTAL.
 * 11. TASK-063 regression suite (21/21 passed).
 * 12. TASK-064 regression suite (10/10 passed).
 * 13. TASK-065 regression suite (13/13 passed).
 * 14. TASK-062 forensic audit regression suite (21/21 passed).
 * 15. TypeScript typecheck passes with 0 errors.
 * 16. Production build passes cleanly.
 */

import assert from "assert";
import http from "http";
import { execSync } from "child_process";
import { prisma, ensureDatabaseSchema } from "../lib/db/prisma";
import { opportunityNotificationService } from "../lib/discovery/lifecycle/opportunityNotificationService";
import { classifyJobUrl } from "../lib/scraper/normalizer";
import { urlLivelinessVerifier } from "../lib/ai/verification/urlLivelinessVerifier";
import { upsertOpportunity } from "../lib/db/opportunities";

async function runTask066Validation() {
  console.log("================================================================================");
  console.log("   TASK-066: NOTIFICATION SCOPING + ASHBY CLASSIFIER HARDENING VALIDATION       ");
  console.log("================================================================================\n");

  await ensureDatabaseSchema();

  // Setup isolated test users
  const timestamp = Date.now();
  const user1 = await prisma.user.create({
    data: {
      email: `task066-user1-${timestamp}@example.com`,
      passwordHash: "test_hash_task066_1",
      name: "Task066 User 1",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: `task066-user2-${timestamp}@example.com`,
      passwordHash: "test_hash_task066_2",
      name: "Task066 User 2",
    },
  });

  let passedCount = 0;

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Null Opportunity Notification
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 1] Null Opportunity Notification...");
  {
    // Valid user-level / system notification with opportunityId = null
    const res = await opportunityNotificationService.emitNotification({
      userId: user1.id,
      opportunityId: null,
      type: "SYSTEM_ALERT",
      title: "System Maintenance Notice",
      message: "Scheduled maintenance will occur tonight.",
    });

    assert.strictEqual(res.created, true, "System notification must be created");
    assert.ok(res.notificationId, "Must return notificationId");

    const alert = await prisma.lifecycleAlert.findUnique({
      where: { id: res.notificationId! },
    });

    assert.ok(alert, "Alert record must exist in database");
    assert.strictEqual(alert.opportunityId, null, "Alert opportunityId must remain null");
    assert.strictEqual(alert.userId, user1.id, "Alert must be scoped to user1");

    // Opportunity-required notification type with null opportunityId must be truthfully rejected
    const rejectedRes = await opportunityNotificationService.emitNotification({
      userId: user1.id,
      opportunityId: null,
      type: "NEW_MATCH",
      title: "New Match Without Job",
      message: "Should be rejected because NEW_MATCH requires a real opportunity",
    });

    assert.strictEqual(rejectedRes.created, false, "Opportunity-required type with null opportunityId must be rejected");

    passedCount++;
    console.log("  ✓ System notification created with opportunityId: null; invalid null opp rejected");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Exact Opportunity Notification
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 2] Exact Opportunity Notification...");
  {
    const opp1 = await upsertOpportunity({
      canonicalHash: `task066_hash_user1_${timestamp}`,
      title: "Senior AI Platform Engineer",
      companyName: "Cognitive Labs",
      location: "San Francisco, CA",
      description: "Build distributed AI pipelines",
      primaryApplyUrl: "https://cognitivelabs.ai/apply",
    });

    // Associate opp1 with user1 via savedOpportunity
    await prisma.savedOpportunity.create({
      data: {
        userId: user1.id,
        opportunityId: opp1.id,
      },
    });

    const res = await opportunityNotificationService.emitNotification({
      userId: user1.id,
      opportunityId: opp1.id,
      type: "NEW_MATCH",
      title: "New Matching Job Found",
      message: "Found a role matching your preferences.",
    });

    assert.strictEqual(res.created, true, "Notification for legitimate opportunity must be created");
    assert.ok(res.notificationId, "Must return notificationId");

    const alert = await prisma.lifecycleAlert.findUnique({
      where: { id: res.notificationId! },
    });

    assert.ok(alert, "Alert record must exist in database");
    assert.strictEqual(alert.opportunityId, opp1.id, "Alert must reference exact supplied opportunityId");
    assert.strictEqual(alert.companyName, "Cognitive Labs", "Alert must reflect opportunity company name");

    passedCount++;
    console.log("  ✓ Notification references exact supplied opportunity ID and metadata");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Cross-Tenant Opportunity Protection
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 3] Cross-Tenant Opportunity Protection...");
  {
    const oppUser2 = await upsertOpportunity({
      canonicalHash: `task066_hash_user2_${timestamp}`,
      title: "Confidential Lead Cryptographer",
      companyName: "Stealth Stealth Co",
      location: "Remote",
      description: "User 2 exclusive opportunity",
      primaryApplyUrl: "https://stealthco.com/apply",
    });

    // Save exclusively under user2
    await prisma.savedOpportunity.create({
      data: {
        userId: user2.id,
        opportunityId: oppUser2.id,
      },
    });

    // User 1 attempts to create notification referencing User 2's exclusive opportunity
    const unauthorizedRes = await opportunityNotificationService.emitNotification({
      userId: user1.id,
      opportunityId: oppUser2.id,
      type: "OPPORTUNITY_UPDATED",
      title: "Unauthorized Opportunity Update",
      message: "User 1 trying to trigger alert for User 2 opportunity",
    });

    assert.strictEqual(unauthorizedRes.created, false, "Cross-tenant opportunity notification must be rejected");

    // Verify User 1 did NOT receive an alert for User 2's opportunity
    const foreignAlert = await prisma.lifecycleAlert.findFirst({
      where: {
        userId: user1.id,
        opportunityId: oppUser2.id,
      },
    });
    assert.strictEqual(foreignAlert, null, "Foreign opportunity must never be attached to User 1");

    passedCount++;
    console.log("  ✓ Cross-tenant opportunity access strictly blocked with zero data leakage");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Cancellation Notification Safety
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 4] Cancellation Notification Safety...");
  {
    const res = await opportunityNotificationService.emitNotification({
      userId: user1.id,
      opportunityId: null,
      type: "SEARCH_CANCELLED",
      title: "Search Stopped",
      message: "Your search was stopped upon request.",
      metadata: { searchId: `search_cancel_${timestamp}` },
    });

    assert.strictEqual(res.created, true, "Cancellation notification must be created successfully");
    assert.ok(res.notificationId, "Must return notificationId");

    const alert = await prisma.lifecycleAlert.findUnique({
      where: { id: res.notificationId! },
    });

    assert.ok(alert, "Cancellation alert must exist in database");
    assert.strictEqual(alert.opportunityId, null, "Cancellation alert opportunityId must remain null");
    assert.strictEqual(alert.transitionType, "SEARCH_CANCELLED", "Transition type must match");

    passedCount++;
    console.log("  ✓ Cancellation notification safely preserved with opportunityId: null");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Discovery Notification
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 5] Discovery Notification Safety...");
  {
    const discoveredOpp = await upsertOpportunity({
      canonicalHash: `task066_hash_discovered_${timestamp}`,
      title: "Founding ML Scientist",
      companyName: "Neural Vector",
      location: "Zurich / Remote",
      description: "Autonomous discovery candidate",
      primaryApplyUrl: "https://neuralvector.ch/jobs/ml-1",
    });

    // Create search and searchResult linking discoveredOpp to user1
    const userSearch = await prisma.search.create({
      data: {
        userId: user1.id,
        rawQuery: "Founding ML Scientist",
        status: "COMPLETED",
      },
    });

    await prisma.searchResult.create({
      data: {
        searchId: userSearch.id,
        opportunityId: discoveredOpp.id,
        matchScore: 94.5,
        rankPosition: 1,
      },
    });

    const res = await opportunityNotificationService.emitNotification({
      userId: user1.id,
      opportunityId: discoveredOpp.id,
      type: "NEW_MATCH",
      title: "Discovered New Match",
      message: `Founding ML Scientist at Neural Vector`,
    });

    assert.strictEqual(res.created, true, "Discovery notification must succeed for discovered opportunity");
    assert.ok(res.notificationId, "Must return notificationId");

    const alert = await prisma.lifecycleAlert.findUnique({
      where: { id: res.notificationId! },
    });

    assert.ok(alert, "Discovery alert must exist");
    assert.strictEqual(alert.opportunityId, discoveredOpp.id, "Alert must reference discovered opportunity ID");

    passedCount++;
    console.log("  ✓ Discovery notification accurately linked to exact discovered opportunity");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: No Arbitrary findFirst Fallback
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 6] Verification of Zero findFirst() Invocations...");
  {
    let findFirstCount = 0;
    const originalFindFirst = prisma.opportunity.findFirst;

    // Spy on prisma.opportunity.findFirst
    (prisma.opportunity as any).findFirst = async (...args: any[]) => {
      findFirstCount++;
      return (originalFindFirst as any).apply(prisma.opportunity, args);
    };

    try {
      // 1. Call with null opportunityId
      await opportunityNotificationService.emitNotification({
        userId: user1.id,
        opportunityId: null,
        type: "SYSTEM_ALERT",
        title: "Probe System Alert",
        message: "Probing findFirst invocation",
        metadata: { idempotencyKey: `probe_null_${timestamp}` },
      });

      // 2. Call with non-existent opportunityId
      await opportunityNotificationService.emitNotification({
        userId: user1.id,
        opportunityId: "completely_fictional_opp_id_999",
        type: "NEW_MATCH",
        title: "Probe Nonexistent Opp",
        message: "Probing findFirst invocation",
        metadata: { idempotencyKey: `probe_nonexistent_${timestamp}` },
      });

      // 3. Call with another tenant's opportunityId
      await opportunityNotificationService.emitNotification({
        userId: user1.id,
        opportunityId: "some_unrelated_opp_id",
        type: "OPPORTUNITY_UPDATED",
        title: "Probe Cross-Tenant Opp",
        message: "Probing findFirst invocation",
        metadata: { idempotencyKey: `probe_crosstenant_${timestamp}` },
      });
    } finally {
      // Restore original findFirst
      (prisma.opportunity as any).findFirst = originalFindFirst;
    }

    assert.strictEqual(findFirstCount, 0, `prisma.opportunity.findFirst was called ${findFirstCount} times (must be 0)`);

    passedCount++;
    console.log("  ✓ Zero prisma.opportunity.findFirst() calls observed across all notification paths");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Ashby Application URL -> APPLICATION_PORTAL
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 7] Ashby Application URL Classification...");
  {
    const url1 = "https://jobs.ashbyhq.com/example-company/application";
    const type1 = classifyJobUrl(url1);
    assert.strictEqual(type1, "APPLICATION_PORTAL", "jobs.ashbyhq.com/{company}/application must be APPLICATION_PORTAL");

    const url2 = "https://jobs.ashbyhq.com/example-company/c8976b05-950c-43fe-a9bb-d20f66e06225/application";
    const type2 = classifyJobUrl(url2);
    assert.strictEqual(type2, "APPLICATION_PORTAL", "Ashby URL ending in /application must be APPLICATION_PORTAL");

    const url3 = "https://jobs.ashbyhq.com/example-company/apply";
    const type3 = classifyJobUrl(url3);
    assert.strictEqual(type3, "APPLICATION_PORTAL", "Ashby URL ending in /apply must be APPLICATION_PORTAL");

    passedCount++;
    console.log("  ✓ Ashby application endpoints correctly classified as APPLICATION_PORTAL");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Ashby Job-Detail URL -> JOB_DETAIL
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 8] Ashby Job-Detail URL Classification...");
  {
    const realAshbyJobUrl = "https://jobs.ashbyhq.com/resend/c8976b05-950c-43fe-a9bb-d20f66e06225";
    const type = classifyJobUrl(realAshbyJobUrl);
    assert.strictEqual(type, "JOB_DETAIL", "Real Ashby job posting URL must classify as JOB_DETAIL");

    const slugAshbyJobUrl = "https://jobs.ashbyhq.com/linear/senior-frontend-engineer";
    const typeSlug = classifyJobUrl(slugAshbyJobUrl);
    assert.strictEqual(typeSlug, "JOB_DETAIL", "Slug-based Ashby job URL must classify as JOB_DETAIL");

    passedCount++;
    console.log("  ✓ Real Ashby job detail URLs correctly classified as JOB_DETAIL");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Ashby URL with Query Parameters
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 9] Ashby URL with Query Parameters...");
  {
    const appWithParams = "https://jobs.ashbyhq.com/example-company/application?utm_source=linkedin&ref=boards";
    const typeApp = classifyJobUrl(appWithParams);
    assert.strictEqual(typeApp, "APPLICATION_PORTAL", "Ashby application URL with query parameters must remain APPLICATION_PORTAL");

    const jobWithParams = "https://jobs.ashbyhq.com/resend/c8976b05-950c-43fe-a9bb-d20f66e06225?gh_src=custom";
    const typeJob = classifyJobUrl(jobWithParams);
    assert.strictEqual(typeJob, "JOB_DETAIL", "Ashby job-detail URL with query parameters must remain JOB_DETAIL");

    const searchUrl = "https://jobs.ashbyhq.com/example-company?q=engineer";
    const typeSearch = classifyJobUrl(searchUrl);
    assert.strictEqual(typeSearch, "SEARCH_RESULTS", "Ashby company search query must classify as SEARCH_RESULTS");

    const rootPortal = "https://jobs.ashbyhq.com/example-company";
    const typeRoot = classifyJobUrl(rootPortal);
    assert.strictEqual(typeRoot, "ATS_COMPANY_ROOT", "Ashby company root must classify as ATS_COMPANY_ROOT");

    passedCount++;
    console.log("  ✓ Query parameters correctly handled without corrupting classification");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Redirected Ashby URL Truth Verification
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 10] Redirected Ashby URL Truth Verification...");
  {
    const server = http.createServer((req, res) => {
      if (req.url === "/initial-job") {
        res.writeHead(302, { Location: "https://jobs.ashbyhq.com/example-company/application" });
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const redirectTestUrl = `http://127.0.0.1:${port}/initial-job`;

    try {
      const result = await urlLivelinessVerifier.verifyUrlLiveness(redirectTestUrl, {
        allowTestLocalhost: true,
      });

      assert.strictEqual(result.classification, "APPLICATION_PORTAL", "Final redirected URL must be classified as APPLICATION_PORTAL");
      assert.strictEqual(result.isVerified, false, "Application portal must not be marked as verified job detail");
      assert.strictEqual(result.finalUrl, "https://jobs.ashbyhq.com/example-company/application", "Final URL must be captured");
    } finally {
      server.close();
    }

    passedCount++;
    console.log("  ✓ Redirected Ashby URL truthfully classified as APPLICATION_PORTAL & unverified");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 11: TASK-063 Verification Sandbox Regression Suite
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 11] Running TASK-063 Verification Sandbox Regression Suite...");
  {
    const out = execSync("npx tsx scratch/task063VerificationSandboxValidation.ts", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    assert.ok(out.includes("21/21 PASSED"), "TASK-063 must pass 21/21");
    passedCount++;
    console.log("  ✓ TASK-063 regression suite passed (21/21)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 12: TASK-064 Synthetic Data Purge Regression Suite
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 12] Running TASK-064 Synthetic Data Purge Regression Suite...");
  {
    const out = execSync("npx tsx scratch/task064SyntheticDataPurgeValidation.ts", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    assert.ok(out.includes("10/10 SCENARIOS PASSED"), "TASK-064 must pass 10/10");
    passedCount++;
    console.log("  ✓ TASK-064 regression suite passed (10/10)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 13: TASK-065 Interactive Usage Cancellation Regression Suite
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 13] Running TASK-065 Interactive Usage Cancellation Regression Suite...");
  {
    const out = execSync("npx tsx scratch/task065InteractiveUsageCancellationValidation.ts", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    assert.ok(out.includes("13/13 SCENARIOS PASSED"), "TASK-065 must pass 13/13");
    passedCount++;
    console.log("  ✓ TASK-065 regression suite passed (13/13)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 14: TASK-062 Forensic Runtime Audit Regression Suite
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 14] Running TASK-062 Forensic Runtime Audit Regression Suite...");
  {
    const out = execSync("npx tsx scratch/task062ForensicRuntimeAudit.ts", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    assert.ok(out.includes("21/21 PASSED"), "TASK-062 must pass 21/21");
    passedCount++;
    console.log("  ✓ TASK-062 regression suite passed (21/21)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 15: Full TypeScript Typecheck
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 15] Full TypeScript Typecheck...");
  {
    execSync("npm run typecheck", { stdio: "pipe" });
    passedCount++;
    console.log("  ✓ npm run typecheck: 0 errors");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 16: Production Build Verification
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 16] Production Build Verification...");
  {
    execSync("npm run build", { stdio: "pipe" });
    passedCount++;
    console.log("  ✓ npm run build: Next.js Turbopack build succeeds cleanly");
  }

  console.log("\n================================================================================");
  console.log(`  TASK-066 VALIDATION COMPLETE: ${passedCount}/16 SCENARIOS PASSED! ✅           `);
  console.log("================================================================================\n");
}

runTask066Validation().catch((err) => {
  console.error("❌ TASK-066 VALIDATION FAILED:", err);
  process.exit(1);
});
