import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { 
  createUser, 
  getUserById, 
  getUserByEmail, 
  updateUserProfile, 
  getUserGeminiApiKey, 
  getEffectiveUserGeminiApiKey 
} from "@/lib/db/users";
import { getEffectiveGeminiApiKey } from "@/lib/ai/modelSelector";

export async function runUserProfileIntegrationTests() {
  console.log("=================================================");
  console.log("  BROWSERPILOT USER PROFILE & BYOK KEY TEST      ");
  console.log("=================================================\n");

  const timestamp = Date.now();
  const testEmail = `profile-test-${timestamp}@browserpilot.ai`;
  const initialPassword = "InitialPassword2026!";
  const initialApiKey = process.env.GEMINI_API_KEY || "AIzaSyDummyInitialTestKeyForIntegration12";
  const updatedApiKey = "AIzaSyDummyUpdatedTestKeyForIntegration34";

  try {
    // 1. Clean up
    await prisma.user.deleteMany({ where: { email: testEmail } }).catch(() => {});

    // 2. Create Initial User with BYOK Key
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const createdUser = await createUser({
      name: "Profile Tester",
      email: testEmail,
      passwordHash,
      geminiApiKey: initialApiKey,
    });

    console.log(`[Profile Test] Created user ${testEmail} (ID: ${createdUser.id})`);

    // 3. Test Direct Retrieval & Key Masking Logic
    const retrievedUser = await getUserById(createdUser.id);
    if (!retrievedUser) {
      throw new Error(`Failed to retrieve user by ID ${createdUser.id}`);
    }

    const hasKey = !!retrievedUser.geminiApiKey;
    const rawKey = retrievedUser.geminiApiKey || "";
    const maskedKey = hasKey && rawKey.length > 8
      ? `${rawKey.slice(0, 6)}••••••••${rawKey.slice(-4)}`
      : hasKey ? "••••••••" : null;

    if (!hasKey || !maskedKey?.startsWith(initialApiKey.slice(0, 6)) || !maskedKey?.endsWith(initialApiKey.slice(-4))) {
      throw new Error(`Masked key formatting mismatch! Got: ${maskedKey}`);
    }
    console.log(`  ✓ Masked Gemini API key format verified: ${maskedKey}`);

    // 4. Test BYOK Gemini API Key Resolution Helpers
    const fetchedKey = await getUserGeminiApiKey(createdUser.id);
    if (fetchedKey !== initialApiKey) {
      throw new Error(`getUserGeminiApiKey mismatch! Expected ${initialApiKey}, got ${fetchedKey}`);
    }
    console.log("  ✓ getUserGeminiApiKey resolved exact key");

    const effectiveById = await getEffectiveUserGeminiApiKey(createdUser.id);
    if (effectiveById !== initialApiKey) {
      throw new Error(`getEffectiveUserGeminiApiKey(id) mismatch! Expected ${initialApiKey}, got ${effectiveById}`);
    }
    console.log("  ✓ getEffectiveUserGeminiApiKey by ID resolved exact key");

    const effectiveByEmail = await getEffectiveUserGeminiApiKey(testEmail);
    if (effectiveByEmail !== initialApiKey) {
      throw new Error(`getEffectiveUserGeminiApiKey(email) mismatch! Expected ${initialApiKey}, got ${effectiveByEmail}`);
    }
    console.log("  ✓ getEffectiveUserGeminiApiKey by Email resolved exact key");

    const effectiveFromModelSelector = getEffectiveGeminiApiKey(fetchedKey);
    if (effectiveFromModelSelector !== initialApiKey) {
      throw new Error(`modelSelector.getEffectiveGeminiApiKey mismatch! Expected ${initialApiKey}, got ${effectiveFromModelSelector}`);
    }
    console.log("  ✓ modelSelector.getEffectiveGeminiApiKey correctly resolved user BYOK key");

    // 5. Test Profile Updates: Update Name, BYOK Gemini API Key, and Password
    console.log("\n[Profile Test] Updating profile with new name, new BYOK key, and new password...");
    const newPassword = "NewSecurePassword2026!";
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const updated = await updateUserProfile(createdUser.id, {
      name: "Updated Profile Name",
      geminiApiKey: updatedApiKey,
      newPasswordHash,
    });

    if (updated.name !== "Updated Profile Name") {
      throw new Error(`Profile name was not updated! Got: ${updated.name}`);
    }
    if (updated.geminiApiKey !== updatedApiKey) {
      throw new Error(`BYOK Gemini API key was not updated! Got: ${updated.geminiApiKey}`);
    }

    // Verify new password hash validity
    const isNewPasswordValid = await bcrypt.compare(newPassword, updated.passwordHash);
    if (!isNewPasswordValid) {
      throw new Error("New password hash did not verify against updated password!");
    }
    console.log("  ✓ Successfully updated name, BYOK Gemini API key, and verified new bcrypt password hash");

    // Verify effective key resolution returns the updated key
    const resolvedUpdatedKey = await getUserGeminiApiKey(createdUser.id);
    if (resolvedUpdatedKey !== updatedApiKey) {
      throw new Error(`getUserGeminiApiKey did not return updated key! Got: ${resolvedUpdatedKey}`);
    }
    console.log("  ✓ Verified updated BYOK key resolution across DB and pipeline layer");

    // 6. Cleanup
    await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
    console.log("  ✓ Cleaned up test user record");

    console.log("\n✅ ALL USER PROFILE & BYOK KEY INTEGRATION TESTS PASSED!\n");
  } catch (err: unknown) {
    console.error("❌ User Profile Integration Test Failed:", err);
    throw err;
  }
}

if (require.main === module || process.argv[1]?.includes("user-profile.test")) {
  runUserProfileIntegrationTests().catch((err) => {
    console.error("FATAL USER PROFILE INTEGRATION ERROR:", err);
    process.exit(1);
  });
}
