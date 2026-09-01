/**
 * §CANONICAL OPPORTUNITY IDENTITY & CROSS-SOURCE RESOLUTION (TASK-042)
 * 
 * Provides deterministic opportunity identity across multi-source discovery channels
 * (LinkedIn, Indeed, Greenhouse, Ashby, Lever, Workable, Company Careers, HN, GitHub, YC)
 * by evaluating normalized attributes, external identifiers, and canonical application URLs.
 */

import crypto from "crypto";
import {
  normalizeCompany,
  normalizeJobTitle,
  normalizeLocation,
  canonicalizeUrl,
  calculateStringSimilarity,
} from "@/lib/scraper/normalizer";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";

export interface OpportunityIdentityProfile {
  canonicalHash: string;
  normalizedCompany: string;
  normalizedTitle: string;
  normalizedLocation: string;
  workMode: string;
  primaryApplyUrl: string;
  externalJobIds: string[];
}

/**
 * Builds a deterministic canonical identity profile for an opportunity candidate.
 */
export function buildOpportunityIdentity(candidate: RawJobCandidate): OpportunityIdentityProfile {
  const normCompany = normalizeCompany(candidate.companyName);
  const normTitle = normalizeJobTitle(candidate.title);
  const normLoc = normalizeLocation(candidate.location);
  const workMode = candidate.workMode || (candidate.location && /remote/i.test(candidate.location) ? "REMOTE" : "ANY");
  const applyUrl = canonicalizeUrl(candidate.applyUrl) || canonicalizeUrl(candidate.sourceUrl);

  const composite = `${normCompany}::${normTitle}`;
  const canonicalHash = crypto.createHash("md5").update(composite).digest("hex");

  const externalJobIds: string[] = [];
  if (candidate.externalJobId) {
    externalJobIds.push(candidate.externalJobId.trim());
  }

  return {
    canonicalHash,
    normalizedCompany: normCompany,
    normalizedTitle: normTitle,
    normalizedLocation: normLoc,
    workMode,
    primaryApplyUrl: applyUrl,
    externalJobIds,
  };
}

/**
 * Evaluates whether two candidates or listings represent the same underlying real-world opportunity.
 * Employs 3 deterministic matching tiers:
 * 1. Exact canonical apply URL match
 * 2. Exact canonical hash match (normalized company + title)
 * 3. High fuzzy similarity (>= 0.88) with matching normalized company and compatible seniority
 */
export function matchOpportunityIdentity(
  a: { companyName: string; title: string; location?: string; applyUrl?: string; canonicalHash?: string },
  b: { companyName: string; title: string; location?: string; applyUrl?: string; canonicalHash?: string }
): { isMatch: boolean; confidence: number; matchReason: string } {
  // Tier 1: Canonical Apply URL Match
  if (a.applyUrl && b.applyUrl) {
    const canonA = canonicalizeUrl(a.applyUrl);
    const canonB = canonicalizeUrl(b.applyUrl);
    if (canonA && canonB && canonA === canonB) {
      return { isMatch: true, confidence: 1.0, matchReason: "EXACT_CANONICAL_APPLY_URL" };
    }
  }

  // Tier 2: Exact Canonical Hash Match
  const hashA = a.canonicalHash || crypto.createHash("md5").update(`${normalizeCompany(a.companyName)}::${normalizeJobTitle(a.title)}`).digest("hex");
  const hashB = b.canonicalHash || crypto.createHash("md5").update(`${normalizeCompany(b.companyName)}::${normalizeJobTitle(b.title)}`).digest("hex");

  if (hashA === hashB) {
    return { isMatch: true, confidence: 0.95, matchReason: "EXACT_CANONICAL_HASH" };
  }

  // Tier 3: Bounded Fuzzy Similarity with Matching Company
  const compA = normalizeCompany(a.companyName);
  const compB = normalizeCompany(b.companyName);

  if (compA === compB && compA !== "unknown_company") {
    const titleA = normalizeJobTitle(a.title);
    const titleB = normalizeJobTitle(b.title);

    // Strict seniority blocker
    const isInternA = /\bintern\b/i.test(titleA);
    const isInternB = /\bintern\b/i.test(titleB);
    const isSeniorA = /\b(senior|sr|staff|principal|lead)\b/i.test(titleA);
    const isSeniorB = /\b(senior|sr|staff|principal|lead)\b/i.test(titleB);

    if (isInternA !== isInternB || isSeniorA !== isSeniorB) {
      return { isMatch: false, confidence: 0.0, matchReason: "SENIORITY_MISMATCH" };
    }

    const similarity = calculateStringSimilarity(titleA, titleB);
    if (similarity >= 0.88) {
      return {
        isMatch: true,
        confidence: Math.round(similarity * 100) / 100,
        matchReason: "HIGH_SIMILARITY_SAME_COMPANY",
      };
    }
  }

  return { isMatch: false, confidence: 0.0, matchReason: "DISTINCT_OPPORTUNITY" };
}
