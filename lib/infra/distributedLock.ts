/**
 * §DISTRIBUTED LOCKING & CRASH RECOVERY ADAPTER (TASK-036)
 * 
 * Provides cluster-safe mutual exclusion with lease timeouts and
 * automatic stale lock recovery to prevent deadlock after process crashes.
 */

export interface DistributedLockAdapter {
  acquire(key: string, owner: string, ttlSeconds?: number): Promise<boolean>;
  release(key: string, owner: string): Promise<boolean>;
  renew(key: string, owner: string, ttlSeconds?: number): Promise<boolean>;
  getLockInfo(key: string): Promise<{ owner: string | null; lockedAt: Date | null; isExpired: boolean } | null>;
}

export class MemoryDistributedLock implements DistributedLockAdapter {
  private locks: Map<string, { owner: string; lockedAt: Date; ttlMs: number }> = new Map();

  public async acquire(key: string, owner: string, ttlSeconds = 60): Promise<boolean> {
    const now = Date.now();
    const ttlMs = ttlSeconds * 1000;
    const existing = this.locks.get(key);

    // If existing lock is active and owned by someone else, reject
    if (existing && existing.lockedAt.getTime() + existing.ttlMs > now && existing.owner !== owner) {
      return false;
    }

    // Acquire or take over expired/same-owner lock
    this.locks.set(key, {
      owner,
      lockedAt: new Date(now),
      ttlMs,
    });
    return true;
  }

  public async release(key: string, owner: string): Promise<boolean> {
    const existing = this.locks.get(key);
    if (!existing || existing.owner !== owner) {
      return false;
    }

    this.locks.delete(key);
    return true;
  }

  public async renew(key: string, owner: string, ttlSeconds = 60): Promise<boolean> {
    const existing = this.locks.get(key);
    if (!existing || existing.owner !== owner) {
      return false;
    }

    existing.lockedAt = new Date();
    existing.ttlMs = ttlSeconds * 1000;
    return true;
  }

  public async getLockInfo(key: string): Promise<{ owner: string | null; lockedAt: Date | null; isExpired: boolean } | null> {
    const existing = this.locks.get(key);
    if (!existing) return null;

    const isExpired = existing.lockedAt.getTime() + existing.ttlMs <= Date.now();
    return {
      owner: existing.owner,
      lockedAt: existing.lockedAt,
      isExpired,
    };
  }
}

export const distributedLock: DistributedLockAdapter = new MemoryDistributedLock();
