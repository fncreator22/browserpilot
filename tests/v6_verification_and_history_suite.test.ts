import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanTextSnippet } from "../components/result/rich-job-description";
import { augmentToGuaranteedYield } from "../lib/discovery/search/highYieldSearchAugmentor";
import { setCachedUser, invalidateCachedUser } from "../lib/auth/redisUserCache";

describe("§TASK-V6: Search History, Yield Scaling (15-30), HTML Sanitization & Redis Cache", () => {
  describe("1. HTML Sanitization & Plaintext Extraction", () => {
    it("should strip HTML tags and decode complex HTML entities", () => {
      const htmlInput = "<p>Join our team as a <strong>Senior Engineer</strong> &amp; lead backend systems.</p><div>We offer &quot;flexible hours&quot; &bull; &dollar;120k &ndash; $150k.</div>";
      const cleaned = cleanTextSnippet(htmlInput);

      assert.ok(!cleaned.includes("<p>"), "Must strip <p> tag");
      assert.ok(!cleaned.includes("<strong>"), "Must strip <strong> tag");
      assert.ok(!cleaned.includes("<div>"), "Must strip <div> tag");
      assert.ok(cleaned.includes("&"), "Must decode &amp; to &");
      assert.ok(cleaned.includes('"flexible hours"'), 'Must decode &quot; to "');
      assert.ok(cleaned.includes("-"), "Must decode &ndash; to standard hyphen -");
      assert.ok(!cleaned.includes("\u2013"), "Must NOT contain en-dash");
      assert.ok(!cleaned.includes("\u2014"), "Must NOT contain em-dash");
    });

    it("should strip entity-escaped HTML tags and double-encoded markup (screenshot defect)", () => {
      const escapedInput = '&lt;div class=&quot;content-intro&quot;&gt; &lt;h2&gt; &lt;strong&gt;About Anthropic&lt;/strong&gt; &lt;/h2&gt; &lt;p&gt;Anthropic&#39;s mission is to create safe AI.&lt;/p&gt; &lt;/div&gt;';
      const cleaned = cleanTextSnippet(escapedInput);

      assert.ok(!cleaned.includes("<div"), "Must NOT contain <div tag");
      assert.ok(!cleaned.includes("&lt;"), "Must NOT contain &lt; entity");
      assert.ok(!cleaned.includes("&gt;"), "Must NOT contain &gt; entity");
      assert.ok(!cleaned.includes("<p>"), "Must NOT contain <p> tag");
      assert.ok(!cleaned.includes("content-intro"), "Must NOT contain HTML class attribute");
      assert.ok(cleaned.includes("About Anthropic"), "Must retain genuine heading content");
      assert.ok(cleaned.includes("Anthropic's mission is to create safe AI."), "Must retain decoded text");
    });

    it("should gracefully handle null, undefined, or plain strings", () => {
      assert.equal(cleanTextSnippet(""), "");
      assert.equal(cleanTextSnippet(null as any), "");
      assert.equal(cleanTextSnippet(undefined as any), "");
      assert.equal(cleanTextSnippet("Already clean text"), "Already clean text");
    });
  });

  describe("2. Search Yield Scaling (15 to 30 Opportunities)", () => {
    it("should return at least 15 verified opportunities with default options", async () => {
      const results = await augmentToGuaranteedYield([], "Software Engineer", {
        preferredRole: "Software Engineer",
      });
      assert.ok(results.length >= 15, `Expected >= 15 results, got ${results.length}`);
    });

    it("should scale up to 30 verified opportunities when maxTotalYield is 30", async () => {
      const results = await augmentToGuaranteedYield([], "Full Stack Developer", {
        preferredRole: "Full Stack Developer",
        minTotalYield: 15,
        maxTotalYield: 30,
        targetExactMax: 30,
      });
      assert.ok(results.length >= 15, `Expected >= 15 results, got ${results.length}`);
      assert.ok(results.length <= 30, `Expected <= 30 results, got ${results.length}`);
    });
  });

  describe("3. Redis User Cache Resilience", () => {
    it("should safely set and get cached user without throwing when Redis is disconnected", async () => {
      const mockUser = {
        id: "usr_mock_123",
        email: "cachetest@browserpilot.ai",
        name: "Cache Tester",
        role: "USER",
        passwordHash: "$2a$10$abcdefghij",
      };

      await setCachedUser(mockUser);
      await invalidateCachedUser(mockUser.id, mockUser.email);
    });
  });
});
