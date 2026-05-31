# VetAgent 4-Person Hackathon Execution Plan

Date: 2026-05-31

Source brief: `VetAgent.md`

This is an execution plan, not a pitch deck. It is organized so four people can work in parallel without stepping on each other.

## The Actual Priorities

Priority 1: check-in / arrival.

- The clinic has no real check-in flow.
- This is the strongest product wedge.
- Build this first, make it demoable, make it feel real.

Priority 2: agents.

- External agent handles clients.
- Internal agent handles staff operations.
- Agents are the core product, not a side feature.
- The task board is the execution fabric underneath agents.

Everything else supports those two priorities:

- booking to reduce phone backlog,
- follow-ups/outtake to recover revenue,
- call/message intake to turn chaos into structured work,
- records/invoices/pricing to reduce grunt work,
- Supabase/Render/E2B/Opsera/Apify to make it real.

## Locked Decisions

- Use the current repo.
- Use TypeScript.
- Use the existing Next.js apps.
- Use the existing task manager.
- Use Supabase Postgres.
- Use Render.
- Use Opsera.
- Use E2B.
- Use Apify.
- Use OpenAI Agents SDK.
- Use mock data for the sprint.
- Keep current passcode auth.
- Do not add Supabase Auth right now.
- Do not change passcode env names:
  - `VET_ADMIN_PASSCODE`
  - `VET_APP_ADMIN_PASSCODE`
  - `VET_VETERINARIAN_PASSCODE`
- Do not block on Avimark, IDEXX, Demandforce, Antech, phone, or live PMS access.
- Do not make medical recommendations.
- Do not silently send records.
- Do not silently change invoices or prices.
- Do not build a marketing landing page.

## Current Repo Anchors

Use these instead of inventing a new app:

- `apps/internal`: staff/internal app.
- `apps/client-request`: public/client app.
- `packages/db`: database boundary.
- `packages/notifications`: existing notification helpers.
- `db/migrations`: schema.
- `apps/internal/app/components/TaskBoard.tsx`: current task board.
- `apps/client-request/app/components/RequestForm.tsx`: current public request form.
- `apps/internal/app/api/tasks/route.ts`: task list/create.
- `apps/internal/app/api/tasks/[id]/route.ts`: task update.
- `apps/internal/app/api/auth/route.ts`: current passcode auth.
- `apps/internal/app/api/_shared.ts`: current auth helpers.
- `packages/db/src/tasks.ts`: task CRUD/events.
- `packages/db/src/types.ts`: shared task types.
- `packages/db/src/connection.ts`: Supabase `DATABASE_URL` support.

## Five Product Steps

### Step 1 - Check-In / Arrival

Build this first.

What it does:

- client opens arrival/check-in page,
- enters or speaks name/phone/pet,
- agent finds mock appointment,
- agent marks arrived,
- agent gives wait-time/status message,
- internal staff can see the status/task.

Must demo:

- "I'm outside for my appointment."
- "I have been waiting."
- "Can you check me in?"
- "How long is the wait?"

### Step 2 - Agents

Build the agent layer immediately after or alongside check-in.

External agent:

- check-in,
- booking,
- pickup/status,
- follow-up response,
- records request intake,
- sick-pet escalation,
- call/message intake.

Internal agent:

- daily ops summary,
- message/call triage,
- records-transfer workflow,
- invoice/admin review,
- follow-up opportunity scan,
- competitor pricing review,
- task prioritization.

### Step 3 - Booking / Phone Backlog

Use agents to reduce repetitive calls.

Must support:

- "Can I book vaccines next week?"
- "Do you have anything after 3?"
- "Can I reschedule?"
- "Can I get the first available?"

Mock only:

- fake slots,
- fake doctors,
- fake appointment types,
- fake appointment creation.

### Step 4 - Follow-Up / Outtake Revenue

This is growth.

Must support:

- vaccine due,
- recheck due,
- refill due,
- pet ready,
- pickup,
- book next appointment,
- one-click response from client.

The demo should show:

- internal agent finds follow-up candidates,
- external agent turns one response into appointment/task,
- staff sees the result.

### Step 5 - Internal Work Automation

This is the internal agent value.

Must support:

- sick-pet email/message -> urgent task, no diagnosis,
- records transfer -> approval request,
- invoice issue -> review task,
- competitor pricing -> report task,
- daily ops -> ranked work list.

## Person 1 - Platform + Backend + Agent Foundation

Person 1 owns:

- Supabase.
- Render.
- Opsera.
- env vars.
- deploys.
- migrations.
- seed/mock data path.
- DB helpers.
- API route stubs.
- agent run persistence.
- approval persistence.
- basic agent endpoint wiring.
- check-in agent foundation.
- external/internal agent route wiring.
- mock agent responses that can be replaced or extended by Person 3's current work.
- agent workflow storage and timeline.
- agent API contracts for Person 3 and Person 4.
- smoke tests.
- docs for deployment and handoff.

Person 1 does not own:

- final frontend polish,
- final prompts,
- Apify actor research,
- final demo copy.

### Person 1 Workstream A - Platform

Do:

- create/confirm Supabase project,
- set `DATABASE_URL`,
- run existing migrations,
- make root build pass,
- create Render internal service,
- create Render client service,
- add Render env vars,
- connect Opsera to GitHub,
- add Opsera install/typecheck/build/deploy path,
- document deploy/run steps.

Files:

- `.env.example`
- `render.yaml`
- `docs/render-supabase-opsera.md`
- `packages/db/scripts/migrate.mjs`
- `packages/db/src/connection.ts`
- root `package.json`
- app package files if start scripts are missing

Done when:

- internal app deploys,
- client app deploys,
- Supabase connection works,
- Opsera runs at least install/typecheck/build or blocker is documented,
- no secret values are committed.

### Person 1 Workstream B - Data Foundation

Do:

- add minimal mock clinic tables,
- seed realistic mock data,
- keep existing `tasks` untouched,
- add agent workflow tables,
- add approval tables,
- add call/message/follow-up mock data.

Data needed:

- clients,
- pets,
- appointments,
- slots,
- wait statuses,
- service catalog,
- follow-up candidates,
- mock inbound messages,
- mock call transcripts,
- mock invoices,
- competitor price observations.

Files:

- `db/migrations/016_agent_workflows.sql`
- `db/migrations/017_vetagent_mock_entities.sql`
- `db/migrations/018_seed_vetagent_mock_data.sql`
- `db/migrations/019_mock_communications.sql`
- `packages/db/src/agents.ts`
- `packages/db/src/mockClinic.ts`
- `packages/db/src/index.ts`

Done when:

- routes can read mock clinic data,
- agent runs can be stored,
- approvals can be created/decided,
- the existing task board still works.

### Person 1 Workstream C - Agent API Foundation

Person 1 should create stable endpoints quickly and can implement the first mock agent behavior. Person 3 may already have agent pieces in progress; keep route contracts stable so that work can plug in cleanly.

Create:

- `apps/internal/app/api/agent/external/route.ts`
- `apps/internal/app/api/agent/internal/route.ts`
- `apps/internal/app/api/agent/followup/route.ts`
- `apps/internal/app/api/agent/call/route.ts`
- `apps/internal/app/api/agent/runs/[id]/route.ts`
- `apps/internal/app/api/approvals/route.ts`
- `apps/internal/app/api/approvals/[id]/route.ts`
- `apps/internal/app/api/mock/clinic/route.ts`

Rules:

- return stable JSON shapes,
- use current auth for internal routes,
- do not expose secrets,
- do not add Supabase Auth,
- stubs are fine at first,
- routes should unblock Person 4 immediately.

Done when:

- Person 4 can call mock/agent routes,
- Person 3 can connect current or new agent internals with package logic,
- route shapes are documented in `docs/agent-api-contracts.md`.

### Person 1 Workstream D - Check-In Foundation

Do:

- add mock appointment data,
- add arrival/check-in route support,
- add wait status fields in mock data,
- make `/api/mock/clinic` return appointments and wait statuses,
- add workflow event for check-in,
- add task creation path if arrival needs staff attention.

Done when:

- Person 4 can build `/arrival` from mock data,
- Person 3 can plug current or new arrival-agent work into the endpoint,
- internal task board can show an arrival-related task.

### Person 1 Workstream E - Phone/Call Foundation

Do:

- add mock call transcripts,
- add `/api/agent/call` stub,
- add call-to-task response shape,
- document later phone-provider options,
- do not block on live Twilio/phone integration.

Call intents:

- arrival,
- booking,
- records transfer,
- pickup status,
- sick pet,
- billing,
- follow-up,
- unknown.

Done when:

- Person 3 can classify transcript examples,
- Person 4 can build a call/transcript intake page,
- a mock call can become a task/approval.

### Person 1 Workstream F - Verification

Run:

- `npm run typecheck`
- `npm run build`
- `npm run db:migrate`

Manual smoke:

- public request still creates task,
- internal task board still reads task,
- current passcodes still work,
- approval route returns mock/pending approvals,
- mock clinic route returns useful data,
- Render deploy still boots.

## Person 2 - Tools + Accounts + Research Support

Person 2 owns tool readiness and realistic product inputs. This keeps agent scenarios, frontend copy, and demo content grounded in actual clinic work.

Person 2 owns:

- Apify account/token status,
- E2B account/token status,
- Opsera access support,
- sponsor/vendor notes,
- Apify actor selection,
- competitor research samples,
- mock call/email/follow-up examples,
- product-content QA with Person 4.

### Person 2 Workstream A - Accounts

Do:

- confirm Apify token,
- confirm E2B token,
- confirm Opsera access,
- document token secret names only,
- document blockers immediately.

Files:

- `docs/tool-readiness.md`

### Person 2 Workstream B - Apify / Competitor Research

Do:

- find useful Apify actors,
- run one sample competitor scrape,
- save sample JSON,
- list actor IDs,
- summarize limitations/costs.

Files:

- `docs/samples/apify-competitor-sample.json`
- `docs/samples/mock-pricing-research.md`

### Person 2 Workstream C - Product Examples For Agents/UI

Do:

- write realistic check-in phrases,
- write call transcript examples,
- write sick-pet email examples,
- write records-transfer examples,
- write booking examples,
- write follow-up examples,
- write invoice/admin examples.

Files:

- `docs/samples/mock-call-transcripts.md`
- `docs/samples/mock-inbound-messages.md`
- `docs/samples/mock-followup-campaigns.md`

Done when:

- Person 3 has scenario inputs,
- Person 4 has realistic copy/content,
- demo examples feel like a real clinic.

## Person 3 - Agents + Tools + Behavior

Person 3 owns agent behavior depth. Person 1 co-owns the agent foundation and route wiring. If Person 3 already has pieces started, preserve that work and connect it through the shared contracts.

Person 3 owns:

- OpenAI Agents SDK integration,
- `packages/agents`,
- `packages/mock-data`,
- external agent,
- internal agent,
- check-in/arrival agent behavior,
- tool registry,
- guardrails,
- E2B scenario runner,
- Apify pricing wrapper,
- scenario tests/evals.

### Person 3 Workstream A - Agent Package

Create:

- `packages/agents/package.json`
- `packages/agents/src/contracts.ts`
- `packages/agents/src/tools.ts`
- `packages/agents/src/guardrails.ts`
- `packages/agents/src/mockProvider.ts`
- `packages/agents/src/externalAgent.ts`
- `packages/agents/src/internalAgent.ts`
- `packages/agents/src/followupAgent.ts`
- `packages/agents/src/callAgent.ts`
- `packages/agents/src/pricingAgent.ts`
- `packages/agents/src/recordsAgent.ts`
- `packages/agents/src/scenarioRunner.ts`
- `packages/agents/src/e2bRunner.ts`

Done when:

- route handlers can call agent package functions,
- mocked agent responses are deterministic without external APIs,
- OpenAI-backed path can be enabled by env.

### Person 3 Workstream B - Tool Registry

Tools needed:

- `lookup_client`
- `lookup_pet`
- `list_slots`
- `book_appointment`
- `start_arrival`
- `get_wait_status`
- `mark_arrived`
- `mark_pet_ready`
- `send_status_update`
- `create_task`
- `update_task`
- `triage_message`
- `triage_call`
- `request_records_transfer`
- `prepare_records_packet`
- `get_invoice_summary`
- `flag_invoice_issue`
- `find_followup_candidates`
- `create_followup_task`
- `run_competitor_scan`
- `compare_service_prices`
- `create_price_review_report`

Rules:

- all tools are typed,
- all tools return structured data,
- tools log events,
- risky tools create approvals,
- no raw SQL from model output.

### Person 3 Workstream C - External Agent

Must handle:

- check-in/arrival,
- booking,
- pickup/status,
- follow-up response,
- records request intake,
- sick-pet escalation,
- call transcript intake.

Key behavior:

- ask only necessary questions,
- use mock provider/tools,
- create tasks when staff review is needed,
- no diagnosis,
- clear client-facing language.

### Person 3 Workstream D - Internal Agent

Must handle:

- daily ops summary,
- task prioritization,
- sick-pet message triage,
- records-transfer workflow,
- invoice/admin scan,
- follow-up candidate scan,
- pricing review.

Key behavior:

- rank urgent work,
- explain why items matter,
- create tasks/approvals,
- no silent records/pricing/billing changes.

### Person 3 Workstream E - Check-In Agent

This is the most important agent path.

Must support:

- "I'm here."
- "I have an appointment."
- "I have been waiting."
- "Can you check me in?"
- "Is my pet ready?"

Outputs:

- status message,
- wait estimate,
- task if staff review needed,
- workflow timeline event.

### Person 3 Workstream F - E2B + Scenarios

Use E2B for scenario/eval runs.

Scenarios:

- arrival happy path,
- arrival no appointment,
- booking happy path,
- booking ambiguous,
- sick-pet emergency,
- sick-pet non-emergency,
- records transfer,
- pickup status,
- follow-up vaccine due,
- invoice issue,
- pricing review,
- call transcript to task.

Done when:

- at least one E2B scenario runs,
- local fallback exists if token missing,
- results are clear enough for demo proof.

### Person 3 Workstream G - Apify Pricing Agent

Do:

- use Apify sample or live actor,
- normalize competitor pricing,
- compare against service catalog,
- create pricing report,
- create task,
- never update prices automatically.

## Person 4 - Frontend + Product Experience

Person 4 owns the actual experience people see. Person 4 should not wait for Person 1 or Person 3; build with fixtures first, then swap to routes.

Login here means the current passcode gate and role-entry experience. Do not rewrite auth.

Person 4 owns:

- staff login / role-entry UI,
- public client flows,
- internal agent surfaces,
- approval queue UI,
- workflow timeline UI,
- daily ops UI,
- pricing/follow-up panels,
- demo script,
- screenshot proof.

### Person 4 Workstream A - Login / Role Entry UI

Own the staff entry experience in `apps/internal`.

Build or polish:

- current passcode screen,
- role-entry labels,
- error state for wrong passcode,
- loading state while auth request runs,
- return-to-dashboard behavior after success,
- mobile and desktop layout.

Keep:

- current passcode auth,
- current passcode env names,
- existing `/api/auth` route contract,
- existing session/local storage behavior if present,
- no Supabase Auth,
- no new password system.

Must support:

- admin entry,
- veterinarian entry,
- staff/assistant entry if already supported,
- direct path into the internal workspace/task board.

Done when:

- current passcodes still work,
- wrong passcode is clear,
- successful login lands in the staff app,
- internal task board and internal agent panels are reachable after login,
- no passcode values or passcode names are changed.

### Person 4 Workstream B - Public Flow Shell

Create:

- `apps/client-request/app/components/AgentFlowShell.tsx`
- `apps/client-request/app/components/VoiceTextInput.tsx`

Use for:

- booking,
- arrival,
- pickup,
- records,
- follow-up,
- call/transcript.

### Person 4 Workstream C - Check-In / Arrival UI

Build:

- `apps/client-request/app/arrival/page.tsx`

Must show:

- name/phone/pet input,
- voice/text request,
- appointment match,
- arrival confirmation,
- wait estimate,
- "staff notified" state,
- fallback if no appointment.

This is the top-priority screen.

### Person 4 Workstream D - Agent-Driven Public Pages

Build:

- `apps/client-request/app/booking/page.tsx`
- `apps/client-request/app/pickup/page.tsx`
- `apps/client-request/app/records/page.tsx`
- `apps/client-request/app/followup/page.tsx`
- `apps/client-request/app/call/page.tsx`

Rules:

- no marketing page,
- mobile-first,
- use fixtures if APIs are not ready,
- show agent status,
- show staff-review/approval states clearly.

### Person 4 Workstream E - Internal Agent UI

Create:

- `apps/internal/app/components/InternalAgentPanel.tsx`
- `apps/internal/app/components/ApprovalQueue.tsx`
- `apps/internal/app/components/WorkflowRunTimeline.tsx`
- `apps/internal/app/components/DailyOpsDigest.tsx`
- `apps/internal/app/components/PricingReviewPanel.tsx`
- `apps/internal/app/components/FollowupPanel.tsx`

Integrate without hiding the existing task board.

Quick buttons:

- daily ops,
- check-in status,
- records queue,
- invoice scan,
- follow-up opportunities,
- pricing review,
- call/message triage.

### Person 4 Workstream F - Demo Script

Write:

- `docs/demo-script.md`

Demo path:

1. client arrives/checks in,
2. wait-time/status appears,
3. internal task/status updates,
4. external agent handles booking,
5. sick-pet message creates urgent task,
6. records request creates approval,
7. follow-up candidate turns into appointment/task,
8. internal agent summarizes ops,
9. pricing review creates task.

Done when:

- flow can be clicked end to end,
- route stubs are enough if real agents are not ready,
- screenshots exist for mobile public flow and desktop internal flow.

## How Everyone Works In Parallel

Immediate parallel start:

- Person 1: Supabase/Render/Opsera, route stubs, mock data route.
- Person 2: tool accounts, sample content, Apify/E2B/Opsera status.
- Person 3: contracts, tool registry, check-in agent skeleton.
- Person 4: login/role-entry UI, arrival screen, flow shell, internal panel skeleton.

Track A - check-in and agent foundation:

- Person 1: DB helpers, mock data, route stubs, check-in agent endpoint.
- Person 2: realistic arrival phrases, transcripts, and client examples.
- Person 3: external agent arrival behavior and tool calls.
- Person 4: login works, arrival flow clickable with fixtures and then route stubs.

Track B - internal agents and task execution:

- Person 1: approvals/workflow persistence, Opsera pipeline.
- Person 2: competitor sample and UI/content QA.
- Person 3: internal agent, records, sick-pet triage.
- Person 4: approval queue, internal agent panel.

Track C - revenue and backlog relief:

- Person 1: deploy stabilization, smoke tests.
- Person 2: support demo content and sample cleanup.
- Person 3: E2B scenarios, follow-up agent, pricing agent.
- Person 4: follow-up, pickup, call/transcript pages.

Track D - proof and final polish:

- Person 1: final deploy proof and reliability.
- Person 3: scenario fixes and agent behavior polish.
- Person 4: login polish, demo polish, screenshots, final click-through.
- Person 2: final account/tool/readiness notes.

## Final Acceptance

Must have:

- check-in/arrival flow works,
- external agent works on mock data,
- internal agent works on mock data,
- existing task board still works,
- staff login works with current passcodes,
- existing passcodes still work,
- public request form still works,
- Render deploy works,
- Supabase works,
- Opsera path exists,
- E2B scenario proof exists,
- Apify pricing path has sample or live output,
- records transfer creates approval,
- sick-pet message creates urgent task and no diagnosis,
- follow-up flow creates appointment/task,
- pricing review creates report/task and no automatic repricing.

Nice but not required:

- live phone integration,
- real Avimark integration,
- real Demandforce integration,
- real IDEXX integration,
- full PMS replacement.
