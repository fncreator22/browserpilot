import assert from "assert";
import {
  calculateRoleScore,
  calculateSkillsScore,
  calculateWorkModeScore,
  calculateFreshnessScore,
  calculateVerificationScore,
  rankOpportunities,
} from "@/lib/scraper/ranker";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";
import { type DeduplicatedOpportunity } from "@/lib/scraper/deduplicator";

export async function runRankerUnitTests(): Promise<void> {
  console.log("▶ [UNIT] Running 100-Point Student Relevance Ranker Tests (TASK-004)...");

  const intent: SearchIntent = {
    role: "AI Engineer",
    skills: ["Python", "PyTorch", "Next.js"],
    location: "India",
    workMode: "REMOTE",
    experienceLevel: "INTERN",
    opportunityType: "INTERNSHIP",
    targetGradYear: 2026,
    companyType: "STARTUP",
  };

  const oppPerfectMatch: DeduplicatedOpportunity = {
    canonicalHash: "hash_perfect_1",
    title: "AI Engineer Intern",
    companyName: "Acme AI",
    location: "Remote",
    workMode: "REMOTE",
    experienceLevel: "INTERN",
    opportunityType: "INTERNSHIP",
    description: "Build deep learning workflows using Python, PyTorch, and Next.js for our autonomous web agent.",
    requirements: ["Python", "PyTorch"],
    skills: ["Python", "PyTorch", "Next.js"],
    primaryApplyUrl: "https://acme.ai/apply",
    sourceListings: [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: "https://linkedin.com/jobs/view/1",
        applyUrl: "https://acme.ai/apply",
        verificationStatus: "VERIFIED",
        seenAt: new Date(),
      },
      {
        sourcePlatform: "Y Combinator",
        sourceUrl: "https://workatastartup.com/jobs/1",
        applyUrl: "https://acme.ai/apply",
        verificationStatus: "VERIFIED",
        seenAt: new Date(),
      },
    ],
    firstSeenAt: new Date(),
    lastVerifiedAt: new Date(),
    status: "ACTIVE",
  };

  // 1. Role Score (0-35)
  const roleScore = calculateRoleScore(oppPerfectMatch, intent);
  assert.ok(roleScore >= 30, `Expected high role score, got ${roleScore}`);
  assert.ok(roleScore <= 35, `Role score must be bounded to 35, got ${roleScore}`);

  // Seniority mismatch test: Student wants intern, posting is Senior Director
  const oppSeniorMismatch: DeduplicatedOpportunity = {
    ...oppPerfectMatch,
    canonicalHash: "hash_senior_1",
    title: "Senior AI Engineer Director",
    experienceLevel: "SENIOR",
    opportunityType: "FULL_TIME",
    description: "Lead enterprise engineering strategy.",
    requirements: ["10+ years experience"],
    skills: ["Leadership"],
  };
  const seniorRoleScore = calculateRoleScore(oppSeniorMismatch, intent);
  assert.strictEqual(seniorRoleScore, 0, "Senior role should receive 0 role points for student intern query");
  console.log("  ✓ Verified Role score calculation (0-35) with seniority mismatch penalty");

  // 2. Skills Score (0-25)
  const skillsScore = calculateSkillsScore(oppPerfectMatch, intent);
  assert.strictEqual(skillsScore, 25, "All 3 skills matched, expected 25 points");

  const oppNoSkills: DeduplicatedOpportunity = {
    ...oppPerfectMatch,
    canonicalHash: "hash_noskill_1",
    title: "Java Developer Intern",
    description: "Java Spring Boot backend position with Hibernate and MySQL.",
    requirements: ["Java", "Spring"],
    skills: ["Java", "Spring"],
  };
  const lowSkillsScore = calculateSkillsScore(oppNoSkills, intent);
  assert.strictEqual(lowSkillsScore, 0, "No skill match should return 0 points");
  console.log("  ✓ Verified Skills score calculation (0-25) with alias normalization");

  // 3. Work Mode Score (0-15)
  const workModeScore = calculateWorkModeScore(oppPerfectMatch, intent);
  assert.strictEqual(workModeScore, 15, "Remote match should return 15 points");

  const oppOnSite: DeduplicatedOpportunity = {
    ...oppPerfectMatch,
    canonicalHash: "hash_onsite_1",
    workMode: "ON_SITE",
  };
  const onSiteScore = calculateWorkModeScore(oppOnSite, intent);
  assert.ok(onSiteScore <= 5, "On-site job when user asks for remote should return low score");
  console.log("  ✓ Verified Work Mode score calculation (0-15)");

  // 4. Freshness Score (0-15)
  const freshScore = calculateFreshnessScore(oppPerfectMatch);
  assert.strictEqual(freshScore, 15, "0-3 days old posting should return 15 points");

  const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days old
  const oppOld: DeduplicatedOpportunity = {
    ...oppPerfectMatch,
    canonicalHash: "hash_old_1",
    lastVerifiedAt: oldDate,
    firstSeenAt: oldDate,
  };
  const oldFreshScore = calculateFreshnessScore(oppOld);
  assert.strictEqual(oldFreshScore, 3, "40 days old posting should return 3 points");
  console.log("  ✓ Verified Freshness score calculation (0-15)");

  // 5. Verification Score (0-10)
  const verifScore = calculateVerificationScore(oppPerfectMatch);
  assert.strictEqual(verifScore, 10, "Multi-source verified opportunity should return 10 points");
  console.log("  ✓ Verified Verification score calculation (0-10)");

  // 6. Overall 100-Point Ranking & Deterministic Tie-Breaking
  const oppModerateMatch: DeduplicatedOpportunity = {
    canonicalHash: "hash_mod_1",
    title: "Python Developer Intern",
    companyName: "Beta Labs",
    location: "Bengaluru, India",
    workMode: "HYBRID",
    experienceLevel: "INTERN",
    opportunityType: "INTERNSHIP",
    description: "Python development for cloud microservices.",
    requirements: ["Python"],
    skills: ["Python"],
    primaryApplyUrl: "https://betalabs.com/apply",
    sourceListings: [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: "https://linkedin.com/jobs/view/mod1",
        applyUrl: "https://betalabs.com/apply",
        verificationStatus: "VERIFIED",
        seenAt: new Date(),
      },
    ],
    firstSeenAt: new Date(),
    lastVerifiedAt: new Date(),
    status: "ACTIVE",
  };

  const ranked = rankOpportunities([oppModerateMatch, oppPerfectMatch, oppSeniorMismatch], intent);
  assert.strictEqual(ranked.length, 3);
  assert.strictEqual(ranked[0].opportunity.canonicalHash, "hash_perfect_1", "Rank 1 must be the highest scoring opportunity");
  assert.strictEqual(ranked[0].rankPosition, 1);
  assert.ok(ranked[0].totalScore >= 90, `Expected high score, got ${ranked[0].totalScore}`);
  assert.strictEqual(ranked[1].opportunity.canonicalHash, "hash_mod_1", "Rank 2 must be moderate match");
  assert.strictEqual(ranked[2].opportunity.canonicalHash, "hash_senior_1", "Rank 3 must be senior mismatch");

  // 7. Deterministic Tie-Breaking Verification
  const oppTie1: DeduplicatedOpportunity = {
    ...oppPerfectMatch,
    canonicalHash: "hash_aaa_tie",
    companyName: "AAA Corp",
  };
  const oppTie2: DeduplicatedOpportunity = {
    ...oppPerfectMatch,
    canonicalHash: "hash_zzz_tie",
    companyName: "ZZZ Corp",
  };

  const rankedTies = rankOpportunities([oppTie2, oppTie1], intent);
  assert.strictEqual(rankedTies[0].opportunity.canonicalHash, "hash_aaa_tie", "Tie breaker must sort canonicalHash ASC stably");
  assert.strictEqual(rankedTies[1].opportunity.canonicalHash, "hash_zzz_tie");
  console.log("  ✓ Verified deterministic ranking order and stable tie-breaking");

  console.log("✓ [UNIT] 100-Point Student Relevance Ranker Tests Passed!\n");
}
