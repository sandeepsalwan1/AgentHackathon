# Deployment and Infrastructure

Date: 2026-05-31
Last updated: 2026-06-08

Current setup:

- Deploy on Render, not Vercel.
- Database on Supabase Postgres, not Neon.
- Keep passcode auth. Do not add Supabase Auth for this sprint.
- Use one unified web app: `apps/internal`.
- Use `DATABASE_URL` for app DB access. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are reserved for realtime/storage/agent work.

Supabase setup:

- Org discovered through MCP: `sandeepsalwan1's Org` (`dflgitlurgfmnexbdpqg`).
- Project: `VetTech` (`xydoircvankwomaqaxcw`).
- Region: `us-east-1`.
- API URL: `https://xydoircvankwomaqaxcw.supabase.co`.
- Runtime DB env: `DATABASE_URL`.
- Render-compatible pooler host: `aws-1-us-east-1.pooler.supabase.com`.
- Pooler username: `postgres.xydoircvankwomaqaxcw`.
- The repo disables prepared statements for Supabase transaction-pooler compatibility.
- Migrations `001` through `022` are expected; `021_agent_observability.sql` adds run trace/tool-call observability and mock lab tables, and `022_multi_clinic_tenants.sql` adds clinic/domain tenancy.

Render setup:

- Blueprint: `render.yaml`.
- Project: `Main1` (`prj-d8e98bmk1jcs739ogq20`).
- Environment: `evm-d8e98bmk1jcs739ogq2g`.
- Services:
  - `vetagent-internal` (`srv-d8e9c019rddc73el6i5g`): `https://vetagent-internal.onrender.com`
  - `vetagent-overdue-summary`: cron job defined in `render.yaml`.
  - `vetagent-monthly-agent-email`: cron job defined in `render.yaml`.
  - Legacy `vetagent-client` was deleted from Render on 2026-05-31.
- Internal build: `npm ci && npm run build --workspace @central-vet/internal`
- Internal start: `npm run start --workspace @central-vet/internal -- -p $PORT`
- Render MCP currently has no workspace selected; service creation was done through the Render REST API using the configured `RENDER_API_KEY`.

Required Render env:

- Web service: `DATABASE_URL`, `HOSPITAL_NAME`, `APP_TIME_ZONE`, `MOCK_MODE`, `AGENT_RUNTIME`.
- Agent runtime env: `GEMINI_API_KEY` or `GOOGLE_API_KEY` for Google ADK TypeScript. For Vertex-backed ADK, also set `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION`.
- Tool/proof env: `E2B_API_KEY`, `APIFY_API_TOKEN`, optional `APIFY_PRICING_ACTOR_ID`.
- Internal auth/env: `VET_ADMIN_PASSCODE`, `VET_APP_ADMIN_PASSCODE`, `VET_VETERINARIAN_PASSCODE`, `CRON_SECRET`, notification envs.
- Cron only: `INTERNAL_BASE_URL`, `CRON_SECRET`.
- No external records-transfer audit env is required; records transfer uses local audit plus mock secure-transfer submission.

Smoke:

1. Set Supabase pooler `DATABASE_URL` locally.
2. Run `npm run db:migrate`.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Start local or deployed app with `AGENT_RUNTIME=google-adk` when proving live ADK; use `AGENT_RUNTIME=mock` for fallback/demo proof.
6. Run `LOCAL_BASE_URL=http://localhost:3000 npm run verify:agents` for fallback-safe proof.
7. Run `LOCAL_BASE_URL=http://localhost:3000 npm run verify:agents:google` when Google credentials exist.
8. For deployed proof: `SCENARIO_BASE_URL=https://vetagent-internal.onrender.com npm run scenarios:e2b`.
9. Hit `/api/notifications/overdue` with `Authorization: Bearer $CRON_SECRET`.
10. Hit `/api/notifications/monthly-agent-email` with `Authorization: Bearer $CRON_SECRET`.

Opsera:

- Pipeline source: `sandeepsalwan1/AgentHackathon`.
- Steps: install, typecheck, build, optional migration check, Render deploy trigger.
- Add manual approval before production deploy if quick.
- Blocker state should be documented here instead of blocking local development.

Security note:

- Supabase currently reports RLS disabled on existing server-side tables.
- Do not enable RLS without policies during initial development; it would block current server-side flows if done incorrectly.
- Later remediation should add policies and then enable RLS for public tables.
