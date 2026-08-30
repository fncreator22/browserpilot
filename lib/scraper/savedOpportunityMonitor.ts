/**
 * §SAVED OPPORTUNITY MONITORING, LIFECYCLE ALERTS & AUTOMATED REVALIDATION ENGINE (TASK-010)
 * Proactively monitors saved opportunities, identifies stale candidates, applies bounded Playwright
 * revalidation, derives canonical lifecycle transitions, and persists deduplicated alerts.
 */

import { getSavedOpportunities, recordLifecycleAlert } from "@/lib/db/opportunities";
import { revalidateOpportunity, isListingFresh, DEFAULT_FRESHNESS_TTL_MS, type RevalidationSummary } from "./evidenceVerifier";
import { prisma } from "@/lib/db/prisma";

export interface MonitoringOptions {
  maxCandidates?: number;
  force?: boolean;
  ttlMs?: number;
  candidateTimeoutMs?: number;
  globalTimeoutMs?: number;
  allowLocalForTests?: boolean;
}

export interface MonitoringTelemetry {
  monitoringRunId: string;
  startedAt: string;
  completedAt: string;
  scanned: number;
  freshSkipped: number;
  staleCandidates: number;
  verified: number;
  expired: number;
  removed: number;
  blocked: number;
  timeouts: number;
  notificationsGenerated: number;
  notificationsDeduplicated: number;
  executionMs: number;
}

export interface MonitoringResult {
  telemetry: MonitoringTelemetry;
  summaries: RevalidationSummary[];
}

/**
 * Monitors saved opportunities for a specific user.
 * Skips fresh listings (< 24h) with 0 browser launches, executes bounded revalidation for stale candidates,
 * detects lifecycle transitions (e.g. ACTIVE -> EXPIRED, EXPIRED -> ACTIVE), and persists deduplicated alerts.
 */
export async function monitorSavedOpportunitiesForUser(
  userId: string,
  options: MonitoringOptions = {}
): Promise<MonitoringResult> {
  const startTime = Date.now();
  const runId = `mon_${userId.slice(0, 8)}_${Date.now()}`;
  const maxCandidates = Math.min(Math.max(options.maxCandidates || 10, 1), 20);
  const ttlMs = options.ttlMs || DEFAULT_FRESHNESS_TTL_MS;
  const globalTimeoutMs = options.globalTimeoutMs || 30000;

  const telemetry: MonitoringTelemetry = {
    monitoringRunId: runId,
    startedAt: new Date(startTime).toISOString(),
    completedAt: "",
    scanned: 0,
    freshSkipped: 0,
    staleCandidates: 0,
    verified: 0,
    expired: 0,
    removed: 0,
    blocked: 0,
    timeouts: 0,
    notificationsGenerated: 0,
    notificationsDeduplicated: 0,
    executionMs: 0,
  };

  const savedRecords = await getSavedOpportunities(userId);
  telemetry.scanned = savedRecords.length;

  if (savedRecords.length === 0) {
    telemetry.completedAt = new Date().toISOString();
    telemetry.executionMs = Date.now() - startTime;
    return { telemetry, summaries: [] };
  }

  const summaries: RevalidationSummary[] = [];

  for (const record of savedRecords) {
    if (Date.now() - startTime >= globalTimeoutMs) {
      console.warn(`[SavedOpportunityMonitor] Global monitoring timeout reached (${globalTimeoutMs}ms). Halting remaining.`);
      break;
    }

    if (summaries.length >= maxCandidates) {
      break;
    }

    const opp = record.opportunity;
    if (!opp) continue;

    // Freshness check: skip if verified within TTL and force flag is not set
    const fresh = !options.force && isListingFresh(opp.lastVerifiedAt, ttlMs);
    if (fresh) {
      telemetry.freshSkipped++;
      continue;
    }

    telemetry.staleCandidates++;

    const previousStatus = opp.status;
    const summary = await revalidateOpportunity(opp.id, {
      force: options.force,
      timeoutMs: options.candidateTimeoutMs || 2500,
      ttlMs,
      allowLocalForTests: options.allowLocalForTests,
    });

    if (!summary) continue;

    summaries.push(summary);

    telemetry.verified += summary.sourcesVerified;
    telemetry.expired += summary.sourcesExpired;
    telemetry.removed += summary.sourcesRemoved;
    telemetry.blocked += summary.sourcesBlocked;
    telemetry.timeouts += summary.sourcesTimedOut;

    // Detect Meaningful Lifecycle Transitions & Deduplicate Unchanged Alert States
    const newStatus = summary.newStatus;
    let transitionType: string | null = null;
    let message = "";

    if (previousStatus !== newStatus) {
      if (newStatus === "EXPIRED") {
        transitionType = "EXPIRED";
        message = `The position "${opp.title}" at ${opp.companyName} is no longer accepting applications or has been closed.`;
      } else if (newStatus === "REMOVED") {
        transitionType = "REMOVED";
        message = `The listing for "${opp.title}" at ${opp.companyName} was removed from the source platform.`;
      } else if (previousStatus === "EXPIRED" && newStatus === "ACTIVE") {
        transitionType = "RECOVERED_ACTIVE";
        message = `A verified active listing was rediscovered for "${opp.title}" at ${opp.companyName}.`;
      }
    } else if (newStatus === "EXPIRED" || newStatus === "REMOVED") {
      // Unchanged dead state: evaluated through idempotent alert check to track deduplicated notifications
      transitionType = newStatus;
      message = `The position "${opp.title}" at ${opp.companyName} remains ${newStatus.toLowerCase()}.`;
    }

    if (transitionType) {
      // Deterministic idempotency key: ensures no alert spam across successive monitoring runs
      const idempotencyKey = `${userId}_${opp.id}_${transitionType}_${newStatus}`;

      try {
        const alertResult = await recordLifecycleAlert({
          userId,
          opportunityId: opp.id,
          transitionType,
          previousStatus,
          newStatus,
          title: opp.title,
          companyName: opp.companyName,
          message,
          idempotencyKey,
        });

        if (alertResult.created) {
          telemetry.notificationsGenerated++;
        } else {
          telemetry.notificationsDeduplicated++;
        }
      } catch (alertErr) {
        console.warn("[SavedOpportunityMonitor] Failed to persist lifecycle alert:", (alertErr as Error).message);
      }
    }
  }

  telemetry.completedAt = new Date().toISOString();
  telemetry.executionMs = Date.now() - startTime;

  return {
    telemetry,
    summaries,
  };
}

/**
 * Background monitoring entry point: scans all distinct users with saved opportunities.
 */
export async function monitorAllSavedOpportunities(
  options: MonitoringOptions = {}
): Promise<{
  usersProcessed: number;
  totalTelemetry: MonitoringTelemetry;
}> {
  const startTime = Date.now();
  const runId = `global_mon_${Date.now()}`;

  const distinctUsers = await prisma.savedOpportunity.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });

  const totalTelemetry: MonitoringTelemetry = {
    monitoringRunId: runId,
    startedAt: new Date(startTime).toISOString(),
    completedAt: "",
    scanned: 0,
    freshSkipped: 0,
    staleCandidates: 0,
    verified: 0,
    expired: 0,
    removed: 0,
    blocked: 0,
    timeouts: 0,
    notificationsGenerated: 0,
    notificationsDeduplicated: 0,
    executionMs: 0,
  };

  for (const { userId } of distinctUsers) {
    const res = await monitorSavedOpportunitiesForUser(userId, options);
    totalTelemetry.scanned += res.telemetry.scanned;
    totalTelemetry.freshSkipped += res.telemetry.freshSkipped;
    totalTelemetry.staleCandidates += res.telemetry.staleCandidates;
    totalTelemetry.verified += res.telemetry.verified;
    totalTelemetry.expired += res.telemetry.expired;
    totalTelemetry.removed += res.telemetry.removed;
    totalTelemetry.blocked += res.telemetry.blocked;
    totalTelemetry.timeouts += res.telemetry.timeouts;
    totalTelemetry.notificationsGenerated += res.telemetry.notificationsGenerated;
    totalTelemetry.notificationsDeduplicated += res.telemetry.notificationsDeduplicated;
  }

  totalTelemetry.completedAt = new Date().toISOString();
  totalTelemetry.executionMs = Date.now() - startTime;

  return {
    usersProcessed: distinctUsers.length,
    totalTelemetry,
  };
}
