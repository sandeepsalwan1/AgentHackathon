# VetAgent / Central Veterinary Hospital MVP

https://vetagent-internal.onrender.com

One Render app in one npm workspace, backed by Supabase Postgres.

- `apps/internal`: unified public client flows, staff task board, and agent APIs.
- `apps/client-request`: legacy/reference public request source; not deployed or part of root scripts.
- `packages/db`: Postgres schema and server helpers.
- `packages/notifications`: Resend email and email-to-SMS notification helpers.

Local commands:

- `npm install`
- `cp .env.example .env.local` and fill Supabase `DATABASE_URL`
- `npm run db:migrate`
- `npm run dev`
- `npm run smoke:local` while the dev server is running to verify local pages, core agent routes, and response-time budgets.
- `npm run scenarios:local` while the dev server is running to exercise the Person 3 scenario set against local routes.
- `npm run smoke:e2b` to verify the configured E2B key can start a sandbox.
- `npm run scenarios:e2b` to run the scenario harness through E2B when `SCENARIO_BASE_URL` is a public URL; localhost falls back to local scenarios after an E2B readiness check.

Agent runtime:

- Demo-safe default: `AGENT_RUNTIME=mock`.
- Target live runtime: Google Agent Development Kit for TypeScript (`AGENT_RUNTIME=google-adk`).
- Open-source ADK package: `@google/adk` in the agents workspace, from `google/adk-js` under Apache-2.0.
- Google ADK env: `GEMINI_API_KEY` or `GOOGLE_API_KEY`; for Vertex, also configure `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION`.
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

Main routes:

- `/arrival`, `/booking`, `/pickup`, `/records`, `/followup`, `/call`, `/request`
- `/staff`, `/staff/agent`, `/staff/approvals`
- `/api/mock/clinic`, `/api/agent/*`, `/api/approvals`, `/api/reports/*`
