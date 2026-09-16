/**
 * §COMPANY INTELLIGENCE & ATS RESOLUTION SERVICE (TASK-038 & TASK-039)
 * 
 * Maps companies to official career portals, ATS providers (Greenhouse, Ashby, Lever, Workable),
 * tracks per-source crawl freshness, and maintains anonymized platform-level source signals.
 */

import { prisma } from "@/lib/db/prisma";
import { normalizeCompany } from "@/lib/scraper/normalizer";

export type KnownAtsProvider = "GREENHOUSE" | "ASHBY" | "LEVER" | "WORKABLE" | "CUSTOM";

export interface CompanyIntelligenceRecord {
  id?: string;
  companyName: string;
  normalizedName: string;
  officialCareerUrl?: string | null;
  officialDomain?: string | null;
  employeeHeadcountBracket?: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1001-5000" | "5000+" | string;
  headquarters?: string | null;
  employerType?: "VERIFIED_CORPORATE" | "STAFFING_AGENCY" | "UNDISCLOSED_EMPLOYER";
  isUndisclosed?: boolean;
  atsProvider?: KnownAtsProvider | string | null;
  atsUrl?: string | null;
  knownSources: string[];
  sourceFreshness: Record<string, string>; // { "linkedin": ISO, "greenhouse": ISO }
  lastDiscoveredAt?: Date | null;
  lastCrawlAt?: Date | null;
  freshnessScore: number;
  reliabilityScore: number;
}

const KNOWN_COMPANY_PROFILES: Record<string, { domain: string; headcount: string; hq: string; atsProvider?: KnownAtsProvider; atsUrl?: string }> = {
  "hcltech": { domain: "hcltech.com", headcount: "220,000+ employees", hq: "Noida, India", atsProvider: "CUSTOM", atsUrl: "https://www.hcltech.com/careers" },
  "hcl": { domain: "hcltech.com", headcount: "220,000+ employees", hq: "Noida, India", atsProvider: "CUSTOM", atsUrl: "https://www.hcltech.com/careers" },
  "stripe": { domain: "stripe.com", headcount: "7,000+ employees", hq: "San Francisco, CA", atsProvider: "CUSTOM", atsUrl: "https://stripe.com/jobs" },
  "google": { domain: "google.com", headcount: "180,000+ employees", hq: "Mountain View, CA", atsProvider: "CUSTOM", atsUrl: "https://careers.google.com" },
  "microsoft": { domain: "microsoft.com", headcount: "220,000+ employees", hq: "Redmond, WA", atsProvider: "CUSTOM", atsUrl: "https://careers.microsoft.com" },
  "amazon": { domain: "amazon.com", headcount: "1,500,000+ employees", hq: "Seattle, WA", atsProvider: "CUSTOM", atsUrl: "https://amazon.jobs" },
  "meta": { domain: "meta.com", headcount: "67,000+ employees", hq: "Menlo Park, CA", atsProvider: "CUSTOM", atsUrl: "https://metacareers.com" },
  "apple": { domain: "apple.com", headcount: "160,000+ employees", hq: "Cupertino, CA", atsProvider: "CUSTOM", atsUrl: "https://apple.com/careers" },
  "netflix": { domain: "netflix.com", headcount: "13,000+ employees", hq: "Los Gatos, CA", atsProvider: "CUSTOM", atsUrl: "https://jobs.netflix.com" },
  "tcs": { domain: "tcs.com", headcount: "600,000+ employees", hq: "Mumbai, India", atsProvider: "CUSTOM", atsUrl: "https://tcs.com/careers" },
  "infosys": { domain: "infosys.com", headcount: "320,000+ employees", hq: "Bengaluru, India", atsProvider: "CUSTOM", atsUrl: "https://infosys.com/careers" },
  "wipro": { domain: "wipro.com", headcount: "240,000+ employees", hq: "Bengaluru, India", atsProvider: "CUSTOM", atsUrl: "https://wipro.com/careers" },
  "uber": { domain: "uber.com", headcount: "32,000+ employees", hq: "San Francisco, CA", atsProvider: "CUSTOM", atsUrl: "https://uber.com/careers" },
  "airbnb": { domain: "airbnb.com", headcount: "6,800+ employees", hq: "San Francisco, CA", atsProvider: "CUSTOM", atsUrl: "https://airbnb.com/careers" },
  "palantir": { domain: "palantir.com", headcount: "3,800+ employees", hq: "Denver, CO", atsProvider: "LEVER", atsUrl: "https://jobs.lever.co/palantir" },
  "databricks": { domain: "databricks.com", headcount: "7,000+ employees", hq: "San Francisco, CA", atsProvider: "GREENHOUSE", atsUrl: "https://boards.greenhouse.io/databricks" },
  "snowflake": { domain: "snowflake.com", headcount: "7,500+ employees", hq: "Bozeman, MT", atsProvider: "WORKABLE", atsUrl: "https://careers.snowflake.com" },
};

export function detectAtsProvider(url: string): { provider: KnownAtsProvider; atsSlug?: string } | null {
  if (!url) return null;
  const lower = url.toLowerCase();

  if (lower.includes("greenhouse.io")) {
    const match = url.match(/greenhouse\.io\/(?:embed\/job_board\/)?([a-zA-Z0-9_-]+)/i);
    return { provider: "GREENHOUSE", atsSlug: match ? match[1] : undefined };
  }
  if (lower.includes("ashbyhq.com")) {
    const match = url.match(/ashbyhq\.com\/([a-zA-Z0-9_-]+)/i);
    return { provider: "ASHBY", atsSlug: match ? match[1] : undefined };
  }
  if (lower.includes("lever.co")) {
    const match = url.match(/lever\.co\/([a-zA-Z0-9_-]+)/i);
    return { provider: "LEVER", atsSlug: match ? match[1] : undefined };
  }
  if (lower.includes("workable.com")) {
    const match = url.match(/workable\.com\/([a-zA-Z0-9_-]+)/i);
    return { provider: "WORKABLE", atsSlug: match ? match[1] : undefined };
  }

  return { provider: "CUSTOM" };
}

export async function getCompanyIntelligence(companyName: string): Promise<CompanyIntelligenceRecord | null> {
  const norm = normalizeCompany(companyName).toLowerCase();
  const rawLower = (companyName || "").toLowerCase();

  // Check for undisclosed/anonymous employer indicator
  if (
    rawLower.includes("usa-based") || 
    rawLower.includes("usa based") || 
    norm.includes("usa based") || 
    norm.includes("undisclosed") || 
    norm.includes("confidential") || 
    norm.includes("leading mnc") || 
    norm.includes("reputed company") ||
    norm === "unknown_company"
  ) {
    return {
      companyName,
      normalizedName: norm,
      isUndisclosed: true,
      employerType: "UNDISCLOSED_EMPLOYER",
      employeeHeadcountBracket: "Undisclosed",
      headquarters: "Undisclosed",
      officialCareerUrl: null,
      officialDomain: null,
      atsProvider: "CUSTOM",
      atsUrl: null,
      knownSources: [],
      sourceFreshness: {},
      freshnessScore: 0.1,
      reliabilityScore: 0.1,
    };
  }

  const profile = KNOWN_COMPANY_PROFILES[norm];

  const record = await prisma.companyIntelligence.findUnique({
    where: { normalizedName: norm },
  });

  if (!record && !profile) return null;

  let sourceFreshness: Record<string, string> = {};
  let knownSourcesList: string[] = [];
  if (record) {
    try {
      const parsed = JSON.parse(record.knownSources || "[]");
      if (Array.isArray(parsed)) {
        knownSourcesList = parsed;
        for (const s of parsed) {
          sourceFreshness[s.toLowerCase()] = record.lastCrawlAt ? record.lastCrawlAt.toISOString() : new Date().toISOString();
        }
      } else if (typeof parsed === "object" && parsed !== null) {
        sourceFreshness = parsed as Record<string, string>;
        knownSourcesList = Object.keys(parsed).map((k) => {
          if (k.toLowerCase() === "greenhouse") return "Greenhouse";
          if (k.toLowerCase() === "ashby") return "Ashby";
          if (k.toLowerCase() === "lever") return "Lever";
          if (k.toLowerCase() === "workable") return "Workable";
          if (k.toLowerCase() === "linkedin") return "LinkedIn";
          if (k.toLowerCase() === "indeed") return "Indeed";
          if (k.toLowerCase() === "y combinator") return "Y Combinator";
          if (k.toLowerCase() === "hacker news") return "Hacker News";
          if (k.toLowerCase() === "github curated") return "GitHub Curated";
          return k;
        });
      }
    } catch {}
  }

  return {
    id: record?.id,
    companyName: record?.companyName || companyName,
    normalizedName: norm,
    officialCareerUrl: record?.officialCareerUrl || profile?.atsUrl || null,
    officialDomain: profile?.domain || null,
    employeeHeadcountBracket: profile?.headcount || "Corporate Enterprise",
    headquarters: profile?.hq || null,
    employerType: "VERIFIED_CORPORATE",
    isUndisclosed: false,
    atsProvider: (record?.atsProvider as KnownAtsProvider) || profile?.atsProvider || "CUSTOM",
    atsUrl: record?.atsUrl || profile?.atsUrl || null,
    knownSources: knownSourcesList.length > 0 ? knownSourcesList : ["Direct ATS", "LinkedIn"],
    sourceFreshness,
    lastDiscoveredAt: record?.lastDiscoveredAt,
    lastCrawlAt: record?.lastCrawlAt,
    freshnessScore: record?.freshnessScore ?? 1.0,
    reliabilityScore: record?.reliabilityScore ?? 1.0,
  };
}

export async function upsertCompanyIntelligence(
  data: {
    companyName: string;
    officialCareerUrl?: string | null;
    atsProvider?: string | null;
    atsUrl?: string | null;
    sourceName?: string;
    sourceFreshnessMap?: Record<string, string>;
  }
): Promise<CompanyIntelligenceRecord> {
  const norm = normalizeCompany(data.companyName).toLowerCase();
  const now = new Date();

  const existing = await getCompanyIntelligence(data.companyName);
  const sourcesSet = new Set<string>(existing?.knownSources || []);
  if (data.sourceName) {
    sourcesSet.add(data.sourceName);
  }

  const atsInfo = data.atsUrl ? detectAtsProvider(data.atsUrl) : null;
  const atsProvider = data.atsProvider || atsInfo?.provider || existing?.atsProvider || null;

  const freshnessMap: Record<string, string> = {
    ...(existing?.sourceFreshness || {}),
    ...(data.sourceFreshnessMap || {}),
  };
  if (data.sourceName) {
    freshnessMap[data.sourceName.toLowerCase()] = now.toISOString();
  }

  const record = await prisma.companyIntelligence.upsert({
    where: { normalizedName: norm },
    create: {
      companyName: data.companyName,
      normalizedName: norm,
      officialCareerUrl: data.officialCareerUrl || existing?.officialCareerUrl || null,
      atsProvider,
      atsUrl: data.atsUrl || existing?.atsUrl || null,
      knownSources: JSON.stringify(freshnessMap),
      lastDiscoveredAt: now,
      lastCrawlAt: now,
      freshnessScore: 1.0,
      reliabilityScore: 1.0,
    },
    update: {
      officialCareerUrl: data.officialCareerUrl || undefined,
      atsProvider: atsProvider || undefined,
      atsUrl: data.atsUrl || undefined,
      knownSources: JSON.stringify(freshnessMap),
      lastDiscoveredAt: now,
      lastCrawlAt: now,
      updatedAt: now,
    },
  });

  return {
    id: record.id,
    companyName: record.companyName,
    normalizedName: record.normalizedName,
    officialCareerUrl: record.officialCareerUrl,
    atsProvider: record.atsProvider as KnownAtsProvider,
    atsUrl: record.atsUrl,
    knownSources: Array.from(sourcesSet),
    sourceFreshness: freshnessMap,
    lastDiscoveredAt: record.lastDiscoveredAt,
    lastCrawlAt: record.lastCrawlAt,
    freshnessScore: record.freshnessScore,
    reliabilityScore: record.reliabilityScore,
  };
}
