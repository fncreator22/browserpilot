/**
 * §MIDWAY EVIDENCE VERIFIER GATE
 * Executes between tool harvesting and final dossier generation.
 * Performs deterministic HTTP 200 liveness checks, duplicate deduplication,
 * and anti-hallucination filtering for jobs, external URLs, and recruiter contacts.
 */

export interface VerifiableJobCandidate {
  title: string;
  companyName: string;
  applyUrl: string;
  sourceUrl?: string;
  sourcePlatform: string;
  location?: string;
  workMode?: string;
  description?: string;
}

export interface VerifiableRecruiterContact {
  fullName: string;
  roleTitle: string;
  companyName: string;
  profileUrl: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  whatsappUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  contactType?: "RECRUITER" | "EMPLOYEE";
  department?: string;
  sourcePlatform: string;
}

export interface MidwayGateReport<T> {
  verified: T[];
  rejectedCount: number;
  rejectionReasons: string[];
}

export interface UrlAnalysisResult {
  live: boolean;
  status?: number;
  originalUrl: string;
  finalUrl: string;
  isShortLink: boolean;
  isAffiliateTrap: boolean;
  affiliateNetwork?: string;
  portalType: "DIRECT_JOB" | "LEAD_GEN_PORTAL" | "AGGREGATOR_REGISTRATION" | "GENERIC_WEB";
  destinationDomain: string;
  affiliateWarning?: string;
}

export interface TrustScorerInput {
  companyName?: string;
  jobTitle?: string;
  contactEmail?: string;
  applyUrl?: string;
  urlAnalysis?: UrlAnalysisResult;
  rawText?: string;
}

export interface TrustScoreReport {
  trustScore: number; // 0 - 100
  trustTier: "HIGH_TRUST" | "MODERATE_TRUST" | "SUSPICIOUS" | "GHOST_JOB_AFFILIATE";
  isGhostJob: boolean;
  isAffiliateTrap: boolean;
  reasons: string[];
  advisoryTitle: string;
  advisoryMessage: string;
  actionRecommendation: "APPLY_CONFIDENTLY" | "VERIFY_OFFICIAL_PORTAL" | "DO_NOT_REGISTER_AFFILIATE";
}

const SHORT_LINK_DOMAINS = new Set([
  "rb.gy", "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd", "ow.ly", "buff.ly", "rebrand.ly", "lnkd.in"
]);

export function analyzeUrlDestination(url: string, finalUrl: string, status?: number): UrlAnalysisResult {
  let isShort = false;
  try {
    const u = new URL(url);
    isShort = SHORT_LINK_DOMAINS.has(u.hostname.toLowerCase().replace(/^www\./, ""));
  } catch {}

  let destinationDomain = "";
  let path = "";
  let search = "";
  try {
    const dest = new URL(finalUrl);
    destinationDomain = dest.hostname.toLowerCase().replace(/^www\./, "");
    path = dest.pathname.toLowerCase();
    search = dest.search.toLowerCase();
  } catch {
    destinationDomain = url;
  }

  // Detect affiliate markers in query string
  const hasAffiliateParams =
    search.includes("utm_medium=affiliate") ||
    search.includes("utm_source=affiliate") ||
    search.includes("spl=") ||
    search.includes("aff_id=") ||
    search.includes("affiliate_") ||
    (search.includes("utm_campaign=") && search.includes("affiliate"));

  // Detect generic registration/seeker lead-gen paths
  const isRegistrationPath =
    path.includes("/seeker/registration") ||
    path.includes("/register") ||
    path.includes("/signup") ||
    path.includes("/join") ||
    path.includes("/lead");

  const isAggregatorDomain =
    destinationDomain.includes("foundit.in") ||
    destinationDomain.includes("monsterindia.com") ||
    destinationDomain.includes("shine.com") ||
    destinationDomain.includes("timesjobs.com");

  const isAffiliateTrap = hasAffiliateParams || (isRegistrationPath && isAggregatorDomain);

  let portalType: UrlAnalysisResult["portalType"] = "GENERIC_WEB";
  if (isAffiliateTrap) {
    portalType = isAggregatorDomain ? "AGGREGATOR_REGISTRATION" : "LEAD_GEN_PORTAL";
  } else if (path.includes("/jobs/") || path.includes("/careers/") || path.includes("/position/")) {
    portalType = "DIRECT_JOB";
  }

  // Extract affiliate network if mentioned in params e.g. Vigyapanam
  let affiliateNetwork: string | undefined = undefined;
  const matchAff = search.match(/(?:utm_source|spl|aff_id|partner)=([a-zA-Z0-9_-]+)/i);
  if (matchAff && matchAff[1] && matchAff[1].toLowerCase() !== "affiliate") {
    affiliateNetwork = matchAff[1];
  }

  return {
    live: (status ? (status >= 200 && status < 400) || status === 403 || status === 401 || status === 999 : true),
    status,
    originalUrl: url,
    finalUrl,
    isShortLink: isShort,
    isAffiliateTrap,
    affiliateNetwork,
    portalType,
    destinationDomain,
    affiliateWarning: isAffiliateTrap
      ? `Link redirects to ${destinationDomain} registration funnel${affiliateNetwork ? ` via partner '${affiliateNetwork}'` : ""}. This is an aggregator lead funnel, not an employer job post.`
      : undefined,
  };
}

export function computeListingTrustScore(input: TrustScorerInput): TrustScoreReport {
  let score = 100;
  const reasons: string[] = [];

  const comp = (input.companyName || "").toLowerCase().trim();
  const isAnonymousCompany =
    !comp ||
    comp.includes("usa-based") ||
    comp.includes("undisclosed") ||
    comp.includes("confidential") ||
    comp.includes("leading mnc") ||
    comp.includes("reputed company") ||
    comp.includes("stealth startup");

  if (isAnonymousCompany) {
    score -= 40;
    reasons.push("Employer identity is concealed in posting (e.g. 'USA-based company').");
  }

  const email = (input.contactEmail || "").toLowerCase().trim();
  const isPersonalWebmail =
    email.endsWith("@gmail.com") ||
    email.endsWith("@yahoo.com") ||
    email.endsWith("@hotmail.com") ||
    email.endsWith("@outlook.com") ||
    email.endsWith("@rediffmail.com");

  if (isPersonalWebmail) {
    score -= 30;
    reasons.push(`Recruiter contact uses personal webmail (${input.contactEmail}) instead of an official corporate domain.`);
  }

  if (input.urlAnalysis?.isAffiliateTrap) {
    score -= 30;
    reasons.push(input.urlAnalysis.affiliateWarning || "Destination URL is an affiliate referral lead-generation funnel.");
  } else if (input.urlAnalysis?.isShortLink) {
    score -= 20;
    reasons.push(`Application link uses an obfuscated short-link (${input.urlAnalysis.destinationDomain || "URL shortener"}) masking the true destination portal.`);
  }

  score = Math.max(0, Math.min(100, score));

  let trustTier: TrustScoreReport["trustTier"] = "HIGH_TRUST";
  let isGhostJob = false;
  let advisoryTitle = "Verified Employer Posting";
  let advisoryMessage = "This listing matches verified corporate patterns with authentic direct-apply channels.";
  let actionRecommendation: TrustScoreReport["actionRecommendation"] = "APPLY_CONFIDENTLY";

  if (score < 35) {
    trustTier = "GHOST_JOB_AFFILIATE";
    isGhostJob = true;
    advisoryTitle = "High Risk: Third-Party Affiliate / Ghost Job Funnel";
    advisoryMessage = "Warning: This post conceals the employer identity, uses personal webmail, and redirects to a third-party aggregator registration page for affiliate commissions. Do not submit personal data expecting a direct interview.";
    actionRecommendation = "DO_NOT_REGISTER_AFFILIATE";
  } else if (score < 60) {
    trustTier = "SUSPICIOUS";
    isGhostJob = true;
    advisoryTitle = "Suspicious: Unverified Recruitment Intermediary";
    advisoryMessage = "Caution: This posting exhibits unverified agency or lead-gen patterns. Verify the role on the official company career site before applying.";
    actionRecommendation = "VERIFY_OFFICIAL_PORTAL";
  } else if (score < 80) {
    trustTier = "MODERATE_TRUST";
    advisoryTitle = "Moderate Trust: Staffing Partner Listing";
    advisoryMessage = "This opportunity appears to be posted by a third-party recruiter or staffing firm rather than the direct hiring manager.";
    actionRecommendation = "VERIFY_OFFICIAL_PORTAL";
  }

  return {
    trustScore: score,
    trustTier,
    isGhostJob,
    isAffiliateTrap: Boolean(input.urlAnalysis?.isAffiliateTrap),
    reasons,
    advisoryTitle,
    advisoryMessage,
    actionRecommendation,
  };
}

/**
 * Verify URL liveness via lightweight HEAD / GET ping with timeout
 */
export async function checkUrlLiveness(
  url: string,
  timeoutMs: number = 4000
): Promise<{ live: boolean; status?: number; finalUrl?: string; analysis?: UrlAnalysisResult }> {
  if (!url || !url.startsWith("http")) {
    return { live: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Try HEAD first to minimize network overhead
    let response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 BrowserPilot/1.0",
      },
    }).catch(() => null);

    // If HEAD is not allowed (405) or failed, attempt GET with quick abort
    if (!response || response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 BrowserPilot/1.0",
          Range: "bytes=0-1024",
        },
      }).catch(() => null);
    }

    clearTimeout(timeoutId);

    if (!response) {
      return { live: false };
    }

    // 2xx and 3xx are live. 404, 410, 500+ are dead. 401/403/999 (LinkedIn bot wall) are reachable but gated.
    const isLive = response.status >= 200 && response.status < 400;
    const isGated = response.status === 403 || response.status === 401 || response.status === 999;
    const finalUrl = response.url || url;
    const analysis = analyzeUrlDestination(url, finalUrl, response.status);

    return {
      live: isLive || isGated, // Treat bot-gated corporate pages as live to prevent false negatives
      status: response.status,
      finalUrl,
      analysis,
    };
  } catch {
    return { live: false };
  }
}

/**
 * Midway gate for Job Listings: Filters dead links and hallucinated titles
 */
export async function verifyJobCandidatesMidway(
  candidates: VerifiableJobCandidate[],
  options: { checkLiveness?: boolean; maxConcurrent?: number } = {}
): Promise<MidwayGateReport<VerifiableJobCandidate>> {
  const { checkLiveness = true, maxConcurrent = 6 } = options;
  const verified: VerifiableJobCandidate[] = [];
  const rejectionReasons: string[] = [];
  const seenHashes = new Set<string>();

  const processCandidate = async (candidate: VerifiableJobCandidate) => {
    // 1. Basic structural validity
    if (!candidate.title || candidate.title.trim().length < 2) {
      rejectionReasons.push(`Omitted: Missing or invalid job title for "${candidate.companyName}".`);
      return;
    }
    if (!candidate.companyName || candidate.companyName.trim().length < 1) {
      rejectionReasons.push(`Omitted: Missing company name for "${candidate.title}".`);
      return;
    }
    if (!candidate.applyUrl || !candidate.applyUrl.startsWith("http")) {
      rejectionReasons.push(`Omitted: Invalid apply URL for "${candidate.title}" at "${candidate.companyName}".`);
      return;
    }

    // 2. Deduplication check
    const dedupKey = `${candidate.companyName.toLowerCase().trim()}::${candidate.title.toLowerCase().trim()}`;
    if (seenHashes.has(dedupKey)) {
      rejectionReasons.push(`Deduplicated: "${candidate.title}" at "${candidate.companyName}" already present.`);
      return;
    }
    seenHashes.add(dedupKey);

    // 3. HTTP Liveness Check
    if (checkLiveness) {
      const liveness = await checkUrlLiveness(candidate.applyUrl);
      if (!liveness.live) {
        rejectionReasons.push(`Dead Link (HTTP ${liveness.status || 404}): "${candidate.applyUrl}" failed liveness verification.`);
        return;
      }
    }

    verified.push(candidate);
  };

  // Chunk concurrent checks to respect rate limits
  for (let i = 0; i < candidates.length; i += maxConcurrent) {
    const chunk = candidates.slice(i, i + maxConcurrent);
    await Promise.all(chunk.map(processCandidate));
  }

  return {
    verified,
    rejectedCount: candidates.length - verified.length,
    rejectionReasons,
  };
}

/**
 * Midway gate for Recruiter & Company Personnel: Filters hallucinations and dead profiles
 */
export async function verifyRecruiterContactsMidway(
  contacts: VerifiableRecruiterContact[],
  options: { checkLiveness?: boolean } = {}
): Promise<MidwayGateReport<VerifiableRecruiterContact>> {
  const { checkLiveness = true } = options;
  const verified: VerifiableRecruiterContact[] = [];
  const rejectionReasons: string[] = [];
  const seenProfiles = new Set<string>();

  for (const contact of contacts) {
    // 1. Name quality filter: must contain at least first and last name (or @handle for social channels, or valid email)
    const trimmedName = contact.fullName.trim();
    if (!trimmedName || (trimmedName.split(/\s+/).length < 2 && !trimmedName.startsWith("@") && !contact.email)) {
      rejectionReasons.push(`Omitted hallucinated contact name: "${contact.fullName}".`);
      continue;
    }

    // Filter out common bot tokens or placeholders
    const lowerName = trimmedName.toLowerCase();
    if (
      lowerName.includes("recruiter") ||
      lowerName.includes("hiring manager") ||
      lowerName.includes("hr team") ||
      lowerName.includes("talent team") ||
      lowerName.includes("unknown") ||
      lowerName.includes("anonymous")
    ) {
      rejectionReasons.push(`Omitted non-individual contact handle: "${contact.fullName}".`);
      continue;
    }

    // 2. Profile URL check (supports HTTP/HTTPS profile URLs and mailto direct contacts)
    if (!contact.profileUrl || (!contact.profileUrl.startsWith("http") && !contact.profileUrl.startsWith("mailto:"))) {
      rejectionReasons.push(`Omitted contact "${contact.fullName}" due to invalid profile URL.`);
      continue;
    }

    if (seenProfiles.has(contact.profileUrl.toLowerCase())) {
      continue; // Skip duplicate contact
    }
    seenProfiles.add(contact.profileUrl.toLowerCase());

    // 3. Optional Liveness verification
    if (checkLiveness && !contact.profileUrl.includes("linkedin.com/in/")) {
      const liveness = await checkUrlLiveness(contact.profileUrl, 3000);
      if (!liveness.live) {
        rejectionReasons.push(`Dead profile URL for "${contact.fullName}": ${contact.profileUrl}`);
        continue;
      }
    }

    verified.push({
      ...contact,
      fullName: trimmedName,
    });
  }

  return {
    verified,
    rejectedCount: contacts.length - verified.length,
    rejectionReasons,
  };
}
