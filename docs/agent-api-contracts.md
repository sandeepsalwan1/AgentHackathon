# VetAgent Agent API Contracts

Date: 2026-05-31

All routes live in the unified `apps/internal` app.

## Shared response

Agent workflow routes return:

- `ok`: boolean
- `mode`: `mock`, `google-adk`, `apify`, or future runtime
- `intent`: workflow intent
- `message`: user-facing or staff-facing summary
- `result`: structured workflow data
- `task`: task created only for explicit task-board workflows
- `approval`: legacy approval shape, not used by current no-HITL agent flows
- `report`: report created when relevant
- `workflowEvents`: timeline events
- `toolCalls`: redacted tool-call traces
- `runId`: persisted agent run id
- `traceId`: trace id also returned as `x-vetagent-trace-id`
- `durationMs`: server-side workflow duration

## Public routes

Agent workflow URLs below are implemented by `apps/internal/app/api/agent/[workflow]/route.ts`; static URL contracts stay unchanged.

- `POST /api/agent/checkin`: client arrival/check-in.
- `POST /api/agent/booking`: booking request and mock slots.
- `POST /api/agent/pickup`: pickup/status request.
- `POST /api/agent/records`: audited mock records transfer; no approval.
- `POST /api/agent/followup`: mock portal outreach.
- `POST /api/agent/call`: transcript triage to direct mock integration.
- `POST /api/agent/external`: generic external-agent router.
- `POST /api/requests`: legacy public request form; creates a task.
- Request-form UI uses `@central-vet/request-form`, shared by the internal app and legacy/reference request app.
- Request-form guard, validation, duplicate detection, and task creation use `@central-vet/request-intake`, shared by the internal app and legacy/reference request app.
- `GET /api/mock/clinic`: mock clients, pets, appointments, slots, followups, invoices, messages, calls, services, pricing observations, and Antech-shaped mock lab data.

Example public payload:

```json
{
  "clientName": "Maya Parker",
  "clientPhone": "(415) 555-0134",
  "petName": "Biscuit",
  "message": "I'm outside for my appointment."
}
```

## Internal routes

Internal routes require the existing actor payload and passcode rules:

```json
{
  "actor": {
    "name": "Admin",
    "role": "admin",
    "passcode": "not-committed"
  },
  "message": "Summarize what front desk should do next."
}
```

- `POST /api/agent/internal`: generic internal-agent router.
- `POST /api/agent/daily-ops`: daily ops digest.
- `POST /api/agent/pricing`: pricing report; uses Apify only when configured and requested with `live: true`.
- `POST /api/agent/invoice`: invoice audit report.
- `GET /api/agent/runs/[id]`: run, workflow events, tool calls, approvals, reports, and linked task/report/approval ids.
- `GET /api/approvals?role=admin&name=...`: pending approvals.
- `PATCH /api/approvals/[id]`: approve/reject.
- `GET /api/reports/pricing`: pricing reports.
- `GET /api/reports/invoices`: invoice reports.
- `GET /api/reports/followups`: follow-up reports and open followups.

## Safety behavior

- Sick-pet messages dispatch a mock clinical triage alert; no diagnosis.
- Records transfer creates a local `local_records_policy` audit and submits a mock secure transfer; no HITL approval.
- Invoice review creates a report; no invoice mutation.
- Pricing review creates a report; no repricing.
- Google ADK/E2B/Apify are optional live tools. Deterministic mock behavior keeps demo routes working without live tools. Google ADK TypeScript is the target live agent runtime behind `AGENT_RUNTIME=google-adk`; use `GEMINI_API_KEY` or `GOOGLE_API_KEY` for Gemini, or Vertex env for Google Cloud. The app reads `APIFY_API_TOKEN`; the Apify CLI skill reads `APIFY_TOKEN`.
- Internal lab review uses mock `antech_mock` catalog/orders/results, prepares a safe client-update state, holds abnormal results from delivery, and never discloses medical advice automatically.

## Scenario Proof

- `npm run smoke:local`: fast local health and speed proof for demo routes.
- `npm run scenarios:local`: semantic scenario harness against local routes.
- `npm run verify:agents`: fallback-safe proof appender; expects a reachable app.
- `npm run verify:agents:google`: requires Google credentials and an app started with `AGENT_RUNTIME=google-adk`.
- `npm run smoke:e2b`: E2B credential/sandbox smoke.
- `npm run scenarios:e2b`: E2B scenario harness for public `SCENARIO_BASE_URL`; localhost falls back to local after E2B readiness.
