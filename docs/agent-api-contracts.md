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
- `task`: task created when relevant
- `approval`: approval created when relevant
- `report`: report created when relevant
- `workflowEvents`: timeline events
- `runId`: persisted agent run id

## Public routes

- `POST /api/agent/checkin`: client arrival/check-in.
- `POST /api/agent/booking`: booking request and mock slots.
- `POST /api/agent/pickup`: pickup/status request.
- `POST /api/agent/records`: records-transfer request; creates approval.
- `POST /api/agent/followup`: follow-up response; creates task.
- `POST /api/agent/call`: transcript to task/approval.
- `POST /api/agent/external`: generic external-agent router.
- `POST /api/requests`: legacy public request form; creates a task.
- `GET /api/mock/clinic`: mock clients, pets, appointments, slots, followups, invoices, messages, calls, services, pricing observations.

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
- `POST /api/agent/pricing`: pricing report/task; uses Apify only when configured and requested with `live: true`.
- `POST /api/agent/invoice`: invoice review report/task.
- `GET /api/agent/runs/[id]`: run and timeline.
- `GET /api/approvals?role=admin&name=...`: pending approvals.
- `PATCH /api/approvals/[id]`: approve/reject.
- `GET /api/reports/pricing`: pricing reports.
- `GET /api/reports/invoices`: invoice reports.
- `GET /api/reports/followups`: follow-up reports and open followups.

## Safety behavior

- Sick-pet messages create urgent tasks; no diagnosis.
- Records transfer creates approval; no silent send.
- Invoice review creates report/task; no invoice mutation.
- Pricing review creates report/task; no repricing.
- Google ADK/E2B/Apify are optional live tools. Deterministic mock behavior keeps demo routes working without live tools. Google ADK TypeScript is the target live agent runtime behind `AGENT_RUNTIME=google-adk`; use `GEMINI_API_KEY` or `GOOGLE_API_KEY` for Gemini, or Vertex env for Google Cloud. The app reads `APIFY_API_TOKEN`; the Apify CLI skill reads `APIFY_TOKEN`.

## Scenario Proof

- `npm run smoke:local`: fast local health and speed proof for demo routes.
- `npm run scenarios:local`: Person 3 scenario harness against local routes.
- `npm run smoke:e2b`: E2B credential/sandbox smoke.
- `npm run scenarios:e2b`: E2B scenario harness for public `SCENARIO_BASE_URL`; localhost falls back to local after E2B readiness.
