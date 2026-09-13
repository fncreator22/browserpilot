# Wayfinder Map: Agentic Pipeline Hardening & Observatory

Effort: `agentic-hardening`
Status: COMPLETED

---

## Dependency Graph & Ticket Map

```
┌──────────────────────────────────────────────┐
│  01-intent-extraction-precision              │
│  - Prevent location misidentifications       │
│  - Stop Puter output contamination           │
│  - Fix experience level & refinements        │
│  Status: RESOLVED                            │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  02-harvester-query-sanitization             │
│  - Multi-source harvest on source mention    │
│  - Strip organization from city filters      │
│  - Guarantee verified candidate production   │
│  Status: RESOLVED                            │
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│  03-sidebar-features         │ │  04-admin-agentic-observatory│
│  - Search History reactivity │ │  - Live Pipeline Stages Flow │
│  - Saved Opps bookmark sync  │ │  - Engine Stress Telemetry   │
│  - Notifications & Watch sync│ │  - Step Trace & Token Audits │
│  Status: RESOLVED            │ │  Status: RESOLVED            │
└──────────────┬───────────────┘ └──────────────┬───────────────┘
               │                                │
               └────────────────┬───────────────┘
                                ▼
┌──────────────────────────────────────────────┐
│  05-unstructured-language-verification       │
│  - Test unexpected/conversational queries    │
│  - End-to-end simulation across components   │
│  - Production contract validation            │
│  Status: RESOLVED                            │
└──────────────────────────────────────────────┘
```

---

## Ticket Inventory

| Ticket | Slug | Type | Status | Blocked By | Labels |
|---|---|---|---|---|---|
| [01](issues/01-intent-extraction-precision.md) | `intent-extraction-precision` | `diagnosing-bugs` | `resolved` | *None* | `discovery-engine`, `backend-fix` |
| [02](issues/02-harvester-query-sanitization.md) | `harvester-query-sanitization` | `diagnosing-bugs` | `resolved` | `01` | `discovery-engine`, `backend-fix` |
| [03](issues/03-sidebar-features-reactivity.md) | `sidebar-features-reactivity` | `ui-ux` | `resolved` | `02` | `ui-ux`, `discovery-engine` |
| [04](issues/04-admin-agentic-observatory.md) | `admin-agentic-observatory` | `ui-ux` | `resolved` | `02` | `admin`, `ui-ux` |
| [05](issues/05-unstructured-language-verification.md) | `unstructured-language-verification` | `task` | `resolved` | `03`, `04` | `discovery-engine`, `security` |
