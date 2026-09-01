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
  atsProvider?: KnownAtsProvider | string | null;
  atsUrl?: string | null;
  knownSources: string[];
  sourceFreshness: Record<string, string>; // { "linkedin": ISO, "greenhouse": ISO }
  lastDiscoveredAt?: Date | null;
  lastCrawlAt?: Date | null;
  freshnessScore: number;
  reliabilityScore: number;
}

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

  const record = await prisma.companyIntelligence.findUnique({
    where: { normalizedName: norm },
  });

  if (!record) return null;

  let sourceFreshness: Record<string, string> = {};
  let knownSourcesList: string[] = [];
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

  return {
    id: record.id,
    companyName: record.companyName,
    normalizedName: record.normalizedName,
    officialCareerUrl: record.officialCareerUrl,
    atsProvider: record.atsProvider as KnownAtsProvider,
    atsUrl: record.atsUrl,
    knownSources: knownSourcesList,
    sourceFreshness,
    lastDiscoveredAt: record.lastDiscoveredAt,
    lastCrawlAt: record.lastCrawlAt,
    freshnessScore: record.freshnessScore,
    reliabilityScore: record.reliabilityScore,
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
