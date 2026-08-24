# Security & Sandboxing Policies

## 1. Zero Arbitrary JavaScript Execution
- **Strict Prohibition of `eval()` & Dynamic Code**: Under no circumstances may LLM output, tool parameters, or agent-generated strings be passed to JavaScript evaluation engines (`eval()`, `new Function()`, `page.evaluate(untrustedString)`, `vm.runInContext`).
- **Parameterized Playwright APIs**: All browser actions must execute strictly via typed, parameterized Playwright APIs (`click(selector)`, `fill(selector, text)`, `press(key)`).
- **Selector Injection Prevention**: Selectors must be validated and sanitized against standard CSS/XPath syntax to prevent selector-based injection attacks.

---

## 2. No Bot / CAPTCHA / Security Verification Bypass
- **Explicit Prohibition of Anti-Bot Circumvention**: BrowserPilot does not implement or allow CAPTCHA-solving plugins, Cloudflare challenge bypass hooks, or stealth fingerprint spoofing designed to defeat security barriers.
- **Graceful Detection & Halting**: If a verification wall, CAPTCHA, or access restriction is encountered, the worker must immediately transition the job to `BLOCKED_VERIFICATION_REQUIRED` state and alert the user rather than attempting evasion.

---

## 3. Allowed-Domain Rules & Navigation Guardrails
- **Domain Whitelisting & Scope Locks**: Jobs must define an `allowedDomains` boundary (or inherit project defaults). Any navigation request outside the permitted origin/subdomains must be blocked by the worker before network dispatch.
- **Protocol Restrictions**: Only `http://` and `https://` protocols are allowed. `file://`, `data:`, `javascript:`, `chrome://`, and internal loopback/private subnets (`169.254.169.254`, `localhost`, `10.0.0.0/8`, `192.168.0.0/16`) are blocked by default unless explicitly configured in local dev mode.

---

## 4. Authentication & Secrets Handling
- **No Plaintext Passwords in Prompts or Logs**: Sensitive credentials (passwords, session cookies, API tokens) must never be injected directly into prompt strings, system logs, or client-facing SSE streams.
- **Encrypted Vault Storage**: User credentials must be encrypted at rest using AES-256-GCM.
- **Ephemeral Worker Contexts**: Each job worker spins up a fresh, isolated incognito browser context. Browser storage, cookies, and cache are purged immediately upon job termination.

---

## 5. Telemetry & Snapshot Sanitization (PII Protection)
- **Visual Redaction**: Form fields containing credit card numbers, passwords, or social security numbers (`type="password"`, `autocomplete="cc-number"`) must be masked prior to taking DOM snapshots or transmitting images to external LLM endpoints.
- **Sanitized Error Payloads**: Worker stack traces and server-side errors must be stripped of internal file paths, database connection strings, and access tokens before returning to the UI.
