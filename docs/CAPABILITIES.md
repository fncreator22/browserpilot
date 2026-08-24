# Capabilities Registry & Boundaries

This document defines the formal capability registry for BrowserPilot, enumerating supported automation primitives, requirements, and explicitly excluded features.

---

## 1. Supported Capabilities Registry

| Capability ID | Name | Category | Description | Prerequisite Tools |
| :--- | :--- | :--- | :--- | :--- |
| `CAP_MULTI_STEP_NAV` | Multi-Step Web Navigation | Navigation | Traverses across multi-page workflows, handles redirects, pagination, and URL query updates. | `browser.navigate`, `browser.click` |
| `CAP_FORM_FILL` | Structured Form Interaction | Interaction | Discovers, inspects, and fills text fields, radio buttons, checkboxes, and submits forms. | `browser.inspect`, `browser.fill`, `browser.click`, `browser.press` |
| `CAP_DATA_EXTRACTION` | Structured Content Extraction | Extraction | Scrapes structured tabular data, article text, lists, and metadata from target pages into typed JSON. | `browser.extractText`, `browser.inspect` |
| `CAP_VISUAL_CAPTURE` | Visual Audit & Screenshotting | Observability | Captures viewport and full-page screenshots at key workflow milestones or failure points. | `browser.screenshot` |
| `CAP_STATE_INSPECT` | DOM & State Telemetry | Telemetry | Queries active page title, current URL, interactive element counts, and accessibility hierarchy. | `browser.getState`, `browser.inspect` |
| `CAP_SCHEMA_VERIFY` | Schema & Output Verification | Verification | Evaluates extracted payload against Zod schema contracts and user-specified acceptance criteria. | Internal verification engine |

---

## 2. Capability Execution Contract
Each registered capability defines a strict input/output contract:
- **Input Preconditions**: Validated URL, target schema, parameter constraints, and domain whitelist.
- **Execution Step Budget**: Configurable maximum step count per capability (default: 10 steps per capability, 25 per job).
- **Postcondition Verification**: Automated check confirming that the target state or payload was successfully produced before marking the step as complete.

---

## 3. Explicitly Unsupported & Forbidden Capabilities

The following capabilities are deliberately blocked at the architectural and policy level:

| Capability ID | Name | Reason for Exclusion | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| `CAP_CAPTCHA_BYPASS` | Anti-Bot & CAPTCHA Circumvention | Violates security and compliance boundaries; anti-bot challenges require human escalation. | Automated detection halts job with `BLOCKED_VERIFICATION_REQUIRED`. |
| `CAP_RAW_EVAL` | Arbitrary JavaScript Injection | High security risk; enables remote code execution and unconstrained DOM tampering. | Absence of `eval()` / dynamic script execution APIs in worker. |
| `CAP_HOST_FS_IO` | Arbitrary Host Filesystem Access | Protects host environment and worker nodes from malicious file read/write operations. | Sandboxed artifact storage only (`storage/artifacts/`). |
| `CAP_FINANCIAL_TX` | Payment & Checkout Execution | Financial risk; automated payments without direct human sign-off are strictly prohibited. | Hard boundary blocking payment form submission in v1. |
| `CAP_PROXY_SWARM` | Distributed Proxy Swarms / Scraping Swarms | BrowserPilot is an interactive workflow agent, not a high-throughput scraping botnet. | Single-session worker architecture with rate limits. |
