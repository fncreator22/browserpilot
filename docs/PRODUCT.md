# Product Definition & Boundaries

## 1. Product Vision & Value Proposition

### What BrowserPilot Is
BrowserPilot is an **autonomous AI web agent platform** designed to orchestrate deterministic browser automation, multi-step web interaction workflows, capability-driven task execution, and structured outcome verification.

### Core Pillars
1. **Goal-Oriented Autonomous Automation**: Users specify high-level tasks in natural language (e.g., *"Search for the latest three security advisories on example.org and extract the CVE IDs"*). The agent decomposes goals into concrete browser actions and executes them autonomously.
2. **Deterministic & Safe Sandboxed Execution**: The agent operates through a strictly constrained set of 8 discrete browser tools, preventing arbitrary code execution and uncontrolled navigation.
3. **Structured Outcome Verification**: Every workflow terminates with automated verification against expected output schemas and criteria, guaranteeing data integrity.
4. **Progressive Disclosure Observability**: Real-time telemetry is streamed via Server-Sent Events (SSE) and presented through a 4-level progressive disclosure UI—from high-level executive summaries down to millisecond-by-millisecond tool payloads and visual DOM snapshots.

---

## 2. Explicit Non-Goals & Boundaries

To ensure security, compliance, reliability, and maintainability, the following domains and patterns are **explicitly out of scope**:

### What BrowserPilot Is NOT
- ❌ **Not a Generic Conversational Chatbot**: BrowserPilot is not a conversational companion or generic text generation interface. It is an operational agent platform built for task execution, browser automation, and data extraction.
- ❌ **Not a Black-Hat / Dark-Pattern Automation Tool**: BrowserPilot does not support spamming, automated credential stuffing, ticket scalping, or violating third-party terms of service.
- ❌ **Not a CAPTCHA / Bot-Wall Circumvention Tool**: BrowserPilot does not attempt to bypass Cloudflare turnstile, reCAPTCHA, or bot-detection barriers. It immediately halts, flags human verification requirements, and yields control back to the operator.
- ❌ **Not an Arbitrary JavaScript Execution Sandbox**: The AI model is never allowed to inject unvalidated scripts (`eval()`, raw string injection) into page contexts.
- ❌ **Not a Heavy Video-Streaming Remote Desktop**: Rather than high-bandwidth video streams, BrowserPilot delivers lightweight, discrete DOM event timelines, accessibility snapshots, and milestone screenshots.
