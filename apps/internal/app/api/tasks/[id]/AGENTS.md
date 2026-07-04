# AGENTS.md

Task mutation route modules.

## Rules

- `route.ts` is the HTTP adapter for edit, status, archive, restore, invalid, and escalation writes.
- `_taskUpdateRequest.ts` owns payload validation, workflow checks, persistence, and escalation notification trigger.
- Undo behavior lives in `undo/route.ts`; keep it aligned with task transition persistence.
- Return task data through `../_taskVisibility.ts`.
