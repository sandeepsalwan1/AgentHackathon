# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Central Veterinary Hospital MVP — a task management system for a veterinary clinic. Two Next.js apps share a Postgres database via an npm workspace.

- `apps/internal` — staff/VA/veterinarian/admin task board (port 3000)
- `apps/client-request` — public request intake form (port 3001)
- `packages/db` — Postgres schema, query helpers, and shared TypeScript types
- `packages/notifications` — Resend email + carrier-gateway SMS (no Twilio)
- `db/migrations/` — numbered SQL migrations applied via `npm run db:migrate`

## Commands

```sh
npm install
cp .env.example .env.local          # fill DATABASE_URL or POSTGRES_URL
npm run db:migrate                   # run all pending SQL migrations

npm run dev:internal                 # internal app on :3000
npm run dev:client                   # public form on :3001

npm run build                        # build both apps
npm run typecheck                    # tsc --noEmit across all workspaces
npm run lint                         # ESLint across all workspaces
```

There are no automated tests. Smoke-check via the `/api/notifications/smoke` endpoint and manual task creation.

## Environment variables

Copy `.env.example` to `.env.local`. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `POSTGRES_URL` | Neon/Postgres connection string |
| `VET_ADMIN_PASSCODE` | VA role passcode |
| `VET_APP_ADMIN_PASSCODE` | Admin role passcode |
| `HOSPITAL_NAME` | Display name |
| `APP_TIME_ZONE` | IANA timezone (default `America/Los_Angeles`) |
| `NOTIFICATION_MODE` | `disabled` (default) / `test` / `production` |
| `NOTIFICATION_CHANNEL` | `email` (default) / `sms` / `both` |
| `CRON_SECRET` | Required for Vercel cron to call `/api/notifications/overdue` |

Veterinarian profile passcodes are managed through Admin settings UI after deployment — they are not env vars.

## Architecture

### Authentication / role model

There are five roles: `staff`, `va`, `task_adder`, `veterinarian`, `admin`. Authentication is passcode-based, not session-based:

- **staff** — no passcode; name is user-supplied
- **va / task_adder** — shared env passcode (`VET_ADMIN_PASSCODE`)
- **admin** — env passcode (`VET_APP_ADMIN_PASSCODE`)
- **veterinarian** — per-doctor passcode stored in `recipient_profiles` DB table; name auto-fills from profile

Every API route receives `actor` (name + role + passcode) in the request body or query params, normalizes it through `authenticateActor` in [`apps/internal/app/api/_shared.ts`](apps/internal/app/api/_shared.ts), and gets back a typed `Actor` or an error response. Rate-limiting for failed passcode attempts is tracked in `auth_attempts` table.

### Task workflow

All status transition and permission logic lives in [`apps/internal/app/lib/taskWorkflow.ts`](apps/internal/app/lib/taskWorkflow.ts). The key rules:

- Public form submissions land as `pending_review`; VA/admin must move them to `due` first
- `invalid` status is persisted as `archived` in the DB (`persistedStatusForRequest`)
- Staff can only act on `staff_request`-sourced tasks; cannot mark VA/admin/vet tasks invalid
- Escalated tasks stay in their status lane for staff but are hidden from manager-role lanes (shown in a separate "escalated" lane)
- Completed tasks from prior local days are auto-archived by `System` before daily alert scans

### Data layer (`packages/db`)

Uses the `postgres` npm package (not an ORM). All queries are in [`packages/db/src/tasks.ts`](packages/db/src/tasks.ts), [`settings.ts`](packages/db/src/settings.ts), etc. The package exports everything through [`packages/db/src/index.ts`](packages/db/src/index.ts). Types are in [`packages/db/src/types.ts`](packages/db/src/types.ts) and shared across both apps.

Connection is obtained via `getSql()` from `packages/db/src/connection.ts`, which throws `MissingDatabaseUrlError` if no URL is configured — API routes catch this and return a `503`.

### Notifications (`packages/notifications`)

`sendEscalationAlert` and `sendOverdueSummary` query per-veterinarian opt-in preferences from `recipient_profiles`. The env-based `NOTIFICATION_MODE`/`NOTIFICATION_CHANNEL` only applies to legacy non-profile notifications. SMS is sent via Resend to carrier email-to-SMS gateway addresses (e.g., `5551234567@vtext.com`) — no Twilio needed. All sends are idempotent via `idempotency_key` in `notification_events`.

Vercel cron hits `/api/notifications/overdue` daily at `0 2 * * *` UTC (≈6 PM Pacific). The endpoint checks local hour against `OVERDUE_CHECK_HOUR` (default 18) before sending.

### API surface (internal app)

| Route | Purpose |
|---|---|
| `POST /api/tasks` | Create task |
| `GET /api/tasks` | List tasks (role-filtered) |
| `PATCH /api/tasks/[id]` | Edit / status transition / escalate |
| `POST /api/tasks/[id]/undo` | Undo last status change |
| `GET /api/events` | Task event log |
| `POST /api/auth` | Validate actor passcode |
| `GET/POST /api/settings` | Recipient profile management |
| `GET /api/profile-name` | Name lookup for veterinarian profile |
| `POST /api/notifications/smoke` | Send a test notification |
| `GET /api/notifications/overdue` | Daily priority summary (cron, requires `CRON_SECRET`) |

The public app (`apps/client-request`) only has `POST /api/requests` — no read routes.

### Deployment

Two separate Vercel projects. Use root-level `vercel.internal.json` and `vercel.request.json` for CLI deploys (so shared workspace packages are uploaded). The per-app `vercel.json` files set project-level defaults. Both projects connect to the same Postgres database.
