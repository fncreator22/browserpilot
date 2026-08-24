import { 
  type ActionPlan, 
  type PlannedStep, 
  ActionPlanSchema 
} from "@/schemas/jobs";
import { 
  type BrowserAction, 
  BrowserActionSchema,
  NavigateActionSchema,
  ClickActionSchema,
  FillActionSchema,
  PressActionSchema,
  ExtractTextActionSchema,
  ScreenshotActionSchema,
  InspectActionSchema,
  GetStateActionSchema
} from "@/schemas/actions";
import { CAPABILITY_REGISTRY, type CapabilityId } from "@/lib/capabilities/registry";
import { getDomainSecurityConfig, isUrlPermitted, type DomainSecurityConfig } from "./domainConfig";

export const DEFAULT_MAX_STEPS_LIMIT = 15;
export const HARD_MAX_STEPS_LIMIT = 25;

export type PlanRejectionCode =
  | "EMPTY_PLAN"
  | "MAX_STEPS_EXCEEDED"
  | "INVALID_ACTION_TYPE"
  | "INVALID_ACTION_PARAMETERS"
  | "DISALLOWED_DOMAIN"
  | "DISALLOWED_PROTOCOL"
  | "INVALID_SELECTOR"
  | "UNSUPPORTED_CAPABILITY"
  | "SCHEMA_VALIDATION_ERROR";

export interface PlanRejectionReason {
  code: PlanRejectionCode;
  stepNumber?: number;
  message: string;
  detail: string;
}

export interface PlanValidationResult {
  valid: boolean;
  validatedPlan?: ActionPlan;
  reasons: PlanRejectionReason[];
  summary: string;
  totalSteps: number;
  maxAllowedSteps: number;
}

export interface PlanValidationOptions {
  allowedDomains?: string[];
  maxStepsBudget?: number;
  customDomainConfig?: DomainSecurityConfig;
}

/**
 * Maps each authorized browser tool to its prerequisite capability ID
 */
const TOOL_TO_CAPABILITY_MAP: Record<string, CapabilityId> = {
  "browser.navigate": "CAP_MULTI_STEP_NAV",
  "browser.click": "CAP_MULTI_STEP_NAV",
  "browser.inspect": "CAP_STATE_INSPECT",
  "browser.fill": "CAP_FORM_FILL",
  "browser.press": "CAP_FORM_FILL",
  "browser.extractText": "CAP_DATA_EXTRACTION",
  "browser.screenshot": "CAP_VISUAL_CAPTURE",
  "browser.getState": "CAP_STATE_INSPECT",
};

/**
 * PLAN VALIDATOR (Pre-Execution Business & Security Rules Guard)
 * 
 * REJECT-BY-DEFAULT POLICY (§10 / skills/security.md):
 * If ANY single step fails validation, the entire plan is rejected immediately.
 * No partial execution is ever permitted.
 */
export function validateActionPlan(
  rawPlan: unknown,
  options: PlanValidationOptions = {}
): PlanValidationResult {
  const reasons: PlanRejectionReason[] = [];
  const maxSteps = Math.min(options.maxStepsBudget || DEFAULT_MAX_STEPS_LIMIT, HARD_MAX_STEPS_LIMIT);
  const domainConfig = options.customDomainConfig || getDomainSecurityConfig(options.allowedDomains);

  // 1. Structural Schema Validation
  const schemaParse = ActionPlanSchema.safeParse(rawPlan);
  if (!schemaParse.success) {
    schemaParse.error.issues.forEach((issue) => {
      const pathStr = issue.path.join(".");
      const isToolIssue = pathStr.endsWith("action.tool") || issue.message.includes("discriminator");
      
      // Extract step number if present in path (e.g. steps.4.action.tool)
      let stepNum: number | undefined;
      if (issue.path[0] === "steps" && typeof issue.path[1] === "number") {
        stepNum = issue.path[1] + 1;
      }

      if (isToolIssue) {
        reasons.push({
          code: "INVALID_ACTION_TYPE",
          stepNumber: stepNum,
          message: `Step ${stepNum || "?"} specifies an unauthorized tool action.`,
          detail: issue.message,
        });
      } else {
        reasons.push({
          code: "SCHEMA_VALIDATION_ERROR",
          stepNumber: stepNum,
          message: `Plan structure violated schema at path: "${pathStr}"`,
          detail: issue.message,
        });
      }
    });

    return {
      valid: false,
      reasons,
      summary: `ActionPlan rejected: failed structural schema validation (${reasons.length} errors).`,
      totalSteps: 0,
      maxAllowedSteps: maxSteps,
    };
  }

  const plan: ActionPlan = schemaParse.data;

  // 2. Empty Plan Check
  if (!plan.steps || plan.steps.length === 0) {
    reasons.push({
      code: "EMPTY_PLAN",
      message: "ActionPlan contains 0 planned steps.",
      detail: "An executable ActionPlan must specify at least one tool step.",
    });
  }

  // 3. Max Step Limit Budget Check
  if (plan.steps.length > maxSteps) {
    reasons.push({
      code: "MAX_STEPS_EXCEEDED",
      message: `Plan step count (${plan.steps.length}) exceeds the maximum step budget of ${maxSteps}.`,
      detail: `To prevent runaway loops and token exhaust, plans are capped at ${maxSteps} steps (hard ceiling ${HARD_MAX_STEPS_LIMIT}).`,
    });
  }

  // 4. Per-Step Detailed Business Rule Validation
  for (let i = 0; i < plan.steps.length; i++) {
    const step: PlannedStep = plan.steps[i];
    const stepNum = step.stepNumber || i + 1;
    const action = step.action as BrowserAction;

    // 4a. Action Type Check
    if (!action || typeof action !== "object" || !action.tool) {
      reasons.push({
        code: "INVALID_ACTION_TYPE",
        stepNumber: stepNum,
        message: `Step ${stepNum} is missing a valid action tool identifier.`,
        detail: `Expected one of the 8 authorized browser tools, got "${(action as { tool?: string })?.tool}".`,
      });
      continue;
    }

    if (!(action.tool in TOOL_TO_CAPABILITY_MAP)) {
      reasons.push({
        code: "INVALID_ACTION_TYPE",
        stepNumber: stepNum,
        message: `Step ${stepNum} specifies unauthorized action tool: "${action.tool}".`,
        detail: `Only the 8 authorized v1 tools are permitted (navigate, inspect, click, fill, press, extractText, screenshot, getState).`,
      });
      continue;
    }

    // 4b. Capability Support Verification
    const requiredCap = TOOL_TO_CAPABILITY_MAP[action.tool];
    const capDef = CAPABILITY_REGISTRY[requiredCap];
    if (!capDef || capDef.status !== "SUPPORTED") {
      reasons.push({
        code: "UNSUPPORTED_CAPABILITY",
        stepNumber: stepNum,
        message: `Step ${stepNum} requires capability "${requiredCap}" which is not supported in v1.`,
        detail: capDef?.blockReason || "Capability is disabled by policy.",
      });
    }

    // 4c. Individual Tool Parameter Validation & Sanity Rules
    switch (action.tool) {
      case "browser.navigate": {
        const navParse = NavigateActionSchema.safeParse(action);
        if (!navParse.success) {
          reasons.push({
            code: "INVALID_ACTION_PARAMETERS",
            stepNumber: stepNum,
            message: `Step ${stepNum} has invalid navigate parameters.`,
            detail: navParse.error.issues.map((e) => e.message).join("; "),
          });
        } else {
          // Domain security & protocol validation
          const urlCheck = isUrlPermitted(navParse.data.parameters.url, domainConfig);
          if (!urlCheck.permitted) {
            reasons.push({
              code: "DISALLOWED_DOMAIN",
              stepNumber: stepNum,
              message: `Step ${stepNum} navigation to "${navParse.data.parameters.url}" is blocked.`,
              detail: urlCheck.reason || "Domain not allowed by security policy.",
            });
          }
        }
        break;
      }

      case "browser.click": {
        const clickParse = ClickActionSchema.safeParse(action);
        if (!clickParse.success) {
          reasons.push({
            code: "INVALID_ACTION_PARAMETERS",
            stepNumber: stepNum,
            message: `Step ${stepNum} has invalid click parameters.`,
            detail: clickParse.error.issues.map((e) => e.message).join("; "),
          });
        } else {
          const selector = clickParse.data.parameters.selector.trim();
          if (selector.length === 0 || selector.includes("<script") || selector.toLowerCase().includes("javascript:")) {
            reasons.push({
              code: "INVALID_SELECTOR",
              stepNumber: stepNum,
              message: `Step ${stepNum} has invalid or potentially unsafe selector: "${selector}".`,
              detail: "Selectors must be valid CSS/XPath strings and cannot contain script injection patterns.",
            });
          }
        }
        break;
      }

      case "browser.fill": {
        const fillParse = FillActionSchema.safeParse(action);
        if (!fillParse.success) {
          reasons.push({
            code: "INVALID_ACTION_PARAMETERS",
            stepNumber: stepNum,
            message: `Step ${stepNum} has invalid fill parameters.`,
            detail: fillParse.error.issues.map((e) => e.message).join("; "),
          });
        } else {
          const selector = fillParse.data.parameters.selector.trim();
          if (selector.length === 0) {
            reasons.push({
              code: "INVALID_SELECTOR",
              stepNumber: stepNum,
              message: `Step ${stepNum} has empty fill selector.`,
              detail: "Target selector cannot be empty.",
            });
          }
        }
        break;
      }

      case "browser.press": {
        const pressParse = PressActionSchema.safeParse(action);
        if (!pressParse.success) {
          reasons.push({
            code: "INVALID_ACTION_PARAMETERS",
            stepNumber: stepNum,
            message: `Step ${stepNum} has invalid press parameters.`,
            detail: pressParse.error.issues.map((e) => e.message).join("; "),
          });
        }
        break;
      }

      case "browser.extractText": {
        const extractParse = ExtractTextActionSchema.safeParse(action);
        if (!extractParse.success) {
          reasons.push({
            code: "INVALID_ACTION_PARAMETERS",
            stepNumber: stepNum,
            message: `Step ${stepNum} has invalid extractText parameters.`,
            detail: extractParse.error.issues.map((e) => e.message).join("; "),
          });
        }
        break;
      }

      case "browser.inspect": {
        const inspectParse = InspectActionSchema.safeParse(action);
        if (!inspectParse.success) {
          reasons.push({
            code: "INVALID_ACTION_PARAMETERS",
            stepNumber: stepNum,
            message: `Step ${stepNum} has invalid inspect parameters.`,
            detail: inspectParse.error.issues.map((e) => e.message).join("; "),
          });
        }
        break;
      }

      case "browser.screenshot": {
        const screenParse = ScreenshotActionSchema.safeParse(action);
        if (!screenParse.success) {
          reasons.push({
            code: "INVALID_ACTION_PARAMETERS",
            stepNumber: stepNum,
            message: `Step ${stepNum} has invalid screenshot parameters.`,
            detail: screenParse.error.issues.map((e) => e.message).join("; "),
          });
        }
        break;
      }

      case "browser.getState": {
        const stateParse = GetStateActionSchema.safeParse(action);
        if (!stateParse.success) {
          reasons.push({
            code: "INVALID_ACTION_PARAMETERS",
            stepNumber: stepNum,
            message: `Step ${stepNum} has invalid getState parameters.`,
            detail: stateParse.error.issues.map((e) => e.message).join("; "),
          });
        }
        break;
      }
    }
  }

  // Reject-by-default conclusion
  const isValid = reasons.length === 0;

  return {
    valid: isValid,
    validatedPlan: isValid ? plan : undefined,
    reasons,
    summary: isValid
      ? `ActionPlan approved: ${plan.steps.length} steps validated against schema and domain security policies.`
      : `ActionPlan rejected by business & security rules (${reasons.length} violation(s) found).`,
    totalSteps: plan.steps?.length || 0,
    maxAllowedSteps: maxSteps,
  };
}
