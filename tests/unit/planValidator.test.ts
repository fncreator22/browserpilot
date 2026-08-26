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
    allowedDomains: ["allowed-domain.com"],
  });

  if (whitelistResult.valid) {
    throw new Error("Expected out-of-whitelist domain to be rejected by Plan Validator!");
  }
  if (!whitelistResult.reasons.some((r) => r.code === "DISALLOWED_DOMAIN")) {
    throw new Error("Expected DISALLOWED_DOMAIN rejection code for out-of-whitelist plan!");
  }
  console.log("  ✓ Blocked unauthorized domain outside whitelist");

  // 5. Unsafe selector script injection rejection
  const unsafeSelectorPlan = {
    goal: "Click script tag",
    targetDomains: ["localhost"],
    maxStepsBudget: 15,
    estimatedDurationSeconds: 10,
    steps: [
      {
        stepNumber: 1,
        action: {
          tool: "browser.click",
          parameters: { selector: "<script>alert(1)</script>", clickCount: 1, timeout: 5000 },
        },
        rationale: "Unsafe selector test",
        isOptional: false,
        checkpointScreenshot: false,
      },
    ],
  };

  const unsafeSelectorResult = validateActionPlan(unsafeSelectorPlan, {
    allowedDomains: ["localhost"],
  });

  if (unsafeSelectorResult.valid || !unsafeSelectorResult.reasons.some((r) => r.code === "INVALID_SELECTOR")) {
    throw new Error("Expected INVALID_SELECTOR rejection for script injection selector!");
  }
  console.log("  ✓ Blocked unsafe selector with script injection");

  // 6. Empty plan validation
  const emptyPlan = {
    goal: "Empty goal",
    targetDomains: ["localhost"],
    maxStepsBudget: 15,
    estimatedDurationSeconds: 10,
    steps: [],
  };

  const emptyResult = validateActionPlan(emptyPlan, {
    allowedDomains: ["localhost"],
  });

  if (emptyResult.valid || !emptyResult.reasons.some((r) => r.code === "EMPTY_PLAN" || r.code === "SCHEMA_VALIDATION_ERROR")) {
    throw new Error("Expected empty plan to be rejected!");
  }
  console.log("  ✓ Blocked empty action plan with 0 steps");

  // 7. parseAllowedDomains normalization & deduplication
  const { parseAllowedDomains } = await import("@/schemas/jobs");
  const parsed1 = parseAllowedDomains(null);
  const parsed2 = parseAllowedDomains("");
  const parsed3 = parseAllowedDomains("[]");
  const parsed4 = parseAllowedDomains('["news.ycombinator.com", "GITHUB.COM "]');
  const parsed5 = parseAllowedDomains("  news.ycombinator.com , github.com, news.ycombinator.com ");
  const parsed6 = parseAllowedDomains(["EXAMPLE.COM", "example.com", "  foo.bar  "]);

  if (parsed1.length !== 0 || parsed2.length !== 0 || parsed3.length !== 0) {
    throw new Error("parseAllowedDomains failed empty input parsing");
  }
  if (parsed4.length !== 2 || parsed4[0] !== "news.ycombinator.com" || parsed4[1] !== "github.com") {
    throw new Error(`parseAllowedDomains failed JSON string parsing: ${JSON.stringify(parsed4)}`);
  }
  if (parsed5.length !== 2 || parsed5[0] !== "news.ycombinator.com" || parsed5[1] !== "github.com") {
    throw new Error(`parseAllowedDomains failed comma-delimited parsing: ${JSON.stringify(parsed5)}`);
  }
  if (parsed6.length !== 2 || parsed6[0] !== "example.com" || parsed6[1] !== "foo.bar") {
    throw new Error(`parseAllowedDomains failed array deduplication/normalization: ${JSON.stringify(parsed6)}`);
  }
  console.log("  ✓ Validated parseAllowedDomains helper with diverse input formats");

  console.log("✓ [UNIT] Plan Validator Tests Passed!\n");
}
