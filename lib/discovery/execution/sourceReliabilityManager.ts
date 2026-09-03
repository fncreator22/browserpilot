/**
 * §SOURCE RELIABILITY, OBSERVABILITY & FAILURE RECOVERY MANAGER (TASK-046)
 * 
 * Provides deterministic failure classification, bounded retry policies,
 * circuit-breaker cooldown protection with automatic recovery, and secret-safe telemetry.
 */

export type SourceFailureCategory =
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "USER_ACTION_REQUIRED"
  | "RATE_LIMITED"
  | "SOURCE_BLOCKED"
  | "CAPTCHA_DETECTED"
  | "TEMPORARY_FAILURE"
  | "NETWORK_FAILURE"
  | "EXTRACTION_FAILURE"
  | "INVALID_SOURCE"
  | "SYSTEM_FAILURE";

export interface CanonicalSourceExecutionResult {
  sourceName: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED" | "TIMEOUT";
  durationMs: number;
  candidatesHarvested: number;
  candidatesAccepted: number;
  candidatesRejected: number;
  failureCategory?: SourceFailureCategory;
  retryCount: number;
  isAuthenticated: boolean;
  captchaDetected: boolean;
  rateLimited: boolean;
  skipped: boolean;
  timedOut: boolean;
  userFacingMessage?: string;
  correlationId?: string;
}

export interface SourceHealthRecord {
  sourceName: string;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureCategory?: SourceFailureCategory;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  cooldownUntil?: Date | null;
  status: "HEALTHY" | "DEGRADED" | "COOLDOWN";
}

/**
 * Deterministically classifies errors into canonical failure categories.
 */
export function classifySourceError(err: unknown): {
  category: SourceFailureCategory;
  isTransient: boolean;
  userFacingMessage: string;
} {
  if (!err) {
    return {
      category: "SYSTEM_FAILURE",
      isTransient: false,
      userFacingMessage: "An unexpected internal error occurred.",
    };
  }

  const rawMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const errName = (err instanceof Error ? err.name : "").toLowerCase();

  // 1. CAPTCHA Detection
  if (/\b(captcha|recaptcha|hcaptcha|turnstile|human verification|bot challenge|perimeterx|datadome)\b/i.test(rawMsg)) {
    return {
      category: "CAPTCHA_DETECTED",
      isTransient: false,
      userFacingMessage: "Automated verification required by source.",
    };
  }

  // 2. Authentication & Session
  if (/\b(session expired|token expired|invalid session|reauth|session terminated)\b/i.test(rawMsg)) {
    return {
      category: "SESSION_EXPIRED",
      isTransient: false,
      userFacingMessage: "Session has expired. Re-authentication required.",
    };
  }

  if (/\b(auth(entication)? required|unauthorized|401|login required|credentials missing)\b/i.test(rawMsg)) {
    return {
      category: "AUTH_REQUIRED",
      isTransient: false,
      userFacingMessage: "Authentication required to access this source.",
    };
  }

  if (/\b(user action required|mfa|2fa|otp|verification code|security prompt)\b/i.test(rawMsg)) {
    return {
      category: "USER_ACTION_REQUIRED",
      isTransient: false,
      userFacingMessage: "Additional security verification required by user.",
    };
  }

  // 3. Rate Limiting & Blocking
  if (/\b(rate limit|too many requests|429|throttl|quota exceeded)\b/i.test(rawMsg)) {
    return {
      category: "RATE_LIMITED",
      isTransient: false,
      userFacingMessage: "Source rate limit exceeded. Pausing requests.",
    };
  }

  if (/\b(blocked|forbidden|403|access denied|ip banned|cloudflare block|access restricted)\b/i.test(rawMsg)) {
    return {
      category: "SOURCE_BLOCKED",
      isTransient: false,
      userFacingMessage: "Source is currently restricting automated access.",
    };
  }

  // 4. Timeouts & Temporary Failures
  if (errName === "aborterror" || /\b(timeout|timed out|abort|504|503|502|gateway timeout|service unavailable)\b/i.test(rawMsg)) {
    return {
      category: "TEMPORARY_FAILURE",
      isTransient: true,
      userFacingMessage: "Source request timed out. Please retry shortly.",
    };
  }

  // 5. Network & Connectivity
  if (/\b(econnrefused|econnreset|enotfound|etimedout|socket hang up|dns|network error|fetch failed)\b/i.test(rawMsg)) {
    return {
      category: "NETWORK_FAILURE",
      isTransient: true,
      userFacingMessage: "Temporary network connection failure.",
    };
  }

  // 6. Extraction & Data parsing
  if (/\b(extraction|parse error|invalid json|dom parsing|selector not found|malformed response)\b/i.test(rawMsg)) {
    return {
      category: "EXTRACTION_FAILURE",
      isTransient: false,
      userFacingMessage: "Source response format could not be parsed.",
    };
  }

  // 7. Invalid source
  if (/\b(invalid source|unsupported source|unknown platform|connector not found)\b/i.test(rawMsg)) {
    return {
      category: "INVALID_SOURCE",
      isTransient: false,
      userFacingMessage: "Specified source is invalid or unsupported.",
    };
  }

  return {
    category: "SYSTEM_FAILURE",
    isTransient: false,
    userFacingMessage: "A temporary system issue prevented search execution.",
  };
}

/**
 * Evaluates whether an error category is transient and eligible for a bounded retry.
 */
export function isTransientFailure(category: SourceFailureCategory): boolean {
  return category === "TEMPORARY_FAILURE" || category === "NETWORK_FAILURE";
}

/**
 * Sanitizes telemetry payloads to prevent secret leakage (passwords, cookies, tokens).
 */
export function sanitizeTelemetryPayload<T extends Record<string, unknown>>(payload: T): T {
  const sensitiveKeys = [/pass(word)?/i, /secret/i, /token/i, /cookie/i, /auth(orization)?/i, /key/i, /bearer/i];
  const sanitized: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(payload)) {
    const isSensitive = sensitiveKeys.some((pattern) => pattern.test(k));
    if (isSensitive) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date)) {
      sanitized[k] = sanitizeTelemetryPayload(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized as T;
}

/**
 * In-memory circuit breaker and health store for source platforms.
 */
export class SourceReliabilityManager {
  private healthMap = new Map<string, SourceHealthRecord>();
  private readonly failureThreshold = 3;
  private readonly defaultCooldownMs = 60 * 1000; // 1 minute cooldown

  /**
   * Evaluates whether a source should be skipped due to active circuit-breaker cooldown.
   */
  public shouldSkipSource(sourceName: string, now: Date = new Date()): { skip: boolean; reason?: string } {
    const key = sourceName.trim().toLowerCase();
    const record = this.healthMap.get(key);
    if (!record) return { skip: false };

    if (record.status === "COOLDOWN" && record.cooldownUntil) {
      if (now.getTime() < record.cooldownUntil.getTime()) {
        const remainingSec = Math.ceil((record.cooldownUntil.getTime() - now.getTime()) / 1000);
        return {
          skip: true,
          reason: `Source "${sourceName}" is in cooldown for ${remainingSec}s following repeated failures (${record.lastFailureCategory || "UNKNOWN"}).`,
        };
      }
      // Cooldown expired -> automatically restore to DEGRADED probe mode
      record.status = "DEGRADED";
      record.cooldownUntil = null;
    }

    return { skip: false };
  }

  /**
   * Records a source outcome and updates consecutive failure/recovery state.
   */
  public recordOutcome(
    sourceName: string,
    outcome: "SUCCESS" | "FAILURE",
    category?: SourceFailureCategory,
    now: Date = new Date()
  ): SourceHealthRecord {
    const key = sourceName.trim().toLowerCase();
    let record = this.healthMap.get(key);

    if (!record) {
      record = {
        sourceName: sourceName.trim(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        status: "HEALTHY",
      };
      this.healthMap.set(key, record);
    }

    if (outcome === "SUCCESS") {
      record.consecutiveSuccesses++;
      record.consecutiveFailures = 0;
      record.lastSuccessAt = now;
      record.status = "HEALTHY";
      record.cooldownUntil = null;
    } else {
      record.consecutiveSuccesses = 0;
      record.consecutiveFailures++;
      record.lastFailureAt = now;
      record.lastFailureCategory = category || "SYSTEM_FAILURE";

      if (record.consecutiveFailures >= this.failureThreshold) {
        record.status = "COOLDOWN";
        record.cooldownUntil = new Date(now.getTime() + this.defaultCooldownMs);
      } else {
        record.status = "DEGRADED";
      }
    }

    return record;
  }

  /**
   * Resets all in-memory circuit breaker states (useful in testing).
   */
  public resetAll(): void {
    this.healthMap.clear();
  }

  /**
   * Gets current health record for a source.
   */
  public getHealth(sourceName: string): SourceHealthRecord {
    const key = sourceName.trim().toLowerCase();
    return (
      this.healthMap.get(key) || {
        sourceName: sourceName.trim(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        status: "HEALTHY",
      }
    );
  }

  /**
   * Returns all active source health records for admin observability.
   */
  public getAllHealthRecords(): SourceHealthRecord[] {
    return Array.from(this.healthMap.values());
  }
}

export const sourceReliabilityManager = new SourceReliabilityManager();
