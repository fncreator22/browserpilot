/**
 * §CANONICAL PRODUCTION SEARCH FAILURE MODEL & LIFECYCLE (TASK-057)
 * 
 * Centralized failure classification, secret-safe telemetry sanitization,
 * and search lifecycle state machine invariants.
 */

export type CanonicalSearchFailureCategory =
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
  | "SYSTEM_FAILURE"
  | "MODEL_CONFIGURATION_REQUIRED"
  | "MODEL_FAILURE"
  | "MODEL_TIMEOUT"
  | "MODEL_MALFORMED_RESPONSE"
  | "PLAN_VALIDATION_FAILURE"
  | "EVIDENCE_FAILURE"
  | "DATABASE_FAILURE"
  | "JOB_NOT_FOUND"
  | "JOB_CLOSED"
  | "NO_MATCHING_OPPORTUNITIES"
  | "TARGET_SHORTFALL"
  | "TIMEOUT"
  | "CANCELLED";

export type SearchFailureSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CanonicalSearchFailure {
  category: CanonicalSearchFailureCategory;
  severity: SearchFailureSeverity;
  retryable: boolean;
  userMessage: string;
  internalCode: string;
  source?: string;
  operation?: string;
  correlationId?: string;
  timestamp: Date;
}

export type SearchLifecycleState =
  | "RECEIVED"
  | "PLANNING"
  | "EXECUTING"
  | "VERIFYING"
  | "CORRECTING"
  | "COMPLETED"
  | "PARTIAL"
  | "NO_RESULTS"
  | "FAILED"
  | "UNAUTHORIZED"
  | "CANCELLED";

export const TERMINAL_SEARCH_STATES: ReadonlySet<SearchLifecycleState> = new Set([
  "COMPLETED",
  "PARTIAL",
  "NO_RESULTS",
  "FAILED",
  "UNAUTHORIZED",
  "CANCELLED",
]);

/**
 * Deterministically classifies errors into the 19 canonical failure categories.
 * Ensures userMessage NEVER exposes stack traces, credentials, or internal details.
 */
export function classifySearchFailure(
  err: unknown,
  context: {
    source?: string;
    operation?: string;
    correlationId?: string;
    stage?: SearchLifecycleState;
  } = {}
): CanonicalSearchFailure {
  const timestamp = new Date();
  const correlationId = context.correlationId;
  const source = context.source;
  const operation = context.operation;

  if (!err) {
    return {
      category: "SYSTEM_FAILURE",
      severity: "MEDIUM",
      retryable: false,
      userMessage: "An unexpected system issue occurred. Please try again.",
      internalCode: "ERR_UNKNOWN",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  const rawMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const errName = (err instanceof Error ? err.name : "").toLowerCase();

  // 1. Cancellation & Abort
  if (errName === "aborterror" || /\b(cancelled|canceled|aborted|request aborted|operation cancelled)\b/i.test(rawMsg)) {
    return {
      category: "CANCELLED",
      severity: "LOW",
      retryable: true,
      userMessage: "Search was cancelled by user request.",
      internalCode: "ERR_SEARCH_CANCELLED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 2. Model Timeout
  if (
    /\b(model timeout|llm timeout|gemini timeout)\b/i.test(rawMsg) ||
    ((context.stage === "PLANNING" || operation?.includes("model") || operation?.includes("planner")) &&
      /\b(timed out|timeout)\b/i.test(rawMsg))
  ) {
    return {
      category: "MODEL_TIMEOUT",
      severity: "MEDIUM",
      retryable: true,
      userMessage: "The AI planning model took too long to respond. Using deterministic search.",
      internalCode: "ERR_MODEL_TIMEOUT",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 3. Generic Timeout
  if (/\b(timed out|timeout|deadline exceeded|gateway timeout|504)\b/i.test(rawMsg)) {
    return {
      category: "TIMEOUT",
      severity: "MEDIUM",
      retryable: true,
      userMessage: "Search execution timed out. Please retry with a narrower search.",
      internalCode: "ERR_SEARCH_TIMEOUT",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 4. Database Failure
  if (/\b(prisma|database|unique constraint|foreign key|p2002|p2025|connection refused|sql|postgres|psql)\b|pg_/i.test(rawMsg)) {
    return {
      category: "DATABASE_FAILURE",
      severity: "HIGH",
      retryable: true,
      userMessage: "A database error occurred while saving search results.",
      internalCode: "ERR_DB_PERSISTENCE",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 4. Model Failures (LLM/Gemini)
  if (/\b(model timeout|llm timeout|gemini timeout)\b/i.test(rawMsg)) {
    return {
      category: "MODEL_TIMEOUT",
      severity: "MEDIUM",
      retryable: true,
      userMessage: "The AI planning model took too long to respond. Using deterministic search.",
      internalCode: "ERR_MODEL_TIMEOUT",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  if (/\b(malformed json|invalid model response|json parse|cannot parse tool plan|unexpected token)\b/i.test(rawMsg) && (context.stage === "PLANNING" || operation?.includes("model") || operation?.includes("planner"))) {
    return {
      category: "MODEL_MALFORMED_RESPONSE",
      severity: "MEDIUM",
      retryable: true,
      userMessage: "AI planner returned an invalid response. Falling back to deterministic plan.",
      internalCode: "ERR_MODEL_MALFORMED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  if (/\b(api key not found|missing gemini_api_key|model configuration required|ai_configuration_required|missing api key|unconfigured model)\b/i.test(rawMsg)) {
    return {
      category: "MODEL_CONFIGURATION_REQUIRED",
      severity: "MEDIUM",
      retryable: false,
      userMessage: "AI search planning is unavailable because the required model configuration is missing.",
      internalCode: "ERR_MODEL_CONFIG_REQUIRED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  if (/\b(job closed|posting closed|no longer open|is no longer open|position has been filled|application closed)\b/i.test(rawMsg)) {
    return {
      category: "JOB_CLOSED",
      severity: "LOW",
      retryable: false,
      userMessage: "The target job posting has closed and is no longer accepting applications.",
      internalCode: "ERR_JOB_CLOSED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  if (/\b(job not found|posting not found|the job you requested was not found|the job you are looking for doesn't exist)\b/i.test(rawMsg)) {
    return {
      category: "JOB_NOT_FOUND",
      severity: "LOW",
      retryable: false,
      userMessage: "The requested job posting was not found.",
      internalCode: "ERR_JOB_NOT_FOUND",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  if (/\b(quota exceeded|gemini error|llm error|model unavailable|gemini api|google genai|ai service)\b/i.test(rawMsg)) {
    return {
      category: "MODEL_FAILURE",
      severity: "MEDIUM",
      retryable: true,
      userMessage: "AI service temporarily unavailable. Using deterministic search engine.",
      internalCode: "ERR_MODEL_FAILURE",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 5. Plan Validation Failure
  if (/\b(plan validation|invalid action plan|forbidden capability|disallowed action|plan rejected)\b/i.test(rawMsg)) {
    return {
      category: "PLAN_VALIDATION_FAILURE",
      severity: "HIGH",
      retryable: false,
      userMessage: "Proposed search plan failed safety validation rules.",
      internalCode: "ERR_PLAN_VALIDATION",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 6. Evidence Failure
  if (/\b(evidence failure|evidence verification failed|screenshot failed|proof rejected|dom inspection failed)\b/i.test(rawMsg)) {
    return {
      category: "EVIDENCE_FAILURE",
      severity: "MEDIUM",
      retryable: true,
      userMessage: "Candidate could not be verified with live evidence proof.",
      internalCode: "ERR_EVIDENCE_VERIFICATION",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 7. Source Failures: CAPTCHA
  if (/\b(captcha|recaptcha|hcaptcha|turnstile|human verification|bot challenge|perimeterx|datadome)\b/i.test(rawMsg)) {
    return {
      category: "CAPTCHA_DETECTED",
      severity: "MEDIUM",
      retryable: false,
      userMessage: `${source || "Source"} presented an automated verification challenge.`,
      internalCode: "ERR_CAPTCHA_DETECTED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 8. Source Failures: Authentication
  if (/\b(session expired|token expired|invalid session|reauth)\b/i.test(rawMsg)) {
    return {
      category: "SESSION_EXPIRED",
      severity: "MEDIUM",
      retryable: false,
      userMessage: `Your session for ${source || "this source"} has expired. Please reconnect.`,
      internalCode: "ERR_SESSION_EXPIRED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  if (/\b(auth(entication)? required|unauthorized|401|login required)\b/i.test(rawMsg)) {
    return {
      category: "AUTH_REQUIRED",
      severity: "MEDIUM",
      retryable: false,
      userMessage: `Authentication required to access ${source || "this protected source"}.`,
      internalCode: "ERR_AUTH_REQUIRED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  if (/\b(user action required|mfa|2fa|otp|security prompt)\b/i.test(rawMsg)) {
    return {
      category: "USER_ACTION_REQUIRED",
      severity: "LOW",
      retryable: false,
      userMessage: `Manual confirmation required on ${source || "source website"}.`,
      internalCode: "ERR_USER_ACTION_REQUIRED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 9. Rate Limiting & Blocking
  if (/\b(rate limit|too many requests|429|throttl|quota exceeded)\b/i.test(rawMsg)) {
    return {
      category: "RATE_LIMITED",
      severity: "LOW",
      retryable: false,
      userMessage: `${source || "Source"} rate limit exceeded. Pausing requests.`,
      internalCode: "ERR_RATE_LIMITED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  if (/\b(blocked|forbidden|403|access denied|ip banned|cloudflare block)\b/i.test(rawMsg)) {
    return {
      category: "SOURCE_BLOCKED",
      severity: "MEDIUM",
      retryable: false,
      userMessage: `${source || "Source"} is currently restricting automated discovery.`,
      internalCode: "ERR_SOURCE_BLOCKED",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 10. Extraction Failure
  if (/\b(extraction|parse error|invalid json|selector not found)\b/i.test(rawMsg)) {
    return {
      category: "EXTRACTION_FAILURE",
      severity: "LOW",
      retryable: false,
      userMessage: `Could not parse data from ${source || "source"}.`,
      internalCode: "ERR_EXTRACTION_FAILURE",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 11. Network & Connectivity
  if (/\b(econnrefused|econnreset|enotfound|etimedout|socket hang up|dns|network error|fetch failed)\b/i.test(rawMsg)) {
    return {
      category: "NETWORK_FAILURE",
      severity: "LOW",
      retryable: true,
      userMessage: "A temporary network connectivity issue occurred.",
      internalCode: "ERR_NETWORK_FAILURE",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 12. Invalid Source
  if (/\b(invalid source|unsupported source|unknown platform)\b/i.test(rawMsg)) {
    return {
      category: "INVALID_SOURCE",
      severity: "LOW",
      retryable: false,
      userMessage: "Specified source platform is invalid or unsupported.",
      internalCode: "ERR_INVALID_SOURCE",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // 13. Temporary Fallback
  if (/\b(500|502|503|service unavailable|temporary)\b/i.test(rawMsg)) {
    return {
      category: "TEMPORARY_FAILURE",
      severity: "MEDIUM",
      retryable: true,
      userMessage: "A temporary service interruption occurred. Please retry.",
      internalCode: "ERR_TEMPORARY_FAILURE",
      source,
      operation,
      correlationId,
      timestamp,
    };
  }

  // Default: System Failure
  return {
    category: "SYSTEM_FAILURE",
    severity: "HIGH",
    retryable: false,
    userMessage: "A system issue prevented search completion. Please try again.",
    internalCode: "ERR_SYSTEM_FAILURE",
    source,
    operation,
    correlationId,
    timestamp,
  };
}

/**
 * Validates that a search outcome adheres to canonical terminal state invariants:
 * - COMPLETED: verifiedCount >= requestedCount
 * - PARTIAL: 0 < verifiedCount < requestedCount
 * - NO_RESULTS: verifiedCount === 0
 * - UNAUTHORIZED: no protected execution occurred
 * - FAILED: verifiedCount === 0 (no fabricated results)
 * - CANCELLED: aborted
 */
export function evaluateSearchTerminalState(params: {
  verifiedCount: number;
  requestedCount: number;
  isCancelled?: boolean;
  isUnauthorized?: boolean;
  isFailed?: boolean;
}): {
  terminalState: SearchLifecycleState;
  stoppingReason: string;
  explanation: string;
} {
  const { verifiedCount, requestedCount, isCancelled, isUnauthorized, isFailed } = params;

  if (isUnauthorized) {
    return {
      terminalState: "UNAUTHORIZED",
      stoppingReason: "AUTH_REQUIRED",
      explanation: "Authentication required to execute opportunity discovery.",
    };
  }

  if (isCancelled) {
    return {
      terminalState: "CANCELLED",
      stoppingReason: "CANCELLED_BY_USER",
      explanation: "Search execution was cancelled before completion.",
    };
  }

  if (isFailed) {
    return {
      terminalState: "FAILED",
      stoppingReason: "EXECUTION_ERROR",
      explanation: "Search execution failed. No opportunities could be verified.",
    };
  }

  if (verifiedCount >= requestedCount) {
    return {
      terminalState: "COMPLETED",
      stoppingReason: "TARGET_SATISFIED",
      explanation: `Found ${verifiedCount} verified opportunities matching your criteria.`,
    };
  }

  if (verifiedCount > 0) {
    const shortfall = requestedCount - verifiedCount;
    return {
      terminalState: "PARTIAL",
      stoppingReason: "EXHAUSTED",
      explanation: `Found ${verifiedCount} verified opportunities (${shortfall} short of requested ${requestedCount}). Some sources were unavailable.`,
    };
  }

  return {
    terminalState: "NO_RESULTS",
    stoppingReason: "NO_RESULTS",
    explanation: "No verified opportunities found matching your criteria across active sources.",
  };
}

/**
 * Deep recursive secret and credential sanitizer for telemetry, logs, and client responses.
 * Strictly redacts passwords, tokens, API keys, cookies, auth headers, and session credentials.
 */
export function sanitizeSearchTelemetry<T>(value: T): T {
  if (value === null || value === undefined) return value;

  const SENSITIVE_KEY_PATTERNS = [
    /pass(word)?/i,
    /secret/i,
    /token/i,
    /cookie/i,
    /auth(orization)?/i,
    /bearer/i,
    /key/i,
    /session(id)?/i,
    /credential/i,
    /private/i,
  ];

  const SENSITIVE_VALUE_PATTERNS = [
    /bearer\s+[a-zA-Z0-9_\-\.]+/i,
    /sk-[a-zA-Z0-9_\-]{20,}/i,
    /AIza[0-9A-Za-z\-_]{35}/i,
    /password\s*=\s*['"]?[^'"\s]+/i,
    /api[_-]?key\s*[:=]\s*['"]?[^'"\s]+/i,
  ];

  if (typeof value === "string") {
    let sanitized: string = String(value);
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED_CREDENTIAL]");
    }
    return sanitized as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSearchTelemetry(item)) as unknown as T;
  }

  if (typeof value === "object" && !(value instanceof Date)) {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const isKeySensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(k));
      if (isKeySensitive) {
        sanitizedObj[k] = "[REDACTED]";
      } else {
        sanitizedObj[k] = sanitizeSearchTelemetry(v);
      }
    }
    return sanitizedObj as unknown as T;
  }

  return value;
}
