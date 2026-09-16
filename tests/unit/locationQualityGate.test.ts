import assert from "assert";
import {
  evaluateCandidateQualityGate,
} from "@/lib/scraper/searchQualityGate";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { rankOpportunities } from "@/lib/scraper/ranker";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { normalizeLocation } from "@/lib/scraper/normalizer";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { type DeduplicatedOpportunity } from "@/lib/scraper/deduplicator";

export async function runLocationQualityGateTests(): Promise<void> {
  console.log("▶ [UNIT] Running Location Quality Gate & Cross-Border Gating Tests...");

  const baseCandidate: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/view/1001",
    applyUrl: "https://example.com/apply/1001",
    title: "Data Analyst",
    companyName: "Acme Analytics",
    workMode: "REMOTE",
    location: "Bengaluru, Karnataka, India",
    postedAt: new Date(),
    discoveredAt: new Date(),
    description: "Looking for Data Analyst with SQL and Python skills in Bengaluru.",
  };

  const planBengaluru = buildDiscoveryPlan("Find data analyst in bengaluru in last 30 days.");

  // Test 1: Exact city match (Bengaluru)
  const evalLocal = evaluateCandidateQualityGate(
    { ...baseCandidate, location: "Bengaluru, Karnataka, India" },
    planBengaluru
  );
  assert.strictEqual(evalLocal.isEligible, true, "Local Bengaluru candidate must be eligible");
  assert.strictEqual(evalLocal.locationMatch, true, "locationMatch must be true for Bengaluru");
  console.log("  ✓ Test 1: Verified local Bengaluru match passes quality gate");

  // Test 2: City synonym match (Bangalore)
  const evalSynonym = evaluateCandidateQualityGate(
    { ...baseCandidate, location: "Bangalore, India" },
    planBengaluru
  );
  assert.strictEqual(evalSynonym.isEligible, true, "Bangalore synonym candidate must be eligible");
  assert.strictEqual(evalSynonym.locationMatch, true, "locationMatch must be true for Bangalore synonym");
  console.log("  ✓ Test 2: Verified Bangalore synonym matches Bengaluru target");

  // Test 3: Sub-region / tech hub match (Electronic City)
  const evalHub = evaluateCandidateQualityGate(
    { ...baseCandidate, location: "Electronic City, India" },
    planBengaluru
  );
  assert.strictEqual(evalHub.isEligible, true, "Electronic City candidate must match Bengaluru target");
  assert.strictEqual(evalHub.locationMatch, true);
  console.log("  ✓ Test 3: Verified tech hub synonym (Electronic City) matches Bengaluru");

  // Test 4: Cross-border foreign country rejection (Egypt vs Bengaluru)
  // This directly addresses the user-reported issue where dubizzle Egypt was returned
  const evalEgypt = evaluateCandidateQualityGate(
    {
      ...baseCandidate,
      companyName: "dubizzle Egypt",
      location: "New Cairo, Cairo, Egypt | Remote",
      workMode: "REMOTE",
      sourceUrl: "https://dubizzle.com/jobs/1002",
      applyUrl: "https://dubizzle.com/jobs/1002",
    },
    planBengaluru
  );
  assert.strictEqual(evalEgypt.isEligible, false, "Egypt candidate must be strictly rejected for Bengaluru query");
  assert.strictEqual(evalEgypt.locationMatch, false, "locationMatch must be false for Egypt");
  assert.ok(
    evalEgypt.rejectionReasons.some((r) => r.includes("geographically disjoint") || r.includes("cross-border")),
    `Expected cross-border rejection reason, got: ${evalEgypt.rejectionReasons.join("; ")}`
  );
  console.log("  ✓ Test 4: Verified cross-border candidate (Egypt) strictly rejected for Bengaluru search");

  // Test 5: Foreign country rejection across other geographies
  const planSF = buildDiscoveryPlan("Software Engineer in San Francisco");
  const evalLondonForSF = evaluateCandidateQualityGate(
    { ...baseCandidate, title: "Software Engineer", location: "London, UK" },
    planSF
  );
  assert.strictEqual(evalLondonForSF.isEligible, false, "London candidate must be rejected for San Francisco query");
  console.log("  ✓ Test 5: Verified London candidate rejected for San Francisco query");

  // Test 6: On-site job in different city in same country (Chennai on-site for Bengaluru target)
  const evalChennaiOnSite = evaluateCandidateQualityGate(
    { ...baseCandidate, location: "Chennai, Tamil Nadu, India", workMode: "ON_SITE" },
    planBengaluru
  );
  assert.strictEqual(evalChennaiOnSite.isEligible, false, "On-site Chennai job must be rejected for Bengaluru query");
  assert.ok(
    evalChennaiOnSite.rejectionReasons.some((r) => r.includes("on-site in a different city")),
    `Expected on-site different city rejection reason, got: ${evalChennaiOnSite.rejectionReasons.join("; ")}`
  );
  console.log("  ✓ Test 6: Verified on-site job in different city is rejected for city-specific search");

  // Test 7: Remote job in different city in same country (Chennai | Remote for Bengaluru target)
  // Should pass QualityGate, but in Ranker be labeled RECOMMENDED_LOCATION and penalized
  const evalChennaiRemote = evaluateCandidateQualityGate(
    { ...baseCandidate, companyName: "EXL", location: "Chennai, Tamil Nadu, India | Remote", workMode: "REMOTE" },
    planBengaluru
  );
  assert.strictEqual(evalChennaiRemote.isEligible, true, "Remote job in same country passes quality gate");
  console.log("  ✓ Test 7: Verified Remote job in same country passes quality gate as candidate");

  // Test 8: Ranker gives local Bengaluru candidate top position over alternative city remote candidate
  const intentBengaluru = parseSearchIntent("Find data analyst in bengaluru in last 30 days.");
  const oppLocal: DeduplicatedOpportunity = {
    canonicalHash: "hash_local_blr",
    title: "Data Analyst",
    companyName: "Infosys",
    location: "Bengaluru, Karnataka, India",
    workMode: "HYBRID",
    opportunityType: "FULL_TIME",
    experienceLevel: "MID",
    primaryApplyUrl: "https://infosys.com/apply",
    description: "Data Analyst role in Bengaluru.",
    skills: ["SQL", "Python"],
    requirements: ["SQL"],
    firstSeenAt: new Date(),
    lastVerifiedAt: new Date(),
    status: "ACTIVE",
    sourceListings: [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: "https://linkedin.com/jobs/view/blr1",
        applyUrl: "https://infosys.com/apply",
        verificationStatus: "VERIFIED",
        seenAt: new Date(),
      },
    ],
  };

  const oppAltRemote: DeduplicatedOpportunity = {
    canonicalHash: "hash_alt_chennai",
    title: "Data Analyst",
    companyName: "EXL",
    location: "Chennai, Tamil Nadu, India | Remote",
    workMode: "REMOTE",
    opportunityType: "FULL_TIME",
    experienceLevel: "MID",
    primaryApplyUrl: "https://exl.com/apply",
    description: "Data Analyst role in Chennai with remote option.",
    skills: ["SQL", "Python"],
    requirements: ["SQL"],
    firstSeenAt: new Date(),
    lastVerifiedAt: new Date(),
    status: "ACTIVE",
    sourceListings: [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: "https://linkedin.com/jobs/view/chn1",
        applyUrl: "https://exl.com/apply",
        verificationStatus: "VERIFIED",
        seenAt: new Date(),
      },
    ],
  };

  const rankedOpps = rankOpportunities([oppAltRemote, oppLocal], intentBengaluru);
  assert.strictEqual(rankedOpps[0].opportunity.canonicalHash, "hash_local_blr", "Local Bengaluru job must rank #1");
  assert.strictEqual(rankedOpps[0].matchType, "EXACT_MATCH", "Local Bengaluru job must be EXACT_MATCH");
  assert.strictEqual(rankedOpps[1].opportunity.canonicalHash, "hash_alt_chennai", "Alternative location job must rank #2");
  assert.strictEqual(rankedOpps[1].matchType, "RECOMMENDED_LOCATION", "Alternative location job must be tagged RECOMMENDED_LOCATION");
  assert.ok(
    rankedOpps[0].totalScore > rankedOpps[1].totalScore,
    `Local job score (${rankedOpps[0].totalScore}) must exceed alternative location score (${rankedOpps[1].totalScore})`
  );
  console.log(`  ✓ Test 8: Verified Ranker prioritizes local match (score: ${rankedOpps[0].totalScore}) over alternative location (score: ${rankedOpps[1].totalScore})`);

  // Test 9: Country-level target (India) accepts all domestic cities but rejects international
  const planIndia = buildDiscoveryPlan("Data Analyst in India");
  const evalBlrForIndia = evaluateCandidateQualityGate({ ...baseCandidate, location: "Bengaluru, India" }, planIndia);
  const evalChnForIndia = evaluateCandidateQualityGate({ ...baseCandidate, location: "Chennai, India" }, planIndia);
  const evalCairoForIndia = evaluateCandidateQualityGate({ ...baseCandidate, location: "Cairo, Egypt" }, planIndia);

  assert.strictEqual(evalBlrForIndia.isEligible, true, "Bengaluru is in India");
  assert.strictEqual(evalChnForIndia.isEligible, true, "Chennai is in India");
  assert.strictEqual(evalCairoForIndia.isEligible, false, "Cairo, Egypt must be rejected for India target");
  console.log("  ✓ Test 9: Verified country-level target accepts domestic cities and rejects foreign cities");

  // Test 10: Ranker badge verification for sub-region tech hubs (Electronic City in Bengaluru, Hitec City in Hyderabad)
  const oppElectronicCity: DeduplicatedOpportunity = {
    ...oppLocal,
    canonicalHash: "hash_ecity_blr",
    location: "Electronic City, Karnataka, India",
  };
  const rankedHubOpps = rankOpportunities([oppElectronicCity], intentBengaluru);
  assert.strictEqual(rankedHubOpps[0].matchType, "EXACT_MATCH", "Electronic City must receive EXACT_MATCH for Bengaluru query");
  assert.ok(
    rankedHubOpps[0].totalScore >= 80,
    `Electronic City candidate should not receive a location penalty, got score ${rankedHubOpps[0].totalScore}`
  );
  console.log("  ✓ Test 10: Verified sub-region tech hub (Electronic City) receives EXACT_MATCH badge without penalty");

  // Test 11: normalizeLocation cleanly strips leading and trailing delimiters
  const normWithHyphen = normalizeLocation("Remote - Bengaluru, India");
  assert.strictEqual(normWithHyphen, "Bengaluru, India (Remote)", "Leading hyphen must be stripped");
  const normWithPipe = normalizeLocation("Chennai, Tamil Nadu | Remote");
  assert.strictEqual(normWithPipe, "Chennai, Tamil Nadu (Remote)", "Trailing delimiter must be stripped");
  console.log("  ✓ Test 11: Verified normalizeLocation cleanly formats remote locations with leading/trailing delimiters");

  console.log("✓ [UNIT] All Location Quality Gate Tests Passed!\n");
}
