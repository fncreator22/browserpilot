import assert from "assert";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { evaluateLocationCompatibility } from "@/lib/scraper/searchQualityGate";

async function runTests() {
  console.log("=================================================");
  console.log("RUNNING LOCATION INTEL & YIELD VERIFICATION");
  console.log("=================================================");

  // 1. "Remote" is NOT a geographic location in parseSearchIntent
  console.log("\n▶ Test 1: parseSearchIntent treats 'Remote' as workMode and strips from locations...");
  const intent = parseSearchIntent("Software Engineer in Bengaluru, Remote");
  assert.ok(intent.locations && !intent.locations.map(l => l.toLowerCase()).includes("remote"), "Remote must not be in intent.locations");
  assert.ok(intent.locations && intent.locations.includes("Bengaluru"), "Bengaluru must be in intent.locations");
  assert.ok(intent.workModes && intent.workModes.includes("REMOTE"), "REMOTE must be in intent.workModes");
  console.log("  Test 1 Passed:", { locations: intent.locations, workModes: intent.workModes });

  // 2. buildDiscoveryPlan strips "Remote" from locations and promotes to workModes
  console.log("\n▶ Test 2: buildDiscoveryPlan filters 'Remote' from locations and sets REMOTE work mode...");
  const plan = buildDiscoveryPlan("Frontend Developer", {
    locations: ["Remote", "Hyderabad", "Bengaluru"],
  });
  assert.ok(!plan.locations.map(l => l.toLowerCase()).includes("remote"), "Remote must not be in plan.locations");
  assert.ok(plan.locations.includes("Hyderabad"), "Hyderabad must be in plan.locations");
  assert.ok(plan.locations.includes("Bengaluru"), "Bengaluru must be in plan.locations");
  assert.ok(plan.workModes.includes("REMOTE"), "REMOTE must be in plan.workModes");
  assert.ok(plan.maxResultsPerSource >= 30, "maxResultsPerSource must be >= 30 for high yield");
  console.log("  Test 2 Passed:", { locations: plan.locations, workModes: plan.workModes, maxResults: plan.maxResultsPerSource });

  // 3. evaluateLocationCompatibility rejects foreign cross-border remote jobs
  console.log("\n▶ Test 3: evaluateLocationCompatibility rejects GitLab Israel / Canada / UK remote jobs when target is Bengaluru/Hyderabad...");
  const israelEval = evaluateLocationCompatibility(
    "GitLab · Israel , United Kingdom (Remote)",
    ["bengaluru", "hyderabad"],
    "REMOTE",
    true
  );
  assert.strictEqual(israelEval.isMatch, false, "Israel / UK remote job must be rejected for Bengaluru/Hyderabad");
  console.log("  Israel / UK rejection:", israelEval.rejectionReason);

  const canadaEval = evaluateLocationCompatibility(
    "GitLab · Canada , United States (Remote)",
    ["bengaluru", "hyderabad"],
    "REMOTE",
    true
  );
  assert.strictEqual(canadaEval.isMatch, false, "Canada / US remote job must be rejected for Bengaluru/Hyderabad");
  console.log("  Canada / US rejection:", canadaEval.rejectionReason);

  // 4. evaluateLocationCompatibility accepts valid regional and global remote jobs
  console.log("\n▶ Test 4: evaluateLocationCompatibility accepts valid local and global remote jobs...");
  const localEval = evaluateLocationCompatibility(
    "Bengaluru, India (Remote)",
    ["bengaluru", "hyderabad"],
    "REMOTE",
    true
  );
  assert.strictEqual(localEval.isMatch, true, "Bengaluru remote job must be accepted");

  const globalEval = evaluateLocationCompatibility(
    "Remote",
    ["bengaluru", "hyderabad"],
    "REMOTE",
    true
  );
  assert.strictEqual(globalEval.isMatch, true, "Global pure remote job must be accepted");
  console.log("  Test 4 Passed: Valid local and global remote jobs accepted");

  console.log("\n=================================================");
  console.log("ALL LOCATION INTEL & YIELD TESTS PASSED!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
