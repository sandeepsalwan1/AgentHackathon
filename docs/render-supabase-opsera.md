# Render / Supabase / Opsera

Date: 2026-05-31

Current decision:

- Deploy on Render, not Vercel.
- Database on Supabase Postgres, not Neon.
- Keep passcode auth. Do not add Supabase Auth for this sprint.
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
- Migrations `001` through `015` are applied.

Render setup:

- Blueprint: `render.yaml`.
- Project: `Main1` (`prj-d8e98bmk1jcs739ogq20`).
- Environment: `evm-d8e98bmk1jcs739ogq2g`.
- Services:
  - `vetagent-internal` (`srv-d8e9c019rddc73el6i5g`): `https://vetagent-internal.onrender.com`
  - `vetagent-client` (`srv-d8e9c3l7vvec73ef0p30`): `https://vetagent-client.onrender.com`
  - `vetagent-overdue-summary`: defined in `render.yaml`, not created through the API yet.
- Internal build: `npm ci && npm run build --workspace @central-vet/internal`
- Internal start: `npm run start --workspace @central-vet/internal -- -p $PORT`
- Client build: `npm ci && npm run build --workspace @central-vet/client-request`
- Client start: `npm run start --workspace @central-vet/client-request -- -p $PORT`
- Render MCP currently has no workspace selected; service creation was done through the Render REST API using the configured `RENDER_API_KEY`.

Required Render env:

- Both web services: `DATABASE_URL`, `HOSPITAL_NAME`, `APP_TIME_ZONE`, `MOCK_MODE`, `AGENT_RUNTIME`.
- Internal only: `VET_ADMIN_PASSCODE`, `VET_APP_ADMIN_PASSCODE`, `VET_VETERINARIAN_PASSCODE`, `CRON_SECRET`, notification envs.
- Client only: `CLIENT_REQUEST_BASE_URL`, `CLIENT_REQUEST_HOST`.
- Cron only: `INTERNAL_BASE_URL`, `CRON_SECRET`.

Smoke:

1. Set Supabase pooler `DATABASE_URL` locally.
2. Run `npm run db:migrate`.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Deploy Render services from `render.yaml`.
6. Submit a public request on `vetagent-client`.
7. Confirm it appears in internal Pending Review on `vetagent-internal`.
8. Hit `/api/notifications/overdue` with `Authorization: Bearer $CRON_SECRET`.

Opsera:

- Pipeline source: `sandeepsalwan1/AgentHackathon`.
- Steps: install, typecheck, build, optional migration check, Render deploy trigger.
- Add manual approval before production deploy if quick.
- Blocker state should be documented here instead of blocking local development.
