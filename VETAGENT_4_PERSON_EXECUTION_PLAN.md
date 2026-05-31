# VetAgent 4-Person Technical Execution Plan

Date: 2026-05-31

Goal: ship an agent-first VetAgent MVP this week. Use the existing Central Veterinary Hospital task manager as the shared work queue. Build with mock data only for now. Use Supabase, Render, E2B, Opsera, Apify, and OpenAI Agents SDK.

Decisions already made:

- Apofy/Apofine = Apify.
- Mock data only this week.
- Sandeep owns Supabase and all Render work.
- Use Render, not Vercel, for this phase.
- Use E2B.
- Use Opsera.
- Keep current passcode auth. Do not add Supabase Auth yet.
- Keep current role/passcode envs: `VET_ADMIN_PASSCODE`, `VET_APP_ADMIN_PASSCODE`, `VET_VETERINARIAN_PASSCODE`.
- Use TypeScript in this repo, not a separate Python service.
- Person 4 is frontend/product and must be able to work in parallel from contracts/fixtures.

## Current Codebase

Existing apps:

- `apps/internal`: staff task board.
- `apps/client-request`: public client request form.
- `packages/db`: Postgres connection, migrations, task/auth/settings helpers.
- `packages/notifications`: Resend notification helpers.
- `db/migrations`: SQL migrations.

Important current files:

- `apps/internal/app/components/TaskBoard.tsx`: existing staff UI.
- `apps/client-request/app/components/RequestForm.tsx`: existing public request UI.
- `apps/internal/app/api/tasks/route.ts`: list/create tasks.
- `apps/internal/app/api/tasks/[id]/route.ts`: update task/status.
- `apps/internal/app/api/events/route.ts`: audit log.
- `apps/internal/app/api/auth/route.ts`: passcode login.
- `apps/internal/app/api/_shared.ts`: auth helpers. Do not rewrite this for MVP.
- `apps/client-request/app/api/requests/route.ts`: public request -> task.
- `packages/db/src/tasks.ts`: task CRUD/event helpers.
- `packages/db/src/types.ts`: shared task types.
- `packages/db/scripts/migrate.mjs`: current migration runner.
- `.env.example`: current env surface.

## Target Architecture This Week

Add these modules:

```text
packages/agents/
  package.json
  src/
    index.ts
    contracts.ts
    guardrails.ts
    tools.ts
    mockProvider.ts
    externalAgent.ts
    internalAgent.ts
    scenarioRunner.ts
    e2bRunner.ts
    apifyPricing.ts

packages/mock-data/
  package.json
  src/
    vetSandbox.ts
    scenarios.ts

apps/internal/app/api/agent/internal/route.ts
apps/internal/app/api/agent/external/route.ts
apps/internal/app/api/agent/runs/[id]/route.ts
apps/internal/app/api/approvals/route.ts
apps/internal/app/api/approvals/[id]/route.ts
apps/internal/app/api/mock/clinic/route.ts

apps/client-request/app/booking/page.tsx
apps/client-request/app/checkin/page.tsx
apps/client-request/app/pickup/page.tsx
apps/client-request/app/records/page.tsx
```

Add migrations:

```text
db/migrations/016_agent_workflows.sql
db/migrations/017_vetagent_mock_entities.sql
```

Keep current task tables:

- `tasks`
- `task_events`
- `notification_events`
- passcode/auth tables already present

Do not break the current task board while adding agents.

## Person 1 - Sandeep: Supabase, Render, Opsera Deploy Path

Mission: make this repo deployable and repeatable.

Owns:

- Supabase project.
- Supabase connection string.
- Supabase SQL migration execution.
- Render services.
- Render env vars.
- Render deploy verification.
- Opsera pipeline setup.
- Production/mock-mode readiness.

Does not own:

- Frontend implementation.
- Agent prompts/tools.
- Apify actor selection.
- Passcode/auth rewrite.

### Person 1 Exact Tasks

1. Create Supabase project.
2. Set Postgres connection string as `DATABASE_URL`.
3. Keep `POSTGRES_URL` supported because `packages/db/src/connection.ts` already supports both.
4. Run migrations with existing command:

```bash
npm run db:migrate
```

5. Create two Render web services:

- `vetagent-internal`
- `vetagent-client`

6. Render service config:

Internal service:

```text
root: repo root
build command: npm install && npm run build --workspace @central-vet/internal
start command: npm run start --workspace @central-vet/internal
env:
  DATABASE_URL
  HOSPITAL_NAME
  APP_TIME_ZONE
  VET_ADMIN_PASSCODE
  VET_APP_ADMIN_PASSCODE
  VET_VETERINARIAN_PASSCODE
  OPENAI_API_KEY
  E2B_API_KEY
  APIFY_TOKEN
  MOCK_MODE=true
  AGENT_RUNTIME=mock
```

Client service:

```text
root: repo root
build command: npm install && npm run build --workspace @central-vet/client-request
start command: npm run start --workspace @central-vet/client-request
env:
  DATABASE_URL
  HOSPITAL_NAME
  APP_TIME_ZONE
  MOCK_MODE=true
```

7. Add missing `start` scripts if needed in:

- `apps/internal/package.json`
- `apps/client-request/package.json`

8. Do not change login UX/passcodes.
9. Create Opsera pipeline:

- source: GitHub repo `sandeepsalwan1/AgentHackathon`
- build: `npm install`
- checks: `npm run typecheck`, `npm run build`
- deploy target: Render
- required envs: documented by name only, no values

10. Write/update deploy notes in:

```text
docs/render-supabase-opsera.md
```

### Person 1 First 4 Hours

- Supabase project exists.
- `DATABASE_URL` works locally.
- `npm run db:migrate` runs against Supabase.
- Render service shells created.
- Opsera project/pipeline started, even if deploy gate is not perfect yet.

### Person 1 Done This Week

- Render internal URL works.
- Render client URL works.
- Public request creates Supabase task.
- Internal task board reads/updates Supabase task.
- Opsera pipeline runs build/check/deploy or has a clear documented blocker.

## Person 2 - Accounts/Tools Scout: Apify, E2B, Opsera Support

Mission: make external accounts usable by Person 1 and Person 3.

Owns:

- Apify account and actor research.
- E2B account/token readiness.
- Opsera access support.
- Tool notes.
- Sample outputs.

This lane is intentionally smaller. Main execution focus is Person 1, Person 3, Person 4.

### Person 2 Exact Tasks

1. Confirm Apify token.
2. Find Apify actors for:

- Google Maps/local business discovery.
- Website scraping/crawling.
- Structured page extraction.

3. Run one veterinary competitor scrape.
4. Export sample to:

```text
docs/samples/apify-competitor-sample.json
```

5. Confirm E2B token.
6. Confirm Opsera login/access.
7. Write:

```text
docs/tool-readiness.md
```

Include:

- tool name,
- account owner,
- token secret name,
- free-tier limits,
- chosen actor IDs,
- sample output path,
- blocker if any.

## Person 3 - AI/Backend Engineer: Agents, Tools, Data, E2B

Mission: build the actual agent system on mock data.

Owns:

- OpenAI Agents SDK integration.
- Typed tool contracts.
- Mock provider.
- Workflow persistence.
- Approval persistence.
- Internal/external agent routes.
- E2B scenario runner.
- Apify integration after Person 2 provides token/actor.
- Backend support for Person 4.

Does not own:

- Supabase/Render/Opsera setup.
- Frontend polish.
- Passcode rewrite.

### Person 3 Code Decisions

- Create `packages/agents` TypeScript workspace.
- Create `packages/mock-data` TypeScript workspace.
- Add dependencies only after quick package health check.
- Use Zod for tool input/output validation, matching current repo style.
- Use existing `@central-vet/db` functions for task writes.
- Add new DB helpers in `packages/db/src/agents.ts`, not inside route files.
- Export from `packages/db/src/index.ts`.
- Add Next.js routes under `apps/internal/app/api/agent/*`.
- Do not let model text write SQL directly.

### Person 3 Migration Work

Create `db/migrations/016_agent_workflows.sql`:

```sql
create type workflow_status as enum ('running', 'needs_approval', 'completed', 'failed');
create type approval_status as enum ('pending', 'approved', 'rejected', 'expired');

create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  agent_type text not null,
  scenario text,
  status workflow_status not null default 'running',
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflow_events (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references workflow_runs(id) on delete cascade,
  event_type text not null,
  tool_name text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid references workflow_runs(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  approval_type text not null,
  status approval_status not null default 'pending',
  title text not null,
  summary text not null,
  proposed_payload jsonb not null default '{}',
  decided_by_name text,
  decided_by_role app_role,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists agent_traces (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid references workflow_runs(id) on delete set null,
  provider_trace_id text,
  compact_summary text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

Create `db/migrations/017_vetagent_mock_entities.sql` with MVP mock entities:

- `clients`
- `pets`
- `appointments`
- `visits`
- `records_requests`
- `invoices`
- `invoice_items`
- `service_catalog`
- `competitor_price_snapshots`

Keep it minimal. Only fields needed by this week's demo.

### Person 3 Package Work

`packages/agents/src/contracts.ts` should define shared frontend/backend shapes:

```ts
export type AgentMode = "mock" | "mirror" | "live";
export type AgentType = "external" | "internal" | "pricing" | "records";

export type WorkflowStatus = "running" | "needs_approval" | "completed" | "failed";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type AgentRunRequest = {
  tenantId: string;
  agentType: AgentType;
  scenario: string;
  message: string;
  context?: Record<string, unknown>;
};

export type AgentRunResponse = {
  runId: string;
  status: WorkflowStatus;
  message: string;
  taskIds: string[];
  approvalIds: string[];
  events: WorkflowEventDTO[];
};

export type WorkflowEventDTO = {
  id: string;
  eventType: string;
  toolName?: string;
  createdAt: string;
  payload: Record<string, unknown>;
};
```

`packages/agents/src/tools.ts` first tools:

- `lookup_client`
- `lookup_pet`
- `list_slots`
- `book_appointment`
- `start_checkin`
- `get_wait_status`
- `mark_arrived`
- `create_task`
- `update_task`
- `request_records_transfer`
- `get_invoice_summary`
- `flag_invoice_issue`
- `run_competitor_scan`
- `create_price_review_report`

`packages/agents/src/mockProvider.ts` must use only mock/local DB data. No live PMS integration.

`packages/agents/src/guardrails.ts` rules:

- no diagnosis,
- emergency language escalates,
- records transfer needs approval,
- billing/pricing changes need approval,
- no live writes this week.

### Person 3 API Routes

Create:

```text
apps/internal/app/api/agent/external/route.ts
apps/internal/app/api/agent/internal/route.ts
apps/internal/app/api/agent/runs/[id]/route.ts
apps/internal/app/api/approvals/route.ts
apps/internal/app/api/approvals/[id]/route.ts
apps/internal/app/api/mock/clinic/route.ts
```

Route contracts:

```text
POST /api/agent/external
body: AgentRunRequest
returns: AgentRunResponse

POST /api/agent/internal
body: AgentRunRequest
returns: AgentRunResponse

GET /api/agent/runs/:id
returns: run + events + approvals + taskIds

GET /api/approvals
returns: pending approvals

PATCH /api/approvals/:id
body: { actor, decision: "approved" | "rejected", note?: string }
returns: approval

GET /api/mock/clinic
returns: mock clients, pets, appointments, service catalog
```

Auth decision:

- Internal agent routes use current actor/passcode helpers from `apps/internal/app/api/_shared.ts`.
- Public client pages call internal routes only through safe public/external endpoints or mock fixture route.
- Do not add Supabase Auth this week.

### Person 3 E2B Work

Use E2B for:

- scenario/eval execution,
- isolated data-processing experiments,
- validating agent runs without touching production data.

Add script:

```text
packages/agents/src/e2bRunner.ts
```

Add npm script:

```json
"agent:test:e2b": "tsx packages/agents/src/scenarioRunner.ts --runner=e2b"
```

Scenarios:

- booking,
- check-in,
- sick-pet escalation,
- records-transfer approval,
- pricing-review.

### Person 3 First 4 Hours

- Create `packages/agents`.
- Create `packages/mock-data`.
- Add contracts.
- Add mock provider.
- Add route stubs returning fixture data.
- Give Person 4 stable response shapes.

### Person 3 Done This Week

- External booking/check-in/sick-pet scenarios work in mock mode.
- Internal daily-summary/records-transfer scenarios work in mock mode.
- Approval requests persist.
- Agent runs and events persist.
- E2B runs at least one scenario.
- Apify pricing scan creates a pricing-review task.

## Person 4 - Frontend/Product Engineer: Screens, Flows, Demo

Mission: build the user-facing product in parallel without waiting for backend completion.

Owns:

- All frontend screens.
- Public/client workflows.
- Staff/internal agent surfaces.
- Approval queue UI.
- Workflow run status UI.
- Demo-ready UX.
- Screenshot proof.

Does not own:

- Supabase/Render setup.
- Agent SDK internals.
- Apify/E2B/Opsera accounts.
- Passcode auth rewrite.

### Person 4 Parallel Work Rule

Person 4 should not wait for Person 3.

Use this order:

1. Build screens against static fixtures in `packages/mock-data`.
2. Switch to `GET /api/mock/clinic` when Person 3 adds it.
3. Switch submit actions to `/api/agent/*` when ready.
4. Keep old task board usable the whole time.

### Person 4 Exact Files

Modify/add:

```text
apps/client-request/app/page.tsx
apps/client-request/app/components/RequestForm.tsx
apps/client-request/app/booking/page.tsx
apps/client-request/app/checkin/page.tsx
apps/client-request/app/pickup/page.tsx
apps/client-request/app/records/page.tsx
apps/client-request/app/components/AgentFlowShell.tsx

apps/internal/app/page.tsx
apps/internal/app/components/TaskBoard.tsx
apps/internal/app/components/InternalAgentPanel.tsx
apps/internal/app/components/ApprovalQueue.tsx
apps/internal/app/components/WorkflowRunTimeline.tsx
apps/internal/app/components/DailyOpsDigest.tsx
apps/internal/app/components/PricingReviewPanel.tsx
```

Do not split `TaskBoard.tsx` unless needed. It is large, but avoid risky refactor this week.

### Person 4 Screens

Public app:

- `/`: keep current client request path working.
- `/booking`: appointment request -> slot suggestion -> confirm.
- `/checkin`: "I'm here" -> arrival/check-in -> queue status.
- `/pickup`: pickup/status lookup -> status update.
- `/records`: records transfer request -> internal approval task.

Internal app:

- task board remains primary.
- add internal agent panel near top or side.
- add approval queue for records/billing/pricing.
- add workflow timeline drawer/panel.
- add pricing review panel.
- add daily ops digest.

### Person 4 Frontend Contracts

Assume these types from Person 3:

```ts
type AgentRunResponse = {
  runId: string;
  status: "running" | "needs_approval" | "completed" | "failed";
  message: string;
  taskIds: string[];
  approvalIds: string[];
  events: {
    id: string;
    eventType: string;
    toolName?: string;
    createdAt: string;
    payload: Record<string, unknown>;
  }[];
};
```

Temporary frontend fixture path:

```text
packages/mock-data/src/scenarios.ts
```

Person 4 can import fixture data or duplicate a tiny local fixture until package wiring exists.

### Person 4 UX Rules

- No marketing landing page.
- First screen is workflow, not pitch.
- Mobile-first for client pages.
- Dense operational layout for internal pages.
- Always show agent status: drafted, needs approval, completed, blocked.
- Risky actions must show approval state.
- No medical advice copy. Use escalation language.
- Do not change passcode screens except visual polish if necessary.

### Person 4 First 4 Hours

- Add screen skeletons.
- Add `AgentFlowShell`.
- Add fixture-backed booking/check-in/pickup/records flows.
- Add `InternalAgentPanel` skeleton.
- Add `ApprovalQueue` skeleton.
- Keep current `/api/requests` form working.

### Person 4 Done This Week

- Full demo can be clicked without manual DB edits.
- Public booking/check-in/pickup/records pages exist.
- Internal agent panel calls backend route when available.
- Approval queue shows pending approvals.
- Workflow timeline shows agent/tool events.
- Screenshots prove desktop + mobile layout.

## Parallel Execution Plan

No one blocks anyone else.

Hour 0-4:

- Person 1: Supabase/Render/Opsera shells.
- Person 2: Apify/E2B/Opsera tokens and samples.
- Person 3: contracts, mock provider, route stubs.
- Person 4: fixture-backed UI skeletons.

Day 1:

- Person 1: Supabase migrations and Render deploy.
- Person 3: agent route stubs and DB migration draft.
- Person 4: public flow screens and internal panel skeleton.

Day 2:

- Person 1: env docs and Render smoke checks.
- Person 3: external booking/check-in tools.
- Person 4: connect screens to route stubs.

Day 3:

- Person 1: Opsera pipeline build/check/deploy.
- Person 3: internal daily summary and records approval.
- Person 4: approval queue and timeline UI.

Day 4:

- Person 1: deploy stabilization.
- Person 3: E2B scenario runner.
- Person 4: demo polish and screenshots.

Day 5:

- Person 1: final deploy proof.
- Person 3: Apify pricing scan -> task.
- Person 4: final demo path.

## MVP Demo Path

1. Open public booking page.
2. Ask for vaccine appointment.
3. Agent suggests slot from mock data.
4. Confirm appointment.
5. Open check-in page.
6. Mark client arrived.
7. Internal board shows task/state.
8. Send sick-pet message.
9. Agent refuses diagnosis and creates urgent staff task.
10. Request records transfer.
11. Internal approval queue shows records approval.
12. Internal agent generates daily ops digest.
13. Apify scan creates pricing-review report.
14. Pricing report creates task; no automatic repricing.

## Acceptance Criteria

Technical:

- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run db:migrate` works on Supabase.
- Render internal app deploys.
- Render client app deploys.
- Opsera runs at least build/typecheck or has documented blocker.
- E2B scenario runner runs at least one scenario.

Product:

- Current task board still works.
- Current passcodes still work.
- Public request form still works.
- Public booking/check-in/pickup/records flows exist.
- Internal agent panel exists.
- Approval queue exists.
- Workflow events visible.
- Mock-only mode works end to end.

Safety:

- No diagnosis.
- No silent records release.
- No silent billing/pricing changes.
- No live vendor writes.
- Every risky action creates approval request.

## Research Notes

Use official docs while implementing:

- OpenAI Agents SDK agents/tools/guardrails/tracing: https://openai.github.io/openai-agents-js/
- E2B JavaScript/TypeScript SDK and sandboxes: https://www.e2b.dev/docs
- Apify Actors and structured runs: https://docs.apify.com/platform/actors
- Render monorepo services/root/build/start commands: https://render.com/docs/monorepo-support
- Supabase migrations and remote deploy flow: https://supabase.com/docs/guides/deployment/database-migrations
- Opsera pipelines, approval gates, build/deploy orchestration: https://docs.opsera.io/
