# VetAgent 4-Person Execution Plan

Date: 2026-05-31

Goal: build the fastest credible VetAgent MVP: external agent, internal agent, existing task manager, mock-first data, Supabase, Render, E2B, Apify, and approval-safe workflows.

Name assumption: "Apofine/Apofy" means Apify. If wrong, rename the account/tool lane before build.

## Best MVP Shape

Keep it simple:

- Existing task manager stays the work queue.
- Supabase becomes the shared product database.
- Render hosts the app.
- OpenAI Agents SDK powers agent orchestration.
- E2B runs isolated scenario/eval jobs first, not every normal app request.
- Apify handles competitor/public-web research.
- Opsera is useful for CI/CD visibility, but not allowed to block the MVP.

AI-friendly default:

- TypeScript first, because this repo is already Next.js/TypeScript.
- Every agent action goes through typed tools.
- Every tool writes workflow/audit events.
- Every risky action becomes an approval request.
- Every workflow works in mock mode before live integrations.

## Four People

### Person 1 - Sandeep: Supabase, Render, Production Path

Mission: make the product real and deployable.

Sandeep owns all Render work. No split ownership there.

Owns:

- Supabase project.
- Supabase keys and secrets.
- Database migration path.
- Render services.
- Render env vars.
- Mock/mirror/live mode config.
- Base tenant: Central Veterinary Hospital.
- Production deploy proof.
- Opsera connection only if ready quickly.

Does not own:

- Agent prompts.
- Frontend screens.
- Apify actor research.
- Workflow copy.

First 48 hours:

- Create Supabase project.
- Save exact secret names, not values, in setup notes.
- Decide Render shape: two services, `internal` and `client`.
- Add required env vars in Render.
- Run existing migrations.
- Deploy both apps with `MOCK_MODE=true`.
- Smoke test public request -> task board.

Deliverables:

- Supabase project URL configured.
- Render internal URL.
- Render public/client URL.
- Env var checklist.
- Migration command documented.
- Smoke-test notes.

Done when:

- Public request creates a task in Supabase.
- Internal board reads and updates that task.
- Clean Render deploy works from repo.
- Another person can run migrations from docs.

### Person 2 - Accounts/Tools Scout: Apify, E2B, Opsera, Vendor Readiness

Mission: unblock external tools and prove what each can do.

This is the person already making accounts and exploring Apify/tools.

Owns:

- Apify account.
- Apify actor/tool research.
- E2B account and token readiness.
- Opsera account readiness.
- Vendor/system research notes.
- Free-tier/pricing limits.
- Credential status list.
- Sample outputs from tools.

Does not own:

- App deploy.
- Frontend implementation.
- Agent code.
- Supabase schema.

First 48 hours:

- Confirm whether the tool is Apify.
- Create/login to Apify.
- Find 3 useful actors:
  - local business discovery,
  - website/page scraping,
  - Google Maps or local search equivalent.
- Run one sample scrape for competitor veterinary clinics.
- Export JSON/CSV sample.
- Confirm E2B account/token can be created.
- Confirm Opsera account access or blocker.
- Write short tool notes.

Deliverables:

- `docs/tool-readiness.md`
- Apify token status.
- E2B token status.
- Opsera status.
- Sample Apify JSON/CSV.
- Recommended Apify actor list.
- Free-tier/credit notes.

Done when:

- Backend person can call Apify or has a clear blocker.
- Backend person can call E2B or has a clear blocker.
- Team knows whether Opsera is this-week or later.
- There is one real competitor-research sample file.

### Person 3 - AI/Backend Engineer: Agents, Tools, Workflows

Mission: make the agents actually take useful, safe actions.

Owns:

- OpenAI Agents SDK integration.
- External agent.
- Internal agent.
- Typed tool registry.
- Mock provider.
- Workflow run storage.
- Agent trace storage.
- Approval request logic.
- E2B scenario/eval runner.
- Apify integration once Person 2 proves account/tool.

Does not own:

- Final frontend polish.
- Supabase account creation.
- Render service setup.
- Manual account exploration.

First 48 hours:

- Define provider interface.
- Build mock provider.
- Build typed tool registry.
- Add `workflow_runs`, `workflow_events`, `approval_requests`, `agent_traces` schema draft.
- Build first external-agent API route.
- Build first internal-agent API route.
- Add one mock booking scenario.

First tools:

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

AI safety requirements:

- No direct database writes from model text.
- No arbitrary tool names.
- No silent records transfer.
- No silent billing or pricing changes.
- Medical-ish input escalates to task.
- Tool guardrails around every risky function.
- Trace every run and tool call.

Deliverables:

- `packages/agents` or equivalent app-local agent module.
- Typed tool registry.
- Mock provider adapter.
- External agent route.
- Internal agent route.
- Scenario test runner.
- E2B eval runner or local fallback.

Done when:

- External booking scenario passes on mock data.
- External sick-pet scenario creates urgent task, no diagnosis.
- Internal daily-summary scenario ranks task-board work.
- Records-transfer scenario creates approval request.
- Every agent run has trace/workflow events.

### Person 4 - Frontend/Product Builder: User Flows, Screens, Demo

Mission: make the product usable and demoable.

Owns:

- All frontend screens.
- Public/client flows.
- Staff/internal flows.
- Agent chat/command panels.
- Mock demo data shape with backend person.
- Demo script.
- UX acceptance testing.
- Safety wording in UI.

Does not own:

- Supabase/Render accounts.
- Agent SDK wiring.
- Apify account/tool exploration.
- Production secrets.

First 48 hours:

- Map screens needed for demo.
- Wire public external-agent flow.
- Wire staff internal-agent panel.
- Define mock data needed by UI.
- Keep existing task board usable.
- Draft demo script.

First screens:

- Client booking flow.
- Client check-in / "I'm here" flow.
- Client pickup/status flow.
- Sick-pet request flow.
- Records-transfer request flow.
- Internal agent command panel.
- Daily ops digest view.
- Records-transfer approval queue.
- Pricing-review report view.

Frontend rules:

- No landing page for MVP.
- First screen should be actual workflow.
- Staff UI should be dense, clear, operational.
- Client UI should be simple and mobile-first.
- Every agent action should show status: drafted, approved, done, blocked.
- Risky actions must show approval state.

Deliverables:

- Public workflow screens.
- Internal agent panel.
- Approval queue UI.
- Workflow status UI.
- Demo script.
- Screenshot proof.

Done when:

- A non-technical tester can complete booking/check-in/pickup.
- Staff can see agent-created work on the task board.
- Approval requests are obvious.
- Demo can be run without explaining hidden backend state.

## Clean Ownership Boundaries

Sandeep owns infrastructure.

- If it is Supabase, Render, env vars, deployment, or prod readiness, Sandeep owns it.

Person 2 owns tool/account readiness.

- If it needs signup, token, free-tier check, marketplace/actor research, or vendor investigation, Person 2 owns it.

Person 3 owns AI/backend.

- If it is an agent, tool, provider adapter, workflow run, trace, approval rule, or E2B eval, Person 3 owns it.

Person 4 owns frontend/product.

- If a user clicks it, sees it, demos it, or needs to understand it, Person 4 owns it.

## Interfaces Between People

### Sandeep -> Backend

Provides:

- Supabase URL secret name.
- Supabase anon key secret name.
- Supabase service role secret name.
- Render service URLs.
- Database migration command.
- `MOCK_MODE` / `MIRROR_MODE` / `LIVE_MODE` env var names.

### Accounts Scout -> Backend

Provides:

- Apify token secret name.
- E2B token secret name.
- Opsera status.
- Apify actor IDs.
- Sample dataset output.
- Tool cost/free-limit notes.

### Backend -> Frontend

Provides:

- API routes.
- Request/response shapes.
- Workflow status enum.
- Approval status enum.
- Mock data endpoint.
- Agent run event stream or polling endpoint.

### Frontend -> Backend

Provides:

- Required screen states.
- Missing fields.
- Demo scenarios.
- UX bugs.
- Copy/safety needs.

## First 5 Days

Day 1:

- Sandeep: Supabase project + Render plan.
- Person 2: Apify/E2B/Opsera status.
- Person 3: provider interface + mock provider.
- Person 4: screen map + demo script draft.

Day 2:

- Sandeep: migrations + mock deploy.
- Person 2: sample Apify output.
- Person 3: typed tool registry + first agent route.
- Person 4: booking/check-in UI shell.

Day 3:

- Sandeep: deploy smoke test.
- Person 2: account/tool notes complete.
- Person 3: booking/check-in scenarios.
- Person 4: internal agent panel + task-board integration.

Day 4:

- Sandeep: stabilize env/deploy docs.
- Person 2: E2B/Apify handoff to backend.
- Person 3: records-transfer + approval logic.
- Person 4: approval queue UI.

Day 5:

- Sandeep: final deploy proof.
- Person 2: pricing scan sample refreshed.
- Person 3: competitor scan -> pricing report task.
- Person 4: final demo flow + screenshots.

## MVP Demo Script

Show this, in order:

1. Client books a vaccine appointment.
2. External agent suggests slot and confirms in mock data.
3. Client checks in with "I'm here".
4. Staff board shows the new state.
5. Client sends sick-pet message.
6. Agent refuses diagnosis and creates urgent staff task.
7. Client requests records transfer.
8. Internal agent prepares draft/approval task.
9. Staff approves or edits the request.
10. Internal agent shows daily ops digest.
11. Apify competitor scan creates pricing report.
12. Pricing report creates review task, not automatic repricing.

## Data Model Needed For MVP

Keep:

- `tasks`
- `task_events`
- notification tables

Add:

- `tenants`
- `locations`
- `clients`
- `pets`
- `appointments`
- `visits`
- `messages`
- `records_requests`
- `invoices`
- `invoice_items`
- `service_catalog`
- `competitor_price_snapshots`
- `workflow_runs`
- `workflow_events`
- `approval_requests`
- `agent_traces`
- `integration_configs`

Add later:

- `provider_capabilities`
- `lab_results`
- `campaigns`
- `mirror_imports`
- `live_sync_jobs`

## AI Architecture

Use manager + specialists:

- Router agent: chooses external vs internal.
- External agent: client workflows.
- Internal agent: staff workflows.
- Pricing/research specialist: Apify-backed research.
- Records specialist: records-transfer workflow.

Tool design:

- Tools are small and typed.
- Tools return structured JSON.
- Tools never return raw secrets.
- Tools include tenant ID.
- Tools log workflow events.
- Tools enforce approval rules.

Tracing:

- Store our own `agent_traces` row for every run.
- Keep OpenAI SDK tracing enabled in server runtime unless privacy policy says no.
- Store compact summaries in DB, not full sensitive records unless needed.

E2B usage:

- Use first for scenario/eval runs.
- Use for risky code execution or data-processing experiments.
- Do not put normal low-risk app requests through E2B unless there is a reason.

Apify usage:

- Use for public competitor research.
- Store raw snapshots separately from normalized price observations.
- Never let pricing changes auto-apply.

## Human Approval Rules

Fully automated:

- task creation,
- internal summaries,
- queue updates,
- low-risk reminders,
- mock-mode actions.

Draft + approval:

- records transfer,
- billing response,
- invoice issue,
- competitor-pricing recommendation,
- ambiguous client message,
- live provider write.

Never autonomous:

- diagnosis,
- medical treatment advice,
- silent records release,
- silent billing change,
- silent price change,
- destructive integration action.

## Acceptance Criteria

MVP is acceptable when:

- Render public app works.
- Render internal app works.
- Supabase stores tasks and workflow events.
- External agent completes booking/check-in flow in mock mode.
- External agent escalates sick-pet message safely.
- Internal agent creates daily ops summary.
- Internal agent creates records-transfer approval task.
- Apify competitor scan creates pricing-review task.
- E2B can run at least one scenario/eval.
- Frontend can demo the full path without manual DB edits.

## Questions To Answer

Need answers before freezing the plan:

- Is the tool definitely Apify?
- What are the names of the four people?
- Is Person 4 a frontend engineer or more product/design?
- Supabase auth now, or keep passcode-style MVP login?
- OpenAI Agents SDK in TypeScript inside this repo, yes/no?
- E2B eval-only for MVP, yes/no?
- Opsera required for first demo, or allowed after demo?
- Any real clinic CSV/export data available this week?

## References Checked

- OpenAI Agents SDK tracing: https://openai.github.io/openai-agents-js/guides/tracing/
- OpenAI Agents SDK guardrails: https://openai.github.io/openai-agents-js/guides/guardrails
- OpenAI Agents SDK handoffs: https://openai.github.io/openai-agents-js/guides/handoffs/
- E2B docs: https://www.e2b.dev/docs
- Apify for AI agents: https://docs.apify.com/platform/integrations/agent-onboarding
- Apify Actors: https://docs.apify.com/platform/actors
