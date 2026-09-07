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

let sharedRedisClient: Redis | null = null;
let sharedRedisSubscriber: Redis | null = null;

/**
 * Creates an isolated ioredis connection for BullMQ or dedicated tasks
 */
export function createRedisConnection(customOptions?: Partial<RedisOptions>): Redis {
  const url = getRedisUrl();
  const client = new Redis(url, { ...getRedisOptions(), ...customOptions });
  client.on("error", () => {
    // Non-fatal error handler to prevent unhandled error event crash when Redis is offline
  });
  return client;
}

/**
 * Shared singleton Redis client for regular commands across the application
 */
export function getSharedRedisClient(): Redis {
  if (!sharedRedisClient) {
    sharedRedisClient = createRedisConnection();
  }
  return sharedRedisClient;
}

/**
 * Shared singleton Redis client specifically for Pub/Sub subscriptions
 */
export function getSharedRedisSubscriber(): Redis {
  if (!sharedRedisSubscriber) {
    sharedRedisSubscriber = createRedisConnection();
  }
  return sharedRedisSubscriber;
}

/**
 * Overrides the shared Redis clients (primarily for multi-instance tests)
 */
export function setSharedRedisClients(client: Redis | null, subscriber: Redis | null): void {
  sharedRedisClient = client;
  sharedRedisSubscriber = subscriber;
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
  client.on("error", () => {}); // Catch offline ECONNREFUSED in diagnostic health check

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

/**
 * Strict verification of live Redis connectivity.
 * Fails loudly with an explicit Error if REDIS_URL is a placeholder,
 * missing, or unreachable. Prevents misconfigured test or production environments
 * from silently masquerading as a passing distributed-state system.
 */
export async function assertLiveRedisConnectivity(options: { allowLocalhost?: boolean } = {}): Promise<{
  endpoint: string;
  isUpstash: boolean;
  latencyMs: number;
}> {
  const url = getRedisUrl();

  if (!url) {
    throw new Error(
      "[REDIS_CONFIG_ERROR] REDIS_URL environment variable is missing. A valid Redis connection string (redis:// or rediss://) is required."
    );
  }

  const isLocalhost = url.includes("127.0.0.1") || url.includes("localhost");
  if (isLocalhost && !options.allowLocalhost) {
    throw new Error(
      `[REDIS_PLACEHOLDER_ERROR] REDIS_URL is pointing to local placeholder "${url}". A live managed Redis instance (e.g. Upstash Pay-As-You-Go rediss://...) is required for distributed load testing.`
    );
  }

  const client = new Redis(url, {
    ...getRedisOptions(),
    connectTimeout: 4000,
    retryStrategy: () => null,
  });

  const t0 = performance.now();
  try {
    await client.connect();
    const pong = await client.ping();
    const latencyMs = Math.round(performance.now() - t0);
    await client.quit();

    if (pong !== "PONG") {
      throw new Error(`Expected PONG from Redis, received: ${pong}`);
    }

    const isUpstash = url.includes("upstash.io");
    return {
      endpoint: url.replace(/:[^:@]+@/, ":****@"),
      isUpstash,
      latencyMs,
    };
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    throw new Error(
      `[REDIS_CONNECTIVITY_FAILED] Could not connect to live Redis at ${url.replace(/:[^:@]+@/, ":****@")}.\n` +
      `Reason: ${errorMsg}\n` +
      `Ensure the live Upstash Pay-As-You-Go instance is reachable and credentials in REDIS_URL are valid.`
    );
  }
}


