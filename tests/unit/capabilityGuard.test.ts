import { validateCapabilityPreflight } from "@/lib/capabilities/guard";
import { type IntentClassification } from "@/schemas/jobs";

export async function runCapabilityGuardTests() {
  console.log("▶ [UNIT] Running Capability Guard Tests...");

  // 1. Supported Capability is Allowed
  const supportedIntent: IntentClassification = {
    classification: "SUPPORTED",
    confidence: 0.95,
    rationale: "Extract public documentation table",
    targetDomains: ["docs.github.com"],
    requiredCapabilities: ["CAP_MULTI_STEP_NAV", "CAP_DATA_EXTRACTION"],
  };

  const supportedGuard = validateCapabilityPreflight(supportedIntent, "Extract public documentation table from docs.github.com");
  if (!supportedGuard.allowed) {
    throw new Error("Expected SUPPORTED intent to be allowed by Capability Guard!");
  }
  console.log("  ✓ Allowed standard SUPPORTED capability");

  // 2. Authentication Request is Blocked Pre-Flight
  const authIntent: IntentClassification = {
    classification: "REQUIRES_AUTH",
    confidence: 0.98,
    rationale: "Log into Instagram private account",
    targetDomains: ["instagram.com"],
    requiredCapabilities: ["CAP_PRIVATE_AUTH_LOGIN"],
  };

  const authGuard = validateCapabilityPreflight(authIntent, "Log into my Instagram account");
  if (authGuard.allowed || authGuard.classification !== "REQUIRES_AUTH") {
    throw new Error("Expected REQUIRES_AUTH intent to be blocked pre-flight!");
  }
  console.log("  ✓ Blocked REQUIRES_AUTH capability pre-flight with human message");

  // 3. Blocked / Unsupported Capability
  const blockedIntent: IntentClassification = {
    classification: "BLOCKED",
    confidence: 0.99,
    rationale: "Bypass Cloudflare CAPTCHA challenge",
    targetDomains: ["cloudflare.com"],
    requiredCapabilities: ["CAP_CAPTCHA_BYPASS"],
  };

  const blockedGuard = validateCapabilityPreflight(blockedIntent, "Bypass captcha challenge");
  if (blockedGuard.allowed || blockedGuard.classification !== "BLOCKED") {
    throw new Error("Expected BLOCKED capability to be halted pre-flight!");
  }
  console.log("  ✓ Blocked anti-bot / CAPTCHA bypass pre-flight");

  console.log("✓ [UNIT] Capability Guard Tests Passed!\n");
}
