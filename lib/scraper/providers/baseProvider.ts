/**
 * §SEARCH PROVIDER INTERFACE & CANDIDATE DATA CONTRACT
 * Defines the pluggable provider contract, candidate data model, and SSRF/sanitization guards.
 */

export interface DateConstraint {
  type: "RELATIVE" | "EXACT";
  amount: number;
  unit: "HOUR" | "DAY" | "WEEK" | "MONTH";
  cutoffDate: Date;
  rawText?: string;
}

export interface SearchIntent {
  role?: string;
  roles?: string[];
  skills?: string[];
  location?: string;
  locations?: string[];
  company?: string;
  companies?: string[];
  workMode?: "REMOTE" | "HYBRID" | "ON_SITE" | "ANY" | string;
  workModes?: string[];
  experienceLevel?: "INTERN" | "ENTRY_LEVEL" | "MID" | "SENIOR" | string;
  experienceLevels?: string[];
  opportunityType?: "INTERNSHIP" | "FULL_TIME" | "CONTRACT" | string;
  opportunityTypes?: string[];
  targetGradYear?: number;
  companyType?: "STARTUP" | "ENTERPRISE" | "ANY" | string;
  queryHint?: string;
  sortMode?: "RELEVANCE" | "LATEST" | "RELEVANCE_THEN_FRESHNESS";
  freshnessWindowHours?: number;
  postedWithinDays?: number;
  dateConstraint?: DateConstraint;
  requestedCount?: number;
  isExplicitFreshness?: boolean;
  minimumMatchScore?: number;
  sources?: string[];
  excludeKnown?: boolean;
  watchIntent?: {
    enabled: boolean;
    scanIntervalHours?: number;
  };
}

export interface RawJobCandidate {
  sourcePlatform: string;
  sourceUrl: string;
  applyUrl: string;
  externalJobId?: string;
  title: string;
  companyName: string;
  location?: string;
  workMode?: string;
  experienceLevel?: string;
  opportunityType?: string;
  salaryText?: string;
  description?: string;
  rawSnippet?: string;
  discoveredAt: Date;
  postedAt?: Date | null;
  postedAgoText?: string | null;
}

export interface ProviderLimits {
  maxCandidates: number;
  timeoutMs: number;
  maxContentBytes?: number;
}

export interface ProviderTelemetry {
  provider: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "TIMEOUT" | "SKIPPED";
  candidatesFound: number;
  durationMs: number;
  error?: string;
}

export interface ProviderContext {
  customFetch?: typeof fetch;
  signal?: AbortSignal;
}

export interface SearchProvider {
  readonly name: string;
  supports(intent: SearchIntent): boolean;
  harvestCandidates(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: ProviderContext
  ): Promise<RawJobCandidate[]>;
}

/**
 * SSRF Guard: Validates that a target URL is an allowed public HTTP(S) URL
 * and not a private network range, localhost, or cloud metadata endpoint.
 */
export function isSafePublicUrl(targetUrl: string, allowLocalForTests = false): boolean {
  if (!targetUrl || typeof targetUrl !== "string") return false;
  try {
    const parsed = new URL(targetUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();

    // Allow local test server strictly when allowLocalForTests is explicitly enabled
    if (allowLocalForTests && (host === "localhost" || host === "127.0.0.1")) {
      return true;
    }

    // Block localhost, link-local, private subnets, and AWS/GCP metadata
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host === "169.254.169.254" || // AWS / Azure metadata
      host === "metadata.google.internal" ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return false;
    }

    // Check private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    const ipParts = host.split(".").map((p) => parseInt(p, 10));
    if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      if (ipParts[0] === 10) return false;
      if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return false;
      if (ipParts[0] === 192 && ipParts[1] === 168) return false;
      if (ipParts[0] === 169 && ipParts[1] === 254) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes, strips executable script blocks and HTML tags, and bounds text snippets
 */
export function sanitizeSnippet(text?: string | null, maxLen = 1000): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}
