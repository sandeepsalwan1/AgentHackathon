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
- Pipeline entrypoint in repo: `.github/workflows/opsera-render.yml`.
- Steps: install, typecheck, build, optional migration check, Render deploy trigger.
- Manual approval is represented by the GitHub `production` environment on the deploy job.
- Required pipeline secrets: `DATABASE_URL` for optional migration check, `RENDER_INTERNAL_DEPLOY_HOOK_URL`, and `RENDER_CLIENT_DEPLOY_HOOK_URL`.
- Records-transfer audit entrypoint: `packages/agents/src/tools/opsera.ts`.
- Runtime routes call Opsera before records request task creation and persist `opsera_audit_*` fields on `tasks`.
- Internal tool route: `POST /api/tools/prepare-records-packet`.
- Runtime env: `OPSERA_MCP_URL=https://agent.opsera.ai/mcp`, `OPSERA_API_KEY`, `OPSERA_MCP_TOOL`, `OPSERA_MCP_TIMEOUT_MS`.
- If `OPSERA_MCP_URL` is not configured, the app uses a local fallback policy and flags the audit source as `local_policy`.
- Blocker state should be documented here instead of blocking local development.
