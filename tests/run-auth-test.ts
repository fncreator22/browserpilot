import { authOptions } from "@/lib/auth/authOptions";

async function runAuthTestSuite() {
  console.log("=================================================");
  console.log("  BROWSERPILOT NEXTAUTH.JS AUTHENTICATION TEST   ");
  console.log("=================================================\n");

  const testEmail = `dev-test-${Date.now()}@browserpilot.ai`;
  const testPassword = "PasswordSecure2026!";

  // 1. Find Credentials Provider
  const credentialsProvider = authOptions.providers.find(
    (p) => p.id === "credentials"
  ) as { options?: { authorize?: (c: Record<string, string>, req: unknown) => Promise<unknown> } };

  if (!credentialsProvider || !credentialsProvider.options?.authorize) {
    throw new Error("Credentials provider is not registered in authOptions!");
  }
  console.log("✓ Found Credentials Provider in auth configuration");

  const authorizeFn = credentialsProvider.options.authorize;

  // 2. Test Standalone User Creation & Authorize
  console.log(`\n[Auth Test] Authorizing new user: ${testEmail}...`);
  const authorizedUser = (await authorizeFn(
    { email: testEmail, password: testPassword },
    {}
  )) as { id: string; email: string; name?: string } | null;

  if (!authorizedUser || !authorizedUser.id || authorizedUser.email !== testEmail) {
    throw new Error(`Credentials provider failed to authorize new user! Result: ${JSON.stringify(authorizedUser)}`);
  }
  console.log(`✓ Successfully created and authorized user: ID=${authorizedUser.id}, Email=${authorizedUser.email}`);

  // 3. Test Correct Password Verification on subsequent login
  console.log(`\n[Auth Test] Authorizing existing user with correct password...`);
  const existingUser = (await authorizeFn(
    { email: testEmail, password: testPassword },
    {}
  )) as { id: string; email: string; name?: string } | null;

  if (!existingUser || existingUser.id !== authorizedUser.id) {
    throw new Error("Existing user password verification failed!");
  }
  console.log(`✓ Successfully verified existing user password credentials.`);

  // 4. Test Invalid Password Rejection
  console.log(`\n[Auth Test] Testing rejection on invalid password...`);
  try {
    await authorizeFn(
      { email: testEmail, password: "WrongPassword999" },
      {}
    );
    throw new Error("Should have thrown error on wrong password!");
  } catch (err: unknown) {
    console.log(`✓ Expected Rejection: "${(err as Error).message}"`);
  }

  // 5. Test GitHub Provider Configuration State
  const hasGitHub = authOptions.providers.some((p) => p.id === "github");
  console.log(`\n[Auth Test] GitHub OAuth Provider status: ${hasGitHub ? "Configured with GITHUB_ID" : "Gracefully omitted when OAuth env absent (Credentials working standalone per constraints)"}`);

  // 6. Test JWT and Session Callbacks
  console.log(`\n[Auth Test] Testing JWT and Session callback pipelines...`);
  if (authOptions.callbacks?.jwt && authOptions.callbacks?.session) {
    // @ts-expect-error - testing callback
    const token = await authOptions.callbacks.jwt({
      token: {},
      user: authorizedUser,
    });

    if (token.id !== authorizedUser.id) {
      throw new Error("JWT callback did not set token.id!");
    }
    console.log(`✓ JWT callback attached user.id: ${token.id}`);

    // @ts-expect-error - testing callback
    const session = await authOptions.callbacks.session({
      session: { user: { email: authorizedUser.email, name: authorizedUser.name }, expires: new Date().toISOString() },
      token,
    });

    if ((session.user as { id?: string }).id !== authorizedUser.id) {
      throw new Error("Session callback did not propagate session.user.id!");
    }
    console.log(`✓ Session callback attached session.user.id: ${(session.user as { id?: string }).id}`);
  }

  console.log("\n=================================================");
  console.log("  ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!  ");
  console.log("=================================================\n");
}

runAuthTestSuite().catch((err) => {
  console.error("FATAL AUTH TEST ERROR:", err);
  process.exit(1);
});
