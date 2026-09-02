/**
 * §EVIDENCE NORMALIZER & PRECEDENCE RESOLUTION ENGINE (TASK-051)
 * 
 * Normalizes multi-source evidence into canonical fields with strict provenance,
 * enforces authoritative precedence:
 * Official ATS / Career > Authenticated Direct > Direct Platform > Aggregator > Snippet > Inference
 * and detects evidence conflicts without fabricating missing values.
 */

import {
  type EvidenceRecord,
  type EvidenceAuthority,
  type NormalizedEvidenceSet,
  type EvidenceFieldResolution,
  type EvidenceConflict,
  type EvidenceType,
  AUTHORITY_PRECEDENCE_WEIGHTS,
} from "./evidenceTypes";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { classifyJobUrl, normalizeCompany, normalizeJobTitle } from "@/lib/scraper/normalizer";

/**
 * Classifies the authority level of a given source URL or platform.
 */
export function classifySourceAuthority(
  url?: string | null,
  platform?: string | null,
  isAuthenticated?: boolean
): EvidenceAuthority {
  if (isAuthenticated) return "AUTHORITATIVE";
  if (!url) return "WEAK";

  const lowerUrl = url.toLowerCase();

  // Official ATS domains are authoritative
  const isAuthoritativeAts = [
    "greenhouse.io",
    "lever.co",
    "ashbyhq.com",
    "myworkdayjobs.com",
    "icims.com",
    "smartrecruiters.com",
    "jobvite.com",
    "workable.com",
    "bamboohr.com",
    "rippling-ats.com",
  ].some((domain) => lowerUrl.includes(domain));

  if (isAuthoritativeAts) return "AUTHORITATIVE";

  // Official company careers root / subdomains
  if (lowerUrl.includes("/careers/") || lowerUrl.includes("/jobs/") || lowerUrl.startsWith("https://careers.") || lowerUrl.startsWith("https://jobs.")) {
    // If not on known aggregators, treat as authoritative direct
    const isAggregator = [
      "indeed.",
      "linkedin.",
      "ziprecruiter.",
      "glassdoor.",
      "monster.",
      "simplyhired.",
      "careerbuilder.",
      "jooble.",
    ].some((agg) => lowerUrl.includes(agg));

    if (!isAggregator) return "AUTHORITATIVE";
  }

  // Established primary job boards with direct listings
  const isStrongBoard = ["linkedin.", "indeed.", "ycombinator.com", "wellfound.com"].some((b) => lowerUrl.includes(b));
  if (isStrongBoard) return "STRONG";

  // Aggregators & Snippets
  const isAggregator = ["google.com/search", "bing.com", "jooble.", "neuvoo."].some((s) => lowerUrl.includes(s));
  if (isAggregator) return "WEAK";

  return "WEAK";
}

/**
 * Normalizes a list of evidence records for a single candidate into a canonical NormalizedEvidenceSet.
 */
export function normalizeCandidateEvidence(
  candidateId: string,
  rawRecords: EvidenceRecord[]
): NormalizedEvidenceSet {
  const records = [...rawRecords];
  const conflicts: EvidenceConflict[] = [];

  // Group records by evidenceType
  const groupedByType = new Map<EvidenceType, EvidenceRecord[]>();
  for (const rec of records) {
    const list = groupedByType.get(rec.evidenceType) || [];
    list.push(rec);
    groupedByType.set(rec.evidenceType, list);
  }

  function resolveField<T>(
    type: EvidenceType,
    transform?: (val: any) => T
  ): EvidenceFieldResolution<T> | undefined {
    const list = groupedByType.get(type);
    if (!list || list.length === 0) return undefined;

    // Sort by authority precedence weight desc, then by timestamp desc
    const sorted = [...list].sort((a, b) => {
      const weightA = AUTHORITY_PRECEDENCE_WEIGHTS[a.authority] ?? 0;
      const weightB = AUTHORITY_PRECEDENCE_WEIGHTS[b.authority] ?? 0;
      if (weightA !== weightB) return weightB - weightA;
      return b.capturedAt.getTime() - a.capturedAt.getTime();
    });

    const primary = sorted[0];
    const resolvedValue = transform ? transform(primary.value) : (primary.value as T);

    // Check for conflicts between authoritative records
    if (sorted.length > 1) {
      for (let i = 1; i < sorted.length; i++) {
        const alt = sorted[i];
        const altVal = transform ? transform(alt.value) : (alt.value as T);

        const valAStr = JSON.stringify(resolvedValue);
        const valBStr = JSON.stringify(altVal);

        if (valAStr !== valBStr) {
          const weightA = AUTHORITY_PRECEDENCE_WEIGHTS[primary.authority];
          const weightAlt = AUTHORITY_PRECEDENCE_WEIGHTS[alt.authority];

          if (weightA === weightAlt && weightA >= AUTHORITY_PRECEDENCE_WEIGHTS.STRONG) {
            // Two high-authority sources disagree!
            conflicts.push({
              field: type,
              sourceA: primary.source,
              authorityA: primary.authority,
              valueA: resolvedValue,
              sourceB: alt.source,
              authorityB: alt.authority,
              valueB: altVal,
              resolution: "UNRESOLVED_NEEDS_MORE_EVIDENCE",
              rationale: `Two authoritative sources (${primary.source} vs ${alt.source}) disagree on [${type}].`,
            });
          } else if (weightA > weightAlt) {
            conflicts.push({
              field: type,
              sourceA: primary.source,
              authorityA: primary.authority,
              valueA: resolvedValue,
              sourceB: alt.source,
              authorityB: alt.authority,
              valueB: altVal,
              resolution: "RESOLVED_BY_AUTHORITY",
              rationale: `Resolved by authority precedence: ${primary.authority} (${primary.source}) overrides ${alt.authority} (${alt.source}).`,
            });
          }
        }
      }
    }

    const alternatives = sorted.slice(1).map((r) => ({
      value: transform ? transform(r.value) : (r.value as T),
      authority: r.authority,
      source: r.source,
    }));

    return {
      value: resolvedValue,
      authority: primary.authority,
      confidence: primary.confidence,
      provenance: primary.provenance,
      isVerified: primary.authority === "AUTHORITATIVE" || primary.authority === "STRONG",
      alternativeValues: alternatives.length > 0 ? alternatives : undefined,
    };
  }

  const title = resolveField<string>("JOB_TITLE", (v) => normalizeJobTitle(String(v || "")));
  const company = resolveField<string>("COMPANY", (v) => normalizeCompany(String(v || "")));
  const location = resolveField<string>("LOCATION", (v) => String(v || "").trim());
  const workMode = resolveField<"REMOTE" | "HYBRID" | "ON_SITE" | "UNSPECIFIED">("WORK_MODE", (v) => {
    const s = String(v || "").toUpperCase();
    if (s.includes("REMOTE")) return "REMOTE";
    if (s.includes("HYBRID")) return "HYBRID";
    if (s.includes("ON_SITE") || s.includes("ONSITE") || s.includes("IN_OFFICE") || s.includes("ON SITE")) return "ON_SITE";
    return "UNSPECIFIED";
  });

  const postedDate = resolveField<Date | null>("POSTED_DATE", (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  });

  const updatedDate = resolveField<Date | null>("UPDATED_DATE", (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  });

  const applyUrl = resolveField<string>("APPLY_URL", (v) => String(v || "").trim());
  const description = resolveField<string>("JOB_DESCRIPTION", (v) => String(v || "").trim());
  const seniority = resolveField<string>("SENIORITY", (v) => String(v || "").trim());
  const atsProvider = resolveField<string>("ATS_PROVIDER", (v) => String(v || "").trim());

  const authoritativeCount = records.filter((r) => r.authority === "AUTHORITATIVE").length;
  const hasAuthoritativeDate = postedDate?.authority === "AUTHORITATIVE";
  const hasDirectApplyUrl = !!applyUrl && classifyJobUrl(applyUrl.value) === "JOB_DETAIL";

  return {
    candidateId,
    records,
    title,
    company,
    location,
    workMode,
    postedDate,
    updatedDate,
    applyUrl,
    description,
    seniority,
    atsProvider,
    conflicts,
    authoritativeCount,
    totalRecordsCount: records.length,
    hasAuthoritativeDate,
    hasDirectApplyUrl,
  };
}

/**
 * Builds an initial set of EvidenceRecords from a standard RawJobCandidate.
 */
export function extractEvidenceFromCandidate(
  candidate: RawJobCandidate,
  userId?: string | null
): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];
  const candId = (candidate as any).id || candidate.externalJobId || candidate.sourceUrl || `cand_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();

  const primaryUrl = candidate.sourceUrl || candidate.applyUrl || "";
  const authority = classifySourceAuthority(primaryUrl, candidate.sourcePlatform);

  const baseProv = {
    sourceUrl: primaryUrl,
    sourcePlatform: candidate.sourcePlatform || "UNKNOWN",
    timestamp: now,
    rawSnippet: candidate.rawSnippet,
  };

  // 1. Title
  if (candidate.title) {
    records.push({
      evidenceId: `ev_title_${candId}`,
      candidateId: candId,
      source: candidate.sourcePlatform || "UNKNOWN",
      sourceType: "DIRECT_PAGE",
      url: primaryUrl,
      evidenceType: "JOB_TITLE",
      extractedField: "title",
      value: candidate.title,
      confidence: authority === "AUTHORITATIVE" ? 0.98 : 0.85,
      authority,
      capturedAt: now,
      extractionMethod: "STRUCTURED_LD_JSON",
      provenance: baseProv,
      userId,
    });
  }

  // 2. Company
  const comp = candidate.companyName || (candidate as any).company;
  if (comp) {
    records.push({
      evidenceId: `ev_comp_${candId}`,
      candidateId: candId,
      source: candidate.sourcePlatform || "UNKNOWN",
      sourceType: "DIRECT_PAGE",
      url: primaryUrl,
      evidenceType: "COMPANY",
      extractedField: "companyName",
      value: comp,
      confidence: authority === "AUTHORITATIVE" ? 0.98 : 0.85,
      authority,
      capturedAt: now,
      extractionMethod: "STRUCTURED_LD_JSON",
      provenance: baseProv,
      userId,
    });
  }

  // 3. Location & WorkMode
  if (candidate.location) {
    records.push({
      evidenceId: `ev_loc_${candId}`,
      candidateId: candId,
      source: candidate.sourcePlatform || "UNKNOWN",
      sourceType: "DIRECT_PAGE",
      url: primaryUrl,
      evidenceType: "LOCATION",
      extractedField: "location",
      value: candidate.location,
      confidence: 0.85,
      authority,
      capturedAt: now,
      extractionMethod: "STRUCTURED_LD_JSON",
      provenance: baseProv,
      userId,
    });
  }

  if (candidate.workMode) {
    records.push({
      evidenceId: `ev_wm_${candId}`,
      candidateId: candId,
      source: candidate.sourcePlatform || "UNKNOWN",
      sourceType: "DIRECT_PAGE",
      url: primaryUrl,
      evidenceType: "WORK_MODE",
      extractedField: "workMode",
      value: candidate.workMode,
      confidence: 0.9,
      authority,
      capturedAt: now,
      extractionMethod: "STRUCTURED_LD_JSON",
      provenance: baseProv,
      userId,
    });
  }

  // 4. Posted Date
  if (candidate.postedAt) {
    records.push({
      evidenceId: `ev_date_${candId}`,
      candidateId: candId,
      source: candidate.sourcePlatform || "UNKNOWN",
      sourceType: "DIRECT_PAGE",
      url: primaryUrl,
      evidenceType: "POSTED_DATE",
      extractedField: "postedAt",
      value: candidate.postedAt,
      confidence: authority === "AUTHORITATIVE" ? 0.95 : 0.8,
      authority,
      capturedAt: now,
      extractionMethod: "STRUCTURED_LD_JSON",
      provenance: baseProv,
      userId,
    });
  }

  // 5. Apply URL
  const appUrl = candidate.applyUrl || candidate.sourceUrl;
  if (appUrl) {
    records.push({
      evidenceId: `ev_url_${candId}`,
      candidateId: candId,
      source: candidate.sourcePlatform || "UNKNOWN",
      sourceType: "DIRECT_PAGE",
      url: appUrl,
      evidenceType: "APPLY_URL",
      extractedField: "applyUrl",
      value: appUrl,
      confidence: 0.95,
      authority,
      capturedAt: now,
      extractionMethod: "STRUCTURED_LD_JSON",
      provenance: baseProv,
      userId,
    });
  }

  // 6. Job Description
  if (candidate.description || candidate.rawSnippet) {
    records.push({
      evidenceId: `ev_desc_${candId}`,
      candidateId: candId,
      source: candidate.sourcePlatform || "UNKNOWN",
      sourceType: "DIRECT_PAGE",
      url: primaryUrl,
      evidenceType: "JOB_DESCRIPTION",
      extractedField: "description",
      value: candidate.description || candidate.rawSnippet,
      confidence: 0.9,
      authority,
      capturedAt: now,
      extractionMethod: "HTML_FALLBACK",
      provenance: baseProv,
      userId,
    });
  }

  return records;
}
