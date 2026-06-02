# Implementation Notes

Date: 2026-05-16

Stack:

- Next.js app router, TypeScript, npm workspaces.
- Supabase Postgres helpers via `postgres`.
- Resend for email and carrier-gateway SMS notifications.
- Render cron runs the internal daily priority endpoint and monthly agent email check.

Deployment:

- Internal: `https://vetagent-internal.onrender.com`
- Public request form: `https://vetagent-internal.onrender.com/request`
- Database: Supabase Postgres, exposed to the apps through `DATABASE_URL`.
- Database migration `001_initial.sql` applied.
- Internal Render cron: `/api/notifications/overdue`, `0 2 * * *` UTC.
- Monthly agent email Render cron: `/api/notifications/monthly-agent-email`, `15 17 1 * *` UTC.

Deployment notes:

- `render.yaml` defines one web app, `vetagent-internal`, the overdue-summary cron job, and the monthly-agent-email cron job.
- `0 2 * * *` maps to 6 PM Pacific Standard Time and 7 PM Pacific Daylight Time; app code still checks local hour before sending.
- `15 17 1 * *` runs the monthly agent email on the first day of each month in the late morning Pacific time; the route also uses a local `YYYY-MM` idempotency key.
- Production internal cron requires `CRON_SECRET`; without it internal notification cron endpoints fail closed.
- Internal passcodes are deployment defaults: VA and Admin env passcodes plus doctor profile passcodes from Admin settings.

Deploy shape:

- Staff and public routes are served by the unified internal app.
- `apps/client-request` is legacy/reference source only; root lint/typecheck still covers it.
- Public request form UI lives in `@central-vet/request-form`, with small app-specific chrome adapters.
- Public request guard, validation, dedupe, and task creation live in `@central-vet/request-intake`, shared by the internal and legacy/reference request routes.
- Agent workflow URLs are implemented by one dynamic adapter at `apps/internal/app/api/agent/[workflow]/route.ts`; `_runner.ts` owns the workflow-to-auth/intent table.
- Public agent ingress lives in `apps/internal/app/api/agent/_publicAgentGuard.ts`; `_auth.ts` is only actor/passcode manager auth.
- Agent runner locality: `_runner.ts` orchestrates runs, `_clinicData.ts` owns the agent clinic data projection, `_effectPersistence.ts` owns agent effect persistence, and `_operationalMutations.ts` owns state-changing tool-call persistence.
- Agent tools live in `packages/agents/src/toolGroups`; `packages/agents/src/tools.ts` only composes groups and records tool-call traces.
- Task board projection display and ordering policy lives in `taskBoardDisplay.ts`; `TaskCard.tsx` owns repeated task card rendering.
- The legacy `vetagent-client` Render service was deleted on 2026-05-31.

Notification behavior:

- Default is paused/off unless explicitly switched to `test` or `production`.
- Production delivery remains blocked while `NOTIFICATION_MODE=disabled`; only the test number is configured for test SMS.
- `NOTIFICATION_MODE=disabled`: log only.
- `NOTIFICATION_MODE=test`: sends to test recipients for selected channel.
- `NOTIFICATION_MODE=production`: sends to production recipients for selected channel.
- `NOTIFICATION_CHANNEL=email`: send normal email to `*_NOTIFICATION_EMAIL*`.
- `NOTIFICATION_CHANNEL=sms`: send short text to `*_SMS_NOTIFICATION_RECIPIENTS`.
- `NOTIFICATION_CHANNEL=both`: send both.
- Free SMS path uses carrier email-to-SMS gateway addresses in `SMS_NOTIFICATION_RECIPIENTS`; no Twilio account needed.
- Medium/high alerts are end-of-day only: one idempotent summary per day if any medium/high task is still open or overdue.
- Completed tasks from prior local days auto-archive as `System` before task lists and daily alerts are checked, so completed work drops out of the next day's board and alert scan.
- Veterinarian profile settings are per doctor: email channel opt-in, SMS channel opt-in, escalation alert opt-in, and daily medium/high alert opt-in. Profiles start opted out until explicitly enabled.
- Escalation notifications go to active veterinarian profiles only, not Admin.

Role behavior:

- Staff: normal task view.
- VA: old Admin behavior, env-configured passcode.
- Veterinarian: doctor profile passcodes, name auto-fills when blank, and each doctor can edit only their own notification profile. doctor profile passcodes from Admin settings.
- Admin: old Veterinarian behavior, env-configured passcode.
- Admin can add, edit, and deactivate veterinarian profiles; inactive profiles are hidden.
- VA, Veterinarian, and Admin see a capped, scrollable Audit Log with Archive underneath.

Smoke checks:

- Local and deployed public form submission created a `pending_review` task.
- Internal dashboard API saw the task, moved it to `due`, then `completed`.
- Activity log returned events.
- Resend smoke email in `test` mode returned `sent`.

Known lint state:

- 2026-06-01: `npm run lint` and `npm run typecheck` pass across the internal app, legacy request app, and packages.
- 2026-06-01: `npm run lint:dead` reports no unused files, exports, or dependencies.
- 2026-06-01: `npm run lint:duplicates` reports no source duplication; append-only DB migrations are excluded by policy.
