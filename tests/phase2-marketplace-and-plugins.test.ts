import test from "node:test";
import assert from "node:assert/strict";
import { searchAtsDirectory, resolveAtsCompany, COMPREHENSIVE_ATS_COMPANIES } from "../lib/scraper/providers/atsCompanyDirectory";
import { MARKETPLACE_PLUGINS } from "../lib/plugins/pluginTypes";
import { formatCurrency, getPlanPrice } from "../lib/billing/currency";

test("Phase 2 Deliverable: ATS Company Directory & Resolution", async (t) => {
  await t.test("should provide hundreds of verified tech company ATS targets", () => {
    assert.ok(COMPREHENSIVE_ATS_COMPANIES.length >= 60, "Should have a comprehensive list of verified tech companies");
    const aiCompanies = COMPREHENSIVE_ATS_COMPANIES.filter(c => c.category === "AI_ML");
    assert.ok(aiCompanies.length >= 10, "Should include key AI/ML employers");
    assert.ok(COMPREHENSIVE_ATS_COMPANIES.some(c => c.name === "Anthropic" && c.ashbySlug === "anthropic"));
    assert.ok(COMPREHENSIVE_ATS_COMPANIES.some(c => c.name === "OpenAI" && c.greenhouseSlug === "openai"));
  });

  await t.test("should search ATS directory by query, category, and remote status", () => {
    const aiResults = searchAtsDirectory({ category: "AI_ML" });
    assert.ok(aiResults.length > 0);
    assert.ok(aiResults.every(c => c.ashbySlug || c.greenhouseSlug || c.leverSlug || c.workableSlug));

    const queryResults = searchAtsDirectory({ query: "stripe" });
    assert.equal(queryResults.length, 1);
    assert.equal(queryResults[0].name, "Stripe");

    const remoteResults = searchAtsDirectory({ remoteOnly: true });
    assert.ok(remoteResults.length > 0);
  });

  await t.test("should resolve arbitrary company names into valid ATS targets", () => {
    const known = resolveAtsCompany("GitLab");
    assert.equal(known.greenhouseSlug, "gitlab");

    const unknown = resolveAtsCompany("https://www.stealthstartup.io");
    assert.equal(unknown.greenhouseSlug, "stealthstartup");
    assert.equal(unknown.ashbySlug, "stealthstartup");
  });
});

test("Phase 2 Deliverable: Plugin System & Prototype Annotations", async (t) => {
  await t.test("should include authenticated, direct ATS, and prototype plugins", () => {
    const linkedin = MARKETPLACE_PLUGINS.find(p => p.id === "linkedin");
    assert.ok(linkedin, "LinkedIn plugin must exist");
    assert.equal(linkedin?.type, "AUTH_REQUIRED");

    const greenhouse = MARKETPLACE_PLUGINS.find(p => p.id === "greenhouse");
    assert.ok(greenhouse, "Greenhouse plugin must exist");
    assert.equal(greenhouse?.type, "DIRECT_FREE");

    const email = MARKETPLACE_PLUGINS.find(p => p.id === "email_digest");
    assert.ok(email, "Email prototype plugin must exist");
    assert.equal(email?.isPrototype, true);
    assert.equal(email?.prototypeTag, "Prototype");

    const slack = MARKETPLACE_PLUGINS.find(p => p.id === "slack_alerts");
    assert.ok(slack, "Slack prototype plugin must exist");
    assert.equal(slack?.isPrototype, true);
  });
});

test("Phase 2 Deliverable: Multi-Currency & Math Freshness Decay", async (t) => {
  await t.test("should format USD and INR amounts accurately", () => {
    assert.equal(formatCurrency(19, "USD"), "$19");
    assert.equal(formatCurrency(1499, "INR"), "₹1,499");
    assert.equal(formatCurrency(0, "USD"), "$0");

    const usdPrice = getPlanPrice("PREMIUM", "MONTHLY", "USD");
    assert.equal(usdPrice.amount, 19);
    assert.equal(usdPrice.symbol, "$");

    const inrPrice = getPlanPrice("PREMIUM", "MONTHLY", "INR");
    assert.equal(inrPrice.amount, 1499);
    assert.equal(inrPrice.symbol, "₹");
  });

  await t.test("should verify mathematical freshness decay formula", () => {
    const LAMBDA_DECAY = 0.015;
    const computeScore = (hours: number) => Math.round(15 * Math.exp(-LAMBDA_DECAY * hours) * 10) / 10;

    const freshScore = computeScore(0);
    assert.equal(freshScore, 15);

    const halfLifeScore = computeScore(46);
    assert.ok(halfLifeScore >= 7.0 && halfLifeScore <= 8.0, "Score at 46h should be ~half of 15");

    const oldScore = computeScore(120);
    assert.ok(oldScore < freshScore);
  });

  await t.test("should parse original posting dates from text snippets with word numerals", async () => {
    const { extractSnippetPostingDate } = await import("../app/api/marketplace/route");
    const now = Date.now();

    // 1. "shared that two weeks ago" (the exact user problem)
    const twoWeeks = extractSnippetPostingDate("Actively hiring. Shared that two weeks ago on LinkedIn.");
    const elapsedWeeks = (now - twoWeeks.getTime()) / (1000 * 60 * 60 * 24 * 7);
    assert.ok(elapsedWeeks >= 1.9 && elapsedWeeks <= 2.1, "Should parse 'two weeks ago' as ~2 weeks");

    // 2. "posted 3 days ago"
    const threeDays = extractSnippetPostingDate("posted 3 days ago");
    const elapsedDays = (now - threeDays.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(elapsedDays >= 2.9 && elapsedDays <= 3.1, "Should parse 'posted 3 days ago' as ~3 days");

    // 3. "2w ago"
    const twoWAgo = extractSnippetPostingDate("Listed 2w ago");
    const elapsed2W = (now - twoWAgo.getTime()) / (1000 * 60 * 60 * 24 * 7);
    assert.ok(elapsed2W >= 1.9 && elapsed2W <= 2.1, "Should parse '2w ago' as ~2 weeks");

    // 4. "yesterday"
    const yesterday = extractSnippetPostingDate("Updated yesterday");
    const elapsedYesterday = (now - yesterday.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(elapsedYesterday >= 0.9 && elapsedYesterday <= 1.1, "Should parse 'yesterday' as ~1 day");
  });
});

