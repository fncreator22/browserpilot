/**
 * §TASK-022 EDITABLE SWARM CONFIGURATION, COMPANY TARGETING & INTERVAL TEST SUITE
 * Validates editable watch roles/skills/locations/companies/sources, dynamic scan interval
 * updating (2h, 4h, 6h, 12h, 24h), nextScanAt recalculation, company-targeted filtering,
 * autonomous scheduled discovery execution, and multi-tenant isolation.
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { prisma } from "@/lib/db";
import {
  getDiscoveryWatch,
  upsertDiscoveryWatch,
  claimDiscoveryWatch,
  releaseDiscoveryWatch,
} from "@/lib/db/opportunities";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { swarmDiscoveryEngine } from "@/lib/scraper/swarmDiscovery";
import { autonomousDiscoveryEngine } from "@/lib/scraper/autonomousDiscovery";
import { discoveryScheduler } from "@/lib/scraper/discoveryScheduler";
import { type SearchProvider, type SearchIntent, type RawJobCandidate, type ProviderLimits } from "@/lib/scraper/providers/baseProvider";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[TASK-022 ASSERTION FAILED]: ${msg}`);
  }
}

export async function runSwarmConfigurationWatchTests() {
  console.log("▶ [TASK-022] Running Swarm Configuration, Company Targeting & Interval Tests...");

  const salt = Date.now();
  const user1Email = `swarm_user1_${salt}@browserpilot.ai`;
  const user2Email = `swarm_user2_${salt}@browserpilot.ai`;

  // ---------------------------------------------------------------------------
  // 1. Multi-Tenant User Setup
  // ---------------------------------------------------------------------------
  const user1 = await prisma.user.create({
    data: {
      email: user1Email,
      name: "Swarm Config Tenant Alpha",
      passwordHash: "hash_test_swarm_1",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: user2Email,
      name: "Swarm Config Tenant Beta",
      passwordHash: "hash_test_swarm_2",
    },
  });

  console.log("  ✓ Created multi-tenant test users");

  // ---------------------------------------------------------------------------
  // 2. Editable Watch Configuration & Persistence (Roles, Skills, Locations, Companies, Sources)
  // ---------------------------------------------------------------------------
  console.log("▶ [CONFIGURATION] Verifying Editable Watch Creation and Updates...");

  // Initial creation with custom configuration
  const initialWatch = await upsertDiscoveryWatch(user1.id, {
    enabled: true,
    roles: ["AI Engineer", "ML Researcher"],
    skills: ["PyTorch", "Python", "FastAPI"],
    locations: ["Hyderabad", "Bengaluru"],
    companies: ["Microsoft", "Google", "OpenAI"],
    workModes: ["REMOTE", "HYBRID"],
    experienceLevels: ["ENTRY_LEVEL", "INTERN"],
    opportunityTypes: ["FULL_TIME", "INTERNSHIP"],
    preferredSources: ["LinkedIn", "Y Combinator"],
    minimumMatchScore: 80,
    scanIntervalHours: 6,
  });

  assert(initialWatch.roles.length === 2 && initialWatch.roles.includes("AI Engineer"), "Roles must persist");
  assert(initialWatch.skills.length === 3 && initialWatch.skills.includes("PyTorch"), "Skills must persist");
  assert(initialWatch.locations.length === 2 && initialWatch.locations.includes("Hyderabad"), "Locations must persist");
  assert(initialWatch.companies.length === 3 && initialWatch.companies.includes("Microsoft"), "Companies must persist");
  assert(initialWatch.preferredSources.length === 2 && !initialWatch.preferredSources.includes("Indeed"), "Sources must persist");
  assert(initialWatch.minimumMatchScore === 80, "Minimum match score must persist");
  assert(initialWatch.scanIntervalHours === 6, "Initial 6h interval must persist");

  // Edit watch: Add new role, add skill, change company target, switch interval to 2h
  const updatedWatch = await upsertDiscoveryWatch(user1.id, {
    roles: ["Full Stack Engineer", "Backend Developer"],
    skills: ["Next.js", "TypeScript", "PostgreSQL"],
    locations: ["Remote India"],
    companies: ["Stripe", "Anthropic"],
    scanIntervalHours: 2,
    minimumMatchScore: 75,
  });

  assert(updatedWatch.roles.includes("Full Stack Engineer") && !updatedWatch.roles.includes("AI Engineer"), "Roles must be updated");
  assert(updatedWatch.skills.includes("Next.js") && !updatedWatch.skills.includes("PyTorch"), "Skills must be updated");
  assert(updatedWatch.companies.includes("Stripe") && !updatedWatch.companies.includes("Microsoft"), "Companies must be updated");
  assert(updatedWatch.scanIntervalHours === 2, "Scan interval must update to 2 hours");
  assert(updatedWatch.minimumMatchScore === 75, "Minimum match score must update to 75");
  console.log("  ✓ Verified comprehensive watch editing and database persistence");

  // ---------------------------------------------------------------------------
  // 3. Scan Interval Updating & nextScanAt Dynamic Recalculation (2h, 4h, 6h, 12h, 24h)
  // ---------------------------------------------------------------------------
  console.log("▶ [INTERVALS] Verifying Dynamic nextScanAt Recalculation Across Supported Intervals...");

  const intervalsToTest = [2, 4, 6, 12, 24];
  for (const interval of intervalsToTest) {
    const tBefore = Date.now();
    const res = await upsertDiscoveryWatch(user1.id, {
      scanIntervalHours: interval,
    });

    assert(res.scanIntervalHours === interval, `Interval must persist as ${interval} hours`);
    assert(res.nextScanAt instanceof Date, "nextScanAt must be a valid Date instance");

    const expectedNextMin = tBefore + interval * 3600 * 1000 - 2000;
    const expectedNextMax = tBefore + interval * 3600 * 1000 + 5000;
    const actualNext = res.nextScanAt!.getTime();

    assert(
      actualNext >= expectedNextMin && actualNext <= expectedNextMax,
      `nextScanAt for ${interval}h interval must be ~${interval} hours in the future (actual delta: ${Math.round((actualNext - tBefore) / 3600000)}h)`
    );
  }
  console.log("  ✓ Verified 2h, 4h, 6h, 12h, and 24h intervals correctly advance nextScanAt");

  // ---------------------------------------------------------------------------
  // 4. Intent Parser & Natural-Language Company Extraction
  // ---------------------------------------------------------------------------
  console.log("▶ [NATURAL LANGUAGE] Testing Company Extraction from User Language...");

  const intent1 = parseSearchIntent("Watch for software engineering internships from Microsoft and Google in Hyderabad");
  assert(intent1.companies?.includes("Microsoft") === true, "Must extract Microsoft");
  assert(intent1.companies?.includes("Google") === true, "Must extract Google");
  assert(intent1.role === "Software Engineer", "Must extract Software Engineer role");

  const intent2 = parseSearchIntent("Monitor OpenAI for backend AI roles");
  assert(intent2.companies?.includes("OpenAI") === true, "Must extract OpenAI");
  assert(intent2.role === "AI Engineer" || intent2.role === "Backend Developer", "Must extract AI or Backend role");
  console.log("  ✓ Verified natural-language company extraction");

  // ---------------------------------------------------------------------------
  // 5. Discovery Plan Building with Target Companies
  // ---------------------------------------------------------------------------
  console.log("▶ [PLANNER] Testing DiscoveryPlan Target Company Precedence...");

  const plan = buildDiscoveryPlan("Software Developer", {
    roles: ["Software Developer"],
    companies: ["Microsoft", "Google"],
  });

  assert(plan.targetCompanies.length === 2, "DiscoveryPlan must contain 2 target companies");
  assert(plan.targetCompanies.includes("Microsoft"), "Must contain Microsoft");
  assert(plan.targetCompanies.includes("Google"), "Must contain Google");
  console.log("  ✓ Verified DiscoveryPlan integrates targetCompanies");

  // ---------------------------------------------------------------------------
  // 6. Swarm Candidate Harvesting with Strict Company Filtering
  // ---------------------------------------------------------------------------
  console.log("▶ [SWARM FILTERING] Testing Candidate Extraction & Strict Company Filtering...");

  class MockCompanySearchProvider implements SearchProvider {
    name = "MockCompanyProvider";
    supports() { return true; }
    buildSearchUrl() { return "https://example.com"; }
    async harvestCandidates(): Promise<RawJobCandidate[]> {
      return [
        {
          sourcePlatform: "MockCompanyProvider",
          sourceUrl: "https://example.com/job1",
          applyUrl: "https://example.com/job1",
          title: "Software Engineer",
          companyName: "Microsoft Corporation",
          location: "Hyderabad",
          workMode: "HYBRID",
          experienceLevel: "ENTRY_LEVEL",
          opportunityType: "FULL_TIME",
          discoveredAt: new Date(),
        },
        {
          sourcePlatform: "MockCompanyProvider",
          sourceUrl: "https://example.com/job2",
          applyUrl: "https://example.com/job2",
          title: "Frontend Developer",
          companyName: "Google LLC",
          location: "Bengaluru",
          workMode: "REMOTE",
          experienceLevel: "ENTRY_LEVEL",
          opportunityType: "FULL_TIME",
          discoveredAt: new Date(),
        },
        {
          sourcePlatform: "MockCompanyProvider",
          sourceUrl: "https://example.com/job3",
          applyUrl: "https://example.com/job3",
          title: "Backend Engineer",
          companyName: "Random Unrelated Corp",
          location: "Mumbai",
          workMode: "ON_SITE",
          experienceLevel: "MID",
          opportunityType: "FULL_TIME",
          discoveredAt: new Date(),
        },
      ];
    }
  }

  // Execute swarm with plan targeting Microsoft only
  const singleCompanyPlan = buildDiscoveryPlan("Software Engineer", {
    companies: ["Microsoft"],
  });
  const swarmResultSingle = await swarmDiscoveryEngine.executeSwarm(singleCompanyPlan, {
    customProviders: [new MockCompanySearchProvider()],
  });

  assert(swarmResultSingle.candidates.length === 1, "Must retain exactly 1 candidate matching Microsoft");
  assert(swarmResultSingle.candidates[0].companyName === "Microsoft Corporation", "Retained candidate must be Microsoft");

  // Execute swarm targeting Microsoft & Google
  const multiCompanyPlan = buildDiscoveryPlan("Software Engineer", {
    companies: ["Microsoft", "Google"],
  });
  const swarmResultMulti = await swarmDiscoveryEngine.executeSwarm(multiCompanyPlan, {
    customProviders: [new MockCompanySearchProvider()],
  });

  assert(swarmResultMulti.candidates.length === 2, "Must retain 2 candidates matching Microsoft and Google");
  assert(
    !swarmResultMulti.candidates.some((c) => c.companyName.includes("Random Unrelated")),
    "Unrelated company must be filtered out"
  );
  console.log("  ✓ Verified strict company filtering across single and multiple target companies");

  // ---------------------------------------------------------------------------
  // 7. Full Autonomous Scheduled Discovery with Configured Company Watch
  // ---------------------------------------------------------------------------
  console.log("▶ [AUTONOMOUS RUN] Testing End-to-End Watch Execution with Company Targets...");

  // Set user1 watch to target Microsoft with 2h interval, due right now
  await upsertDiscoveryWatch(user1.id, {
    enabled: true,
    roles: ["Software Engineer"],
    skills: ["TypeScript"],
    locations: ["Hyderabad"],
    companies: ["Microsoft"],
    scanIntervalHours: 2,
    nextScanAt: new Date(Date.now() - 10000), // Due
  });

  const discoveryRunResult = await autonomousDiscoveryEngine.runAutonomousDiscoveryForUser(user1.id, {
    customProviders: [new MockCompanySearchProvider()],
    forceScan: true,
    triggerType: "SCHEDULED",
  });

  assert(discoveryRunResult.status === "SUCCESS", "Autonomous run must succeed");
  assert(discoveryRunResult.telemetry.newOpportunities >= 1, "Must find novel Microsoft opportunity");

  // Verify nextScanAt was advanced by 2 hours
  const postRunWatch = await getDiscoveryWatch(user1.id);
  assert(postRunWatch.scanIntervalHours === 2, "Scan interval remains 2h");
  assert(postRunWatch.nextScanAt !== null, "nextScanAt must be set");
  const hoursAhead = (postRunWatch.nextScanAt!.getTime() - Date.now()) / (3600 * 1000);
  assert(hoursAhead > 1.8 && hoursAhead <= 2.1, `nextScanAt must advance by ~2h (actual: ${hoursAhead.toFixed(2)}h)`);

  console.log("  ✓ Verified autonomous discovery run respects company targets and advances 2h interval");

  // ---------------------------------------------------------------------------
  // 8. Multi-Tenant Watch Isolation
  // ---------------------------------------------------------------------------
  console.log("▶ [ISOLATION] Verifying Multi-Tenant Watch Isolation...");

  // Configure user2 watch with completely different targets
  await upsertDiscoveryWatch(user2.id, {
    enabled: true,
    roles: ["DevOps Engineer"],
    companies: ["AWS"],
    scanIntervalHours: 12,
  });

  const watchUser1 = await getDiscoveryWatch(user1.id);
  const watchUser2 = await getDiscoveryWatch(user2.id);

  assert(watchUser1.companies.includes("Microsoft"), "User 1 has Microsoft");
  assert(!watchUser1.companies.includes("AWS"), "User 1 does not have User 2's company");
  assert(watchUser2.companies.includes("AWS"), "User 2 has AWS");
  assert(!watchUser2.companies.includes("Microsoft"), "User 2 does not have User 1's company");
  assert(watchUser1.scanIntervalHours === 2, "User 1 has 2h interval");
  assert(watchUser2.scanIntervalHours === 12, "User 2 has 12h interval");
  console.log("  ✓ Verified multi-tenant watch isolation");

  // ---------------------------------------------------------------------------
  // Cleanup Test Fixtures
  // ---------------------------------------------------------------------------
  await prisma.discoveryWatch.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await prisma.lifecycleAlert.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await prisma.opportunityDiscoveryEvent.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await prisma.discoveryRun.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });

  console.log("✓ [TASK-022] All Swarm Configuration & Company Watch Tests Passed!\n");
}

if (require.main === module) {
  runSwarmConfigurationWatchTests().then(
    () => process.exit(0),
    (err) => {
      console.error("Test failed:", err);
      process.exit(1);
    }
  );
}
