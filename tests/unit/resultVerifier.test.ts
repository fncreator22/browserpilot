import { ResultVerifier } from "@/lib/verification/resultVerifier";
import { type Observation } from "@/schemas/actions";

export async function runResultVerifierTests() {
  console.log("▶ [UNIT] Running Result Verifier Tests...");

  const baseNavObs: Observation = {
    stepIndex: 1,
    action: {
      tool: "browser.navigate",
      parameters: { url: "http://127.0.0.1:3999", waitUntil: "domcontentloaded", timeout: 15000 },
    },
    status: "SUCCESS",
    currentUrl: "http://127.0.0.1:3999",
    title: "Test Fixture",
    elapsedMs: 250,
    timestamp: new Date().toISOString(),
  };

  // 1. Successful extraction with expected fields -> VERIFIED
  const successfulExtractObs: Observation = {
    stepIndex: 2,
    action: {
      tool: "browser.extractText",
      parameters: { selector: "#pricing-table", extractMultiple: false, maxChars: 5000 },
    },
    status: "SUCCESS",
    currentUrl: "http://127.0.0.1:3999",
    title: "Test Fixture",
    extractedData: "Tier\tMonthly Price\nStarter\t$19\nPro\t$49",
    elapsedMs: 120,
    timestamp: new Date().toISOString(),
  };

  const verifiedResult = ResultVerifier.verify({
    goal: "Extract pricing tiers",
    observations: [baseNavObs, successfulExtractObs],
    currentRecoveryAttempt: 0,
    expectedFields: ["Starter", "Monthly Price"],
  });

  if (verifiedResult.status !== "VERIFIED") {
    throw new Error(`Expected status VERIFIED, got ${verifiedResult.status}`);
  }
  console.log("  ✓ Correctly verified successful payload with matching fields");

  // 2. Missing target fields on Attempt 0 -> RECOVER
  const emptyExtractObs: Observation = {
    stepIndex: 2,
    action: {
      tool: "browser.extractText",
      parameters: { selector: "#wrong-selector", extractMultiple: false, maxChars: 5000 },
    },
    status: "SUCCESS",
    currentUrl: "http://127.0.0.1:3999",
    title: "Test Fixture",
    extractedData: "",
    elapsedMs: 50,
    timestamp: new Date().toISOString(),
  };

  const recoverResult = ResultVerifier.verify({
    goal: "Extract pricing tiers",
    observations: [baseNavObs, emptyExtractObs],
    currentRecoveryAttempt: 0,
    expectedFields: ["Starter", "Monthly Price"],
  });

  if (recoverResult.status !== "RECOVER") {
    throw new Error(`Expected status RECOVER on missing data, got ${recoverResult.status}`);
  }
  console.log("  ✓ Triggered bounded RECOVER on missing target fields");

  // 3. Exhausted 2 Recovery Attempts -> PARTIAL
  const partialResult = ResultVerifier.verify({
    goal: "Extract pricing tiers",
    observations: [baseNavObs, emptyExtractObs],
    currentRecoveryAttempt: 2,
    expectedFields: ["Starter", "Monthly Price"],
  });

  if (partialResult.status !== "PARTIAL") {
    throw new Error(`Expected status PARTIAL on recovery exhaustion, got ${partialResult.status}`);
  }
  console.log("  ✓ Cleanly fell back to PARTIAL when max recovery attempts (2) were exhausted");

  console.log("✓ [UNIT] Result Verifier Tests Passed!\n");
}
