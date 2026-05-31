# VetAgent 4-Person Technical Execution Plan

Date: 2026-05-31

Source brief: `VetAgent.md`.

Goal: build the full agent-first VetAgent MVP, not just a task board. The product must address the real clinic pain: no usable check-in, phone backlog, 20-minute waits, weak follow-up revenue capture, records-transfer grunt work, sick-pet inbound messages, invoices/admin work, competitor pricing research, and underused task tracking.

## Locked Decisions

- Apofy/Apofine = Apify.
- Mock data only for the current sprint.
- Sandeep owns Supabase and all Render work.
- Use Render for deploy.
- Use Supabase Postgres for database.
- Use E2B.
- Use Opsera.
- Use OpenAI Agents SDK.
- Use TypeScript inside this repo.
- Keep current passcode auth. Do not add Supabase Auth for the current sprint.
- Do not change passcode semantics or env names:
  - `VET_ADMIN_PASSCODE`
  - `VET_APP_ADMIN_PASSCODE`
  - `VET_VETERINARIAN_PASSCODE`
- Keep current task board working at every step.
- Person 4 is frontend/product and must be able to work without waiting on Person 1 or Person 3.

## Product Priority Order

This plan uses the latest product context, not generic AI-agent priorities.

1. Check-in and arrival flow. There is no real check-in today. This is the strongest wedge.
2. Follow-ups and outtake. This is the revenue capture layer: pet ready, vaccines due, reminders, reactivation, pickup, next appointment.
3. Booking and wait-time relief. Reduce phone backlog and 20-minute waits.
4. Call/voice intake and transcript handling. Start mock-first: spoken request UI, call transcript examples, call-to-task workflows. Live telephony can plug in later.
5. Task manager as execution fabric. The existing task manager is reused and made agent-driven.
6. Internal agent. Records transfers, sick-pet emails, invoice/admin checks, competitor pricing, daily ops.
7. Future PMS replacement path. Avimark replacement is not the current MVP, but the data model should not block that future.

Known clinic systems/context:

- Avimark: current practice-management backbone.
- IDEXX: diagnostics/lab ecosystem in current context.
- Demandforce: follow-up/outreach/reminder layer in current context.
- Antech: treat as later optional diagnostics/provider context unless real access appears.
- Real integration access is not reliable yet, so agents must work on mock data and local normalized data first.

## Five Build Steps

These are the five product steps everyone should optimize around.

### Step 1 - Arrival, Check-In, Wait-Time Relief

Problem:

- There is no real check-in flow.
- Clients arrive and still depend on phones/front desk.
- Wait times stack up when 30+ patients and only 1-2 people handle lines.

Decision:

- Build `/arrival` as the first external-agent wedge.
- Use mock appointment lookup first.
- Add browser voice input as progressive enhancement.
- Add wait-status states in local mock data.
- Staff still controls real outcome from internal UI.

### Step 2 - Follow-Up / Outtake Revenue

Problem:

- Clinics miss revenue after visits: vaccines due, rechecks due, refill reminders, pet ready, next booking.
- Even low response rates create meaningful monthly lift.

Decision:

- Build follow-up as a real product surface, not just notification plumbing.
- Use mock follow-up candidates and service catalog.
- External agent converts follow-up response into appointment/task.
- Internal agent shows follow-up candidates and expected value.

### Step 3 - Booking / Phone Deflection / Call Intake

Problem:

- Booking by phone creates front-desk backlog.
- Callers ask the same recurring questions.
- Call transcripts should become structured tasks and bookings.

Decision:

- Build `/booking` for direct booking.
- Build `/call` as a mock call/transcript intake surface.
- No live phone carrier dependency in current sprint.
- Store mock call transcripts and run them through the same agent tools.

### Step 4 - Task Manager As Execution Fabric

Problem:

- A task manager exists, but staff do not reliably use it.
- Work gets dropped when people are busy.

Decision:

- Do not rebuild task management.
- Use existing `tasks` and `task_events` as the visible work queue.
- Agents create, update, and link tasks.
- Approval requests and workflow events sit beside tasks.

### Step 5 - Internal Agent / Admin Automation

Problem:

- Records transfers, sick-pet emails, invoice checks, market research, and pricing reviews consume staff time.

Decision:

- Internal agent handles daily ops, records-transfer drafts, sick-pet triage, invoice flags, follow-up candidates, and pricing reports.
- Risky actions create approval requests.
- No diagnosis.
- No silent records release.
- No silent repricing.

## Architecture Decisions

- One repo, TypeScript, npm workspaces.
- No new backend service unless the repo truly cannot support it.
- One shared Postgres database.
- `packages/db` remains database boundary.
- `packages/agents` becomes agent/tool boundary.
- `packages/mock-data` becomes scenario/fixture boundary.
- Next.js route handlers are thin wrappers.
- All agent actions go through typed tools.
- All tool calls log workflow events.
- Agent traces are stored as compact summaries.
- Existing passcodes stay as-is.
- Public/client flows never receive service-role secrets.
- Mock mode is first-class, not a temporary hack.
- Mirror/live provider modes can be added behind the same tool/provider interface later.

## Decisions Not To Reopen During Build

- Do not switch away from TypeScript.
- Do not add Supabase Auth.
- Do not rebuild the current task board from scratch.
- Do not make live Avimark/IDEXX/Demandforce access a blocker.
- Do not make live phone integration a blocker.
- Do not replace Resend/notification plumbing during this sprint unless it blocks a demo path.
- Do not make pricing changes autonomous.
- Do not make records transfer autonomous.
- Do not give medical advice.
- Do not create a marketing landing page.
- Do not split into another repo.
- Do not introduce a second production database.

## Current Repo Map

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
- `apps/internal/app/api/tasks/[id]/undo/route.ts`: undo task status.
- `apps/internal/app/api/events/route.ts`: task audit log.
- `apps/internal/app/api/auth/route.ts`: current passcode login.
- `apps/internal/app/api/_shared.ts`: current auth helpers. Do not rewrite for MVP.
- `apps/internal/app/lib/taskWorkflow.ts`: role/task permissions.
- `apps/client-request/app/api/requests/route.ts`: public request to task.
- `packages/db/src/tasks.ts`: task CRUD and task events.
- `packages/db/src/types.ts`: shared task types.
- `packages/db/src/connection.ts`: `DATABASE_URL` / `POSTGRES_URL` support.
- `packages/db/scripts/migrate.mjs`: migration runner.
- `.env.example`: current env surface.

## Current Sprint Build Shape

Add these new modules:

```text
packages/agents/
  package.json
  src/
    index.ts
    contracts.ts
    guardrails.ts
    workflowStore.ts
    tools.ts
    mockProvider.ts
    externalAgent.ts
    internalAgent.ts
    followupAgent.ts
    callAgent.ts
    messageAgent.ts
    pricingAgent.ts
    recordsAgent.ts
    scenarioRunner.ts
    e2bRunner.ts
    apifyPricing.ts

packages/mock-data/
  package.json
  src/
    vetSandbox.ts
    scenarios.ts
    frontendFixtures.ts

apps/internal/app/api/agent/external/route.ts
apps/internal/app/api/agent/internal/route.ts
apps/internal/app/api/agent/followup/route.ts
apps/internal/app/api/agent/call/route.ts
apps/internal/app/api/agent/runs/[id]/route.ts
apps/internal/app/api/approvals/route.ts
apps/internal/app/api/approvals/[id]/route.ts
apps/internal/app/api/mock/clinic/route.ts

apps/client-request/app/booking/page.tsx
apps/client-request/app/arrival/page.tsx
apps/client-request/app/pickup/page.tsx
apps/client-request/app/records/page.tsx
apps/client-request/app/followup/page.tsx
apps/client-request/app/call/page.tsx
apps/client-request/app/components/AgentFlowShell.tsx
apps/client-request/app/components/VoiceTextInput.tsx
```

Add migrations:

```text
db/migrations/016_agent_workflows.sql
db/migrations/017_vetagent_mock_entities.sql
db/migrations/018_seed_vetagent_mock_data.sql
db/migrations/019_mock_communications.sql
```

Add docs:

```text
docs/render-supabase-opsera.md
docs/tool-readiness.md
docs/agent-api-contracts.md
docs/demo-script.md
docs/samples/apify-competitor-sample.json
docs/samples/mock-call-transcripts.md
```

## Parallel Ownership Rules

No one should block anyone else.

Person 1 owns platform plus backend foundations:

- Supabase, Render, Opsera.
- DB migrations.
- DB helper scaffolding.
- route stubs.
- seed/mock data deployment path.
- basic agent workflow persistence.

Person 3 owns agent intelligence and tool execution:

- OpenAI Agents SDK.
- tool registry.
- mock provider behavior.
- E2B scenario runner.
- Apify pricing workflow.
- agent prompts/guardrails.
- scenario tests.

Person 4 owns frontend/product:

- all public and internal screens.
- fixture-first UX.
- agent flow components.
- approval queue.
- demo path.

Person 2 owns accounts/tools plus product research support for Person 4:

- Apify account and actor choice.
- E2B account/token.
- Opsera support.
- sponsor/vendor coordination notes.
- sample outputs.
- competitor clinic/service research.
- mock call/email/request examples.
- frontend content QA with Person 4.

File boundaries:

- Person 1 primarily touches:
  - `db/migrations/*`
  - `packages/db/src/*`
  - `packages/db/scripts/*`
  - `.env.example`
  - `docs/render-supabase-opsera.md`
  - `docs/agent-api-contracts.md`
  - route stubs under `apps/internal/app/api/*`
- Person 3 primarily touches:
  - `packages/agents/*`
  - `packages/mock-data/*`
  - completed implementations under `apps/internal/app/api/agent/*`
  - `docs/tool-readiness.md`
- Person 4 primarily touches:
  - `apps/client-request/app/*`
  - `apps/internal/app/components/*`
  - `apps/internal/app/page.tsx`
  - `apps/client-request/app/globals.css`
  - `apps/internal/app/globals.css`
  - `docs/demo-script.md`
- Person 2 primarily touches:
  - `docs/tool-readiness.md`
  - `docs/samples/*`
  - mock call/email examples used by Person 3 and Person 4
  - product QA notes for Person 4

If Person 1 creates a route stub and Person 3 needs to finish it, Person 1 should keep the stub minimal and move real behavior into `packages/agents`.

## Shared Contracts First

Person 1 and Person 3 must produce this contract early so Person 4 can build in parallel.

Create `packages/agents/src/contracts.ts`:

```ts
export type AgentMode = "mock" | "mirror" | "live";

export type AgentType =
  | "external"
  | "internal"
  | "arrival"
  | "booking"
  | "followup"
  | "call"
  | "message"
  | "records"
  | "pricing";

export type WorkflowStatus =
  | "running"
  | "needs_approval"
  | "completed"
  | "failed";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type WorkflowEventDTO = {
  id: string;
  eventType: string;
  toolName?: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

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

export type ApprovalDTO = {
  id: string;
  workflowRunId: string | null;
  taskId: string | null;
  approvalType: string;
  status: ApprovalStatus;
  title: string;
  summary: string;
  proposedPayload: Record<string, unknown>;
  createdAt: string;
};
```

Person 4 can copy these types into frontend temporarily if workspace imports are not wired yet.

## Person 1 - Sandeep: Platform, DB, Render, Opsera, Backend Foundations

Mission: make the system deployable, persistent, and usable by the other builders.

Person 1 has more work than just infra. Person 1 should do the platform work and the foundation code that unblocks Person 3 and Person 4.

### Person 1 Owns

- Supabase project.
- Supabase DB connection.
- Render internal service.
- Render client service.
- Opsera pipeline.
- env var surface.
- migration execution.
- workflow DB schema.
- mock entity DB schema.
- seed data path.
- route stubs.
- DB helper scaffolding.
- smoke tests.
- deploy docs.

### Person 1 Must Not Change

- current passcode behavior.
- `VET_ADMIN_PASSCODE`
- `VET_APP_ADMIN_PASSCODE`
- `VET_VETERINARIAN_PASSCODE`
- existing public request form behavior.
- current task board lanes and permissions.

### Person 1 First 4 Hours

1. Create Supabase project.
2. Set local `DATABASE_URL`.
3. Run current migrations:

```bash
npm run db:migrate
```

4. Add missing `start` scripts if absent:

```json
{
  "scripts": {
    "start": "next start"
  }
}
```

5. Create Render services:

- `vetagent-internal`
- `vetagent-client`

6. Add Render env vars by name.
7. Create Opsera project/pipeline shell.
8. Create `docs/render-supabase-opsera.md`.
9. Create migration files `016`, `017`, `018`, `019` with schema placeholders if Person 3 has not finished logic.
10. Create route stubs returning fixture-shaped responses:

```text
apps/internal/app/api/agent/external/route.ts
apps/internal/app/api/agent/internal/route.ts
apps/internal/app/api/agent/followup/route.ts
apps/internal/app/api/agent/call/route.ts
apps/internal/app/api/approvals/route.ts
apps/internal/app/api/mock/clinic/route.ts
```

### Person 1 Full Work Packages

Person 1 has a large lane. This is not just "make accounts." Person 1 builds the foundation that lets the other people ship fast.

P1-A: Supabase production-ish project

- Create the Supabase project.
- Save secret names only in docs.
- Confirm `DATABASE_URL` works with `packages/db/src/connection.ts`.
- Run existing migrations `001` through `015`.
- Run new migrations `016` through `019`.
- Verify tables exist:
  - `tasks`
  - `task_events`
  - `workflow_runs`
  - `workflow_events`
  - `approval_requests`
  - `agent_traces`
  - `vet_clients`
  - `vet_pets`
  - `vet_appointments`
  - `vet_service_catalog`
  - `mock_messages`
  - `mock_call_transcripts`
  - `followup_candidates`

P1-B: Render deploy foundation

- Add `start` scripts if missing.
- Confirm both Next apps can build independently.
- Create Render service for `apps/internal`.
- Create Render service for `apps/client-request`.
- Set env vars in Render.
- Add deploy notes.
- Confirm Render logs do not print secret values.
- Confirm app can boot with `MOCK_MODE=true`.

P1-C: Opsera pipeline

- Create Opsera connection to GitHub repo.
- Add pipeline steps:
  - install,
  - typecheck,
  - build,
  - optional migration check,
  - Render deploy trigger.
- Add manual approval gate if fast.
- Document any Opsera blocker.
- Make Opsera nonblocking for local development.

P1-D: DB workflow helpers

- Add `packages/db/src/agents.ts`.
- Add helper for workflow run creation.
- Add helper for workflow events.
- Add helper for approval creation.
- Add helper for approval decision.
- Add helper for listing pending approvals.
- Add helper for fetching run timeline.
- Export all helpers from `packages/db/src/index.ts`.

P1-E: mock clinic data helpers

- Add `packages/db/src/mockClinic.ts`.
- Read mock clients.
- Read mock pets.
- Read mock appointments.
- Read mock service catalog.
- Read mock follow-up candidates.
- Read mock messages/call transcripts.
- Keep helpers simple SQL wrappers.

P1-F: route stubs for parallel frontend

- Add `/api/mock/clinic`.
- Add `/api/agent/external`.
- Add `/api/agent/internal`.
- Add `/api/agent/followup`.
- Add `/api/agent/call`.
- Add `/api/approvals`.
- Add `/api/agent/runs/:id`.
- Route stubs must return the final response shape, even if the content is fake.
- This unblocks Person 4 immediately.

P1-G: call/communications schema

- Add mock call transcript tables.
- Add mock inbound message tables.
- Add follow-up candidate tables.
- Add communication event table if needed.
- No live Twilio/phone integration required for the current sprint.
- But the schema should support call transcript -> agent -> task.

P1-H: deployment smoke script/docs

- Write a smoke checklist in `docs/render-supabase-opsera.md`.
- Include exact URLs once available.
- Include exact commands.
- Include known env names.
- Include "do not change passcodes" warning.

P1-I: backend handoff to Person 3

- Tell Person 3 which helpers exist.
- Tell Person 3 which route stubs are safe to replace.
- Keep route stubs thin so Person 3 only changes package internals.

P1-J: frontend handoff to Person 4

- Provide stable API response examples in `docs/agent-api-contracts.md`.
- Make `/api/mock/clinic` work before real agent routes.
- Keep fixtures stable during the sprint unless coordinated.

P1-K: verification

- Verify old public request still works.
- Verify old task board still works.
- Verify old passcode auth still works.
- Verify new approval list route works.
- Verify new mock clinic route works.
- Verify Render deploy after merge.

P1-L: phone/call foundation

- Add mock call transcript schema.
- Add `/api/agent/call` route stub.
- Add mock transcript samples to seed data.
- Add call intent enum values:
  - `arrival`
  - `booking`
  - `records_transfer`
  - `sick_pet`
  - `pickup_status`
  - `billing`
  - `followup`
- Add DB helper to list new call transcripts.
- Add DB helper to mark call transcript processed.
- Add route response contract for call-to-task conversion.
- Document later live-phone options without implementing them.

P1-M: communication and message foundation

- Add mock inbound email/message table.
- Add sample sick-pet email.
- Add sample records-transfer email.
- Add sample pickup-status message.
- Add sample appointment-booking message.
- Add `/api/mock/clinic` response section for messages.
- Add DB helper for listing inbound messages.
- Add DB helper for marking a message triaged.

P1-N: follow-up/outtake foundation

- Add follow-up candidate schema.
- Add sample vaccine due candidate.
- Add sample recheck candidate.
- Add sample refill candidate.
- Add expected revenue/value field.
- Add DB helper for listing candidates.
- Add DB helper for marking candidate converted/dismissed.
- Add route stub for `/api/agent/followup`.

P1-O: approval system foundation

- Approval list route must support filtering by status.
- Approval decision route must use current actor/passcode auth.
- Approval decision must write `decided_by_name`, `decided_by_role`, `decided_note`, `decided_at`.
- Approval route must not perform real records send or billing changes.
- Approval route may perform safe mock state updates.

P1-P: route contract validation

- Every new route returns JSON even on error.
- Every route has no-store headers where needed.
- Internal-only routes use current actor auth.
- Public mock/external routes never expose private task fields.
- Route stubs should be good enough for Person 4 to integrate immediately.

P1-Q: environment and secret hygiene

- Update `.env.example` with names only:
  - `OPENAI_API_KEY`
  - `E2B_API_KEY`
  - `APIFY_TOKEN`
  - `AGENT_RUNTIME=mock`
  - `MOCK_MODE=true`
  - `RENDER_DEPLOY_HOOK_INTERNAL`
  - `RENDER_DEPLOY_HOOK_CLIENT`
- Never commit real values.
- Never print values in docs.
- Keep existing Resend vars unchanged.

P1-R: build-system and workspace wiring

- Add `packages/agents` to npm workspaces.
- Add `packages/mock-data` to npm workspaces.
- Add `tsx` if needed for local scenario scripts.
- Add scripts:
  - `agent:test`
  - `agent:test:e2b`
  - `db:migrate`
  - `db:seed` if useful
- Keep `npm run build` at root working.

P1-S: operational docs

- `docs/render-supabase-opsera.md`: deploy and env setup.
- `docs/agent-api-contracts.md`: route contracts.
- `docs/demo-script.md`: final walkthrough links.
- Include exact owner handoff checklist for Person 3 and Person 4.

### Person 1 Render Details

Internal Render service:

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

Client Render service:

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

### Person 1 Opsera Details

Create a pipeline that does:

1. Pull from GitHub `sandeepsalwan1/AgentHackathon`.
2. Install:

```bash
npm install
```

3. Typecheck:

```bash
npm run typecheck
```

4. Build:

```bash
npm run build
```

5. Deploy to Render or trigger Render deploy hook.
6. Add manual approval gate before production deploy if supported quickly.
7. Document blockers instead of waiting.

### Person 1 Migration Work

Create `db/migrations/016_agent_workflows.sql`:

```sql
do $$
begin
  create type workflow_status as enum ('running', 'needs_approval', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type approval_status as enum ('pending', 'approved', 'rejected', 'expired');
exception
  when duplicate_object then null;
end $$;

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
  decided_note text,
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

create index if not exists idx_workflow_runs_status_created
  on workflow_runs(status, created_at desc);

create index if not exists idx_workflow_events_run_created
  on workflow_events(workflow_run_id, created_at asc);

create index if not exists idx_approval_requests_status_created
  on approval_requests(status, created_at desc);
```

Create `db/migrations/017_vetagent_mock_entities.sql`:

```sql
create table if not exists vet_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  full_name text not null,
  phone text,
  email text,
  preferred_channel text not null default 'sms',
  created_at timestamptz not null default now()
);

create table if not exists vet_pets (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  client_id uuid not null references vet_clients(id) on delete cascade,
  name text not null,
  species text not null default 'dog',
  breed text,
  date_of_birth date,
  weight text,
  created_at timestamptz not null default now()
);

create table if not exists vet_appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  client_id uuid references vet_clients(id) on delete set null,
  pet_id uuid references vet_pets(id) on delete set null,
  appointment_type text not null,
  status text not null default 'scheduled',
  starts_at timestamptz not null,
  room text,
  checked_in_at timestamptz,
  ready_for_pickup_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists vet_service_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  name text not null,
  category text not null,
  current_price_cents integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists competitor_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  competitor_name text not null,
  source_url text,
  service_name text not null,
  observed_price_cents integer,
  observed_text text,
  captured_by text not null default 'apify',
  captured_at timestamptz not null default now()
);

create table if not exists records_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  client_id uuid references vet_clients(id) on delete set null,
  pet_id uuid references vet_pets(id) on delete set null,
  destination_hospital text,
  destination_email text,
  status text not null default 'draft',
  approval_request_id uuid references approval_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists vet_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  client_id uuid references vet_clients(id) on delete set null,
  pet_id uuid references vet_pets(id) on delete set null,
  status text not null default 'mock',
  subtotal_cents integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists vet_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references vet_invoices(id) on delete cascade,
  service_name text not null,
  amount_cents integer not null,
  flagged boolean not null default false,
  flag_reason text
);
```

Create `db/migrations/018_seed_vetagent_mock_data.sql`:

```sql
insert into vet_clients (full_name, phone, email)
values
  ('Maya Patel', '555-0101', 'maya@example.com'),
  ('Jordan Lee', '555-0102', 'jordan@example.com'),
  ('Sam Rivera', '555-0103', 'sam@example.com')
on conflict do nothing;

insert into vet_service_catalog (name, category, current_price_cents)
values
  ('Wellness Exam', 'exam', 7500),
  ('Rabies Vaccine', 'vaccine', 3200),
  ('DHPP Vaccine', 'vaccine', 3800),
  ('Nail Trim', 'service', 2200),
  ('Records Transfer', 'admin', 0)
on conflict do nothing;
```

Person 3 can improve seed detail later. Person 1 just needs a stable baseline.

Create `db/migrations/019_mock_communications.sql`:

```sql
create table if not exists mock_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  channel text not null,
  direction text not null default 'inbound',
  client_name text,
  client_phone text,
  pet_name text,
  subject text,
  body text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists mock_call_transcripts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  caller_name text,
  caller_phone text,
  pet_name text,
  transcript text not null,
  summary text,
  detected_intent text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists followup_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'central-vet',
  client_name text not null,
  client_phone text,
  pet_name text not null,
  followup_type text not null,
  reason text not null,
  estimated_value_cents integer,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);
```

Seed examples:

```sql
insert into mock_messages (channel, client_name, client_phone, pet_name, subject, body)
values
  ('email', 'Maya Patel', '555-0101', 'Biscuit', 'My dog is sick', 'My dog has been vomiting and will not eat. Please help.'),
  ('email', 'Jordan Lee', '555-0102', 'Luna', 'Records request', 'Please send Luna records to Oak Valley Animal Hospital.'),
  ('web', 'Sam Rivera', '555-0103', 'Max', 'Pickup status', 'Is Max ready to pick up?')
on conflict do nothing;

insert into mock_call_transcripts (caller_name, caller_phone, pet_name, transcript, detected_intent)
values
  ('Maya Patel', '555-0101', 'Biscuit', 'Hi this is Maya. Biscuit is outside for the vaccine appointment and we have been waiting. Can someone check us in?', 'arrival'),
  ('Jordan Lee', '555-0102', 'Luna', 'I need to transfer Luna records to another hospital. Can you send everything today?', 'records_transfer'),
  ('Sam Rivera', '555-0103', 'Max', 'Can I book Max for vaccines after 3 PM?', 'booking')
on conflict do nothing;

insert into followup_candidates (client_name, client_phone, pet_name, followup_type, reason, estimated_value_cents)
values
  ('Maya Patel', '555-0101', 'Biscuit', 'vaccine_due', 'DHPP due soon', 3800),
  ('Jordan Lee', '555-0102', 'Luna', 'recheck_due', 'Ear infection recheck not scheduled', 7500),
  ('Sam Rivera', '555-0103', 'Max', 'refill_due', 'Preventative refill likely due', 6500)
on conflict do nothing;
```

### Person 1 DB Helper Scaffolding

Add `packages/db/src/agents.ts`:

```ts
import { getSql } from "./connection";
import type { Actor } from "./types";

export async function createWorkflowRun(input: {
  tenantId: string;
  agentType: string;
  scenario?: string;
  input: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    insert into workflow_runs (tenant_id, agent_type, scenario, input)
    values (${input.tenantId}, ${input.agentType}, ${input.scenario ?? null}, ${sql.json(input.input)})
    returning id
  `;
  return rows[0];
}

export async function addWorkflowEvent(input: {
  workflowRunId: string;
  eventType: string;
  toolName?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sql = getSql();
  await sql`
    insert into workflow_events (workflow_run_id, event_type, tool_name, payload)
    values (
      ${input.workflowRunId},
      ${input.eventType},
      ${input.toolName ?? null},
      ${sql.json(input.payload ?? {})}
    )
  `;
}

export async function createApprovalRequest(input: {
  workflowRunId?: string | null;
  taskId?: string | null;
  approvalType: string;
  title: string;
  summary: string;
  proposedPayload: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    insert into approval_requests (
      workflow_run_id,
      task_id,
      approval_type,
      title,
      summary,
      proposed_payload
    )
    values (
      ${input.workflowRunId ?? null},
      ${input.taskId ?? null},
      ${input.approvalType},
      ${input.title},
      ${input.summary},
      ${sql.json(input.proposedPayload)}
    )
    returning id
  `;
  return rows[0];
}

export async function decideApprovalRequest(input: {
  id: string;
  actor: Actor;
  decision: "approved" | "rejected";
  note?: string | null;
}) {
  const sql = getSql();
  const rows = await sql`
    update approval_requests
    set status = ${input.decision},
      decided_by_name = ${input.actor.name},
      decided_by_role = ${input.actor.role}::app_role,
      decided_note = ${input.note ?? null},
      decided_at = now()
    where id = ${input.id}
    returning *
  `;
  return rows[0] ?? null;
}
```

Export it from `packages/db/src/index.ts`.

### Person 1 Route Stubs

Stub routes unblock Person 4:

```ts
// apps/internal/app/api/agent/external/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    runId: "mock-run-external",
    status: "completed",
    message: `Mock external agent handled: ${body.message ?? ""}`,
    taskIds: [],
    approvalIds: [],
    events: [
      {
        id: "event-1",
        eventType: "mock_agent_response",
        toolName: "mock_provider",
        createdAt: new Date().toISOString(),
        payload: { scenario: body.scenario ?? "unknown" }
      }
    ]
  });
}
```

Person 3 later replaces internals with `runExternalAgent`.

### Person 1 Smoke Tests

Run:

```bash
npm install
npm run typecheck
npm run build
npm run db:migrate
```

Manual smoke:

1. Open client URL.
2. Submit public request.
3. Open internal URL.
4. Login with current passcode flow.
5. Confirm task appears.
6. Move task status.
7. Confirm `task_events` row exists.

### Person 1 Done For Current Sprint

- Supabase live.
- Render internal live.
- Render client live.
- Opsera runs build/typecheck/deploy or documented blocker.
- migrations `001` through `019` applied.
- workflow tables exist.
- mock seed exists.
- route stubs exist.
- passcodes unchanged.
- deploy docs complete.

## Person 2 - Accounts/Tools Scout

Mission: unblock required third-party tools and work directly with Person 4 on realistic product content.

This lane is not only accounts. Person 2 should feed Person 3 and Person 4 with the real-world examples that make the mock product credible.

### Person 2 Work

1. Confirm Apify token.
2. Confirm E2B token.
3. Confirm Opsera login/access.
4. Track sponsor/vendor notes that affect implementation.
5. Find Apify actors for:

- local competitor discovery,
- website/page scraping,
- structured extraction.

6. Run one veterinary competitor scrape.
7. Save sample:

```text
docs/samples/apify-competitor-sample.json
```

8. Write:

```text
docs/tool-readiness.md
```

Include:

- token secret names only,
- actor IDs,
- free-tier/credit limits,
- sample output path,
- blockers.

### Person 2 Product Support Work

Person 2 should work alongside Person 4 on content and test material:

- collect 10 realistic inbound email examples,
- collect 10 realistic call transcript examples,
- collect 10 appointment booking examples,
- collect 10 records-transfer examples,
- collect 10 follow-up/outtake examples,
- collect 5 invoice/admin anomaly examples,
- collect 5 competitor-pricing/service examples,
- write expected agent outcome for each example,
- identify which examples should create tasks,
- identify which examples should create approvals,
- identify which examples should be fully automated.

Outputs:

```text
docs/samples/mock-call-transcripts.md
docs/samples/mock-inbound-messages.md
docs/samples/mock-followup-campaigns.md
docs/samples/mock-pricing-research.md
```

Person 4 uses these examples in the UI. Person 3 uses them in scenarios/evals.

## Person 3 - AI/Backend Engineer

Mission: make the agent layer real, safe, typed, and testable.

Person 3 owns the intelligence and execution layer. Person 1 may create the DB/route scaffolding; Person 3 makes it actually work.

### Person 3 Owns

- `packages/agents`.
- `packages/mock-data`.
- OpenAI Agents SDK.
- E2B scenario runner.
- Apify pricing integration.
- typed tool registry.
- mock provider.
- external agent.
- internal agent.
- follow-up agent.
- records agent.
- pricing agent.
- guardrails.
- scenario tests.

### Person 3 First 4 Hours

1. Create `packages/agents/package.json`.
2. Create `packages/mock-data/package.json`.
3. Create contracts in `packages/agents/src/contracts.ts`.
4. Create fixture data in `packages/mock-data/src/vetSandbox.ts`.
5. Create `packages/agents/src/mockProvider.ts`.
6. Create `packages/agents/src/tools.ts` with typed no-op/mock tools.
7. Create `packages/agents/src/guardrails.ts`.
8. Replace Person 1 route stubs with calls into `packages/agents` if ready.
9. Publish API response examples for Person 4 in `docs/agent-api-contracts.md`.

### Person 3 Tool Registry

Use Zod, matching current repo style:

```ts
import { z } from "zod";

export type ToolContext = {
  tenantId: string;
  workflowRunId: string;
  actorName?: string;
};

export const listSlotsInput = z.object({
  appointmentType: z.string().min(1),
  datePreference: z.string().optional()
});

export const bookAppointmentInput = z.object({
  clientId: z.string().uuid(),
  petId: z.string().uuid(),
  slotId: z.string(),
  appointmentType: z.string()
});

export type VetTool<I, O> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  run: (input: I, context: ToolContext) => Promise<O>;
};
```

First tools:

- `lookup_client`
- `lookup_pet`
- `create_client`
- `create_pet`
- `list_slots`
- `book_appointment`
- `start_arrival`
- `get_wait_status`
- `mark_arrived`
- `mark_pet_ready`
- `send_status_update`
- `create_task`
- `update_task`
- `request_records_transfer`
- `prepare_records_packet`
- `get_invoice_summary`
- `flag_invoice_issue`
- `find_followup_candidates`
- `create_followup_task`
- `run_competitor_scan`
- `compare_service_prices`
- `create_price_review_report`

### Person 3 Mock Provider

Mock provider must cover the real clinic problems:

```ts
export type MockSlot = {
  id: string;
  startsAt: string;
  appointmentType: string;
  doctorName: string;
};

export type MockWaitStatus = {
  appointmentId: string;
  status: "not_arrived" | "arrived" | "waiting" | "room_ready" | "ready_for_pickup";
  estimatedMinutes: number;
  message: string;
};
```

Required mock workflows:

- arrival/check-in,
- wait-time status,
- booking,
- pickup,
- records transfer,
- sick-pet escalation,
- follow-up reminder,
- invoice scan,
- competitor pricing.

### Person 3 Agent Layer

Use manager plus specialists:

- external agent: public workflows.
- internal agent: staff workflows.
- follow-up agent: reminders/outtake/revenue recovery.
- records agent: records-transfer workflow.
- pricing agent: Apify and service comparison.

Do not overbuild handoffs if time is tight. It is acceptable to route by `scenario` first:

```ts
export async function runExternalAgent(request: AgentRunRequest): Promise<AgentRunResponse> {
  switch (request.scenario) {
    case "arrival":
      return runArrivalScenario(request);
    case "booking":
      return runBookingScenario(request);
    case "pickup":
      return runPickupScenario(request);
    case "records":
      return runRecordsScenario(request);
    case "sick_pet":
      return runSickPetScenario(request);
    default:
      return runGeneralExternalScenario(request);
  }
}
```

### Person 3 Safety Guardrails

`packages/agents/src/guardrails.ts`:

```ts
const emergencyTerms = [
  "can't breathe",
  "cannot breathe",
  "seizure",
  "collapsed",
  "unconscious",
  "bleeding heavily",
  "poison",
  "hit by car"
];

export function classifyMedicalRisk(message: string) {
  const lower = message.toLowerCase();
  if (emergencyTerms.some((term) => lower.includes(term))) {
    return "emergency";
  }
  if (/(sick|vomit|diarrhea|pain|not eating|limping|cough)/i.test(message)) {
    return "needs_staff_review";
  }
  return "low";
}
```

Rules:

- Emergency: tell client to call/come in immediately and create high-priority task.
- Sick but not clear emergency: create staff review task, no diagnosis.
- Records transfer: draft plus approval request.
- Invoice issue: flag plus approval request.
- Pricing change: report plus approval request, no automatic repricing.
- Live provider writes: not allowed for the current sprint.

### Person 3 API Implementation

Route implementation should be thin:

```ts
import { NextResponse } from "next/server";
import { runExternalAgent } from "@central-vet/agents";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await runExternalAgent({
    tenantId: body.tenantId ?? "central-vet",
    agentType: "external",
    scenario: body.scenario,
    message: body.message,
    context: body.context ?? {}
  });
  return NextResponse.json(result);
}
```

Internal routes must use current auth helpers:

```ts
import { authenticateActor } from "../../_shared";
```

No new auth system.

### Person 3 E2B Work

Use E2B for scenario/eval runs.

Add:

```text
packages/agents/src/e2bRunner.ts
packages/agents/src/scenarioRunner.ts
```

Scenario list:

- `arrival`
- `booking`
- `pickup`
- `sick_pet`
- `records_transfer`
- `daily_ops`
- `invoice_scan`
- `followup_reactivation`
- `pricing_review`

Example runner shape:

```ts
export async function runScenario(name: string) {
  const scenario = scenarios[name];
  if (!scenario) throw new Error(`Unknown scenario: ${name}`);
  const result = await runExternalAgent(scenario.request);
  return {
    name,
    passed: scenario.assert(result),
    result
  };
}
```

E2B should run scenario tests isolated from the live DB unless explicitly pointed at a mock Supabase branch/database.

### Person 3 Apify Work

Use Apify only for public competitor research.

`packages/agents/src/apifyPricing.ts`:

```ts
export type CompetitorObservation = {
  competitorName: string;
  sourceUrl?: string;
  serviceName: string;
  observedPriceCents?: number;
  observedText: string;
};

export async function runCompetitorScan(input: {
  location: string;
  serviceNames: string[];
}): Promise<CompetitorObservation[]> {
  // Person 2 provides actor IDs and token secret name.
  // Normalize actor output here.
  return [];
}
```

Output must create:

- `competitor_price_snapshots` rows,
- pricing review report,
- task in current task board.

No automatic price updates.

### Person 3 Done For Current Sprint

- external agent handles booking, arrival, pickup, records request, sick-pet escalation.
- follow-up agent identifies mock follow-up candidates and creates tasks.
- internal agent handles daily ops, records approval, invoice scan.
- pricing agent runs Apify sample path and creates pricing review task.
- workflow runs/events persist.
- approvals persist.
- E2B runs at least one scenario.
- all writes go through typed tools.

### Person 3 Full Agent Work Packages

P3-A: package setup

- Create `packages/agents`.
- Create `packages/mock-data`.
- Add package exports.
- Add TypeScript config if needed.
- Wire package imports from Next apps.
- Keep package APIs small and explicit.

P3-B: mock data model

- Create realistic mock data for:
  - 12 clients,
  - 16 pets,
  - 2 doctors,
  - 2 front-desk/VA-style staff,
  - 20 appointments,
  - 12 pending tasks,
  - 8 mock emails/messages,
  - 8 mock call transcripts,
  - 8 follow-up candidates,
  - 8 service catalog items,
  - 10 competitor price observations,
  - 5 invoices with line items.
- Include normal and edge cases.
- Include high-risk sick-pet examples.
- Include records-transfer examples.
- Include phone-backlog examples.

P3-C: provider interface

Create a provider boundary so future Avimark/Demandforce/IDEXX adapters do not rewrite agents:

```ts
export type VetProvider = {
  lookupClient(input: LookupClientInput): Promise<ClientResult>;
  lookupPet(input: LookupPetInput): Promise<PetResult>;
  listSlots(input: ListSlotsInput): Promise<SlotResult[]>;
  bookAppointment(input: BookAppointmentInput): Promise<AppointmentResult>;
  markArrived(input: MarkArrivedInput): Promise<WaitStatusResult>;
  getWaitStatus(input: WaitStatusInput): Promise<WaitStatusResult>;
  listFollowupCandidates(): Promise<FollowupCandidate[]>;
  requestRecordsTransfer(input: RecordsTransferInput): Promise<RecordsTransferResult>;
  getInvoiceSummary(input: InvoiceSummaryInput): Promise<InvoiceSummary>;
};
```

P3-D: workflow store

- Wrap Person 1 DB helpers in `packages/agents/src/workflowStore.ts`.
- Every agent run creates `workflow_runs`.
- Every tool call creates `workflow_events`.
- Every risky action creates `approval_requests`.
- Every run returns `AgentRunResponse`.

P3-E: external agent

Build scenario handlers:

- `arrival`
- `booking`
- `pickup`
- `records`
- `sick_pet`
- `followup`
- `call`

External agent must:

- ask only necessary questions,
- use tools for state,
- create tasks when staff review is required,
- escalate medical risk,
- avoid diagnosis,
- return clear status text.

P3-F: internal agent

Build scenario handlers:

- `daily_ops`
- `triage_messages`
- `triage_calls`
- `records_queue`
- `invoice_scan`
- `followup_candidates`
- `pricing_review`

Internal agent must:

- summarize today's work,
- rank blockers,
- identify urgent sick-pet messages,
- draft records-transfer tasks,
- flag invoice anomalies,
- create follow-up tasks,
- create pricing review tasks.

P3-G: call agent

Build call transcript processor:

- classify transcript intent,
- extract client/pet/contact,
- create task or route to booking/arrival/records flow,
- preserve transcript summary,
- mark transcript processed,
- create approval for risky actions.

Call intents:

- arrival,
- booking,
- records transfer,
- pickup status,
- sick pet,
- billing,
- follow-up,
- unknown.

P3-H: follow-up agent

Build revenue/outtake flow:

- list follow-up candidates,
- rank by estimated value and urgency,
- create appointment/task from response,
- create internal summary of expected lift,
- support `book`, `dismiss`, `needs_staff_review` states.

P3-I: records agent

Build records transfer flow:

- detect request,
- identify client/pet,
- ask for destination hospital/contact,
- draft transfer packet summary,
- create approval request,
- create linked task,
- do not send records automatically.

P3-J: invoice/admin agent

Build invoice scan:

- read mock invoice summary,
- flag missing common items,
- flag suspicious zero-dollar or duplicate items,
- create review task,
- create approval request for any billing change.

P3-K: pricing agent

Build pricing research:

- call Apify wrapper if token/actor available,
- otherwise load sample Apify JSON,
- normalize competitor observations,
- compare to service catalog,
- write price snapshots,
- create pricing report,
- create review task,
- never update prices.

P3-L: E2B scenario runner

Add scenario tests:

- `arrival_happy_path`
- `arrival_no_appointment`
- `booking_happy_path`
- `booking_ambiguous`
- `sick_pet_emergency`
- `sick_pet_non_emergency`
- `records_transfer`
- `pickup_status`
- `followup_vaccine_due`
- `invoice_missing_charge`
- `pricing_review`
- `call_to_task`

Each scenario should assert:

- expected status,
- expected task count,
- expected approval count,
- expected safety behavior,
- no diagnosis.

P3-M: OpenAI Agents SDK integration

- Use OpenAI Agents SDK for tool-driven agents.
- Keep scenario-router fallback if SDK integration is slower.
- Store compact trace summaries.
- Keep model/provider details configurable by env.
- Do not hardcode model strings in multiple places.

P3-N: failure handling

- If OpenAI API missing, return deterministic mock agent response.
- If E2B missing, run local scenario runner.
- If Apify missing, use sample JSON.
- If DB missing, return clear 503 for server routes.
- Do not block Person 4 on missing external services.

P3-O: backend proof

- Root `npm run typecheck`.
- Root `npm run build`.
- Scenario runner output saved or printed.
- E2B scenario proof.
- At least one task created by agent.
- At least one approval created by agent.
- At least one workflow timeline visible.

## Person 4 - Frontend/Product Engineer

Mission: make VetAgent feel like a real clinic product and keep working in parallel.

Person 4 has a lot of work. Person 4 should not wait for real agents or real DB state. Build against fixtures first, then route stubs, then live mock APIs.

### Person 4 Owns

- all public client workflows.
- internal agent panel.
- approval queue UI.
- workflow timeline UI.
- daily ops digest UI.
- pricing review UI.
- follow-up/outtake UI.
- mobile-first external pages.
- desktop operational internal layout.
- demo script and screenshots.

### Person 4 Must Not Change

- passcode logic.
- API auth behavior.
- DB schema.
- backend tool behavior.

### Person 4 First 4 Hours

1. Add `AgentFlowShell`.
2. Add page skeletons:

```text
apps/client-request/app/booking/page.tsx
apps/client-request/app/arrival/page.tsx
apps/client-request/app/pickup/page.tsx
apps/client-request/app/records/page.tsx
apps/client-request/app/followup/page.tsx
```

3. Add internal components:

```text
apps/internal/app/components/InternalAgentPanel.tsx
apps/internal/app/components/ApprovalQueue.tsx
apps/internal/app/components/WorkflowRunTimeline.tsx
apps/internal/app/components/DailyOpsDigest.tsx
apps/internal/app/components/PricingReviewPanel.tsx
apps/internal/app/components/FollowupPanel.tsx
```

4. Use local fixtures if `packages/mock-data` is not ready.
5. Keep current `/` client request form functional.
6. Keep current internal task board functional.

### Person 4 Public Pages

`/booking`:

- ask client/pet info,
- ask visit reason,
- show mock slots,
- confirm slot,
- show "we have this request" state,
- create or show linked task when backend ready.

`/arrival`:

- "I'm here" flow,
- phone/name/pet lookup,
- arrival button,
- queue status,
- estimated wait,
- "staff will text when room is ready",
- optional voice input.

`/pickup`:

- lookup pet status,
- show ready/not ready,
- request medication/food pickup,
- create task if unclear.

`/records`:

- client/pet lookup,
- destination hospital,
- destination email/fax,
- authorization checkbox,
- creates approval request, not direct send.

`/followup`:

- reminder landing page,
- "book vaccine",
- "request refill",
- "pet is better/worse",
- creates appointment/task.

### Person 4 Voice Input

Voice is optional but useful for the check-in wedge.

Add a progressive enhancement:

- text input always works.
- if browser supports `SpeechRecognition`, add mic button.
- transcript fills the message field.
- no backend speech dependency for the current sprint.

Minimal component shape:

```tsx
export function VoiceTextInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="voiceTextInput">
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
      />
      <button type="button" aria-label="Speak request">
        Speak
      </button>
    </div>
  );
}
```

Person 4 can wire real browser speech later in the same component.

### Person 4 Agent Flow Component

`apps/client-request/app/components/AgentFlowShell.tsx`:

```tsx
type AgentFlowShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  status?: "idle" | "running" | "needs_approval" | "completed" | "blocked";
};

export function AgentFlowShell(props: AgentFlowShellProps) {
  return (
    <main className="agentFlowShell">
      <section className="agentFlowHeader">
        <p>Central Veterinary Hospital</p>
        <h1>{props.title}</h1>
        <span>{props.subtitle}</span>
      </section>
      <section className="agentFlowBody">{props.children}</section>
      {props.status ? <div className="agentFlowStatus">{props.status}</div> : null}
    </main>
  );
}
```

### Person 4 Internal Agent Panel

`InternalAgentPanel` should support:

- text command,
- scenario quick buttons,
- run status,
- latest agent message,
- linked tasks,
- linked approvals.

Quick buttons:

- daily ops summary,
- records transfer queue,
- invoice scan,
- follow-up candidates,
- pricing review.

Fetch shape:

```ts
async function runInternalAgent(message: string, scenario: string) {
  const response = await fetch("/api/agent/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId: "central-vet",
      agentType: "internal",
      scenario,
      message,
      context: {}
    })
  });
  return response.json();
}
```

If backend is not ready, use fixture response with the same shape.

### Person 4 Approval Queue

Show approvals for:

- records transfer,
- invoice issue,
- pricing recommendation,
- ambiguous client communication,
- live write later.

Approval card fields:

- type,
- title,
- summary,
- proposed action,
- linked task,
- approve button,
- reject button,
- status.

Do not actually send records in UI during the current sprint. Approval changes status only unless backend implements safe mock action.

### Person 4 Workflow Timeline

Timeline events:

- agent started,
- tool called,
- task created,
- approval requested,
- approval decided,
- agent completed,
- agent blocked.

This makes the AI feel auditable, not magical.

### Person 4 Design Rules

- No landing page.
- Client pages: mobile-first, simple, direct.
- Internal app: dense, operational, task-board-first.
- No medical advice in UI copy.
- Every risky flow says "staff review required".
- Every agent result has a visible status.
- Every backend failure has a useful fallback message.
- Do not hide the current task board behind a new dashboard.

### Person 4 Done For Current Sprint

- public booking flow clickable.
- public arrival/check-in flow clickable.
- public pickup flow clickable.
- records transfer flow clickable.
- follow-up/outtake flow clickable.
- internal agent panel usable.
- approval queue usable.
- daily ops digest visible.
- pricing review visible.
- workflow timeline visible.
- mobile screenshots for public pages.
- desktop screenshot for internal app.

### Person 4 Full Frontend Work Packages

P4-A: client app navigation

- Keep existing `/` request form.
- Add links or simple navigation to:
  - booking,
  - arrival,
  - pickup,
  - records,
  - follow-up,
  - call/intake.
- Make mobile navigation obvious.
- Do not make a marketing landing page.

P4-B: shared agent flow shell

- `AgentFlowShell` should support:
  - clinic brand,
  - flow title,
  - progress state,
  - agent status,
  - error state,
  - linked task/approval state,
  - restart action.
- Use same shell for booking, arrival, pickup, records, follow-up, call.

P4-C: booking UX

- build multi-step form,
- show mock available slots,
- allow slot selection,
- show confirmation,
- show staff-review state if ambiguous,
- create task link if returned by backend.

P4-D: arrival/check-in UX

- build fast "I'm here" flow,
- support text entry and voice entry,
- show appointment match,
- show wait estimate,
- show "room ready" / "still waiting" state,
- show fallback: call hospital if urgent.

P4-E: pickup/outtake UX

- lookup pet status,
- show ready/not ready,
- allow medication/food pickup request,
- allow "I am outside" pickup flow,
- create task if status unknown.

P4-F: records-transfer UX

- destination hospital,
- destination email/fax,
- authorization checkbox,
- summary screen,
- approval-required state,
- no "sent" claim unless backend says mock sent/approved.

P4-G: follow-up/revenue UX

- reminder landing page,
- vaccine due response,
- recheck response,
- refill response,
- one-click booking path,
- "not interested" / "need help" path,
- expected staff task visibility.

P4-H: call/transcript UX

- text area for pasted call transcript,
- voice input for spoken request,
- classify intent display,
- suggested next action,
- create task button,
- route to booking/arrival/records/pickup where appropriate.

P4-I: internal agent panel

- command input,
- quick action buttons,
- result card,
- task links,
- approval links,
- timeline link,
- disabled/loading/error states.

P4-J: approval queue UI

- list pending approvals,
- filter by type,
- show proposed payload in readable form,
- approve/reject,
- show decided state,
- prevent accidental destructive language.

P4-K: daily ops digest UI

- show task counts,
- urgent sick-pet items,
- stale records requests,
- overdue follow-ups,
- invoice flags,
- pricing review status,
- suggested next actions.

P4-L: pricing review UI

- show clinic service price,
- competitor observed price,
- source,
- difference,
- recommendation,
- approval task state.
- no edit-price action in current MVP.

P4-M: workflow timeline UI

- group events by run,
- show tool names,
- show created task IDs,
- show approval IDs,
- show failure state,
- make it easy to debug demo.

P4-N: responsive QA

- test public pages at mobile widths.
- test internal app at desktop width.
- verify text does not overflow buttons/cards.
- verify current task board still fits.
- capture screenshots for demo docs.

P4-O: demo script

- Write `docs/demo-script.md`.
- Include exact click path.
- Include expected output for every flow.
- Include fallback if backend route is still stubbed.
- Include screenshots if available.

## Product Workflows To Build

### Workflow 1 - Arrival / Check-In

Why: there is no check-in today.

Flow:

1. Client opens `/arrival`.
2. Client enters name/phone/pet or speaks request.
3. Agent finds mock appointment.
4. Agent marks arrived.
5. Agent shows wait estimate.
6. Task/event appears internally.
7. Staff can update room-ready or pet-ready state.

Backend tools:

- `lookup_client`
- `lookup_pet`
- `get_today_appointments`
- `mark_arrived`
- `get_wait_status`
- `create_task`

Frontend:

- `/arrival`
- status panel
- queue estimate
- staff-visible task state

### Workflow 2 - Follow-Up / Outtake Revenue

Why: this is where growth is. Even low response rates can pay.

Flow:

1. Mock follow-up campaign identifies pets due for vaccine/recheck/refill.
2. External agent sends or simulates reminder.
3. Client lands on `/followup`.
4. Client books/responds.
5. Task or appointment created.

Backend tools:

- `find_followup_candidates`
- `trigger_followup`
- `book_appointment`
- `create_followup_task`

Frontend:

- `/followup`
- internal `FollowupPanel`

### Workflow 3 - Booking / Phone Backlog Relief

Why: phone lines create backlog and wait times.

Flow:

1. Client asks for appointment.
2. Agent asks minimum clarifying questions.
3. Agent offers mock slots.
4. Client confirms.
5. Appointment is created in mock DB.
6. Task board receives task/event for staff review if needed.

Backend tools:

- `list_slots`
- `book_appointment`
- `create_task`

Frontend:

- `/booking`

### Workflow 4 - Call / Voice Intake

Why: calls are a major source of backlog, but live phone integration can wait. The product should still prove call-to-task and call-to-booking behavior with mock transcripts and browser voice.

Flow:

1. Staff or client opens `/call`.
2. User speaks or pastes call transcript.
3. Agent classifies intent.
4. Agent extracts client/pet/contact.
5. Agent routes to arrival, booking, records, pickup, billing, sick-pet, or unknown.
6. Agent creates task/approval/appointment as appropriate.
7. Internal timeline shows the call-to-action chain.

Backend tools:

- `classify_call_intent`
- `summarize_call_transcript`
- `lookup_client`
- `lookup_pet`
- `create_task`
- `book_appointment`
- `request_records_transfer`
- `flag_invoice_issue`

Frontend:

- `/call`
- `VoiceTextInput`
- call classification result
- linked task/approval result

Safety:

- sick-pet call creates task, no diagnosis.
- unclear call creates staff-review task.
- records/billing calls create approvals.

### Workflow 5 - Task Manager Execution Fabric

Why: current task manager exists but is underused.

Plan:

- Do not rebuild task board.
- Add agent-created tasks.
- Add workflow/approval links to task cards later if time.
- Keep `tasks` and `task_events` as the visible work queue.

Backend:

- use `createTask` from `packages/db/src/tasks.ts`.
- use existing statuses.
- add workflow metadata in `task_events.metadata`.

### Workflow 6 - Internal Agent

Why: records transfers, sick emails, invoices, competitor research.

Subflows:

- sick-pet email -> urgent task, no diagnosis.
- records transfer -> approval request.
- invoice scan -> flagged issue task.
- daily ops -> ranked list of blockers.
- competitor pricing -> report and task.

Backend tools:

- `summarize_inbox_item`
- `request_records_transfer`
- `prepare_records_packet`
- `get_invoice_summary`
- `flag_invoice_issue`
- `run_competitor_scan`
- `create_price_review_report`
- `get_daily_ops_summary`

Frontend:

- `InternalAgentPanel`
- `ApprovalQueue`
- `DailyOpsDigest`
- `PricingReviewPanel`

### Workflow 7 - Future Avimark Replacement Path

Not in the current MVP.

The current MVP should still prepare for it:

- local normalized data,
- capability-based provider interface,
- mock/mirror/live modes,
- no agent tied directly to Avimark.

Provider interface:

```ts
export type ProviderCapability =
  | "schedule.read"
  | "schedule.write"
  | "client.read"
  | "client.write"
  | "pet.read"
  | "pet.write"
  | "records.transfer"
  | "invoice.read"
  | "invoice.flag"
  | "message.send"
  | "campaign.send"
  | "pricing.scan";
```

## Work Split By Product Step

This section is the real execution checklist. Each step should move in parallel.

### Step 1 - Arrival / Check-In

Person 1:

- Add `vet_appointments.checked_in_at`.
- Add mock appointment seed data.
- Add `/api/mock/clinic` appointment payload.
- Add `/api/agent/external` stub for `scenario=arrival`.
- Add workflow event persistence for arrival.
- Add Render envs and deploy proof for arrival page.

Person 2:

- Provide 10 realistic arrival/check-in phrases.
- Provide 5 messy call transcript examples where client is already outside.
- Test Person 4 arrival UI language for clarity.

Person 3:

- Implement `lookup_client`, `lookup_pet`, `get_today_appointments`, `mark_arrived`, `get_wait_status`.
- Implement `runArrivalScenario`.
- Add E2B scenario `arrival_happy_path`.
- Add E2B scenario `arrival_no_appointment`.
- Ensure arrival updates workflow events and optional task.

Person 4:

- Build `/arrival`.
- Add voice/text input.
- Show appointment match.
- Show wait estimate.
- Show fallback if no appointment found.
- Show clear "staff notified" state.

### Step 2 - Follow-Up / Outtake

Person 1:

- Add `followup_candidates`.
- Seed vaccine/recheck/refill candidates.
- Add DB helper to list/convert/dismiss candidates.
- Add `/api/agent/followup` stub.
- Add deployment env notes for notification mode.

Person 2:

- Provide sample reminder copy.
- Provide sample Demandforce-style follow-up scenarios.
- Provide rough service/value estimates for mock candidates.

Person 3:

- Implement `find_followup_candidates`.
- Implement `create_followup_task`.
- Implement `runFollowupScenario`.
- Ensure follow-up can create booking or task.
- Add scenario `followup_vaccine_due`.

Person 4:

- Build `/followup`.
- Build `FollowupPanel`.
- Show candidate list.
- Show expected value and recommended action.
- Add one-click book/request/help paths.

### Step 3 - Booking / Phone Deflection

Person 1:

- Ensure `vet_appointments` supports mock bookings.
- Add available slot fixture/seed.
- Add route stub for booking scenario.
- Ensure task board can show booking-related task.

Person 2:

- Provide 10 realistic booking request examples.
- Provide common constraints: after school, after work, first available, specific doctor.

Person 3:

- Implement `list_slots`.
- Implement `book_appointment`.
- Implement `runBookingScenario`.
- Add scenarios for happy path and ambiguous request.
- Create task if request needs staff review.

Person 4:

- Build `/booking`.
- Show slot cards.
- Allow confirm.
- Show "needs staff review" state for ambiguity.
- Link to internal task when returned.

### Step 4 - Call / Voice Intake

Person 1:

- Add `mock_call_transcripts`.
- Add call seed data.
- Add call route stub.
- Add DB helper to list/mark processed.
- Add future env names for phone provider only if needed, no live integration.

Person 2:

- Provide mock call transcripts.
- Provide sponsor/vendor notes for future phone/call stack.
- Test transcript examples against Person 4 UI.

Person 3:

- Implement `classify_call_intent`.
- Implement `summarize_call_transcript`.
- Implement `runCallScenario`.
- Route call output to booking/arrival/records/sick-pet/pickup/billing.
- Add scenario `call_to_task`.

Person 4:

- Build `/call`.
- Add `VoiceTextInput`.
- Add transcript paste box.
- Show classified intent.
- Show created task/approval.

### Step 5 - Task Execution Fabric

Person 1:

- Keep current `tasks` stable.
- Add workflow metadata support.
- Add helper to link workflow run to task through event metadata.
- Ensure migration does not break existing task queries.

Person 2:

- Test task wording and real-world examples.
- Flag confusing workflow labels.

Person 3:

- Tool `create_task` uses `createTask`.
- Tool `update_task` respects existing permissions.
- Agent-created tasks include source metadata.
- No direct SQL task writes from agents.

Person 4:

- Keep `TaskBoard` central.
- Add linked workflow/approval indicators without disrupting lanes.
- Add internal agent panel adjacent to task board.

### Step 6 - Internal Agent

Person 1:

- Add mock messages and invoice tables.
- Add DB helpers.
- Add route stubs for internal scenarios.
- Ensure internal routes use current auth.

Person 2:

- Provide sick-pet email examples.
- Provide records-transfer examples.
- Provide invoice/admin examples.
- Provide competitor service examples.

Person 3:

- Implement daily ops.
- Implement message triage.
- Implement records-transfer approval.
- Implement invoice scan.
- Implement pricing review.
- Implement safety guardrails.

Person 4:

- Build `InternalAgentPanel`.
- Build `DailyOpsDigest`.
- Build `ApprovalQueue`.
- Build `PricingReviewPanel`.
- Build workflow timeline.

### Step 7 - Competitor Pricing / Market Research

Person 1:

- Add `competitor_price_snapshots`.
- Add DB helper to insert/list snapshots.
- Ensure Supabase and Render have `APIFY_TOKEN` by name.

Person 2:

- Find useful Apify actors.
- Run sample competitor scrape.
- Save sample JSON.
- Provide actor IDs and limitations.

Person 3:

- Implement Apify wrapper.
- Normalize actor output.
- Compare against service catalog.
- Create report and task.
- Never update prices.

Person 4:

- Build pricing review panel.
- Show source URL and observed text.
- Show difference and recommendation.
- Show approval/task state.

### Step 8 - Evals / Proof / Demo

Person 1:

- Make sure deploy exists.
- Make sure Opsera/build proof exists.
- Make sure DB is seeded.
- Make sure smoke checklist is complete.

Person 2:

- Validate sample scenarios are realistic.
- Help run through demo with Person 4.

Person 3:

- Run local scenarios.
- Run one or more E2B scenarios.
- Capture scenario proof.
- Fix agent failures.

Person 4:

- Run full click-through.
- Capture screenshots.
- Update demo script.
- Verify mobile and desktop.

## Parallel Timeline

Hour 0-4:

- Person 1: Supabase, Render shells, route stubs, migration scaffolds.
- Person 2: Apify/E2B/Opsera tokens and sample scrape.
- Person 3: contracts, mock provider, tool registry, scenario fixtures.
- Person 4: page/component skeletons against fixtures.

Day 1:

- Person 1: migrations run on Supabase, docs start, Render build fix.
- Person 3: external agent booking/arrival mock logic.
- Person 4: booking and arrival UI clickable.

Day 2:

- Person 1: Opsera pipeline, deploy smoke tests, DB helper scaffolding.
- Person 3: records/sick-pet/internal daily ops logic.
- Person 4: internal agent panel and approval queue.

Day 3:

- Person 1: seed data and route stability.
- Person 3: E2B scenarios.
- Person 4: pickup, records, follow-up pages.

Day 4:

- Person 1: Render hardening and docs.
- Person 3: Apify pricing scan to report/task.
- Person 4: workflow timeline and pricing/follow-up panels.

Day 5:

- Person 1: final deploy proof.
- Person 3: final scenario proof.
- Person 4: final demo script and screenshots.

## Acceptance Criteria

Technical:

- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run db:migrate` works on Supabase.
- Render internal app deploys.
- Render client app deploys.
- Opsera runs at least install/typecheck/build, or blocker is documented.
- E2B runs at least one scenario.

Product:

- current passcodes still work.
- current task board still works.
- current public request form still works.
- arrival/check-in flow works on mock data.
- booking flow works on mock data.
- pickup/status flow works on mock data.
- records transfer creates approval.
- sick-pet message creates urgent task with no diagnosis.
- follow-up flow creates appointment/task.
- pricing scan creates review report/task.

Safety:

- no diagnosis.
- no silent records release.
- no silent billing/pricing changes.
- no live vendor writes.
- every risky action creates approval request.

## Research / Docs

Official docs to use while implementing:

- OpenAI Agents SDK agents/tools/guardrails/tracing: https://openai.github.io/openai-agents-js/
- E2B JavaScript/TypeScript SDK and sandboxes: https://www.e2b.dev/docs
- Apify Actors and structured runs: https://docs.apify.com/platform/actors
- Render monorepo services/root/build/start commands: https://render.com/docs/monorepo-support
- Supabase migrations and remote deploy flow: https://supabase.com/docs/guides/deployment/database-migrations
- Opsera pipelines/build/deploy orchestration: https://docs.opsera.io/
