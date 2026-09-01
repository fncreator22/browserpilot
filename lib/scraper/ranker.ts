/**
 * §DETERMINISTIC 100-POINT STUDENT RELEVANCE RANKER
 * Ranks opportunities according to:
 * - Role Match (0-35)
 * - Skills Match (0-25)
 * - Work Mode Match (0-15)
 * - Freshness (0-15)
 * - Verification (0-10)
 * Provides deterministic tie-breaking without any LLM calls or network latency.
 */

import { type SearchIntent } from "./providers/baseProvider";
import { type DeduplicatedOpportunity } from "./deduplicator";
import { normalizeJobTitle } from "./normalizer";

export interface ScoreBreakdown {
  role: number;
  skills: number;
  workMode: number;
  freshness: number;
  verification: number;
}

export interface RankedOpportunity {
  opportunity: DeduplicatedOpportunity;
  totalScore: number;
  rankPosition: number;
  breakdown: ScoreBreakdown;
}

/**
 * Normalizes skill string for deterministic alias matching
 */
function normalizeSkill(skill: string): string {
  const s = skill.toLowerCase().replace(/[^\w]/g, "").trim();
  if (s === "reactjs" || s === "react") return "react";
  if (s === "nodejs" || s === "node") return "node";
  if (s === "nextjs" || s === "next") return "nextjs";
  if (s === "typescript" || s === "ts") return "typescript";
  if (s === "javascript" || s === "js") return "javascript";
  if (s === "postgresql" || s === "postgres") return "postgres";
  if (s === "pytorch" || s === "torch") return "pytorch";
  if (s === "golang" || s === "go") return "go";
  if (s === "machinelearning" || s === "ml") return "ml";
  if (s === "artificialintelligence" || s === "ai") return "ai";
  return s;
}

/**
 * 1. Role Score Calculation (0 - 35 points)
 */
export function calculateRoleScore(opp: DeduplicatedOpportunity, intent: SearchIntent): number {
  if (!intent.role && (!intent.roles || intent.roles.length === 0) && !intent.experienceLevel && !intent.opportunityType) {
    return 25; // Default neutral baseline when user gives open search
  }

  const candidateRoles = intent.roles && intent.roles.length > 0 ? intent.roles : (intent.role ? [intent.role] : []);
  const oppTitleNorm = normalizeJobTitle(opp.title);
  const isSeniorTitle = /\b(senior|sr|lead|principal|staff|director|head|vp)\b/i.test(opp.title);

  let bestRoleScore = 0;

  if (candidateRoles.length === 0) {
    bestRoleScore = 15;
  } else {
    for (const rawTargetRole of candidateRoles) {
      const targetRoleNorm = normalizeJobTitle(rawTargetRole);
      let currentScore = 0;

      // Exact title match
      if (targetRoleNorm && oppTitleNorm === targetRoleNorm) {
        currentScore = 35;
      } else if (targetRoleNorm && (oppTitleNorm.includes(targetRoleNorm) || targetRoleNorm.includes(oppTitleNorm))) {
        currentScore = 25;
      } else if (targetRoleNorm) {
        // Token overlap
        const targetTokens = targetRoleNorm.split(" ").filter((t) => t.length > 2);
        const oppTokens = new Set(oppTitleNorm.split(" "));
        let matched = 0;
        for (const t of targetTokens) {
          if (oppTokens.has(t)) matched++;
        }
        if (targetTokens.length > 0) {
          currentScore = Math.round((matched / targetTokens.length) * 20);
        }
      }

      if (currentScore > bestRoleScore) {
        bestRoleScore = currentScore;
      }
    }
  }

  let score = bestRoleScore;

  // Internship / Student Match
  const isPureInternTarget = (intent.experienceLevel === "INTERN" || intent.opportunityType === "INTERNSHIP") &&
    (!intent.opportunityTypes || !intent.opportunityTypes.includes("FULL_TIME")) &&
    (!intent.experienceLevels || !intent.experienceLevels.includes("ENTRY_LEVEL"));

  const isOppIntern =
    !isSeniorTitle &&
    (opp.experienceLevel === "INTERN" || opp.opportunityType === "INTERNSHIP" || /intern/i.test(opp.title));

  if (isPureInternTarget && isOppIntern) {
    score = Math.min(35, score + 8);
  } else if (isPureInternTarget && !isOppIntern) {
    if (isSeniorTitle) {
      score = 0; // Senior/Executive role gets 0 points for a pure student internship query
    } else {
      score = Math.max(0, score - 15);
    }
  } else if (isSeniorTitle && (intent.experienceLevel === "INTERN" || intent.experienceLevel === "ENTRY_LEVEL")) {
    score = Math.max(0, score - 15);
  }

  return Math.min(35, Math.max(0, score));
}

/**
 * 2. Skills Score Calculation (0 - 25 points)
 */
export function calculateSkillsScore(opp: DeduplicatedOpportunity, intent: SearchIntent): number {
  if (!intent.skills || intent.skills.length === 0) {
    return 20; // Default baseline score when skills are unspecified
  }

  const targetSkills = intent.skills.map(normalizeSkill).filter(Boolean);
  if (targetSkills.length === 0) return 20;

  const rawSearchable = `${opp.title || ""} ${opp.description || ""} ${(opp.skills || []).join(" ")} ${(opp.requirements || []).join(" ")}`.toLowerCase();
  const strippedSearchable = rawSearchable.replace(/[^\w]/g, "");

  let matchedCount = 0;
  for (const skill of targetSkills) {
    if (rawSearchable.includes(skill) || strippedSearchable.includes(skill)) {
      matchedCount++;
    }
  }

  const fraction = matchedCount / targetSkills.length;
  return Math.min(25, Math.max(0, Math.round(fraction * 25)));
}

/**
 * 3. Work Mode Score Calculation (0 - 15 points)
 */
export function calculateWorkModeScore(opp: DeduplicatedOpportunity, intent: SearchIntent): number {
  const targetMode = (intent.workMode || "ANY").toUpperCase();
  const oppMode = (opp.workMode || "ANY").toUpperCase();

  if (targetMode === "ANY") return 15;
  if (targetMode === oppMode) return 15;

  if (targetMode === "REMOTE") {
    if (oppMode === "HYBRID") return 8;
    if (oppMode === "ON_SITE") return 3;
    return 8; // Unspecified mode
  }

  if (targetMode === "HYBRID") {
    if (oppMode === "REMOTE") return 12;
    if (oppMode === "ON_SITE") return 8;
    return 8;
  }

  if (targetMode === "ON_SITE") {
    if (oppMode === "HYBRID") return 10;
    if (oppMode === "REMOTE") return 5;
    return 8;
  }

  return 10;
}

/**
 * 4. Freshness Score Calculation (0 - 15 points)
 * Prioritizes true employer posting dates (postedAt) over discovery time.
 */
export function calculateFreshnessScore(opp: DeduplicatedOpportunity): number {
  const timestamp = (opp as any).postedAt || opp.lastVerifiedAt || opp.firstSeenAt || new Date();
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays <= 3) return 15;
  if (diffDays <= 7) return 12;
  if (diffDays <= 14) return 9;
  if (diffDays <= 30) return 6;
  if (diffDays <= 60) return 3;
  return 0;
}

/**
 * 5. Verification Score Calculation (0 - 10 points)
 */
export function calculateVerificationScore(
  opp: DeduplicatedOpportunity,
  sourceQualityBoosts?: Record<string, number>
): number {
  if (!opp.sourceListings || opp.sourceListings.length === 0) return 4;

  const hasVerified = opp.sourceListings.some((l) => l.verificationStatus === "VERIFIED");
  const multiSource = opp.sourceListings.length >= 2;

  let base = 4;
  if (hasVerified && multiSource) base = 10;
  else if (hasVerified) base = 8;
  else if (opp.sourceListings.some((l) => l.verificationStatus === "RECENTLY_SEEN")) base = 6;

  // Apply bounded source quality boost (+1 to +2) if from high-quality sources
  if (sourceQualityBoosts && Object.keys(sourceQualityBoosts).length > 0) {
    for (const listing of opp.sourceListings) {
      const srcName = listing.sourcePlatform || "";
      const boost = sourceQualityBoosts[srcName.toLowerCase()] ?? sourceQualityBoosts[srcName];
      if (typeof boost === "number" && boost > 0) {
        base = Math.min(10, base + Math.min(2, Math.round(boost)));
        break;
      }
    }
  }

  return Math.min(10, Math.max(0, base));
}

export interface RankerOptions {
  sortMode?: "RELEVANCE" | "LATEST" | "RELEVANCE_THEN_FRESHNESS";
  minimumScore?: number;
  sourceQualityBoosts?: Record<string, number>;
}

/**
 * Ranks opportunities according to the 100-point model with deterministic tie-breaking.
 */
export function rankOpportunities(
  opportunities: DeduplicatedOpportunity[],
  intent: SearchIntent,
  options: RankerOptions = {}
): RankedOpportunity[] {
  if (!opportunities || opportunities.length === 0) return [];

  const sortMode = options.sortMode || "RELEVANCE_THEN_FRESHNESS";

  const scoredList: RankedOpportunity[] = opportunities.map((opp) => {
    const role = calculateRoleScore(opp, intent);
    const skills = calculateSkillsScore(opp, intent);
    const workMode = calculateWorkModeScore(opp, intent);
    const freshness = calculateFreshnessScore(opp);
    const verification = calculateVerificationScore(opp, options.sourceQualityBoosts);

    const totalScore = Math.min(100, Math.max(0, role + skills + workMode + freshness + verification));

    return {
      opportunity: opp,
      totalScore,
      rankPosition: 0,
      breakdown: {
        role,
        skills,
        workMode,
        freshness,
        verification,
      },
    };
  });

  // Deterministic sorting based on sortMode
  scoredList.sort((a, b) => {
    if (sortMode === "LATEST") {
      // 1. Freshness Score DESC
      if (b.breakdown.freshness !== a.breakdown.freshness) {
        return b.breakdown.freshness - a.breakdown.freshness;
      }
      // 2. Total Score DESC
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      // 3. Verification Score DESC
      if (b.breakdown.verification !== a.breakdown.verification) {
        return b.breakdown.verification - a.breakdown.verification;
      }
      // 4. Canonical Hash ASC
      return a.opportunity.canonicalHash.localeCompare(b.opportunity.canonicalHash);
    }

    // Default: RELEVANCE / RELEVANCE_THEN_FRESHNESS
    // 1. Total Score DESC
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    // 2. Verification Score DESC
    if (b.breakdown.verification !== a.breakdown.verification) {
      return b.breakdown.verification - a.breakdown.verification;
    }
    // 3. Freshness Score DESC
    if (b.breakdown.freshness !== a.breakdown.freshness) {
      return b.breakdown.freshness - a.breakdown.freshness;
    }
    // 4. Canonical Hash ASC (Stable tie-breaker)
    return a.opportunity.canonicalHash.localeCompare(b.opportunity.canonicalHash);
  });

  const minScore = options.minimumScore;
  const filteredList = typeof minScore === "number" && minScore > 0
    ? scoredList.filter((item) => item.totalScore >= minScore)
    : scoredList;

  // Assign 1-indexed rank positions
  return filteredList.map((item, idx) => ({
    ...item,
    rankPosition: idx + 1,
  }));
}
