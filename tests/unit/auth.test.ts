import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { authOptions } from "@/lib/auth/authOptions";

export async function runAuthTests() {
  console.log("\n▶ [UNIT] Running Email/Password Auth & Minimal Schema Tests (Prompt B1)...");

  const testEmail = `testuser_${Date.now()}@example.com`;
  const rawPassword = "SecurePassword2026!";

  // 1. Clean up any existing test records
  await prisma.user.deleteMany({ where: { email: testEmail } }).catch(() => {});

  // 2. Test User Registration Data Creation & Hash Verification
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const createdUser = await prisma.user.create({
    data: {
      email: testEmail,
      passwordHash,
    },
  });

  if (!createdUser.id || createdUser.email !== testEmail) {
    throw new Error("Failed to create user with email & passwordHash.");
  }
  console.log("  ✓ Created user with minimal schema (id, email, passwordHash, createdAt)");

  // 3. Verify Database Fields Contain ONLY minimal fields (no name, avatarUrl, etc.)
  const rawDbUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });

  if (!rawDbUser) {
    throw new Error("Created user not found in database.");
  }

  // Ensure password is not plaintext
  if (rawDbUser.passwordHash === rawPassword) {
    throw new Error("Security violation: Password stored in plaintext!");
  }

  const isHashValid = await bcrypt.compare(rawPassword, rawDbUser.passwordHash);
  if (!isHashValid) {
    throw new Error("Password hash does not verify against original password.");
  }
  console.log("  ✓ Verified bcrypt password hash validity");

  // 4. Test NextAuth Credentials authorize() Callback
  interface CredentialsProviderInternal {
    options?: {
      authorize?: (credentials: Record<string, string>) => Promise<{ id: string; email: string } | null>;
    };
    authorize?: (credentials: Record<string, string>) => Promise<{ id: string; email: string } | null>;
  }

  const credentialsProvider = authOptions.providers.find(
    (p) => (p as unknown as { id: string }).id === "credentials"
  ) as unknown as CredentialsProviderInternal | undefined;

  const authorizeFn = credentialsProvider?.options?.authorize || credentialsProvider?.authorize;
  if (!authorizeFn) {
    throw new Error("Credentials authorize function not found.");
  }

  // Test 4a: Valid login
  const authorizedUser = await authorizeFn({
    email: testEmail,
    password: rawPassword,
  });

  if (!authorizedUser || authorizedUser.id !== createdUser.id || authorizedUser.email !== testEmail) {
    throw new Error(`authorize() failed to validate correct credentials. Got: ${JSON.stringify(authorizedUser)}`);
  }
  console.log("  ✓ authorize() successfully authenticated valid credentials");

  // Test 4b: Wrong password (must reject with generic error)
  let rejectedWrongPw = false;
  try {
    await authorizeFn({
      email: testEmail,
      password: "WrongPassword123!",
    });
  } catch (err: unknown) {
    if ((err as Error).message === "Invalid email or password") {
      rejectedWrongPw = true;
    }
  }
  if (!rejectedWrongPw) {
    throw new Error("authorize() did not throw generic 'Invalid email or password' error on wrong password.");
  }
  console.log("  ✓ authorize() rejected wrong password with generic message");

  // Test 4c: Non-existent email (must reject with identical generic error to prevent enumeration)
  let rejectedNonExistent = false;
  try {
    await authorizeFn({
      email: "nonexistent_email_12345@example.com",
      password: "SomePassword123!",
    });
  } catch (err: unknown) {
    if ((err as Error).message === "Invalid email or password") {
      rejectedNonExistent = true;
    }
  }
  if (!rejectedNonExistent) {
    throw new Error("authorize() did not throw generic 'Invalid email or password' error on non-existent email.");
  }
  console.log("  ✓ authorize() rejected nonexistent user with identical generic message");

  // Clean up test user
  await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});

  console.log("✓ [UNIT] Auth & Minimal Schema Tests Passed!");
}

if (require.main === module) {
  runAuthTests().catch((err) => {
    console.error("Auth test failed:", err);
    process.exit(1);
  });
}
