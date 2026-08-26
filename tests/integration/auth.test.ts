import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { authOptions } from "@/lib/auth/authOptions";
import { createUser, getUserByEmail } from "@/lib/db/users";

export async function runAuthIntegrationTests() {
  console.log("=================================================");
  console.log("  BROWSERPILOT AUTHENTICATION INTEGRATION TEST   ");
  console.log("=================================================\n");

  const timestamp = Date.now();
  const testEmail = `auth-integration-${timestamp}@browserpilot.ai`;
  const rawPassword = "StrongPassword2026!";
  const testApiKey = process.env.GEMINI_API_KEY || "AIzaSyDummyTestKeyForIntegrationTests1234";

  try {
    // 1. Clean up any existing records
    await prisma.user.deleteMany({ where: { email: testEmail } }).catch(() => {});

    // 2. Test User Registration with BYOK Gemini API Key
    console.log(`[Auth Test] Registering user ${testEmail} with BYOK Gemini API Key...`);
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const createdUser = await createUser({
      name: "Verification User",
      email: testEmail,
      passwordHash,
      geminiApiKey: testApiKey,
    });

    if (!createdUser || !createdUser.id || createdUser.email !== testEmail) {
      throw new Error("Failed to register user in database with BYOK key.");
    }
    console.log(`  ✓ Created user ID=${createdUser.id}, Email=${createdUser.email}`);

    // Verify stored fields in database
    const dbUser = await getUserByEmail(testEmail);
    if (!dbUser) {
      throw new Error("Could not retrieve newly created user by email.");
    }

    if (dbUser.passwordHash === rawPassword) {
      throw new Error("Security failure: Password stored in plaintext!");
    }

    const isPasswordHashValid = await bcrypt.compare(rawPassword, dbUser.passwordHash);
    if (!isPasswordHashValid) {
      throw new Error("Bcrypt password hash does not match original password.");
    }
    console.log("  ✓ Bcrypt password hashing verified successfully");

    if (dbUser.geminiApiKey !== testApiKey) {
      throw new Error(`BYOK Gemini API key not saved correctly. Expected ${testApiKey}, got ${dbUser.geminiApiKey}`);
    }
    console.log("  ✓ BYOK Gemini API key stored and verified in database");

    // 3. Test CredentialsProvider authorize()
    console.log("\n[Auth Test] Testing NextAuth CredentialsProvider authorize()...");
    const credentialsProvider = authOptions.providers.find(
      (p) => (p as unknown as { id: string }).id === "credentials"
    ) as unknown as {
      options?: {
        authorize?: (c: Record<string, string>, req?: unknown) => Promise<{ id: string; email: string; name?: string } | null>;
      };
      authorize?: (c: Record<string, string>, req?: unknown) => Promise<{ id: string; email: string; name?: string } | null>;
    };

    const authorizeFn = credentialsProvider?.options?.authorize || credentialsProvider?.authorize;
    if (!authorizeFn) {
      throw new Error("NextAuth Credentials authorize function not found in authOptions!");
    }

    // 3a. Valid Login Credentials
    const authResult = await authorizeFn({
      email: testEmail,
      password: rawPassword,
    });

    if (!authResult || authResult.id !== createdUser.id || authResult.email !== testEmail) {
      throw new Error(`authorize() returned unexpected result for valid credentials: ${JSON.stringify(authResult)}`);
    }
    console.log(`  ✓ authorize() successfully validated correct login credentials for ${authResult.email}`);

    // 3b. Wrong Password Rejection (Generic error)
    let rejectedWrongPassword = false;
    try {
      await authorizeFn({
        email: testEmail,
        password: "IncorrectPassword999!",
      });
    } catch (err: unknown) {
      if ((err as Error).message === "Invalid email or password") {
        rejectedWrongPassword = true;
      }
    }

    if (!rejectedWrongPassword) {
      throw new Error("authorize() did not throw generic 'Invalid email or password' error on wrong password.");
    }
    console.log("  ✓ authorize() rejected incorrect password with generic error message");

    // 3c. Non-existent Email Rejection (Generic error to prevent enumeration)
    let rejectedNonExistent = false;
    try {
      await authorizeFn({
        email: "nonexistent-user-404@browserpilot.ai",
        password: "SomePassword123!",
      });
    } catch (err: unknown) {
      if ((err as Error).message === "Invalid email or password") {
        rejectedNonExistent = true;
      }
    }

    if (!rejectedNonExistent) {
      throw new Error("authorize() did not throw generic 'Invalid email or password' error on nonexistent email.");
    }
    console.log("  ✓ authorize() rejected non-existent email with generic error message");

    // 4. Test NextAuth JWT & Session Callbacks
    console.log("\n[Auth Test] Testing JWT & Session token propagation pipeline...");
    if (authOptions.callbacks?.jwt && authOptions.callbacks?.session) {
      const token = await authOptions.callbacks.jwt({
        token: {},
        user: authResult,
        account: null,
      });

      if (token.id !== createdUser.id) {
        throw new Error(`JWT callback failed to attach user id to token. Expected ${createdUser.id}, got ${token.id}`);
      }
      console.log(`  ✓ JWT callback attached token.id=${token.id}`);

      // @ts-expect-error - testing callback
      const session = await authOptions.callbacks.session({
        session: {
          user: { name: authResult.name, email: authResult.email },
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        token,
      });

      const sessionUserId = (session.user as { id?: string })?.id;
      if (sessionUserId !== createdUser.id) {
        throw new Error(`Session callback failed to propagate session.user.id. Expected ${createdUser.id}, got ${sessionUserId}`);
      }
      console.log(`  ✓ Session callback successfully propagated session.user.id=${sessionUserId}`);
    }

    // 5. Cleanup
    await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
    console.log("  ✓ Cleaned up test user record");

    console.log("\n✅ ALL AUTHENTICATION INTEGRATION TESTS PASSED!\n");
  } catch (err: unknown) {
    console.error("❌ Authentication Integration Test Failed:", err);
    throw err;
  }
}

if (require.main === module || process.argv[1]?.includes("auth.test")) {
  runAuthIntegrationTests().catch((err) => {
    console.error("FATAL AUTH INTEGRATION ERROR:", err);
    process.exit(1);
  });
}
