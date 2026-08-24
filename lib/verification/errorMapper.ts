import { z } from "zod";

/**
 * §26 HUMAN-READABLE ERROR CATALOG & MAPPING ENGINE
 * Every internal error, crash, timeout, or guard rejection must map to one of these 7 user-facing definitions.
 * Raw exceptions, database traces, or raw enums must NEVER leak to the client UI.
 */

export type HumanReadableCategory = 
  | "SECURITY" 
  | "BROWSER" 
  | "NETWORK" 
  | "AI" 
  | "SYSTEM" 
  | "WORKFLOW";

export interface HumanReadableError {
  code: string;
  category: HumanReadableCategory;
  title: string;
  userMessage: string;
  technicalDetail: string;
  suggestedAction: string;
  recoverable: boolean;
}

export const ERROR_CATALOG_7: Record<string, HumanReadableError> = {
  VERIFICATION_BLOCKED: {
    code: "VERIFICATION_BLOCKED",
    category: "SECURITY",
    title: "Human Verification Wall Detected",
    userMessage: "Access to the page was halted because an anti-bot challenge or verification wall was presented. I stopped safely here.",
    technicalDetail: "Target website presented a CAPTCHA, Cloudflare Turnstile challenge, or private authentication screen. Zero-bypass policy enforced.",
    suggestedAction: "Complete the verification manually in a standard browser session or verify that the target allows automated access.",
    recoverable: false,
  },
  NAVIGATION_TIMEOUT: {
    code: "NAVIGATION_TIMEOUT",
    category: "NETWORK",
    title: "Web Page Timed Out",
    userMessage: "The target website took longer than the configured threshold to load its DOM structure.",
    technicalDetail: "Playwright navigation exceeded threshold waiting for 'domcontentloaded' or networkidle event.",
    suggestedAction: "Check your internet connection or verify that the destination server is online and responding.",
    recoverable: true,
  },
  SELECTOR_NOT_FOUND: {
    code: "SELECTOR_NOT_FOUND",
    category: "BROWSER",
    title: "Element Selector Not Found",
    userMessage: "The agent attempted to interact with a page element that could not be resolved in the DOM.",
    technicalDetail: "Target selector was not found or visible within the active page context.",
    suggestedAction: "Inspect the updated page markup or allow the agent to refresh its accessibility tree snapshot.",
    recoverable: true,
  },
  RATE_LIMIT_EXCEEDED: {
    code: "RATE_LIMIT_EXCEEDED",
    category: "AI",
    title: "AI Reasoning Rate Limit Reached",
    userMessage: "The Gemini AI planning agent reached the maximum requests per minute quota threshold.",
    technicalDetail: "429 Too Many Requests or quota exhaustion returned by the AI planning gateway.",
    suggestedAction: "Wait 10-15 seconds before retrying the task, or configure an enterprise quota key.",
    recoverable: true,
  },
  BROWSER_CRASH: {
    code: "BROWSER_CRASH",
    category: "SYSTEM",
    title: "Browser Process Terminated",
    userMessage: "The isolated browser worker terminated unexpectedly due to host memory or sandbox constraints.",
    technicalDetail: "Playwright Chromium process disconnected or exited unexpectedly.",
    suggestedAction: "The system will automatically spin up a fresh isolated browser context on retry.",
    recoverable: true,
  },
  DOMAIN_NOT_ALLOWED: {
    code: "DOMAIN_NOT_ALLOWED",
    category: "SECURITY",
    title: "Domain Whitelist Block",
    userMessage: "The agent was prevented from navigating to a domain that is outside the configured whitelist.",
    technicalDetail: "Destination URL domain or protocol was blocked by the security policy.",
    suggestedAction: "Add the destination domain to the job's Allowed Domains configuration if intentional.",
    recoverable: false,
  },
  MAX_STEPS_EXCEEDED: {
    code: "MAX_STEPS_EXCEEDED",
    category: "WORKFLOW",
    title: "Step Budget Limit Reached",
    userMessage: "The agent reached the maximum step limit before completing the objective.",
    technicalDetail: "Total executed browser actions reached max budget without satisfying completion criteria.",
    suggestedAction: "Break the complex workflow into smaller discrete sub-tasks or increase the step budget.",
    recoverable: true,
  },
};

/**
 * Maps any internal error code, string, or Exception object to one of the 7 §26 HumanReadableError shapes.
 */
export function mapInternalErrorToHuman(input: unknown): HumanReadableError {
  if (!input) {
    return ERROR_CATALOG_7.VERIFICATION_BLOCKED;
  }

  let codeStr = "";
  let messageStr = "";

  if (typeof input === "string") {
    codeStr = input;
    messageStr = input;
  } else if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>;
    codeStr = String(record.code || record.name || "");
    messageStr = String(record.message || record.userMessage || record.error || "");
  }

  const combined = `${codeStr} ${messageStr}`.toLowerCase();

  // 1. Verification / CAPTCHA / Auth checks
  if (
    combined.includes("verification") ||
    combined.includes("captcha") ||
    combined.includes("turnstile") ||
    combined.includes("auth") ||
    combined.includes("login") ||
    combined.includes("requires_auth") ||
    combined.includes("cf-challenge")
  ) {
    return ERROR_CATALOG_7.VERIFICATION_BLOCKED;
  }

  // 2. Domain Whitelist / Protocol checks
  if (
    combined.includes("domain") ||
    combined.includes("whitelist") ||
    combined.includes("unsupported_protocol") ||
    combined.includes("policy_violation") ||
    combined.includes("not allowed")
  ) {
    return ERROR_CATALOG_7.DOMAIN_NOT_ALLOWED;
  }

  // 3. Navigation Timeouts
  if (
    combined.includes("timeout") ||
    combined.includes("navigation") ||
    combined.includes("econnrefused") ||
    combined.includes("504") ||
    combined.includes("timed out")
  ) {
    return ERROR_CATALOG_7.NAVIGATION_TIMEOUT;
  }

  // 4. Missing Selector
  if (
    combined.includes("selector") ||
    combined.includes("locator") ||
    combined.includes("element") ||
    combined.includes("not found on page") ||
    combined.includes("stale")
  ) {
    return ERROR_CATALOG_7.SELECTOR_NOT_FOUND;
  }

  // 5. Rate Limits & Quotas
  if (
    combined.includes("rate_limit") ||
    combined.includes("429") ||
    combined.includes("quota") ||
    combined.includes("resource_exhausted") ||
    combined.includes("too many requests")
  ) {
    return ERROR_CATALOG_7.RATE_LIMIT_EXCEEDED;
  }

  // 6. Max Steps Budget
  if (
    combined.includes("max_steps") ||
    combined.includes("budget") ||
    combined.includes("recovery_exhausted") ||
    combined.includes("limit reached")
  ) {
    return ERROR_CATALOG_7.MAX_STEPS_EXCEEDED;
  }

  // 7. Browser Crashes & Process failures
  if (
    combined.includes("crash") ||
    combined.includes("closed") ||
    combined.includes("disconnect") ||
    combined.includes("target closed") ||
    combined.includes("sigkill") ||
    combined.includes("sigterm") ||
    combined.includes("oom")
  ) {
    return ERROR_CATALOG_7.BROWSER_CRASH;
  }

  // Check exact code match if present in catalog
  if (ERROR_CATALOG_7[codeStr]) {
    return ERROR_CATALOG_7[codeStr];
  }

  // Safe fallback
  return ERROR_CATALOG_7.VERIFICATION_BLOCKED;
}
