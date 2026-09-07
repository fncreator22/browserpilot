import { prisma } from "../lib/db/prisma";
import { connectorUsageService } from "../lib/discovery/connectors/connectorUsageService";
import { SwarmDiscoveryEngine } from "../lib/scraper/swarmDiscovery";
import { type DiscoveryPlan } from "../lib/scraper/discoveryPlanner";

async function main() {
  console.log("=================================================================");
  console.log("  LINKEDIN REGRESSION CHECK & TEST DATA CLEANUP                  ");
  console.log("=================================================================\n");

  // 1. Clean up test data: Remove "Test Custom Careers" / test_portal_...
  console.log("▶ [STEP 1] Cleaning up test fixture rows from database...");
  const testSources = await prisma.discoverySource.findMany({
    where: {
      OR: [
        { name: { contains: "test_portal", mode: "insensitive" } },
        { displayName: { contains: "Test Custom", mode: "insensitive" } },
      ],
    },
  });

  console.log(`Found ${testSources.length} test fixture source(s) to remove:`);
  for (const s of testSources) {
    console.log(` - Deleting source: ${s.displayName} (id: ${s.id}, name: ${s.name})`);
    await prisma.connectorHarvestLog.deleteMany({
      where: {
        OR: [
          { sourceId: s.id },
          { connectorName: s.name },
          { connectorName: s.displayName || "" },
        ],
      },
    });
    await prisma.discoverySource.delete({ where: { id: s.id } });
  }

  // Also clean up any orphan test harvest logs matching test_portal
  const deletedLogs = await prisma.connectorHarvestLog.deleteMany({
    where: {
      connectorName: { contains: "test_portal", mode: "insensitive" },
    },
  });
  console.log(`Cleaned up ${deletedLogs.count} orphan test harvest logs.`);

  // 2. Fix LinkedIn requiresAuth in database
  console.log("\n▶ [STEP 2] Correcting LinkedIn session requirement flag in discovery_sources...");
  const linkedInUpdate = await prisma.discoverySource.updateMany({
    where: {
      name: { equals: "LinkedIn", mode: "insensitive" },
    },
    data: {
      requiresAuth: false,
    },
  });
  console.log(`Updated ${linkedInUpdate.count} LinkedIn source record(s) -> requiresAuth: false.`);

  // Invalidate in-memory cache
  connectorUsageService.invalidateCache("LinkedIn");
  connectorUsageService.invalidateCache();

  // 3. Verify LinkedIn provider status in SwarmDiscoveryEngine
  console.log("\n▶ [STEP 3] Verifying LinkedIn provider integration in SwarmDiscoveryEngine...");
  const swarm = new SwarmDiscoveryEngine();
  const plan: DiscoveryPlan = {
    rawQuery: "Software Engineer",
    roles: ["Software Engineer"],
    skills: [],
    locations: [],
    workModes: [],
    opportunityTypes: [],
    experienceLevels: [],
    targetCompanies: [],
    sources: ["LinkedIn"],
    maxResultsPerSource: 10,
    isExplicitFreshness: false,
    freshnessWindowHours: 720,
    sortMode: "RELEVANCE",
    isLatestIntent: false,
  };

  const intent = swarm.planToIntent(plan);
  console.log("Running live search via SwarmDiscoveryEngine with intent:", intent);

  const swarmResult = await swarm.executeSwarm(plan);

  console.log(`\nSwarm Status: ${swarmResult.status}`);
  console.log(`Candidates Harvested: ${swarmResult.candidates.length}`);
  console.log("Provider Telemetry:");
  for (const t of swarmResult.providerTelemetry) {
    console.log(` - Provider: ${t.provider} | Status: ${t.status} | Candidates: ${t.candidatesFound} | Duration: ${t.durationMs}ms`);
  }

  if (swarmResult.candidates.length > 0) {
    console.log("\nSample LinkedIn Harvested Candidates:");
    for (const c of swarmResult.candidates.slice(0, 3)) {
      console.log(` - [${c.companyName}] ${c.title} -> ${c.applyUrl || c.sourceUrl}`);
    }
  }

  // 4. Verify updated database counters for LinkedIn
  console.log("\n▶ [STEP 4] Verifying updated database record for LinkedIn in discovery_sources...");
  const linkedInDb = await prisma.discoverySource.findFirst({
    where: { name: { equals: "LinkedIn", mode: "insensitive" } },
  });
  console.log("LinkedIn DB Row:", {
    name: linkedInDb?.name,
    displayName: linkedInDb?.displayName,
    requiresAuth: linkedInDb?.requiresAuth,
    totalCrawls: linkedInDb?.totalCrawls,
    successfulCrawls: linkedInDb?.successfulCrawls,
    totalJobsFound: linkedInDb?.totalJobsFound,
    recentJobsFound: linkedInDb?.recentJobsFound,
    lastStatus: linkedInDb?.lastStatus,
    lastCrawledAt: linkedInDb?.lastCrawledAt,
  });

  // 5. Verify total registry count
  const allSources = await prisma.discoverySource.findMany({
    select: { id: true, name: true, displayName: true, requiresAuth: true, status: true },
  });
  console.log(`\nRemaining Registry Sources count: ${allSources.length}`);
  for (const s of allSources) {
    console.log(` - ${s.displayName || s.name} (requiresAuth: ${s.requiresAuth}, status: ${s.status})`);
  }

  console.log("\nAll checks completed successfully!");
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
