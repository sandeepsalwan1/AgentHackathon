# AGENTS.md

HTTP adapter layer.

## Rules

- Authenticate/derive actor before mutation.
- Resolve clinic/tenant before persistence.
- Validate request shape at the route edge.
- Accept manager passcodes from headers or JSON actor bodies, not query strings.
- Keep workflow rules out of route files when they need tests or reuse.
- Import task permissions from `../lib/taskWorkflow`, not `_shared.ts`.
- Return stable JSON contracts documented in `docs/agent-route-contracts.md`.
- Use package modules for DB, notification, client-request, and agent behavior.

## Key Seams

- `_shared.ts`: actor auth, manager auth, clinic resolution.
- `_apiResponse.ts`: no-store headers, structured route logging, database/server error responses.
- `agent/_workflowRoutes.ts`: agent route slug mapping, auth mode, and route-intent normalization.
- `agent/_runner.ts`: workflow execution and persistence orchestration.
- `arrival-intake/_arrivalIntakeRequest.ts`: public arrival match/submit and staff arrival desk mutation module.
- `approvals/_approvalRequest.ts`: approval list/create/decision validation, manager auth, and persistence module.
- `events/_eventRequest.ts`: task audit event read auth, permission logging, and query module.
- `tasks/_taskListRequest.ts`: task list archive cutoff and role-scoped query module.
- `tasks/_taskVisibility.ts`: staff-safe task projection module.
- `tasks/_taskCreateRequest.ts`: task create request module.
- `tasks/[id]/_taskUpdateRequest.ts`: task update request module.
- `settings/_settingsRequest.ts`: settings access validation, projection, and veterinarian profile mutation module.
- `profile-name/_profileNameRequest.ts`: profile-name payload/auth validation, display-name update, and reference-rename module.
- `notifications/_notificationRequest.ts`: cron authorization, notification mode/env parsing, and smoke-notification auth/send module.
- `mock/clinic/_mockClinicRequest.ts`: manager-auth mock clinic snapshot and reset module.
- `reports/_reportRoute.ts`: manager-auth report route adapter.
