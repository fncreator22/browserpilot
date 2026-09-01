/**
 * §BROWSER CONCURRENCY CONTROLLER & CAPACITY GOVERNANCE (TASK-041)
 * 
 * Enforces explicit concurrency semaphores, per-source limits, queue backpressure,
 * and deterministic timeout cleanup to protect CPU/memory from browser process exhaustion.
 */

import { type ConcurrencyControlConfig } from "./discoveryExecutionTypes";

export class BrowserConcurrencyController {
  private activeContexts = 0;
  private sourceActiveCounts = new Map<string, number>();
  private userActiveCounts = new Map<string, number>();

  private config: ConcurrencyControlConfig = {
    maxConcurrentContexts: 10,
    perSourceConcurrency: 4,
    perUserConcurrency: 8,
    globalTimeoutMs: 15000,
  };

  constructor(customConfig?: Partial<ConcurrencyControlConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  public getActiveContextsCount(): number {
    return this.activeContexts;
  }

  public getSourceActiveCount(sourceName: string): number {
    return this.sourceActiveCounts.get(sourceName.toLowerCase()) || 0;
  }

  /**
   * Attempts to acquire a browser execution slot with backpressure checks.
   */
  public async acquireSlot(sourceName: string, userId?: string): Promise<() => void> {
    const srcKey = sourceName.toLowerCase();
    const userKey = userId || "anonymous";

    const startTime = Date.now();
    const maxWaitMs = 5000;

    while (
      this.activeContexts >= this.config.maxConcurrentContexts ||
      (this.sourceActiveCounts.get(srcKey) || 0) >= this.config.perSourceConcurrency ||
      (this.userActiveCounts.get(userKey) || 0) >= this.config.perUserConcurrency
    ) {
      if (Date.now() - startTime >= maxWaitMs) {
        throw new Error(
          `[ConcurrencyGuard] Resource saturation: Concurrency limit reached for source '${sourceName}' (Max: ${this.config.perSourceConcurrency}, Active: ${this.sourceActiveCounts.get(srcKey) || 0})`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Slot granted
    this.activeContexts++;
    this.sourceActiveCounts.set(srcKey, (this.sourceActiveCounts.get(srcKey) || 0) + 1);
    this.userActiveCounts.set(userKey, (this.userActiveCounts.get(userKey) || 0) + 1);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeContexts = Math.max(0, this.activeContexts - 1);
      const curSrc = this.sourceActiveCounts.get(srcKey) || 0;
      this.sourceActiveCounts.set(srcKey, Math.max(0, curSrc - 1));
      const curUser = this.userActiveCounts.get(userKey) || 0;
      this.userActiveCounts.set(userKey, Math.max(0, curUser - 1));
    };
  }

  /**
   * Resets all internal concurrency counters (used in testing or recovery).
   */
  public reset(): void {
    this.activeContexts = 0;
    this.sourceActiveCounts.clear();
    this.userActiveCounts.clear();
  }
}

export const browserConcurrencyController = new BrowserConcurrencyController();
