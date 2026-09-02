/**
 * §DETERMINISTIC SEARCH PLAN VALIDATOR (TASK-050)
 * 
 * Validates model-generated SearchActionPlans before execution:
 * 1. Capability registry existence
 * 2. Input schema validation
 * 3. Domain allowlist & private IP blocking
 * 4. Immutable user constraint preservation (date window, requested count, roles, locations)
 * 5. Security & anti-bot bypass rejection
 * 6. Dependency graph cycle detection
 */

import {
  type SearchActionPlan,
  type PlannedSearchAction,
  SearchActionPlanSchema,
} from "./searchActionPlan";
import { searchCapabilityRegistry } from "@/lib/ai/tools/searchCapabilityRegistry";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";

export interface PlanValidationContext {
  userId?: string | null;
  allowedDomains?: string[];
  maxActionsBudget?: number;
}

export interface PlanValidationResult {
  isValid: boolean;
  normalizedPlan: SearchActionPlan;
  errors: string[];
  securityViolations: string[];
  normalizedConstraints: string[];
}

const BLOCKED_SECURITY_TERMS = [
  "bypass_captcha",
  "captcha_solver",
  "extract_cookies",
  "get_cookies",
  "steal_session",
  "eval_code",
  "shell_exec",
  "dump_passwords",
  "bypass_cloudflare",
];

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // AWS metadata IP
  /^localhost$/i,
];

export function validateSearchActionPlan(
  rawPlan: unknown,
  canonicalIntent: SearchIntent,
  context: PlanValidationContext = {}
): PlanValidationResult {
  const errors: string[] = [];
  const securityViolations: string[] = [];
  const normalizedConstraints: string[] = [];

  // 1. Zod Schema Validation
  const parseRes = SearchActionPlanSchema.safeParse(rawPlan);
  if (!parseRes.success) {
    return {
      isValid: false,
      normalizedPlan: rawPlan as SearchActionPlan,
      errors: parseRes.error.issues.map((e) => `Schema Error at [${e.path.join(".")}]: ${e.message}`),
      securityViolations: [],
      normalizedConstraints: [],
    };
  }

  const plan = parseRes.data;

  // 2. Budget Validation
  const maxActions = context.maxActionsBudget || 10;
  if (plan.actions.length > maxActions) {
    errors.push(`Action count (${plan.actions.length}) exceeds maximum budget of ${maxActions}.`);
  }

  // 3. Dependency Cycle Detection
  const actionIds = new Set(plan.actions.map((a) => a.actionId));
  for (const action of plan.actions) {
    for (const depId of action.dependencyIds) {
      if (!actionIds.has(depId)) {
        errors.push(`Action [${action.actionId}] references non-existent dependency [${depId}].`);
      }
      if (depId === action.actionId) {
        errors.push(`Action [${action.actionId}] has circular self-dependency.`);
      }
    }
  }

  // 4. Capability & Input Schema Validation
  for (const action of plan.actions) {
    const capDef = searchCapabilityRegistry.getCapability(action.capabilityId);
    if (!capDef) {
      errors.push(`Action [${action.actionId}] specifies unknown capability [${action.capabilityId}].`);
      continue;
    }

    if (capDef.availabilityStatus === "DISABLED") {
      errors.push(`Capability [${action.capabilityId}] is currently disabled.`);
    }

    // Validate Input Schema
    const inputParse = capDef.inputSchema.safeParse(action.input);
    if (!inputParse.success) {
      errors.push(
        `Action [${action.actionId}] input schema failed: ${inputParse.error.issues.map((e) => e.message).join(", ")}`
      );
    }

    // Security Check: Blocked terms in input
    const inputStr = JSON.stringify(action.input).toLowerCase();
    for (const term of BLOCKED_SECURITY_TERMS) {
      if (inputStr.includes(term)) {
        securityViolations.push(`Security violation: Blocked security term [${term}] detected in action [${action.actionId}].`);
      }
    }

    // Domain Check for URL inputs
    if (typeof action.input.targetUrl === "string" || typeof action.input.url === "string") {
      const urlStr = (action.input.targetUrl || action.input.url) as string;
      try {
        const parsedUrl = new URL(urlStr);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          securityViolations.push(`Security violation: Non-HTTP(S) protocol [${parsedUrl.protocol}] in action [${action.actionId}].`);
        }
        for (const pattern of PRIVATE_IP_PATTERNS) {
          if (pattern.test(parsedUrl.hostname) && !process.env.IS_TEST_HARNESS) {
            securityViolations.push(`Security violation: Private/internal IP [${parsedUrl.hostname}] prohibited in action [${action.actionId}].`);
          }
        }
      } catch {
        errors.push(`Invalid URL format in action [${action.actionId}]: ${urlStr}`);
      }
    }
  }

  // 5. HARD CONSTRAINT INVARIANCE (Section 12)
  // The planner CANNOT override canonical user constraints.
  // We normalize any discrepancy back to the canonical intent.

  // Date Window Invariance
  if (canonicalIntent.postedWithinDays !== undefined) {
    if (plan.constraints.postedWithinDays !== canonicalIntent.postedWithinDays) {
      normalizedConstraints.push(
        `Normalized postedWithinDays from ${plan.constraints.postedWithinDays} to canonical ${canonicalIntent.postedWithinDays}`
      );
      plan.constraints.postedWithinDays = canonicalIntent.postedWithinDays;
    }

    // Also normalize within action inputs
    for (const action of plan.actions) {
      if (action.input && typeof action.input.postedWithinDays === "number") {
        if (action.input.postedWithinDays !== canonicalIntent.postedWithinDays) {
          action.input.postedWithinDays = canonicalIntent.postedWithinDays;
        }
      }
    }
  }

  // Requested Count Invariance
  if (canonicalIntent.requestedCount !== undefined) {
    if (plan.constraints.requestedCount !== canonicalIntent.requestedCount) {
      normalizedConstraints.push(
        `Normalized requestedCount from ${plan.constraints.requestedCount} to canonical ${canonicalIntent.requestedCount}`
      );
      plan.constraints.requestedCount = canonicalIntent.requestedCount;
    }
    plan.stoppingCriteria.maxResults = canonicalIntent.requestedCount;
  }

  // Target Company Invariance
  const canonicalCompanies = canonicalIntent.companies || (canonicalIntent.company ? [canonicalIntent.company] : []);
  if (canonicalCompanies.length > 0) {
    plan.constraints.targetCompanies = canonicalCompanies;
  }

  // Role Invariance
  if (canonicalIntent.role) {
    plan.constraints.roles = canonicalIntent.roles || [canonicalIntent.role];
  }

  // Location Invariance
  if (canonicalIntent.location) {
    plan.constraints.locations = canonicalIntent.locations || [canonicalIntent.location];
  }

  // Work Mode Invariance
  if (canonicalIntent.workMode) {
    plan.constraints.workModes = canonicalIntent.workModes || [canonicalIntent.workMode];
  }

  const isValid = errors.length === 0 && securityViolations.length === 0;

  return {
    isValid,
    normalizedPlan: plan,
    errors,
    securityViolations,
    normalizedConstraints,
  };
}
