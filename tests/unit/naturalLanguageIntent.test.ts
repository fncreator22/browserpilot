/**
 * §NATURAL-LANGUAGE JOB-SEARCH INTENT INTERPRETATION UNIT & INTEGRATION TESTS (TASK-018)
 * Validates deterministic translation of realistic natural language queries into
 * structured search intents and discovery plans without hallucinations.
 */

import { parseSearchIntent, buildDiscoveryPlan, type UserProfilePreferences } from "@/lib/scraper";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export async function runNaturalLanguageIntentTests() {
  console.log("▶ [UNIT] Running Natural-Language Job-Search Intent Interpretation Tests (TASK-018)...");

  // 1. Test Realistic Primary Prompt
  const prompt1 =
    "I’m looking for software engineering internships and entry-level software developer roles in Hyderabad or remote India. I work mainly with React, Next.js, Python and AI/ML. Prioritize recently posted opportunities and avoid showing me jobs I already know about.";

  const intent1 = parseSearchIntent(prompt1);
  const plan1 = buildDiscoveryPlan(prompt1);

  // Assert role families
  assert(
    plan1.roles.some(r => /software engineer|software developer|ai engineer/i.test(r)),
    "Should identify Software Engineer or Developer role family"
  );

  // Assert dual opportunity types and experience levels
  assert(
    plan1.opportunityTypes.includes("INTERNSHIP") && plan1.opportunityTypes.includes("FULL_TIME"),
    "Should support dual INTERNSHIP and FULL_TIME opportunity types when both are requested"
  );
  assert(
    plan1.experienceLevels.includes("INTERN") && plan1.experienceLevels.includes("ENTRY_LEVEL"),
    "Should support dual INTERN and ENTRY_LEVEL experience levels when both are requested"
  );

  // Assert locations with city precedence
  assert(
    plan1.locations.includes("Hyderabad"),
    "Should extract Hyderabad as a target location"
  );
  assert(
    plan1.locations.includes("India"),
    "Should extract India as a target location"
  );
  assert(
    plan1.workModes.includes("REMOTE"),
    "Should extract REMOTE work mode"
  );

  // Assert explicit skills
  assert(plan1.skills.some(s => /react/i.test(s)), "Should extract React skill");
  assert(plan1.skills.some(s => /next/i.test(s)), "Should extract Next.js skill");
  assert(plan1.skills.some(s => /python/i.test(s)), "Should extract Python skill");
  assert(plan1.skills.some(s => /ai/i.test(s)), "Should extract AI skill");

  // Assert freshness & latest intent
  assert(plan1.isLatestIntent === true, "Should detect latest/recent intent");
  assert(plan1.sortMode === "LATEST", "Should set sortMode to LATEST");
  assert(plan1.freshnessWindowHours === 48, "Should default to 48h freshness window for latest intent");

  // Assert exclusion intent
  assert(plan1.excludeKnown === true, "Should extract excludeKnown intent");
  console.log("  ✓ Verified primary multi-faceted natural-language user query parsing");

  // 2. Test Variations & Slang
  const promptSlang = "find me some wfh swe or sde roles with ts, py, and k8s just posted today";
  const planSlang = buildDiscoveryPlan(promptSlang);

  assert(planSlang.roles.some(r => /software engineer/i.test(r)), "Should map 'swe' / 'sde' to Software Engineer");
  assert(planSlang.workModes.includes("REMOTE"), "Should map 'wfh' to REMOTE work mode");
  assert(planSlang.skills.some(s => /typescript/i.test(s)), "Should map 'ts' to TypeScript");
  assert(planSlang.skills.some(s => /python/i.test(s)), "Should map 'py' to Python");
  assert(planSlang.skills.some(s => /docker/i.test(s)), "Should map 'k8s' to Docker/Kubernetes");
  assert(planSlang.isLatestIntent === true, "Should detect 'today' as latest intent");
  assert(planSlang.freshnessWindowHours === 24, "Should set 24h window for 'today'");
  console.log("  ✓ Verified informal abbreviations and slang mapping (wfh, swe, sde, ts, py, k8s)");

  // 3. Test Ambiguous Query with Minimal Input
  const promptAmbiguous = "tech jobs in India";
  const planAmbiguous = buildDiscoveryPlan(promptAmbiguous);

  assert(planAmbiguous.roles.length > 0, "Should have a sensible default role (Software Engineer)");
  assert(planAmbiguous.locations.includes("India"), "Should identify India as location");
  assert(planAmbiguous.isLatestIntent === false, "Ambiguous query should not force latest-only");
  assert(planAmbiguous.sortMode === "RELEVANCE_THEN_FRESHNESS", "Should default to balanced ranking mode");
  console.log("  ✓ Verified graceful handling of ambiguous queries without hallucinating constraints");

  // 4. Test Explicit User Filter Overrides & Profile Precedence
  const profile: UserProfilePreferences = {
    skills: ["java", "spring", "sql", "aws"],
    targetRoles: ["Backend Engineer"],
    preferredLocations: ["Pune"],
    preferredWorkMode: "HYBRID",
    preferredOpportunityType: "FULL_TIME",
    sortMode: "RELEVANCE",
    minimumMatchScore: 70,
  };

  // Query explicitly specifies Frontend and React in Bengaluru with Remote
  const explicitQuery = "frontend developer openings in Bengaluru with React remote only";
  const planBlended = buildDiscoveryPlan(explicitQuery, {}, profile);

  // Explicit role & location must take precedence
  assert(planBlended.roles.some(r => /frontend/i.test(r)), "Explicit role must override profile targetRole");
  assert(planBlended.locations.includes("Bengaluru"), "Explicit location must override profile location");
  assert(planBlended.workModes.includes("REMOTE"), "Explicit work mode must override profile hybrid mode");
  assert(planBlended.skills.some(s => /react/i.test(s)), "Explicit skill must be captured");

  // Profile skills should backfill missing slots up to limit
  assert(planBlended.skills.some(s => /java/i.test(s)), "Profile skills should blend in to fill out candidate profile");
  console.log("  ✓ Verified explicit user constraints strictly override profile preferences");

  // 5. Test Source Preferences & Relevance Score Extraction
  const promptSources = "Check LinkedIn and Y Combinator for high relevance AI engineer roles with at least 80% fit";
  const planSources = buildDiscoveryPlan(promptSources);

  assert(planSources.sources.includes("LinkedIn"), "Should identify LinkedIn source preference");
  assert(planSources.sources.includes("Y Combinator"), "Should identify Y Combinator source preference");
  assert(!planSources.sources.includes("Indeed"), "Should exclude Indeed when user specified only LinkedIn & YC");
  assert(planSources.minimumMatchScore === 80, "Should parse minimum match score expectation (80%)");
  console.log("  ✓ Verified source preferences and minimum relevance expectations");

  // 6. Test Watch Intent Extraction
  const promptWatch = "set up a continuous watch for software engineer internships in Hyderabad and monitor this every 4 hours";
  const planWatch = buildDiscoveryPlan(promptWatch);

  assert(planWatch.watchIntent !== undefined, "Should detect watch intent");
  assert(planWatch.watchIntent?.enabled === true, "Watch should be enabled");
  assert(planWatch.watchIntent?.scanIntervalHours === 4, "Should extract 4 hours scan interval");
  console.log("  ✓ Verified background watch intent and scan interval extraction");

  console.log("✓ [UNIT] Natural-Language Job-Search Intent Interpretation Tests Passed!\n");
}
