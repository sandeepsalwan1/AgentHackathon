# VetAgent Two-Agent Tools-First Plan

Date: 2026-06-01

Status: planning doc, not implementation.

Core rule:

- External agent = clients only.
- Internal agent = admin/manager only.
- For now: exactly two ADK agents, `ExternalAgent` and `InternalAgent`; booking/email/pricing/etc. are tools/capabilities inside them, not worker agents.
- Manager auth already exists. Do not redesign auth first.
- Build the agents as real Google ADK agents with strict tool powers, verification, and a clean path to real PMS data.
- Default path, not a straitjacket: change implementation details if repo reality, tests, cost, or integration constraints prove a better route.

## What Exists Now

Current app shape:

- One deployed app: `apps/internal`.
- `_runner.ts` already decides `agent: "external"` vs `agent: "internal"`.
- Public/client workflow URLs already call the external agent through `app/api/agent/[workflow]/route.ts`:
  - `/api/agent/checkin`
  - `/api/agent/booking`
  - `/api/agent/pickup`
  - `/api/agent/records`
  - `/api/agent/followup`
  - `/api/agent/call`
  - `/api/agent/external`
- Admin/manager workflow URLs already require manager auth through `app/api/agent/[workflow]/route.ts` and call the internal agent:
  - `/api/agent/internal`
  - `/api/agent/daily-ops`
  - `/api/agent/pricing`
  - `/api/agent/invoice`
  - `/api/agent/email`
- Google ADK runtime already exists:
  - `packages/agents/src/adkRuntime.ts`
  - `packages/agents/src/adkAgents.ts`
  - `@google/adk` package
  - provenance note: `opensrc/google-adk/README.md`
- Observability already exists:
  - run id
  - trace id
  - workflow events
  - tool calls
  - run detail route

Problem to fix:

- Internal/external are separated at route/auth level, but ADK tool access is still too broad.
- Agents are not yet strong tools-first capability systems.
- Email, pricing, memory, cache, and enterprise/PMS adapter plans are not clear enough.

## Real Thing Requirement

This cannot stay a fake demo agent.

Real means:

- Real Google ADK execution when credentials exist, not route `if/else` pretending to be an agent.
- Real tool calls persisted with run id, trace id, args, result, status, duration.
- Real manager-auth boundary for internal/admin actions.
- Real public/client boundary for external actions.
- Real Postgres-backed decisions/events for actions that matter.
- Real scenario verification that proves behavior, not just HTTP 200.
- Real adapter contracts so mock data can swap to AviMark, Cornerstone, Antech, Stripe, Resend, or another PMS/integration without rewriting prompts/UI.
- Real fallback behavior when credentials/tools are missing, with an observable `runtime_fallback` event.

Mock data is allowed only as a temporary integration substitute. It is not allowed to hide missing agent behavior, missing tool boundaries, missing persistence, or missing verification.

Current routing table:

```text
booking    -> external, public
call       -> external, public
checkin    -> external, public
external   -> external, public
followup   -> external, public
pickup     -> external, public
records    -> external, public
daily-ops  -> internal, manager
internal   -> internal, manager
invoice    -> internal, manager
pricing    -> internal, manager
email      -> internal, manager, direct route today
```

Current files to work with:

- `apps/internal/app/api/agent/[workflow]/route.ts`: shared workflow route.
- `apps/internal/app/api/agent/_runner.ts`: route map, auth result, runtime, persistence.
- `apps/internal/app/api/agent/email/route.ts`: manager-only email route today.
- `packages/agents/src/adkAgents.ts`: ADK agent prompts and top-level agent creation.
- `packages/agents/src/adkRuntime.ts`: ADK runner and deterministic contract normalization.
- `packages/agents/src/adkTools.ts`: ADK `FunctionTool` wrappers.
- `packages/agents/src/tools.ts`: combined tool registry.
- `packages/agents/src/toolCore.ts`: common tool/runtime helpers.
- `packages/agents/src/toolGroups/*`: grouped tools by domain.

## Target Architecture

Now: two top-level ADK agents, no worker/sub-agent implementation yet.

```text
ExternalAgent
  audience: client
  auth: public/client session
  purpose: convert to booking, safe client operations
  capabilities implemented by prompt behavior plus scoped tools:
    booking
    records
    conversation

InternalAgent
  audience: admin/manager
  auth: existing manager auth
  purpose: admin operations, reports, email, pricing, staff decisions
  capabilities implemented by prompt behavior plus scoped tools:
    email
    pricing
    conversation
    booking/admin scheduling
    ops
    records
    labs
    invoice
```

Implement in phases:

- Phase 1: one external ADK agent and one internal ADK agent, each with hard tool allowlists.
- Phase 2: represent future workers as callable tools/capability modules, not ADK sub-agents.
- Phase 3: make those tools excellent: schemas, prompts, guardrails, decisions, scenarios, proof.
- Phase 4 later: promote high-value capability modules into ADK sub-agents only when needed.
- Phase 5 later: deploy workers separately only when scale/customer traffic proves it.

Do not add master/worker now. Do not add one global master over both agents. External and internal powers must stay separate.

Medical safety terminology:

- Medical safety is not a capability/tool the model chooses.
- It is baked into the external prompt and enforced by code before/around model execution.
- Use deterministic regex/scanning first; add a tiny classifier later only if needed.
- Existing code/tool names may still say `triage` because clinics use that word for routing urgent messages, but the product concept is "medical safety guardrail".
- User-facing copy should say "clinical team", "urgent message", or "book a visit".

## Hard Boundaries

External agent:

- Clients only.
- No manager/admin powers.
- No staff reports.
- No broad task list.
- No pricing mutation.
- No invoice mutation.
- No bulk email.
- No internal notes unless explicitly client-safe.
- No diagnosis/treatment advice.
- Main goal: book the appointment or safely route the request.

Internal agent:

- Admin/manager only.
- Uses existing manager auth.
- Can see internal operational data.
- Can prepare/administer email, pricing reports, ops reports, invoice reports, lab summaries.
- Still no medical advice.
- Still no silent destructive actions.
- Delete/change actions need higher friction than create/add actions.

Tool enforcement:

- Prompts are not enough.
- Add tool allowlists in code.
- External ADK must literally not receive internal-only tools.
- Internal ADK must receive admin tools only after manager auth has passed in `_runner.ts`.

External allowed tools:

- `lookup_client`
- `lookup_pet`
- `lookup_appointment`
- `list_slots`
- `create_booking_hold`
- `book_appointment`
- `start_arrival`
- `get_wait_status`
- `mark_arrived`
- `send_status_update`
- `capture_arrival_exception`
- `capture_booking_request`
- `send_clinic_inbox_message`
- `prepare_records_packet`
- `audit_records_transfer`
- `complete_records_transfer`
- `request_records_transfer`, only if audited and client-safe
- `find_followup_candidates`
- `send_followup_outreach`
- `check_records_guardrail`
- `record_tool_call`

External preflight/helper code, not ADK-selected tools:

- `triage_message`
- `triage_call`
- `check_medical_guardrail`
- regex/scanner over client text
- optional small classifier later
- `dispatch_clinical_triage` only after the guardrail path decides an urgent clinical handoff is needed

External denied tools:

- all staff tools: `list_tasks`, `list_approvals`, `list_reports`, `create_task`, `create_approval`, `decide_approval`, `create_agent_report`, `create_daily_ops_report`, `update_task`
- all pricing tools: `list_service_catalog`, `run_competitor_scan`, `compare_service_prices`, `create_price_review_report`
- all billing tools: `get_invoice_summary`, `review_invoice_flags`, `flag_invoice_issue`
- all lab-result tools: `list_lab_catalog`, `lookup_lab_orders`, `get_lab_result`, `summarize_lab_result`, `prepare_lab_client_update`, `create_lab_followup_task`
- all email/bulk-send tools
- all direct price/invoice/delete mutation tools

Internal allowed tools:

- staff/admin: `list_tasks`, `list_approvals`, `list_reports`, `create_task`, `create_approval`, `decide_approval`, `create_agent_report`, `create_daily_ops_report`, `update_task`
- pricing: `list_service_catalog`, `run_competitor_scan`, `compare_service_prices`, `create_price_review_report`, `check_pricing_guardrail`
- billing: `get_invoice_summary`, `review_invoice_flags`, `flag_invoice_issue`, `check_billing_guardrail`
- labs: `list_lab_catalog`, `lookup_lab_orders`, `get_lab_result`, `summarize_lab_result`, `prepare_lab_client_update`, `create_lab_followup_task`
- records: `prepare_records_packet`, `audit_records_transfer`, `complete_records_transfer`, `check_records_guardrail`
- ops/safety: use prompt rules plus deterministic medical scanner outside the LLM-selected tool list
- follow-up: `find_followup_candidates`, `list_followup_candidates`, `send_followup_outreach`, `create_followup_task`

Internal denied by default:

- direct price apply
- direct invoice mutation
- hard delete
- production/bulk email send without confirmation state

## Implementation Order

1. Lock down tool allowlists.
   - Add `externalToolNames`.
   - Add `internalToolNames`.
   - Add `sharedSafeToolNames`.
   - Change `createAdkFunctionTools(runtime)` to accept an allowlist.
   - External agent gets only client-safe tools.
   - Internal agent gets only manager/admin tools.
   - Add test/scenario that external cannot call internal tools.
   - Files:
     - `packages/agents/src/adkTools.ts`
     - `packages/agents/src/adkAgents.ts`
     - `packages/agents/src/tools.ts`
     - `packages/agents/src/toolGroups/*`

2. Rewrite agent prompts.
   - External prompt: client-only, booking-first, no vet advice, no internal data.
   - Internal prompt: admin-only, manager auth already done, clear admin workflows.
   - Add in-context examples for expected JSON/tool behavior.
   - Include current date in state/prompt.
   - Keep output concise and structured.
   - File:
     - `packages/agents/src/adkAgents.ts`

3. Add capability routing schema.
   - Intent enum per top-level agent.
   - Agent returns:
     - `capability`
     - `parsedInput`
     - `requiredMissingFields`
     - `riskLevel`
     - `cachePolicy`
     - `nextAction`
   - Route to capability/tool after parse.
   - Keep API response shape stable.
   - Files:
     - `packages/agents/src/contracts.ts`
     - new `packages/agents/src/capabilityRouting.ts`
     - `packages/agents/src/internalAgent.ts`
     - `packages/agents/src/externalAgent.ts`

Capability route decision shape:

```ts
type CapabilityRouteDecision = {
  agent: "external" | "internal";
  capability:
    | "external_booking"
    | "external_records"
    | "external_conversation"
    | "internal_email"
    | "internal_pricing"
    | "internal_conversation"
    | "internal_booking"
    | "internal_ops"
    | "internal_records"
    | "internal_labs"
    | "internal_invoice";
  parsedInput: Record<string, unknown>;
  requiredMissingFields: string[];
  riskLevel: "low" | "medium" | "high";
  cachePolicy: "none" | "short_greeting" | "short_run_context";
  nextAction: "answer" | "ask_once" | "call_tool" | "block" | "confirm";
};
```

Capability result shape:

```ts
type CapabilityResult = {
  ok: true;
  message: string;
  result: Record<string, unknown>;
  decision?: {
    kind: string;
    status: "proposed" | "confirmed" | "completed" | "blocked";
    ttl?: "short" | "long" | "permanent";
  };
  effects: AgentEffect[];
  toolCalls: ToolCallTrace[];
};
```

4. Add cache.
   - Cache only boring/repeated low-risk responses.
   - Good cache:
     - "hi"
     - repeated help/menu prompt
     - same run asking current already-loaded result
   - Bad cache:
     - appointment availability
     - booking state
     - pricing output
     - email send status
     - anything that can change quickly
   - TTL:
     - greeting/help: 3-10 minutes
     - current run summary: 1-3 minutes
     - decisions: no cache; persist instead

5. Add decision storage.
   - Store operational truth in Postgres, not LLM memory.
   - Store:
     - actor/user id
     - tenant/clinic id later
     - action
     - status
     - timestamp
     - input summary
     - result summary
     - run id / trace id
   - Long TTL / permanent audit for email, pricing approval, booking, records.
   - Short TTL for volatile recommendations/search runs.

6. Add RAG/memory after decisions are stable.
   - Use Postgres + pgvector.
   - Store stable facts, preferences, and decisions.
   - Do not store temporary emotions as durable facts.
   - Retrieval score:
     - `0.7 * vector cosine similarity + 0.3 * BM25/text score`
   - User/admin can delete or correct remembered facts.

7. Add capability modules.
   - First as TypeScript functions/tools.
   - Later, if needed, promote some capabilities to ADK sub-agents/workers.
   - Each capability gets its own allowlist, prompt notes, tests, and verification scenarios.

## Internal Agent

Audience: admin/manager.

Auth:

- Existing manager auth is required before this agent runs.
- Do not let public/client routes call this agent.

Model:

- Internal agent: cheap or medium model, depending on tool correctness.
- Pricing/email sensitive tool calls may use stronger model later if needed.
- Cost-sensitive default: use fastest/cheapest model that passes scenario proof.
- Optional later: OpenRouter adapter if needed, but do not print or expose secrets.

Agent responsibilities:

- Parse admin request.
- Pick capability/tool.
- Group questions into one message.
- Avoid endless back-and-forth.
- Decide cache policy.
- Persist final decision/event.
- Return clean admin-facing summary.

Internal capabilities:

How to read this section:

- A capability is not a worker agent right now.
- It is a named tool/capability contract inside `InternalAgent` or `ExternalAgent`.
- In code it can be a `FunctionTool`, typed helper, route-backed capability, prompt behavior, or deterministic guardrail.
- "Plan-and-execute" means the tool follows a fixed multi-step workflow with validation, action, and storage.
- "Tool loop" means the top-level ADK agent can call several allowed tools to answer or complete the request.
- Later, these same capability contracts can become worker agents without changing the UI/route contract.

### InternalEmailCapability

Tool behavior: plan-and-execute.

Purpose:

- Monthly client outreach.
- Post-appointment follow-up email.
- One-off admin-triggered email.
- Reuse the same internal email capability for chat-triggered sends, settings changes, monthly automation, and post-appointment automation.

Current repo state:

- `apps/internal/app/api/agent/email/route.ts` exists and is manager-authenticated.
- `apps/internal/app/api/notifications/monthly-agent-email/route.ts` exists for cron.
- `packages/notifications/src/index.ts` has `sendAgentExampleEmail`.
- Current cadence support is example/once/monthly shaped.
- Missing target behavior:
  - post-appointment follow-up cadence
  - template review workflow
  - email settings tab with two toggles
  - durable email decision records
  - audience sizing and confirmation
  - analytics consumer/reporting path

Required confirmation in one message:

- send mode: disabled/test/production
- audience/recipient count
- subject
- template/body reviewed
- cadence: once/monthly/post-appointment
- schedule/frequency
- explicit confirmation before production/bulk send
- Do not ask these one-by-one. Group all missing questions into one admin message.

Plan-and-execute steps:

1. Parse admin intent.
   - one-off send
   - monthly outreach setting
   - post-appointment follow-up setting
   - edit/review template
   - check whether a send happened
2. Show current settings in one response.
   - mode
   - enabled/disabled
   - cadence
   - audience
   - template link
   - recipient estimate
   - last send / next scheduled send
3. Require review before risky action.
   - admin must open/review the email template page or explicitly mark template reviewed
   - production/bulk sends need explicit confirmation
4. Execute action through backend sender/scheduler.
   - update setting
   - create scheduled job/cron decision
   - send test/production email
   - skip safely if disabled
5. Store decision.
   - actor id/name/role
   - timestamp/current date
   - cadence
   - audience
   - template id/version
   - send mode
   - recipient count
   - run id/trace id
   - status: proposed/confirmed/sent/skipped/failed
6. Answer admin with a short status.
   - "sent"
   - "scheduled"
   - "disabled"
   - "needs template review"
   - "already sent this period"

UI touch:

- Add/keep admin email tab.
- Defaults off.
- Email template edit/review link.
- Two toggles:
  - monthly outreach
  - post-appointment follow-up
- Post-appointment default: 7 days, editable.
- Monthly template and post-appointment template are separate.
- Admin can change settings from chat, but the same confirmation/review rules apply.
- The UI should not make the user hunt through chat history to verify a template; the template page/status is the source of truth.

Monthly outreach target:

- Default off.
- Friendly client relationship email, not aggressive sales.
- Audience default: all reachable customers/clients.
- "Reachable" means usable email/portal contact and not opted out.
- Audience can later become configurable, but default should not be only recent/active clients unless deliverability/legal settings require it.
- Idempotency key: clinic + cadence + month + template version.
- Repeated monthly cron should duplicate-skip.

Post-appointment follow-up target:

- Default off.
- Default delay: 7 days after completed appointment.
- Admin can edit delay in UI or chat.
- Trigger source now: appointment-completed event/decision in Postgres.
- Trigger source later: PMS event from AviMark/Cornerstone.
- Idempotency key: clinic + appointment id + cadence + delay + template version.

Storage:

- Store decision for about 1 year or permanent audit.
- Store run id, actor, mode, recipients/audience, cadence, template id, timestamp.
- Store enough structured fields that admin can later ask "did we send this?" without relying on LLM memory.

Queue path:

- Now: Render cron / Postgres idempotency.
- Later: Postgres job queue.
- Later event shape:
  - `appointment.completed`
  - `email.campaign_due`
  - `email.sent`
  - `email.skipped`
  - `email.failed`
- Later consumers:
  - email sender
  - analytics/revenue reporting
  - audit/report writer
- Much later: Kafka/PubSub only if volume or separate services require it.

Implementation specifics:

- Current direct route: `apps/internal/app/api/agent/email/route.ts`.
- Keep route manager-authenticated.
- Add an internal email tool/capability later, but never expose it to external ADK.
- Suggested tool names:
  - `prepare_email_campaign`
  - `validate_email_campaign_confirmation`
  - `send_agent_email`
  - `schedule_agent_email`
- Required confirmation object:

```ts
type EmailConfirmation = {
  mode: "disabled" | "test" | "production";
  cadence: "once" | "monthly" | "post_appointment";
  audience: "explicit_recipients" | "all_active_clients" | "recent_clients" | "recent_appointments";
  recipientCount: number;
  subject: string;
  templateId: string;
  templateVersion: string;
  templateReviewed: boolean;
  reviewedByActorId: string;
  sendNow: boolean;
  scheduledFor?: string;
  postAppointmentDelayDays?: number;
};
```

Block send when:

- `templateReviewed` is false.
- `mode` is `production` and confirmation is missing.
- `recipientCount` is unexpectedly high.
- actor is missing manager auth.
- requested audience does not match selected cadence.
- duplicate idempotency key already sent.

### InternalPricingCapability

Tool behavior: plan-and-execute with careful reasoning.

Purpose:

- Compare clinic prices to nearby businesses.
- Use Apify/live scraper when configured.
- Use sample data fallback when live tool missing.
- Recommend price changes.
- Eventually apply approved/auto price changes through PMS adapter.

Current default:

- Recommendation/report only.
- Do not mutate prices automatically yet.

What this tool/capability does:

1. Read current service catalog.
2. Read current pricing scan settings.
3. Run competitor scan when requested and rate-limit allows.
4. Compare clinic prices against competitor observations.
5. Produce recommendations with confidence/reasons.
6. Store recommendation and admin decision.
7. Create report for admin review.
8. Never apply price changes unless future auto-mode contract is explicitly enabled.

Admin UX:

- Pricing tab.
- Show current settings:
  - location
  - competitors/search terms
  - services
  - rate limit status
  - auto mode off by default
- Let admin ask in chat to change settings.
- Put settings/questions in one message.
- Rate limit roughly 10 scans / 5 minutes per tenant/admin to avoid spam.

Future auto mode:

- Explicit "are you sure" toggle.
- Max change caps.
- Approval/audit trail.
- Rollback plan.
- PMS adapter supports apply/rollback.
- Not always lower; optimize by business logic.

Storage:

- Store pricing recommendations.
- Store admin approval/rejection.
- Store short-lived competitor scan result.
- Store durable pricing decisions/audit.

Implementation specifics:

- Current route: `/api/agent/pricing`.
- Current tools:
  - `list_service_catalog`
  - `run_competitor_scan`
  - `compare_service_prices`
  - `create_price_review_report`
- Proposed recommendation shape:

```ts
type PricingRecommendation = {
  serviceId: string;
  serviceName: string;
  currentPriceCents: number;
  competitorLowCents?: number | null;
  competitorMedianCents?: number | null;
  competitorHighCents?: number | null;
  proposedPriceCents?: number | null;
  confidence: "low" | "medium" | "high";
  reason: string;
  action: "keep" | "raise" | "lower" | "manual_review";
};
```

Auto mode blockers:

- no PMS pricing adapter
- no max-change config
- no rollback path
- low confidence
- missing manager confirmation
- report produced from stale scan

### InternalConversationCapability

Tool behavior: tool loop + memory retrieval.

Purpose:

- General admin chat over clinic operations.
- Retrieve previous decisions and stable admin preferences.
- Keep answer simple.

What it does:

1. Read admin message.
2. Retrieve relevant structured decisions/runs/reports.
3. Later retrieve durable memory with hybrid vector + BM25.
4. Answer concisely or route to another internal capability.
5. Store only durable facts/preferences when useful.

Memory:

- Retrieve by user/admin id.
- Hybrid retrieval: vector + BM25.
- Store concise stable facts only.
- Let admin correct/delete memories.

### InternalBookingCapability

Tool behavior: plan-and-execute.

Purpose:

- Admin can add/change/delete appointments.
- No client payment/hold.
- Adding is easy.
- Changing/deleting has higher confirmation friction.

What it does:

1. Parse appointment action: add, change, cancel/archive.
2. Collect client, pet, date/time, reason, actor, and reason for change.
3. For add: list/open slot and create appointment.
4. For change/delete: require confirmation and prefer cancel/archive over hard delete.
5. Persist actor, old value, new value, run id, and timestamp.

Guardrails:

- Record actor and reason.
- Warn admin when client should use external flow/login instead.
- Deleting is hard; prefer cancel/archive.

### InternalOpsCapability

Tool behavior: tool loop.

Purpose:

- Daily ops.
- Task ranking.
- Report summaries.
- Staff work prioritization.

What it does:

1. List tasks, approvals, reports, follow-ups.
2. Rank what needs attention today.
3. Explain why, briefly.
4. Create/update daily ops report.
5. Return a staff/admin summary.

### InternalRecordsCapability

Tool behavior: plan-and-execute.

Purpose:

- Internal records/admin workflow.
- Audit every transfer.
- Keep provenance.

What it does:

1. Verify client/pet/destination.
2. Prepare records packet metadata.
3. Run records audit.
4. Submit transfer through mock/adapter path.
5. Persist audit and transfer event.

### InternalLabsCapability

Tool behavior: tool loop.

Purpose:

- Antech-shaped mock now.
- Future Antech/Cornerstone/AviMark adapter.
- Summarize status/metadata safely.
- No diagnosis/treatment advice.

What it does:

1. Find lab order/result by pet/client/status.
2. Read lab metadata and abnormal-flag status.
3. Summarize safely for staff.
4. Prepare client-update state only when safe.
5. Never provide diagnosis/treatment advice.

### InternalInvoiceCapability

Tool behavior: plan-and-execute.

Purpose:

- Invoice audit/report.
- No direct invoice mutation until adapter/approval contract exists.

What it does:

1. Read invoice summary/flags.
2. Detect requested mutation and block it.
3. Create invoice audit report.
4. Persist report/run/tool calls.
5. Return what staff should review next.

## External Agent

Audience: clients only.

Auth/session:

- Client-safe session only.
- Eventually logged-in client id.
- Never manager/admin powers.

Model:

- External agent: cheap/medium.
- Booking capability: reliable plan-and-execute behavior through tools.
- Conversation capability: low-cost tool loop with strong guardrails.

Agent responsibilities:

- Parse client request.
- Apply external guardrails first.
- Pick capability/tool.
- Retrieve client-safe facts only.
- Keep user moving toward booking or safe routing.
- Persist decisions/events.

External capabilities:

### ExternalBookingCapability

Tool behavior: plan-and-execute.

Purpose:

- Main revenue path.
- Book appointments from client chat/mobile web.

Flow:

1. Collect required fields:
   - client identity
   - pet
   - reason for visit
   - preferred date/time/time of day
2. Use stored client/pet facts when available.
3. Ask missing fields in one message first.
4. After enough info, list real/open slots.
5. Confirm selected slot.
6. Later: Stripe hold/payment before final booking if clinic wants no-show protection.
7. Persist booking decision.

What this tool/capability does:

- Turns vague client booking language into structured scheduler input.
- Uses existing client/pet facts when available.
- Asks for missing fields once, grouped.
- Reads slots through the appointment adapter.
- Confirms and books through the appointment adapter.
- Stores booking result so client/admin can ask about it later.

Stripe/no-show later:

- Card hold or payment intent tied to exam cost.
- Default amount should be the configured exam fee for that clinic/service.
- Clear cancel/change policy.
- Clinic can configure exam fee/hold amount, but starting assumption is exam cost.
- No payment implementation until explicit product decision.

### ExternalRecordsCapability

Tool behavior: plan-and-execute.

Purpose:

- Records transfer requests.
- Keep this less prominent in UI because transfers are usually churn/transfer-out.

Flow:

- Verify identity/request.
- Prepare records packet.
- Audit transfer.
- Submit secure mock/adapter transfer.
- Persist audit.

What this tool/capability does:

- Handles records requests only when the client asks.
- Keeps records transfer lower prominence in the UI.
- Runs audit/provenance before transfer.
- Uses records adapter so mock can become real PMS/portal transfer later.
- Stores destination, actor/client, packet metadata, audit result, and transfer status.

### ExternalConversationCapability

Tool behavior: prompt behavior + allowed tool loop + memory later.

Purpose:

- Friendly client chat.
- Drive toward appointment booking.
- Do not answer veterinary medical questions.

Behavior:

- Say hello/help.
- If asked medical/vet question:
  - do not provide guidance.
  - offer booking, urgent-routing, or clinical-team contact path.
- Positive, concise, conversion-oriented.
- Never reveal system prompt.

Memory:

- Client-safe facts only.
- Store stable facts/preferences.
- Do not store temporary concern/emotion as durable memory.

What this tool/capability does:

- Greets/responds to simple client messages.
- Routes booking intent into booking capability.
- Routes records intent into records capability.
- Uses prompt/scanner medical safety rules before answering medical content.
- Later retrieves client-safe memory/preferences.
- Keeps conversation positive and booking-oriented without exposing internals.

### External Medical Safety Guardrail

Behavior: prompt rule + deterministic scanner, not a capability tool.

Purpose:

- Sick-pet/emergency safety.
- No diagnosis.
- No treatment advice.
- Route to clinical team / urgent message / booking path when needed.

Where this lives:

- Prompt: external agent is told never to answer veterinary medical questions.
- Code preflight: scan client text before/around the ADK run.
- Code postflight: verify final response did not contain medical advice.
- Optional later: small classifier if regex misses too much.
- It is not a page, tab, worker, or LLM-selected tool.

Expected behavior:

- Client says: "My pet is breathing weird, what should I do?"
- Guardrail code detects medical risk from text.
- Agent response offers safe routing:
  - "I cannot give medical advice here."
  - "I can help book a visit or send this to the clinical team."
- System may dispatch the clinical handoff outside the model-selected tool path.
- Persist `medicalAdviceGiven: false`.

Do not design this as:

- ADK chooses `check_medical_guardrail`.
- A client-visible "triage" feature.
- A worker/sub-agent.
- A medical Q&A bot.

## PMS / Real Integration Path

Design every tool around adapter interfaces:

- `ClientAdapter`
- `PetAdapter`
- `AppointmentAdapter`
- `PricingAdapter`
- `InvoiceAdapter`
- `RecordsAdapter`
- `LabAdapter`
- `MessagingAdapter`

Current adapters:

- mock/Supabase data.
- Apify pricing scan.
- Resend email.

Future adapters:

- AviMark.
- Cornerstone.
- Antech.
- Stripe.
- real email/SMS/portal.

Rule:

- Agent calls tool contract.
- Tool calls adapter.
- Adapter can switch mock -> real without changing prompts/routes/UI.

## Enterprise / Slack-Style Tenant Plan

Target style:

- one product
- many businesses/clinics
- each clinic can have multiple users
- eventually custom subdomain or custom domain

Data requirements:

- Add `tenant_id`/`clinic_id` everywhere before real multi-tenant launch:
  - runs
  - tool calls
  - workflow events
  - clients
  - pets
  - appointments
  - reports
  - decisions
  - memory
  - settings
- Every tool runtime must be tenant-scoped.
- No cross-tenant retrieval.

URL path:

- now: one app.
- later:
  - `clinic.vetagent...`
  - custom domains if needed.

Scale path:

- now: Next app + Supabase/Postgres.
- next: separate API service and background worker.
- later: ECS/Cloud Run worker pools.
- later: separate pools for pricing/email/booking if needed.
- do not add Kafka until Postgres jobs/cron are insufficient.

## UI Scope

Do minimal UI only.

Allowed:

- agent console clarity.
- mobile-friendly admin chat.
- pricing tab/toggle.
- email tab/toggles.
- template review link.
- proof/readable run detail.

Avoid:

- redesigning whole app.
- big visual changes.
- landing-page work.
- new design system.
- UI that does not match the existing app.

Style rule:

- Do very little UI.
- Add only what is needed to review/confirm risky actions.
- Match existing app components, density, spacing, and interaction style.
- Prefer current routes/components over introducing a new UI pattern.

## Required UI Surfaces

Keep UI work small, but these surfaces matter because they are the control plane for risky agent actions.

Internal/admin:

- Agent chat.
  - Mobile-friendly.
  - Manager-auth only.
  - Lets admin ask for email/pricing/ops/booking help.
  - Should show current settings when relevant instead of hiding state in chat.
- Email settings/sendout tab.
  - Default off.
  - Two toggles:
    - monthly outreach
    - post-appointment follow-up
  - Separate template for monthly outreach.
  - Separate template for post-appointment follow-up.
  - Template review link/button.
  - Post-appointment delay control, default 7 days.
  - Mode selector: disabled/test/production.
  - Recipient/audience estimate before send.
  - Last send / next scheduled send.
  - Confirmation state: not reviewed / reviewed / confirmed / sent / skipped / failed.
- Pricing / competitor tab.
  - Shows current clinic services/prices.
  - Shows competitor scan settings:
    - location
    - competitor/search terms
    - rate limit status
    - last scan time
  - Runs scan/report.
  - Shows recommended price changes.
  - Auto mode toggle default off.
  - "Are you sure?" confirmation before auto mode.
  - No automatic price mutation until PMS adapter, caps, audit, and rollback exist.
- Decisions/audit surface.
  - Shows important agent decisions by actor/date/run.
  - Lets admin answer "did we send it?", "did we approve this?", "what changed?"
  - Links to run detail, workflow events, and tool calls.
- Memory/preferences surface, later.
  - Shows durable remembered facts/preferences.
  - Lets admin/client correct or delete memory.

External/client:

- Booking-first chat/page.
  - Main visible goal is appointment booking.
  - Ask missing booking fields in one grouped message first.
  - After booking intent is clear, multi-turn conversation is okay because it improves conversion.
- Records transfer entry should be lower prominence/hidden-ish.
  - Still available when requested.
  - Not promoted as a primary CTA.
- Medical questions are handled by prompt/scanner safety, not a visible medical advice feature.

## Google ADK / Open Source Reference

Use:

- `@google/adk`
- `LlmAgent`
- `FunctionTool`
- `InMemoryRunner`
- typed Zod schemas for tools
- ADK events mirrored to our run/tool/event tables

Repo reference:

- `opensrc/google-adk/README.md`
- package source: `https://github.com/google/adk-js`
- license: Apache-2.0
- checked local version: `1.1.0`

Keep:

- deterministic contract normalization until evals are strong.
- stable JSON API for UI.
- fallback only for missing creds or external-tool failure.

## Verification Plan

Every implementation phase must prove:

- TypeScript compiles.
- lint passes.
- route contracts unchanged.
- internal and external boundaries enforced.
- ADK actually executed when Google creds exist.
- fallback is observable when creds/tools missing.

Commands:

- `npm run typecheck`
- `npm run lint`
- start app: `npm run dev`
- fallback proof: `npm run verify:agents`
- Google ADK proof: `AGENT_RUNTIME=google-adk npm run verify:agents:google`
- semantic scenarios: `npm run scenarios:local`
- email smoke: `npm run smoke:agent-email -- --base-url http://localhost:3000`

Add/keep scenario checks:

- External booking can book matched client/pet.
- External medical question does not answer medical advice; prompt/scanner routes to safe clinical handoff or booking.
- External route cannot call pricing/email/task-report tools.
- Internal route requires manager auth.
- Internal pricing creates report/recommendation and no price mutation by default.
- Internal email cannot production/bulk-send without explicit confirmation/review.
- Internal booking change/delete needs confirmation and records actor.
- Records transfer creates audit event.
- Run detail contains:
  - run id
  - trace id
  - agent kind
  - mode
  - model
  - workflow events
  - tool calls
  - linked report/task/decision ids

Proof doc:

- Append verification output to `docs/proof/mainCompleteAllAgents-proof.md`.
- Include exact command, date, branch, commit, env presence only, no secret values.

## Concrete Build Checklist

Phase 1: boundary hardening

- Add ADK tool allowlists.
- Split external/internal prompt examples.
- Add boundary scenarios.
- Run typecheck/lint/scenarios.

Phase 2: internal agent + capabilities

- Add internal capability routing schema.
- Add email capability plan/confirm path.
- Add pricing capability recommendation storage.
- Add ops/labs/invoice as named capabilities/tools.
- Verify manager auth remains the only entry.

Phase 3: external agent + capabilities

- Add external capability routing schema.
- Add booking capability flow.
- Add external conversation guardrail.
- Add records capability and medical-safety prompt/scanner.
- Verify no internal tool access.

Phase 4: decisions + memory

- Add decisions table/helper if not enough current run/events.
- Add pgvector memory table.
- Add hybrid retrieval.
- Add memory delete/correct path.

Phase 5: real integration readiness

- Define adapter interfaces.
- Map mock data to PMS-like contracts.
- Add AviMark/Cornerstone/Antech adapter stubs.
- Keep tools stable.

Phase 6: enterprise readiness

- Add tenant id design/migration plan.
- Scope runtime by tenant.
- Add rate limits by tenant/admin/client.
- Add background job strategy.

## Non-Negotiables

- External = clients only.
- Internal = admin/manager only.
- Existing manager auth stays.
- Tool allowlists enforce powers.
- Master/worker is later; for now, capabilities/tools live inside each top-level agent.
- Google ADK must be real and verified.
- Mock data can stand in for missing integrations, but agent execution, tool boundaries, persistence, and proof must be real.
- No medical advice.
- No silent price/invoice/delete mutation.
- Email and pricing need explicit review/confirmation before risky actions.
- Real PMS integration should swap adapters, not rewrite agents.
