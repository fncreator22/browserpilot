import { 
  ERROR_CATALOG_7, 
  mapInternalErrorToHuman, 
  type HumanReadableError 
} from "@/lib/verification/errorMapper";

async function runErrorMapperTestSuite() {
  console.log("=================================================");
  console.log("  BROWSERPILOT §26 ERROR MAPPING TEST SUITE      ");
  console.log("=================================================\n");

  const testCases = [
    {
      name: "1. Cloudflare Turnstile / CAPTCHA Verification Wall",
      rawInput: {
        code: "VERIFICATION_REQUIRED",
        message: "Target presented Cloudflare Turnstile iframe challenge.",
        stack: "Error: Turnstile detected at PlaywrightExecutor.step()",
      },
      expectedCode: "VERIFICATION_BLOCKED",
    },
    {
      name: "2. Page Navigation Timeout",
      rawInput: new Error("Navigation timeout of 30000ms exceeded waiting for domcontentloaded"),
      expectedCode: "NAVIGATION_TIMEOUT",
    },
    {
      name: "3. Missing DOM Element Selector",
      rawInput: {
        error: "Selector #nonexistent-btn not found on page within 5000ms",
      },
      expectedCode: "SELECTOR_NOT_FOUND",
    },
    {
      name: "4. Gemini API 429 Rate Limit",
      rawInput: "429 Too Many Requests: Resource has been exhausted (e.g. check quota)",
      expectedCode: "RATE_LIMIT_EXCEEDED",
    },
    {
      name: "5. Playwright Chromium Crash / OOM",
      rawInput: {
        code: "SIGKILL",
        message: "Target closed. Browser process crashed unexpectedly.",
      },
      expectedCode: "BROWSER_CRASH",
    },
    {
      name: "6. Domain Whitelist Violation",
      rawInput: {
        code: "POLICY_VIOLATION",
        message: "Blocked navigation to https://malicious-redirect.com. Domain not allowed.",
      },
      expectedCode: "DOMAIN_NOT_ALLOWED",
    },
    {
      name: "7. Step Budget Exceeded",
      rawInput: {
        code: "MAX_STEPS_EXCEEDED",
        message: "Execution exceeded max_steps limit (25/25 actions).",
      },
      expectedCode: "MAX_STEPS_EXCEEDED",
    },
  ];

  console.log("Testing mapping for all 7 §26 error classifications:\n");

  for (const tc of testCases) {
    console.log(`-------------------------------------------------`);
    console.log(`[TEST CASE] ${tc.name}`);
    console.log(`Raw Input:`, typeof tc.rawInput === "string" ? tc.rawInput : JSON.stringify(tc.rawInput));

    const mapped: HumanReadableError = mapInternalErrorToHuman(tc.rawInput);

    console.log(`Mapped Code: ${mapped.code} (Category: ${mapped.category})`);
    console.log(`Title: "${mapped.title}"`);
    console.log(`User Message: "${mapped.userMessage}"`);
    console.log(`Diagnostic: "${mapped.technicalDetail}"`);
    console.log(`Action: "${mapped.suggestedAction}"`);
    console.log(`Recoverable: ${mapped.recoverable}`);

    // Assertions
    if (mapped.code !== tc.expectedCode) {
      throw new Error(`Expected code "${tc.expectedCode}", got "${mapped.code}"`);
    }

    // Ensure no raw stack trace or raw JSON leaked into userMessage or title
    if (mapped.userMessage.includes("Error:") || mapped.userMessage.includes("at PlaywrightExecutor")) {
      throw new Error(`Raw stack trace leaked into userMessage: ${mapped.userMessage}`);
    }

    console.log(`✓ PASS: Cleanly mapped to human-readable message.\n`);
  }

  // Also verify that all 7 catalog entries exist
  const catalogKeys = Object.keys(ERROR_CATALOG_7);
  if (catalogKeys.length !== 7) {
    throw new Error(`Expected 7 error entries in ERROR_CATALOG_7, got ${catalogKeys.length}`);
  }

  console.log("=================================================");
  console.log("  ALL 7 §26 ERROR MAPPINGS VERIFIED SUCCESSFULLY ");
  console.log("=================================================\n");
}

runErrorMapperTestSuite().catch((err) => {
  console.error("FATAL ERROR MAPPER TEST FAILURE:", err);
  process.exit(1);
});
