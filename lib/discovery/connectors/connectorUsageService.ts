/**
 * §CONNECTOR REGISTRY & USAGE TRACKING SERVICE
 * 
 * Provides database-backed registry operations, real harvest usage recording,
 * caching of connector enabled/disabled states for sub-millisecond search routing,
 * and high-level dashboard metrics aggregation.
 */

import { prisma } from "@/lib/db/prisma";

export interface RecordConnectorHarvestOptions {
  connectorName: string;
  targetUrl?: string;
  status: "SUCCESS" | "BLOCKED" | "ERROR" | "EMPTY";
  jobsFoundCount: number;
  qualityGatePassCount: number;
  durationMs?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface ConnectorMetricsSummary {
  totalConnectors: number;
  activeConnectors: number;
  disabledConnectors: number;
  blockedConnectors: number;
  totalCrawlsAllTime: number;
  totalJobsFoundAllTime: number;
  totalQualityGatePassedAllTime: number;
  overallQualityPassRate: number;
}

export interface DefaultConnectorDef {
  name: string;
  displayName: string;
  type: "DIRECT_ATS" | "CAREER_PORTAL" | "AGGREGATOR";
  baseUrl: string;
  baseUrlPattern: string;
  requiresAuth: boolean;
  isPublic?: boolean;
  iconUrl?: string;
}

export const DEFAULT_BUILTIN_CONNECTORS: DefaultConnectorDef[] = [
  {
    name: "Greenhouse",
    displayName: "Greenhouse Direct ATS",
    type: "DIRECT_ATS",
    baseUrl: "https://boards.greenhouse.io",
    baseUrlPattern: "*boards.greenhouse.io*",
    requiresAuth: false,
    isPublic: true,
    iconUrl: "https://www.greenhouse.com/assets/favicon.ico",
  },
  {
    name: "Lever",
    displayName: "Lever Direct ATS",
    type: "DIRECT_ATS",
    baseUrl: "https://jobs.lever.co",
    baseUrlPattern: "*jobs.lever.co*",
    requiresAuth: false,
    isPublic: true,
    iconUrl: "https://lever.co/favicon.ico",
  },
  {
    name: "Ashby",
    displayName: "Ashby Direct ATS",
    type: "DIRECT_ATS",
    baseUrl: "https://jobs.ashbyhq.com",
    baseUrlPattern: "*jobs.ashbyhq.com*",
    requiresAuth: false,
    isPublic: true,
    iconUrl: "https://ashbyhq.com/favicon.ico",
  },
  {
    name: "Workable",
    displayName: "Workable ATS",
    type: "DIRECT_ATS",
    baseUrl: "https://apply.workable.com",
    baseUrlPattern: "*apply.workable.com*",
    requiresAuth: false,
    isPublic: true,
    iconUrl: "https://workable.com/favicon.ico",
  },
  {
    name: "Workday CXS",
    displayName: "Workday Enterprise Portals",
    type: "CAREER_PORTAL",
    baseUrl: "https://myworkdayjobs.com",
    baseUrlPattern: "*myworkdayjobs.com*",
    requiresAuth: false,
    isPublic: true,
    iconUrl: "https://www.workday.com/favicon.ico",
  },
  {
    name: "Apna",
    displayName: "Apna Jobs Portal",
    type: "CAREER_PORTAL",
    baseUrl: "https://apna.co",
    baseUrlPattern: "*apna.co*",
    requiresAuth: false,
    isPublic: true,
    iconUrl: "https://apna.co/favicon.ico",
  },
  {
    name: "LinkedIn",
    displayName: "LinkedIn Jobs",
    type: "AGGREGATOR",
    baseUrl: "https://www.linkedin.com",
    baseUrlPattern: "*linkedin.com*",
    requiresAuth: false,
    isPublic: true,
    iconUrl: "https://www.linkedin.com/favicon.ico",
  },
  {
    name: "Indeed",
    displayName: "Indeed Aggregator",
    type: "AGGREGATOR",
    baseUrl: "https://www.indeed.com",
    baseUrlPattern: "*indeed.com*",
    requiresAuth: false,
    isPublic: false,
    iconUrl: "https://www.indeed.com/favicon.ico",
  },
  {
    name: "Generic Career Portal",
    displayName: "Open-Web Browser Crawler",
    type: "CAREER_PORTAL",
    baseUrl: "https://careers.*",
    baseUrlPattern: "*careers*",
    requiresAuth: false,
    isPublic: true,
    iconUrl: "",
  },
];

// In-memory cache for connector enabled statuses (TTL: 5 seconds)
interface ConnectorCacheEntry {
  isEnabled: boolean;
  isPublic?: boolean;
  status: string;
  baseUrlPattern?: string | null;
  expiresAt: number;
}
const connectorCache = new Map<string, ConnectorCacheEntry>();

export class ConnectorUsageService {
  /**
   * Invalidate the in-memory cache for one or all connectors
   */
  public invalidateCache(connectorName?: string): void {
    if (connectorName) {
      connectorCache.delete(connectorName.toLowerCase().trim());
    } else {
      connectorCache.clear();
    }
  }

  /**
   * Seeds default connectors if table is empty or missing standard connectors
   */
  public async seedDefaultConnectorsIfEmpty(): Promise<void> {
    try {
      for (const def of DEFAULT_BUILTIN_CONNECTORS) {
        const existing = await prisma.discoverySource.findFirst({
          where: {
            OR: [
              { name: { equals: def.name, mode: "insensitive" } },
              { displayName: { equals: def.displayName, mode: "insensitive" } },
            ],
          },
        });

        if (!existing) {
          await prisma.discoverySource.create({
            data: {
              name: def.name,
              displayName: def.displayName,
              type: def.type,
              baseUrl: def.baseUrl,
              baseUrlPattern: def.baseUrlPattern,
              requiresAuth: def.requiresAuth,
              isPublic: def.isPublic ?? true,
              iconUrl: def.iconUrl || null,
              status: "ACTIVE",
              isEnabled: true,
              reliabilityScore: 1.0,
            },
          });
        }
      }
    } catch (err) {
      console.warn("[ConnectorUsageService] Error seeding default connectors:", err);
    }
  }

  /**
   * Fast in-memory check whether a connector is enabled by admin.
   * Caches database state for 5 seconds to avoid DB latency during high-speed crawling.
   */
  public async isConnectorEnabled(connectorName: string, targetUrl?: string): Promise<boolean> {
    const key = connectorName.toLowerCase().trim();
    const now = Date.now();

    const cached = connectorCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.isEnabled && cached.status !== "DISABLED";
    }

    try {
      // 1. Direct name lookup
      let source = await prisma.discoverySource.findFirst({
        where: {
          OR: [
            { name: { equals: connectorName, mode: "insensitive" } },
            { displayName: { equals: connectorName, mode: "insensitive" } },
          ],
        },
      });

      // 2. URL pattern match fallback if targetUrl provided
      if (!source && targetUrl) {
        const allSources = await prisma.discoverySource.findMany({
          select: { id: true, name: true, baseUrlPattern: true, baseUrl: true, isEnabled: true, status: true },
        });

        for (const s of allSources) {
          if (s.baseUrlPattern && this.matchesPattern(targetUrl, s.baseUrlPattern)) {
            source = s as any;
            break;
          }
          if (targetUrl.includes(new URL(s.baseUrl).hostname)) {
            source = s as any;
            break;
          }
        }
      }

      if (!source) {
        // Unknown source default to enabled
        connectorCache.set(key, { isEnabled: true, status: "ACTIVE", expiresAt: now + 5000 });
        return true;
      }

      const isEnabled = Boolean(source.isEnabled && source.status !== "DISABLED");
      connectorCache.set(key, {
        isEnabled: source.isEnabled,
        status: source.status,
        baseUrlPattern: source.baseUrlPattern,
        expiresAt: now + 5000,
      });

      return isEnabled;
    } catch {
      // On transient DB read error, default to enabled to prevent blocking search
      return true;
    }
  }

  /**
   * Records a real harvest attempt in connector_harvest_logs and updates discovery_sources metrics.
   * Never throws — safely catches errors so search execution is never disrupted.
   */
  public async recordConnectorHarvest(options: RecordConnectorHarvestOptions): Promise<void> {
    try {
      const {
        connectorName,
        targetUrl,
        status,
        jobsFoundCount,
        qualityGatePassCount,
        durationMs = 0,
        errorMessage,
        metadata = {},
      } = options;

      // Invalidate cache for this connector
      connectorCache.delete(connectorName.toLowerCase().trim());

      // 1. Find or create the corresponding discovery_source
      let source = await prisma.discoverySource.findFirst({
        where: {
          OR: [
            { name: { equals: connectorName, mode: "insensitive" } },
            { displayName: { equals: connectorName, mode: "insensitive" } },
          ],
        },
      });

      if (!source && targetUrl) {
        try {
          const parsed = new URL(targetUrl);
          source = await prisma.discoverySource.findFirst({
            where: {
              OR: [
                { baseUrl: { contains: parsed.hostname } },
                { baseUrlPattern: { contains: parsed.hostname } },
              ],
            },
          });
        } catch {
          // ignore URL parse errors
        }
      }

      // If still not found, create a new entry dynamically
      if (!source) {
        source = await prisma.discoverySource.create({
          data: {
            name: connectorName,
            displayName: connectorName,
            type: connectorName.toLowerCase().includes("ats") ? "DIRECT_ATS" : "CAREER_PORTAL",
            baseUrl: targetUrl || "https://example.com",
            baseUrlPattern: targetUrl ? `*${new URL(targetUrl).hostname}*` : undefined,
            status: status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
            isEnabled: true,
            reliabilityScore: status === "SUCCESS" ? 1.0 : 0.8,
          },
        });
      }

      // 2. Insert detailed harvest log
      await prisma.connectorHarvestLog.create({
        data: {
          sourceId: source.id,
          connectorName: source.name,
          targetUrl: targetUrl || source.baseUrl,
          status,
          jobsFoundCount,
          qualityGatePassCount,
          durationMs,
          errorMessage: errorMessage || null,
          metadata: JSON.stringify(metadata),
        },
      });

      // 3. Update discovery_sources aggregate metrics
      const now = new Date();
      const isSuccess = status === "SUCCESS";
      const isFailed = status === "ERROR" || status === "BLOCKED";

      let nextStatus = source.status;
      if (source.status !== "DISABLED") {
        if (status === "BLOCKED") {
          nextStatus = "BLOCKED";
        } else if (isSuccess && source.status === "BLOCKED") {
          nextStatus = "ACTIVE";
        } else if (source.status === "HEALTHY") {
          nextStatus = "ACTIVE";
        }
      }

      await prisma.discoverySource.update({
        where: { id: source.id },
        data: {
          totalCrawls: { increment: 1 },
          successfulCrawls: isSuccess ? { increment: 1 } : undefined,
          failedCrawls: isFailed ? { increment: 1 } : undefined,
          totalJobsFound: { increment: jobsFoundCount },
          recentJobsFound: jobsFoundCount,
          lastQualityGatePassed: qualityGatePassCount,
          totalQualityGatePassed: { increment: qualityGatePassCount },
          lastCrawledAt: now,
          lastStatus: status,
          lastSuccessfulCrawlAt: isSuccess ? now : undefined,
          lastFailedCrawlAt: isFailed ? now : undefined,
          status: nextStatus,
        },
      });
    } catch (err) {
      console.warn("[ConnectorUsageService] Failed to record harvest log:", err);
    }
  }

  /**
   * Retrieves aggregated dashboard metrics and all connectors
   */
  public async getConnectorDashboardData() {
    await this.seedDefaultConnectorsIfEmpty();

    const connectors = await prisma.discoverySource.findMany({
      orderBy: [
        { isEnabled: "desc" },
        { totalCrawls: "desc" },
        { name: "asc" },
      ],
      include: {
        harvestLogs: {
          take: 5,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const recentLogs = await prisma.connectorHarvestLog.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      include: {
        source: {
          select: {
            displayName: true,
            type: true,
            iconUrl: true,
          },
        },
      },
    });

    let totalCrawls = 0;
    let totalJobs = 0;
    let totalQualityPassed = 0;
    let activeCount = 0;
    let disabledCount = 0;
    let blockedCount = 0;

    for (const c of connectors) {
      totalCrawls += c.totalCrawls;
      totalJobs += c.totalJobsFound;
      totalQualityPassed += c.totalQualityGatePassed;

      if (!c.isEnabled || c.status === "DISABLED") {
        disabledCount++;
      } else if (c.status === "BLOCKED") {
        blockedCount++;
      } else {
        activeCount++;
      }
    }

    const overallQualityPassRate = totalJobs > 0 ? Math.round((totalQualityPassed / totalJobs) * 100) : 100;

    const summary: ConnectorMetricsSummary = {
      totalConnectors: connectors.length,
      activeConnectors: activeCount,
      disabledConnectors: disabledCount,
      blockedConnectors: blockedCount,
      totalCrawlsAllTime: totalCrawls,
      totalJobsFoundAllTime: totalJobs,
      totalQualityGatePassedAllTime: totalQualityPassed,
      overallQualityPassRate,
    };

    return {
      summary,
      connectors,
      recentLogs,
    };
  }

  private matchesPattern(url: string, pattern: string): boolean {
    const cleanPattern = pattern.replace(/\*/g, ".*");
    try {
      const regex = new RegExp(cleanPattern, "i");
      return regex.test(url);
    } catch {
      return url.includes(pattern.replace(/\*/g, ""));
    }
  }
}

export const connectorUsageService = new ConnectorUsageService();
