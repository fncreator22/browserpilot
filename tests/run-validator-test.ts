import { validateActionPlan } from "@/lib/verification/planValidator";
import { type ActionPlanInput } from "@/schemas/jobs";

const VALID_SAMPLE_PLAN: ActionPlanInput = {
  goal: "Extract top stories from Hacker News",
  targetDomains: ["news.ycombinator.com"],
  maxStepsBudget: 10,
  estimatedDurationSeconds: 8,
  steps: [
    {
      stepNumber: 1,
      rationale: "Navigate to Hacker News",
      isOptional: false,
      checkpointScreenshot: false,
      action: {
        tool: "browser.navigate",
        parameters: {
          url: "https://news.ycombinator.com",
          waitUntil: "domcontentloaded",
        },
      },
    },
    {
      stepNumber: 2,
      rationale: "Inspect story list table",
      isOptional: false,
      checkpointScreenshot: false,
      action: {
        tool: "browser.inspect",
        parameters: {
          selector: ".athing",
          depth: 2,
          maxElements: 10,
        },
      },
    },
    {
      stepNumber: 3,
      rationale: "Extract story title text",
      isOptional: false,
      checkpointScreenshot: false,
      action: {
        tool: "browser.extractText",
        parameters: {
          selector: ".athing",
          extractMultiple: true,
          maxChars: 1000,
        },
      },
    },
    {
      stepNumber: 4,
      rationale: "Capture final verification screenshot",
      isOptional: false,
      checkpointScreenshot: true,
      action: {
        tool: "browser.screenshot",
        parameters: {
          fullPage: false,
          filename: "hn_stories.png",
        },
      },
    },
  ],
};

const INVALID_TOOL_PLAN: unknown = {
  ...VALID_SAMPLE_PLAN,
  steps: [
    ...VALID_SAMPLE_PLAN.steps,
    {
      stepNumber: 5,
      rationale: "Execute arbitrary script on page",
      isOptional: false,
      checkpointScreenshot: false,
      action: {
        tool: "browser.eval",
        parameters: {
          code: "window.__secret_leak()",
        },
      },
    },
  ],
};

const STEP_LIMIT_EXCEEDED_PLAN: ActionPlanInput = {
  ...VALID_SAMPLE_PLAN,
  steps: Array.from({ length: 18 }).map((_, i) => ({
    stepNumber: i + 1,
    rationale: `Step ${i + 1} action`,
    isOptional: false,
    checkpointScreenshot: false,
    action: {
      tool: "browser.getState",
      parameters: {},
    },
  })),
};

const DISALLOWED_DOMAIN_PLAN: ActionPlanInput = {
  ...VALID_SAMPLE_PLAN,
  steps: [
    {
      stepNumber: 1,
      rationale: "Navigate to unauthorized external origin",
      isOptional: false,
      checkpointScreenshot: false,
      action: {
        tool: "browser.navigate",
        parameters: {
          url: "https://unauthorized-phishing-site.com/login",
          waitUntil: "domcontentloaded",
        },
      },
    },
  ],
};

const DANGEROUS_PROTOCOL_PLAN: ActionPlanInput = {
  ...VALID_SAMPLE_PLAN,
  steps: [
    {
      stepNumber: 1,
      rationale: "Attempt file protocol read",
      isOptional: false,
      checkpointScreenshot: false,
      action: {
        tool: "browser.navigate",
        parameters: {
          url: "file:///etc/passwd",
          waitUntil: "domcontentloaded",
        },
      },
    },
  ],
};

const DANGEROUS_SELECTOR_PLAN: ActionPlanInput = {
  ...VALID_SAMPLE_PLAN,
  steps: [
    {
      stepNumber: 1,
      rationale: "Click element with XSS script injection selector",
      isOptional: false,
      checkpointScreenshot: false,
      action: {
        tool: "browser.click",
        parameters: {
          selector: "<script>alert('pwned')</script>",
          button: "left",
        },
      },
    },
  ],
};

async function runPlanValidatorTest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT PRE-EXECUTION PLAN VALIDATOR TEST ");
  console.log("=================================================\n");

  const testCases = [
    {
      name: "Case 1: Standard Conforming ActionPlan",
      plan: VALID_SAMPLE_PLAN,
      options: { allowedDomains: ["news.ycombinator.com"], maxStepsBudget: 10 },
      expectedValid: true,
      expectedCode: null,
    },
    {
      name: "Case 2: Disallowed Tool Action (browser.eval)",
      plan: INVALID_TOOL_PLAN,
      options: { allowedDomains: ["news.ycombinator.com"], maxStepsBudget: 10 },
      expectedValid: false,
      expectedCode: "INVALID_ACTION_TYPE",
    },
    {
      name: "Case 3: Step Count Limit Exceeded (18 steps > 10 budget)",
      plan: STEP_LIMIT_EXCEEDED_PLAN,
      options: { allowedDomains: ["news.ycombinator.com"], maxStepsBudget: 10 },
      expectedValid: false,
      expectedCode: "MAX_STEPS_EXCEEDED",
    },
    {
      name: "Case 4: Disallowed Domain Navigation",
      plan: DISALLOWED_DOMAIN_PLAN,
      options: {
        allowedDomains: ["news.ycombinator.com"],
        customDomainConfig: {
          allowedDomains: ["news.ycombinator.com"],
          allowWildcard: false,
          allowLocalhost: false,
          blockedProtocols: ["file:", "javascript:"],
          blockedIpRanges: [],
        },
      },
      expectedValid: false,
      expectedCode: "DISALLOWED_DOMAIN",
    },
    {
      name: "Case 5: Blocked Local File Protocol (file:///)",
      plan: DANGEROUS_PROTOCOL_PLAN,
      options: { allowedDomains: ["*"] },
      expectedValid: false,
      expectedCode: "DISALLOWED_DOMAIN",
    },
    {
      name: "Case 6: Unsafe Script Tag in Selector",
      plan: DANGEROUS_SELECTOR_PLAN,
      options: { allowedDomains: ["*"] },
      expectedValid: false,
      expectedCode: "INVALID_SELECTOR",
    },
  ];

  let allPassed = true;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`--- [Test ${i + 1}/${testCases.length}] ${tc.name} ---`);

    const result = validateActionPlan(tc.plan, tc.options);

    console.log(`-> Valid: ${result.valid} (Expected: ${tc.expectedValid})`);
    console.log(`-> Summary: ${result.summary}`);
    if (result.reasons.length > 0) {
      result.reasons.forEach((r) => {
        console.log(`   [Violation: ${r.code}] Step ${r.stepNumber || 0}: ${r.message} (${r.detail})`);
      });
    }

    const matchesValidity = result.valid === tc.expectedValid;
    const matchesCode =
      tc.expectedCode === null || result.reasons.some((r) => r.code === tc.expectedCode);

    const passed = matchesValidity && matchesCode;
    console.log(`-> Status: ${passed ? "✓ PASS" : "❌ FAIL"}\n`);

    if (!passed) {
      allPassed = false;
    }
  }

  console.log("=================================================");
  console.log("  VALIDATOR REJECTION CODES CATALOG              ");
  console.log("=================================================");
  console.log(`
1. SCHEMA_VALIDATION_ERROR : Fails structural Zod ActionPlan parsing
2. EMPTY_PLAN              : ActionPlan contains 0 steps
3. MAX_STEPS_EXCEEDED      : Step count exceeds configured budget (default 15, hard cap 25)
4. INVALID_ACTION_TYPE     : Tool is not one of the 8 authorized v1 tools
5. INVALID_ACTION_PARAMS   : Action parameters fail tool-specific Zod schema validation
6. DISALLOWED_DOMAIN       : Navigation URL is outside allowed domain whitelist
7. DISALLOWED_PROTOCOL     : Navigation URL uses blocked protocol (file:, javascript:, data:)
8. INVALID_SELECTOR        : Selector contains script injection, javascript:, or empty string
9. UNSUPPORTED_CAPABILITY  : Action cannot be fulfilled by any supported capability
`);
  console.log("=================================================\n");

  if (!allPassed) {
    throw new Error("One or more Plan Validator test cases failed!");
  }

  console.log("✅ All Plan Validator pre-execution checks passed successfully!\n");
}

runPlanValidatorTest().catch((err) => {
  console.error("FATAL VALIDATOR TEST ERROR:", err);
  process.exit(1);
});
