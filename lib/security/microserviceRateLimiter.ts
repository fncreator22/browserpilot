/**
 * Microservice-Level Rate Limiter Gateway
 * 
 * Enforces differentiated rate limiting across modular microservice domains:
 * - auth: Strict protection against credential stuffing & brute-force
 * - payments: Protection against duplicate transactions & checkout card stuffing
 * - accounts: User profile and memory state updates
 * - search: Public and authenticated career discovery queries
 * - swarm: Scheduled minion worker triggers & background crawlers
 */

import { rateLimiter, type RateLimitResult } from "./rateLimiter";

export type MicroserviceDomain = "auth" | "payments" | "accounts" | "search" | "swarm";

export interface DomainRateLimitPolicy {
  limit: number;
  windowSeconds: number;
  priorityLimit?: number; // Elevated limit for Pro / Enterprise users
}

export const MICROSERVICE_POLICIES: Record<MicroserviceDomain, DomainRateLimitPolicy> = {
  auth: {
    limit: 5,
    windowSeconds: 10, // 5 requests per 10 seconds per IP
  },
  payments: {
    limit: 10,
    windowSeconds: 60, // 10 requests per minute per user/IP
  },
  accounts: {
    limit: 30,
    windowSeconds: 60, // 30 requests per minute
  },
  search: {
    limit: 20,
    windowSeconds: 60, // 20 requests per minute for free tier
    priorityLimit: 120, // 120 requests per minute for Pro / Enterprise
  },
  swarm: {
    limit: 60,
    windowSeconds: 60, // 60 automated minion triggers per minute
  },
};

export interface MicroserviceRateLimitCheck {
  allowed: boolean;
  domain: MicroserviceDomain;
  identifier: string;
  limit: number;
  remaining: number;
  resetSeconds: number;
  headers: Record<string, string>;
  errorResponse?: {
    status: number;
    body: {
      error: string;
      domain: MicroserviceDomain;
      limit: number;
      retryAfterSeconds: number;
    };
  };
}

/**
 * Check rate limit for a specific microservice domain and identifier (IP or User ID)
 */
export async function checkMicroserviceRateLimit(
  domain: MicroserviceDomain,
  identifier: string,
  isPriorityUser: boolean = false
): Promise<MicroserviceRateLimitCheck> {
  const policy = MICROSERVICE_POLICIES[domain];
  if (!policy) {
    throw new Error(`Unknown microservice domain: ${domain}`);
  }

  const effectiveLimit = isPriorityUser && policy.priorityLimit ? policy.priorityLimit : policy.limit;
  const key = `ms:${domain}:${identifier}`;

  const result: RateLimitResult = await rateLimiter.check(key, effectiveLimit, policy.windowSeconds, true);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(effectiveLimit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetSeconds),
  };

  if (!result.success) {
    headers["Retry-After"] = String(result.resetSeconds);
    return {
      allowed: false,
      domain,
      identifier,
      limit: effectiveLimit,
      remaining: 0,
      resetSeconds: result.resetSeconds,
      headers,
      errorResponse: {
        status: 429,
        body: {
          error: `Rate limit exceeded for ${domain} microservice. Please retry in ${result.resetSeconds}s.`,
          domain,
          limit: effectiveLimit,
          retryAfterSeconds: result.resetSeconds,
        },
      },
    };
  }

  return {
    allowed: true,
    domain,
    identifier,
    limit: effectiveLimit,
    remaining: result.remaining,
    resetSeconds: result.resetSeconds,
    headers,
  };
}

/**
 * Reset rate limit for a domain identifier (e.g. after successful 2FA or admin override)
 */
export async function resetMicroserviceRateLimit(domain: MicroserviceDomain, identifier: string): Promise<void> {
  const key = `ms:${domain}:${identifier}`;
  await rateLimiter.reset(key);
}
