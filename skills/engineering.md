# Engineering & Code Quality Standards

## 1. TypeScript & Type Safety
- **Strict Mode**: `strict: true` is strictly enforced. Never disable compiler checks.
- **Zero `any` Policy**: The `any` type is prohibited. Use `unknown` with runtime type narrowing or generic constraints.
- **Zod Runtime Validation**: All boundary inputs and outputs (API routes, queue job payloads, agent tool calls, database queries) must be validated with Zod schemas defined in `schemas/`.
- **Infer Types from Schemas**: Derive TypeScript types directly from Zod definitions using `z.infer<typeof Schema>` to maintain a single source of truth.

---

## 2. Naming Conventions & File Structure
- **File Naming**: Use lowercase `kebab-case` for utility files, schemas, and libraries (e.g., `job-runner.ts`, `browser-pool.ts`). React component files use `kebab-case.tsx` or matching component names.
- **React Components**: Use `PascalCase` for React component exports (e.g., `JobTimelineCard`, `UplinkLoader`).
- **Functions & Variables**: Use `camelCase` for functions, methods, and variables (e.g., `executeBrowserStep`, `activeWorkerCount`).
- **Constants & Enums**: Use `SCREAMING_SNAKE_CASE` for global configuration constants and enum values.

---

## 3. Module Boundaries & Architecture Layering
The codebase is partitioned into distinct architectural layers. Strict unidirectional dependencies must be maintained:

```
app/ (UI Pages & API Handlers)
  ↓
components/ (UI Presentation & Progressive Disclosure)
  ↓
lib/ (Domain Services, Auth, AI Orchestration, Queue, DB, Storage)
  ↓
schemas/ (Zod Models & Shared Types)
```

- **`app/`**: Next.js App Router routes, server actions, and HTTP API handlers. No heavy business logic or direct browser automation here.
- **`components/`**: Modular presentation components structured by domain (`ui/`, `agent/`, `execution/`, `result/`, `architecture/`, `threeui/`).
- **`lib/`**: Core domain libraries isolated by capability (`ai/`, `browser/`, `queue/`, `capabilities/`, `verification/`, `db/`, `auth/`, `storage/`).
- **`worker/`**: Standalone background workers running BullMQ consumers and Playwright browser instances.
- **`schemas/`**: Shared Zod schemas and validation models.
- **`prisma/`**: Database schema, migrations, and seed scripts.

---

## 4. Error Handling & Human-Readable Mapping
All runtime errors must be caught, categorized, and translated into structured, actionable error objects:

### Standard Error Structure
```typescript
export interface AppErrorPayload {
  code: string;                  // e.g. "SELECTOR_NOT_FOUND"
  category: "BROWSER" | "AI" | "NETWORK" | "AUTH" | "SYSTEM";
  message: string;               // Internal technical detail
  userMessage: string;           // Human-readable summary
  suggestion?: string;           // Actionable fix or next step
  recoverable: boolean;          // Whether agent or user can retry
}
```

### Error Categories & Human-Readable Mapping
| Error Code | Category | User-Facing Message | Suggested Action |
| :--- | :--- | :--- | :--- |
| `NAVIGATION_TIMEOUT` | `NETWORK` | The web page took too long to respond. | Verify URL availability or check network connection. |
| `SELECTOR_NOT_FOUND` | `BROWSER` | The target element was not found on the page. | Refresh page snapshot or broaden selector criteria. |
| `VERIFICATION_BLOCKED` | `SECURITY` | Access blocked by an anti-bot challenge or CAPTCHA. | Solve verification manually or run on an allowed domain. |
| `RATE_LIMIT_EXCEEDED` | `AI` | LLM rate limits reached during reasoning cycle. | Wait a few seconds before retrying the job. |
| `BROWSER_CRASH` | `SYSTEM` | Browser process crashed unexpectedly. | Automatically spinning up a fresh isolated context. |

---

## 5. Testing Expectations
- **Unit Tests (`tests/unit/`)**: Comprehensive tests for all Zod schemas, data transformation helpers, error mappers, and AI prompt formatters.
- **Integration Tests (`tests/integration/`)**: Mocked API routes, queue dispatching, and database CRUD operations.
- **E2E / Capability Tests (`tests/e2e/`)**: End-to-end task runs on controlled test web pages verifying browser tool execution and observation parsing.
