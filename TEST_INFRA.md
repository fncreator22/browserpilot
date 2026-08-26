# E2E Test Infra: BrowserPilot

## Test Philosophy
- Opaque-box, requirement-driven verification covering functional correctness, reliability, security, multi-tenancy, and performance.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory & Test Coverage Matrix
| # | Feature | Requirement | Tier 1 (Unit) | Tier 2 (Boundary/Edge) | Tier 3 (Integration) | Tier 4 (E2E Scenario) |
|---|---------|-------------|:-------------:|:---------------------:|:-------------------:|:---------------------:|
| 1 | Auth & Password Security | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 2 | BYOK Gemini API Key Storage | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 3 | Task Submission & Budgeting | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 4 | Live SSE Execution Streaming | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 5 | Stage Progression 10%–100% | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 6 | Capability & Security Guard | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 7 | AI Planner & Validation | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 8 | Viewport Screenshot Captures | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 9 | Synthesizer & Error Mapping | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |
| 10 | Turso Cloud LibSQL Adapter | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 11 | Multi-Tenant Data Isolation | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 12 | Serverless Freeze Prevention | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |

## Test Architecture
- **Master Test Runner**: `tests/run-all-tests.ts` (invoked via `npm test`).
- **Suite Matrix**: 16 Automated Test Suites:
  1. `tests/unit/error-mapper.test.ts` (Error classification & mapping)
  2. `tests/unit/guard.test.ts` (Safety guard & domain validation)
  3. `tests/unit/interaction-guard.test.ts` (Dangerous action blocking)
  4. `tests/unit/model-selector.test.ts` (Dynamic model tier resolution)
  5. `tests/unit/planner.test.ts` (Plan generation & validation)
  6. `tests/unit/synthesizer.test.ts` (Answer synthesis & formatting)
  7. `tests/unit/time-budget.test.ts` (Job time allocation)
  8. `tests/unit/validator.test.ts` (Action schema validation)
  9. `tests/integration/auth.test.ts` (Signup, login, session tokens)
  10. `tests/integration/db-persistence.test.ts` (Turso cloud persistence)
  11. `tests/integration/executor.test.ts` (Browser action execution & screenshots)
  12. `tests/integration/multi-user-isolation.test.ts` (Multi-tenant security)
  13. `tests/integration/queue-worker.test.ts` (Job queue lifecycle)
  14. `tests/integration/user-profile.test.ts` (BYOK key masking & updates)
  15. `tests/integration/verifier-recovery.test.ts` (Error recovery & self-healing)
  16. `tests/e2e/toolcall-pipeline.test.ts` (Complete end-to-end task execution)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full User Lifecycle: Registration → BYOK Key Setup → Task Dispatch → SSE Streaming → Screenshot Capture → Completion | F1, F2, F3, F4, F5, F8, F10 | High |
| 2 | Multi-User Concurrent Task Execution & Tenant Isolation | F1, F3, F10, F11 | High |
| 3 | Serverless Resilience: Active Stream Execution with Real-Time Event Emission | F4, F5, F6, F7, F12 | High |
| 4 | Error Recovery & Domain Security Whitelist Enforcement | F6, F7, F9 | Medium |
| 5 | Live Turso Cloud Database State Persistence Across Restarts | F3, F10, F11 | High |

## Acceptance Criteria
- All 16 test suites pass cleanly with exit code 0 (`npm test`).
- Strict TypeScript typechecking passes with 0 errors (`npm run typecheck`).
- Zero regressions across unit, integration, and E2E verification layers.
