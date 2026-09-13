/**
 * §TEST: BENGALURU INTERN SEARCH FIX (TDD & INTEGRATION)
 * 
 * Verifies that the natural language query "intern data science in bengaluru in last 30 days"
 * produces a deterministic DiscoveryPlan with singular and plural attributes,
 * builds accurate provider search URLs targeting Bengaluru (not Worldwide),
 * and harvests real verified Data Science internship candidates.
 */

import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { LinkedInProvider } from "@/lib/scraper/providers/linkedInProvider";

async function runTest() {
  console.log("===================================================================");
  console.log("  BENGALURU DATA SCIENCE INTERN SEARCH INTEGRATION TEST            ");
  console.log("===================================================================\n");

  const query = "intern data science in bengaluru in last 30 days";
  console.log(`▶ [STEP 1] Building discovery plan for query: "${query}"...`);

  const plan = buildDiscoveryPlan(query);

  console.log("  Extracted plan:", {
    roles: plan.roles,
    role: plan.role,
    locations: plan.locations,
    location: plan.location,
    workModes: plan.workModes,
    opportunityTypes: plan.opportunityTypes,
    experienceLevels: plan.experienceLevels,
    postedWithinDays: plan.postedWithinDays,
    freshnessWindowHours: plan.freshnessWindowHours,
  });

  // Assertion 1: Roles and locations must be extracted in plural and singular
  if (!plan.roles.some((r) => r.toLowerCase().includes("data science"))) {
    throw new Error(`Expected roles to include "data science", got: ${JSON.stringify(plan.roles)}`);
  }
  if (!plan.locations.some((l) => l.toLowerCase().includes("bengaluru"))) {
    throw new Error(`Expected locations to include "bengaluru", got: ${JSON.stringify(plan.locations)}`);
  }
  if (plan.role !== plan.roles[0]) {
    throw new Error(`Expected singular role "${plan.roles[0]}", got: "${plan.role}"`);
  }
  if (plan.location !== plan.locations[0]) {
    throw new Error(`Expected singular location "${plan.locations[0]}", got: "${plan.location}"`);
  }
  console.log("  ✓ Discovery plan extracts roles, locations, and singular convenience getters!\n");

  // Assertion 2: LinkedIn Provider URL construction
  console.log("▶ [STEP 2] Verifying LinkedIn provider search URL...");
  const linkedIn = new LinkedInProvider();
  const searchUrl = linkedIn.buildSearchUrl(plan);
  console.log("  Generated Search URL:", searchUrl);

  const parsedUrl = new URL(searchUrl);
  const keywords = parsedUrl.searchParams.get("keywords") || "";
  const location = parsedUrl.searchParams.get("location") || "";
  const f_E = parsedUrl.searchParams.get("f_E");
  const f_TPR = parsedUrl.searchParams.get("f_TPR");

  console.log("  Parsed URL Params:", { keywords, location, f_E, f_TPR });

  if (!keywords.toLowerCase().includes("data science")) {
    throw new Error(`Expected keywords to contain "data science", got: "${keywords}"`);
  }
  if (location.toLowerCase() !== "bengaluru") {
    throw new Error(`CRITICAL: Expected location="bengaluru", but got "${location}" (was falling back to Worldwide!)`);
  }
  if (f_E !== "1") {
    throw new Error(`Expected internship filter f_E=1, got: "${f_E}"`);
  }
  console.log("  ✓ LinkedIn Search URL correctly specifies location=Bengaluru and keywords=Intern Data Science!\n");

  // Assertion 3: Live Harvest Candidates from LinkedIn
  console.log("▶ [STEP 3] Testing live harvest from LinkedIn guest search...");
  const candidates = await linkedIn.harvestCandidates(plan, {
    maxCandidates: 10,
    timeoutMs: 15000,
  });

  console.log(`  Harvested ${candidates.length} candidates from LinkedIn:`);
  for (const c of candidates.slice(0, 5)) {
    console.log(`   - "${c.title}" at ${c.companyName} (${c.location || "N/A"}) [${c.sourcePlatform}]`);
  }

  if (candidates.length === 0) {
    throw new Error("Expected LinkedIn to return at least 1 candidate for Bengaluru Data Science Intern search!");
  }

  console.log("\n===================================================================");
  console.log(`  ✓ SUCCESS: Bengaluru Data Science Intern search verified! (${candidates.length} live candidates)`);
  console.log("===================================================================\n");
}

runTest().catch((err) => {
  console.error("\n❌ Test Failed:", err);
  process.exit(1);
});
