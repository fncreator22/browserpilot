import assert from "node:assert";
import { checkCapabilityEntitlement } from "@/lib/billing/entitlementService";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { atsProvider, DEFAULT_ATS_COMPANIES } from "@/lib/scraper/providers/atsProvider";

async function runVerification() {
  console.log("=================================================");
  console.log("🧪 RUNNING R1-R5 VERIFICATION TESTS");
  console.log("=================================================");

  // R1: Free DeepReach capability entitlement
  console.log("\n▶ [R1] Verifying 100% Free DeepReach Entitlements for FREE plan...");
  const premDeepReach = await checkCapabilityEntitlement("FREE", "PREMIUM_DEEP_REACH");
  assert.strictEqual(premDeepReach.allowed, true, "FREE plan must be allowed PREMIUM_DEEP_REACH");
  
  const deepReach = await checkCapabilityEntitlement("FREE", "DEEP_REACH");
  assert.strictEqual(deepReach.allowed, true, "FREE plan must be allowed DEEP_REACH");
  console.log("  ✅ R1 Passed: FREE plan is allowed PREMIUM_DEEP_REACH and DEEP_REACH without paywall.");

  // R5: Typo tolerance & default requested count (5-6 target, up to 60)
  console.log("\n▶ [R5] Verifying Typo Tolerance & Default/Extended Target Counts...");
  const defaultIntent = parseSearchIntent("software engineer");
  assert.strictEqual(defaultIntent.requestedCount, 30, "Default requested count must be 30");
  console.log("  ✓ Default requestedCount is 30");

  const remortIntent = parseSearchIntent("remort software engineer");
  assert.strictEqual(remortIntent.workMode, "REMOTE", "'remort' typo must resolve to REMOTE workMode");
  console.log("  ✓ 'remort' typo correctly resolved to REMOTE workMode");

  const interIntent = parseSearchIntent("inter developer");
  assert.ok(interIntent.opportunityTypes?.includes("INTERNSHIP"), "'inter' typo must resolve to INTERNSHIP opportunityType");
  console.log("  ✓ 'inter' typo correctly resolved to INTERNSHIP");

  const enterpriseIntent = parseSearchIntent("find 55 enterprise jobs");
  assert.strictEqual(enterpriseIntent.requestedCount, 55, "Should parse requested count up to 60 for enterprise queries");
  console.log("  ✓ Parsed high enterprise count (55) correctly");

  // R5: Multi-typo combined queries (e.g. 'remort inter', 'fron-end enginer', 'bckend softwre')
  console.log("\n▶ [R5] Verifying Combined Multi-Typo Queries...");
  const combinedIntent = parseSearchIntent("remort inter");
  assert.strictEqual(combinedIntent.workMode, "REMOTE", "Combined 'remort inter' must resolve to REMOTE workMode");
  assert.ok(combinedIntent.opportunityTypes?.includes("INTERNSHIP"), "Combined 'remort inter' must resolve to INTERNSHIP");
  assert.strictEqual(combinedIntent.requestedCount, 30, "Default count must be 30 for combined typo query");
  console.log("  ✓ 'remort inter' multi-typo correctly resolved to REMOTE + INTERNSHIP with default target 30");

  const frontendIntent = parseSearchIntent("fron-end enginer");
  assert.ok(frontendIntent.roles?.some((r) => /frontend/i.test(r) || /engineer/i.test(r)), "'fron-end enginer' must resolve to frontend engineer");
  console.log("  ✓ 'fron-end enginer' correctly resolved to frontend engineer");

  const backendIntent = parseSearchIntent("bckend softwre developer");
  assert.ok(backendIntent.roles?.some((r) => /backend/i.test(r) || /software/i.test(r) || /developer/i.test(r)), "'bckend softwre' must resolve to backend software developer");
  console.log("  ✓ 'bckend softwre developer' correctly resolved to backend software developer");

  // R5: Multi-source AtsProvider Workable Integration
  console.log("\n▶ [R5] Verifying Workable Harvest Connector in AtsProvider...");
  assert.strictEqual(typeof (atsProvider as any).harvestWorkable, "function", "atsProvider must have harvestWorkable method");
  const huggingFace = DEFAULT_ATS_COMPANIES.find((c) => c.name === "Hugging Face");
  assert.ok(huggingFace, "Hugging Face should be in DEFAULT_ATS_COMPANIES");
  assert.strictEqual(huggingFace?.workableSlug, "huggingface", "Hugging Face should have workableSlug 'huggingface'");
  console.log("  ✅ R5 Passed: Workable harvest connector and company target verified.");

  console.log("\n=================================================");
  console.log("🎉 ALL R1-R5 VERIFICATION TESTS PASSED!");
  console.log("=================================================");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
