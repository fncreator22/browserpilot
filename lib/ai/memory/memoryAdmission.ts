/**
 * §MEMORY ADMISSION POLICY & EVALUATOR (TASK-047)
 * 
 * Evaluates candidate memory items before storage:
 * 1. Blocks transient queries and ephemeral interactions
 * 2. Filters out secrets, passwords, cookies, session tokens, and keys
 * 3. Enforces confidence and importance scoring
 * 4. Strictly separates user preferences from recommendation signals
 */

import {
  type MemoryAdmissionCandidate,
  type MemoryAdmissionDecision,
  type MemoryCategory,
  type MemoryConfidence,
} from "./memoryTypes";

const TRANSIENT_QUERY_PATTERNS = [
  /^(search|find|show|give|fetch|get|look|list)\b.*(for me|again|now|please)?$/i,
  /^(search|find|show|give)\s+\d+\s+(results|jobs|items|positions)/i,
  /^why did this (disappear|change|fail|break)/i,
  /^click\s+|^navigate\s+to|^scroll\s+|^type\s+/i,
  /^hello|^hi|^hey|^thanks|^thank you|^ok|^yes|^no$/i,
  /^give me \d+ (backend|frontend|software|engineer)/i,
];

const SENSITIVE_CREDENTIAL_PATTERNS = [
  /pass(word)?\s*[:=]/i,
  /api[_-]?key\s*[:=]/i,
  /bearer\s+[a-zA-Z0-9_\-\.]{15,}/i,
  /jwt\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/i,
  /session[_-]?id\s*[:=]/i,
  /cookie\s*[:=]/i,
  /secret[_-]?key\s*[:=]/i,
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Credit card regex
  /BEGIN\s+(RSA|EC|PRIVATE)\s+KEY/i,
];

const VALID_PREFERENCE_CATEGORIES: Set<MemoryCategory> = new Set([
  "PROFILE_PREFERENCE",
  "CAREER_PREFERENCE",
  "LOCATION_PREFERENCE",
  "WORK_MODE_PREFERENCE",
  "ROLE_PREFERENCE",
  "SKILL_INTEREST",
  "INDUSTRY_INTEREST",
  "SEARCH_PREFERENCE",
  "SOURCE_PREFERENCE",
  "RESULT_FEEDBACK",
  "RECOMMENDATION_SIGNAL",
  "EXPLICIT_USER_INSTRUCTION",
]);

/**
 * Evaluates whether a candidate user memory should be admitted to the User Memory Vault.
 */
export function evaluateMemoryAdmission(candidate: MemoryAdmissionCandidate): MemoryAdmissionDecision {
  if (!candidate.userId || typeof candidate.userId !== "string" || candidate.userId.trim() === "") {
    return {
      admitted: false,
      rejectionReason: "MISSING_USER_ID: Candidate memory must be strictly tenant-bound to a valid userId.",
    };
  }

  if (!VALID_PREFERENCE_CATEGORIES.has(candidate.category)) {
    return {
      admitted: false,
      rejectionReason: `INVALID_CATEGORY: Category "${candidate.category}" is not in the allowed taxonomy.`,
    };
  }

  const rawValueStr = typeof candidate.value === "string" ? candidate.value : JSON.stringify(candidate.value);
  const rawKeyStr = candidate.key.trim();
  const rawContextStr = candidate.sourceContext || "";

  // 1. Security & Credential Check (Zero-Tolerance)
  const fullPayload = `${rawKeyStr} ${rawValueStr} ${rawContextStr}`;
  for (const pattern of SENSITIVE_CREDENTIAL_PATTERNS) {
    if (pattern.test(fullPayload)) {
      return {
        admitted: false,
        rejectionReason: "SECURITY_CREDENTIAL_DETECTED: Candidate memory contains sensitive keys, passwords, or session tokens.",
      };
    }
  }

  // 2. Transient Query Filter
  if (candidate.category === "EXPLICIT_USER_INSTRUCTION" || candidate.category === "SEARCH_PREFERENCE") {
    const isTransient = TRANSIENT_QUERY_PATTERNS.some((p) => p.test(rawValueStr.trim()) || p.test(rawContextStr.trim()));
    if (isTransient) {
      return {
        admitted: false,
        rejectionReason: "TRANSIENT_INTERACTION: One-off search commands and navigational instructions are not persistent memory.",
      };
    }
  }

  // 3. Minimum Content Quality
  if (rawValueStr.trim().length < 2) {
    return {
      admitted: false,
      rejectionReason: "INSUFFICIENT_CONTENT: Memory value is too short to provide future personalization value.",
    };
  }

  // 4. Recommendation vs User Preference Separation
  let category = candidate.category;
  let confidence: MemoryConfidence = candidate.confidence || (candidate.isExplicit ? "EXPLICIT" : "INFERRED");
  let importance = candidate.importance ?? (confidence === "EXPLICIT" ? 0.9 : 0.6);

  if (category === "RECOMMENDATION_SIGNAL") {
    // Recommendation signals must never be marked as EXPLICIT user preferences
    if (confidence === "EXPLICIT") {
      confidence = "INFERRED";
    }
    importance = Math.min(importance, 0.7);
  }

  // 5. Expiration Calculation
  let expiresAt: Date | null = null;
  if (candidate.expiresInHours !== undefined) {
    expiresAt = new Date(Date.now() + candidate.expiresInHours * 3600 * 1000);
  } else if (confidence === "TEMPORARY") {
    expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days default for temporary memories
  }

  return {
    admitted: true,
    sanitizedCandidate: {
      userId: candidate.userId.trim(),
      category,
      key: rawKeyStr.toLowerCase(),
      value: rawValueStr,
      confidence,
      importance: Math.max(0.1, Math.min(1.0, importance)),
      expiresAt,
      sourceContext: candidate.sourceContext ? candidate.sourceContext.slice(0, 200) : undefined,
    },
  };
}
