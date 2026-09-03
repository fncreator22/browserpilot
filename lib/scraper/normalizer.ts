/**
 * §DETERMINISTIC NORMALIZER & CANONICAL IDENTITY GENERATOR
 * Provides stable, anti-hallucinatory normalization for Companies, Job Titles, Locations,
 * and URLs with tracking parameter stripping, cryptographic canonical hashing, and legacy backwards-compatibility.
 */

import crypto from "crypto";

export interface NormalizedJobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  workplaceType?: "Remote" | "Hybrid" | "On-site" | "Unspecified";
  requirements: string[];
  description: string;
  applyUrl: string;
  sourcePlatform: string;
  screenshotUrl?: string;
  extractedAt: string;
}

/**
 * Normalizes company names by trimming, lowercasing, stripping punctuation,
 * and removing common legal/corporate entity suffixes without over-collapsing.
 */
export function normalizeCompany(company?: string | null): string {
  if (!company || typeof company !== "string") return "unknown_company";

  let clean = company
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip safe legal and corporate suffixes
  const legalSuffixRegex = /\b(inc|incorporated|llc|ltd|limited|corp|corporation|technologies|technology|tech|labs|software|solutions|pvt|private|gmbh|co)\b/gi;
  clean = clean.replace(legalSuffixRegex, " ").replace(/\s+/g, " ").trim();

  return clean || "unknown_company";
}

/**
 * Normalizes job titles by lowercasing, normalizing separators, and standardizing whitespace
 * while strictly preserving seniority and domain terms (Intern, Junior, Senior, Staff, Lead).
 */
export function normalizeJobTitle(title?: string | null): string {
  if (!title || typeof title !== "string") return "unknown_title";

  let clean = title
    .toLowerCase()
    .replace(/[-|/–—:]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Standardize common variations
  clean = clean
    .replace(/\b(internship|interns)\b/g, "intern")
    .replace(/\b(software development engineer|software dev engineer|sde)\b/g, "software engineer")
    .replace(/\b(ml engineer|machine learning engineer)\b/g, "ai engineer")
    .replace(/\b(full stack developer|fullstack developer|full stack engineer)\b/g, "full stack engineer")
    .replace(/\b(front end developer|frontend developer|front end engineer)\b/g, "frontend engineer")
    .replace(/\b(back end developer|backend developer|back end engineer)\b/g, "backend engineer")
    .replace(/\b(mechanical engineering)\b/g, "mechanical engineer")
    .replace(/\b(electrical engineering)\b/g, "electrical engineer")
    .replace(/\b(civil engineering)\b/g, "civil engineer")
    .replace(/\b(chemical engineering)\b/g, "chemical engineer")
    .replace(/\s+/g, " ")
    .trim();

  return clean || "unknown_title";
}

/**
 * Normalizes locations while preserving meaningful distinctions (Remote vs City vs Country).
 */
export function normalizeLocation(location?: string | null): string {
  if (!location || typeof location !== "string") return "Remote / Unspecified";

  let clean = location
    .replace(/[^\w\s,.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/\b(remote|work from home|wfh|anywhere|telecommute)\b/i.test(clean)) {
    return "Remote";
  }

  return clean || "Remote / Unspecified";
}

/**
 * Safe URL Canonicalization:
 * - Lowercases protocol and hostname
 * - Removes non-essential tracking parameters (utm_*, refId, trackingId, fbclid, gclid, trk)
 * - Preserves essential query params (id, jk, jobId, view)
 * - Strips trailing slashes
 */
export function canonicalizeUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove tracking query parameters
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "refid",
      "trackingid",
      "fbclid",
      "gclid",
      "trk",
      "ref",
      "ref_id",
      "source",
    ];

    const keysToRemove: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      if (trackingParams.includes(lowerKey) || lowerKey.startsWith("utm_")) {
        keysToRemove.push(key);
      }
    });

    for (const key of keysToRemove) {
      parsed.searchParams.delete(key);
    }

    // Strip trailing slash on path if path has length > 1
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;

    // Sort query parameters deterministically
    parsed.searchParams.sort();

    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export type JobUrlType =
  | "JOB_DETAIL"
  | "COMPANY_CAREER_ROOT"
  | "ATS_COMPANY_ROOT"
  | "SEARCH_RESULTS"
  | "SOURCE_HOME"
  | "UNKNOWN";

/**
 * Classifies a URL deterministically to distinguish exact job postings from
 * generic career roots, search results, and homepages.
 */
export function classifyJobUrl(rawUrl?: string | null): JobUrlType {
  if (!rawUrl || typeof rawUrl !== "string") return "UNKNOWN";
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);

    // Root domain without path
    if (segments.length === 0) {
      return "SOURCE_HOME";
    }

    // Search results pages
    if (
      path.includes("/search") ||
      parsed.searchParams.has("q") ||
      parsed.searchParams.has("keywords") ||
      parsed.searchParams.has("query") ||
      (host.includes("indeed") && path === "/jobs")
    ) {
      return "SEARCH_RESULTS";
    }

    // ATS Platforms (Greenhouse, Lever, Ashby, Workable)
    if (host.includes("greenhouse.io") || host.includes("lever.co") || host.includes("ashbyhq.com") || host.includes("workable.com")) {
      if (segments.length <= 1) {
        return "ATS_COMPANY_ROOT";
      }
      return "JOB_DETAIL";
    }

    // Major job boards with specific job view paths
    if (host.includes("linkedin.com")) {
      if (path.includes("/jobs/view") || path.includes("/jobs/collections")) return "JOB_DETAIL";
      if (segments.length >= 2 && segments[0] === "jobs" && !["search", "search-results"].includes(segments[1])) {
        return "JOB_DETAIL";
      }
      if (path.includes("/jobs")) return "SEARCH_RESULTS";
      return "SOURCE_HOME";
    }

    if (host.includes("indeed.com")) {
      if (path.includes("/viewjob") || parsed.searchParams.has("jk")) return "JOB_DETAIL";
      if (segments.length >= 2 && segments[0] === "jobs" && !["search"].includes(segments[1])) {
        return "JOB_DETAIL";
      }
      return "SEARCH_RESULTS";
    }

    if (host.includes("workatastartup.com") || host.includes("ycombinator.com")) {
      if (path.includes("/jobs/") && segments.length >= 2) return "JOB_DETAIL";
      if (path.includes("/jobs")) return "COMPANY_CAREER_ROOT";
    }

    // Generic company portals: single segment like /careers, /jobs, /join-us, /openings
    if (segments.length === 1 && /^(careers?|jobs?|join-us|work-with-us|openings?|opportunities|positions)$/i.test(segments[0])) {
      return "COMPANY_CAREER_ROOT";
    }

    // Direct employer career detail pages (e.g. /careers/software-engineer-123, /jobs/456, /openings/backend, /positions/101)
    if (segments.length >= 2 && /^(careers?|jobs?|openings?|opportunities?|positions?|role|roles)$/i.test(segments[0])) {
      return "JOB_DETAIL";
    }

    // Single-segment specific job slug if it has a hyphenated role name or job ID (e.g., /job-backend-engineer-123)
    if (segments.length === 1 && segments[0].includes("-") && !/^(careers?|jobs?|join-us)$/i.test(segments[0])) {
      return "JOB_DETAIL";
    }

    return segments.length >= 2 ? "JOB_DETAIL" : "COMPANY_CAREER_ROOT";
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Detects whether a URL points merely to a generic company career homepage/portal root
 * rather than a specific individual job posting detail page.
 */
export function isGenericCareerHomepage(rawUrl?: string | null): boolean {
  const classification = classifyJobUrl(rawUrl);
  return classification === "COMPANY_CAREER_ROOT" || classification === "ATS_COMPANY_ROOT" || classification === "SOURCE_HOME";
}

/**
 * Generates a deterministic cryptographic canonical hash for an Opportunity:
 * canonicalHash = md5(normalizeCompany(company) + "_" + normalizeJobTitle(title))
 */
export function generateCanonicalHash(company: string, title: string): string {
  const normCompany = normalizeCompany(company);
  const normTitle = normalizeJobTitle(title);
  const composite = `${normCompany}_${normTitle}`;
  return crypto.createHash("md5").update(composite).digest("hex");
}

/**
 * Bounded Deterministic String Similarity (Dice Coefficient on word bigrams)
 * Returns a score between 0.0 and 1.0.
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0.0;
  const s1 = str1.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const s2 = str2.toLowerCase().replace(/[^\w\s]/g, "").trim();
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);

  let intersection = 0;
  for (const item of b1) {
    if (b2.has(item)) {
      intersection++;
    }
  }

  return (2.0 * intersection) / (b1.size + b2.size);
}

/**
 * Legacy Helper: Deduplicates repetitive lines and repeated sentences in text
 */
export function deduplicateTextLines(rawText: string): string {
  if (!rawText) return "";

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const seenLines = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (normalized.length < 3) continue;

    if (!seenLines.has(normalized)) {
      seenLines.add(normalized);
      uniqueLines.push(line);
    }
  }

  return uniqueLines.join("\n");
}

/**
 * Legacy Helper: Generates fingerprint for legacy scraper
 */
export function getJobFingerprint(title: string, company: string, location?: string): string {
  const cleanTitle = (title || "").toLowerCase().replace(/[^\w]/g, "");
  const cleanCompany = (company || "").toLowerCase().replace(/[^\w]/g, "");
  const cleanLoc = (location || "").toLowerCase().replace(/[^\w]/g, "").slice(0, 10);
  return `${cleanCompany}_${cleanTitle}_${cleanLoc}`;
}

/**
 * Legacy Helper: Normalizes and deduplicates raw extracted job objects for UI
 */
export function normalizeAndDeduplicateJobs(
  rawJobs: Array<Record<string, unknown>>,
  defaultPlatform = "Web"
): NormalizedJobItem[] {
  const seenFingerprints = new Set<string>();
  const normalizedList: NormalizedJobItem[] = [];

  for (let i = 0; i < rawJobs.length; i++) {
    const raw = rawJobs[i];

    const title = String(raw.title || raw.role || raw.position || `Job Posting #${i + 1}`).trim();
    const company = String(raw.company || raw.companyName || raw.organization || "Company").trim();
    const location = String(raw.location || raw.city || "Remote / Unspecified").trim();

    const fingerprint = getJobFingerprint(title, company, location);
    if (seenFingerprints.has(fingerprint)) {
      continue;
    }
    seenFingerprints.add(fingerprint);

    const salary = raw.salary || raw.compensation || raw.pay ? String(raw.salary || raw.compensation || raw.pay).trim() : undefined;

    const locLower = `${location} ${raw.description || ""}`.toLowerCase();
    let workplaceType: NormalizedJobItem["workplaceType"] = "Unspecified";
    if (locLower.includes("remote") || locLower.includes("work from home")) workplaceType = "Remote";
    else if (locLower.includes("hybrid")) workplaceType = "Hybrid";
    else if (locLower.includes("on-site") || locLower.includes("onsite")) workplaceType = "On-site";

    let requirements: string[] = [];
    if (Array.isArray(raw.requirements)) {
      requirements = raw.requirements.map(String).map((r) => r.trim()).filter(Boolean).slice(0, 5);
    } else if (typeof raw.requirements === "string") {
      requirements = raw.requirements
        .split(/[;\n•·-]/)
        .map((r) => r.trim())
        .filter((r) => r.length > 5)
        .slice(0, 5);
    } else if (raw.description) {
      requirements = String(raw.description)
        .split(/[.\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15)
        .slice(0, 4);
    }

    let applyUrl = String(raw.applyUrl || raw.url || raw.link || raw.sourceUrl || "").trim();
    if (!applyUrl.startsWith("http://") && !applyUrl.startsWith("https://")) {
      applyUrl = `https://www.google.com/search?q=${encodeURIComponent(`${company} ${title} apply`)}`;
    }

    const sourcePlatform = String(raw.sourcePlatform || raw.source || defaultPlatform);

    normalizedList.push({
      id: `job_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      company,
      location,
      salary,
      workplaceType,
      requirements,
      description: deduplicateTextLines(String(raw.description || "")).slice(0, 600),
      applyUrl,
      sourcePlatform,
      screenshotUrl: raw.screenshotUrl ? String(raw.screenshotUrl) : undefined,
      extractedAt: new Date().toISOString(),
    });
  }

  return normalizedList;
}
