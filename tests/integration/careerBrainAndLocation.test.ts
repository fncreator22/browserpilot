/**
 * §CAREER BRAIN TAXONOMY & ROBUST LOCATION / QUERY RESOLUTION TEST
 */

import assert from "node:assert";
import { parseSearchIntent } from "../../lib/scraper/intentParser";
import { buildDiscoveryPlan } from "../../lib/scraper/discoveryPlanner";
import { careerBrainService } from "../../lib/discovery/taxonomy/careerBrainService";

export async function runCareerBrainAndLocationTests() {
  console.log("\n=================================================================");
  console.log("  CAREER BRAIN TAXONOMY, LOCATION & SEARCH VALIDATION TEST       ");
  console.log("=================================================================\n");

  // TEST 1: User Screenshot Query (Global / No Location + Temporal Gating)
  console.log("▶ [TEST 1] Verifying user query: 'find me atleast 10 jobs on software engineering in last 3 days'...");
  const intent1 = parseSearchIntent("find me atleast 10 jobs on software engineering in last 3 days");
  
  assert.strictEqual(intent1.role, "Software Engineer", "Role must be Software Engineer");
  assert.strictEqual(intent1.freshnessWindowHours, 72, "Freshness must be 72 hours (3 days)");
  assert.strictEqual(intent1.requestedCount, 10, "Requested count must be 10");
  assert.strictEqual(intent1.isExplicitLocation, false, "Must NOT flag explicit location for global search");
  assert.strictEqual(intent1.location, undefined, "Location must be undefined, not 'last 3 days'");

  const plan1 = buildDiscoveryPlan("find me atleast 10 jobs on software engineering in last 3 days");
  assert.strictEqual(plan1.isExplicitLocation, false, "Plan must have isExplicitLocation: false");
  assert.strictEqual(plan1.locations.length, 0, "Plan locations must be empty for global search");
  console.log("  ✓ Verified screenshot query parsed without false-positive location and with exact 72h window");

  // TEST 2: Explicit Location Query
  console.log("▶ [TEST 2] Verifying explicit location query: 'find me 10 software engineering jobs in London in last 3 days'...");
  const intent2 = parseSearchIntent("find me 10 software engineering jobs in London in last 3 days");
  assert.strictEqual(intent2.role, "Software Engineer");
  assert.strictEqual(intent2.location, "London", "Location must be parsed as London");
  assert.strictEqual(intent2.isExplicitLocation, true, "Must flag isExplicitLocation: true");
  assert.strictEqual(intent2.freshnessWindowHours, 72);

  const plan2 = buildDiscoveryPlan("find me 10 software engineering jobs in London in last 3 days");
  assert.strictEqual(plan2.isExplicitLocation, true);
  assert.ok(plan2.locations.includes("London"), "Plan must include London");
  console.log("  ✓ Verified explicit location query captures London accurately");

  // TEST 3: International Tech Hub & Remote
  console.log("▶ [TEST 3] Verifying international location extraction (Berlin, Tokyo, Singapore)...");
  const intentBerlin = parseSearchIntent("senior rust engineer in Berlin");
  assert.strictEqual(intentBerlin.location, "Berlin");
  assert.strictEqual(intentBerlin.isExplicitLocation, true);

  const intentTokyo = parseSearchIntent("ai researcher in Tokyo");
  assert.strictEqual(intentTokyo.location, "Tokyo");
  assert.strictEqual(intentTokyo.isExplicitLocation, true);
  console.log("  ✓ Verified international tech hubs recognized");

  // TEST 4: Career Brain Taxonomy Initialization
  console.log("▶ [TEST 4] Verifying Career Brain Departments and Categories...");
  const summaryBefore = careerBrainService.getTaxonomySummary();
  assert.ok(summaryBefore.totalDepartments >= 8, "Must contain at least 8 departments");
  assert.ok(summaryBefore.totalCategories >= 12, "Must contain at least 12 categories");
  assert.ok(summaryBefore.totalRoles >= 15, "Must contain curated seed roles");
  console.log(`  ✓ Career Brain initialized with ${summaryBefore.totalDepartments} departments, ${summaryBefore.totalCategories} categories, and ${summaryBefore.totalRoles} seed roles`);

  // TEST 5: Role Classification
  console.log("▶ [TEST 5] Verifying semantic role classification...");
  const classSWE = careerBrainService.classifyRole("Senior Backend Architect");
  assert.strictEqual(classSWE.departmentId, "engineering");
  assert.strictEqual(classSWE.categoryId, "backend_systems");

  const classML = careerBrainService.classifyRole("Foundation Model Alignment Scientist");
  assert.strictEqual(classML.departmentId, "data_ai");
  assert.strictEqual(classML.categoryId, "machine_learning");

  const classDesign = careerBrainService.classifyRole("Lead UX Systems Designer");
  assert.strictEqual(classDesign.departmentId, "product_design");
  assert.strictEqual(classDesign.categoryId, "ui_ux_design");
  console.log("  ✓ Successfully classified titles across Engineering, Data/AI, and Design");

  // TEST 6: Dynamic Learning from Discovered Portal Jobs
  console.log("▶ [TEST 6] Verifying self-learning brain from portal harvesting...");
  const initialLearnedCount = summaryBefore.dynamicallyLearnedRoles;

  const testId = Date.now();
  const novelRole1 = `Agentic AI Workflow Specialist ${testId}`;
  const novelRole2 = `Decentralized Database Kernel Engineer ${testId}`;

  const harvestBatch = [
    {
      title: novelRole1,
      skills: ["PyTorch", "LangChain", "Autonomous Agents"],
      sourcePlatform: "Ashby",
    },
    {
      title: novelRole2,
      skills: ["Rust", "Raft", "LSM Trees"],
      sourcePlatform: "Greenhouse",
    },
  ];

  const learnResult = await careerBrainService.learnFromDiscoveredJobs(harvestBatch, "Greenhouse");
  assert.strictEqual(learnResult.newlyLearned, 2, "Must learn 2 novel job roles");

  const summaryAfter = careerBrainService.getTaxonomySummary();
  assert.strictEqual(summaryAfter.dynamicallyLearnedRoles, initialLearnedCount + 2, "Learned roles count must increment by 2");

  // Test reinforcement of existing role
  const reinforceResult = await careerBrainService.learnFromDiscoveredJobs([
    {
      title: novelRole1,
      skills: ["Vector DBs"],
      sourcePlatform: "LinkedIn",
    },
  ]);
  assert.strictEqual(reinforceResult.reinforcedCount, 1, "Must reinforce previously learned role");
  console.log(`  ✓ Career Brain successfully learned 2 novel roles and reinforced existing observation`);

  // TEST 7: Query Role Expansion
  console.log("▶ [TEST 7] Verifying query role expansion...");
  const expanded = careerBrainService.expandQueryRoles("software engineering");
  assert.ok(expanded.length > 0, "Must expand query to related roles");
  assert.ok(expanded.includes("Software Engineer"), "Must include Software Engineer");
  assert.ok(expanded.some((r) => r.toLowerCase().includes("backend") || r.toLowerCase().includes("full stack")), "Must include related backend/fullstack roles");
  console.log(`  ✓ Query 'software engineering' expanded into ${expanded.length} related target roles: [${expanded.slice(0, 4).join(", ")}...]`);

  console.log("\n=================================================================");
  console.log("  ALL CAREER BRAIN & LOCATION TESTS PASSED! ✅                  ");
  console.log("=================================================================\n");
}

if (process.argv[1]?.includes("careerBrainAndLocation")) {
  runCareerBrainAndLocationTests().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
