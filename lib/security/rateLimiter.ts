/**
 * §RATE LIMITING & ABUSE RESISTANCE BOUNDARY (TASK-034)
 * 
 * Modular rate limiting interface supporting in-memory sliding window
 * with direct extensibility for Redis / AWS ElastiCache.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export interface RateLimiterAdapter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export class MemoryRateLimiter implements RateLimiterAdapter {
  private requests: Map<string, number[]> = new Map();

  public async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    const timestamps = (this.requests.get(key) || []).filter((t) => t > cutoff);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0] || now;
      const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return {
        success: false,
        limit,
        remaining: 0,
        resetSeconds,
      };
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);

    return {
      success: true,
      limit,
      remaining: limit - timestamps.length,
      resetSeconds: windowSeconds,
    };
  }

  public async reset(key: string): Promise<void> {
    this.requests.delete(key);
  }
}

export const rateLimiter: RateLimiterAdapter = new MemoryRateLimiter();
