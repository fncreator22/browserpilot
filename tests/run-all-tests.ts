process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { browserPool } from "@/worker/browser";
import { runPlanValidatorTests } from "./unit/planValidator.test";
import { runCapabilityGuardTests } from "./unit/capabilityGuard.test";
import { runResultVerifierTests } from "./unit/resultVerifier.test";
import { runErrorMapperUnitTests } from "./unit/errorMapper.test";
import { runGeminiGuardTests } from "./unit/geminiGuard.test";
import { runAuthTests } from "./unit/auth.test";
import { runCleanupUnitTests } from "./unit/cleanup.test";
import { runExecutorIntegrationTests } from "./integration/executor.test";
import { runMultiUserIntegrationTests } from "./integration/multiUser.test";
import { runConcurrentUserIsolationTests } from "./integration/concurrentUserIsolation.test";
import { runWorkerConcurrencyLimitTest } from "./integration/workerConcurrencyLimit.test";
import { runEndToEndPipelineTest } from "./e2e/autonomousPipeline.test";

async function runMasterTestSuite() {
  console.log("=================================================");
  console.log("  BROWSERPILOT MASTER TEST SUITE & §36 VALIDATION");
  console.log("=================================================\n");

  const startTime = Date.now();
  const summary: Array<{ suite: string; status: "PASS" | "FAIL"; durationMs: number; error?: string }> = [];

  const suites = [
    { name: "Unit: Plan Validator", fn: runPlanValidatorTests },
    { name: "Unit: Capability Guard", fn: runCapabilityGuardTests },
    { name: "Unit: Result Verifier", fn: runResultVerifierTests },
    { name: "Unit: Error Mapper (§26)", fn: runErrorMapperUnitTests },
    { name: "Unit: Gemini Key Fallback Guard", fn: runGeminiGuardTests },
    { name: "Unit: Email/Password Auth & Minimal Schema", fn: runAuthTests },
    { name: "Unit: 24-Hour Auto-Purge & Retention", fn: runCleanupUnitTests },
    { name: "Integration: Playwright Executor & Fixture", fn: runExecutorIntegrationTests },
    { name: "Integration: Multi-User Isolation & Limits (§36 Test 6)", fn: runMultiUserIntegrationTests },
    { name: "Integration: Real Concurrent User Isolation (Prompt C1)", fn: runConcurrentUserIsolationTests },
    { name: "Integration: Worker Concurrency Limit & Throttling", fn: runWorkerConcurrencyLimitTest },
    { name: "E2E: Full Autonomous Agent Pipeline", fn: runEndToEndPipelineTest },
  ];

  for (const suite of suites) {
    const t0 = Date.now();
    try {
      await suite.fn();
      summary.push({ suite: suite.name, status: "PASS", durationMs: Date.now() - t0 });
    } catch (err: unknown) {
      summary.push({
        suite: suite.name,
        status: "FAIL",
        durationMs: Date.now() - t0,
        error: (err as Error).message,
      });
      console.error(`❌ Suite Failed: ${suite.name}\n`, err);
    }
  }

  await browserPool.closeAll();

  console.log("=================================================");
  console.log("  TEST EXECUTION SUMMARY MATRIX                  ");
  console.log("=================================================");
  summary.forEach((s) => {
    const icon = s.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} [${s.status}] ${s.suite.padEnd(52)} (${s.durationMs}ms)`);
    if (s.error) console.log(`   Error: ${s.error}`);
  });

  const totalElapsed = Date.now() - startTime;
  const allPassed = summary.every((s) => s.status === "PASS");

  console.log("=================================================");
  console.log(`Total Duration: ${totalElapsed}ms`);
  console.log(`Final Result: ${allPassed ? "ALL TEST SUITES GREEN! ✅" : "SOME SUITES FAILED ❌"}`);
  console.log("=================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runMasterTestSuite().catch((err) => {
  console.error("Fatal Test Suite Error:", err);
  process.exit(1);
});
