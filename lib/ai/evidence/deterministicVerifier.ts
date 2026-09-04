/**
 * §DETERMINISTIC EVIDENCE VERIFIER & HARD CONSTRAINT FIREWALL (TASK-051)
 * 
 * Enforces hard factual constraints before any semantic reasoning:
 * 1. URL validity & direct job detail classification (rejecting generic career roots)
 * 2. Strict date freshness & future/missing date gating
 * 3. Work mode conflict detection (remote vs on-site)
 * 4. Location conflict detection (country mismatch)
 * 5. Disjoint role detection (unrelated functions)
 * 
 * HARD CONSTRAINT INVARIANT:
 * If a candidate fails a hard constraint, it is immediately marked isHardBlocked = true,
 * and the semantic judge CANNOT override this determination.
 */

import {
  type NormalizedEvidenceSet,
  type DeterministicVerificationResult,
} from "./evidenceTypes";
import { type DiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { classifyJobUrl } from "@/lib/scraper/normalizer";
import { isWithinFreshnessWindow, evaluateMetadataConfidence } from "@/lib/scraper/freshnessExtractor";
import { extractSeniority } from "@/lib/scraper/deduplicator";

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
  // TASK-063 Synthetic Firewall Patterns
  /job_5001/i,
  /synthetic candidate/i,
  /test candidate/i,
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
  // TASK-063 Synthetic Firewall Patterns
  /leading organization/i,
  /leading employer/i,
  /placeholder company/i,
  /mock company/i,
  /example company/i,
  /fake company/i,
];

/**
 * Checks if a candidate title is strictly disjoint from requested roles.
 */
function isDisjointRole(candidateTitle: string, targetRoles?: string[]): boolean {
  if (!targetRoles || targetRoles.length === 0) return false;

  const lowerTitle = candidateTitle.toLowerCase();

  // If searching for Backend
  const isTargetBackend = targetRoles.some((r) => /backend|back end|distributed|systems|api/i.test(r));
  if (isTargetBackend) {
    const isPureDisjoint = /\b(product marketing|marketing manager|sales executive|account executive|graphic designer|hr manager|recruiter|financial analyst)\b/i.test(lowerTitle);
    if (isPureDisjoint) return true;

    const isPureFrontend = /\b(frontend|front end|ui\/ux|graphic designer|ios developer|android developer|flutter developer)\b/i.test(lowerTitle);
    const hasBackendToken = /\b(backend|back end|full stack|fullstack|distributed|api|platform)\b/i.test(lowerTitle);
    if (isPureFrontend && !hasBackendToken) {
      return true;
    }
  }

  // If searching for Frontend
  const isTargetFrontend = targetRoles.some((r) => /frontend|front end/i.test(r));
  if (isTargetFrontend) {
    const isPureDisjoint = /\b(product marketing|marketing manager|sales executive|graphic designer|hr manager|recruiter)\b/i.test(lowerTitle);
    if (isPureDisjoint) return true;

    const isPureBackend = /\b(backend|back end|devops|database admin|systems admin)\b/i.test(lowerTitle);
    const hasFrontendToken = /\b(frontend|front end|ui|react|vue|angular|full stack|fullstack)\b/i.test(lowerTitle);
    if (isPureBackend && !hasFrontendToken) {
      return true;
    }
  }

  return false;
}

/**
 * Checks for direct country/geographic conflicts between query and candidate.
 */
function isLocationConflicted(candidateLocation?: string, targetLocations?: string[]): boolean {
  if (!candidateLocation || !targetLocations || targetLocations.length === 0) return false;

  const candLower = candidateLocation.toLowerCase();

  // Query asks for India, but candidate is US only
  const isTargetIndia = targetLocations.some((loc) => /india|bengaluru|bangalore|hyderabad|delhi|mumbai|pune/i.test(loc));
  if (isTargetIndia) {
    if (/\b(us only|united states only|must be located in the us|usa only)\b/i.test(candLower)) {
      return true;
    }
  }

  // Query asks for US, but candidate is India only / EMEA only
  const isTargetUS = targetLocations.some((loc) => /us|usa|united states|california|new york|san francisco/i.test(loc));
  if (isTargetUS) {
    if (/\b(india only|emea only|apac only|must be located in india)\b/i.test(candLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates deterministic constraints across the normalized evidence set.
 */
export function verifyDeterministicEvidence(
  evidence: NormalizedEvidenceSet,
  plan: DiscoveryPlan,
  referenceTime: Date = new Date()
): DeterministicVerificationResult {
  const failedConstraints: string[] = [];
  const passedConstraints: string[] = [];
  const rejectionReasons: string[] = [];
  let isHardBlocked = false;

  // ---------------------------------------------------------------------------
  // 1. URL ELIGIBILITY & CLASSIFICATION
  // ---------------------------------------------------------------------------
  const rawUrl = evidence.applyUrl?.value || evidence.records.find((r) => r.url)?.url || "";
  let urlEligible = false;
  let urlType = classifyJobUrl(rawUrl);

  if (!rawUrl || (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://"))) {
    rejectionReasons.push(`Invalid or non-HTTP URL protocol: "${rawUrl}"`);
    failedConstraints.push("URL_PROTOCOL_VALID");
    isHardBlocked = true;
  } else {
    // Check private / loopback IP
    const lowerUrl = rawUrl.toLowerCase();
    const isPrivate = /127\.0\.0\.1|localhost|169\.254\.169\.254|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+/.test(lowerUrl);
    if (isPrivate) {
      rejectionReasons.push(`URL points to prohibited private or internal IP address: "${rawUrl}"`);
      failedConstraints.push("PUBLIC_URL_ALLOWED");
      isHardBlocked = true;
    } else if (urlType !== "JOB_DETAIL") {
      rejectionReasons.push(`URL points to generic portal or career root (${urlType}) rather than specific job detail`);
      failedConstraints.push("EXACT_JOB_URL");
      isHardBlocked = true;
    } else {
      urlEligible = true;
      passedConstraints.push("EXACT_JOB_URL");
    }
  }

  // ---------------------------------------------------------------------------
  // 2. COMPANY & TITLE VALIDATION
  // ---------------------------------------------------------------------------
  const titleVal = evidence.title?.value?.trim() || "";
  let roleEligible = false;

  if (!titleVal || titleVal.length < 3) {
    rejectionReasons.push("Job title is missing or too short");
    failedConstraints.push("TITLE_PRESENT");
    isHardBlocked = true;
  } else if (INVALID_TITLE_PATTERNS.some((p) => p.test(titleVal))) {
    rejectionReasons.push(`Job title matches placeholder or invalid pattern: "${titleVal}"`);
    failedConstraints.push("TITLE_VALID");
    isHardBlocked = true;
  } else if (isDisjointRole(titleVal, plan.roles)) {
    rejectionReasons.push(`Role "${titleVal}" is semantically disjoint from requested role "${plan.roles?.join(", ")}"`);
    failedConstraints.push("ROLE_DISJOINT_BLOCKER");
    isHardBlocked = true;
  } else {
    roleEligible = true;
    passedConstraints.push("ROLE_COMPATIBLE");
  }

  const compVal = evidence.company?.value?.trim() || "";
  let companyEligible = false;

  if (!compVal || compVal.length < 2) {
    rejectionReasons.push("Company name is missing or too short");
    failedConstraints.push("COMPANY_PRESENT");
    isHardBlocked = true;
  } else if (INVALID_COMPANY_PATTERNS.some((p) => p.test(compVal))) {
    rejectionReasons.push(`Company name matches placeholder pattern: "${compVal}"`);
    failedConstraints.push("COMPANY_VALID");
    isHardBlocked = true;
  } else {
    companyEligible = true;
    passedConstraints.push("COMPANY_VALID");
  }

  // ---------------------------------------------------------------------------
  // 3. DATE FRESHNESS & CANONICAL SEMANTICS
  // ---------------------------------------------------------------------------
  const postedAt = evidence.postedDate?.value || null;
  let dateEligible = false;
  let calculatedAgeHours: number | undefined;

  if (postedAt && !isNaN(postedAt.getTime())) {
    const refMs = referenceTime.getTime();
    const postedMs = postedAt.getTime();

    // Future date check (> 24 hours in the future)
    if (postedMs > refMs + 24 * 3600 * 1000) {
      rejectionReasons.push(`Posting date is in the future (${postedAt.toISOString()})`);
      failedConstraints.push("DATE_NOT_FUTURE");
      isHardBlocked = true;
    } else {
      const effectivePostedMs = postedMs > refMs ? refMs : postedMs;
      calculatedAgeHours = (refMs - effectivePostedMs) / (3600 * 1000);

      if (plan.isExplicitFreshness) {
        if (!isWithinFreshnessWindow(postedAt, plan.freshnessWindowHours, true, referenceTime)) {
          const daysOld = (calculatedAgeHours / 24).toFixed(1);
          rejectionReasons.push(
            `Posting is ${daysOld} days old (exceeds requested ${plan.freshnessWindowHours}h / ${Math.round(plan.freshnessWindowHours / 24)}d window)`
          );
          failedConstraints.push("FRESHNESS_WINDOW");
          isHardBlocked = true; // HARD CONSTRAINT FIREWALL
        } else {
          dateEligible = true;
          passedConstraints.push("FRESHNESS_WINDOW");
        }
      } else {
        dateEligible = true;
        passedConstraints.push("DATE_VALID");
      }
    }
  } else {
    // Missing posted date
    if (plan.isExplicitFreshness) {
      rejectionReasons.push("Posting date is unverified under explicit time-bound search");
      failedConstraints.push("FRESHNESS_REQUIRED_DATE_PRESENT");
      isHardBlocked = true; // HARD CONSTRAINT FIREWALL
    } else {
      // Non-explicit freshness allows unverified date
      dateEligible = true;
      passedConstraints.push("DATE_OPTIONAL");
    }
  }

  // ---------------------------------------------------------------------------
  // 4. WORK MODE CONFLICT DETECTION
  // ---------------------------------------------------------------------------
  let workModeEligible = true;
  const candWorkMode = evidence.workMode?.value;
  const requestedWorkModes = plan.workModes;

  if (requestedWorkModes && requestedWorkModes.length > 0) {
    if (requestedWorkModes.includes("REMOTE") && !requestedWorkModes.includes("ON_SITE")) {
      if (candWorkMode === "ON_SITE") {
        rejectionReasons.push("Candidate is explicitly ON-SITE while user requested REMOTE only");
        failedConstraints.push("WORK_MODE_COMPATIBLE");
        isHardBlocked = true;
        workModeEligible = false;
      }
    } else if (requestedWorkModes.includes("ON_SITE") && !requestedWorkModes.includes("REMOTE")) {
      if (candWorkMode === "REMOTE") {
        rejectionReasons.push("Candidate is explicitly REMOTE while user requested ON-SITE only");
        failedConstraints.push("WORK_MODE_COMPATIBLE");
        isHardBlocked = true;
        workModeEligible = false;
      }
    }
  }
  if (workModeEligible) {
    passedConstraints.push("WORK_MODE_COMPATIBLE");
  }

  // ---------------------------------------------------------------------------
  // 5. LOCATION CONFLICT DETECTION
  // ---------------------------------------------------------------------------
  let locationEligible = true;
  const candLocation = evidence.location?.value;
  if (isLocationConflicted(candLocation, plan.locations)) {
    rejectionReasons.push(`Candidate location "${candLocation}" directly conflicts with requested locations "${plan.locations?.join(", ")}"`);
    failedConstraints.push("LOCATION_COMPATIBLE");
    isHardBlocked = true;
    locationEligible = false;
  } else {
    passedConstraints.push("LOCATION_COMPATIBLE");
  }

  // ---------------------------------------------------------------------------
  // 6. SENIORITY CONFLICT DETECTION
  // ---------------------------------------------------------------------------
  if (plan.experienceLevels && plan.experienceLevels.length > 0 && !plan.experienceLevels.includes("ANY")) {
    const candSeniority = extractSeniority(titleVal);
    if (plan.experienceLevels.includes("ENTRY_LEVEL") || plan.experienceLevels.includes("INTERN")) {
      if (candSeniority === "SENIOR" || candSeniority === "LEAD") {
        rejectionReasons.push(`Seniority of "${titleVal}" (${candSeniority}) conflicts with entry-level request`);
        failedConstraints.push("SENIORITY_COMPATIBLE");
        isHardBlocked = true;
      }
    }
  }

  const metadataConfidence = evaluateMetadataConfidence({
    title: titleVal,
    companyName: compVal,
    postedAt,
    sourceUrl: rawUrl,
    applyUrl: evidence.applyUrl?.value,
  });

  const isEligible = rejectionReasons.length === 0 && !isHardBlocked;

  return {
    isEligible,
    isHardBlocked,
    failedConstraints,
    passedConstraints,
    rejectionReasons,
    dateEligible,
    urlEligible,
    urlType,
    roleEligible,
    locationEligible,
    workModeEligible,
    companyEligible,
    metadataConfidence,
    calculatedAgeHours,
  };
}
