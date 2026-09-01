/**
 * §COMPANY INTELLIGENCE & ATS RESOLUTION SERVICE (TASK-038)
 * 
 * Maps companies to official career portals, ATS providers (Greenhouse, Ashby, Lever),
 * and tracks historical discovery channels.
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

  return {
    id: record.id,
    companyName: record.companyName,
    normalizedName: record.normalizedName,
    officialCareerUrl: record.officialCareerUrl,
    atsProvider: record.atsProvider as KnownAtsProvider,
    atsUrl: record.atsUrl,
    knownSources: JSON.parse(record.knownSources || "[]"),
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

  const record = await prisma.companyIntelligence.upsert({
    where: { normalizedName: norm },
    create: {
      companyName: data.companyName,
      normalizedName: norm,
      officialCareerUrl: data.officialCareerUrl || existing?.officialCareerUrl || null,
      atsProvider,
      atsUrl: data.atsUrl || existing?.atsUrl || null,
      knownSources: JSON.stringify(Array.from(sourcesSet)),
      lastDiscoveredAt: now,
      lastCrawlAt: now,
      freshnessScore: 1.0,
      reliabilityScore: 1.0,
    },
    update: {
      officialCareerUrl: data.officialCareerUrl || undefined,
      atsProvider: atsProvider || undefined,
      atsUrl: data.atsUrl || undefined,
      knownSources: JSON.stringify(Array.from(sourcesSet)),
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
    lastDiscoveredAt: record.lastDiscoveredAt,
    lastCrawlAt: record.lastCrawlAt,
    freshnessScore: record.freshnessScore,
    reliabilityScore: record.reliabilityScore,
  };
}
