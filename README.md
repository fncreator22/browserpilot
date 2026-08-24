# BrowserPilot 🚀

> **Autonomous Web Agent Platform** powered by Gemini 2.5 Flash, Playwright, BullMQ Redis queues, Prisma PostgreSQL persistence, and NextAuth.js multi-tenancy.

---

## 🌟 Overview & Capabilities

BrowserPilot is a production-grade, sandboxed autonomous web browsing platform designed for deterministic web extraction, form filling, visual regression capture, and state auditing.

### Key Architectural Pillars
- **Gemini 2.5 Flash Orchestrator**: Intent classification, pre-flight safety boundaries, and structured ActionPlan generation.
- **Capability Guard (§8)**: Pre-flight safety checks that reject CAPTCHA bypass, arbitrary script injection, or unauthorized private account requests before planning.
- **Plan Validator (§10)**: Reject-by-default domain whitelist and max-step budget enforcement.
- **Playwright Sandbox Pool (§7)**: Deterministic, isolated incognito browser sessions executing 8 canonical tools (`navigate`, `inspect`, `click`, `fill`, `press`, `extractText`, `screenshot`, `getState`).
- **Interaction Guard (§12)**: Runtime overlay detection, automated modal dismissal, and graceful halts on verification barriers.
- **Bounded Recovery Loop (§13)**: Self-healing verification loop capped at 2 recovery attempts before resolving to `VERIFIED`, `PARTIAL`, or `BLOCKED`.
- **Progressive Disclosure UI (§16)**: 4 disclosure levels (Level 1 Final Answer, Level 2 Real Timeline & Screenshots, Level 3 Worker Metrics, Level 4 Raw Telemetry Logs).
- **Multi-Tenant Security (§22)**: Complete user-scoped data boundaries, concurrent job rate limits, and NextAuth authentication (GitHub OAuth + Credentials fallback).

---

## 🐳 One-Command Deployment (Docker Compose)

The entire stack (Next.js Application, Playwright Worker, Redis, and PostgreSQL) can be booted with a single command.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) installed.

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your environment variables in `.env`:
```ini
# AI / LLM Planning
GEMINI_API_KEY=your-gemini-api-key

# Auth (NextAuth.js)
NEXTAUTH_SECRET=your-nextauth-secret-at-least-32-chars
NEXTAUTH_URL=http://localhost:3000

# Optional: GitHub OAuth
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret

# Redis Queue & DB
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/browserpilot?schema=public

# Storage
ARTIFACT_STORAGE_PATH=/app/storage/artifacts
```

### 3. Launch the Stack
```bash
docker compose up --build
```

- **Web Application**: Available at `http://localhost:3000`
- **PostgreSQL**: Available on port `5432`
- **Redis Queue**: Available on port `6379`
- **Playwright Worker**: Actively listening on the BullMQ queue

---

## 💻 Local Development Workflow (Without Docker)

### 1. Install Dependencies
```bash
npm install
```

### 2. Prepare Database
```bash
npx prisma db push
npx prisma generate
```

### 3. Start Next.js Development Server
```bash
npm run dev
```

### 4. Start Standalone Browser Worker (Separate Terminal)
```bash
npx tsx worker/index.ts
```

### 5. Run Automated Test Suite
```bash
npm test
```

---

## 🧪 Automated Test Suite (§36)

The project includes an end-to-end and unit test matrix running against local fixtures:

```bash
npm test
```

Test coverage includes:
1. `Unit: Plan Validator`: Action schema validation, domain whitelist, and step budget enforcement.
2. `Unit: Capability Guard`: Pre-flight intent filtering.
3. `Unit: Result Verifier`: Extraction verification and bounded recovery resolution.
4. `Unit: Error Mapper (§26)`: Clean mapping of 7 human-readable error conditions.
5. `Integration: Playwright Executor`: Local fixture execution, overlay dismissal, and screenshot artifacts.
6. `Integration: Multi-User Isolation`: Per-user data boundary protection and concurrency limits.
7. `E2E: Full Autonomous Agent Pipeline`: Complete prompt-to-result agent execution.

---

## 🛡️ Security & Sandboxing Policy
- **No Arbitrary Code Execution**: No `eval()` or dynamic JavaScript injection is permitted.
- **Strict Domain Whitelist**: Network navigation is restricted to authorized origins.
- **Zero Raw Error Leakage**: Internal traces and error enums are never exposed directly to the client UI.
- **Ephemeral Incognito Sessions**: Every browser session runs in a fresh, isolated incognito context.
