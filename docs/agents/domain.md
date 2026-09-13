# Domain Docs

How the engineering skills consume BrowserPilot's domain documentation when exploring the codebase.

## Before Exploring, Read These

- **`CONTEXT.md`** at the repo root (if present)
- **`docs/ARCHITECTURE.md`**, **`docs/PRODUCT.md`**, and **`docs/CAPABILITIES.md`** for domain overview
- **`docs/adr/`**: read ADRs that touch the area you are about to work in

If any of these files do not exist yet, **proceed silently**. Do not flag their absence or suggest creating them upfront. The `/domain-modeling` skill creates them lazily as domain concepts and architectural decisions are formalized.

## File Structure

Single-context repository layout:

```
/
├── CONTEXT.md               ← Ubiquitous language & domain model
├── docs/
│   ├── ARCHITECTURE.md      ← High-level architectural patterns
│   ├── PRODUCT.md           ← Core product concepts & user workflows
│   ├── CAPABILITIES.md      ← Plan tiers & entitlement capabilities
│   ├── adr/                 ← Architectural Decision Records
│   │   ├── 0001-...md
│   │   └── 0002-...md
│   └── agents/              ← Agent configuration & issue tracker definitions
│       ├── issue-tracker.md
│       ├── triage-labels.md
│       └── domain.md
```

## Use the Glossary's Vocabulary

When naming domain concepts in issue titles, refactor proposals, hypotheses, or test descriptions, use the exact terms defined in `docs/` and `CONTEXT.md` (e.g. `SearchIntent`, `Opportunity`, `SourceListing`, `PlanCapability`, `IntelligenceHarness`, `DiscoveryScheduler`). Do not drift to ambiguous synonyms.

## Flag ADR Conflicts

If your proposal or implementation contradicts an existing ADR in `docs/adr/`, surface it explicitly rather than silently overriding it:

> _Contradicts ADR-XXXX (...), but recommended to update because..._
