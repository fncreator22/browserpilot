import assert from "assert";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { parsePostingDate } from "@/lib/scraper/freshnessExtractor";
import { SwarmDiscoveryEngine } from "@/lib/scraper/swarmDiscovery";
import { executeSearchPipeline } from "@/lib/scraper/searchPipeline";
import { rankOpportunities } from "@/lib/scraper/ranker";
import { deduplicateCandidates } from "@/lib/scraper/deduplicator";
import { type SearchProvider, type SearchIntent, type RawJobCandidate, type ProviderLimits } from "@/lib/scraper/providers/baseProvider";

export async function runPersonalizedSwarmDiscoveryIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Personalized Swarm Discovery & Freshness Tests (TASK-013)...");

  // 1. Test Discovery Planning & Intent Extraction
  const standardPlan = buildDiscoveryPlan("frontend developer in San Francisco", { experienceLevel: "ENTRY_LEVEL" });
  assert.strictEqual(standardPlan.isLatestIntent, false);
  assert.strictEqual(standardPlan.sortMode, "RELEVANCE_THEN_FRESHNESS");
  assert.ok(standardPlan.roles.includes("Frontend Engineer"));
  assert.ok(standardPlan.locations.includes("San Francisco"));
  assert.strictEqual(standardPlan.experienceLevels[0], "ENTRY_LEVEL");
  console.log("  ✓ Verified deterministic discovery plan building and role/location extraction");

  // 2. Test "Latest / Recent" Intent Detection in Discovery Plan
  const latestPlan = buildDiscoveryPlan("latest React internships in Hyderabad", {}, {
    skills: ["TypeScript"],
    preferredLocations: ["Hyderabad"],
    preferredOpportunityType: "INTERNSHIP",
  });
  assert.strictEqual(latestPlan.isLatestIntent, true, "Must detect 'latest' keyword");
  assert.strictEqual(latestPlan.sortMode, "LATEST");
  assert.ok(latestPlan.opportunityTypes.includes("INTERNSHIP"));
  assert.ok(latestPlan.skills.includes("React"));
  assert.ok(latestPlan.skills.includes("TypeScript"), "Must incorporate persistent user profile skills");
  assert.ok(latestPlan.locations.includes("Hyderabad"));
  console.log("  ✓ Verified 'latest' search intent detection, profile skill blending, and sortMode switching");

  // 3. Test Deterministic Posting Date Parsing & Freshness Classification
  const refTime = new Date("2026-08-29T12:00:00Z");

  const todaySignal = parsePostingDate("Posted 2 hours ago", refTime);
  assert.strictEqual(todaySignal.freshnessClass, "TODAY");
  assert.strictEqual(todaySignal.freshnessScore, 15);
  assert.ok(todaySignal.postedAt !== null);

  const yesterdaySignal = parsePostingDate("1 day ago", refTime);
  assert.strictEqual(yesterdaySignal.freshnessClass, "TODAY");
  assert.strictEqual(yesterdaySignal.freshnessScore, 14);

  const threeDaysSignal = parsePostingDate("3 days ago", refTime);
  assert.strictEqual(threeDaysSignal.freshnessClass, "RECENT");
  assert.strictEqual(threeDaysSignal.freshnessScore, 12);

  const staleSignal = parsePostingDate("1 month ago", refTime);
  assert.strictEqual(staleSignal.freshnessClass, "STALE");
  assert.strictEqual(staleSignal.freshnessScore, 0);

  const unknownSignal = parsePostingDate(null, refTime);
  assert.strictEqual(unknownSignal.freshnessClass, "UNKNOWN");
  assert.strictEqual(unknownSignal.postedAt, null, "Must NOT fabricate missing posting date");
  console.log("  ✓ Verified deterministic posting date extraction, relative timestamp calculations, and zero fabrication");

  // 4. Test Swarm Orchestration with Mock Providers & Partial Failure Tolerance
  const mockSuccessProvider: SearchProvider = {
    name: "MockLinkedIn",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "MockLinkedIn",
        sourceUrl: "https://linkedin.example.com/jobs/101?trackingId=xyz",
        applyUrl: "https://linkedin.example.com/apply/101",
        title: "Frontend Developer",
        companyName: "Acme Cloud",
        location: "Hyderabad",
        workMode: "HYBRID",
        opportunityType: "INTERNSHIP",
        rawSnippet: "Posted 2 hours ago - Strong React & TypeScript required",
        discoveredAt: new Date(),
      },
    ],
  };

  const mockIndeedProvider: SearchProvider = {
    name: "MockIndeed",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "MockIndeed",
        sourceUrl: "https://indeed.example.com/viewjob?jk=202",
        applyUrl: "https://indeed.example.com/apply/202",
        title: "Frontend Developer",
        companyName: "Acme Cloud", // Duplicate candidate from second source
        location: "Hyderabad",
        workMode: "HYBRID",
        opportunityType: "INTERNSHIP",
        rawSnippet: "Posted today - React / Next.js",
        discoveredAt: new Date(),
      },
    ],
  };

  const mockFailingProvider: SearchProvider = {
    name: "MockFailingYC",
    supports: () => true,
    harvestCandidates: async () => {
      throw new Error("Simulated upstream network timeout");
    },
  };

  const testSwarmEngine = new SwarmDiscoveryEngine([
    mockSuccessProvider,
    mockIndeedProvider,
    mockFailingProvider,
  ]);

  const swarmPlan = buildDiscoveryPlan("latest frontend internship in Hyderabad");
  const swarmResult = await testSwarmEngine.executeSwarm(swarmPlan, { concurrencyLimit: 3 });

  assert.strictEqual(swarmResult.status, "PARTIAL_SUCCESS", "Must succeed as PARTIAL_SUCCESS when 1 provider fails");
  assert.strictEqual(swarmResult.candidates.length, 2, "Must harvest 2 candidates from succeeding providers");
  assert.strictEqual(swarmResult.providerTelemetry.length, 3);
  assert.strictEqual(swarmResult.swarmTelemetry.sourcesCompleted, 2);
  assert.strictEqual(swarmResult.swarmTelemetry.sourcesFailed, 1);
  console.log("  ✓ Verified swarm orchestration, concurrency bounding, and partial failure resilience");

  // 5. Test Multi-Source Deduplication & Provenance Preservation
  const deduplicated = deduplicateCandidates(swarmResult.candidates);
  assert.strictEqual(deduplicated.length, 1, "Duplicate listings from LinkedIn and Indeed must merge into 1 canonical opportunity");
  assert.strictEqual(deduplicated[0].sourceListings.length, 2, "Must preserve both independent SourceListings");
  assert.ok(deduplicated[0].sourceListings.some((l) => l.sourcePlatform === "MockLinkedIn"));
  assert.ok(deduplicated[0].sourceListings.some((l) => l.sourcePlatform === "MockIndeed"));
  console.log("  ✓ Verified multi-source deduplication and independent source listing preservation");

  // 6. Test Freshness-Aware Relevance Ranking (LATEST vs RELEVANCE mode)
  const candidateToday: RawJobCandidate = {
    sourcePlatform: "SourceA",
    sourceUrl: "https://example.com/job/today",
    applyUrl: "https://example.com/job/today",
    title: "Junior React Engineer",
    companyName: "Beta Corp",
    location: "Hyderabad",
    workMode: "REMOTE",
    opportunityType: "INTERNSHIP",
    rawSnippet: "Posted 1 hour ago",
    discoveredAt: new Date(),
  };
  (candidateToday as any).postedAt = new Date(Date.now() - 3600 * 1000); // 1 hour ago

  const candidateOld: RawJobCandidate = {
    sourcePlatform: "SourceB",
    sourceUrl: "https://example.com/job/old",
    applyUrl: "https://example.com/job/old",
    title: "React Developer",
    companyName: "Gamma Corp",
    location: "Hyderabad",
    workMode: "REMOTE",
    opportunityType: "INTERNSHIP",
    rawSnippet: "Posted 30 days ago",
    discoveredAt: new Date(),
  };
  (candidateOld as any).postedAt = new Date(Date.now() - 30 * 24 * 3600 * 1000); // 30 days ago

  const opps = deduplicateCandidates([candidateOld, candidateToday]);

  const latestRanked = rankOpportunities(opps, { role: "React Developer", location: "Hyderabad" }, { sortMode: "LATEST" });
  assert.strictEqual(latestRanked[0].opportunity.title, "Junior React Engineer", "LATEST mode must rank today's posting above month-old posting");

  console.log("  ✓ Verified freshness-aware ranking prioritization in LATEST sort mode");

  // 7. Test Full Search Pipeline with Swarm Execution and Persistence
  const pipelineResult = await executeSearchPipeline("latest React internships in Hyderabad", {
    customProviders: [mockSuccessProvider, mockIndeedProvider],
    persistToDb: true,
    maxResults: 5,
  });

  assert.ok(pipelineResult.searchId, "Must create and persist Search record");
  assert.strictEqual(pipelineResult.rankedOpportunities.length, 1);
  assert.strictEqual(pipelineResult.swarmTelemetry?.sourcesCompleted, 2);
  assert.ok(pipelineResult.plan?.isLatestIntent);
  console.log("  ✓ Verified full end-to-end swarm discovery search pipeline and database persistence");

  console.log("✓ [INTEGRATION] Personalized Swarm Discovery & Freshness Tests Passed!\n");
}
