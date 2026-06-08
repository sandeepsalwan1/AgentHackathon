# Agent Backend Completion Plan

Date: 2026-05-31

Archive status: old implementation plan. Current docs live in `../README.md`; keep this file for historical context only.

Scope: complete all agent/backend work. UI polish out of scope.

Use this as the implementation handoff. It assumes current repo state, not a fresh rebuild.

## Start Here For Next Agent

Your job is to complete the agent/backend system, not replan the product.

Do exactly this:

1. Read this file fully.
2. Run the Phase 0 baseline commands.
3. Implement the phases in order.
4. Keep `apps/internal` as the only deploy target.
5. Do not touch UI unless a compile error forces a tiny fix.
6. Replace route-local agent logic with one runner calling `packages/agents`.
7. Make external and internal agents real dynamic tool-calling loops.
8. Add Google ADK as the live runtime behind the same contracts.
9. Keep fallback behavior only for missing credentials or external-tool failure.
10. Make every run observable.
11. Write proof in `docs/proof/mainCompleteAllAgents-proof.md`.
12. Do not call the work complete until proof commands and route assertions pass.

First implementation target:

- create observability migration and DB helpers.
- create `_runner.ts`.
- convert `/api/agent/checkin` first.
- prove one check-in route returns `runId`, `traceId`, persisted run, workflow events, tool calls, and task.
- then convert the rest of the routes.

Do not start with:

- UI polish.
- marketing copy.
- master-worker agent architecture.
- new auth.
- a second app.
- live-only integrations.
- route-local if/else "agent" logic.
- deterministic pattern matching presented as an agent.
- hardcoded responses that only look like agent output.
- "mock mode passed" as final proof of real-agent completion.

If there is a conflict between older docs and this file, follow this file.

## Locked Decisions

Product decisions:

- This sprint is backend/agents/observability.
- UI is out of scope.
- Another person can build UI against these routes while this work happens.
- Keep API response shapes stable so UI work does not churn.
- One deployed app: `apps/internal`.
- `apps/client-request` is legacy/reference only.
- Existing public and staff routes must keep working.
- Existing task manager remains the execution substrate.
- The demo must work without live PMS, phone, lab, Apify, E2B, or Google credentials.

Agent decisions:

- There are exactly two agents:
  - external client-facing agent.
  - internal staff-facing agent.
- Both agents are dynamic tool-calling loops.
- Do not use a master-worker pattern for this sprint.
- Do not add a separate LLM router agent.
- Route selection and intent choose external vs internal.
- External agent answers clients and creates tasks/approvals/reports through tools.
- Internal agent answers staff and creates tasks/approvals/reports through tools.
- Google ADK is the target live agent SDK.
- Google ADK implementation must use real `@google/adk` `LlmAgent`, `FunctionTool`, and `InMemoryRunner`.
- `mode=google-adk` is invalid unless run detail proves ADK executed.
- Mock clinic data is allowed as seed/context data.
- A mock agent is not the target.
- Deterministic behavior is allowed only as fallback through the same tool registry.
- Fallback success proves demo resilience, not agent completion.
- No legacy non-ADK fallback is the target live runtime.

Architecture decisions:

- One backend execution path:
  - route auth/body parsing.
  - `_runner.ts`.
  - `packages/agents`.
  - DB persistence helpers.
- `packages/agents` owns agent behavior.
- `_runner.ts` owns run lifecycle, trace ids, persistence, headers, and effect mapping.
- DB helpers own SQL persistence.
- Active routes must not contain agent business logic.
- `_workflow.ts` must be deleted or reduced to a thin wrapper only.
- Agent tools live in one typed registry.
- ADK tools wrap the same registry.
- Fallback/mock mode uses the same registry or a thin adapter over it.
- Every meaningful tool call must be persisted.
- Hardcoded route responses are not agent behavior.

Safety decisions:

- No medical diagnosis or treatment advice.
- Sick-pet flows create urgent clinical tasks.
- Records transfers always require approval.
- No records are sent automatically.
- Invoice workflows create reports/tasks only.
- No invoice mutation.
- Pricing workflows create reports/tasks only.
- No price mutation.
- Low-confidence agent output creates staff review tasks instead of guessing.

Data/integration decisions:

- Supabase Postgres remains persistence.
- Keep passcode auth.
- Do not add Supabase Auth.
- Do not rename passcode env vars.
- Mock data should be minimal, realistic seed data only.
- Do not expand mock data instead of building agent/tool behavior.
- Use mock data to mimic real veterinary integration shapes, especially an Antech-style lab workflow.
- The lab workflow must feel like a future Antech integration adapter: test catalog, lab order, accession/order id, result status, abnormal flags, report metadata, and follow-up task.
- Do not call live Antech or require Antech credentials in this sprint.
- Apify pricing live mode only runs when `live:true` and env is configured.
- Apify failure must fallback to sample data with an observable event.
- Records transfer uses local approval/audit only; no external records-audit vendor integration.
- E2B is proof/eval infrastructure, not normal request-path execution.

Verification decisions:

- Proof is mandatory.
- Route success alone is not enough.
- Scenarios must assert semantics, not just HTTP 200.
- JSONL proof mode is required.
- Duplicate audit commands must pass.
- Run detail must show persisted run, events, tool calls, and linked effects.

## Coverage Map

This plan replaces the old four-person split with one implementable backend/agent handoff. It still covers the important output from each workstream.

Person 1 coverage: platform/backend/observability

- Supabase migrations.
- DB helpers.
- one unified `apps/internal` deployment path.
- all `/api/agent/*` routes.
- approval/report/run routes.
- `_runner.ts` execution and persistence.
- task/approval/report creation from agent effects.
- trace ids, run ids, tool-call persistence.
- proof scripts and route-level verification.
- Render/local docs.

Person 2 coverage: tools/accounts/sample inputs

- env names documented, values never committed.
- Google ADK credential requirement.
- Apify credential requirement.
- E2B credential requirement.
- sample pricing data fallback.
- Antech-style mock lab data shape.
- realistic call/message/follow-up/records/booking/lab inputs.
- non-expert verification command.
- fallback behavior when credentials are absent.

Person 3 coverage: real agents

- external Google ADK `LlmAgent`.
- internal Google ADK `LlmAgent`.
- shared ADK `FunctionTool` wrappers.
- dynamic tool-calling loops.
- no master-worker architecture.
- no route-local fake agent.
- guardrails for medical, records, invoice, pricing.
- scenario proof that real ADK tool calls happened.

Person 4 coverage: UI-facing backend contract, not UI implementation

- stable public routes for arrival, booking, pickup, records, follow-up, call.
- stable staff routes for internal agent, daily ops, invoice, pricing, approvals, run detail.
- response shapes include `message`, `result`, `task`, `approval`, `report`, `workflowEvents`, `toolCalls`, `runId`, `traceId`.
- no breaking route rename.
- no UI required for verification.
- UI can test against `npm run verify:agents:google` output and route contracts.
- route responses are no-store and demo-safe.

If another agent only has time to implement one path first:

- do check-in end to end.
- it must use Google ADK in `AGENT_RUNTIME=google-adk`.
- it must call tools.
- it must persist run/events/tool calls/task.
- it must be verifiable through `GET /api/agent/runs/<runId>`.

## Target Outcome

- One unified `apps/internal` app remains the deploy target.
- All existing `/api/agent/*`, `/api/approvals/*`, `/api/reports/*`, `/api/mock/clinic`, and `/api/agent/runs/[id]` contracts keep working.
- External agent complete: check-in, booking, pickup/status, follow-up, records, sick-pet, call/transcript intake.
- Internal agent complete: daily ops, task priority, sick-pet triage, records approval, invoice review, follow-up scan, pricing review.
- Real Google ADK tool-calling agents are the target implementation.
- `AGENT_RUNTIME=google-adk` runs without changing route contracts.
- Fallback mode exists for missing credentials and demo resilience, but is not accepted as final agent completion.
- Apify pricing path uses live data only when configured and requested; otherwise sample fallback.
- Records transfer uses local approval/audit only; no external records-audit vendor integration.
- Every run is observable: run row, trace id, duration, status, events, tool calls, tasks, approvals, reports, errors.
- Verification passes locally and against Render: typecheck, build, migrations, smoke, scenarios, E2B readiness/fallback.

## No Fake Agent Rule

The previous failure mode was route logic pretending to be an agent. Do not repeat that.

Mock data is not the same as a mock agent:

- acceptable: seeded mock clients, pets, appointments, invoices, messages, pricing observations.
- acceptable: seeded mock lab catalog, lab orders, lab result statuses, and lab report metadata shaped like a future Antech adapter.
- acceptable: fallback tool results when a live integration is missing.
- unacceptable: hardcoded route responses acting as the "agent."
- unacceptable: regex-only intent routing as the final agent.
- unacceptable: deterministic scripts that skip ADK and still claim agent completion.
- unacceptable: fake `mode=google-adk` without real ADK events/tool calls.

Final agent completion requires:

- real `@google/adk` agents implemented.
- real `LlmAgent` execution path.
- real `FunctionTool` wrappers.
- real tool-calling loop.
- persisted tool traces from agent-selected tool calls.
- proof run with `AGENT_RUNTIME=google-adk` when credentials exist.

Fallback rules:

- fallback is allowed only when credentials/integrations are missing or failing.
- fallback must emit observable workflow events such as `runtime_fallback`, `apify_fallback`, or `records_local_approval`.
- fallback routes must still use the shared tool registry.
- fallback proof does not replace ADK proof.

If Google credentials are unavailable:

- implement the ADK code path anyway.
- run fallback proof.
- mark ADK live proof as blocked by exact missing env/account in the proof file.
- do not mark "real ADK agent complete" unless the ADK path was executed or the only missing piece is external credentials.

## Integration Shape: Antech-Style Labs

Build the lab workflow as an adapter-shaped mock. The data is fake; the agents, tools, traces, persistence, and API behavior are real.

Purpose:

- make the product feel ready for a lab vendor integration later.
- give the internal agent realistic operational work.
- avoid waiting on live Antech access.
- avoid pretending a live Antech integration exists.

Do not do:

- no live Antech API calls.
- no Antech credentials.
- no claims that results came from Antech.
- no hardcoded response pretending to be a lab agent.
- no UI requirement.

Mock lab data should include:

- `labVendor`: example value `antech_mock`.
- `externalOrderId`: stable fake lab order/accession id.
- `clientId`.
- `petId`.
- `patientName`.
- `orderedBy`.
- `testCode`.
- `testName`.
- `specimenType`.
- `orderedAt`.
- `status`: `ordered`, `in_progress`, `partial`, `final`, `cancelled`.
- `resultSummary`.
- `abnormalFlags`: array.
- `reportUrl`: fake/internal metadata only, not a real external URL.
- `raw`: normalized JSON payload shaped like a vendor response.

Suggested DB additions:

- `mock_lab_catalog`
- `mock_lab_orders`
- `mock_lab_results`

Suggested tools:

- `list_lab_catalog`
- `lookup_lab_orders`
- `get_lab_result`
- `summarize_lab_result`
- `create_lab_followup_task`

Agent behavior:

- external agent can intake "are my lab results back?" and create a staff status task if result disclosure needs review.
- internal agent can list pending lab orders, identify final/abnormal mock results, and create follow-up tasks.
- abnormal lab flags create staff/veterinarian review tasks.
- no diagnosis or treatment recommendation.
- no automatic client send.

Verification:

- add at least one scenario where the internal agent checks mock labs and creates a review task.
- run detail must show lab tools called by the ADK agent.
- output must label vendor/source as mock lab data.
- proof must show `medicalAdviceGiven=false` for any lab-related scenario.

## Verifiability Contract

This plan is not complete by code inspection. Every major claim needs a proof artifact.

Required proof file:

- `docs/proof/mainCompleteAllAgents-proof.md`

Required proof content:

- exact git branch and commit SHA.
- exact migration list applied.
- exact commands run, with pass/fail and timestamp.
- exact local base URL used.
- exact Render URL used, if deployed proof is possible.
- exact `AGENT_RUNTIME` used for each scenario batch.
- every tested route with:
  - method and path.
  - HTTP status.
  - response time.
  - `runId`.
  - `traceId`.
  - expected `intent`.
  - created `task.id`, `approval.id`, or `report.id` when required.
- one fetched `/api/agent/runs/<runId>` response summary proving:
  - persisted run exists.
  - workflow events exist.
  - tool calls exist.
  - linked task/approval/report IDs are visible.
- fallback proof for missing/disabled live tools:
  - Google ADK fallback event when credentials absent.
  - Apify fallback event when live pricing unavailable.
  - records local approval/audit event for records transfer.
  - E2B provider shown as `e2b` or explicit local fallback.
- real Google ADK proof when credentials exist:
  - `AGENT_RUNTIME=google-adk`.
  - `mode=google-adk`.
  - run detail includes model name.
  - workflow events include ADK start/final response events.
  - tool calls include ADK-triggered `FunctionTool` calls.
  - final response still matches the shared route contract.
  - at least check-in, records, pricing, labs, and daily-ops pass through ADK.
- tool-loop proof:
  - external check-in run shows at least 3 tool calls.
  - external records run shows at least 3 tool calls and an approval.
  - internal daily-ops run shows at least 4 tool calls.
  - internal pricing run shows scan, compare, and report/task creation tools.
  - internal labs run shows lab lookup/result/follow-up tools.
  - no required scenario completes only by route-local branching.
- duplicate audit proof:
  - no route-local `runCheckin`, `runBooking`, `runRecords`, `runPricing`, or `runDailyOps`.
  - no `_workflow.ts` import from active route files.
  - task/approval/report persistence occurs in the runner path only.

## Non-Expert Verification

Someone who did not build the system must be able to test it from the terminal.

Add scripts:

- `scripts/verify-agents.mjs`
- root `package.json` script: `verify:agents`
- root `package.json` script: `verify:agents:google`

Expected commands:

```bash
npm run db:migrate
npm run typecheck
npm run build
npm run dev
```

In a second terminal:

```bash
npm run verify:agents:google
```

What `verify:agents:google` must do:

- require a reachable app at `LOCAL_BASE_URL` or `http://localhost:3000`.
- require Google credentials unless run with `--allow-fallback`.
- set or verify `AGENT_RUNTIME=google-adk`.
- never print secret values.
- call the public and internal agent API routes directly.
- not depend on UI pages.
- assert `mode=google-adk` when Google credentials exist.
- assert `runId`, `traceId`, workflow events, tool calls, and linked task/approval/report IDs.
- fetch `/api/agent/runs/<runId>` for at least one public run and one internal run.
- print plain English pass/fail lines for non-expert testers.
- also support `--jsonl` for machine-checkable proof.
- exit nonzero on any failed assertion.
- write or append proof-ready output to `docs/proof/mainCompleteAllAgents-proof.md`.

Required tested routes for `verify:agents:google`:

- `POST /api/agent/checkin`
- `POST /api/agent/records`
- `POST /api/agent/booking`
- `POST /api/agent/pickup`
- `POST /api/agent/followup`
- `POST /api/agent/call`
- `POST /api/agent/daily-ops`
- `POST /api/agent/invoice`
- `POST /api/agent/pricing`
- `POST /api/agent/internal` with a lab-results request
- `GET /api/agent/runs/<runId>`

Tester env names:

- `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- `APIFY_API_TOKEN`
- `E2B_API_KEY`
- `VET_APP_ADMIN_PASSCODE` or `VET_ADMIN_PASSCODE`

Secret handling:

- keys may be supplied locally by the tester.
- never write key values into docs, commits, logs, JSONL, screenshots, or proof files.
- env checks print only `present` or `missing`.
- proof file records env names only.

Pass criteria for a non-expert:

- `npm run verify:agents:google` prints only `PASS` or actionable `FAIL` lines.
- final line says `PASS all agent checks`.
- proof file exists and includes run ids.
- at least one run detail shows `mode=google-adk`.
- at least one run detail shows ADK-triggered tool calls.

Machine-checkable proof output:

- `scripts/vetagent-scenarios.mjs` must print one JSONL line per scenario when run with `--jsonl`.
- each JSONL object must include:
  - `label`
  - `ok`
  - `provider`
  - `status`
  - `ms`
  - `runId`
  - `traceId`
  - `intent`
  - `taskId`
  - `approvalId`
  - `reportId`
  - `safety`
  - `errors`
- final JSONL line must be:
  - `{ "type": "summary", "ok": true, "passed": N, "failed": 0 }`

Semantic proof requirements:

- arrival happy path:
  - `intent=checkin`
  - `result.matched=true`
  - task exists.
  - arrival event exists.
- arrival no appointment:
  - `intent=checkin`
  - `result.matched=false`
  - review task exists.
- already-arrived:
  - no duplicate arrival task for same appointment/run scenario.
  - event says already arrived or idempotent.
- wait complaint:
  - task priority is `high`.
- booking:
  - task exists.
  - `result.booked` is not silently finalized without staff confirmation.
- pickup:
  - task exists.
  - status source is mock/DB data.
- records:
  - approval exists.
  - `result.requiresApproval=true`.
  - no send event exists.
- sick-pet:
  - task exists.
  - `result.medicalAdviceGiven=false`.
  - emergency language present when red-flag terms are present.
- follow-up:
  - task or report exists.
  - candidate id visible.
- invoice:
  - report exists.
  - task exists when flags exist.
  - `result.changedInvoices=false`.
- pricing:
  - report exists.
  - task exists.
  - `result.changedPrices=false`.
  - mode shows `mock` unless live Apify data was actually used.
- daily ops:
  - report exists.
  - summary counts visible.
  - ranked work list visible.
- labs:
  - mock lab vendor/source visible.
  - lab tool calls visible.
  - review task exists for final/abnormal result.
  - `medicalAdviceGiven=false`.

Acceptance rule:

- A checkbox in this file is not considered done unless the proof file cites a command or route response that verifies it.
- Any skipped proof must include `blocked_by`, exact missing env/account, and fallback behavior observed.
- "Looks implemented" is not accepted as proof.
- "Fallback passed" is not accepted as proof that real agents are complete.
- Regex/hardcoded output is not accepted as agent behavior.

## Hard Constraints

- Do not build or redesign UI, except tiny adjustments required to keep existing pages compiling.
- Do not add Supabase Auth.
- Do not rename passcode envs:
  - `VET_ADMIN_PASSCODE`
  - `VET_APP_ADMIN_PASSCODE`
  - `VET_VETERINARIAN_PASSCODE`
- Do not send records automatically.
- Do not change invoices automatically.
- Do not change service prices automatically.
- Do not provide medical diagnosis/treatment advice.
- Do not require live Google ADK, E2B, Apify, PMS, phone, or lab integrations for demo success.
- Do not print secret values.

## Current Repo Snapshot

Already present:

- Unified app: `apps/internal`.
- Legacy public source: `apps/client-request`; not deploy target.
- Agent package: `packages/agents`.
- DB package: `packages/db`.
- Existing agent routes:
  - `apps/internal/app/api/agent/checkin/route.ts`
  - `apps/internal/app/api/agent/booking/route.ts`
  - `apps/internal/app/api/agent/pickup/route.ts`
  - `apps/internal/app/api/agent/records/route.ts`
  - `apps/internal/app/api/agent/followup/route.ts`
  - `apps/internal/app/api/agent/call/route.ts`
  - `apps/internal/app/api/agent/external/route.ts`
  - `apps/internal/app/api/agent/internal/route.ts`
  - `apps/internal/app/api/agent/daily-ops/route.ts`
  - `apps/internal/app/api/agent/invoice/route.ts`
  - `apps/internal/app/api/agent/pricing/route.ts`
  - `apps/internal/app/api/agent/runs/[id]/route.ts`
- Existing persistence tables:
  - `agent_runs`
  - `workflow_events`
  - `approvals`
  - `agent_reports`
  - mock clinic tables
  - `pricing_observations`
- Existing scenario scripts:
  - `npm run smoke:local`
  - `npm run scenarios:local`
  - `npm run smoke:e2b`
  - `npm run scenarios:e2b`
- Existing docs:
  - `docs/agent-api-contracts.md`
  - render/supabase deployment docs currently exist but must be renamed or rewritten to remove obsolete records-audit vendor references.

Main gap:

- `apps/internal/app/api/agent/_workflow.ts` is a second, route-local agent engine.
- `packages/agents` has typed tools, guardrails, mock provider, scenario runner, and package agents.
- Routes mostly use `_workflow.ts`, not `packages/agents`.
- Package `toolCalls` are not persisted.
- No first-class tool-call table.
- No consistent trace id, request id, duration, structured error, or response header.
- Google ADK mode is detected but not fully wired as a real runtime.
- Apify/live-tool fallbacks need visible proof in run output and events.
- Scenario scripts mostly check HTTP success/time, not semantic safety/result invariants.

## Target Architecture

Keep one execution path:

- route auth/body parsing
- `executeVetAgentWorkflow(...)`
- `@central-vet/agents` orchestrator
- persistence adapter
- stable JSON response

Preferred shape:

- `apps/internal/app/api/agent/_runner.ts`
  - server-side route runner
  - starts `agent_runs`
  - loads DB mock clinic data
  - calls `packages/agents`
  - persists effects/tool calls/events
  - updates run status
  - returns stable response
- `packages/agents`
  - pure agent/tool behavior
  - no direct Next imports
  - no direct route auth
  - no secret printing
  - mock-safe default
- `packages/db`
  - persistence helpers only

Do not keep two real agent engines. After `_runner.ts` is proven, delete `_workflow.ts` or reduce it to thin compatibility exports that call `_runner.ts`.

## No Duplicate Agent Rule

There must be exactly one backend agent execution path.

Allowed:

- route files parse/authenticate request bodies.
- `_runner.ts` handles persistence, trace ids, DB context, and response headers.
- `packages/agents` handles agent decisions, tools, guardrails, and runtime selection.
- DB helpers persist runs, tool calls, tasks, approvals, events, reports.

Not allowed:

- route-local agent business logic.
- two copies of check-in/booking/records/pricing behavior.
- both `_workflow.ts` and `packages/agents` making independent decisions.
- one route creating DB tasks directly while another persists package effects.
- duplicate task/report/approval creation for one agent effect.
- separate mock data shapes that drift silently.
- Legacy fallback being treated as the target live agent runtime.

Required cleanup:

- replace route use of `_workflow.ts` with `_runner.ts`.
- delete `_workflow.ts` after route migration, unless temporarily left as a thin compatibility wrapper that imports only from `_runner.ts`.
- remove any route-local implementations of `runCheckin`, `runBooking`, `runRecords`, `runPricing`, `runDailyOps`, etc.
- keep `packages/agents` as the single place for agent behavior.
- keep DB effect persistence in `_runner.ts` or DB helpers only.

Duplicate-proof commands:

- `grep -R "_workflow" apps/internal/app/api/agent packages/agents`
  - allowed output: none, or one thin wrapper import during transition.
- `grep -R "export async function runCheckin\\|export async function runBooking\\|export async function runPricing" apps/internal/app/api/agent`
  - allowed output: none.
- `grep -R "createTask(" apps/internal/app/api/agent`
  - allowed output: `_runner.ts` only.
- `grep -R "createApproval(" apps/internal/app/api/agent`
  - allowed output: `_runner.ts` only.
- `grep -R "createAgentReport(" apps/internal/app/api/agent`
  - allowed output: `_runner.ts` only.

Real-agent rule:

- Mock/fallback mode can be deterministic, but it must call the same `packages/agents` tool registry and return persisted tool traces.
- Mock/fallback mode is not the acceptance path for real-agent completion.
- Google ADK mode must instantiate real `@google/adk` agents.
- Google ADK mode is not accepted if it only changes `mode` text while still running the deterministic mock path.
- A route response with `mode=google-adk` must have ADK runtime evidence in run detail.
- ADK failure may fallback to mock only if the run records `runtime_fallback` or `adk_parse_fallback`.

## Agent Loop Design

Both agents should be dynamic tool-calling agents, not scripted one-shot classifiers.

No master-worker pattern for this sprint:

- use two separate agents:
  - external tool-calling agent.
  - internal tool-calling agent.
- do not add a master router/coordinator unless a concrete route needs it.
- routing between external/internal is handled by route selection and intent, not another LLM agent.
- keep orchestration flat so debugging, traces, and demo proof stay simple.

External agent shape:

- `LlmAgent` with normal function tools.
- Tool-calling loop:
  - understand client request.
  - look up relevant clinic state.
  - call one or more tools.
  - create task/approval/report when needed.
  - produce concise client-facing response.
- Must support multi-tool workflows:
  - check-in: lookup client/pet -> lookup appointment -> mark arrived -> get wait status -> create task/event.
  - booking: lookup client/pet -> list slots -> create confirmation task.
  - records: prepare records packet -> audit records transfer -> create approval -> create task.
  - sick-pet: triage -> create urgent task -> safe response.
  - call transcript: triage call -> delegate or create review task.

Internal agent shape:

- Separate `LlmAgent` with normal function tools.
- Same basic loop shape as external, but staff-facing:
  - understand staff request.
  - inspect clinic state.
  - call one or more tools.
  - create task/approval/report when needed.
  - produce ranked staff-facing action summary.
- It can write a short internal plan in its reasoning/state, but do not implement separate planner/executor agents for MVP.
- Tool-calling behavior matters more than agent class count.
- Must support multi-tool workflows:
  - daily ops: list tasks -> list approvals -> list followups -> list invoices -> list reports -> create digest.
  - records: prepare packet -> local records approval/audit -> create approval/task.
  - pricing: run scan -> compare service prices -> create price review report/task.
  - invoice: get invoice summary -> flag invoice issue -> create report/task.
  - labs: lookup mock lab orders -> get final/abnormal result -> summarize -> create review task.
  - prioritization: list tasks -> inspect due/priority/status -> produce ranked work list.

Loop controls:

- max tool calls per run: default 8 external, 12 internal.
- max model turns per run: default 6 external, 8 internal.
- stop when required effect exists and final answer is ready.
- if confidence is low, create staff review task instead of guessing.
- if a tool fails, record tool failure and either use fallback or create review task.
- all tool calls must be persisted.
- no model output may bypass guardrails or persistence.

Tool registry:

- one typed registry in `packages/agents/src/tools.ts`.
- ADK `FunctionTool` wrappers in `adkTools.ts` must call that registry.
- deterministic fallback/mock mode must call that same registry or a thin adapter over it.
- adding a tool requires:
  - Zod schema.
  - description.
  - safe output shape.
  - trace persistence.
  - scenario proof if user-visible.
- complete required tool list is below.

## Required Tool Inventory

Every tool below must be available through the shared registry and wrapped as a Google ADK `FunctionTool`.

Tool requirements for every tool:

- Zod input schema.
- typed output shape.
- human-readable description.
- no direct secret access unless explicitly needed.
- redacted persisted args/results.
- workflow event when it creates or changes product state.
- tool-call trace linked to `runId` and `traceId`.
- clear failure output instead of throwing unstructured errors.

Lookup/context tools:

- `lookup_client`
- `lookup_pet`
- `lookup_appointment`
- `get_wait_status`
- `list_tasks`
- `list_approvals`
- `list_reports`
- `list_service_catalog`
- `list_followup_candidates`
- `list_lab_catalog`
- `lookup_lab_orders`
- `get_lab_result`

Action/effect tools:

- `mark_arrived`
- `create_booking_hold`
- `create_task`
- `update_task`
- `create_approval`
- `decide_approval`
- `create_agent_report`
- `create_daily_ops_report`
- `create_followup_task`
- `create_lab_followup_task`

Triage/safety tools:

- `triage_message`
- `triage_call`
- `check_medical_guardrail`
- `check_records_guardrail`
- `check_billing_guardrail`
- `check_pricing_guardrail`

Records tools:

- `prepare_records_packet`
- `audit_records_transfer`
- `request_records_transfer`

Invoice tools:

- `get_invoice_summary`
- `flag_invoice_issue`

Pricing tools:

- `run_competitor_scan`
- `compare_service_prices`
- `create_price_review_report`

Lab tools:

- `summarize_lab_result`

Observability tools/helpers:

- `record_workflow_event`
- `record_tool_call`
- `create_agent_run`
- `complete_agent_run`
- `fail_agent_run`

Verification expectations:

- check-in route uses at least: `lookup_client`, `lookup_pet` or combined lookup, `lookup_appointment`, `mark_arrived`, `get_wait_status`, `create_task`.
- records route uses at least: `prepare_records_packet`, `audit_records_transfer`, `request_records_transfer`, `create_task`.
- pricing route uses at least: `list_service_catalog`, `run_competitor_scan`, `compare_service_prices`, `create_price_review_report`, `create_task`.
- daily ops route uses at least: `list_tasks`, `list_approvals`, `list_followup_candidates`, `list_reports`, `create_daily_ops_report`.
- lab route/request uses at least: `lookup_lab_orders`, `get_lab_result`, `summarize_lab_result`, `create_lab_followup_task`.

## Phase 0 - Baseline

Do first:

- `git status -sb`
- `npm run typecheck`
- `npm run build`
- `npm run db:migrate`
- If dev server available, `npm run smoke:local`
- Record any pre-existing failures in `docs/implementation-notes.md` before edits.

Done when:

- Baseline known.
- No user/other-agent changes reverted.
- No branch switch.

## Phase 1 - Observability Schema

Add migration:

- `db/migrations/021_agent_observability.sql`

Add to `agent_runs`:

- `trace_id text`
- `request_id text`
- `model text`
- `duration_ms int`
- `input_hash text`
- `input_summary text`
- `output_summary text`
- `error_kind text`
- `token_input int`
- `token_output int`
- `tool_call_count int not null default 0`

Create `agent_tool_calls`:

- `id uuid primary key default gen_random_uuid()`
- `run_id uuid references agent_runs(id) on delete cascade`
- `trace_id text`
- `sequence int not null`
- `tool_name text not null`
- `status text not null`
- `args jsonb not null default '{}'`
- `result jsonb not null default '{}'`
- `error text`
- `duration_ms int`
- `created_at timestamptz not null default now()`

Indexes:

- `agent_runs(trace_id)`
- `agent_runs(status, created_at desc)`
- `agent_tool_calls(run_id, sequence)`
- `agent_tool_calls(tool_name, created_at desc)`

Add DB helpers in `packages/db/src/agents.ts`:

- `createAgentToolCall`
- `listAgentToolCalls`
- `getAgentRunWithTimeline`
- `failAgentRun`
- update `createAgentRun` / `updateAgentRun` to support new columns

Redaction:

- redact passcodes, API keys, tokens, auth headers.
- cap large strings at 1000 chars in tool args/results.
- store summaries for user text, not full secrets.

Done when:

- migration idempotent.
- helpers typecheck.
- `/api/agent/runs/[id]` can return run, workflow events, and tool calls.

## Phase 2 - Instrumented Runner

Create:

- `apps/internal/app/api/agent/_runner.ts`
- optional helper: `apps/internal/app/api/agent/_redaction.ts`

Runner contract:

```ts
executeVetAgentWorkflow({
  agent: "external" | "internal",
  routeIntent: "checkin" | "booking" | "pickup" | "records" | "followup" | "call" | "daily_ops" | "invoice" | "pricing" | "external" | "internal",
  input,
  actor,
  requireManager,
  request
})
```

Runner behavior:

- generate `traceId`.
- read incoming `x-request-id`, else generate `requestId`.
- create `agent_runs` with status `running`.
- load mock clinic data from DB and convert to `MockClinicData`.
- pass `runId`, `now`, `mode`, and `clinicData` into `packages/agents`.
- persist package effects:
  - `AgentTaskDraft` -> `createTask`
  - `AgentApprovalDraft` -> `createApproval`
  - `AgentReportDraft` -> `createAgentReport`
  - `WorkflowEventDraft` -> `createWorkflowEvent`
  - `ToolCallTrace` -> `createAgentToolCall`
- de-dupe effects by draft id.
- map draft task ids to persisted task ids before creating approvals/reports.
- update `agent_runs` to `completed`.
- on error, update `agent_runs` to `failed`, write failure event, return existing `dbError` shape.
- include response headers:
  - `x-vetagent-trace-id`
  - `x-vetagent-run-id`

Response shape stays compatible:

- `ok`
- `mode`
- `intent`
- `message`
- `result`
- `task`
- `approval`
- `report`
- `workflowEvents`
- `toolCalls`
- `runId`
- `traceId`
- `durationMs`

Important conversion fixes:

- `MockAppointment.appointmentDate` from DB is an ISO date, while package tool currently checks `"today"`. Fix `start_arrival` to accept either `"today"` or the current local date.
- DB seed uses message urgency `"urgent"` in places; normalize to package `"high"` or update type/logic to accept both.
- Do not create duplicate check-in tasks when appointment already arrived.
- Persist actual appointment arrival via `markAppointmentArrived` when `mark_arrived` tool succeeds.

Done when:

- one route can call runner and persist run/events/tools/tasks.
- failed route produces a failed run with trace id.
- no duplicate persistence for the same result.

## Phase 3 - Route Consolidation

Update routes to use `_runner.ts`:

- public routes use `readPublicAgentBody`.
- internal routes use `requireManagerFromBody`.
- keep existing URL paths and payload shapes.

Public route mapping:

- `/api/agent/checkin` -> external, routeIntent `checkin`
- `/api/agent/booking` -> external, routeIntent `booking`
- `/api/agent/pickup` -> external, routeIntent `pickup`
- `/api/agent/records` -> external, routeIntent `records`
- `/api/agent/followup` -> external, routeIntent `followup`
- `/api/agent/call` -> external, routeIntent `call`
- `/api/agent/external` -> external, routeIntent `external`

Internal route mapping:

- `/api/agent/internal` -> internal, routeIntent `internal`
- `/api/agent/daily-ops` -> internal, routeIntent `daily_ops`
- `/api/agent/invoice` -> internal, routeIntent `invoice`
- `/api/agent/pricing` -> internal, routeIntent `pricing`

After all route tests pass:

- delete route-local behavior in `_workflow.ts`, or make it a thin wrapper only.
- update imports.
- no duplicated business logic left in route files.

Done when:

- all agent routes still return same compatible top-level fields.
- all persisted run ids can be fetched through `/api/agent/runs/[id]`.

## Phase 4 - Complete External Agent

Files:

- `packages/agents/src/externalAgent.ts`
- `packages/agents/src/callAgent.ts`
- `packages/agents/src/followupAgent.ts`
- `packages/agents/src/recordsAgent.ts`
- `packages/agents/src/tools.ts`
- `packages/agents/src/guardrails.ts`

Required behavior:

- check-in:
  - match by client name/phone + pet.
  - mark arrived when matched.
  - return wait estimate.
  - high priority if waiting complaint or wait >= 30 minutes.
  - no duplicate arrival mutation if already arrived.
  - staff task created or reused.
- booking:
  - list matching slots.
  - never silently finalize.
  - create confirmation task.
  - ask/review when client/pet ambiguous.
- pickup/status:
  - return known ready/wait status if available.
  - create staff task for manual status update.
  - never claim a medical outcome not in data.
- follow-up:
  - find due candidate.
  - create outreach/booking task.
  - create follow-up report.
- records:
  - prepare packet.
  - run local records approval/audit helper.
  - create approval.
  - create task.
  - no send.
- sick-pet:
  - detect emergency terms.
  - high-priority task.
  - no diagnosis/treatment.
  - emergency-language instruction only.
- call/transcript:
  - classify transcript.
  - delegate to specific workflow when clear.
  - otherwise create staff review task.
  - preserve transcript summary in run/event.

Add tests/scenarios for:

- matched arrival.
- no appointment arrival.
- already-arrived idempotency.
- wait complaint priority high.
- booking with known client.
- booking ambiguous.
- pickup ready.
- pickup unknown pet.
- records approval.
- records local approval/audit path.
- sick-pet emergency.
- sick-pet non-emergency.
- call transcript delegates to check-in.
- call transcript unknown creates review task.

Done when:

- all scenarios assert intent, task/approval/report presence, and safety flags.
- route output includes tool calls and trace id.

## Phase 5 - Complete Internal Agent

Files:

- `packages/agents/src/internalAgent.ts`
- `packages/agents/src/pricingAgent.ts`
- `packages/agents/src/followupAgent.ts`
- `packages/agents/src/recordsAgent.ts`
- `packages/agents/src/tools.ts`

Required behavior:

- daily ops:
  - summarize open tasks, high-priority work, pending approvals, open follow-ups, invoice reviews, pricing reports.
  - ranked work list with reasons.
  - create daily ops report.
  - no task churn unless requested.
- task prioritization:
  - use due/priority/status.
  - explain why urgent.
  - do not reorder persisted tasks silently unless explicit endpoint later exists.
- sick-pet triage:
  - same medical guardrail as external.
  - task high/medium based on matched terms.
- records workflow:
  - packet + local records approval/audit + approval + task.
  - source shown as `local_records_policy`.
- invoice review:
  - report flagged invoices.
  - task for staff review.
  - no invoice mutation.
- follow-up scan:
  - report candidates.
  - create at most one default task per run unless input asks for all.
  - avoid duplicate tasks for same follow-up in same day if practical.
- pricing review:
  - sample fallback always works.
  - live Apify only when `live: true` and env configured.
  - normalize prices safely.
  - report comparisons.
  - create task.
  - no repricing.

Internal data:

- Prefer DB state for daily ops, approvals, reports, tasks, followups, invoices, pricing observations.
- Keep package pure by passing DB-derived context through runner/options.
- Do not import Next route code into `packages/agents`.

Done when:

- internal route outputs are backed by current DB state.
- every internal workflow creates observable report/task/approval when appropriate.
- lab workflows use mock lab data but real agent/tool execution.

## Phase 6 - Google ADK Runtime

Build the real agent path here. Fallback comes after this, not instead of this.

Files:

- `packages/agents/src/adkRuntime.ts`
- `packages/agents/src/adkTools.ts`
- maybe `packages/agents/src/adkAgents.ts`

Use `@google/adk`:

- build `LlmAgent` for external agent.
- build `LlmAgent` for internal agent.
- wrap existing Zod tools as `FunctionTool`.
- use `InMemoryRunner`.
- use `createUserContent` from `@google/genai`.
- use callbacks/guardrails before model/tool calls.
- default model: `gemini-2.5-flash`, overridable by `GOOGLE_ADK_MODEL`.

Minimum real ADK implementation:

- `adkAgents.ts` exports:
  - `externalRootAgent: LlmAgent`
  - `internalRootAgent: LlmAgent`
- `adkTools.ts` exports one `FunctionTool` per existing agent tool.
- ADK tools call the same typed tool execution layer as fallback/mock mode.
- `adkRuntime.ts` exports:
  - `runGoogleAdkExternalAgent`
  - `runGoogleAdkInternalAgent`
  - `runGoogleAdkAgent`
- `runGoogleAdkAgent` creates or reuses an `InMemoryRunner`.
- `runGoogleAdkAgent` creates a session with state containing:
  - `traceId`
  - `runId`
  - `routeIntent`
  - sanitized input summary
  - mock/DB clinic context summary
- final ADK output is parsed into the same `AgentWorkflowResult` type.
- ADK tool calls are mirrored into `ToolCallTrace`.
- ADK events are mirrored into `WorkflowEventDraft` where useful.

Agent instructions must include:

- external agent: client-facing, short answers, ask only needed questions, no diagnosis, create staff task/approval for risky work.
- internal agent: staff-facing, rank work, explain reasons, no silent billing/pricing/records mutation.
- both agents: use tools, do not invent clinic facts, deterministic fallback if uncertain.

Disallowed ADK shortcuts:

- no plain Gemini SDK call without `@google/adk`.
- no route-level prompt call.
- no `mode=google-adk` unless `LlmAgent` and `InMemoryRunner` executed.
- no ADK-only side effects; all effects must still persist through `_runner.ts`.
- no model-produced raw SQL.

Runtime selection:

- `AGENT_RUNTIME=google-adk` and Google creds present: ADK behavior.
- `AGENT_RUNTIME=fallback` or missing creds: deterministic fallback behavior.
- `AGENT_RUNTIME=mock` may remain as an alias for fallback only if existing scripts need it.
- missing creds: fallback to mock and write workflow event `runtime_fallback`.

Safety:

- before-tool callback blocks:
  - records send
  - invoice mutation
  - price mutation
  - medical advice
- after-model callback normalizes response into `AgentWorkflowResult`.
- if ADK output cannot be parsed, fallback to deterministic result and mark `adk_parse_fallback`.

Observability:

- persist ADK events as workflow events where useful.
- persist tool calls with args/result redacted.
- store model name and token counts when available.

Done when:

- fallback mode still works, but is clearly labeled fallback/mock.
- ADK mode runs local check-in, records, pricing, and daily-ops requests with the same response contract.
- at least one ADK run creates a task through a `FunctionTool`, not route logic.
- run detail proves ADK events and tool calls.
- missing credentials do not break demo, but are documented as blocking live ADK proof.

## Phase 7 - Apify, Records Approval, E2B

Apify pricing:

- Env:
  - `APIFY_API_TOKEN`
  - `APIFY_PRICING_ACTOR_ID`
- Route only calls Apify when `live: true`.
- timeout <= 30s.
- normalize common fields:
  - competitor/name/title
  - service/serviceName
  - price/priceCents/observedText
  - url
- on failure, fallback to sample and event `apify_fallback`.
- mode is `apify` only if live data was actually used; otherwise `mock`.

Records approval:

- no external records-audit vendor integration.
- remove obsolete records-audit vendor env vars from docs/examples.
- remove obsolete records-audit vendor helpers from active exports/imports.
- delete any obsolete external records-audit helper under `packages/agents/src/tools/` if unused.
- implement local `audit_records_transfer` tool or equivalent local helper.
- local helper returns:
  - `status`: `needs_approval`, `blocked`, or `ready_for_review`.
  - `source`: `local_records_policy`.
  - `reason`.
  - `checkedAt`.
- include local audit status/reason/source in approval `requestedAction`.
- blocked/flagged records requests still create approval/task, never send records.

E2B:

- Keep E2B as proof/eval path, not normal request path.
- `npm run smoke:e2b` verifies token/sandbox.
- `npm run scenarios:e2b` uses public `SCENARIO_BASE_URL`; localhost falls back local after E2B readiness.
- report actual provider in output: `local`, `e2b`.

Done when:

- missing tokens produce explicit fallback events, not silent behavior.
- live token failures do not fail demo flows.

## Phase 8 - Scenario Assertions

Upgrade `scripts/vetagent-scenarios.mjs`.

For each scenario, assert:

- HTTP ok.
- time budget ok.
- `ok === true`.
- expected `intent`.
- `runId` present.
- `traceId` present.
- required `task` / `approval` / `report` present.
- `workflowEvents.length > 0`.
- `toolCalls.length > 0` for agent package-backed routes.
- multi-step routes meet minimum tool-call counts:
  - check-in: >= 3.
  - records: >= 3.
  - daily ops: >= 4.
  - pricing: >= 3.
- safety booleans:
  - sick-pet: `medicalAdviceGiven === false`.
  - records: `requiresApproval === true`.
  - invoice: `changedInvoices === false`.
  - pricing: `changedPrices === false`.

Required scenario set:

- arrival happy path.
- arrival no appointment.
- arrival already arrived.
- wait complaint.
- booking happy path.
- booking ambiguous.
- pickup status ready.
- pickup status unknown.
- records transfer approval.
- internal lab-result review.
- sick-pet emergency.
- sick-pet non-emergency.
- call transcript to check-in.
- call transcript unknown.
- follow-up scan.
- daily ops.
- invoice review.
- pricing sample.
- pricing live fallback when token missing.

Keep output CLI-friendly:

- one line per scenario.
- no tables.
- include `runId`, `traceId`, ms, bytes, and provider.

Done when:

- `npm run scenarios:local` proves semantics, not just status codes.

## Phase 9 - Reports And Run Inspection

Update:

- `apps/internal/app/api/agent/runs/[id]/route.ts`
- reports routes if needed:
  - `apps/internal/app/api/reports/pricing/route.ts`
  - `apps/internal/app/api/reports/invoices/route.ts`
  - `apps/internal/app/api/reports/followups/route.ts`

Run detail must return:

- run
- workflowEvents
- toolCalls
- linked task ids
- linked approval ids
- linked report ids

Optional backend-only endpoint if useful:

- `GET /api/agent/runs?role=admin&name=...`
  - latest 50 runs
  - manager auth
  - filters: agent, intent, status

Done when:

- a failing run can be debugged from one run id.

## Phase 10 - Docs

Update:

- `docs/agent-api-contracts.md`
- render/supabase deployment docs, rename/rewrite so obsolete records-audit vendor references are gone.
- `README.md`

Document:

- runtime modes.
- trace/run behavior.
- route contracts.
- safety invariants.
- env vars.
- local proof commands.
- Render proof commands.
- fallback behavior for Google ADK, Apify, records approval, E2B.

Do not commit secrets.

Done when:

- another agent can run local proof from docs only.

## Phase 11 - Verification

Required local proof:

- `npm run db:migrate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- start dev server
- `npm run smoke:local`
- `npm run scenarios:local`
- `AGENT_RUNTIME=google-adk npm run scenarios:local -- --jsonl` when Google credentials exist.
- `npm run verify:agents:google` when Google credentials exist.
- `npm run smoke:e2b`

Required deployed proof when Render URL available:

- set `SCENARIO_BASE_URL=https://vetagent-internal.onrender.com`
- `npm run scenarios:e2b`
- manual curl:
  - `POST /api/agent/checkin`
  - `POST /api/agent/records`
  - `POST /api/agent/pricing` with admin actor and `live:false`
  - `GET /api/agent/runs/<runId>` with manager auth

Closeout must include:

- commands run.
- pass/fail.
- failing output summary if any.
- deployed URL proof if available.
- known blockers only if external secret/account missing.

## Implementation Order

1. Baseline.
2. Observability migration + DB helpers.
3. Instrumented runner.
4. Convert one public route, prove run/tool persistence.
5. Convert all public routes.
6. Convert internal routes.
7. Delete/thin old `_workflow.ts`.
8. Run duplicate audit and remove route-local behavior.
9. Fill external agent behavior gaps.
10. Fill internal agent behavior gaps.
11. Wire real ADK runtime.
12. Prove at least one ADK `FunctionTool` task creation.
13. Wire fallback paths, Apify fallback events, and records local approval events.
14. Strengthen scenario assertions.
15. Docs.
16. Full local proof.
17. Render/E2B proof.

## Completion Checklist

- [ ] `021_agent_observability.sql` added and idempotent.
- [ ] mock lab catalog/orders/results migration added and idempotent.
- [ ] DB helpers support run metrics and tool calls.
- [ ] `_runner.ts` starts/completes/fails runs with trace id.
- [ ] tool calls persisted.
- [ ] route responses include `traceId`, `durationMs`, `toolCalls`.
- [ ] all public routes use runner.
- [ ] all internal routes use runner.
- [ ] `_workflow.ts` removed or thin only.
- [ ] duplicate audit commands pass.
- [ ] no route-local agent behavior remains.
- [ ] no deterministic/regex-only path is presented as final agent behavior.
- [ ] check-in idempotent.
- [ ] booking never silently finalizes.
- [ ] records requires approval and includes local records audit/approval metadata.
- [ ] sick-pet never gives medical advice.
- [ ] invoice never mutates invoice.
- [ ] pricing never mutates prices.
- [ ] `@google/adk` `LlmAgent` used for external agent.
- [ ] `@google/adk` `LlmAgent` used for internal agent.
- [ ] ADK `FunctionTool` wrappers call the same typed tool registry.
- [ ] ADK run detail shows model, events, and tool calls.
- [ ] ADK scenario batch passes, or exact credential blocker is documented.
- [ ] Antech-style mock lab workflow uses real ADK tool calls and creates review task.
- [ ] Apify fallback observable.
- [ ] Google ADK fallback observable.
- [ ] E2B provider/fallback observable.
- [ ] scenario script asserts semantics.
- [ ] `verify:agents` script exists and is noob-friendly.
- [ ] `verify:agents:google` proves Google ADK tool-calling or exact credential blocker.
- [ ] docs updated.
- [ ] typecheck passes.
- [ ] lint passes or known pre-existing lint issue documented.
- [ ] build passes.
- [ ] migrate passes.
- [ ] smoke local passes.
- [ ] scenarios local pass.
- [ ] E2B smoke passes or missing token documented.
- [ ] Render scenario proof passes or external deploy blocker documented.

## Final Acceptance

The work is complete only when a fresh agent can:

- run migrations,
- start the app,
- hit all agent routes,
- see persisted tasks/approvals/reports,
- fetch run detail with events/tool calls,
- run local scenarios,
- run deployed/E2B scenarios when secrets exist,
- explain every fallback from stored run data,
- demo all product workflows without UI changes.
