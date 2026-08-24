# Development Roadmap & Phase Sequence

This document tracks the phased development sequence, architectural milestones, and prompt implementation order for BrowserPilot.

---

## 1. Phase Breakdown & Build Order

| Phase | Title | Focus & Key Deliverables |
| :--- | :--- | :--- |
| **Phase 01** | **Project Foundation** | Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui skeleton, directory tree, `.env.example`, minimal README. |
| **Phase 02** | **Skill Files & Architecture Docs** | Canonical reference standards (`skills/`, `docs/`), architectural diagrams, boundaries, and Graphify mapping. |
| **Phase 03** | **Design System & Motion** | High-contrast visual tokens, base UI layout, motion primitives, and responsive viewport shell. |
| **Phase 04** | **ThreeUI & UplinkLoader** | WebGL execution-state visualizer (`UplinkLoader`), canvas mounting/unmounting lifecycle, and performance gates. |
| **Phase 05** | **Data Models & Schemas** | Prisma database schema, migrations, Zod contract definitions, and type exports. |
| **Phase 06** | **API & Queue Infrastructure** | Next.js API route handlers (`/api/jobs`), Redis BullMQ producer/consumer setup, human-readable error mappers. |
| **Phase 07** | **Browser Worker & Tools** | Standalone Playwright worker, isolated incognito browser pool, and implementation of the 8 core tools. |
| **Phase 08** | **AI Planning & Gemini Orchestration** | Gemini 2.0 Flash integration, structured tool-calling loop, prompt templates, and observation formatters. |
| **Phase 09** | **Verification Engine** | Schema checking, DOM state assertion rules, automated retry policies, and confidence metrics. |
| **Phase 10** | **Progressive Disclosure UI** | 4-level disclosure dashboard (`/app`), live SSE stream listener, timeline cards, metric grids, raw log drawers. |
| **Phase 11** | **Integration & Test Harness** | Mock web fixture test suite, unit tests for schemas/libs, end-to-end task runs. |
| **Phase 12** | **Polishing, Security Audit & Docs** | Comprehensive README, security boundary verification, performance optimizations, and final audit. |

---

## 2. Prompt Execution Sequence Reference
When continuing or referencing implementation prompts:
1. **Prompt 01**: Project Foundation (Complete)
2. **Prompt 02**: Skill Files + Docs + Graphify (Active)
3. **Prompt 03**: Design System & Layout Foundation
4. **Prompt 04**: ThreeUI Execution State & Loader
5. **Prompt 05**: Prisma Data Models & Zod Schemas
6. **Prompt 06**: Queue Infrastructure & API Endpoints
7. **Prompt 07**: Playwright Worker & Browser Tools
8. **Prompt 08**: Gemini Agent Planner & Reasoning Loop
9. **Prompt 09**: Verification Engine & Retry Machine
10. **Prompt 10**: Progressive Disclosure Dashboard & SSE
11. **Prompt 11**: Test Suite & Mock Fixtures
12. **Prompt 12**: Hardening, Production Packaging & Docs

---

## 3. Local Development Workflows
- **Start Web Application**: `npm run dev` (Boots Next.js at `http://localhost:3000`)
- **Run Worker Process**: `npm run worker:dev` (Starts BullMQ consumer process)
- **Database Migrations**: `npx prisma migrate dev`
- **Run Test Suite**: `npm test`
- **Type Checking**: `npx tsc --noEmit`
