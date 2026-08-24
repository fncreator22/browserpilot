import { validateActionPlan } from "@/lib/verification/planValidator";
import { type ActionPlan } from "@/schemas/jobs";

export async function runPlanValidatorTests() {
  console.log("▶ [UNIT] Running Plan Validator Tests...");

  // 1. Valid Action Plan passes validation
  const validPlan: ActionPlan = {
    goal: "Extract pricing table from local test page",
    targetDomains: ["127.0.0.1"],
    maxStepsBudget: 15,
    estimatedDurationSeconds: 10,
    steps: [
      {
        stepNumber: 1,
        action: {
          tool: "browser.navigate",
          parameters: { url: "http://127.0.0.1:3999", waitUntil: "domcontentloaded", timeout: 15000 },
          rationale: "Navigate to target fixture",
        },
        rationale: "Open fixture page",
        isOptional: false,
        checkpointScreenshot: false,
      },
      {
        stepNumber: 2,
        action: {
          tool: "browser.extractText",
          parameters: { selector: "#pricing-table", extractMultiple: false, maxChars: 5000 },
          rationale: "Extract pricing matrix",
        },
        rationale: "Extract target data",
        isOptional: false,
        checkpointScreenshot: true,
      },
    ],
  };

  const validResult = validateActionPlan(validPlan, {
    allowedDomains: ["127.0.0.1", "localhost"],
    maxStepsBudget: 15,
  });

  if (!validResult.valid) {
    throw new Error(`Expected valid plan to pass, got errors: ${validResult.reasons.map((r) => r.message).join(", ")}`);
  }
  console.log("  ✓ Valid plan successfully passed Plan Validator");

  // 2. Disallowed Protocol (file://) rejected
  const maliciousProtocolPlan: ActionPlan = {
    goal: "Read local shadow file",
    targetDomains: ["localhost"],
    maxStepsBudget: 15,
    estimatedDurationSeconds: 10,
    steps: [
      {
        stepNumber: 1,
        action: {
          tool: "browser.navigate",
          parameters: { url: "file:///etc/shadow", waitUntil: "domcontentloaded", timeout: 15000 },
        },
        rationale: "Attempt file protocol",
        isOptional: false,
        checkpointScreenshot: false,
      },
    ],
  };

  const protocolResult = validateActionPlan(maliciousProtocolPlan, {
    allowedDomains: ["*"],
  });

  if (protocolResult.valid) {
    throw new Error("Expected file:// protocol to be rejected by Plan Validator!");
  }
  console.log("  ✓ Blocked dangerous file:// protocol");

  // 3. Exceeded max steps budget rejected
  const oversizedPlan: ActionPlan = {
    goal: "Loop infinite steps",
    targetDomains: ["localhost"],
    maxStepsBudget: 15,
    estimatedDurationSeconds: 10,
    steps: Array.from({ length: 30 }, (_, i) => ({
      stepNumber: i + 1,
      action: {
        tool: "browser.extractText",
        parameters: { selector: `div.item-${i}`, extractMultiple: false, maxChars: 5000 },
      },
      rationale: `Step ${i + 1}`,
      isOptional: false,
      checkpointScreenshot: false,
    })),
  };

  const oversizedResult = validateActionPlan(oversizedPlan, {
    maxStepsBudget: 15,
  });

  if (oversizedResult.valid) {
    throw new Error("Expected oversized plan (>15 steps) to be rejected!");
  }
  console.log("  ✓ Blocked oversized plan exceeding max step budget");

  // 4. Domain Whitelist rejection
  const outOfWhitelistPlan: ActionPlan = {
    goal: "Navigate unauthorized origin",
    targetDomains: ["unauthorized-domain.com"],
    maxStepsBudget: 15,
    estimatedDurationSeconds: 10,
    steps: [
      {
        stepNumber: 1,
        action: {
          tool: "browser.navigate",
          parameters: { url: "https://unauthorized-domain.com", waitUntil: "domcontentloaded", timeout: 15000 },
        },
        rationale: "Navigate outside whitelist",
        isOptional: false,
        checkpointScreenshot: false,
      },
    ],
  };

  const whitelistResult = validateActionPlan(outOfWhitelistPlan, {
    allowedDomains: ["news.ycombinator.com", "github.com"],
  });

  if (whitelistResult.valid) {
    throw new Error("Expected out-of-whitelist domain to be rejected!");
  }
  console.log("  ✓ Blocked domain outside configured whitelist");

  console.log("✓ [UNIT] Plan Validator Tests Passed!\n");
}
