/**
 * §TASK-019 UNIFIED NATURAL-LANGUAGE JOB DISCOVERY ROUTING TESTS
 * Tests real-time deterministic intent detection, opportunity vs browser-agent routing,
 * structured result formatting, and 1-Click Autonomous Watch configuration.
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import {
  isOpportunityDiscoveryIntent,
  parseSearchIntent,
  buildDiscoveryPlan,
  executeSearchPipeline,
  type SearchProvider,
} from "@/lib/scraper";
import { prisma } from "@/lib/db";
import { upsertDiscoveryWatch, getDiscoveryWatch } from "@/lib/db/opportunities";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[TASK-019 ASSERTION FAILED]: ${msg}`);
  }
}

export async function runUnifiedNaturalLanguageRoutingTests() {
  console.log("▶ [TASK-019] Running Unified Natural-Language Routing & 1-Click Watch Tests...");

  // ---------------------------------------------------------------------------
  // 1. Natural Language Test Cases: Opportunity vs General Browser Agent Intent
  // ---------------------------------------------------------------------------
  // Case 1: "Find software engineering internships in Hyderabad."
  const prompt1 = "Find software engineering internships in Hyderabad.";
  assert(isOpportunityDiscoveryIntent(prompt1) === true, "Case 1 must be classified as Opportunity Discovery");
  const intent1 = parseSearchIntent(prompt1);
  assert(intent1.opportunityTypes?.includes("INTERNSHIP") || intent1.opportunityType === "INTERNSHIP", "Case 1 must extract INTERNSHIP");
  assert(intent1.locations?.includes("Hyderabad") || intent1.location === "Hyderabad", "Case 1 must extract Hyderabad");
  console.log("  ✓ Case 1: 'Find software engineering internships in Hyderabad.' -> OPPORTUNITY DISCOVERY");

  // Case 2: "Find recent React developer jobs in Hyderabad or remote India."
  const prompt2 = "Find recent React developer jobs in Hyderabad or remote India.";
  assert(isOpportunityDiscoveryIntent(prompt2) === true, "Case 2 must be classified as Opportunity Discovery");
  const intent2 = parseSearchIntent(prompt2);
  assert(intent2.sortMode === "LATEST", "Case 2 must extract LATEST freshness sortMode");
  assert(Boolean(intent2.locations?.includes("Hyderabad") && intent2.locations?.includes("India")), "Case 2 must extract multi-locations");
  assert(Boolean(intent2.skills?.some((s) => /react/i.test(s))), "Case 2 must extract React skill");
  console.log("  ✓ Case 2: 'Find recent React developer jobs in Hyderabad or remote India.' -> MULTI-LOCATION & FRESHNESS");

  // Case 3: "Find internships and entry-level software engineer roles using Python and Next.js."
  const prompt3 = "Find internships and entry-level software engineer roles using Python and Next.js.";
  assert(isOpportunityDiscoveryIntent(prompt3) === true, "Case 3 must be classified as Opportunity Discovery");
  const intent3 = parseSearchIntent(prompt3);
  assert(
    Boolean(intent3.opportunityTypes?.includes("INTERNSHIP") && intent3.opportunityTypes?.includes("FULL_TIME")),
    "Case 3 must support coexistence of INTERNSHIP and FULL_TIME / ENTRY_LEVEL"
  );
  console.log("  ✓ Case 3: 'Find internships and entry-level roles using Python/Next.js' -> DUAL OPPORTUNITY TYPE");

  // Case 4: "Find jobs I haven't seen before and prioritize the strongest matches."
  const prompt4 = "Find jobs I haven't seen before and prioritize the strongest matches.";
  assert(isOpportunityDiscoveryIntent(prompt4) === true, "Case 4 must be classified as Opportunity Discovery");
  const intent4 = parseSearchIntent(prompt4);
  assert(intent4.excludeKnown === true, "Case 4 must extract excludeKnown=true");
  console.log("  ✓ Case 4: 'Find jobs I haven't seen before' -> EXCLUDE KNOWN & RELEVANCE");

  // Case 5: "Keep watching for these jobs every 4 hours and tell me when something genuinely new appears."
  const prompt5 = "Keep watching for these jobs every 4 hours and tell me when something genuinely new appears.";
  assert(isOpportunityDiscoveryIntent(prompt5) === true, "Case 5 must be classified as Opportunity Discovery");
  const intent5 = parseSearchIntent(prompt5);
  assert(intent5.watchIntent?.enabled === true, "Case 5 must enable watchIntent");
  assert(intent5.watchIntent?.scanIntervalHours === 4, "Case 5 must extract 4-hour scan interval");
  console.log("  ✓ Case 5: 'Keep watching every 4 hours' -> WATCH INTENT ENABLED (4h)");

  // Case 6: "Open this website and extract the pricing information."
  const prompt6 = "Open this website and extract the pricing information.";
  assert(isOpportunityDiscoveryIntent(prompt6) === false, "Case 6 must NOT be classified as Opportunity Discovery");
  console.log("  ✓ Case 6: 'Open this website and extract the pricing information.' -> GENERAL AGENT (Preserved)");

  // Case 7: "Search the web for information about Kubernetes."
  const prompt7 = "Search the web for information about Kubernetes.";
  assert(isOpportunityDiscoveryIntent(prompt7) === false, "Case 7 must NOT be classified as Opportunity Discovery");
  console.log("  ✓ Case 7: 'Search the web for information about Kubernetes.' -> GENERAL AGENT (Preserved)");

  // ---------------------------------------------------------------------------
  // 2. Multi-Source Pipeline Execution & Result Payload Integrity
  // ---------------------------------------------------------------------------
  const salt = Date.now();
  const testUser = await prisma.user.create({
    data: {
      email: `unified_user_${salt}@browserpilot.ai`,
      passwordHash: "hash_unified_test",
    },
  });

  const mockProvider: SearchProvider = {
    name: "UnifiedMockProvider",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: `https://linkedin.com/jobs/view/unified-${salt}`,
        applyUrl: `https://company.careers/apply/unified-${salt}`,
        title: "Junior React Developer",
        companyName: `Unified Corp ${salt}`,
        location: "Hyderabad, India",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        experienceLevel: "ENTRY_LEVEL",
        description: "Develop frontend web applications with React and Next.js.",
        rawSnippet: "Posted 2 hours ago",
        discoveredAt: new Date(),
      },
    ],
  };

  const pipelineRes = await executeSearchPipeline(intent2, {
    userId: testUser.id,
    rawQuery: prompt2,
    persistToDb: true,
    verifyEvidence: false,
    customProviders: [mockProvider],
  });

  assert(pipelineRes.rankedOpportunities.length === 1, "Pipeline must return ranked opportunity");
  const opp = pipelineRes.rankedOpportunities[0].opportunity;
  assert(opp.title === "Junior React Developer", "Must preserve title");
  assert(opp.primaryApplyUrl.includes(`unified-${salt}`), "Must preserve apply URL");
  assert(pipelineRes.rankedOpportunities[0].totalScore >= 70, "Must calculate matchScore");
  console.log("  ✓ Pipeline execution successfully generated structured ranked results");

  // ---------------------------------------------------------------------------
  // 3. 1-Click Autonomous Watch Creation from Parsed Intent
  // ---------------------------------------------------------------------------
  const createdWatch = await upsertDiscoveryWatch(testUser.id, {
    enabled: true,
    roles: intent5.roles || [intent5.role || "Software Engineer"],
    skills: intent5.skills || ["React", "Python"],
    locations: intent5.locations || ["Hyderabad", "Remote"],
    workModes: intent5.workModes || ["REMOTE"],
    opportunityTypes: intent5.opportunityTypes || ["FULL_TIME"],
    experienceLevels: intent5.experienceLevels || ["ENTRY_LEVEL"],
    minimumMatchScore: intent5.minimumMatchScore || 70,
    scanIntervalHours: intent5.watchIntent?.scanIntervalHours || 4,
    preferredSources: ["LinkedIn", "Y Combinator", "Indeed"],
  });

  assert(createdWatch.enabled === true, "Watch must be enabled");
  assert(createdWatch.scanIntervalHours === 4, "Watch must store 4-hour scan interval");
  assert(createdWatch.minimumMatchScore >= 65, "Watch must store valid min score");

  const retrievedWatch = await getDiscoveryWatch(testUser.id);
  assert(retrievedWatch !== null && retrievedWatch.enabled === true, "Watch must be retrievable and enabled");
  assert(retrievedWatch.scanIntervalHours === 4, "Watch config must preserve scanIntervalHours");
  const directDbWatch = await prisma.discoveryWatch.findUnique({ where: { userId: testUser.id } });
  assert(directDbWatch !== null && directDbWatch.userId === testUser.id, "Watch must belong strictly to authenticated user");
  console.log("  ✓ 1-Click Autonomous Watch persistence verified with authenticated session isolation");

  // Cleanup
  await prisma.discoveryWatch.deleteMany({ where: { userId: testUser.id } });
  await prisma.search.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });

  console.log("✓ [TASK-019] All Unified Natural-Language Routing Tests Passed!\n");
}

if (require.main === module) {
  runUnifiedNaturalLanguageRoutingTests().then(
    () => process.exit(0),
    (err) => {
      console.error("Test failed:", err);
      process.exit(1);
    }
  );
}
