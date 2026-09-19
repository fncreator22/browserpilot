import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getUserTrialStatus,
  getAdminTrialConfig,
  updateAdminTrialConfig,
  extendUserTrial,
  setUserTrialExempt,
} from "../lib/billing/trialService";
import { revalidateSourceListing } from "../lib/scraper/evidenceVerifier";

describe("§TASK-V4: 15-Day Free Trial Clock Engine & Search Hardening Suite", () => {
  describe("15-Day Free Trial Clock Engine", () => {
    it("should accurately calculate 15-day countdown for guest and new users", async () => {
      const guestStatus = await getUserTrialStatus("guest_123");
      assert.equal(guestStatus.isPaid, false);
      assert.equal(guestStatus.isAdmin, false);
      assert.equal(guestStatus.isTrialActive, true);
      assert.equal(guestStatus.isTrialExpired, false);
      assert.equal(guestStatus.daysRemaining, 15);
      assert.equal(guestStatus.trialLengthDays, 15);
      assert.equal(guestStatus.upgradeRequired, false);
      assert.match(guestStatus.statusText, /15d Trial/i);
    });

    it("should allow admin configuration overrides and duration adjustments", async () => {
      const initialConfig = getAdminTrialConfig();
      assert.equal(initialConfig.enforceTrial, true);

      // Update default trial days
      updateAdminTrialConfig({ defaultTrialDays: 20 });
      assert.equal(getAdminTrialConfig().defaultTrialDays, 20);

      // Test extension
      extendUserTrial("test_user_extend", 5);
      const config = getAdminTrialConfig();
      assert.equal(config.userOverrides["test_user_extend"]?.extendedDays, 5);

      // Test exemption
      setUserTrialExempt("test_user_exempt", true);
      assert.equal(getAdminTrialConfig().userOverrides["test_user_exempt"]?.exempt, true);

      const exemptStatus = await getUserTrialStatus("test_user_exempt");
      assert.equal(exemptStatus.isTrialActive, true);
      assert.equal(exemptStatus.upgradeRequired, false);
      assert.equal(exemptStatus.daysRemaining, 999);

      // Reset back to defaults
      updateAdminTrialConfig({ defaultTrialDays: 15 });
    });
  });

  describe("Serverless & Vercel Evidence Verifier Guards", () => {
    it("should bypass Playwright browser pool on VERCEL=1 runtime", async () => {
      process.env.VERCEL = "1";
      try {
        const result = await revalidateSourceListing(
          {
            sourcePlatform: "Greenhouse",
            sourceUrl: "https://boards.greenhouse.io/anthropic/jobs/12345",
          },
          { timeoutMs: 1000 }
        );
        // Result must not throw Playwright missing binary error
        assert.ok(result);
        assert.ok(result.status);
      } finally {
        delete process.env.VERCEL;
      }
    });
  });

  describe("High-Yield Fallback Yield Recovery", () => {
    it("should yield 10-15 verified opportunities via augmentToGuaranteedYield", async () => {
      const { augmentToGuaranteedYield } = await import(
        "../lib/discovery/search/highYieldSearchAugmentor"
      );
      const results = await augmentToGuaranteedYield(
        [],
        "Staff Software Engineer",
        {
          roles: ["Staff Software Engineer"],
          queryHint: "Staff Software Engineer",
          sources: ["linkedin", "greenhouse"],
        }
      );

      assert.ok(results.length >= 15, `Expected at least 15 results, got ${results.length}`);
      assert.ok(results.length <= 30, `Expected at most 30 results, got ${results.length}`);

      for (const item of results) {
        assert.ok(item.opportunity.title);
        assert.ok(item.opportunity.companyName);
        assert.ok(item.opportunity.canonicalHash);
        assert.ok(item.opportunity.primaryApplyUrl);
        assert.ok(item.totalScore > 0);
      }
    });
  });
});
