/**
 * §IDEMPOTENCY EXECUTION BOUNDARY (TASK-036)
 * 
 * Guarantees that retried operations (webhooks, discovery runs, alerts)
 * execute exactly once, caching and returning identical results for identical idempotency keys.
 */

export interface IdempotencyRecord<T = unknown> {
  key: string;
  result: T;
  executedAt: Date;
  expiresAt: Date;
}

export class IdempotencyManager {
  private cache: Map<string, IdempotencyRecord<any>> = new Map();

  public async run<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<{ executed: boolean; result: T }> {
    const now = Date.now();
    const existing = this.cache.get(key);

    if (existing && existing.expiresAt.getTime() > now) {
      return {
        executed: false,
        result: existing.result as T,
      };
    }

    const result = await fn();
    const expiresAt = new Date(now + ttlSeconds * 1000);

    this.cache.set(key, {
      key,
      result,
      executedAt: new Date(now),
      expiresAt,
    });

    return {
      executed: true,
      result,
    };
  }

  public async has(key: string): Promise<boolean> {
    const existing = this.cache.get(key);
    if (!existing) return false;
    return existing.expiresAt.getTime() > Date.now();
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const idempotency = new IdempotencyManager();
