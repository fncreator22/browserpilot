/**
 * §AUTONOMOUS WATCH SCHEDULER & PROACTIVE DISCOVERY ORCHESTRATION (TASK-015)
 * 
 * Deterministic, multi-tenant safe, durable background scheduler.
 * Finds due DiscoveryWatch records, acquires lease-protected claims,
 * invokes single-source-of-truth autonomous discovery, advances scan timestamps,
 * enforces global execution watchdog limits, and records comprehensive telemetry.
 * 
 * Zero LLM Token Policy — 100% deterministic execution.
 */

import {
  getDueDiscoveryWatches,
  claimDiscoveryWatch,
  releaseDiscoveryWatch,
  updateDiscoveryWatchScanTimestamps,
  type DiscoveryWatchConfig,
} from "@/lib/db/opportunities";
import {
  autonomousDiscoveryEngine,
  type AutonomousDiscoveryOptions,
  type AutonomousDiscoveryRunResult,
} from "./autonomousDiscovery";

export interface SchedulerOptions {
  maxWatchesToProcess?: number;
  concurrencyLimit?: number;
  maxExecutionBudgetMs?: number;
  maxLeaseAgeMs?: number;
  discoveryOptions?: AutonomousDiscoveryOptions;
  customFetch?: typeof fetch;
}

export interface ScheduledUserResult {
  userId: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "TIMEOUT" | "SKIPPED_LOCKED" | "DISABLED";
  durationMs: number;
  newOpportunities: number;
  newSources: number;
  alreadyKnown: number;
  reposted: number;
  notificationsCreated: number;
  errorMessage?: string;
}

export interface SchedulerTelemetry {
  schedulerRunId: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "TIMED_OUT" | "EMPTY";
  watchesExamined: number;
  watchesDue: number;
  watchesClaimed: number;
  watchesCompleted: number;
  watchesSkipped: number;
  watchesFailed: number;
  watchesTimedOut: number;
  opportunitiesDiscovered: number;
  newOpportunities: number;
  newSources: number;
  alreadyKnown: number;
  reposted: number;
  notificationsCreated: number;
  userResults: ScheduledUserResult[];
}

export class DiscoveryScheduler {
  /**
   * Executes a scheduled autonomous discovery cycle across all due watches.
   */
  public async runScheduledDiscovery(options: SchedulerOptions = {}): Promise<SchedulerTelemetry> {
    const startTime = Date.now();
    const schedulerRunId = `sched_${startTime}_${Math.random().toString(36).slice(2, 7)}`;
    const maxWatches = options.maxWatchesToProcess ?? 10;
    const concurrencyLimit = Math.min(options.concurrencyLimit ?? 2, 4);
    const maxExecutionBudgetMs = options.maxExecutionBudgetMs ?? 30000;
    const maxLeaseAgeMs = options.maxLeaseAgeMs ?? 120000;

    const userResults: ScheduledUserResult[] = [];
    let watchesClaimed = 0;
    let watchesCompleted = 0;
    let watchesSkipped = 0;
    let watchesFailed = 0;
    let watchesTimedOut = 0;
    let totalCandidatesDiscovered = 0;
    let totalNewOpportunities = 0;
    let totalNewSources = 0;
    let totalAlreadyKnown = 0;
    let totalReposted = 0;
    let totalNotificationsCreated = 0;

    // 1. Fetch eligible due watches (enabled + nextScanAt <= now + no active unexpired lease)
    const dueWatches = await getDueDiscoveryWatches(maxWatches, maxLeaseAgeMs);
    const watchesDue = dueWatches.length;

    if (watchesDue === 0) {
      const now = new Date();
      return {
        schedulerRunId,
        startedAt: new Date(startTime),
        completedAt: now,
        durationMs: Date.now() - startTime,
        status: "EMPTY",
        watchesExamined: 0,
        watchesDue: 0,
        watchesClaimed: 0,
        watchesCompleted: 0,
        watchesSkipped: 0,
        watchesFailed: 0,
        watchesTimedOut: 0,
        opportunitiesDiscovered: 0,
        newOpportunities: 0,
        newSources: 0,
        alreadyKnown: 0,
        reposted: 0,
        notificationsCreated: 0,
        userResults: [],
      };
    }

    // 2. Process in bounded concurrent chunks with global execution watchdog
    for (let i = 0; i < dueWatches.length; i += concurrencyLimit) {
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs >= maxExecutionBudgetMs) {
        // Global watchdog budget reached — halt starting new chunks
        const remaining = dueWatches.slice(i);
        watchesTimedOut += remaining.length;
        for (const rem of remaining) {
          userResults.push({
            userId: rem.userId,
            status: "TIMEOUT",
            durationMs: 0,
            newOpportunities: 0,
            newSources: 0,
            alreadyKnown: 0,
            reposted: 0,
            notificationsCreated: 0,
            errorMessage: "Scheduler execution budget exceeded before watch could be claimed",
          });
        }
        break;
      }

      const chunk = dueWatches.slice(i, i + concurrencyLimit);

      const chunkPromises = chunk.map(async ({ userId, watch }) => {
        const lockOwner = `${schedulerRunId}_${userId}`;
        const userStart = Date.now();

        // 3. Atomically acquire durable database claim
        const claimed = await claimDiscoveryWatch(userId, lockOwner, maxLeaseAgeMs);
        if (!claimed) {
          watchesSkipped++;
          return {
            userId,
            status: "SKIPPED_LOCKED" as const,
            durationMs: Date.now() - userStart,
            newOpportunities: 0,
            newSources: 0,
            alreadyKnown: 0,
            reposted: 0,
            notificationsCreated: 0,
            errorMessage: "Watch is currently claimed by another scheduler instance",
          };
        }

        watchesClaimed++;

        try {
          // 4. Execute single-source-of-truth autonomous discovery engine (TASK-014)
          const runResult: AutonomousDiscoveryRunResult =
            await autonomousDiscoveryEngine.runAutonomousDiscoveryForUser(userId, {
              ...options.discoveryOptions,
              customFetch: options.customFetch,
              triggerType: "SCHEDULED",
              skipLockCheck: true, // Lock is already held at database level by scheduler
            });

          const userDuration = Date.now() - userStart;

          // 5. Handle successful/partial vs failed execution state
          if (runResult.status === "SUCCESS" || runResult.status === "PARTIAL_SUCCESS") {
            watchesCompleted++;

            // Calculate drift-free nextScanAt
            const now = new Date();
            const intervalHours = watch.scanIntervalHours || 6;
            const baseTime = watch.nextScanAt && watch.nextScanAt.getTime() > now.getTime() - intervalHours * 3600 * 1000
              ? watch.nextScanAt.getTime()
              : now.getTime();
            let calculatedNext = new Date(baseTime + intervalHours * 3600 * 1000);
            if (calculatedNext.getTime() <= now.getTime()) {
              calculatedNext = new Date(now.getTime() + intervalHours * 3600 * 1000);
            }

            // Update timestamps and release database claim
            await updateDiscoveryWatchScanTimestamps(userId, now, calculatedNext);

            totalCandidatesDiscovered += runResult.telemetry.candidatesFound;
            totalNewOpportunities += runResult.telemetry.newOpportunities;
            totalNewSources += runResult.telemetry.newSources;
            totalAlreadyKnown += runResult.telemetry.alreadyKnown;
            totalReposted += runResult.telemetry.reposted;
            totalNotificationsCreated += runResult.telemetry.notificationsCreated;

            return {
              userId,
              status: runResult.status,
              durationMs: userDuration,
              newOpportunities: runResult.telemetry.newOpportunities,
              newSources: runResult.telemetry.newSources,
              alreadyKnown: runResult.telemetry.alreadyKnown,
              reposted: runResult.telemetry.reposted,
              notificationsCreated: runResult.telemetry.notificationsCreated,
            };
          } else {
            watchesFailed++;
            // Release claim on failure without advancing lastScannedAt
            await releaseDiscoveryWatch(userId, lockOwner);

            return {
              userId,
              status: runResult.status,
              durationMs: userDuration,
              newOpportunities: runResult.telemetry?.newOpportunities || 0,
              newSources: runResult.telemetry?.newSources || 0,
              alreadyKnown: runResult.telemetry?.alreadyKnown || 0,
              reposted: runResult.telemetry?.reposted || 0,
              notificationsCreated: runResult.telemetry?.notificationsCreated || 0,
              errorMessage: runResult.message || "Discovery run returned non-success status",
            };
          }
        } catch (err: unknown) {
          watchesFailed++;
          const errorMessage = (err as Error).message || "Unexpected scheduler execution error";
          await releaseDiscoveryWatch(userId, lockOwner).catch(() => null);

          return {
            userId,
            status: "FAILED" as const,
            durationMs: Date.now() - userStart,
            newOpportunities: 0,
            newSources: 0,
            alreadyKnown: 0,
            reposted: 0,
            notificationsCreated: 0,
            errorMessage,
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      userResults.push(...chunkResults);
    }

    const durationMs = Date.now() - startTime;
    const completedAt = new Date();

    let overallStatus: SchedulerTelemetry["status"] = "SUCCESS";
    if (watchesTimedOut > 0) {
      overallStatus = "TIMED_OUT";
    } else if (watchesFailed > 0 && watchesCompleted > 0) {
      overallStatus = "PARTIAL_SUCCESS";
    } else if (watchesFailed > 0 && watchesCompleted === 0) {
      overallStatus = "FAILED";
    }

    return {
      schedulerRunId,
      startedAt: new Date(startTime),
      completedAt,
      durationMs,
      status: overallStatus,
      watchesExamined: dueWatches.length,
      watchesDue,
      watchesClaimed,
      watchesCompleted,
      watchesSkipped,
      watchesFailed,
      watchesTimedOut,
      opportunitiesDiscovered: totalCandidatesDiscovered,
      newOpportunities: totalNewOpportunities,
      newSources: totalNewSources,
      alreadyKnown: totalAlreadyKnown,
      reposted: totalReposted,
      notificationsCreated: totalNotificationsCreated,
      userResults,
    };
  }
}

export const discoveryScheduler = new DiscoveryScheduler();
