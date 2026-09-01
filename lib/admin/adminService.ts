/**
 * §ADMIN-READY CONTROL PLANE SERVICE (TASK-023)
 * Pure domain & DAL service layer powering BrowserPilot administrative observability,
 * system telemetry, scheduler health, discovery telemetry, and user watch auditing.
 * Decoupled from Next.js React UI layer.
 */

import { prisma, isPostgresDatabase } from "@/lib/db/prisma";
import { getOnboardingTelemetry, type OnboardingTelemetry } from "@/lib/db/onboarding";
import { ProviderTelemetryMetrics, getAdminProviderTelemetry } from "@/lib/ai/governance/providerGovernance";
import { getEnvironmentAuditSummary } from "@/lib/config/envContract";
import { getMultiInstanceReadinessReport } from "@/lib/infra/multiInstanceReadiness";
import { sourceRegistry } from "@/lib/discovery/sources/sourceRegistry";

export interface SystemHealthMetrics {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  databaseEngine: "POSTGRESQL" | "SQLITE_LIBSQL";
  uptimeSeconds: number;
  memoryRssMb: number;
  nodeVersion: string;
  timestamp: string;
}

export interface WatchTelemetrySummary {
  totalWatches: number;
  activeWatches: number;
  pausedWatches: number;
  intervalDistribution: {
    twoHours: number;
    fourHours: number;
    sixHours: number;
    twelveHours: number;
    twentyFourHours: number;
  };
  totalTargetCompaniesConfigured: number;
}

export interface DiscoveryRunTelemetrySummary {
  totalRuns: number;
  successfulRuns: number;
  partialSuccessRuns: number;
  failedRuns: number;
  successRatePercentage: number;
  averageDurationMs: number;
  totalCandidatesFound: number;
  totalNewOpportunities: number;
  totalNewSources: number;
  totalReposted: number;
}

export interface OpportunityCatalogSummary {
  totalOpportunities: number;
  activeOpportunities: number;
  totalSourceListings: number;
  sourceDistribution: {
    linkedIn: number;
    indeed: number;
    yCombinator: number;
    other: number;
  };
}

export interface LifecycleAlertTelemetrySummary {
  totalAlerts: number;
  unreadAlerts: number;
  breakdown: {
    newOpportunity: number;
    newSource: number;
    reposted: number;
  };
}

export interface MonetizationTelemetrySummary {
  activePaidSubscribers: number;
  totalRevenueUsd: number;
  subscriptionsByPlan: Record<string, number>;
  subscriptionsByStatus: Record<string, number>;
  totalTransactions: number;
  successfulTransactions: number;
  totalCoupons: number;
  totalCouponRedemptions: number;
}

export interface InfrastructureTelemetrySummary {
  environment: string;
  configuredVariablesCount: number;
  overallReadiness: string;
  databaseEngine: string;
}

export interface SourceIntelligenceTelemetrySummary {
  totalSources: number;
  healthySources: number;
  degradedSources: number;
  blockedSources: number;
  totalCompaniesTracked: number;
}

export interface AdminOverviewMetrics {
  system: SystemHealthMetrics;
  users: {
    totalUsers: number;
    usersWithActiveWatch: number;
  };
  watches: WatchTelemetrySummary;
  runs: DiscoveryRunTelemetrySummary;
  catalog: OpportunityCatalogSummary;
  alerts: LifecycleAlertTelemetrySummary;
  onboarding: OnboardingTelemetry;
  providers: ProviderTelemetryMetrics;
  billing: MonetizationTelemetrySummary;
  infrastructure: InfrastructureTelemetrySummary;
  sources: SourceIntelligenceTelemetrySummary;
}

export class AdminControlPlaneService {
  /**
   * Aggregates full system, user, watch, discovery, catalog, and alert telemetry
   */
  public async getOverviewMetrics(): Promise<AdminOverviewMetrics> {
    const memoryRssMb = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
    const uptimeSeconds = Math.round(process.uptime());
    const dbEngine = isPostgresDatabase() ? "POSTGRESQL" : "SQLITE_LIBSQL";

    const [
      totalUsers,
      allWatches,
      allRuns,
      totalOpportunities,
      activeOpportunities,
      sourceListings,
      allAlerts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.discoveryWatch.findMany(),
      prisma.discoveryRun.findMany({
        take: 200,
        orderBy: { startedAt: "desc" },
      }),
      prisma.opportunity.count(),
      prisma.opportunity.count({ where: { status: "ACTIVE" } }),
      prisma.sourceListing.findMany({ select: { sourcePlatform: true } }),
      prisma.lifecycleAlert.findMany({ select: { transitionType: true, isRead: true } }),
    ]);

    // 1. Watch Metrics
    let activeWatches = 0;
    let pausedWatches = 0;
    const intervalDist = { twoHours: 0, fourHours: 0, sixHours: 0, twelveHours: 0, twentyFourHours: 0 };
    let totalTargetCompanies = 0;

    for (const w of allWatches) {
      if (w.enabled) activeWatches++;
      else pausedWatches++;

      if (w.scanIntervalHours <= 2) intervalDist.twoHours++;
      else if (w.scanIntervalHours <= 4) intervalDist.fourHours++;
      else if (w.scanIntervalHours <= 6) intervalDist.sixHours++;
      else if (w.scanIntervalHours <= 12) intervalDist.twelveHours++;
      else intervalDist.twentyFourHours++;

      try {
        const comps = JSON.parse((w as any).companies || "[]");
        if (Array.isArray(comps)) totalTargetCompanies += comps.length;
      } catch {}
    }

    // 2. Discovery Run Metrics
    let successCount = 0;
    let partialCount = 0;
    let failedCount = 0;
    let totalDuration = 0;
    let candidatesFound = 0;
    let newOpps = 0;
    let newSources = 0;
    let reposted = 0;

    for (const r of allRuns) {
      if (r.status === "SUCCESS") successCount++;
      else if (r.status === "PARTIAL_SUCCESS") partialCount++;
      else failedCount++;

      totalDuration += r.durationMs || 0;
      candidatesFound += r.candidatesFound || 0;
      newOpps += r.newOpportunities || 0;
      newSources += r.newSources || 0;
      reposted += r.reposted || 0;
    }

    const totalRunsCount = allRuns.length;
    const successRate = totalRunsCount > 0 ? Math.round(((successCount + partialCount) / totalRunsCount) * 100) : 100;
    const avgDurationMs = totalRunsCount > 0 ? Math.round(totalDuration / totalRunsCount) : 0;

    // 3. Source Listings Distribution
    const sourceDist = { linkedIn: 0, indeed: 0, yCombinator: 0, other: 0 };
    for (const s of sourceListings) {
      const plat = s.sourcePlatform.toLowerCase();
      if (plat.includes("linkedin")) sourceDist.linkedIn++;
      else if (plat.includes("indeed")) sourceDist.indeed++;
      else if (plat.includes("y combinator") || plat.includes("yc")) sourceDist.yCombinator++;
      else sourceDist.other++;
    }

    // 4. Lifecycle Alert Metrics
    let unreadAlerts = 0;
    const alertBreakdown = { newOpportunity: 0, newSource: 0, reposted: 0 };
    for (const a of allAlerts) {
      if (!a.isRead) unreadAlerts++;
      if (a.transitionType === "NEW_OPPORTUNITY") alertBreakdown.newOpportunity++;
      else if (a.transitionType === "NEW_SOURCE") alertBreakdown.newSource++;
      else if (a.transitionType === "REPOSTED") alertBreakdown.reposted++;
    }

    return {
      system: {
        status: failedCount > 10 && successRate < 50 ? "DEGRADED" : "HEALTHY",
        databaseEngine: dbEngine,
        uptimeSeconds,
        memoryRssMb,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
      users: {
        totalUsers,
        usersWithActiveWatch: activeWatches,
      },
      watches: {
        totalWatches: allWatches.length,
        activeWatches,
        pausedWatches,
        intervalDistribution: intervalDist,
        totalTargetCompaniesConfigured: totalTargetCompanies,
      },
      runs: {
        totalRuns: totalRunsCount,
        successfulRuns: successCount,
        partialSuccessRuns: partialCount,
        failedRuns: failedCount,
        successRatePercentage: successRate,
        averageDurationMs: avgDurationMs,
        totalCandidatesFound: candidatesFound,
        totalNewOpportunities: newOpps,
        totalNewSources: newSources,
        totalReposted: reposted,
      },
      catalog: {
        totalOpportunities,
        activeOpportunities,
        totalSourceListings: sourceListings.length,
        sourceDistribution: sourceDist,
      },
      alerts: {
        totalAlerts: allAlerts.length,
        unreadAlerts,
        breakdown: alertBreakdown,
      },
      onboarding: await getOnboardingTelemetry(),
      providers: await getAdminProviderTelemetry(),
      billing: await (async () => {
        const [allSubs, allTxs, totalCoupons, totalRedemptions] = await Promise.all([
          prisma.subscription.findMany({ include: { plan: true } }),
          prisma.paymentTransaction.findMany({ select: { amount: true, status: true } }),
          prisma.coupon.count(),
          prisma.couponRedemption.count(),
        ]);

        const subscriptionsByPlan: Record<string, number> = {};
        const subscriptionsByStatus: Record<string, number> = {};
        let activePaidSubscribers = 0;

        for (const sub of allSubs) {
          const planCode = sub.plan?.code || "UNKNOWN";
          subscriptionsByPlan[planCode] = (subscriptionsByPlan[planCode] || 0) + 1;
          subscriptionsByStatus[sub.status] = (subscriptionsByStatus[sub.status] || 0) + 1;
          if (sub.status === "ACTIVE" && planCode !== "FREE") activePaidSubscribers++;
        }

        let totalRevenueUsd = 0;
        let successfulTransactions = 0;
        for (const tx of allTxs) {
          if (tx.status === "SUCCESS") {
            successfulTransactions++;
            totalRevenueUsd += tx.amount;
          }
        }

        return {
          activePaidSubscribers,
          totalRevenueUsd,
          subscriptionsByPlan,
          subscriptionsByStatus,
          totalTransactions: allTxs.length,
          successfulTransactions,
          totalCoupons,
          totalCouponRedemptions: totalRedemptions,
        };
      })(),
      infrastructure: (() => {
        const envAudit = getEnvironmentAuditSummary();
        const readiness = getMultiInstanceReadinessReport();
        return {
          environment: envAudit.environment,
          configuredVariablesCount: envAudit.configuredCount,
          overallReadiness: readiness.overallReadiness,
          databaseEngine: dbEngine,
        };
      })(),
      sources: await (async () => {
        const allSources = sourceRegistry.getAllSources();
        const totalCompanies = await prisma.companyIntelligence.count().catch(() => 0);
        return {
          totalSources: allSources.length,
          healthySources: allSources.filter((s) => s.status === "HEALTHY").length,
          degradedSources: allSources.filter((s) => s.status === "DEGRADED").length,
          blockedSources: allSources.filter((s) => s.status === "BLOCKED").length,
          totalCompaniesTracked: totalCompanies,
        };
      })(),
    };
  }

  /**
   * Retrieves paginated discovery watches with user metadata
   */
  public async listDiscoveryWatches(options: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [watches, total] = await Promise.all([
      prisma.discoveryWatch.findMany({
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          user: {
            select: { id: true, email: true, name: true, role: true, createdAt: true },
          },
        },
      }),
      prisma.discoveryWatch.count(),
    ]);

    const formatted = watches.map((w) => ({
      id: w.id,
      userId: w.userId,
      user: w.user,
      enabled: w.enabled,
      roles: JSON.parse(w.roles || "[]"),
      skills: JSON.parse(w.skills || "[]"),
      locations: JSON.parse(w.locations || "[]"),
      companies: JSON.parse((w as any).companies || "[]"),
      workModes: JSON.parse(w.workModes || "[]"),
      experienceLevels: JSON.parse(w.experienceLevels || "[]"),
      opportunityTypes: JSON.parse(w.opportunityTypes || "[]"),
      preferredSources: JSON.parse(w.preferredSources || "[]"),
      minimumMatchScore: w.minimumMatchScore,
      scanIntervalHours: w.scanIntervalHours,
      lastScannedAt: w.lastScannedAt,
      nextScanAt: w.nextScanAt,
      lockedAt: w.lockedAt,
      lockOwner: w.lockOwner,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    return {
      watches: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves paginated discovery runs with execution telemetry
   */
  public async listDiscoveryRuns(options: { page?: number; limit?: number; userId?: string; status?: string }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.userId) where.userId = options.userId;
    if (options.status) where.status = options.status;

    const [runs, total] = await Promise.all([
      prisma.discoveryRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: "desc" },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      prisma.discoveryRun.count({ where }),
    ]);

    return {
      runs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves live scheduler queue status and worker claims
   */
  public async getSchedulerStatus() {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - 120 * 1000);

    const [totalWatches, activeWatches, dueWatches, currentlyLockedWatches] = await Promise.all([
      prisma.discoveryWatch.count(),
      prisma.discoveryWatch.count({ where: { enabled: true } }),
      prisma.discoveryWatch.count({
        where: {
          enabled: true,
          OR: [{ nextScanAt: null }, { nextScanAt: { lte: now } }],
        },
      }),
      prisma.discoveryWatch.findMany({
        where: {
          enabled: true,
          lockedAt: { gt: staleCutoff },
        },
        select: {
          id: true,
          userId: true,
          lockedAt: true,
          lockOwner: true,
          nextScanAt: true,
        },
      }),
    ]);

    return {
      status: "ACTIVE",
      timestamp: now.toISOString(),
      counts: {
        totalWatches,
        activeWatches,
        dueForExecution: dueWatches,
        currentlyLocked: currentlyLockedWatches.length,
      },
      activeWorkerClaims: currentlyLockedWatches,
    };
  }
}

export const adminControlPlaneService = new AdminControlPlaneService();
