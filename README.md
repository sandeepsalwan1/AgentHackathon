# VetAgent / Central Veterinary Hospital MVP

https://vetagent-internal.onrender.com

One deployed Render app in an npm workspace monorepo, backed by Supabase Postgres.

- `apps/internal`: unified public client flows, staff task board, and agent APIs.
- `apps/client-request`: legacy/reference public request source; covered by root lint/typecheck, not deployed.
- `packages/agents`: agent runtimes, tool registry, and domain tool groups.
- `packages/db`: Postgres schema and server helpers.
- `packages/notifications`: Resend email and email-to-SMS notification helpers.
- `packages/request-form`: shared public request form UI used by both request surfaces.
- `packages/request-intake`: shared public request guard, validation, dedupe, and task creation.

Local commands:

- `npm install`
- `cp .env.example .env.local` and fill Supabase `DATABASE_URL`
- `npm run db:migrate`
- `npm run dev`
- `npm run lint`, `npm run typecheck`, `npm run lint:dead`, and `npm run lint:duplicates` for source health checks. Duplication ignores append-only DB migrations.
- `npm run smoke:local` while the dev server is running to verify local pages, core agent routes, and response-time budgets.
- `npm run smoke:agent-email -- --base-url http://localhost:3000` while the app is running to verify monthly email idempotency through `/api/agent/email` without sending live email.
- `npm run scenarios:local` while the dev server is running to exercise semantic agent scenarios against local routes.
- `npm run verify:agents` while a local server is running to append fallback-safe proof to `docs/proof/mainCompleteAllAgents-proof.md`.
- `npm run verify:agents:google` while a server started with `AGENT_RUNTIME=google-adk` is running to require live Google ADK credentials and proof.
- `npm run smoke:e2b` to verify the configured E2B key can start a sandbox.
- `npm run scenarios:e2b` to run the scenario harness through E2B when `SCENARIO_BASE_URL` is a public URL; localhost falls back to local scenarios after an E2B readiness check.

Demo accounts:

- Pet owner: `maya@example.com` / `demo1234` (Maya Parker + Biscuit; check-in matches seeded appointment data)
- Staff: `staff@centralvet.demo` / `staff1234`
- Veterinarian: `vet@centralvet.demo` / `vet1234` or direct board passcode `135790`
- Admin: `admin@centralvet.demo` / `admin1234` or direct board passcode `246810`
- Disable built-in demo passcodes with `DEMO_ACCOUNTS=disabled`.

Agent runtime:

- Demo-safe default: `AGENT_RUNTIME=mock`.
- Target live runtime: Google Agent Development Kit for TypeScript (`AGENT_RUNTIME=google-adk`).
- Open-source ADK package: `@google/adk` in the agents workspace, from `google/adk-js` under Apache-2.0. Provenance lives in `opensrc/google-adk/`.
- Google ADK env: `GEMINI_API_KEY` or `GOOGLE_API_KEY`; for Vertex, also configure `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION`.
- Missing Google credentials with `AGENT_RUNTIME=google-adk` falls back to the shared registry and records a `runtime_fallback` event.
- Agent responses include `runId`, `traceId`, `durationMs`, `workflowEvents`, and redacted `toolCalls`; `GET /api/agent/runs/[id]` returns persisted run detail and linked effects.
- Agent routes are no-HITL for the normal demo path: check-in marks arrival, booking reserves mock slots, records submits an audited mock transfer, pickup/follow-up send mock portal updates, and invoice/pricing/lab routes produce reports or safe update state instead of creating pending-review tasks.
- Staff agent email quick action posts to `/api/agent/email`; default mode is `test`, sender falls back to `Central Veterinary Hospital <notifications@eepish.com>`, and test sends go to `TEST_NOTIFICATION_EMAIL`. Explicit prompt recipients are honored for disabled proofs and production sends. Monthly sends use cadence `monthly` and a `YYYY-MM` idempotency key, so repeated calls in the same month duplicate-skip instead of sending twice.
- E2B is for sandboxed proof/evals, not the normal check-in/booking request path.

Render + Supabase:

- Create a Supabase project and use its Postgres connection string as `DATABASE_URL`.
- Create one Render web service from `render.yaml`: `vetagent-internal`.
- Add env vars: `DATABASE_URL`, `HOSPITAL_NAME`, `APP_TIME_ZONE`, `MOCK_MODE`, `AGENT_RUNTIME`, `GEMINI_API_KEY` or `GOOGLE_API_KEY`, `E2B_API_KEY`, `APIFY_API_TOKEN`, optional `APIFY_TOKEN` for Apify CLI skills, optional `APIFY_PRICING_ACTOR_ID`.
- Add notification env vars and `CRON_SECRET`.
- Internal passcodes: VA and Admin env passcodes plus doctor profile passcodes from Admin settings.
- VA/Admin passcodes must be configured with `VET_ADMIN_PASSCODE` and `VET_APP_ADMIN_PASSCODE`.
- Veterinarian profile passcodes are configured in Admin settings after deployment.
- Keep `NOTIFICATION_MODE=disabled` until real sends are approved. Use a test-only carrier gateway address in `TEST_SMS_NOTIFICATION_RECIPIENTS` for smoke tests.
- Veterinarian passcodes and delivery preferences live in Admin settings. Email and SMS channels are separate from escalation and daily medium/high alert opt-ins, and profiles start opted out until explicitly enabled.
- Internal overdue summary runs as the `vetagent-overdue-summary` Render cron job.
- Monthly agent email runs as the `vetagent-monthly-agent-email` Render cron job on the first day of each month at `15 17 1 * *` UTC. It calls `GET /api/notifications/monthly-agent-email` with `Authorization: Bearer $CRON_SECRET`; configure `MONTHLY_AGENT_EMAIL_MODE`, optional `MONTHLY_AGENT_EMAIL_RECIPIENTS`, `MONTHLY_AGENT_EMAIL_SUBJECT`, and `MONTHLY_AGENT_EMAIL_MESSAGE`.

Main routes:

- `/arrival`, `/booking`, `/pickup`, `/records`, `/followup`, `/call`, `/request`
- `/staff`, `/staff/agent`, `/staff/approvals`
- `/api/mock/clinic`, `/api/agent/*`, `/api/approvals`, `/api/reports/*`
