/**
 * §AUTHORITATIVE SEARCH RESULT QUALITY GATE (TASK-044)
 * 
 * Provides a single, deterministic boundary to evaluate candidate validity,
 * date eligibility, job-level URL resolution, role relevance, and metadata confidence
 * before ranking, deduplication, and persistence.
 */

import { type RawJobCandidate } from "./providers/baseProvider";
import { type DiscoveryPlan } from "./discoveryPlanner";
import { 
  classifyJobUrl, 
  type JobUrlType, 
  normalizeJobTitle, 
  normalizeCompany 
} from "./normalizer";
import { 
  parsePostingDate, 
  isWithinFreshnessWindow, 
  evaluateMetadataConfidence, 
  type MetadataConfidence 
} from "./freshnessExtractor";
import { extractSeniority } from "./deduplicator";

export interface QualityGateEvaluation {
  isEligible: boolean;
  rejectionReasons: string[];
  metadataConfidence: MetadataConfidence;
  urlType: JobUrlType;
  parsedPostingDate: Date | null;
  postedAgoText?: string;
  ageHours?: number;
  roleMatch: boolean;
  seniorityMatch: boolean;
}

const INVALID_TITLE_PATTERNS = [
  /^click here\b/i,
  /^search results?$/i,
  /^jobs?$/i,
  /^all jobs?$/i,
  /^careers?$/i,
  /^sign\s*in$/i,
  /^apply(?: now)?$/i,
  /^loading(?:\.\.\.)?$/i,
  /^untitled$/i,
  /^unknown(?: job)?$/i,
  /^n\/?a$/i,
  /^404\b/i,
  /^error\b/i,
  /^position$/i,
  /^role$/i,
];

const INVALID_COMPANY_PATTERNS = [
  /^unknown(?: company)?$/i,
  /^company$/i,
  /^organization$/i,
  /^n\/?a$/i,
  /^none$/i,
  /^employer$/i,
  /^null$/i,
  /^undefined$/i,
];

/**
 * Checks if a candidate title is semantically disjoint from the requested role.
 * E.g. If searching for "Backend Engineer", reject "Frontend Engineer", "Graphic Designer", "iOS Engineer", etc.
 */
function isDisjointRole(candidateTitle: string, targetRoles: string[]): boolean {
  if (!targetRoles || targetRoles.length === 0) return false;

  const normCandidate = normalizeJobTitle(candidateTitle).toLowerCase();
  const lowerTitle = candidateTitle.toLowerCase();

  // If target is specifically Backend
  const isTargetBackend = targetRoles.some((r) => /backend|back end/i.test(r));
  if (isTargetBackend) {
    // If title is purely frontend, mobile, design, or data analyst without backend mentions
    const isPureFrontend = /\b(frontend|front end|ui\/ux|graphic designer|ios developer|android developer|flutter developer|mobile developer)\b/i.test(lowerTitle);
    const hasBackendToken = /\b(backend|back end|full stack|fullstack|distributed|api|platform)\b/i.test(lowerTitle);
    if (isPureFrontend && !hasBackendToken) {
      return true;
    }
  }

  // If target is specifically Frontend
  const isTargetFrontend = targetRoles.some((r) => /frontend|front end/i.test(r));
  if (isTargetFrontend) {
    const isPureBackend = /\b(backend|back end|devops|database admin|systems admin)\b/i.test(lowerTitle);
    const hasFrontendToken = /\b(frontend|front end|ui|react|vue|angular|full stack|fullstack)\b/i.test(lowerTitle);
    if (isPureBackend && !hasFrontendToken) {
      return true;
    }
  }

  return false;
}

/**
 * Single authoritative Quality Gate evaluation for a raw job candidate.
 */
export function evaluateCandidateQualityGate(
  candidate: RawJobCandidate,
  plan: DiscoveryPlan,
  referenceTime: Date = new Date()
): QualityGateEvaluation {
  const rejectionReasons: string[] = [];

  // 1. Required Metadata Validation (Title & Company)
  const rawTitle = (candidate.title || "").trim();
  if (!rawTitle || rawTitle.length < 3) {
    rejectionReasons.push("Job title is missing or too short");
  } else if (INVALID_TITLE_PATTERNS.some((p) => p.test(rawTitle))) {
    rejectionReasons.push(`Job title matches invalid placeholder pattern: "${rawTitle}"`);
  }

  const rawCompany = (candidate.companyName || (candidate as any).company || "").trim();
  if (!rawCompany || rawCompany.length < 2) {
    rejectionReasons.push("Company name is missing or too short");
  } else if (INVALID_COMPANY_PATTERNS.some((p) => p.test(rawCompany))) {
    rejectionReasons.push(`Company name matches invalid placeholder pattern: "${rawCompany}"`);
  }

  // 2. Job URL Classification & Validation
  const primaryUrl = candidate.sourceUrl || candidate.applyUrl || "";
  const applyUrl = candidate.applyUrl || candidate.sourceUrl || "";
  let urlType = classifyJobUrl(primaryUrl);
  let effectiveJobUrl = primaryUrl;

  // If primaryUrl was classified as generic portal, check if applyUrl is an exact job detail URL
  if (urlType !== "JOB_DETAIL") {
    const applyType = classifyJobUrl(applyUrl);
    if (applyType === "JOB_DETAIL") {
      urlType = "JOB_DETAIL";
      effectiveJobUrl = applyUrl;
    }
  }

  if (urlType !== "JOB_DETAIL") {
    rejectionReasons.push(`URL points to a generic portal (${urlType}) rather than a specific job posting page`);
  }

  // 3. Deterministic Date Extraction & Freshness Gating
  let postedAt = candidate.postedAt instanceof Date ? candidate.postedAt : candidate.postedAt ? new Date(candidate.postedAt) : null;
  let postedAgoText = candidate.postedAgoText;

  if (!postedAt && (candidate.rawSnippet || candidate.description)) {
    const signal = parsePostingDate(candidate.rawSnippet || candidate.description, referenceTime);
    if (signal.postedAt) {
      postedAt = signal.postedAt;
      postedAgoText = signal.postedAgoText;
    }
  }

  let ageHours: number | undefined;
  if (postedAt && !isNaN(postedAt.getTime())) {
    const refMs = referenceTime.getTime();
    const postedMs = postedAt.getTime();
    const effectivePostedMs = postedMs > refMs ? refMs : postedMs;
    ageHours = (refMs - effectivePostedMs) / (3600 * 1000);
  }

  if (plan.isExplicitFreshness) {
    if (!postedAt || isNaN(postedAt.getTime())) {
      rejectionReasons.push("Posting date could not be verified under explicit time-bound search");
    } else if (!isWithinFreshnessWindow(postedAt, plan.freshnessWindowHours, true, referenceTime)) {
      const daysOld = ageHours ? (ageHours / 24).toFixed(1) : "unknown";
      rejectionReasons.push(`Posting is ${daysOld} days old (exceeds requested ${plan.freshnessWindowHours}h / ${Math.round(plan.freshnessWindowHours / 24)}d window)`);
    }
  }

  // 4. Role Relevance Check
  let roleMatch = true;
  if (plan.roles && plan.roles.length > 0) {
    if (isDisjointRole(rawTitle, plan.roles)) {
      roleMatch = false;
      rejectionReasons.push(`Role "${rawTitle}" is semantically disjoint from requested role "${plan.roles.join(", ")}"`);
    }
  }

  // 5. Seniority Alignment Check
  let seniorityMatch = true;
  if (plan.experienceLevels && plan.experienceLevels.length > 0 && !plan.experienceLevels.includes("ANY")) {
    const candSeniority = extractSeniority(rawTitle);
    const requestedLevels = plan.experienceLevels;
    if (requestedLevels.includes("ENTRY_LEVEL") || requestedLevels.includes("INTERN")) {
      if (candSeniority === "SENIOR" || candSeniority === "LEAD") {
        seniorityMatch = false;
        rejectionReasons.push(`Seniority of "${rawTitle}" (${candSeniority}) conflicts with entry-level request`);
      }
    }
  }

  // 6. Metadata Confidence Evaluation
  const metadataConfidence = evaluateMetadataConfidence({
    title: rawTitle,
    companyName: rawCompany,
    postedAt,
    sourceUrl: effectiveJobUrl,
    applyUrl,
  });

  const isEligible = rejectionReasons.length === 0;

  return {
    isEligible,
    rejectionReasons,
    metadataConfidence,
    urlType,
    parsedPostingDate: postedAt,
    postedAgoText: postedAgoText || undefined,
    ageHours,
    roleMatch,
    seniorityMatch,
  };
}
