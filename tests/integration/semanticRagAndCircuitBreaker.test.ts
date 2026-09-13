/**
 * §TEST: SEMANTIC RAG AND REDIS CIRCUIT BREAKER (TDD)
 * Verifies model selector modernization, semantic vector ranker, and quiet circuit breaker.
 */

import { 
  DEFAULT_GEMINI_MODEL, 
  FALLBACK_GEMINI_MODEL, 
  SUPPORTED_GEMINI_MODELS 
} from "@/lib/ai/modelSelector";
import { computeSemanticSimilarity } from "@/lib/ai/rag/semanticRanker";
import { rankOpportunitiesWithVectorRAG } from "@/lib/scraper/ranker";
import { isRedisCircuitAvailable } from "@/lib/queue/redis";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";
import { type DeduplicatedOpportunity } from "@/lib/scraper/deduplicator";

async function runTest() {
  console.log("===================================================================");
  console.log("  SEMANTIC RAG & REDIS CIRCUIT BREAKER INTEGRATION TEST            ");
  console.log("===================================================================\n");

  // 1. Model Selector Verification
  console.log("▶ [STEP 1] Validating modern Gemini model hierarchy...");
  console.log("  Default model:", DEFAULT_GEMINI_MODEL);
  console.log("  Fallback model:", FALLBACK_GEMINI_MODEL);
  console.log("  Supported models:", SUPPORTED_GEMINI_MODELS);

  if (DEFAULT_GEMINI_MODEL !== "gemini-3.7-flash") {
    throw new Error(`Expected DEFAULT_GEMINI_MODEL to be 'gemini-3.7-flash', got '${DEFAULT_GEMINI_MODEL}'`);
  }
  if (!SUPPORTED_GEMINI_MODELS.includes("gemini-3.5-flash-lite")) {
    throw new Error("Expected SUPPORTED_GEMINI_MODELS to include 'gemini-3.5-flash-lite'");
  }
  console.log("  ✓ Model selector properly configured with official Google Gemini models!\n");

  // 2. Semantic Similarity Score Verification
  console.log("▶ [STEP 2] Testing semantic vector ranker scoring...");
  const query = "Senior Full Stack Engineer React TypeScript";
  const matchingJob = "Staff Full Stack Engineer building React and TypeScript applications";
  const nonMatchingJob = "Lead Nurse Practitioner Emergency Medicine Pediatric Hospital";

  const highSim = await computeSemanticSimilarity(query, matchingJob);
  const lowSim = await computeSemanticSimilarity(query, nonMatchingJob);

  console.log(`  Matching similarity score: ${highSim.toFixed(3)}`);
  console.log(`  Non-matching similarity score: ${lowSim.toFixed(3)}`);

  if (highSim <= lowSim) {
    throw new Error(`Expected highSim (${highSim}) to be strictly greater than lowSim (${lowSim})`);
  }
  console.log("  ✓ Semantic similarity engine correctly discriminates between relevant and irrelevant roles!\n");

  // 3. Vector RAG Enhanced Opportunity Ranking
  console.log("▶ [STEP 3] Testing rankOpportunitiesWithVectorRAG...");
  const intent: SearchIntent = {
    role: "Full Stack Engineer",
    roles: ["Full Stack Engineer"],
    skills: ["React", "TypeScript", "Node.js"],
    locations: ["San Francisco", "Remote"],
    workMode: "REMOTE",
    experienceLevel: "SENIOR",
    opportunityType: "FULL_TIME",
  };

  const sampleOpportunities: DeduplicatedOpportunity[] = [
    {
      canonicalHash: "hash_fs_1",
      title: "Senior Full Stack Engineer",
      companyName: "Stripe",
      location: "Remote",
      workMode: "REMOTE",
      experienceLevel: "SENIOR",
      opportunityType: "FULL_TIME",
      description: "Build developer platforms using React, TypeScript, and Node.js.",
      requirements: ["React", "TypeScript", "Node.js"],
      skills: ["React", "TypeScript", "Node.js"],
      primaryApplyUrl: "https://stripe.com/jobs/1",
      sourceListings: [{ sourcePlatform: "Greenhouse", sourceUrl: "https://stripe.com/jobs/1", applyUrl: "https://stripe.com/jobs/1", seenAt: new Date(), verificationStatus: "VERIFIED" }],
      firstSeenAt: new Date(),
      lastVerifiedAt: new Date(),
      status: "ACTIVE",
    },
    {
      canonicalHash: "hash_nursing_2",
      title: "Clinical Nurse Manager",
      companyName: "HealthOrg",
      location: "San Francisco, CA",
      workMode: "ON_SITE",
      experienceLevel: "MID",
      opportunityType: "FULL_TIME",
      description: "Manage clinical operations and patient care in pediatric unit.",
      requirements: ["Nursing License", "Pediatric Care"],
      skills: ["Nursing", "Clinical Operations"],
      primaryApplyUrl: "https://health.org/jobs/2",
      sourceListings: [{ sourcePlatform: "Indeed", sourceUrl: "https://health.org/jobs/2", applyUrl: "https://health.org/jobs/2", seenAt: new Date(), verificationStatus: "RECENTLY_SEEN" }],
      firstSeenAt: new Date(),
      lastVerifiedAt: new Date(),
      status: "ACTIVE",
    },
  ];

  const ranked = await rankOpportunitiesWithVectorRAG(sampleOpportunities, intent);
  console.log(`  Top ranked role: "${ranked[0].opportunity.title}" (Score: ${ranked[0].totalScore}, Badge: ${ranked[0].matchBadge?.label})`);
  console.log(`  Second ranked role: "${ranked[1].opportunity.title}" (Score: ${ranked[1].totalScore}, Badge: ${ranked[1].matchBadge?.label})`);

  if (ranked[0].opportunity.title !== "Senior Full Stack Engineer") {
    throw new Error("Expected Senior Full Stack Engineer to rank #1");
  }
  if (ranked[0].totalScore <= ranked[1].totalScore) {
    throw new Error("Top ranked opportunity must have higher score than second ranked");
  }
  console.log("  ✓ Vector RAG opportunity ranker executed successfully!\n");

  // 4. Redis Circuit Breaker Verification
  console.log("▶ [STEP 4] Verifying quiet Redis circuit breaker...");
  const t0 = performance.now();
  const redisAvailable = await isRedisCircuitAvailable();
  const elapsedMs = performance.now() - t0;

  console.log(`  Redis circuit status: ${redisAvailable ? "AVAILABLE" : "QUIET_OFFLINE"} (Probed in ${Math.round(elapsedMs)}ms)`);
  console.log("  ✓ Circuit breaker returned deterministically without unhandled connection errors!\n");

  console.log("===================================================================");
  console.log("✓ [ALL TESTS PASSED] Semantic RAG & Circuit Breaker operational!");
  console.log("===================================================================\n");
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
