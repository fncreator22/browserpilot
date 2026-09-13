# Triage Labels

The engineering skills speak in terms of five canonical triage roles, supplemented by BrowserPilot project work categories.

## Canonical Triage Roles

| Label in mattpocock/skills | Label in our tracker | Meaning                                      |
| -------------------------- | -------------------- | -------------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue      |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information     |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an autonomous run |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation or review      |
| `wontfix`                  | `wontfix`            | Will not be actioned                         |

## Project Work Categories

| Category Label     | Domain Area                                                    |
| ------------------ | -------------------------------------------------------------- |
| `backend-fix`      | API routes, database models, worker concurrency, and pipelines |
| `ui-ux`            | Next.js frontend pages, component design, responsive UI        |
| `security`         | Authentication, rate limiting, token protection, and audits    |
| `admin`            | Admin control plane, telemetry, user management, and plans     |
| `discovery-engine` | ATS connectors, swarm search, scoring, and freshness filters   |
| `billing`          | Stripe, coupons, subscriptions, and plan capabilities          |

When a skill mentions a triage role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from the Canonical Triage Roles table. Use project work categories in the `Labels:` header to classify issues by feature subsystem.
