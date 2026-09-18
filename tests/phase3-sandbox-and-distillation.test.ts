import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeQueryText,
  distillIntent,
  distillDiscoveryPlan,
  isDistilledSafe,
} from "../lib/scraper/intentDistiller";
import {
  EphemeralBrowserContextRunner,
  type EphemeralCookie,
} from "../lib/discovery/browser/ephemeralBrowserContext";
import {
  checkDiscoveryRunEntitlements,
} from "../lib/billing/entitlementService";
import { DiscoveryEngine } from "../lib/discovery/search/discoveryEngine";

test("Phase 3 Deliverable: Intent Distillation & Multi-Tenant PII Sanitization", async (t) => {
  await t.test("should strip personal emails, phone numbers, and SSNs from raw query text", () => {
    const raw =
      "Looking for senior frontend react jobs in San Francisco. My email is alex.rivera@techcorp.io and phone is (415) 555-0199. SSN: 000-12-3456";
    const result = sanitizeQueryText(raw);

    assert.ok(!result.cleanText.includes("alex.rivera@techcorp.io"), "Email must be removed");
    assert.ok(!result.cleanText.includes("555-0199"), "Phone number must be removed");
    assert.ok(!result.cleanText.includes("000-12-3456"), "SSN must be removed");
    assert.ok(result.strippedCount >= 3, "Should count at least 3 stripped PII tokens");
    assert.ok(result.cleanText.includes("senior frontend react jobs"));
    assert.ok(result.cleanText.includes("San Francisco"));
  });

  await t.test("should strip obfuscated emails and international phone formats", () => {
    const raw =
      "Frontend developer roles. Reach me at dev.user [at] proton [dot] me or call +44 20 7946 0958 or +91 98765 43210.";
    const result = sanitizeQueryText(raw);

    assert.ok(!result.cleanText.includes("dev.user [at] proton [dot] me"));
    assert.ok(!result.cleanText.includes("+44 20 7946 0958"));
    assert.ok(!result.cleanText.includes("+91 98765 43210"));
    assert.ok(result.cleanText.includes("Frontend developer roles"));
  });

  await t.test("should drop leftover PII labels and direct contact strings from skills", () => {
    const rawIntent = {
      role: "Staff Infrastructure Engineer",
      skills: [
        "Kubernetes",
        "SSN: 000-12-3456",
        "contact: user@secret.org",
        "Terraform",
        "email",
        "phone",
        "Go",
      ],
      location: "London, UK",
    };

    const distilled = distillIntent(rawIntent);
    assert.deepEqual(distilled.skills, ["Kubernetes", "Terraform", "Go"]);
    assert.ok(!distilled.skills.includes("SSN"));
    assert.ok(!distilled.skills.includes("email"));
    assert.ok(!distilled.skills.includes("phone"));
    assert.ok(!distilled.skills.includes("contact: user@secret.org"));
  });

  await t.test("should strip personal introductions, private notes, and resume dumps", () => {
    const raw =
      "My name is Samantha Vance. Here is my resume summary: 10 years distributed systems at Meta. Private notes: need at least 250k. Find me Staff Backend Golang roles in New York.";
    const result = sanitizeQueryText(raw);

    assert.ok(!result.cleanText.toLowerCase().includes("samantha vance"));
    assert.ok(!result.cleanText.toLowerCase().includes("private notes"));
    assert.ok(!result.cleanText.toLowerCase().includes("here is my resume"));
    assert.ok(result.cleanText.includes("Staff Backend Golang roles in New York"));
  });

  await t.test("should distill structured intent into canonical safe criteria", () => {
    const rawIntent = {
      role: "Lead Fullstack Engineer (Contact: dev@secret.org)",
      skills: ["React", "Node.js", "secret_project_token", "TypeScript"],
      location: "Remote",
      companies: ["Stripe", "PersonalNotes: do not apply to Meta"],
      queryHint: "reach me at user@domain.com for referrals",
    };

    const distilled = distillIntent(rawIntent);

    assert.ok(!distilled.role?.includes("dev@secret.org"));
    assert.equal(distilled.workMode, "REMOTE");
    assert.ok(!distilled.locations.includes("Remote"), "Remote must be mapped to workMode, not geographic location");
    assert.ok(distilled.skills.includes("React"));
    assert.ok(distilled.skills.includes("TypeScript"));
    assert.ok(!distilled.companies.some((c) => c.includes("PersonalNotes")));
    assert.equal(isDistilledSafe(distilled), true, "Distilled intent must pass isDistilledSafe check");
  });

  await t.test("should distill and sanitize an entire DiscoveryPlan", () => {
    const plan: any = {
      rawQuery: "Senior AI Engineer in Seattle - call me at 206-555-0123",
      role: "Senior AI Engineer",
      roles: ["Senior AI Engineer"],
      skills: ["Python", "PyTorch"],
      location: "Seattle, WA",
      locations: ["Seattle, WA"],
      workMode: "HYBRID",
      workModes: ["HYBRID"],
      opportunityType: "FULL_TIME",
      opportunityTypes: ["FULL_TIME"],
      experienceLevel: "SENIOR",
      experienceLevels: ["SENIOR"],
      company: undefined,
      companies: [],
      targetCompanies: [],
      freshnessWindowHours: 72,
      maxResultsPerSource: 30,
      sources: ["ATS", "LINKEDIN"],
      sortMode: "RELEVANCE_THEN_FRESHNESS",
      isLatestIntent: false,
    };

    const sanitizedPlan = distillDiscoveryPlan(plan);
    assert.ok(!sanitizedPlan.rawQuery.includes("206-555-0123"));
    assert.equal(sanitizedPlan.role, "Senior AI Engineer");
    assert.equal(sanitizedPlan.location, "Seattle, WA");
    assert.ok(sanitizedPlan.skills.includes("PyTorch"));
  });

  await t.test("should detect unsafe PII in un-distilled inputs", () => {
    assert.equal(isDistilledSafe({ role: "Software Engineer", location: "Austin, TX" }), true);
    assert.equal(isDistilledSafe({ role: "Contact me at engineer@startup.co" }), false);
    assert.equal(isDistilledSafe({ company: "Call 555-123-4567" }), false);
  });
});

test("Phase 3 Deliverable: Ephemeral Authenticated Browser Context Runner", async (t) => {
  const runner = new EphemeralBrowserContextRunner();

  await t.test("should normalize various cookie shapes into Playwright compatible cookies", () => {
    // 1. Array format
    const arrayCookies = [
      { name: "li_at", value: "AQEDAToken123", domain: ".linkedin.com", path: "/" },
      { name: "JSESSIONID", value: "ajax:456" },
    ];
    const normalized1 = runner.normalizeCookies("LINKEDIN", arrayCookies as any);
    assert.equal(normalized1.length, 2);
    assert.equal(normalized1[0].name, "li_at");
    assert.equal(normalized1[0].domain, ".linkedin.com");
    assert.equal(normalized1[1].domain, ".linkedin.com");

    // 2. StorageState object format
    const storageState = {
      cookies: [
        { name: "session_id", value: "xyz789", domain: "boards.greenhouse.io" },
      ],
      origins: [],
    };
    const normalized2 = runner.normalizeCookies("GREENHOUSE", storageState);
    assert.equal(normalized2.length, 1);
    assert.equal(normalized2[0].name, "session_id");

    // 3. Raw key-value dictionary format
    const kvCookies = {
      auth_token: "secret_val_1",
      user_pref: "dark_mode",
    };
    const normalized3 = runner.normalizeCookies("INDEED", kvCookies);
    assert.equal(normalized3.length, 2);
    assert.ok(normalized3.some((c) => c.name === "auth_token" && c.domain === ".indeed.com"));
  });

  await t.test("should guarantee strict per-tenant sandbox isolation and detect cross-tenant bleed", async () => {
    const userA = "tenant_alpha_123";
    const userB = "tenant_beta_456";

    // Create mock contexts for testing isolation logic
    const mockContextA: any = {
      addCookies: async (cookies: EphemeralCookie[]) => {},
      newPage: async () => ({ close: async () => {} }),
      close: async () => {},
    };

    const mockContextB: any = {
      addCookies: async (cookies: EphemeralCookie[]) => {},
      newPage: async () => ({ close: async () => {} }),
      close: async () => {},
    };

    // Subclass or mock active session retrieval for testing
    const mockSessionManager: any = {
      getActiveSession: async (userId: string, source: string) => ({
        record: { id: "sess_1", userId, source, status: "CONNECTED" },
        rawState: { li_at: `token_${userId}` },
      }),
    };

    const isolationRunner = new EphemeralBrowserContextRunner(mockSessionManager);

    const handleA = await isolationRunner.createEphemeralContext(userA, "LINKEDIN", {
      mockContext: mockContextA,
    });
    const handleB = await isolationRunner.createEphemeralContext(userB, "LINKEDIN", {
      mockContext: mockContextB,
    });

    assert.equal(handleA.userId, userA);
    assert.equal(handleB.userId, userB);
    assert.equal(EphemeralBrowserContextRunner.getActiveContextCount(userA), 1);
    assert.equal(EphemeralBrowserContextRunner.getActiveContextCount(userB), 1);

    // Assert that User A and User B contexts are distinct and do not bleed
    assert.doesNotThrow(() => {
      EphemeralBrowserContextRunner.assertNoCrossTenantBleed(userA, userB);
    });

    // Clean up handle A and handle B
    await handleA.close();
    assert.equal(EphemeralBrowserContextRunner.getActiveContextCount(userA), 0);
    assert.equal(EphemeralBrowserContextRunner.getActiveContextCount(userB), 1);

    await handleB.close();
    assert.equal(EphemeralBrowserContextRunner.getActiveContextCount(userB), 0);
  });

  await t.test("should clean up internally owned browser instance on close", async () => {
    let browserClosed = false;
    let pageClosed = false;
    let contextClosed = false;

    const mockBrowser: any = {
      newContext: async () => ({
        addCookies: async () => {},
        newPage: async () => ({
          close: async () => {
            pageClosed = true;
          },
        }),
        close: async () => {
          contextClosed = true;
        },
      }),
      close: async () => {
        browserClosed = true;
      },
    };

    const mockSessionManager: any = {
      getActiveSession: async () => ({
        record: { id: "s1", userId: "u1", source: "LINKEDIN" },
        rawState: { li_at: "test_token" },
      }),
    };

    const runner = new EphemeralBrowserContextRunner(mockSessionManager);
    const handle = await runner.createEphemeralContext("u1", "LINKEDIN", {
      browserInstance: mockBrowser,
    });

    await handle.close();
    assert.equal(pageClosed, true, "Page must be closed");
    assert.equal(contextClosed, true, "Context must be closed");
  });

  await t.test("should throw user-friendly error when session is absent or revoked", async () => {
    const unauthenticatedRunner = new EphemeralBrowserContextRunner({
      getActiveSession: async () => null,
    } as any);

    await assert.rejects(
      async () => {
        await unauthenticatedRunner.createEphemeralContext("user_no_session", "LINKEDIN");
      },
      (err: any) => {
        assert.equal(err.name, "BrowserConnectorError");
        assert.equal(err.category, "AUTH_REQUIRED");
        assert.ok(err.userFacingMessage.includes("connect your LINKEDIN account"));
        return true;
      }
    );
  });
});

test("Phase 3 Deliverable: Subscription Capability Gating in Discovery Runs", async (t) => {
  await t.test("should gate company targeting for Free tier users with friendly upgrade notification", async () => {
    // For free user targeting specific company "Stripe"
    const result = await checkDiscoveryRunEntitlements("FREE", {
      companies: ["Stripe", "OpenAI"],
    });

    assert.equal(result.allowed, false, "Company targeting must be disallowed on Free tier");
    assert.ok(result.gatedFeatures.length > 0);
    assert.equal(result.gatedFeatures[0].capabilityKey, "COMPANY_TARGETING");
    assert.equal(result.gatedFeatures[0].requiredPlan, "PREMIUM");
    assert.ok(result.upgradeNotification, "Must include friendly upgrade notification");
    assert.equal(result.upgradeNotification?.targetPlan, "PREMIUM");
    assert.ok(/upgrade to BrowserPilot Pro or Premium/i.test(result.upgradeNotification?.message || ""));
    assert.equal(result.sanitizedCriteria.companyTargetingAllowed, false);
    assert.deepEqual(result.sanitizedCriteria.companies, [], "Gated companies must be stripped in sanitized criteria");
  });

  await t.test("should gate high-frequency autonomous scans (<24 hours) on Free tier", async () => {
    const result = await checkDiscoveryRunEntitlements("FREE", {
      requestedIntervalHours: 2, // 2-hour scan requested
    });

    assert.equal(result.allowed, false, "2-hour scan interval must be gated on Free tier");
    assert.ok(result.gatedFeatures.some((f) => f.capabilityKey === "SCAN_FREQUENCY"));
    assert.ok(result.upgradeNotification?.title.includes("Requires Pro"));
    assert.equal(result.sanitizedCriteria.scanFrequencyHours, 24, "Free tier must clamp to 24h minimum");
  });

  await t.test("should permit standard non-company discovery searches on Free tier", async () => {
    const result = await checkDiscoveryRunEntitlements("FREE", {
      // Role and skills only, no company targeting
      requestedIntervalHours: 24,
    });

    assert.equal(result.allowed, true, "Standard role and skill discovery is 100% free");
    assert.equal(result.gatedFeatures.length, 0);
    assert.equal(result.upgradeNotification, undefined);
  });

  await t.test("DiscoveryEngine: should handle company-gated searches gracefully without raw 400/500 errors", async () => {
    const engine = new DiscoveryEngine();

    // 1. Without fallback: returns structured CAPABILITY_GATED response
    const gatedResult = await engine.executeDiscovery("Find Frontend jobs at Stripe and OpenAI", {
      userId: "FREE",
      allowFallbackOnGated: false,
    });

    assert.equal(gatedResult.success, false);
    assert.equal(gatedResult.status, "CAPABILITY_GATED");
    assert.ok(gatedResult.upgradeNotification);
    assert.ok(gatedResult.message?.includes("Direct company targeting"));
    assert.ok(gatedResult.distilledIntent);
  });

  await t.test("DiscoveryEngine: should execute with fallback on company-gated searches when allowFallbackOnGated is true", async () => {
    const engine = new DiscoveryEngine();

    let executedWithCriteria: any = null;
    const mockExecutor = async (criteria: any) => {
      executedWithCriteria = criteria;
      return {
        discovery: {
          candidates: [
            {
              id: "job_mock_1",
              title: "Senior Frontend Engineer",
              company: "Tech Global Inc",
              location: "Remote",
              source: "ATS",
              url: "https://example.com/job/1",
              relevanceScore: 92,
              qualityScore: 88,
            },
          ],
          telemetry: [{ source: "ATS", count: 1 }],
        },
      } as any;
    };

    const fallbackResult = await engine.executeDiscovery("Find Frontend jobs at Stripe and OpenAI", {
      userId: "FREE",
      allowFallbackOnGated: true,
      pipelineExecutor: mockExecutor,
    });

    assert.equal(fallbackResult.success, true);
    assert.equal(fallbackResult.status, "COMPLETED");
    assert.equal(fallbackResult.downgradedWithFallback, true);
    assert.ok(fallbackResult.upgradeNotification, "Should still notify user about company targeting capability");
    assert.equal(fallbackResult.totalFound, 1);
    assert.deepEqual(executedWithCriteria.companies, [], "Gated companies must be stripped before search pipeline execution");
    assert.equal(executedWithCriteria.role, "Frontend Engineer");
  });
});
