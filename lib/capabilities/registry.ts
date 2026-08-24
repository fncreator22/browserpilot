import { z } from "zod";

/**
 * Supported & Unsupported Capabilities Registry
 * Single source of truth per §8 & docs/CAPABILITIES.md
 */

export const CapabilityIdSchema = z.enum([
  // Supported Capabilities
  "CAP_MULTI_STEP_NAV",
  "CAP_FORM_FILL",
  "CAP_DATA_EXTRACTION",
  "CAP_VISUAL_CAPTURE",
  "CAP_STATE_INSPECT",
  "CAP_SCHEMA_VERIFY",

  // Explicitly Unsupported & Blocked Capabilities
  "CAP_CAPTCHA_BYPASS",
  "CAP_RAW_EVAL",
  "CAP_HOST_FS_IO",
  "CAP_FINANCIAL_TX",
  "CAP_PROXY_SWARM",
  "CAP_PRIVATE_AUTH_LOGIN",
  "CAP_MEDIA_STREAMING",
]);
export type CapabilityId = z.infer<typeof CapabilityIdSchema>;

export interface CapabilityDefinition {
  id: CapabilityId;
  name: string;
  category: "NAVIGATION" | "INTERACTION" | "EXTRACTION" | "OBSERVABILITY" | "SECURITY" | "UNSUPPORTED";
  status: "SUPPORTED" | "BLOCKED" | "REQUIRES_AUTH" | "UNSUPPORTED";
  description: string;
  prerequisiteTools: string[];
  blockReason?: string;
  humanMessage?: string;
  suggestedAction?: string;
}

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDefinition> = {
  // 1. Supported Capabilities
  CAP_MULTI_STEP_NAV: {
    id: "CAP_MULTI_STEP_NAV",
    name: "Multi-Step Web Navigation",
    category: "NAVIGATION",
    status: "SUPPORTED",
    description: "Traverses across multi-page workflows, handles redirects, pagination, and URL queries.",
    prerequisiteTools: ["browser.navigate", "browser.click"],
  },
  CAP_FORM_FILL: {
    id: "CAP_FORM_FILL",
    name: "Structured Form Interaction",
    category: "INTERACTION",
    status: "SUPPORTED",
    description: "Inspects and populates inputs, textareas, checkboxes, radio buttons, and triggers submission.",
    prerequisiteTools: ["browser.inspect", "browser.fill", "browser.click", "browser.press"],
  },
  CAP_DATA_EXTRACTION: {
    id: "CAP_DATA_EXTRACTION",
    name: "Structured Content Extraction",
    category: "EXTRACTION",
    status: "SUPPORTED",
    description: "Scrapes structured tabular data, text, lists, and metadata into typed JSON models.",
    prerequisiteTools: ["browser.extractText", "browser.inspect"],
  },
  CAP_VISUAL_CAPTURE: {
    id: "CAP_VISUAL_CAPTURE",
    name: "Visual Audit & Screenshotting",
    category: "OBSERVABILITY",
    status: "SUPPORTED",
    description: "Captures viewport and full-page screenshots at key workflow checkpoints and failure states.",
    prerequisiteTools: ["browser.screenshot"],
  },
  CAP_STATE_INSPECT: {
    id: "CAP_STATE_INSPECT",
    name: "DOM & State Telemetry",
    category: "OBSERVABILITY",
    status: "SUPPORTED",
    description: "Queries active page title, current URL, interactive element counts, and accessibility hierarchy.",
    prerequisiteTools: ["browser.getState", "browser.inspect"],
  },
  CAP_SCHEMA_VERIFY: {
    id: "CAP_SCHEMA_VERIFY",
    name: "Schema & Output Verification",
    category: "EXTRACTION",
    status: "SUPPORTED",
    description: "Evaluates extracted payloads against Zod schema contracts and user-specified acceptance criteria.",
    prerequisiteTools: [],
  },

  // 2. Explicitly Blocked & Unsupported Capabilities
  CAP_CAPTCHA_BYPASS: {
    id: "CAP_CAPTCHA_BYPASS",
    name: "Anti-Bot & CAPTCHA Circumvention",
    category: "SECURITY",
    status: "BLOCKED",
    description: "Circumventing CAPTCHA, Cloudflare Turnstile, or anti-bot verification challenges.",
    prerequisiteTools: [],
    blockReason: "Zero-bypass security policy: BrowserPilot does not bypass bot barriers.",
    humanMessage: "Access to the page was halted because an anti-bot challenge or CAPTCHA was presented.",
    suggestedAction: "Solve the verification manually or verify that the target domain permits automation.",
  },
  CAP_RAW_EVAL: {
    id: "CAP_RAW_EVAL",
    name: "Arbitrary JavaScript Execution",
    category: "SECURITY",
    status: "BLOCKED",
    description: "Injecting unvalidated raw JS code or eval() strings into page contexts.",
    prerequisiteTools: [],
    blockReason: "Strict prohibition of eval() on model output to prevent remote code execution.",
    humanMessage: "Arbitrary JavaScript execution is prohibited by the security sandbox.",
    suggestedAction: "Use parameterized Playwright tools (click, fill, extractText) instead.",
  },
  CAP_PRIVATE_AUTH_LOGIN: {
    id: "CAP_PRIVATE_AUTH_LOGIN",
    name: "Unauthenticated Private Account Login",
    category: "SECURITY",
    status: "REQUIRES_AUTH",
    description: "Attempting to log into personal/enterprise accounts (e.g. social media, bank, email) without pre-configured session.",
    prerequisiteTools: [],
    blockReason: "Requires active user authentication credentials or pre-authenticated session cookie.",
    humanMessage: "This goal requires logging into a private account. Unauthenticated autonomous login is not permitted without a configured session.",
    suggestedAction: "Authenticate your session in settings or provide public/test credentials.",
  },
  CAP_FINANCIAL_TX: {
    id: "CAP_FINANCIAL_TX",
    name: "Payment & Checkout Execution",
    category: "SECURITY",
    status: "BLOCKED",
    description: "Submitting credit card details or completing automated monetary transactions.",
    prerequisiteTools: [],
    blockReason: "Financial safety boundary: Automated checkout is strictly prohibited in v1.",
    humanMessage: "Financial transactions and automated checkouts are blocked by safety policies.",
    suggestedAction: "Navigate to the item and inspect pricing, then complete checkout manually.",
  },
  CAP_HOST_FS_IO: {
    id: "CAP_HOST_FS_IO",
    name: "Arbitrary Host Filesystem Access",
    category: "UNSUPPORTED",
    status: "UNSUPPORTED",
    description: "Direct read/write operations to arbitrary directories on the host operating system.",
    prerequisiteTools: [],
    blockReason: "Host sandbox isolation: Files are restricted strictly to storage/artifacts/.",
    humanMessage: "Arbitrary local filesystem operations are unsupported for security isolation.",
    suggestedAction: "Access generated files through the managed artifact storage download links.",
  },
  CAP_PROXY_SWARM: {
    id: "CAP_PROXY_SWARM",
    name: "Distributed Proxy / Botnet Swarms",
    category: "UNSUPPORTED",
    status: "UNSUPPORTED",
    description: "High-throughput distributed scraping swarms with rotating residential proxies.",
    prerequisiteTools: [],
    blockReason: "BrowserPilot is an interactive workflow agent, not a distributed scraping botnet.",
    humanMessage: "Distributed scraping swarms with proxy rotation are outside product scope.",
    suggestedAction: "Execute targeted workflow automation on specific allowed domains.",
  },
  CAP_MEDIA_STREAMING: {
    id: "CAP_MEDIA_STREAMING",
    name: "Raw Video & Audio Stream Decoding",
    category: "UNSUPPORTED",
    status: "UNSUPPORTED",
    description: "High-bandwidth continuous video/audio capture and real-time streaming.",
    prerequisiteTools: [],
    blockReason: "BrowserPilot operates via discrete DOM state checkpoints and milestone screenshots.",
    humanMessage: "Continuous video/audio streaming is not supported.",
    suggestedAction: "Use milestone screenshot capture and DOM inspection tools.",
  },
};
