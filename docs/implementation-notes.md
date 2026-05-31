# Implementation Notes

Date: 2026-05-16

Stack:

- Next.js app router, TypeScript, npm workspaces.
- Supabase Postgres helpers via `postgres`.
- Resend for email and carrier-gateway SMS notifications.
- Render cron runs the internal daily priority endpoint.

Deployment:

- Internal: `https://vetagent-internal.onrender.com`
- Public request form: `https://vetagent-client.onrender.com`
- Database: Supabase Postgres, exposed to the apps through `DATABASE_URL`.
- Database migration `001_initial.sql` applied.
- Internal Render cron: `/api/notifications/overdue`, `0 2 * * *` UTC.

Deployment notes:

- `render.yaml` defines `vetagent-internal`, `vetagent-client`, and the overdue-summary cron job.
- `0 2 * * *` maps to 6 PM Pacific Standard Time and 7 PM Pacific Daylight Time; app code still checks local hour before sending.
- Production internal cron requires `CRON_SECRET`; without it the overdue endpoint fails closed.
- Internal passcodes are deployment defaults: VA and Admin env passcodes plus doctor profile passcodes from Admin settings.

Deploy shape:

- Internal app and public request form should be separate Render services.
- Both projects use the same database.
- Public form only has insert route; no task read routes.

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
