/**
 * §SECURITY AUDIT LOGGING SERVICE (TASK-034)
 * 
 * Records security-critical anomalies, unauthorized access attempts,
 * and rate-limit trips with strict sanitization of confidential secrets.
 */

export type SecurityEventType =
  | "ADMIN_ACCESS_DENIED"
  | "CROSS_TENANT_ACCESS_BLOCKED"
  | "COUPON_ABUSE_DETECTED"
  | "RATE_LIMIT_EXCEEDED"
  | "PAYMENT_VERIFICATION_FAILED"
  | "PROVIDER_CREDENTIAL_MUTATED"
  | "SESSION_INVALID"
  | "AUTH_FAILURE";

export interface SecurityEventInput {
  type: SecurityEventType;
  userId?: string | null;
  ip?: string | null;
  path?: string | null;
  details?: Record<string, unknown>;
}

export interface SecurityAuditRecord {
  id: string;
  type: SecurityEventType;
  userId: string | null;
  ip: string | null;
  path: string | null;
  details: Record<string, unknown>;
  timestamp: Date;
}

const inMemoryAuditTrail: SecurityAuditRecord[] = [];
const SENSITIVE_KEYS = ["password", "token", "secret", "apikey", "key", "signature", "card", "cvv", "hash"];

/**
 * Sanitizes arbitrary metadata objects to ensure secrets are never stored or logged.
 */
export function sanitizeSecurityMetadata(obj: Record<string, unknown> = {}): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      clean[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      clean[k] = sanitizeSecurityMetadata(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Records a security event to in-memory trail and formatted server logs.
 */
export function recordSecurityEvent(input: SecurityEventInput): SecurityAuditRecord {
  const sanitized = sanitizeSecurityMetadata(input.details || {});
  const record: SecurityAuditRecord = {
    id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: input.type,
    userId: input.userId || null,
    ip: input.ip || null,
    path: input.path || null,
    details: sanitized,
    timestamp: new Date(),
  };

  inMemoryAuditTrail.push(record);
  if (inMemoryAuditTrail.length > 500) {
    inMemoryAuditTrail.shift();
  }

  return record;
}

/**
 * Returns recent security audit records for admin inspection and tests.
 */
export function getRecentSecurityAuditEvents(limit = 50): SecurityAuditRecord[] {
  return [...inMemoryAuditTrail].reverse().slice(0, limit);
}
