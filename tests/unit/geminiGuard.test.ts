import { 
  validateGeminiCredentialsOnStartup, 
  classifyIntent 
} from "@/lib/ai/intent";
import { generateActionPlan } from "@/lib/ai/planner";
import { mapInternalErrorToHuman } from "@/lib/verification/errorMapper";

export async function runGeminiGuardTests() {
  console.log("▶ [UNIT] Running Gemini API Key Fallback Guard Tests (Fix Prompt A1)...");

  const env = process.env as Record<string, string | undefined>;

  // Test 1: In test mode, fallback is allowed
  process.env.IS_TEST_HARNESS = "true";
  env.NODE_ENV = "test";
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";

  const testModeCheck = validateGeminiCredentialsOnStartup();
  if (!testModeCheck.valid) {
    throw new Error("Expected validateGeminiCredentialsOnStartup to return valid: true in test harness mode");
  }

  const fallbackIntent = await classifyIntent("Navigate to http://127.0.0.1:3997 and extract pricing");
  if (fallbackIntent.classification !== "SUPPORTED") {
    throw new Error("Expected test fallback intent classification to work in test mode");
  }
  console.log("  ✓ Test fallback allowed strictly inside test harness mode");

  // Test 2: In production with missing key, fails fast and throws MISSING_GEMINI_API_KEY
  process.env.IS_TEST_HARNESS = "false";
  env.NODE_ENV = "production";
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  const prodCheck = validateGeminiCredentialsOnStartup();
  if (prodCheck.valid || prodCheck.error !== "MISSING_GEMINI_API_KEY") {
    throw new Error("Expected validateGeminiCredentialsOnStartup to fail fast with MISSING_GEMINI_API_KEY in production");
  }
  console.log("  ✓ validateGeminiCredentialsOnStartup rejected missing key in production");

  let threwInProd = false;
  let thrownError: unknown = null;
  try {
    await classifyIntent("Navigate to https://example.com");
  } catch (err: unknown) {
    threwInProd = true;
    thrownError = err;
  }

  if (!threwInProd) {
    throw new Error("Expected classifyIntent to throw error in production when GEMINI_API_KEY is missing");
  }

  const mapped = mapInternalErrorToHuman(thrownError);
  if (!mapped || mapped.category !== "AI") {
    throw new Error(`Expected mapped error category to be 'AI', got ${mapped.category}`);
  }
  if (mapped.userMessage.includes("GEMINI_API_KEY") || mapped.userMessage.includes("process.env")) {
    throw new Error("Raw environment variable name leaked in userMessage!");
  }
  console.log(`  ✓ Threw MISSING_GEMINI_API_KEY in production & mapped cleanly to: "${mapped.userMessage}"`);

  // Test 3: Plan generator also throws in production when key is missing
  let planThrewInProd = false;
  try {
    await generateActionPlan("Navigate to https://example.com");
  } catch {
    planThrewInProd = true;
  }

  if (!planThrewInProd) {
    throw new Error("Expected generateActionPlan to throw error in production when GEMINI_API_KEY is missing");
  }
  console.log("  ✓ generateActionPlan threw in production when key is missing");

  // Restore test harness state
  process.env.IS_TEST_HARNESS = "true";
  env.NODE_ENV = "test";
  if (originalKey) {
    process.env.GEMINI_API_KEY = originalKey;
  }

  console.log("✓ [UNIT] Gemini API Key Fallback Guard Tests Passed!\n");
}
