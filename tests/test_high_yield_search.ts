import assert from "node:assert";
import { augmentToGuaranteedYield } from "../lib/discovery/search/highYieldSearchAugmentor";
import { parseSearchIntent } from "../lib/scraper/intentParser";
import { type RankedOpportunity } from "../lib/scraper/ranker";

async function runTest() {
  console.log("Testing High-Yield Search Augmentor...");

  const intent = parseSearchIntent("machine learning intern");

  // Case 1: 0 initial exact matches (the 99% zero-results bug)
  const initialZero: RankedOpportunity[] = [];
  const augmentedFromZero = await augmentToGuaranteedYield(initialZero, "machine learning intern", intent, {
    minTotalYield: 10,
    maxTotalYield: 15,
  });

  console.log(`Augmented from 0 items: ${augmentedFromZero.length} opportunities returned`);
  assert.ok(augmentedFromZero.length >= 10, "Must guarantee at least 10 opportunities");
  assert.ok(augmentedFromZero.length <= 15, "Must stay within 15 opportunities ceiling");

  const recCount = augmentedFromZero.filter((o) => o.matchType === "RECOMMENDED" || o.matchType === "RECOMMENDED_SIMILAR_ROLE" || o.matchType === "RECOMMENDED_LOCATION").length;
  console.log(`Recommendations count: ${recCount}`);
  assert.ok(recCount >= 5, "Must have recommendations");

  // Case 2: 3 initial exact matches
  const mockInitial: RankedOpportunity[] = [
    {
      opportunity: {
        canonicalHash: "mock_exact_1",
        title: "Machine Learning Intern",
        companyName: "OpenAI",
        location: "San Francisco, CA",
        workMode: "HYBRID",
        experienceLevel: "INTERN",
        opportunityType: "INTERNSHIP",
        description: "ML research and models",
        primaryApplyUrl: "https://openai.com/careers/1",
        sourceListings: [],
        firstSeenAt: new Date(),
        lastVerifiedAt: new Date(),
        status: "ACTIVE",
      },
      totalScore: 92,
      rankPosition: 1,
      breakdown: { role: 35, skills: 20, workMode: 15, freshness: 12, verification: 10 },
      matchType: "EXACT_MATCH",
    },
    {
      opportunity: {
        canonicalHash: "mock_exact_2",
        title: "Machine Learning Engineering Intern",
        companyName: "Stripe",
        location: "Remote",
        workMode: "REMOTE",
        experienceLevel: "INTERN",
        opportunityType: "INTERNSHIP",
        description: "ML infrastructure",
        primaryApplyUrl: "https://stripe.com/jobs/2",
        sourceListings: [],
        firstSeenAt: new Date(),
        lastVerifiedAt: new Date(),
        status: "ACTIVE",
      },
      totalScore: 88,
      rankPosition: 2,
      breakdown: { role: 35, skills: 18, workMode: 15, freshness: 10, verification: 10 },
      matchType: "EXACT_MATCH",
    },
  ];

  const augmentedFromTwo = await augmentToGuaranteedYield(mockInitial, "machine learning intern", intent, {
    minTotalYield: 10,
    maxTotalYield: 15,
  });

  console.log(`Augmented from 2 items: ${augmentedFromTwo.length} opportunities returned`);
  assert.ok(augmentedFromTwo.length >= 10, "Must guarantee at least 10 opportunities");
  assert.ok(augmentedFromTwo.length <= 15, "Must stay within 15 opportunities ceiling");

  const exacts = augmentedFromTwo.filter((o) => o.matchType === "EXACT_MATCH");
  const recs = augmentedFromTwo.filter((o) => o.matchType !== "EXACT_MATCH");
  console.log(`Exact matches: ${exacts.length}, Recommendations: ${recs.length}`);
  assert.strictEqual(exacts.length, 2, "Must preserve the 2 exact matches");
  assert.ok(recs.length >= 8, "Must add recommendations up to 10-15 total");

  console.log("ALL HIGH-YIELD SEARCH AUGMENTOR TESTS PASSED!");
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
