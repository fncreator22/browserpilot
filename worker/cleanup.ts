import { purgeExpiredTerminalJobs } from "@/lib/db/jobs";

// Default configuration: Purge jobs completed > 24 hours ago, check every 1 hour (§Prompt B2)
export const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function getRetentionPeriodMs(): number {
  const envVal = process.env.JOB_RETENTION_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_RETENTION_MS;
}

export function getCleanupIntervalMs(): number {
  const envVal = process.env.CLEANUP_INTERVAL_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_CLEANUP_INTERVAL_MS;
}

/**
 * Runs a single auto-purge cycle against terminal jobs older than the retention window
 */
export async function runPurgeCycle(retentionMs?: number): Promise<{ purgedCount: number; purgedJobIds: string[] }> {
  const effectiveRetention = retentionMs !== undefined ? retentionMs : getRetentionPeriodMs();
  const result = await purgeExpiredTerminalJobs(effectiveRetention);

  if (result.purgedCount > 0) {
    console.log(`[Auto-Purge] 🧹 Purged ${result.purgedCount} expired job(s) and filesystem artifacts older than ${effectiveRetention / 3600000}h.`);
  }

  return result;
}

let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Starts the repeatable auto-purge scheduler in the background worker process
 */
export function startAutoPurgeScheduler(): NodeJS.Timeout {
  const intervalMs = getCleanupIntervalMs();
  const retentionMs = getRetentionPeriodMs();

  console.log(`[Auto-Purge] 🕒 Initialized 24h Data Purge Scheduler (Interval: ${intervalMs / 60000}m, Retention: ${retentionMs / 3600000}h)`);

  // Run initial pass on startup
  runPurgeCycle(retentionMs).catch((err) => {
    console.error("[Auto-Purge] Initial purge pass encountered an error:", err);
  });

  // Schedule recurring interval
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  cleanupTimer = setInterval(() => {
    runPurgeCycle(retentionMs).catch((err) => {
      console.error("[Auto-Purge] Scheduled purge pass encountered an error:", err);
    });
  }, intervalMs);

  return cleanupTimer;
}

/**
 * Stops the auto-purge scheduler timer
 */
export function stopAutoPurgeScheduler(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
