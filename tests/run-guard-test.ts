import { validateCapabilityPreflight } from "@/lib/capabilities/guard";
import { CAPABILITY_REGISTRY } from "@/lib/capabilities/registry";
import { type IntentClassification } from "@/schemas/jobs";

const TEST_CASES = [
  {
    name: "Test Case 1: Unauthenticated Private Account Login",
    prompt: "log into my Instagram account and send a direct message to jane_doe",
    intent: {
      classification: "REQUIRES_AUTH" as const,
      confidence: 1.0,
      rationale: "Goal requires user authentication to access a private social media profile.",
      targetDomains: ["instagram.com"],
      requiredCapabilities: ["CAP_PRIVATE_AUTH_LOGIN"],
    },
    expectedAllowed: false,
    expectedClassification: "REQUIRES_AUTH",
    expectedBlockedCap: "CAP_PRIVATE_AUTH_LOGIN",
  },
  {
    name: "Test Case 2: Anti-Bot / CAPTCHA Circumvention",
    prompt: "bypass the Cloudflare turnstile on protected-site.com and scrape 50000 records",
    intent: {
      classification: "BLOCKED" as const,
      confidence: 1.0,
      rationale: "Goal requests automated bypass of Cloudflare turnstile challenge.",
      targetDomains: ["protected-site.com"],
      requiredCapabilities: ["CAP_CAPTCHA_BYPASS"],
    },
    expectedAllowed: false,
    expectedClassification: "BLOCKED",
    expectedBlockedCap: "CAP_CAPTCHA_BYPASS",
  },
  {
    name: "Test Case 3: Arbitrary Host Filesystem Download",
    prompt: "download 500GB video files directly to my host hard drive at C:\\videos",
    intent: {
      classification: "UNSUPPORTED" as const,
      confidence: 1.0,
      rationale: "Goal requires arbitrary host filesystem access and media streaming.",
      targetDomains: [],
      requiredCapabilities: ["CAP_HOST_FS_IO"],
    },
    expectedAllowed: false,
    expectedClassification: "UNSUPPORTED",
    expectedBlockedCap: "CAP_HOST_FS_IO",
  },
  {
    name: "Test Case 4: Supported Web Browsing & Extraction",
    prompt: "Navigate to news.ycombinator.com, find top 3 AI stories, and extract their titles into a table",
    intent: {
      classification: "SUPPORTED" as const,
      confidence: 0.99,
      rationale: "Deterministic web navigation and table content extraction on a public domain.",
      targetDomains: ["news.ycombinator.com"],
      requiredCapabilities: ["CAP_MULTI_STEP_NAV", "CAP_DATA_EXTRACTION"],
    },
    expectedAllowed: true,
    expectedClassification: "SUPPORTED",
    expectedBlockedCap: null,
  },
];

async function runCapabilityGuardTest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT PRE-FLIGHT CAPABILITY GUARD TEST  ");
  console.log("=================================================\n");

  let allPassed = true;

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`--- [Test ${i + 1}/${TEST_CASES.length}] ${tc.name} ---`);
    console.log(`Prompt: "${tc.prompt}"`);

    // Run Pre-flight Capability Guard
    const guardResult = validateCapabilityPreflight(tc.intent, tc.prompt);

    console.log(`-> Guard Allowed: ${guardResult.allowed} (Expected: ${tc.expectedAllowed})`);
    console.log(`-> Classification: ${guardResult.classification}`);
    console.log(`-> User Message: ${guardResult.userMessage}`);
    if (guardResult.errorCode) {
      console.log(`-> Error Code: ${guardResult.errorCode}`);
    }
    if (guardResult.matchedCapabilities.length) {
      console.log(`-> Matched Capabilities: ${guardResult.matchedCapabilities.join(", ")}`);
    }
    if (guardResult.blockedCapabilities.length) {
      console.log(`-> Blocked Capabilities: ${guardResult.blockedCapabilities.join(", ")}`);
    }

    const passed =
      guardResult.allowed === tc.expectedAllowed &&
      guardResult.classification === tc.expectedClassification;

    console.log(`-> Status: ${passed ? "✓ PASS" : "❌ FAIL"}\n`);
    if (!passed) allPassed = false;
  }

  // Print Decision Table
  console.log("=================================================");
  console.log("  CAPABILITY GUARD DECISION MATRIX TABLE         ");
  console.log("=================================================");
  console.log("| Capability ID | Name | Category | Status |");
  console.log("| :--- | :--- | :--- | :--- |");
  Object.values(CAPABILITY_REGISTRY).forEach((cap) => {
    console.log(`| ${cap.id} | ${cap.name} | ${cap.category} | **${cap.status}** |`);
  });
  console.log("=================================================\n");

  if (!allPassed) {
    throw new Error("One or more Capability Guard test cases failed!");
  }

  console.log("✅ All Capability Guard pre-flight checks passed successfully!\n");
}

runCapabilityGuardTest().catch((err) => {
  console.error("FATAL GUARD TEST ERROR:", err);
  process.exit(1);
});
