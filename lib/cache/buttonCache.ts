/**
 * §HIGH-SPEED BUTTON & OPPORTUNITY CACHE LAYER
 * 
 * Provides sub-millisecond in-memory LRU + Redis caching for user interaction buttons
 * (Save/Unsave, Verification status, Opportunity resolution, Company Intelligence).
 * Prevents redundant sequential database round trips and ensures immediate UI state reflection.
 */

import { getSharedRedisClient } from "@/lib/queue/redis";
import { searchEventBus } from "@/lib/events/searchEvents";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class FastButtonCache {
  private memCache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries = 5000;

  private getMem<T>(key: string): T | null {
    const entry = this.memCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memCache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private setMem<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.memCache.size >= this.maxEntries) {
      // Evict oldest 500 items
      const keys = Array.from(this.memCache.keys()).slice(0, 500);
      for (const k of keys) this.memCache.delete(k);
    }
    this.memCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async getSavedStatus(userId: string, opportunityId: string): Promise<boolean | null> {
    const cacheKey = `saved_status:${userId}:${opportunityId}`;
    const memVal = this.getMem<boolean>(cacheKey);
    if (memVal !== null) return memVal;

    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        const val = await redis.get(cacheKey);
        if (val !== null) {
          const isSaved = val === "1";
          this.setMem(cacheKey, isSaved, 120);
          return isSaved;
        }
      }
    } catch {}

    return null;
  }

  public setSavedStatus(userId: string, opportunityId: string, isSaved: boolean): void {
    const cacheKey = `saved_status:${userId}:${opportunityId}`;
    this.setMem(cacheKey, isSaved, 300);

    // Update Redis asynchronously without blocking
    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        redis.set(cacheKey, isSaved ? "1" : "0", "EX", 300).catch(() => {});
      }
    } catch {}

    // Broadcast change to searchEventBus so other tabs/components update instantly
    searchEventBus.emitSearchEvent(`user:${userId}`, "opportunity_saved_changed", {
      userId,
      opportunityId,
      saved: isSaved,
    });
  }

  public invalidateSavedStatus(userId: string, opportunityId: string): void {
    const cacheKey = `saved_status:${userId}:${opportunityId}`;
    this.memCache.delete(cacheKey);
    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        redis.del(cacheKey).catch(() => {});
      }
    } catch {}
  }

  public getResolvedOpportunityId(idOrHash: string): string | null {
    return this.getMem<string>(`resolved_opp:${idOrHash}`);
  }

  public setResolvedOpportunityId(idOrHash: string, resolvedId: string): void {
    this.setMem(`resolved_opp:${idOrHash}`, resolvedId, 3600);
  }
}

export const fastButtonCache = new FastButtonCache();
