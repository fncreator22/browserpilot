/**
 * §CANONICAL STRUCTURED OPPORTUNITY EXTRACTION CONTRACT & VALIDATOR
 * Defines the core upstream contract between discovery/scrapers/executors and
 * normalization/deduplication/persistence layers.
 * 
 * Provides deterministic validation without LLMs or external network dependencies.
 */

import { 
  normalizeCompany, 
  normalizeJobTitle, 
  normalizeLocation, 
  canonicalizeUrl,
  generateCanonicalHash 
} from "./normalizer";
import { isSafePublicUrl } from "./providers/baseProvider";

export type ExtractionStatus = "VALID" | "PARTIAL" | "REJECTED";

/**
 * The canonical upstream extraction contract representing an opportunity
 * prior to database persistence and ranking.
 */
export interface OpportunityExtraction {
  title: string;
  company: string;
  companyName?: string;
  sourceUrl: string;
  applyUrl?: string;
  sourcePlatform?: string;
  externalJobId?: string | null;
  location?: string;
  workMode?: "REMOTE" | "HYBRID" | "ON_SITE" | "ANY" | string;
  experienceLevel?: "INTERN" | "ENTRY_LEVEL" | "MID" | string;
  opportunityType?: "INTERNSHIP" | "FULL_TIME" | "CONTRACT" | string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  skills?: string[];
  rawSnippet?: string | null;
  screenshotPath?: string | null;
  matchScore?: number;
  extractedAt?: Date | string;
  postedAt?: Date | string | null;
  postedAgoText?: string | null;
}

export interface ValidationResult {
  status: ExtractionStatus;
  reasons: string[];
  cleaned?: OpportunityExtraction;
}

export interface BatchValidationResult {
  valid: OpportunityExtraction[];
  partial: OpportunityExtraction[];
  rejected: Array<{ item: unknown; reasons: string[] }>;
  telemetry: {
    total: number;
    validCount: number;
    partialCount: number;
    rejectedCount: number;
  };
}

/**
 * Obvious navigation boilerplate, UI junk, and placeholder titles to reject.
 */
const INVALID_TITLE_PATTERNS = [
  /^click here\b/i,
  /\bclick here to\b/i,
  /^search results?$/i,
  /^jobs?$/i,
  /^all jobs?$/i,
  /\bview all jobs\b/i,
  /\bsee all jobs\b/i,
  /^careers?$/i,
  /^home(?:page)?$/i,
  /^sign\s*in$/i,
  /^log\s*in$/i,
  /^apply(?: now)?$/i,
  /^loading(?:\.\.\.)?$/i,
  /^untitled$/i,
  /^unknown(?: job)?$/i,
  /^n\/?a$/i,
  /^404\b/i,
  /^error\b/i,
  /^view details$/i,
  /^read more$/i,
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
  /^confidential$/i,
];

/**
 * Filter out navigation boilerplate strings from requirements/skills arrays.
 */
const BOILERPLATE_ARRAY_ITEMS = new Set([
  "home",
  "apply",
  "apply now",
  "share",
  "save",
  "back",
  "next",
  "previous",
  "sign in",
  "log in",
  "loading",
  "terms",
  "privacy",
  "about us",
  "contact",
]);

/**
 * Sanitizes and deduplicates a string array, discarding boilerplate and empty items.
 */
export function sanitizeStringArray(rawItems?: unknown): string[] {
  if (!rawItems) return [];
  
  let items: string[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems.map(String);
  } else if (typeof rawItems === "string") {
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) items = parsed.map(String);
      else items = rawItems.split(/[\n,]+/).map((s) => s.trim());
    } catch {
      items = rawItems.split(/[\n,]+/).map((s) => s.trim());
    }
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const it of items) {
    const trimmed = it.trim().replace(/^[-•*]\s*/, "");
    const lower = trimmed.toLowerCase();

    if (trimmed.length < 2 || trimmed.length > 300) continue;
    if (BOILERPLATE_ARRAY_ITEMS.has(lower)) continue;
    if (/^(location|salary|apply|company):/i.test(lower)) continue;

    if (!seen.has(lower)) {
      seen.add(lower);
      sanitized.push(trimmed);
    }
  }

  return sanitized;
}

/**
 * Validates a single opportunity extraction against the canonical contract.
 */
export function validateOpportunityExtraction(
  raw: unknown,
  options: { allowLocalForTests?: boolean } = {}
): ValidationResult {
  const reasons: string[] = [];

  if (!raw || typeof raw !== "object") {
    return {
      status: "REJECTED",
      reasons: ["Input is not an object or is null"],
    };
  }

  const item = raw as Record<string, unknown>;

  // 1. Validate Title
  const rawTitle = String(item.title || item.role || item.position || "").trim();
  if (!rawTitle || rawTitle.length < 2) {
    reasons.push("Missing or too short title");
  } else if (INVALID_TITLE_PATTERNS.some((p) => p.test(rawTitle))) {
    reasons.push(`Title matches rejected boilerplate pattern: "${rawTitle}"`);
  }

  // 2. Validate Company
  const rawCompany = String(item.company || item.companyName || item.organization || "").trim();
  if (!rawCompany || rawCompany.length < 1) {
    reasons.push("Missing company name");
  } else if (INVALID_COMPANY_PATTERNS.some((p) => p.test(rawCompany))) {
    reasons.push(`Company matches rejected placeholder pattern: "${rawCompany}"`);
  }

  // 3. Validate Source/Apply URL
  const rawSourceUrl = String(item.sourceUrl || item.applyUrl || item.primaryApplyUrl || item.url || "").trim();
  let canonicalSource = "";
  if (!rawSourceUrl) {
    reasons.push("Missing source URL or apply URL");
  } else {
    canonicalSource = canonicalizeUrl(rawSourceUrl);
    if (!canonicalSource.startsWith("http://") && !canonicalSource.startsWith("https://")) {
      reasons.push(`Malformed URL protocol in sourceUrl: "${rawSourceUrl}"`);
    } else if (!isSafePublicUrl(canonicalSource, options.allowLocalForTests)) {
      reasons.push(`URL failed SSRF safety check: "${rawSourceUrl}"`);
    }
  }

  // If any fatal identity errors exist, REJECT
  if (reasons.length > 0) {
    return {
      status: "REJECTED",
      reasons,
    };
  }

  // 4. Clean Optional Apply URL
  const rawApplyUrl = String(item.applyUrl || item.primaryApplyUrl || item.sourceUrl || "").trim();
  let canonicalApply = canonicalSource;
  if (rawApplyUrl && rawApplyUrl !== rawSourceUrl) {
    const cleanedApply = canonicalizeUrl(rawApplyUrl);
    if (isSafePublicUrl(cleanedApply, options.allowLocalForTests)) {
      canonicalApply = cleanedApply;
    }
  }

  // 5. Clean Salary (never fabricate)
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  if (typeof item.salaryMin === "number" && !isNaN(item.salaryMin) && item.salaryMin > 0) {
    salaryMin = Math.round(item.salaryMin);
  }
  if (typeof item.salaryMax === "number" && !isNaN(item.salaryMax) && item.salaryMax > 0) {
    salaryMax = Math.round(item.salaryMax);
  }

  // 6. Clean Arrays
  const requirements = sanitizeStringArray(item.requirements);
  const responsibilities = sanitizeStringArray(item.responsibilities);
  const skills = sanitizeStringArray(item.skills);

  // 7. Clean Description
  const description = typeof item.description === "string" ? item.description.trim() : "";

  // 8. Clean Location
  const location = typeof item.location === "string" && item.location.trim().length > 0
    ? normalizeLocation(item.location)
    : undefined;

  // 9. Clean Work Mode
  let workMode: string | undefined = undefined;
  if (typeof item.workMode === "string") {
    const wm = item.workMode.toUpperCase();
    if (["REMOTE", "HYBRID", "ON_SITE", "ANY"].includes(wm)) {
      workMode = wm;
    }
  }

  const cleanedExtraction: OpportunityExtraction = {
    title: rawTitle,
    company: rawCompany,
    companyName: rawCompany,
    sourceUrl: canonicalSource,
    applyUrl: canonicalApply,
    sourcePlatform: typeof item.sourcePlatform === "string" ? item.sourcePlatform : "Web",
    externalJobId: typeof item.externalJobId === "string" ? item.externalJobId : null,
    location,
    workMode,
    experienceLevel: typeof item.experienceLevel === "string" ? item.experienceLevel : undefined,
    opportunityType: typeof item.opportunityType === "string" ? item.opportunityType : undefined,
    salaryMin,
    salaryMax,
    salaryCurrency: typeof item.salaryCurrency === "string" ? item.salaryCurrency : "USD",
    description,
    requirements,
    responsibilities,
    skills,
    rawSnippet: typeof item.rawSnippet === "string" ? item.rawSnippet : null,
    screenshotPath: typeof item.screenshotPath === "string" ? item.screenshotPath : null,
    matchScore: typeof item.matchScore === "number" ? item.matchScore : undefined,
    extractedAt: item.extractedAt ? new Date(String(item.extractedAt)) : new Date(),
    postedAt: item.postedAt ? new Date(String(item.postedAt)) : null,
    postedAgoText: typeof item.postedAgoText === "string" ? item.postedAgoText : null,
  };

  // Determine VALID vs PARTIAL
  const isPartial = !location || (!salaryMin && !salaryMax) || (!description && requirements.length === 0);
  const status: ExtractionStatus = isPartial ? "PARTIAL" : "VALID";

  return {
    status,
    reasons: isPartial ? ["Some optional fields (location, salary, or description) are missing"] : [],
    cleaned: cleanedExtraction,
  };
}

/**
 * Validates a batch of raw extractions deterministically.
 */
export function validateAndNormalizeExtractionBatch(
  rawItems: unknown[],
  options: { allowLocalForTests?: boolean } = {}
): BatchValidationResult {
  const valid: OpportunityExtraction[] = [];
  const partial: OpportunityExtraction[] = [];
  const rejected: Array<{ item: unknown; reasons: string[] }> = [];

  if (!Array.isArray(rawItems)) {
    return {
      valid,
      partial,
      rejected: [{ item: rawItems, reasons: ["Batch input is not an array"] }],
      telemetry: { total: 0, validCount: 0, partialCount: 0, rejectedCount: 1 },
    };
  }

  for (const raw of rawItems) {
    const res = validateOpportunityExtraction(raw, options);
    if (res.status === "VALID" && res.cleaned) {
      valid.push(res.cleaned);
    } else if (res.status === "PARTIAL" && res.cleaned) {
      partial.push(res.cleaned);
    } else {
      rejected.push({ item: raw, reasons: res.reasons });
    }
  }

  return {
    valid,
    partial,
    rejected,
    telemetry: {
      total: rawItems.length,
      validCount: valid.length,
      partialCount: partial.length,
      rejectedCount: rejected.length,
    },
  };
}
