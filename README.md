# BrowserPilot

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.2-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2.8-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Deployment Status](https://img.shields.io/badge/Deployment-Production%20Live-brightgreen)](https://browserpilot-gold.vercel.app)

BrowserPilot is an autonomous opportunity discovery platform and career intelligence engine. It continuously monitors official employer infrastructure across major Applicant Tracking Systems (Greenhouse, Ashby, Lever, Workday) and cross-platform channels, performing deterministic match verification, zero-ghost filtering, and direct hiring manager discovery.

Production Deployment: [https://browserpilot-gold.vercel.app](https://browserpilot-gold.vercel.app)  
Alternative Production Mirror: [https://browserpilot-sr2mahajangmailcoms-projects.vercel.app](https://browserpilot-sr2mahajangmailcoms-projects.vercel.app)

---

## Visual Interface Overview

### Discovery and Autonomous Radar Workspace
The centralized discovery command center surfaces active career opportunities with multi-source filtering, match rankings, monitored target companies, roles, skills, and verified compensation calibration.

![Opportunity Discovery Workspace](public/screenshots/current_discovery_workspace.png)

### Autonomous 24/7 Radar Monitoring
Persistent background monitors manage target roles, skills, and companies with global connector configuration (Ashby, Greenhouse, Lever, Workable, LinkedIn) and configurable freshness boundaries.

![Autonomous Opportunity Radar](public/screenshots/current_autonomous_radar.png)

### Deep Dossier and Direct Recruiter Outreach
Detailed vacancy intelligence with direct ATS application link validation, source platform audits, match score explanations, and direct hiring manager outreach shortcuts.

![Opportunity Intelligence Dossier](public/screenshots/current_opportunity_dossier.png)

### Voice-Driven Interactive Career Discovery
Real-time conversational discovery interface allowing voice-prompted searches, automated constraint normalization, and intelligent opportunity matching.

![Voice Discovery Interface](public/screenshots/current_voice_discovery.png)

### Subscription Quotas and Plan Entitlements
Granular subscription tiers, autonomous watch limits, daily discovery quotas, and promotional coupon redemption.

![Subscription Plans and Limits](public/screenshots/current_subscription_plans.png)

### Two-Pane Settings and Quota Control
Unified configuration deck for managing AI provider credentials, persistent memory vaults, notification webhooks, and account security.

![Settings and Quota Deck](public/screenshots/current_settings_quotas.png)

---

## Table of Contents

- [Core Capabilities](#core-capabilities)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Local Development Setup](#local-development-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Testing and Verification Matrix](#testing-and-verification-matrix)
- [Branch Protection and Contribution Governance](#branch-protection-and-contribution-governance)
- [Security and Responsible Disclosure](#security-and-responsible-disclosure)
- [License](#license)

---

## Core Capabilities

### 1. Continuous Official ATS Ingestion
Scrapes and monitors live employer endpoints directly from Greenhouse, Ashby, Lever, and Workday portals. By verifying HTTP 200 responses directly on the employer's canonical subdomain, BrowserPilot guarantees zero aggregated stale postings and eliminates ghost vacancies.

### 2. DeepReach Social Channel Discovery
Extends beyond static job boards to scout active hiring signals, team expansions, and stealth announcements across X, Reddit, LinkedIn, and YouTube.

### 3. 100-Point Semantic Match Engine
Uses hybrid reasoning pipelines powered by Gemini 2.5 Flash and DeepSeek Harness to analyze candidate constraints (roles, seniority, tech stacks, salary requirements, location) against full job descriptions, calculating deterministic fit scores and gap analyses.

### 4. Autonomous Background Watches
Users can define persistent search watches with notification webhooks. The background scheduler runs scheduled sweeps, detects newly published vacancies, and dispatches instant alerts via email or webhook.

### 5. Multi-Tenant Enterprise Security
All search queries, persistent user memory vaults, and telemetry data are strictly tenant-isolated. Sensitive tokens, API keys, and credentials are encrypted at rest and recursively sanitized prior to model inference.

---

## System Architecture

```text
User / Automated Watch Request
  |
  v
Next.js 16 App Router (/api/search, /api/discovery/watch)
  |
  +--> Capability Guard & Authentication Gate (lib/capabilities/guard.ts)
  |      |-- Enforces role-based permissions and session token validity
  |      `-- Sanitizes prompt inputs and rejects hostile prompt injections
  |
  +--> Intent Parser & Constraint Normalizer (lib/scraper/intentParser.ts)
  |      |-- Extracts explicit roles, locations, compensation brackets, and stacks
  |      `-- Maps criteria into standardized taxonomy filters
  |
  +--> Discovery Execution Engine (lib/ai/harness/intelligenceHarness.ts)
  |      |-- Stage 1: Official ATS Ingestion (Greenhouse, Ashby, Lever, Workday)
  |      |-- Stage 2: DeepReach Social Discovery (X, Reddit, LinkedIn, YouTube)
  |      |-- Stage 3: Live HTTP 200 Verification Gate
  |      `-- Stage 4: Semantic Scoring & Relevance Ranker
  |
  +--> Database Layer (Supabase PostgreSQL via Prisma ORM)
  |      |-- Persists opportunities, watches, runs, alerts, and audit logs
  |      `-- Strict tenant foreign key constraints and IDOR rejection
  |
  `--> Telemetry & Client Stream (/api/search/[id]/events)
         `-- Server-Sent Events (SSE) deliver live progressive disclosure
```

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Next.js 16.3.2 (App Router, Turbopack) |
| Frontend | React 19.2.8, Tailwind CSS v4, Motion 13.x, daisyUI 5.x |
| Language | TypeScript 5.x (Strict Type Checking) |
| Database | PostgreSQL (Supabase pooler), Prisma 7.x ORM |
| AI Reasoning | Gemini 2.5 Flash (@google/genai), DeepSeek Harness, Vercel AI SDK (ai) |
| Authentication | NextAuth.js 4.24.x with session isolation |
| Deployment | Vercel Serverless Architecture (IAD1 Edge Region) |

---

## Local Development Setup

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher
- PostgreSQL database instance (or Supabase project)

### Step 1: Clone Repository
```bash
git clone https://github.com/fncreator22/browserpilot.git
cd browserpilot
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create `.env.local` based on `.env.example`:
```bash
cp .env.example .env.local
```
Fill in the required database credentials, auth secrets, and AI provider keys.

### Step 4: Generate Prisma Client and Run Migrations
```bash
npx prisma generate
npx prisma db push
```

### Step 5: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Configuration

The following variables must be defined in `.env.local` for local execution:

```bash
# Database (PostgreSQL / Supabase)
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/postgres"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secure-random-32-character-secret"

# AI Reasoning Providers
GEMINI_API_KEY="your-google-gemini-api-key"
AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"

# Admin & Operational Security
ADMIN_EMAILS="admin@example.com"
ADMIN_SECRET_KEY="your-internal-admin-secret-key"

# Optional Cache / Queue
REDIS_URL="redis://localhost:6379"
```

---

## Testing and Verification Matrix

BrowserPilot enforces comprehensive automated quality checks. All test suites must execute cleanly before any code can be merged.

### Run All Test Suites
```bash
# Run complete test verification suite
npm test

# Run TypeScript static type analysis
npm run typecheck

# Verify Next.js production build
npm run build
```

### Verification Coverage by Subsystem
 
| Subsystem Domain | Validation Scope | Reliability Target |
| :--- | :--- | :--- |
| **Autonomous Radar & Discovery** | Multi-source polling, watch persistence, deduplication | 100% deduplication of seen vacancies |
| **Natural-Language Routing** | Intent classification, constraint normalization, entity extraction | Deterministic taxonomy mapping |
| **ATS Scraper Boundaries** | Greenhouse, Ashby, Lever, Workable isolated execution | Zero fallback hallucination |
| **Multi-Source Ranking** | Semantic scoring, gap analysis, compensation calibration | Bounded 0-100 fit score |
| **DeepReach Social Scanner** | Direct recruiter attribution, contact discovery | Strict domain and origin verification |
| **Auth & Secret Security** | PBKDF2/bcrypt hashing, timing-safe equality, token isolation | Zero secret egress in model prompts |
| **Abuse & Rate Limiting** | Sliding window rate limiter, IP-based lockout | Zero degradation under burst load |
| **Production Observability** | Lifecycle alerts, SSE streaming, crash recovery | Idempotent resume and error mapping |
| **Data Isolation & Tenant Vaults** | Multi-tenant memory vaults, cross-account access denial | Absolute cross-tenant IDOR protection |

---

## Branch Protection and Contribution Governance

BrowserPilot operates under a strict repository access and governance model to guarantee stability, security, and traceability:

1. **Pull Requests Required**:
   - All community contributors must fork the repository and submit changes via a Pull Request (PR) targeted against the `main` branch.
   - Direct pushes to the `main` branch are disabled and restricted.

2. **Admin-Only Merge Rights**:
   - Only designated repository administrators and core maintainers possess permissions to approve and merge Pull Requests into `main`.
   - Contributors cannot merge their own PRs, even if all automated checks pass.

3. **Mandatory Quality Gates**:
   - Every PR triggers automated continuous integration (CI).
   - A PR must pass `npm run typecheck` with zero errors, pass all automated test suites, and compile cleanly via `npm run build`.
   - At least one code review and approval from an authorized administrator is mandatory prior to merging.

4. **Conventional Commits**:
   - All commits must adhere to the Conventional Commits specification (for example, `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `perf:`).

For full details on development standards, coding conventions, and the submission lifecycle, consult [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Security and Responsible Disclosure

Security is fundamental to BrowserPilot. The platform enforces:
- Strict SSRF protection rejecting internal network addresses (RFC 1918), localhost, and cloud metadata services.
- Automated secret and credential redacting preventing tokens or passwords from entering prompts or model context.
- Cross-tenant IDOR protection ensuring that search histories, user memory vaults, and saved vacancies are inaccessible across accounts.

If you identify a potential security vulnerability, do not open a public issue. Review our security reporting instructions in [CONTRIBUTING.md](CONTRIBUTING.md) to contact the maintainers directly.

---

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
