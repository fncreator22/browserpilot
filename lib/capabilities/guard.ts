import { 
  type CapabilityId, 
  type CapabilityDefinition, 
  CAPABILITY_REGISTRY 
} from "./registry";
import { type IntentClassification, type IntentType } from "@/schemas/jobs";

export interface CapabilityGuardResult {
  allowed: boolean;
  classification: IntentType;
  errorCode?: string;
  userMessage: string;
  technicalDetail?: string;
  suggestedAction?: string;
  matchedCapabilities: CapabilityId[];
  blockedCapabilities: CapabilityId[];
}

/**
 * Heuristic Pattern Rules to catch known boundary violations immediately
 */
const HEURISTIC_PATTERNS: Array<{
  pattern: RegExp;
  capabilityId: CapabilityId;
  classification: IntentType;
  errorCode: string;
}> = [
  {
    pattern: /(bypass\s*(captcha|turnstile|cloudflare|anti-?bot)|solve\s*(recaptcha|hcaptcha|turnstile)|break\s*captcha)/i,
    capabilityId: "CAP_CAPTCHA_BYPASS",
    classification: "BLOCKED",
    errorCode: "VERIFICATION_BLOCKED",
  },
  {
    pattern: /(eval\(|new\s+Function|run\s+raw\s+(javascript|js)|inject\s+arbitrary\s+script)/i,
    capabilityId: "CAP_RAW_EVAL",
    classification: "BLOCKED",
    errorCode: "SECURITY_POLICY_VIOLATION",
  },
  {
    pattern: /(log\s*in\s*to\s*my|sign\s*in\s*to\s*my|my\s*(instagram|facebook|twitter|x\.com|gmail|outlook|bank|chase|paypal)\s*account)/i,
    capabilityId: "CAP_PRIVATE_AUTH_LOGIN",
    classification: "REQUIRES_AUTH",
    errorCode: "AUTHENTICATION_REQUIRED",
  },
  {
    pattern: /(credit\s*card|debit\s*card|cvv|checkout\s*and\s*pay|complete\s*(purchase|payment)|send\s*money\s*from\s*my)/i,
    capabilityId: "CAP_FINANCIAL_TX",
    classification: "BLOCKED",
    errorCode: "FINANCIAL_TRANSACTION_BLOCKED",
  },
  {
    pattern: /(download.*to\s*(c:\\|\/etc|\/var|my\s*c\s*drive|my\s*desktop)|execute\s*host\s*binary)/i,
    capabilityId: "CAP_HOST_FS_IO",
    classification: "UNSUPPORTED",
    errorCode: "HOST_FS_IO_UNSUPPORTED",
  },
  {
    pattern: /(proxy\s*swarm|10000\s*proxies|botnet\s*rotation|scrape\s*100000\s*pages\s*concurrently)/i,
    capabilityId: "CAP_PROXY_SWARM",
    classification: "UNSUPPORTED",
    errorCode: "PROXY_SWARM_UNSUPPORTED",
  },
];

/**
 * Pre-flight Capability Guard
 * 
 * CRITICAL LIFECYCLE CONSTRAINT (Prompt 09 / §8 / skills/security.md):
 * Must execute BEFORE any Gemini planning call to prevent wasted token spend
 * or planning for unsupported/blocked automation intents.
 */
export function validateCapabilityPreflight(
  intent: IntentClassification,
  userPrompt: string
): CapabilityGuardResult {
  const matchedCaps: CapabilityId[] = [];
  const blockedCaps: CapabilityId[] = [];

  // 1. Fast heuristic pattern check against prompt
  for (const rule of HEURISTIC_PATTERNS) {
    if (rule.pattern.test(userPrompt)) {
      blockedCaps.push(rule.capabilityId);
      const capDef = CAPABILITY_REGISTRY[rule.capabilityId];

      return {
        allowed: false,
        classification: rule.classification,
        errorCode: rule.errorCode,
        userMessage: capDef.humanMessage || "This request violates safety or capability policies.",
        technicalDetail: `Pre-flight pattern matched forbidden capability: ${rule.capabilityId}.`,
        suggestedAction: capDef.suggestedAction || "Modify your prompt to use supported browsing tools.",
        matchedCapabilities: [],
        blockedCapabilities: blockedCaps,
      };
    }
  }

  // 2. Evaluate Gemini Intent Classification
  switch (intent.classification) {
    case "REQUIRES_AUTH": {
      blockedCaps.push("CAP_PRIVATE_AUTH_LOGIN");
      const capDef = CAPABILITY_REGISTRY.CAP_PRIVATE_AUTH_LOGIN;
      return {
        allowed: false,
        classification: "REQUIRES_AUTH",
        errorCode: "AUTHENTICATION_REQUIRED",
        userMessage: capDef.humanMessage || "This goal requires logging into a private account.",
        technicalDetail: intent.rationale,
        suggestedAction: capDef.suggestedAction || "Provide public endpoints or pre-authenticated session credentials.",
        matchedCapabilities: [],
        blockedCapabilities: blockedCaps,
      };
    }

    case "BLOCKED": {
      blockedCaps.push("CAP_CAPTCHA_BYPASS");
      return {
        allowed: false,
        classification: "BLOCKED",
        errorCode: "SECURITY_POLICY_VIOLATION",
        userMessage: "This goal is blocked because it violates security, anti-bot, or safety policies.",
        technicalDetail: intent.rationale,
        suggestedAction: "Run deterministic tasks on public, permissible websites.",
        matchedCapabilities: [],
        blockedCapabilities: blockedCaps,
      };
    }

    case "UNSUPPORTED": {
      blockedCaps.push("CAP_HOST_FS_IO");
      return {
        allowed: false,
        classification: "UNSUPPORTED",
        errorCode: "CAPABILITY_UNSUPPORTED",
        userMessage: "This request requires features outside BrowserPilot v1 capabilities.",
        technicalDetail: intent.rationale,
        suggestedAction: "BrowserPilot supports multi-step navigation, form filling, text extraction, and screenshots.",
        matchedCapabilities: [],
        blockedCapabilities: blockedCaps,
      };
    }

    case "NEEDS_CLARIFICATION": {
      return {
        allowed: false,
        classification: "NEEDS_CLARIFICATION",
        errorCode: "PROMPT_AMBIGUOUS",
        userMessage: "The task prompt is underspecified or missing target URLs.",
        technicalDetail: intent.rationale,
        suggestedAction: intent.clarificationQuestion || "Please specify the target website and extraction criteria.",
        matchedCapabilities: [],
        blockedCapabilities: [],
      };
    }

    case "SUPPORTED":
    default: {
      // Map supported capabilities
      matchedCaps.push("CAP_MULTI_STEP_NAV");
      if (userPrompt.toLowerCase().includes("extract") || userPrompt.toLowerCase().includes("table") || userPrompt.toLowerCase().includes("find")) {
        matchedCaps.push("CAP_DATA_EXTRACTION");
      }
      if (userPrompt.toLowerCase().includes("fill") || userPrompt.toLowerCase().includes("form") || userPrompt.toLowerCase().includes("submit")) {
        matchedCaps.push("CAP_FORM_FILL");
      }
      if (userPrompt.toLowerCase().includes("screenshot") || userPrompt.toLowerCase().includes("capture")) {
        matchedCaps.push("CAP_VISUAL_CAPTURE");
      }
      matchedCaps.push("CAP_STATE_INSPECT");
      matchedCaps.push("CAP_SCHEMA_VERIFY");

      return {
        allowed: true,
        classification: "SUPPORTED",
        userMessage: "Goal successfully verified against supported capabilities.",
        technicalDetail: intent.rationale,
        matchedCapabilities: matchedCaps,
        blockedCapabilities: [],
      };
    }
  }
}

export const evaluateCapabilityGuard = validateCapabilityPreflight;

