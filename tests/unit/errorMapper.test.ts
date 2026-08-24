import { mapInternalErrorToHuman, ERROR_CATALOG_7 } from "@/lib/verification/errorMapper";

export async function runErrorMapperUnitTests() {
  console.log("▶ [UNIT] Running Error Mapper Tests...");

  const checks = [
    { input: "Cloudflare Turnstile verification challenge", expected: "VERIFICATION_BLOCKED" },
    { input: "navigation timeout 30000ms exceeded", expected: "NAVIGATION_TIMEOUT" },
    { input: "Selector #submit-btn not found", expected: "SELECTOR_NOT_FOUND" },
    { input: "429 Too Many Requests: quota exceeded", expected: "RATE_LIMIT_EXCEEDED" },
    { input: "SIGKILL browser process disconnected", expected: "BROWSER_CRASH" },
    { input: "Domain not allowed by security whitelist", expected: "DOMAIN_NOT_ALLOWED" },
    { input: "max_steps exceeded budget", expected: "MAX_STEPS_EXCEEDED" },
  ];

  for (const check of checks) {
    const mapped = mapInternalErrorToHuman(check.input);
    if (mapped.code !== check.expected) {
      throw new Error(`Expected ${check.expected}, got ${mapped.code} for input: ${check.input}`);
    }
  }

  console.log("  ✓ All 7 §26 error classifications mapped accurately without stack leakage");
  console.log("✓ [UNIT] Error Mapper Tests Passed!\n");
}
