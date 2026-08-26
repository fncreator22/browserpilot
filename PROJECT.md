# Project: BrowserPilot

## Architecture
- **Framework**: Next.js 16 (Turbopack) App Router, React 19, Tailwind CSS.
- **UI & Components**: `@base-ui/react`, Lucide React, Sonner notifications.
- **Validation**: Zod (v4.4.3).
- **Authentication**: NextAuth.js JWT session credentials provider with bcrypt password hashing.
- **Database & Storage**: Prisma 6 + `@prisma/adapter-libsql` + `@libsql/client` connected to Turso Cloud Database (`libsql://browserpilot-fncreator.aws-ap-south-1.turso.io`).
- **AI Core**: `@google/genai` with dynamic model selector (`gemini-3.6-flash`), intent classifier, capability guard, structured planner, action executor, and answer synthesizer.
- **Execution Environments**: Stateless Vercel Serverless Lambda (with active SSE execution to prevent freeze) & Playwright container/worker.
- **Deployment**: Vercel Production (`https://browserpilot-iota.vercel.app`), GitHub (`https://github.com/fncreator22/browserpilot`).

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Ponytail Codebase Optimization | Remove dead files (`CLAUDE.md`, `lib/serverlessPipeline.ts`, unused SVGs), unify DB adapter on `@libsql/client` + `@prisma/adapter-libsql`, remove `better-sqlite3`. | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 2 | Package Ecosystem Integration | Consolidate usage of `@google/genai`, `@base-ui/react`, `sonner`, and `zod`, eliminating custom duplicated abstractions. | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 3 | Turso Cloud Database Persistence | Ensure all queries route to Turso cloud database (`users`, `jobs`, `job_steps`, `observations`, `artifacts`) with zero ephemeral SQLite discrepancies. | M2 | ORIGINAL_REQUEST §R3 | DONE |
| 4 | Serverless Execution Guarantee | Active SSE stream execution and execute endpoint to prevent background promise freezes on Vercel Serverless Lambda. | M2 | ORIGINAL_REQUEST §R3 | DONE |
| 5 | User Auth & BYOK Key Storage | Full registration (`/signup`), login (`/login`), JWT session tokens, and encrypted BYOK Gemini API key persistence in profile. | M3 | ORIGINAL_REQUEST §R2 | DONE |
| 6 | Live Execution Streaming & Progression | Task dispatch (`/app`), live SSE streaming (`/app/jobs/[id]`), deterministic 10%–100% stage transitions, answer synthesis. | M3 | ORIGINAL_REQUEST §R2 | DONE |
| 7 | Visual Screenshot Captures | Playwright / worker viewport screenshot generation, disk persistence, and secure artifact streaming route. | M3 | ORIGINAL_REQUEST §R2 | DONE |
| 8 | Dynamic Model Selection | Dynamic Google API tier selector defaulting to active `gemini-3.6-flash`. | M3 | ORIGINAL_REQUEST §R2 | DONE |
| 9 | 16/16 Automated Test Matrix | Run and pass all 16 test suites (8 unit, 7 integration, 1 E2E) via `npm test`. | M4 | ORIGINAL_REQUEST §R4 | DONE |
| 10 | TypeScript Strict Typecheck | Strict TypeScript validation (`tsc --noEmit`) passing with 0 errors. | M4 | ORIGINAL_REQUEST §R4 | DONE |
| 11 | Vercel Production Deploy & GitHub Sync | Production deployment to `https://browserpilot-iota.vercel.app` and git repository sync to `main` and `develop`. | M4 | ORIGINAL_REQUEST §R4 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Ponytail Code & Package Optimization | Eliminate dead files, unify database on `@libsql/client` + `@prisma/adapter-libsql`, consolidate pipeline imports. | None | DONE |
| M2 | Cloud DB & Serverless Guarantee | Verify Turso cloud DB queries, schema tables, zero ephemeral discrepancies, and Lambda execution. | M1 | DONE |
| M3 | E2E Visual & Functional Verification | Verify auth, BYOK Gemini key, task streaming 10%->100%, screenshots, model selector. | M2 | DONE |
| M4 | Automated Tests, Production Deploy & Sync | 16/16 test suites pass, TypeScript typecheck passes, Vercel production deploy, GitHub sync. | M3 | DONE |

## Interface Contracts
### Client ↔ Serverless API
- `POST /api/auth/register`: `{ email, password, geminiApiKey? }` → `{ user: { id, email } }`
- `POST /api/jobs`: `{ goal, allowedDomains?, stepBudget? }` → `{ jobId, status: "pending" }`
- `GET /api/jobs/[id]/events?stream=true`: Server-Sent Events stream emitting `{ type: "status"|"intent"|"guard"|"plan"|"step"|"observation"|"complete", progress: number, ... }`
- `GET /api/artifacts/[jobId]/[filename]`: Binary PNG stream with ownership and path-traversal validation.

### Database Layer
- `lib/db/prisma.ts`: `getPrismaClient()` returns singleton `PrismaClient` configured with `PrismaLibSql` adapter against Turso cloud URL.

## Code Layout
- `app/`: Next.js App Router pages and API routes (`/app`, `/app/jobs/[id]`, `/login`, `/signup`, `/api/*`).
- `components/`: UI components (`@base-ui/react`), agent views, job status panels, profile modals.
- `lib/ai/`: AI orchestration engine (`pipelineEngine.ts`, `intent.ts`, `planner.ts`, `synthesizer.ts`, `modelSelector.ts`, `guard.ts`).
- `lib/auth/`: NextAuth credentials provider and JWT session management.
- `lib/db/`: Prisma client factory, Turso libSQL adapter, and repository helpers (`users.ts`, `jobs.ts`).
- `prisma/`: Prisma schema (`schema.prisma`) and configuration.
- `tests/`: 16 automated test suites (unit, integration, E2E) and test runner `tests/run-all-tests.ts`.
- `worker/`: Playwright action executor and background task runner.
