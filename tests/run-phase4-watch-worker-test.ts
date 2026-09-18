/**
 * DEEPREACH PHASE 4: WATCH WORKER & PROACTIVE NOTIFICATIONS TEST SUITE
 * Verifies recurring multi-platform watch processing, candidate deduplication,
 * proactive recruiter & unannounced role alerts, and crash-resilient watchdog timeouts.
 */

import { prisma } from "@/lib/db/prisma";
import { 
  createRecruiterContactAlert, 
  createUnannouncedRoleAlert,
  formatRecruiterAlertEmail,
  getAlertBadgeConfig 
} from "@/lib/lifecycle/opportunityNotificationService";
import { 
  executeWatchDeepReachScan, 
  processWatchDiscoveryJob, 
  type WatchScanTarget 
} from "@/worker/processors/watchProcessor";
import { type Job } from "bullmq";
import type { WatchJobPayload } from "@/lib/queue/watchQueue";

async function runPhase4WatchWorkerTests() {
  console.log("=================================================");
  console.log("RUNNING DEEPREACH PHASE 4 WATCH WORKER TEST SUITE");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;
  const testUserId = `test-user-p4-${Date.now()}`;

  // Ensure test user exists in DB for foreign key constraint in LifecycleAlert
  try {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@browserpilot.test`,
        passwordHash: "dummy-hash",
      },
    });
  } catch (userCreateErr) {
    console.warn("Could not create test user:", userCreateErr);
  }

  // Test 1: Opportunity Notification Service (Recruiter & Unannounced Role Alerts)
  try {
    console.log("Test 1: Opportunity Notification Service - Alert Creation & Idempotency");

    const recruiterInput = {
      fullName: "Alex Rivera",
      roleTitle: "Staff Technical Recruiter",
      companyName: "NexusAI",
      profileUrl: "https://www.linkedin.com/in/alexrivera-nexus",
      email: "alex.rivera@nexusai.test",
      sourcePlatform: "LINKEDIN",
    };

    // First creation
    const res1 = await createRecruiterContactAlert({
      userId: testUserId,
      recruiter: recruiterInput,
      companyName: "NexusAI",
      sendEmail: false, // avoid external network
    });

    // Duplicate creation attempt
    const res2 = await createRecruiterContactAlert({
      userId: testUserId,
      recruiter: recruiterInput,
      companyName: "NexusAI",
      sendEmail: false,
    });

    const unannouncedInput = {
      title: "Staff Distributed Systems Engineer",
      companyName: "NexusAI",
      applyUrl: "https://x.com/nexusfounder/status/987654321",
      sourcePlatform: "X",
      description: "Stealth infra team hiring founding backend engineers.",
    };

    const unannouncedRes1 = await createUnannouncedRoleAlert({
      userId: testUserId,
      role: unannouncedInput,
      companyName: "NexusAI",
      sendEmail: false,
    });

    const unannouncedRes2 = await createUnannouncedRoleAlert({
      userId: testUserId,
      role: unannouncedInput,
      companyName: "NexusAI",
      sendEmail: false,
    });

    const emailFormatting = formatRecruiterAlertEmail({
      recruiter: recruiterInput,
      watchName: "AI Infrastructure Watch",
    });

    const badgeConfig = getAlertBadgeConfig("NEW_RECRUITER_CONTACT");

    const isRecruiterAlertValid = res1.created === true && res1.alert?.transitionType === "NEW_RECRUITER_CONTACT";
    const isRecruiterDeduplicated = res2.created === false && res2.alert?.id === res1.alert?.id;
    const isUnannouncedValid = unannouncedRes1.created === true && unannouncedRes1.alert?.transitionType === "UNANNOUNCED_ROLE";
    const isUnannouncedDeduplicated = unannouncedRes2.created === false;
    const isEmailValid = emailFormatting.subject.includes("Alex Rivera") && emailFormatting.htmlBody.includes("alex.rivera@nexusai.test");
    const isBadgeValid = badgeConfig.label === "Recruiter Contact" && badgeConfig.iconName === "UserCheck";

    if (
      isRecruiterAlertValid && 
      isRecruiterDeduplicated && 
      isUnannouncedValid && 
      isUnannouncedDeduplicated && 
      isEmailValid && 
      isBadgeValid
    ) {
      console.log("  PASS: Recruiter contact and unannounced role alerts created with strict deduplication.");
      passed++;
    } else {
      console.error("  FAIL: Notification service assertion failed:", {
        isRecruiterAlertValid,
        isRecruiterDeduplicated,
        isUnannouncedValid,
        isUnannouncedDeduplicated,
        isEmailValid,
        isBadgeValid,
      });
      failed++;
    }
  } catch (err) {
    console.error("  ERROR in Test 1:", err);
    failed++;
  }

  // Test 2: Watch Processor DeepReach Execution & Record Discovery
  try {
    console.log("\nTest 2: Watch Processor - DeepReach Execution & Record Comparison");

    const mockFetcher = async (url: string): Promise<string> => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes("jobs/view") || decoded.includes("site%3Alinkedin.com%2Fjobs") || (decoded.includes("linkedin") && decoded.includes("jobs"))) {
        return `
# LinkedIn Job Openings
[Staff Platform Engineer - NexusAI | LinkedIn](https://www.linkedin.com/jobs/view/11223344)
Active public job posting at NexusAI.
        `;
      }
      if (decoded.includes("linkedin")) {
        return `
# Search Results
[Diana Prince - Talent Acquisition Lead - NexusAI | LinkedIn](https://www.linkedin.com/in/dianaprince)
Talent Acquisition Lead at NexusAI. Scaling Core Distributed Systems & Applied AI teams!
        `;
      }
      if (decoded.includes("x.com") || decoded.includes("twitter")) {
        return `
Founder @ NexusAI is hiring a Staff Platform Engineer! Apply at https://nexusai.test/careers/staff-platform https://x.com/nexusfounder/status/123456789
        `;
      }
      return "Mock channel content";
    };

    const watchTarget: WatchScanTarget = {
      id: `watch-${Date.now()}`,
      userId: testUserId,
      companies: ["NexusAI"],
      roles: ["Platform Engineer"],
    };

    const scanResult = await executeWatchDeepReachScan(watchTarget, {
      timeBudgetMs: 5000,
      fetcher: mockFetcher,
      sendEmail: false,
    });

    console.log(`  Companies scanned: ${scanResult.companiesScanned}`);
    console.log(`  New recruiters: ${scanResult.newRecruiters}`);
    console.log(`  New unannounced roles: ${scanResult.newUnannouncedRoles}`);
    console.log(`  Alerts created: ${scanResult.alertsCreated}`);

    if (
      scanResult.companiesScanned === 1 &&
      scanResult.newRecruiters >= 1 &&
      scanResult.newUnannouncedRoles >= 1 &&
      scanResult.alertsCreated >= 2 &&
      scanResult.success
    ) {
      console.log("  PASS: Watch processor harvested new recruiters & unannounced roles and generated alerts.");
      passed++;
    } else {
      console.error("  FAIL: Watch processor scan result failed assertions:", scanResult);
      failed++;
    }

    // Test 3: Watch Processor Idempotency on Subsequent Runs
    console.log("\nTest 3: Watch Processor - Idempotency on Subsequent Recurring Run");
    const recurringRunResult = await executeWatchDeepReachScan(watchTarget, {
      timeBudgetMs: 5000,
      fetcher: mockFetcher,
      sendEmail: false,
    });

    console.log(`  Recurring run new recruiters: ${recurringRunResult.newRecruiters}`);
    console.log(`  Recurring run new unannounced roles: ${recurringRunResult.newUnannouncedRoles}`);
    console.log(`  Recurring run alerts created: ${recurringRunResult.alertsCreated}`);

    if (
      recurringRunResult.newRecruiters === 0 &&
      recurringRunResult.newUnannouncedRoles === 0 &&
      recurringRunResult.alertsCreated === 0
    ) {
      console.log("  PASS: Recurring run produced 0 duplicate alerts and 0 duplicate contacts.");
      passed++;
    } else {
      console.error("  FAIL: Recurring run produced unexpected duplicates:", recurringRunResult);
      failed++;
    }
  } catch (err) {
    console.error("  ERROR in Test 2/3:", err);
    failed++;
  }

  // Test 4: Time Budget Watchdog & Error Recovery
  try {
    console.log("\nTest 4: Time Budget Watchdog & Non-Fatal Error Recovery");

    // Simulates a hanging / slow network fetcher
    const hangingFetcher = async (): Promise<string> => {
      return new Promise((resolve) => {
        // Hang longer than the 80ms watchdog
        setTimeout(() => resolve("late content"), 1000);
      });
    };

    const timeoutWatch: WatchScanTarget = {
      id: `watch-timeout-${Date.now()}`,
      userId: testUserId,
      companies: ["SlowHangingCorp"],
    };

    const timeoutResult = await executeWatchDeepReachScan(timeoutWatch, {
      timeBudgetMs: 80, // strict 80ms budget watchdog
      fetcher: hangingFetcher,
      sendEmail: false,
    });

    const hasTimeoutError = timeoutResult.errors.some((e) => e.includes("timed out after 80ms watchdog limit"));

    if (hasTimeoutError && timeoutResult.companiesScanned === 1) {
      console.log("  PASS: Watchdog safely timed out without crashing worker daemon or hanging process.");
      passed++;
    } else {
      console.error("  FAIL: Watchdog timeout assertion failed:", timeoutResult);
      failed++;
    }
  } catch (err) {
    console.error("  ERROR in Test 4:", err);
    failed++;
  }

  // Test 5: BullMQ Job Handler Integration
  try {
    console.log("\nTest 5: BullMQ Job Handler - processWatchDiscoveryJob");

    let progressUpdatedTo = 0;
    const syntheticJob = {
      id: `synthetic-job-${Date.now()}`,
      data: {
        watchId: `watch-bullmq-${Date.now()}`,
        userId: testUserId,
        companyTargets: ["NexusAI"],
      },
      opts: {},
      updateProgress: async (p: number) => {
        progressUpdatedTo = p;
      },
    } as unknown as Job<WatchJobPayload>;

    const jobResult = await processWatchDiscoveryJob(syntheticJob);

    if (jobResult.companiesScanned === 1 && progressUpdatedTo === 100) {
      console.log("  PASS: BullMQ job processor handled watch payload and reported progress cleanly.");
      passed++;
    } else {
      console.error("  FAIL: BullMQ job processor failed:", { jobResult, progressUpdatedTo });
      failed++;
    }
  } catch (err) {
    console.error("  ERROR in Test 5:", err);
    failed++;
  }

  // Teardown: Clean test records
  try {
    await prisma.lifecycleAlert.deleteMany({
      where: { userId: testUserId },
    }).catch(() => {});
    await prisma.companyContact.deleteMany({
      where: { companyName: "NexusAI" },
    }).catch(() => {});
    await prisma.user.delete({
      where: { id: testUserId },
    }).catch(() => {});
  } catch {}

  // Summary
  console.log("\n=================================================");
  console.log(`PHASE 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase4WatchWorkerTests().catch((err) => {
  console.error("Fatal error running Phase 4 tests:", err);
  process.exit(1);
});
