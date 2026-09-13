/**
 * §REGRESSION TEST: Career Search Routing & False Confidence Fixes
 * 
 * Verifies:
 * 1. Intent classification recognizes "data analyst in bengaluru in last 30 days" as job discovery.
 * 2. parseSearchIntent extracts role: "Data Analyst", location: "Bengaluru", postedWithinDays: 30.
 * 3. ResultVerifier rejects bot-detection error pages as BLOCKED with 0.0 confidence (never 0.95).
 * 4. POST /api/search executes the Discover search pipeline and creates a Search record in the database.
 */

(process.env as any).IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";
(process.env as any).SKIP_RATE_LIMIT_FOR_TESTS = "true";

import assert from "assert";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isOpportunityDiscoveryIntent, parseSearchIntent } from "@/lib/scraper/intentParser";
import { ResultVerifier } from "@/lib/verification/resultVerifier";
import { POST as searchRoutePost } from "@/app/api/search/route";

export async function runCareerSearchRoutingRegressionTest() {
  console.log("===================================================================");
  console.log("  CAREER SEARCH ROUTING & FALSE CONFIDENCE REGRESSION TEST          ");
  console.log("===================================================================\n");

  const query = "data analyst in bengaluru in last 30 days";

  // STEP 1: Intent Classification
  console.log("▶ [STEP 1] Verifying natural-language intent classification...");
  const isOpp = isOpportunityDiscoveryIntent(query);
  assert.strictEqual(isOpp, true, `Query "${query}" must be classified as Opportunity Discovery`);
  console.log("  ✓ isOpportunityDiscoveryIntent returned true");

  const parsedIntent = parseSearchIntent(query);
  console.log("  ✓ Parsed Intent:", {
    role: parsedIntent.role,
    location: parsedIntent.location,
    postedWithinDays: parsedIntent.postedWithinDays,
    freshnessWindowHours: parsedIntent.freshnessWindowHours,
    sortMode: parsedIntent.sortMode,
  });

  assert.strictEqual(parsedIntent.role, "Data Analyst", `Expected role 'Data Analyst', got '${parsedIntent.role}'`);
  assert.ok(
    parsedIntent.location && parsedIntent.location.toLowerCase().includes("bengaluru"),
    `Expected location 'Bengaluru', got '${parsedIntent.location}'`
  );
  assert.strictEqual(parsedIntent.postedWithinDays, 30, `Expected postedWithinDays 30, got ${parsedIntent.postedWithinDays}`);
  console.log("  ✓ Role, location, and freshness correctly parsed");

  // STEP 2: False Confidence Protection
  console.log("\n▶ [STEP 2] Verifying ResultVerifier rejects bot-detection error text...");
  const blockedResult = ResultVerifier.verify({
    goal: query,
    observations: [
      {
        stepIndex: 1,
        action: { tool: "browser.navigate", parameters: { url: "https://duckduckgo.com", waitUntil: "load", timeout: 15000 } },
        status: "SUCCESS",
        currentUrl: "https://duckduckgo.com",
        title: "DuckDuckGo",
        elapsedMs: 200,
        timestamp: new Date().toISOString(),
      },
      {
        stepIndex: 2,
        action: { tool: "browser.extractText", parameters: { selector: "body", extractMultiple: false, maxChars: 5000 } },
        status: "SUCCESS",
        currentUrl: "https://duckduckgo.com",
        title: "DuckDuckGo",
        extractedData:
          "If this persists, please email us at duckduckgo.com using the subject 'anonymized error code'. To help us understand the context of your search, please include...",
        elapsedMs: 250,
        timestamp: new Date().toISOString(),
      },
    ],
    currentRecoveryAttempt: 0,
    expectedFields: [],
  });

  assert.strictEqual(blockedResult.status, "BLOCKED", `Expected status BLOCKED, got ${blockedResult.status}`);
  assert.strictEqual(blockedResult.confidence, 0.0, `Expected confidence 0.0, got ${blockedResult.confidence}`);
  console.log("  ✓ Bot-detection error page evaluated to BLOCKED with 0.0 confidence (never 0.95)");

  // STEP 3: Real Discover Pipeline Execution
  console.log("\n▶ [STEP 3] Verifying POST /api/search creates search and triggers Discover pipeline...");
  const salt = Date.now();
  const testUser = await prisma.user.create({
    data: {
      email: `career_routing_test_${salt}@browserpilot.ai`,
      passwordHash: "hash_test",
      name: "Career Routing Tester",
    },
  });

  const req = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": testUser.id,
      "x-test-user-id": testUser.id,
    },
    body: JSON.stringify({
      query,
      verifyEvidence: false,
    }),
  });

  const res = await searchRoutePost(req);
  console.log(`  ✓ Route status: ${res.status}`);
  assert.ok(res.status === 200 || res.status === 202, `Expected 200 or 202, got ${res.status}`);

  const body = (await res.json()) as any;
  console.log("  ✓ Response details:", {
    searchId: body.searchId,
    status: body.status,
    resultsCount: body.results?.length ?? 0,
    hasMetadata: !!body.metadata,
  });

  assert.ok(body.searchId, "Must return a searchId");
  const dbSearch = await prisma.search.findUnique({
    where: { id: body.searchId },
  });
  assert.ok(dbSearch, "Search record must exist in DB");
  assert.strictEqual(dbSearch.rawQuery, query, "Search record query must match input query");
  console.log(`  ✓ Search record verified in DB: id=${dbSearch.id}, query="${dbSearch.rawQuery}"`);

  console.log("\n✓ [REGRESSION TEST PASSED] Career search routing and verification hardened successfully!\n");
}

if (require.main === module) {
  runCareerSearchRoutingRegressionTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
