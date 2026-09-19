import assert from "node:assert/strict";
import {
  parseCookieHeader,
  isSessionExpired,
  encryptByocSession,
  decryptByocSession,
  isEncryptedCredential,
} from "@/lib/security/credentialEncryption";
import { browserSessionManager } from "@/lib/discovery/browser/browserSessionManager";
import { prisma } from "@/lib/db/prisma";

async function runStage4Tests() {
  console.log("> [STAGE 4] Running Plugin Session Lifecycle & OAuth Realization Tests...");

  const testUserId = `test_stage4_${Date.now()}`;
  const testSource = "LINKEDIN_STAGE4_TEST";

  try {
    // 1. Cookie Header Parsing
    console.log("  1. Verifying parseCookieHeader()...");
    const parsed = parseCookieHeader("li_at=AQED12345; JSESSIONID=\"ajax:9876\"; bcookie=v=2; lang=v=2");
    assert.equal(parsed["li_at"], "AQED12345");
    assert.equal(parsed["JSESSIONID"], '"ajax:9876"');
    assert.equal(parsed["bcookie"], "v=2");
    assert.equal(parsed["lang"], "v=2");
    assert.deepEqual(parseCookieHeader(""), {});
    assert.deepEqual(parseCookieHeader(null), {});
    console.log("  [PASS] parseCookieHeader correctly extracts structured key-value cookie pairs");

    // 2. BYOC Session AES-256-GCM Encryption Round-Trip
    console.log("  2. Verifying encryptByocSession() and decryptByocSession()...");
    const originalPayload = {
      cookies: { li_at: "AQED_TEST_COOKIE_SECRET_TOKEN_12345" },
      token: "oauth_bearer_token_xyz987",
      rawCookieString: "li_at=AQED_TEST_COOKIE_SECRET_TOKEN_12345",
      metadata: { source: "LinkedIn", version: "v1" },
    };

    const ciphertext = encryptByocSession(originalPayload);
    assert.ok(ciphertext, "Expected ciphertext to be non-null");
    assert.ok(isEncryptedCredential(ciphertext), "Ciphertext must have enc:v1: prefix");
    assert.ok(!ciphertext.includes("AQED_TEST_COOKIE_SECRET_TOKEN_12345"), "Plaintext must not appear in ciphertext");

    const decrypted = decryptByocSession(ciphertext);
    assert.ok(decrypted, "Decrypted payload must be non-null");
    assert.deepEqual(decrypted?.cookies, originalPayload.cookies);
    assert.equal(decrypted?.token, originalPayload.token);
    assert.equal(decrypted?.rawCookieString, originalPayload.rawCookieString);
    console.log("  [PASS] AES-256-GCM BYOC payload encryption round-trip verified");

    // 3. Cryptographic Tamper Defense
    console.log("  3. Verifying tamper detection on encrypted BYOC payload...");
    const parts = ciphertext.split(":");
    // parts: ["enc", "v1", iv, tag, encryptedHex]
    const tamperedHex = parts[4].slice(0, -2) + (parts[4].slice(-2) === "00" ? "ff" : "00");
    const tamperedCiphertext = `enc:v1:${parts[2]}:${parts[3]}:${tamperedHex}`;
    const tamperedResult = decryptByocSession(tamperedCiphertext);
    assert.equal(tamperedResult, null, "Tampered payload must fail authentication tag check and return null");
    console.log("  [PASS] GCM authentication tag prevents altered ciphertext tampering");

    // 4. Session Expiration Date Evaluation
    console.log("  4. Verifying isSessionExpired()...");
    const pastDate = new Date(Date.now() - 60000);
    const futureDate = new Date(Date.now() + 60000);
    assert.equal(isSessionExpired(pastDate), true, "Past date should be expired");
    assert.equal(isSessionExpired(futureDate), false, "Future date should not be expired");
    assert.equal(isSessionExpired(null), false, "Null date should not be marked expired");
    console.log("  [PASS] isSessionExpired accurately checks expiration bounds");

    // 5. Structured BYOC Import Persistence
    console.log("  5. Verifying browserSessionManager.importByocSession()...");
    // Seed user if needed
    await prisma.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        name: "Stage 4 Tester",
        passwordHash: "test_password_hash_stage4",
      },
      update: {},
    });

    const sessionRecord = await browserSessionManager.importByocSession(testUserId, testSource, {
      cookieString: "li_at=AQED_IMPORT_TEST_SESSION; bcookie=v=2",
      username: "Stage4 LinkedIn Recruiter",
      expiresInMs: 3600000,
    });

    assert.equal(sessionRecord.userId, testUserId);
    assert.equal(sessionRecord.source, testSource);
    assert.equal(sessionRecord.status, "CONNECTED");
    assert.equal(sessionRecord.username, "Stage4 LinkedIn Recruiter");
    assert.equal(sessionRecord.authMethod, "COOKIE_JAR");
    assert.ok(sessionRecord.expiresAt && sessionRecord.expiresAt.getTime() > Date.now());
    console.log("  [PASS] importByocSession creates encrypted session in PostgreSQL");

    // 6. Active Session Retrieval & Decryption
    console.log("  6. Verifying getActiveSession()...");
    const active = await browserSessionManager.getActiveSession(testUserId, testSource);
    assert.ok(active, "Active session should be retrievable");
    assert.equal(active.record.status, "CONNECTED");
    assert.ok(active.rawState, "Raw decrypted state should exist");
    console.log("  [PASS] getActiveSession successfully decrypts persisted BYOC session");

    // 7. Automated Re-Auth Signal on HTTP 401 Unauthorized
    console.log("  7. Verifying handleAuthFailure(401)...");
    const failureResult401 = await browserSessionManager.handleAuthFailure(
      testUserId,
      testSource,
      401,
      "HTTP 401 Unauthorized: Session cookie rejected by target platform"
    );

    assert.equal(failureResult401.sessionExpired, true);
    assert.equal(failureResult401.reauthRequired, true);
    assert.equal(failureResult401.status, "EXPIRED");

    const sessionAfter401 = await prisma.browserSession.findUnique({
      where: { userId_source: { userId: testUserId, source: testSource } },
    });
    assert.equal(sessionAfter401?.status, "EXPIRED");
    const metaAfter401 = JSON.parse(sessionAfter401?.metadata || "{}");
    assert.equal(metaAfter401.reauthRequired, true);
    assert.equal(metaAfter401.lastAuthFailure?.statusCode, 401);
    console.log("  [PASS] handleAuthFailure(401) transitions session to EXPIRED with re-auth signal");

    // 8. Automated Re-Auth Signal on HTTP 403 Forbidden / Verification Challenge
    console.log("  8. Verifying handleAuthFailure(403)...");
    const testSource403 = "REDDIT_STAGE4_TEST";
    await browserSessionManager.createOrUpdateSession(testUserId, testSource403, { token: "secret_val" });

    const failureResult403 = await browserSessionManager.handleAuthFailure(
      testUserId,
      testSource403,
      403,
      "HTTP 403 Forbidden: Anti-bot challenge detected"
    );

    assert.equal(failureResult403.status, "REQUIRES_VERIFICATION");
    assert.equal(failureResult403.reauthRequired, true);
    console.log("  [PASS] handleAuthFailure(403) transitions session to REQUIRES_VERIFICATION");

    // 9. Session Health Check
    console.log("  9. Verifying checkSessionHealth()...");
    const health401 = await browserSessionManager.checkSessionHealth(testUserId, testSource);
    assert.equal(health401.isValid, false);
    assert.equal(health401.reauthRequired, true);
    assert.equal(health401.status, "EXPIRED");

    // Re-connect to test healthy state
    await browserSessionManager.createOrUpdateSession(testUserId, testSource, { ok: true }, { expiresInMs: 3600000 });
    const healthClean = await browserSessionManager.checkSessionHealth(testUserId, testSource);
    assert.equal(healthClean.isValid, true);
    assert.equal(healthClean.status, "CONNECTED");
    assert.equal(healthClean.reauthRequired, false);
    console.log("  [PASS] checkSessionHealth accurately distinguishes healthy vs expired states");

    // 10. Query Expired Sessions
    console.log("  10. Verifying getExpiredSessions()...");
    // Expire testSource403
    await prisma.browserSession.update({
      where: { userId_source: { userId: testUserId, source: testSource403 } },
      data: { status: "EXPIRED" },
    });
    const expiredList = await browserSessionManager.getExpiredSessions(testUserId);
    assert.ok(expiredList.some((s) => s.source === testSource403));
    console.log("  [PASS] getExpiredSessions collects expired sessions for user notification");

    // 11. EphemeralBrowserContext Cookie Normalization for BYOC Payloads
    console.log("  11. Verifying EphemeralBrowserContextRunner.normalizeCookies() for BYOC payloads...");
    const { EphemeralBrowserContextRunner } = await import("@/lib/discovery/browser/ephemeralBrowserContext");
    const runner = new EphemeralBrowserContextRunner(browserSessionManager);

    const byocSessionState = {
      cookieString: "li_at=AQED_NORMALIZE_TEST; bcookie=v=2",
      cookies: {
        li_at: "AQED_NORMALIZE_TEST",
        bcookie: "v=2",
      },
      token: undefined,
      importedAt: new Date().toISOString(),
    };

    const normalizedByoc = runner.normalizeCookies("LINKEDIN", byocSessionState);
    assert.ok(normalizedByoc.length >= 2, "Must extract at least li_at and bcookie");
    const liCookie = normalizedByoc.find((c) => c.name === "li_at");
    const bcookie = normalizedByoc.find((c) => c.name === "bcookie");
    assert.ok(liCookie, "li_at cookie must be present");
    assert.equal(liCookie.value, "AQED_NORMALIZE_TEST");
    assert.equal(liCookie.domain, ".linkedin.com");
    assert.ok(bcookie, "bcookie must be present");
    assert.equal(bcookie.value, "v=2");
    assert.equal(bcookie.domain, ".linkedin.com");

    // Envelope keys must not become cookies
    assert.ok(!normalizedByoc.some((c) => c.name === "cookieString"));
    assert.ok(!normalizedByoc.some((c) => c.name === "importedAt"));
    console.log("  [PASS] normalizeCookies successfully extracts and binds BYOC cookies to .linkedin.com");

    // 12. Canonical Domain Mapping for Twitter, X, and Reddit
    console.log("  12. Verifying default domain mappings for Twitter, X, and Reddit...");
    const twitterCookies = runner.normalizeCookies("TWITTER", { auth_token: "xyz" });
    assert.equal(twitterCookies[0]?.domain, ".twitter.com");
    const xCookies = runner.normalizeCookies("X_TWITTER", { auth_token: "xyz" });
    assert.equal(xCookies[0]?.domain, ".x.com");
    const redditCookies = runner.normalizeCookies("REDDIT", { reddit_session: "abc" });
    assert.equal(redditCookies[0]?.domain, ".reddit.com");
    console.log("  [PASS] Twitter, X, and Reddit cookies map to canonical domains");

    // 13. Prototype Pollution Rejection in parseCookieHeader
    console.log("  13. Verifying prototype pollution rejection in parseCookieHeader()...");
    const evilCookies = parseCookieHeader("__proto__=evil; constructor=bad; prototype=worst; li_at=clean");
    assert.equal((evilCookies as any)["__proto__"], undefined);
    assert.equal(evilCookies["constructor"], undefined);
    assert.equal(evilCookies["prototype"], undefined);
    assert.equal(evilCookies["li_at"], "clean");
    console.log("  [PASS] parseCookieHeader strictly rejects prototype pollution keys");

    // 14. Payload Size Limit Enforcement in importByocSession
    console.log("  14. Verifying payload size limit enforcement in importByocSession()...");
    const hugeCookieString = "li_at=" + "x".repeat(70000);
    await assert.rejects(
      async () => {
        await browserSessionManager.importByocSession(testUserId, "LINKEDIN", {
          cookieString: hugeCookieString,
        });
      },
      /exceeds maximum permitted length/i,
      "Expected oversized cookieString to be rejected"
    );
    console.log("  [PASS] Oversized BYOC payload safely rejected");

    // 15. Alias Fallback in handleAuthFailure
    console.log("  15. Verifying alias fallback in handleAuthFailure()...");
    const xTwitterSource = "X_TWITTER";
    await browserSessionManager.createOrUpdateSession(testUserId, xTwitterSource, { token: "secret" });
    // Call handleAuthFailure using alias "twitter"
    const failureViaAlias = await browserSessionManager.handleAuthFailure(
      testUserId,
      "twitter",
      401,
      "HTTP 401 Unauthorized: Session expired"
    );
    assert.equal(failureViaAlias.reauthRequired, true);
    const xTwitterRecord = await prisma.browserSession.findUnique({
      where: { userId_source: { userId: testUserId, source: xTwitterSource } },
    });
    assert.equal(xTwitterRecord?.status, "EXPIRED", "Session stored under X_TWITTER must be marked EXPIRED when alias 'twitter' fails");
    console.log("  [PASS] handleAuthFailure correctly resolves aliases to update parent session");

    console.log("> [STAGE 4] All 15 verification tests passed successfully!");
  } finally {
    // Cleanup test artifacts
    await prisma.browserSession.deleteMany({
      where: { userId: testUserId },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: testUserId },
    }).catch(() => {});
  }
}

export { runStage4Tests };

if (process.argv[1]?.includes("stage4-session-lifecycle.test") || require.main === module) {
  runStage4Tests()
    .then(() => {
      console.log("Stage 4 test suite completed with 0 failures.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Stage 4 test suite failed:", err);
      process.exit(1);
    });
}
