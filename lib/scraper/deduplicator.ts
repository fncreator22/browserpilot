/**
 * §3-TIER DETERMINISTIC OPPORTUNITY DEDUPLICATOR
 * Reconciles multi-source job candidates across:
 * - Tier 1: Exact Canonical Source/Apply URL matching
 * - Tier 2: Canonical Opportunity Hash matching (normalized company + title)
 * - Tier 3: Bounded Fuzzy Similarity (similarity >= 0.88) with strict seniority blocking
 * Merges duplicate records non-destructively by preserving richest attributes and all SourceListings.
 */

import {
  type RawJobCandidate,
} from "./providers/baseProvider";
import {
  normalizeCompany,
  normalizeJobTitle,
  normalizeLocation,
  canonicalizeUrl,
  generateCanonicalHash,
  calculateStringSimilarity,
} from "./normalizer";

export interface NormalizedSourceListing {
  sourcePlatform: string;
  sourceUrl: string;
  applyUrl: string;
  externalJobId?: string | null;
  rawSnippet?: string | null;
  verificationStatus?: string;
  screenshotPath?: string | null;
  seenAt: Date;
  postedAt?: Date | null;
  postedAgoText?: string | null;
}

export interface DeduplicatedOpportunity {
  canonicalHash: string;
  title: string;
  companyName: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ON_SITE" | "ANY" | string;
  experienceLevel: "INTERN" | "ENTRY_LEVEL" | "MID" | "SENIOR" | string;
  opportunityType: "INTERNSHIP" | "FULL_TIME" | "CONTRACT" | string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  description: string;
  requirements: string[];
  skills: string[];
  primaryApplyUrl: string;
  sourceListings: NormalizedSourceListing[];
  firstSeenAt: Date;
  lastVerifiedAt: Date;
  postedAt?: Date | null;
  postedAgoText?: string | null;
  status: "ACTIVE" | "STALE" | "EXPIRED" | string;
}

/**
 * Extracts normalized seniority token from job title
 */
export function extractSeniority(title: string): "INTERN" | "ENTRY_LEVEL" | "MID" | "SENIOR" | "LEAD" {
  const lower = title.toLowerCase();
  if (/\b(intern|internship|trainee|co-op|coop)\b/.test(lower)) return "INTERN";
  if (/\b(senior|sr|principal|staff|lead|head|architect|director)\b/.test(lower)) return "SENIOR";
  if (/\b(junior|jr|entry|associate|grad|fresh|fresher)\b/.test(lower)) return "ENTRY_LEVEL";
  return "MID";
}

/**
 * Parses numeric salary range from raw salary string (e.g. "$40,000 - $60,000" or "50k")
 */
export function parseSalaryRange(salaryText?: string): { min?: number | null; max?: number | null; currency?: string } {
  if (!salaryText || typeof salaryText !== "string") return {};

  let currency = "USD";
  if (salaryText.includes("₹") || /inr|rupees/i.test(salaryText)) currency = "INR";
  else if (salaryText.includes("€") || /eur|euro/i.test(salaryText)) currency = "EUR";
  else if (salaryText.includes("£") || /gbp|pound/i.test(salaryText)) currency = "GBP";

  // Extract all numbers
  const cleaned = salaryText.replace(/,/g, "");
  const matches = cleaned.match(/\d+(?:\.\d+)?\s*(?:k|lpa)?/gi);

  if (!matches || matches.length === 0) return { currency };

  const parsedNumbers = matches.map((m) => {
    let num = parseFloat(m);
    if (/k/i.test(m)) num *= 1000;
    else if (/lpa/i.test(m)) num *= 100000;
    return num;
  });

  if (parsedNumbers.length === 1) {
    return { min: parsedNumbers[0], max: parsedNumbers[0], currency };
  }

  parsedNumbers.sort((a, b) => a - b);
  return {
    min: parsedNumbers[0],
    max: parsedNumbers[parsedNumbers.length - 1],
    currency,
  };
}

/**
 * Converts a raw candidate into an initial DeduplicatedOpportunity
 */
function candidateToOpportunity(raw: RawJobCandidate): DeduplicatedOpportunity {
  const normCompany = raw.companyName || "Unknown Company";
  const normTitle = raw.title || "Job Opportunity";
  const canonicalHash = generateCanonicalHash(normCompany, normTitle);
  const seniority = extractSeniority(normTitle);
  const salary = parseSalaryRange(raw.salaryText);
  const canonicalSourceUrl = canonicalizeUrl(raw.sourceUrl);
  const canonicalApplyUrl = canonicalizeUrl(raw.applyUrl) || canonicalSourceUrl;

  return {
    canonicalHash,
    title: normTitle.trim(),
    companyName: normCompany.trim(),
    location: normalizeLocation(raw.location),
    workMode: raw.workMode || (raw.location && /remote/i.test(raw.location) ? "REMOTE" : "ANY"),
    experienceLevel: raw.experienceLevel || seniority,
    opportunityType: raw.opportunityType || (seniority === "INTERN" ? "INTERNSHIP" : "FULL_TIME"),
    salaryMin: salary.min || null,
    salaryMax: salary.max || null,
    salaryCurrency: salary.currency || "USD",
    description: raw.description || raw.rawSnippet || "",
    requirements: [],
    skills: [],
    primaryApplyUrl: canonicalApplyUrl,
    sourceListings: [
      {
        sourcePlatform: raw.sourcePlatform,
        sourceUrl: canonicalSourceUrl,
        applyUrl: canonicalApplyUrl,
        externalJobId: raw.externalJobId || null,
        rawSnippet: raw.rawSnippet || null,
        verificationStatus: "VERIFIED",
        seenAt: raw.discoveredAt || new Date(),
        postedAt: (raw as any).postedAt || null,
        postedAgoText: (raw as any).postedAgoText || null,
      },
    ],
    firstSeenAt: raw.discoveredAt || new Date(),
    lastVerifiedAt: raw.discoveredAt || new Date(),
    postedAt: (raw as any).postedAt || null,
    postedAgoText: (raw as any).postedAgoText || null,
    status: "ACTIVE",
  };
}

/**
 * Merges secondary opportunity into primary opportunity non-destructively,
 * preserving the richest description, union of skills, valid salary, and all SourceListings.
 */
function mergeOpportunities(
  primary: DeduplicatedOpportunity,
  secondary: DeduplicatedOpportunity
): DeduplicatedOpportunity {
  // Richer description preservation
  const description =
    secondary.description.length > primary.description.length ? secondary.description : primary.description;

  // Union of skills and requirements
  const skillsSet = new Set([...primary.skills, ...secondary.skills]);
  const reqsSet = new Set([...primary.requirements, ...secondary.requirements]);

  // Salary preservation
  const salaryMin = primary.salaryMin || secondary.salaryMin || null;
  const salaryMax = primary.salaryMax || secondary.salaryMax || null;
  const salaryCurrency = primary.salaryCurrency || secondary.salaryCurrency || "USD";

  // Merge SourceListings without duplicate [sourcePlatform, sourceUrl]
  const mergedListings = [...primary.sourceListings];
  for (const secListing of secondary.sourceListings) {
    const existingIndex = mergedListings.findIndex(
      (l) => l.sourcePlatform === secListing.sourcePlatform && l.sourceUrl === secListing.sourceUrl
    );
    if (existingIndex >= 0) {
      if (secListing.applyUrl && !mergedListings[existingIndex].applyUrl) {
        mergedListings[existingIndex].applyUrl = secListing.applyUrl;
      }
    } else {
      mergedListings.push(secListing);
    }
  }

  return {
    ...primary,
    description,
    skills: Array.from(skillsSet),
    requirements: Array.from(reqsSet),
    salaryMin,
    salaryMax,
    salaryCurrency,
    sourceListings: mergedListings,
    lastVerifiedAt: new Date(),
    postedAt: primary.postedAt || secondary.postedAt || null,
    postedAgoText: primary.postedAgoText || secondary.postedAgoText || null,
  };
}

/**
 * Executes 3-tier deterministic deduplication over an array of raw candidate listings
 */
export function deduplicateCandidates(rawCandidates: RawJobCandidate[]): DeduplicatedOpportunity[] {
  if (!rawCandidates || rawCandidates.length === 0) return [];

  // Convert raw candidates to initial opportunities
  const initialOpps = rawCandidates.map(candidateToOpportunity);

  // ----------------------------------------------------
  // TIER 1: Exact Canonical URL Deduplication
  // ----------------------------------------------------
  const urlMap = new Map<string, DeduplicatedOpportunity>();

  for (const opp of initialOpps) {
    const primaryUrl = opp.sourceListings[0]?.sourceUrl || opp.primaryApplyUrl;
    if (primaryUrl && urlMap.has(primaryUrl)) {
      const existing = urlMap.get(primaryUrl)!;
      urlMap.set(primaryUrl, mergeOpportunities(existing, opp));
    } else {
      urlMap.set(primaryUrl, opp);
    }
  }

  const tier1Opps = Array.from(urlMap.values());

  // ----------------------------------------------------
  // TIER 2: Canonical Opportunity Hash Deduplication
  // ----------------------------------------------------
  const hashMap = new Map<string, DeduplicatedOpportunity>();

  for (const opp of tier1Opps) {
    if (hashMap.has(opp.canonicalHash)) {
      const existing = hashMap.get(opp.canonicalHash)!;
      hashMap.set(opp.canonicalHash, mergeOpportunities(existing, opp));
    } else {
      hashMap.set(opp.canonicalHash, opp);
    }
  }

  const deduplicatedList = Array.from(hashMap.values());

  // ----------------------------------------------------
  // TIER 3: Bounded Fuzzy Similarity Deduplication (similarity >= 0.88)
  // ----------------------------------------------------
  // Group by normalized company to avoid O(N^2) comparison across different companies
  const companyBuckets = new Map<string, DeduplicatedOpportunity[]>();

  for (const opp of deduplicatedList) {
    const normCo = normalizeCompany(opp.companyName);
    const bucket = companyBuckets.get(normCo) || [];
    bucket.push(opp);
    companyBuckets.set(normCo, bucket);
  }

  const finalOpps: DeduplicatedOpportunity[] = [];

  for (const [, bucket] of companyBuckets.entries()) {
    const mergedInBucket: DeduplicatedOpportunity[] = [];

    for (const current of bucket) {
      let merged = false;
      const currentSeniority = extractSeniority(current.title);

      for (let j = 0; j < mergedInBucket.length; j++) {
        const existing = mergedInBucket[j];
        const existingSeniority = extractSeniority(existing.title);

        // Strict Seniority Guard: Never merge different seniorities (e.g. Intern vs Senior)
        if (currentSeniority !== existingSeniority) {
          continue;
        }

        // Calculate string similarity on normalized titles
        const normCurrentTitle = normalizeJobTitle(current.title);
        const normExistingTitle = normalizeJobTitle(existing.title);
        const similarity = calculateStringSimilarity(normCurrentTitle, normExistingTitle);

        if (similarity >= 0.88) {
          mergedInBucket[j] = mergeOpportunities(existing, current);
          merged = true;
          break;
        }
      }

      if (!merged) {
        mergedInBucket.push(current);
      }
    }

    finalOpps.push(...mergedInBucket);
  }

  return finalOpps;
}
