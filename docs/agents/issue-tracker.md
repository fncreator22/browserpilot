# Issue Tracker: Local Markdown

Issues and specs for BrowserPilot live as local markdown files in `.scratch/`.

## Conventions

- One feature or bug effort per directory: `.scratch/<feature-slug>/`
- The specification is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered sequentially from `01`, never a single monolithic tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `docs/agents/triage-labels.md` for role strings)
- Work category is recorded as a `Labels:` line (e.g. `Labels: backend-fix, security`)
- Comments, analysis notes, and conversation history append to the bottom of the file under a `## Comments` heading

## When a Skill Says "Publish to the Issue Tracker"

Create a new file under `.scratch/<feature-slug>/` (creating parent directories if needed).

## When a Skill Says "Fetch the Relevant Ticket"

Read the file at the referenced path. The user or task description will provide the path or ticket number directly.

## Wayfinding Operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket:

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body)
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question or scope in the body. A `Type:` line records the ticket type (`research` / `prototype` / `grilling` / `task`); a `Status:` line records `claimed` / `resolved`
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins
- **Claim**: set `Status: claimed` and save before any work begins
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`
