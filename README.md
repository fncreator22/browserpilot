# BrowserPilot 🚀

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.2-black?logo=next.js)](https://nextjs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.62.1-green?logo=playwright)](https://playwright.dev/)
[![Gemini 2.5](https://img.shields.io/badge/Gemini-2.5%20Flash-orange?logo=google)](https://deepmind.google/technologies/gemini/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **Enterprise-Grade Autonomous Web Agent Platform** powered by Gemini 2.5 Flash reasoning, Playwright browser sandboxes, BullMQ Redis queues, Prisma PostgreSQL persistence, and NextAuth.js multi-tenancy.

---

## 📑 Table of Contents
- [🌟 Architecture & Core Pillars](#-architecture--core-pillars)
- [🎯 Real Autonomous Execution vs Mock Data](#-real-autonomous-execution-vs-mock-data)
- [🛠️ The 8 Canonical Browser Tools](#️-the-8-canonical-browser-tools)
- [🛡️ Security, Guardrails & Policy Catalog](#️-security-guardrails--policy-catalog)
- [🐳 One-Command Deployment (Docker Compose)](#-one-command-deployment-docker-compose)
- [💻 Local Development Quickstart](#-local-development-quickstart)
- [🧪 Automated Test Matrix (§36)](#-automated-test-matrix-36)
- [👥 Multi-Tenancy & Rate Limits](#-multi-tenancy--rate-limits)
- [🤝 Contributing & Branching Model](#-contributing--branching-model)
- [📄 License](#-license)

---

## 🌟 Architecture & Core Pillars

BrowserPilot is built for deterministic web automation, structured extraction, form filling, visual regression capture, and state auditing.

```text
User Natural Language Prompt
  ↓
[POST /api/jobs] → Prisma DB (Job: QUEUED) + BullMQ Redis Queue
  ↓
Worker Pool / In-Process Runner (worker/index.ts)
  ↓
[Step 1: PRE-FLIGHT] Capability Guard (lib/capabilities/guard.ts)
  ├── ALLOWED: Continue
  └── BLOCKED / REQUIRES_AUTH: Immediate safe stop
  ↓
[Step 2: PLANNING] Gemini 2.5 Flash Planner (lib/ai/planner.ts)
  ↓
[Step 3: PRE-EXECUTION] Plan Validator (lib/verification/planValidator.ts)
  ├── Checks: Allowed domains, step budgets, prohibited protocols (file://, javascript:)
  └── Reject-by-Default: Entire plan rejected if 1 step fails
  ↓
[Step 4: EXECUTION] Playwright ToolCall Dispatcher (worker/executor.ts)
  ├── 8 Canonical Tools in isolated incognito contexts
  └── Interaction Guard: Auto-dismisses popups / stops on verification challenges
  ↓
[Step 5: VERIFICATION] Result Verifier & Bounded Recovery (lib/verification/resultVerifier.ts)
  ├── VERIFIED: All criteria met
  └── RECOVER: Alternate action plan (Hard cap: 2 retries) → Fallback to PARTIAL
  ↓
[Step 6: SYNTHESIS] Gemini Synthesizer → Structured JSON / Markdown Report
  ↓
[Step 7: DISCLOSURE] 4-Level Progressive Disclosure Dashboard (/app/jobs/[id])
```

For complete system diagrams and IPC specs, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 🎯 Real Autonomous Execution vs Mock Data

BrowserPilot executes **100% real browser operations**:
- Launches **real Chromium browser sandboxes** via Playwright.
- Interacts with live DOM elements (navigation, clicking, keyboard strokes, text extraction).
- Captures real viewport PNG screenshots saved to `storage/artifacts/`.
- Queries Gemini 2.5 Flash for live intent classification, reasoning, and synthesis.
- Persists live execution telemetry, step events, and observations to SQLite/PostgreSQL via Prisma.

---

## 🛠️ The 8 Canonical Browser Tools

| Tool Name | Action Category | Purpose & Description |
| :--- | :--- | :--- |
| `browser.navigate` | Navigation | Navigates to target URL with configurable timeout and wait condition (`domcontentloaded`). |
| `browser.inspect` | State Inspection | Audits interactive DOM accessibility trees, buttons, forms, and headings. |
| `browser.click` | Interaction | Clicks elements using precise CSS/XPath selectors. |
| `browser.fill` | Form Filling | Types structured text into inputs and textarea fields. |
| `browser.press` | Keyboard Input | Dispatches keyboard events (`Enter`, `Tab`, `Escape`, `ArrowDown`). |
| `browser.extractText` | Extraction | Extracts single or batch inner text from matching DOM elements. |
| `browser.screenshot` | Telemetry | Captures viewport PNG snapshot artifacts. |
| `browser.getState` | Diagnostics | Retrieves active page URL, title, and interactive element metrics. |

---

## 🛡️ Security, Guardrails & Policy Catalog

- **Reject-by-Default Whitelist**: Only domains explicitly permitted or matching user constraints are allowed.
- **No Arbitrary Code Injection**: Arbitrary `eval()` and `javascript:` injection are strictly prohibited.
- **Anti-Bot & CAPTCHA Zero-Bypass**: Hard halts on CAPTCHA / Cloudflare challenges with human-readable diagnostics.
- **Zero Raw Error Leakage (§26)**: All system failures map to 7 standardized human-friendly messages.

For detailed capability definitions, see [docs/CAPABILITIES.md](docs/CAPABILITIES.md).

---

## 🐳 One-Command Deployment (Docker Compose)

Boot the entire production stack (Web App, Background Worker, Redis, and PostgreSQL) with a single command:

```bash
# 1. Clone repository
git clone https://github.com/fncreator22/browserpilot.git
cd browserpilot

# 2. Configure environment
cp .env.example .env

# 3. Boot with Docker Compose
docker compose up --build
```

- **Web Dashboard**: `http://localhost:3000`
- **PostgreSQL**: `localhost:5432`
- **Redis Queue**: `localhost:6379`

---

## 💻 Local Development Quickstart

### 1. Prerequisites
- Node.js 20+
- npm / yarn / pnpm

### 2. Setup & Database
```bash
npm install
npx prisma db push
npx prisma generate
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Start Background Worker (Optional - In-process fallback enabled)
```bash
npm run worker:dev # or npx tsx worker/index.ts
```

---

## 🧪 Automated Test Matrix (§36)

Run the full automated test suite:

```bash
npm test
```

| §36 Scenario | Focus Area | Status | Test Reference |
| :--- | :--- | :--- | :--- |
| **Scenario 1** | Happy Path Public Extraction | ✅ **PASS** | `tests/e2e/autonomousPipeline.test.ts` |
| **Scenario 2** | Pre-Flight Capability Guard Halt | ✅ **PASS** | `tests/unit/capabilityGuard.test.ts` |
| **Scenario 3** | Plan Validator Security Rejection | ✅ **PASS** | `tests/unit/planValidator.test.ts` |
| **Scenario 4** | Interaction Guard Overlay Dismissal | ✅ **PASS** | `tests/integration/executor.test.ts` |
| **Scenario 5** | Result Verifier Bounded Recovery (Cap = 2) | ✅ **PASS** | `tests/unit/resultVerifier.test.ts` |
| **Scenario 6** | Multi-User Isolation & Rate Limits | ✅ **PASS** | `tests/integration/multiUser.test.ts` |
| **Scenario 7** | DB Persistence & Process Restart | ✅ **PASS** | `tests/run-db-persistence-test.ts` |

---

## 👥 Multi-Tenancy & Rate Limits

- **Scoped Queries**: Every job query, timeline event, and artifact download is isolated to the authenticated user ID.
- **Concurrent Limits**: Configured to max 2 concurrent jobs and 20 hourly jobs per user to prevent worker pool starvation.
- **Job Control**: Dedicated ownership-checked `POST /api/jobs/:id/cancel` and `POST /api/jobs/:id/retry` endpoints.

---

## 🤝 Contributing & Branching Model

We welcome contributions from the community!

1. **Branch Policy**:
   - **`main`**: Production releases only. Direct commits are restricted.
   - **`develop`**: Primary integration branch. Target all Pull Requests against `develop`.
2. **Interactive PR Template**:
   - When raising a Pull Request, use the [PR Template](.github/pull_request_template.md) to select change types and verify checklist items.

For full guidelines, read [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

Distributed under the **Apache 2.0 License**. See [LICENSE](LICENSE) for more information.
