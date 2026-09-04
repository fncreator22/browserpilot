/**
 * §GLOBAL VERIFICATION SANDBOX (TASK-063)
 * 
 * Isolated, platform-global verification, policy & execution gate.
 * Validates search plans before execution, enforces immutable user constraints,
 * provides structured correction feedback, blocks synthetic candidate fabrication,
 * and maintains tenant isolation with aggregate-only observability.
 */

import crypto from "crypto";
import {
  type VerificationRequest,
  type VerificationDecision,
  type SandboxCheckResult,
  type StructuredCorrection,
  type SandboxTelemetrySummary,
} from "./sandboxTypes";
import { type SearchActionPlan, type PlanConstraints } from "@/lib/ai/searchPlanner/searchActionPlan";
import { type SearchIntent, type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { searchCapabilityRegistry } from "@/lib/ai/tools/searchCapabilityRegistry";

const SYNTHETIC_DATA_PATTERNS = [
  /leading organization/i,
  /leading employer/i,
  /job_5001/i,
  /boards\.ashby\.io/i,
  /placeholder company/i,
  /mock company/i,
  /example company/i,
  /synthetic candidate/i,
  /test candidate/i,
  /sample employer/i,
  /fake company/i,
];

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
  /^169\.254\./,
  /^localhost$/i,
];

export class GlobalVerificationSandbox {
  // Aggregate-only telemetry: zero private user context, zero raw queries, zero PII
  private telemetry: SandboxTelemetrySummary = {
    totalRequests: 0,
    allowCount: 0,
    correctionCount: 0,
    rejectCount: 0,
    urlFailures: 0,
    deadUrlsCount: 0,
    closedJobsCount: 0,
    genericPortalsCount: 0,
    blockedSourcesCount: 0,
    authRequiredCount: 0,
    captchaEventsCount: 0,
    discoverySuccessCount: 0,
    discoveryFailureCount: 0,
    avgLatencyMs: 0,
    lastUpdated: new Date(),
  };

  private latencySum = 0;

  /**
   * Hashes a user identifier to guarantee tenant isolation in sandbox logs.
   */
  public hashUserId(userId?: string | null): string {
    if (!userId) return "anonymous_tenant";
    return crypto.createHash("sha256").update(userId.trim()).digest("hex").slice(0, 16);
  }

  /**
   * Pre-Execution Verification Gate:
   * Decides whether a proposed SearchActionPlan may execute.
   */
  public verifyExecutionPlan(request: VerificationRequest): VerificationDecision {
    const tStart = Date.now();
    this.telemetry.totalRequests++;

    const checks: SandboxCheckResult[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];

    const canonical = request.canonicalIntent;
    const plan = request.proposedPlan;

    // -------------------------------------------------------------------------
    // 1. REQUEST INTEGRITY
    // -------------------------------------------------------------------------
    if (!request.originalQuery || request.originalQuery.trim().length === 0) {
      failures.push("Request query is missing or empty.");
      checks.push({ checkName: "request_query_exists", passed: false, message: "Query string is empty.", severity: "CRITICAL" });
    } else {
      checks.push({ checkName: "request_query_exists", passed: true, message: "Query string validated.", severity: "INFO" });
    }

    if (!canonical) {
      failures.push("Canonical intent is missing.");
      checks.push({ checkName: "canonical_intent_exists", passed: false, message: "Canonical intent missing.", severity: "CRITICAL" });
    } else {
      checks.push({ checkName: "canonical_intent_exists", passed: true, message: "Canonical intent present.", severity: "INFO" });
    }

    // -------------------------------------------------------------------------
    // 2. HARD CONSTRAINT PRESERVATION (IMMUTABLE ANCHOR)
    // -------------------------------------------------------------------------
    const validatedConstraints: PlanConstraints = {
      roles: canonical.roles || (canonical.role ? [canonical.role] : []),
      locations: canonical.locations || (canonical.location ? [canonical.location] : []),
      workModes: canonical.workModes || (canonical.workMode ? [canonical.workMode] : []),
      postedWithinDays: canonical.postedWithinDays,
      freshnessWindowHours: canonical.freshnessWindowHours,
      requestedCount: canonical.requestedCount || 10,
      targetCompanies: canonical.companies || (canonical.company ? [canonical.company] : []),
      isExplicitFreshness: canonical.isExplicitFreshness,
    };

    // Verify requested count preservation
    if (plan.constraints.requestedCount !== validatedConstraints.requestedCount) {
      warnings.push(`Plan requestedCount (${plan.constraints.requestedCount}) normalized to canonical (${validatedConstraints.requestedCount}).`);
      plan.constraints.requestedCount = validatedConstraints.requestedCount;
      plan.stoppingCriteria.maxResults = validatedConstraints.requestedCount;
    }

    // Verify date window preservation
    if (validatedConstraints.postedWithinDays !== undefined && plan.constraints.postedWithinDays !== validatedConstraints.postedWithinDays) {
      warnings.push(`Plan postedWithinDays (${plan.constraints.postedWithinDays}) normalized to canonical (${validatedConstraints.postedWithinDays}).`);
      plan.constraints.postedWithinDays = validatedConstraints.postedWithinDays;
    }

    checks.push({ checkName: "hard_constraints_preserved", passed: true, message: "All hard user constraints strictly anchored.", severity: "INFO" });

    // -------------------------------------------------------------------------
    // 3. PLAN & CAPABILITY INTEGRITY
    // -------------------------------------------------------------------------
    const validatedCapabilities: string[] = [];
    const maxActions = 15;

    if (plan.actions.length > maxActions) {
      failures.push(`Plan action count (${plan.actions.length}) exceeds safety budget (${maxActions}).`);
    }

    const actionIds = new Set(plan.actions.map((a) => a.actionId));
    for (const action of plan.actions) {
      // Circular / non-existent dependencies
      for (const depId of action.dependencyIds) {
        if (!actionIds.has(depId)) {
          failures.push(`Action [${action.actionId}] references missing dependency [${depId}].`);
        }
        if (depId === action.actionId) {
          failures.push(`Action [${action.actionId}] has circular dependency.`);
        }
      }

      // Capability Registry check
      const cap = searchCapabilityRegistry.getCapability(action.capabilityId);
      if (!cap) {
        failures.push(`Action [${action.actionId}] specifies unverified capability [${action.capabilityId}].`);
      } else {
        if (cap.availabilityStatus === "DISABLED") {
          failures.push(`Action [${action.actionId}] uses disabled capability [${action.capabilityId}].`);
        }
        validatedCapabilities.push(action.capabilityId);
      }

      // Security check: Blocked security terms in action inputs
      const inputStr = JSON.stringify(action.input || {}).toLowerCase();
      for (const term of BLOCKED_SECURITY_TERMS) {
        if (inputStr.includes(term)) {
          failures.push(`Security violation: Blocked security term [${term}] in action [${action.actionId}].`);
        }
      }

      // Security check: SSRF & Private IP inspection in action inputs
      if (action.input && (typeof action.input.targetUrl === "string" || typeof action.input.url === "string")) {
        const urlStr = (action.input.targetUrl || action.input.url) as string;
        try {
          const parsed = new URL(urlStr);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            failures.push(`Security violation: Unsafe protocol [${parsed.protocol}] in action [${action.actionId}].`);
          }
          for (const pattern of PRIVATE_IP_PATTERNS) {
            if (pattern.test(parsed.hostname) && !process.env.IS_TEST_HARNESS) {
              failures.push(`Security violation: Private IP [${parsed.hostname}] in action [${action.actionId}].`);
            }
          }
        } catch {
          failures.push(`Malformed URL in action [${action.actionId}]: ${urlStr}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. DOMAIN RELEVANCE & SOURCE INTEGRITY
    // -------------------------------------------------------------------------
    const roleText = (canonical.role || canonical.roles?.join(" ") || "").toLowerCase();
    const isNonTech = /\b(mechanical|civil|chemical|nurse|nursing|doctor|healthcare|hospital|medical|pharmacist|pharmacy|accountant|accounting|finance)\b/i.test(roleText);
    
    // Check if the plan is trying to execute ATS platform crawls or tech scrapers for a non-tech role
    let requiresCorrection = false;
    let correctionReason = "";
    const invalidElements: string[] = [];
    const requiredAdjustments: string[] = [];

    if (isNonTech) {
      // Check if plan includes unrequested ATS actions or tech-exclusive platforms
      const hasUnrequestedTechAts = plan.actions.some((a) => {
        const inputStr = JSON.stringify(a.input || {}).toLowerCase();
        return (
          a.capabilityId === "company.ats" &&
          (inputStr.includes("greenhouse") || inputStr.includes("ashby") || inputStr.includes("lever")) &&
          !canonical.companies?.length &&
          !canonical.company
        );
      });

      if (hasUnrequestedTechAts) {
        requiresCorrection = true;
        correctionReason = `Requested non-tech role [${canonical.role || "role"}] belongs to non-software domain, but execution plan included unsolicited tech ATS actions.`;
        invalidElements.push("company.ats (Greenhouse/Ashby/Lever without target employer)");
        requiredAdjustments.push("Replace tech ATS actions with open-web discovery or general job board harvesting.");
      }
    }

    // -------------------------------------------------------------------------
    // 5. SYNTHETIC DATA DEFENSE IN PLAN
    // -------------------------------------------------------------------------
    const rawPlanStr = JSON.stringify(plan).toLowerCase();
    for (const pattern of SYNTHETIC_DATA_PATTERNS) {
      if (pattern.test(rawPlanStr)) {
        failures.push(`Synthetic pattern detected in plan: ${pattern.source}`);
      }
    }

    // -------------------------------------------------------------------------
    // 6. DECISION RESOLUTION
    // -------------------------------------------------------------------------
    let decision: VerificationDecision["decision"] = "ALLOW_EXECUTION";
    let structuredCorrection: StructuredCorrection | undefined = undefined;

    if (failures.length > 0) {
      decision = "REJECT";
      this.telemetry.rejectCount++;
    } else if (requiresCorrection) {
      decision = "REQUIRES_CORRECTION";
      this.telemetry.correctionCount++;
      structuredCorrection = {
        reason: correctionReason,
        invalidElements,
        requiredAdjustments,
        preservedConstraints: validatedConstraints,
      };
    } else {
      decision = "ALLOW_EXECUTION";
      this.telemetry.allowCount++;
    }

    const durationMs = Date.now() - tStart;
    this.latencySum += durationMs;
    this.telemetry.avgLatencyMs = Math.round(this.latencySum / this.telemetry.totalRequests);
    this.telemetry.lastUpdated = new Date();

    return {
      requestId: request.requestId,
      decision,
      checks,
      failures,
      warnings,
      validatedCapabilities,
      validatedSources: request.requestedSources || [],
      validatedConstraints,
      structuredCorrection,
      reason: failures.length > 0
        ? `Plan rejected due to ${failures.length} safety/integrity violation(s).`
        : requiresCorrection
        ? correctionReason
        : "Execution plan validated and approved by Global Verification Sandbox.",
      createdAt: new Date(),
    };
  }

  /**
   * Post-Harvest Synthetic Data Firewall:
   * Rejects synthetic candidates (e.g. 'Leading Organization', 'job_5001') before
   * they can ever enter verification or reach the user.
   */
  public evaluateSyntheticCandidateFirewall(candidate: RawJobCandidate): {
    isSynthetic: boolean;
    reason?: string;
  } {
    const title = (candidate.title || "").toLowerCase();
    const company = (candidate.companyName || (candidate as any).company || "").toLowerCase();
    const url = (candidate.sourceUrl || candidate.applyUrl || "").toLowerCase();
    const snippet = (candidate.rawSnippet || candidate.description || "").toLowerCase();

    for (const pattern of SYNTHETIC_DATA_PATTERNS) {
      if (pattern.test(title)) {
        return { isSynthetic: true, reason: `Title matched synthetic pattern: "${pattern.source}"` };
      }
      if (pattern.test(company)) {
        return { isSynthetic: true, reason: `Company matched synthetic pattern: "${pattern.source}"` };
      }
      if (pattern.test(url)) {
        return { isSynthetic: true, reason: `URL matched synthetic pattern: "${pattern.source}"` };
      }
      if (pattern.test(snippet)) {
        return { isSynthetic: true, reason: `Snippet matched synthetic pattern: "${pattern.source}"` };
      }
    }

    return { isSynthetic: false };
  }

  /**
   * Admin-safe aggregate telemetry (strictly zero tenant private context or queries).
   */
  public getAggregateTelemetry(): SandboxTelemetrySummary {
    return { ...this.telemetry };
  }

  /**
   * Records aggregate counters for URL & source events.
   */
  public recordUrlEvent(type: "DEAD" | "CLOSED" | "GENERIC" | "BLOCKED" | "AUTH_REQUIRED" | "CAPTCHA"): void {
    this.telemetry.urlFailures++;
    switch (type) {
      case "DEAD":
        this.telemetry.deadUrlsCount++;
        break;
      case "CLOSED":
        this.telemetry.closedJobsCount++;
        break;
      case "GENERIC":
        this.telemetry.genericPortalsCount++;
        break;
      case "BLOCKED":
        this.telemetry.blockedSourcesCount++;
        break;
      case "AUTH_REQUIRED":
        this.telemetry.authRequiredCount++;
        break;
      case "CAPTCHA":
        this.telemetry.captchaEventsCount++;
        break;
    }
  }

  public recordDiscoveryEvent(success: boolean): void {
    if (success) {
      this.telemetry.discoverySuccessCount++;
    } else {
      this.telemetry.discoveryFailureCount++;
    }
  }
}

export const globalVerificationSandbox = new GlobalVerificationSandbox();
