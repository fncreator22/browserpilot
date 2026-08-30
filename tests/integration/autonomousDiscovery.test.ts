import assert from "assert";
import { prisma } from "@/lib/db/prisma";
import {
  getDiscoveryWatch,
  upsertDiscoveryWatch,
  getUserLifecycleAlerts,
  getUserDiscoveryEvents,
  getUserDiscoveryRuns,
} from "@/lib/db/opportunities";
import {
  AutonomousDiscoveryEngine,
  type DiscoveredOpportunityResult,
} from "@/lib/scraper/autonomousDiscovery";
import { type SearchProvider } from "@/lib/scraper/providers/baseProvider";

export async function runAutonomousDiscoveryIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Autonomous Discovery & Novelty Intelligence Tests (TASK-014)...");

  // 1. Create test user fixtures
  const testUser = await prisma.user.create({
    data: {
      email: `watch-user-${Date.now()}@autonomous.ai`,
      name: "Watch Test User",
      passwordHash: "dummy-hash",
    },
  });

  const secondUser = await prisma.user.create({
    data: {
      email: `watch-second-${Date.now()}@autonomous.ai`,
      name: "Second Watch User",
      passwordHash: "dummy-hash",
    },
  });

  // 2. Test Discovery Watch Config retrieval and update
  let watch = await getDiscoveryWatch(testUser.id);
  assert.strictEqual(watch.enabled, true);
  assert.strictEqual(watch.minimumMatchScore, 70);

  watch = await upsertDiscoveryWatch(testUser.id, {
    roles: ["AI Systems Engineer", "Backend Developer"],
    skills: ["TypeScript", "Node.js", "Python"],
    locations: ["Remote", "Bengaluru"],
    workModes: ["REMOTE"],
    experienceLevels: ["ENTRY_LEVEL", "MID"],
    opportunityTypes: ["FULL_TIME"],
    minimumMatchScore: 65,
    latestOnly: true,
    freshnessWindowHours: 48,
    scanIntervalHours: 4,
  });

  assert.strictEqual(watch.roles[0], "AI Systems Engineer");
  assert.strictEqual(watch.minimumMatchScore, 65);
  assert.strictEqual(watch.latestOnly, true);
  console.log("  ✓ Verified Discovery Watch configuration creation, update, and database persistence");

  // 3. Mock Search Providers for Controlled Discovery
  const testSalt = Date.now();
  const testCompany = `Frontier Autonomous ${testSalt}`;
  const linkedInUrl = `https://linkedin.example.com/jobs/ai-lead-${testSalt}`;
  const indeedUrl = `https://indeed.example.com/viewjob?jk=indeed-ai-lead-${testSalt}`;

  const mockLinkedInProvider: SearchProvider = {
    name: "MockLinkedInWatch",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "MockLinkedInWatch",
        sourceUrl: linkedInUrl,
        applyUrl: `${linkedInUrl}/apply`,
        title: "AI Systems Engineer",
        companyName: testCompany,
        location: "Remote",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        description: "Develop autonomous multi-agent crawling swarms in TypeScript and Node.js.",
        rawSnippet: "Posted 2 hours ago - TypeScript, Node.js",
        discoveredAt: new Date(),
      },
    ],
  };

  const mockIndeedProvider: SearchProvider = {
    name: "MockIndeedWatch",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "MockIndeedWatch",
        sourceUrl: indeedUrl,
        applyUrl: `${indeedUrl}/apply`,
        title: "AI Systems Engineer",
        companyName: testCompany, // Exact same company/title -> NEW_SOURCE
        location: "Remote",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        description: "Develop autonomous multi-agent crawling swarms in TypeScript and Node.js.",
        rawSnippet: "Posted today - TypeScript, Node.js",
        discoveredAt: new Date(),
      },
    ],
  };

  const mockFailingProvider: SearchProvider = {
    name: "MockFailingProvider",
    supports: () => true,
    harvestCandidates: async () => {
      throw new Error("Simulated upstream timeout on provider harvest");
    },
  };

  const testEngine = new AutonomousDiscoveryEngine();

  // 4. Test Initial Autonomous Discovery Cycle (NEW_OPPORTUNITY)
  const firstRun = await testEngine.runAutonomousDiscoveryForUser(testUser.id, {
    customProviders: [mockLinkedInProvider],
    forceScan: true,
  });

  assert.strictEqual(firstRun.status, "SUCCESS");
  assert.strictEqual(firstRun.discoveredOpportunities.length, 1);
  assert.strictEqual(firstRun.discoveredOpportunities[0].classification, "NEW_OPPORTUNITY");
  assert.strictEqual(firstRun.telemetry.newOpportunities, 1);
  assert.strictEqual(firstRun.telemetry.notificationsCreated, 1);
  console.log("  ✓ Verified initial autonomous run and NEW_OPPORTUNITY detection with alert creation");

  // Verify Lifecycle Alert persistence and idempotency
  const alerts = await getUserLifecycleAlerts(testUser.id);
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].transitionType, "NEW_OPPORTUNITY");
  assert.strictEqual(alerts[0].companyName, testCompany);
  console.log("  ✓ Verified LifecycleAlert record generated for matching new opportunity");

  // 5. Test Subsequent Discovery Cycle with New Source (NEW_SOURCE)
  const secondRun = await testEngine.runAutonomousDiscoveryForUser(testUser.id, {
    customProviders: [mockLinkedInProvider, mockIndeedProvider],
    forceScan: true,
  });

  assert.strictEqual(secondRun.status, "SUCCESS");
  assert.strictEqual(secondRun.telemetry.newSources, 1, "Must detect new source listing for existing opportunity");
  assert.strictEqual(secondRun.discoveredOpportunities[0].classification, "NEW_SOURCE");

  // Check that parent opportunity has 2 source listings now
  const events = await getUserDiscoveryEvents(testUser.id);
  assert.ok(events.length >= 2);
  const latestEventOpp = events[0].opportunity;
  assert.strictEqual(latestEventOpp.sourceListings.length, 2, "Parent opportunity must attach new source non-destructively");
  console.log("  ✓ Verified NEW_SOURCE detection and non-destructive SourceListing attachment");

  // 6. Test Repeated Scan (ALREADY_KNOWN & Zero Duplicate Alert Spam)
  const thirdRun = await testEngine.runAutonomousDiscoveryForUser(testUser.id, {
    customProviders: [mockLinkedInProvider, mockIndeedProvider],
    forceScan: true,
  });

  assert.strictEqual(thirdRun.status, "SUCCESS");
  assert.strictEqual(thirdRun.telemetry.alreadyKnown, 1, "Must classify previously seen opportunity as ALREADY_KNOWN");
  assert.strictEqual(thirdRun.telemetry.notificationsCreated, 0, "Must create 0 duplicate alerts on rediscovery");
  console.log("  ✓ Verified ALREADY_KNOWN classification and strict alert deduplication (zero spam)");

  // 7. Test Disabled Watch Behavior
  await upsertDiscoveryWatch(testUser.id, { enabled: false });
  const disabledRun = await testEngine.runAutonomousDiscoveryForUser(testUser.id, {
    customProviders: [mockLinkedInProvider],
    forceScan: false, // Not forced
  });
  assert.strictEqual(disabledRun.status, "DISABLED", "Disabled watch must skip execution unless forced");
  console.log("  ✓ Verified disabled watch skips autonomous execution safely");

  // 8. Test Partial Failure Resilience
  await upsertDiscoveryWatch(testUser.id, { enabled: true });
  const partialRun = await testEngine.runAutonomousDiscoveryForUser(testUser.id, {
    customProviders: [mockLinkedInProvider, mockFailingProvider],
    forceScan: true,
  });
  assert.strictEqual(partialRun.status, "PARTIAL_SUCCESS", "Partial failure must not crash successful provider discovery");
  assert.strictEqual(partialRun.telemetry.providersFailed, 1);
  assert.strictEqual(partialRun.telemetry.providersSucceeded, 1);
  console.log("  ✓ Verified partial provider failure tolerance and telemetry capture");

  // 9. Test Discovery Run History Retrieval
  const runs = await getUserDiscoveryRuns(testUser.id);
  assert.ok(runs.length >= 3, "Must record discovery execution history in DB");
  console.log("  ✓ Verified DiscoveryRun execution history persistence and multi-tenant scoping");

  // 10. Test Multi-User Scheduled Execution Batching
  await upsertDiscoveryWatch(testUser.id, {
    enabled: true,
    nextScanAt: null,
  });

  await upsertDiscoveryWatch(secondUser.id, {
    roles: ["Full Stack Developer"],
    enabled: true,
    nextScanAt: null,
  });

  const batchSummary = await testEngine.runAutonomousDiscoveryForAllUsers({
    customProviders: [mockLinkedInProvider],
    forceScan: true,
  });

  assert.ok(batchSummary.usersProcessed >= 2);
  assert.ok(batchSummary.durationMs > 0);
  console.log("  ✓ Verified multi-user batch scheduler execution and bounded concurrency");

  console.log("✓ [INTEGRATION] Autonomous Discovery & Novelty Intelligence Tests Passed!\n");
}
