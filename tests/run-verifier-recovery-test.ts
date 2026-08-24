import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { browserPool } from "@/worker/browser";
import { BrowserExecutor } from "@/worker/executor";
import { executeRecoveryLoop } from "@/worker/recovery";

async function runVerifierRecoveryTest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT RESULT VERIFIER & RECOVERY TEST   ");
  console.log("=================================================\n");

  const fixtureHtml = await fs.readFile(
    path.join(process.cwd(), "tests", "fixtures", "test-page.html"),
    "utf8"
  );

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fixtureHtml);
  });

  await new Promise<void>((resolve) => server.listen(3999, "127.0.0.1", resolve));
  const fixtureUrl = "http://127.0.0.1:3999";
  console.log(`[Test Server] Fixture available at ${fixtureUrl}\n`);

  try {
    // ----------------------------------------------------------------
    // SCENARIO 1: Unrecoverable Extraction Target (Attempts 1 -> 2 -> PARTIAL)
    // ----------------------------------------------------------------
    console.log("-------------------------------------------------");
    console.log("SCENARIO 1: Unrecoverable Extraction Target (Exhausts Max 2 Attempts -> PARTIAL)");
    console.log("-------------------------------------------------");

    const session1 = await browserPool.createSession({
      jobId: "test-job-recovery-partial-1",
      headless: true,
    });

    const navObs1 = await BrowserExecutor.execute(
      session1.page,
      {
        tool: "browser.navigate",
        parameters: { url: fixtureUrl, waitUntil: "domcontentloaded" },
      },
      { jobId: "test-job-recovery-partial-1", stepIndex: 1 }
    );

    const wrongExtractObs = await BrowserExecutor.execute(
      session1.page,
      {
        tool: "browser.extractText",
        parameters: { selector: "#completely-missing-crypto-wallet" },
      },
      { jobId: "test-job-recovery-partial-1", stepIndex: 2 }
    );

    console.log(`Initial Extraction Result: "${wrongExtractObs.pageSummary}"`);

    // Run Recovery Loop looking for cryptocurrency data that is not on the page
    const partialResult = await executeRecoveryLoop(session1.page, {
      jobId: "test-job-recovery-partial-1",
      goal: "Find Bitcoin price and Crypto Wallet balance",
      allowedDomains: ["127.0.0.1", "localhost"],
      initialObservations: [navObs1, wrongExtractObs],
      expectedFields: ["Bitcoin Price", "Crypto Wallet Balance"],
    });

    console.log("\n=================================================");
    console.log(`  RECOVERY EXECUTION RESULT: ${partialResult.verificationStatus}  `);
    console.log("=================================================");
    console.log(`Final Status: ${partialResult.verificationStatus}`);
    console.log(`Confidence Score: ${partialResult.confidence}`);
    console.log(`Total Recovery Attempts: ${partialResult.recoveryAttemptsCount} (Hard Cap: 2)`);
    console.log(`Missing Fields: ${partialResult.missingFields.join(", ")}`);
    console.log(`\nUser-Facing Summary:\n${partialResult.summary}\n`);

    console.log("--- RECOVERY AUDIT TRAIL TRACE (SCENARIO 1) ---");
    partialResult.recoveryAuditTrail.forEach((step) => {
      console.log(`\n[Attempt ${step.attemptNumber}/2]`);
      console.log(`  Trigger Reason: ${step.triggerReason}`);
      console.log(`  Recovery Action: ${step.recoveryAction.tool}`);
      console.log(`  Result Summary: ${step.observation.pageSummary}`);
    });

    // Assertions for Scenario 1
    if (partialResult.recoveryAttemptsCount !== 2) {
      throw new Error(`Expected exactly 2 recovery attempts, got ${partialResult.recoveryAttemptsCount}`);
    }
    if (partialResult.verificationStatus !== "PARTIAL") {
      throw new Error(`Expected final status PARTIAL, got ${partialResult.verificationStatus}`);
    }
    if (partialResult.recoveryAuditTrail.length !== 2) {
      throw new Error(`Expected audit trail length 2, got ${partialResult.recoveryAuditTrail.length}`);
    }

    console.log("\n✓ Scenario 1 PASS: Recovery loop executed exactly 2 bounded attempts and cleanly resolved to PARTIAL.\n");
    await session1.close();

    // ----------------------------------------------------------------
    // SCENARIO 2: Valid Extraction Target (Immediate VERIFIED with 0 Recovery Attempts)
    // ----------------------------------------------------------------
    console.log("-------------------------------------------------");
    console.log("SCENARIO 2: Valid Target (Immediate VERIFIED, 0 Recovery Attempts)");
    console.log("-------------------------------------------------");

    const session2 = await browserPool.createSession({
      jobId: "test-job-immediate-verified-2",
      headless: true,
    });

    const navObs2 = await BrowserExecutor.execute(
      session2.page,
      {
        tool: "browser.navigate",
        parameters: { url: fixtureUrl, waitUntil: "domcontentloaded" },
      },
      { jobId: "test-job-immediate-verified-2", stepIndex: 1 }
    );

    const goodExtractObs = await BrowserExecutor.execute(
      session2.page,
      {
        tool: "browser.extractText",
        parameters: { selector: "#pricing-table" },
      },
      { jobId: "test-job-immediate-verified-2", stepIndex: 2 }
    );

    const verifiedResult = await executeRecoveryLoop(session2.page, {
      jobId: "test-job-immediate-verified-2",
      goal: "Extract pricing matrix from #pricing-table",
      allowedDomains: ["127.0.0.1", "localhost"],
      initialObservations: [navObs2, goodExtractObs],
      expectedFields: ["Tier", "Monthly Price"],
    });

    console.log(`Verification Status: ${verifiedResult.verificationStatus}`);
    console.log(`Recovery Attempts: ${verifiedResult.recoveryAttemptsCount}`);
    console.log(`Satisfied Criteria: ${verifiedResult.satisfiedCriteria.join("; ")}`);

    if (verifiedResult.verificationStatus !== "VERIFIED") {
      throw new Error(`Expected status VERIFIED, got ${verifiedResult.verificationStatus}`);
    }
    if (verifiedResult.recoveryAttemptsCount !== 0) {
      throw new Error(`Expected 0 recovery attempts on successful extraction, got ${verifiedResult.recoveryAttemptsCount}`);
    }

    console.log("\n✓ Scenario 2 PASS: Correct target verified immediately with 0 recovery attempts.\n");
    await session2.close();

    console.log("=================================================");
    console.log("  ALL RESULT VERIFIER & RECOVERY TESTS PASSED!   ");
    console.log("=================================================\n");

  } finally {
    await browserPool.closeAll();
    server.close();
    console.log("[Teardown] Test server and browser pool closed cleanly.");
  }
}

runVerifierRecoveryTest().catch((err) => {
  console.error("FATAL VERIFIER/RECOVERY TEST ERROR:", err);
  process.exit(1);
});
