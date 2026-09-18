# Product Definition and Boundaries

## 1. Product Vision and Value Proposition

### What BrowserPilot Is
BrowserPilot is an autonomous opportunity discovery platform and career intelligence engine designed to orchestrate deterministic scraping, multi-source career discovery, ATS endpoint monitoring, and verified recruiter reach.

### Core Pillars
1. **Continuous Official ATS Ingestion**: Directly monitors and verifies job postings across Greenhouse, Ashby, Lever, and Workday employer infrastructure with HTTP 200 liveness checks.
2. **DeepReach Cross-Platform Scouting**: Extracts stealth hiring announcements and expansion signals across X, Reddit, LinkedIn, and YouTube.
3. **100-Point Semantic Fit Scoring**: Evaluates candidate criteria against unstructured vacancy descriptions with deterministic gap analysis powered by Gemini 2.5 and DeepSeek.
4. **Autonomous 24/7 Opportunity Watches**: Background polling with automated novelty detection, deduplication, and multi-channel alerting.
5. **Deterministic and Safe Sandboxed Execution**: All extraction operations run in rate-limited, headless sandbox environments with strict SSRF filtering.
6. **Progressive Disclosure Observability**: Real-time telemetry is streamed via Server-Sent Events (SSE) through an enterprise observability deck.

---

## 2. Explicit Non-Goals and Boundaries

To ensure security, compliance, reliability, and maintainability, the following domains and patterns are explicitly out of scope:

### What BrowserPilot Is NOT
- **Not a Generic Conversational Chatbot**: BrowserPilot is not a conversational companion. It is an operational discovery platform built for career intelligence, structured scraping, and verification.
- **Not a Black-Hat or Dark-Pattern Automation Tool**: BrowserPilot does not support spamming, mass unauthenticated credential stuffing, ticket scalping, or violating third-party terms of service.
- **Not a CAPTCHA or Bot-Wall Circumvention Tool**: BrowserPilot does not attempt to bypass Cloudflare turnstile, reCAPTCHA, or bot-detection barriers. It immediately halts, flags human verification requirements, and yields control back to the operator.
- **Not an Arbitrary JavaScript Execution Sandbox**: The AI model is never permitted to inject unvalidated scripts (such as `eval()` or raw string execution) into page contexts.
- **Not an Unverified Job Aggregator**: BrowserPilot rejects stale, ghost, or third-party syndicated job listings lacking verifiable canonical employer ATS endpoints.
