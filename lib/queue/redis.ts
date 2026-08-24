import Redis, { type RedisOptions } from "ioredis";
import { config } from "dotenv";

config();

export function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

export function getRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying after 3 attempts
      }
      return Math.min(times * 200, 1000);
    },
  };
}

/**
 * Creates an isolated ioredis connection for BullMQ
 */
export function createRedisConnection(): Redis {
  const url = getRedisUrl();
  return new Redis(url, getRedisOptions());
}

/**
 * Checks connectivity to Redis and returns detailed status
 */
export async function checkRedisHealth(): Promise<{
  connected: boolean;
  url: string;
  error?: string;
  troubleshooting?: string;
}> {
  const url = getRedisUrl();
  const client = new Redis(url, {
    ...getRedisOptions(),
    connectTimeout: 3000,
  });

  try {
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return {
      connected: pong === "PONG",
      url,
    };
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    return {
      connected: false,
      url,
      error: errorMsg,
      troubleshooting: `Could not connect to Redis at ${url}. Please ensure Redis is running locally (e.g. 'docker run -d -p 6379:6379 redis:alpine') or set REDIS_URL in .env.`,
    };
  }
}
