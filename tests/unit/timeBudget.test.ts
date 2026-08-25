import { 
  calculateJobTimeBudget, 
  MIN_TIME_BUDGET_MS, 
  BASE_TIME_BUDGET_MS, 
  MAX_HARD_CEILING_MS 
} from "@/lib/capabilities/timeBudget";

export async function runTimeBudgetUnitTests() {
  console.log("\n▶ [UNIT] Running Fast-Calculated Time Budget Tests (Prompt C2)...");

  // 1. Benchmark Execution Speed (< 1ms)
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) {
    calculateJobTimeBudget({ prompt: "Go to example.com and extract page title and screenshot." });
  }
  const avgMs = (performance.now() - t0) / 1000;
  console.log(`  ✓ Benchmark: Average calculation time = ${avgMs.toFixed(4)}ms (near-instant arithmetic)`);
  if (avgMs > 1.0) {
    throw new Error(`Calculation too slow! Expected < 1ms, got ${avgMs}ms`);
  }

  // 2. Simple Task (Baseline ~45s)
  const simple = calculateJobTimeBudget({ prompt: "Read the headline on example.com" });
  console.log(`  ✓ Simple Task Budget: ${simple.budgetSeconds}s (Base: ${simple.breakdown.baseMs / 1000}s)`);
  if (simple.budgetMs !== BASE_TIME_BUDGET_MS) {
    throw new Error(`Expected baseline ${BASE_TIME_BUDGET_MS}ms, got ${simple.budgetMs}ms`);
  }

  // 3. Medium Task with Screenshot (+15s -> 60s)
  const medium = calculateJobTimeBudget({ prompt: "Go to https://example.com and take a screenshot" });
  console.log(`  ✓ Medium Task (with screenshot): ${medium.budgetSeconds}s (Heuristics: ${medium.matchedHeuristics.join(", ")})`);
  if (medium.budgetSeconds !== 60) {
    throw new Error(`Expected 60s budget for screenshot task, got ${medium.budgetSeconds}s`);
  }

  // 4. Complex Multi-Action Task (Form + Table + Screenshot + Multiple Domains)
  const complex = calculateJobTimeBudget({
    prompt: "Login to portal, fill user details form, extract pricing table and capture a screenshot",
    allowedDomains: ["portal.com", "api.portal.com", "cdn.portal.com"],
    maxStepsBudget: 20,
  });
  console.log(`  ✓ Complex Task: ${complex.budgetSeconds}s (Heuristics: ${complex.matchedHeuristics.join(", ")})`);
  if (complex.budgetSeconds < 100) {
    throw new Error(`Expected scaled budget > 100s for complex task, got ${complex.budgetSeconds}s`);
  }

  // 5. Hard 5-Minute Ceiling (300s) Strict Enforcement Test
  const extremePrompts = [
    {
      prompt: "login authenticate password signin form fill input submit search table paginate crawl list extract all download pdf report export screenshot capture visual multiple pages compare rows across everything",
      allowedDomains: ["d1.com", "d2.com", "d3.com", "d4.com", "d5.com", "d6.com", "d7.com", "d8.com", "d9.com", "d10.com"],
      maxStepsBudget: 100,
    },
    {
      prompt: "A".repeat(10000),
      allowedDomains: Array.from({ length: 50 }, (_, i) => `domain${i}.com`),
      maxStepsBudget: 500,
    },
  ];

  for (const extreme of extremePrompts) {
    const res = calculateJobTimeBudget(extreme);
    if (res.budgetMs > MAX_HARD_CEILING_MS) {
      throw new Error(`CRITICAL SECURITY FAILURE: Hard 5-minute ceiling breached! Got: ${res.budgetMs}ms > ${MAX_HARD_CEILING_MS}ms`);
    }
    if (res.budgetMs !== MAX_HARD_CEILING_MS) {
      throw new Error(`Expected clamped ceiling of ${MAX_HARD_CEILING_MS}ms, got ${res.budgetMs}ms`);
    }
  }
  console.log(`  ✓ Hard 5-minute (300s / 300,000ms) ceiling strictly enforced across all extreme combinations`);

  // 6. Floor Enforcement (30s)
  const floorTest = calculateJobTimeBudget({ prompt: "" });
  if (floorTest.budgetMs < MIN_TIME_BUDGET_MS) {
    throw new Error(`Floor breached! Got ${floorTest.budgetMs}ms < ${MIN_TIME_BUDGET_MS}ms`);
  }
  console.log(`  ✓ Minimum floor (30s / 30,000ms) strictly preserved`);

  console.log("✓ [UNIT] Fast-Calculated Time Budget Tests Passed!");
}

if (require.main === module) {
  runTimeBudgetUnitTests().catch((err) => {
    console.error("Time budget unit test failed:", err);
    process.exit(1);
  });
}
