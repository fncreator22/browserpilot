import { getSharedRedisClient, isRedisCircuitAvailable } from "@/lib/queue/redis";

export interface CachedUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  passwordHash?: string | null;
  cachedAt?: number;
}

const CACHE_TTL_SECONDS = 3600; // 1 hour TTL
const KEY_PREFIX = "auth:user:";

/**
 * Retrieves a cached user identity from Redis to prevent repetitive PostgreSQL queries.
 */
export async function getCachedUser(email: string): Promise<CachedUser | null> {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (!isAvailable) return null;

    const redis = getSharedRedisClient();
    const raw = await redis.get(`${KEY_PREFIX}${normalizedEmail}`);
    if (!raw) return null;

    return JSON.parse(raw) as CachedUser;
  } catch (err) {
    // Non-fatal fallback to PostgreSQL
    return null;
  }
}

/**
 * Stores a verified user session identity into Redis with a 1-hour expiration.
 */
export async function setCachedUser(user: CachedUser): Promise<void> {
  if (!user?.email) return;
  const normalizedEmail = user.email.toLowerCase().trim();

  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (!isAvailable) return;

    const redis = getSharedRedisClient();
    const payload = JSON.stringify({
      id: user.id,
      email: normalizedEmail,
      name: user.name || null,
      role: user.role || "USER",
      passwordHash: user.passwordHash || null,
      cachedAt: Date.now(),
    });

    await redis.set(`${KEY_PREFIX}${normalizedEmail}`, payload, "EX", CACHE_TTL_SECONDS);
  } catch (err) {
    // Non-fatal cache set failure
  }
}

/**
 * Evicts user cache entry from Redis when credentials, roles, or settings are modified.
 */
export async function invalidateCachedUser(email: string): Promise<void> {
  if (!email) return;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (!isAvailable) return;

    const redis = getSharedRedisClient();
    await redis.del(`${KEY_PREFIX}${normalizedEmail}`);
  } catch (err) {
    // Non-fatal
  }
}
