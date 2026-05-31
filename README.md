# Central Veterinary Hospital MVP

Two Render apps in one npm workspace, backed by Supabase Postgres.

- `apps/internal`: Staff, VA, Veterinarian, and Admin task board.
- `apps/client-request`: public request form only.
- `packages/db`: Postgres schema and server helpers.
- `packages/notifications`: Resend email and email-to-SMS notification helpers.

Local commands:

- `npm install`
- `cp .env.example .env.local` and fill Supabase `DATABASE_URL`
- `npm run db:migrate`
- `npm run dev:internal`
- `npm run dev:client`

Render + Supabase:

- Create a Supabase project and use its Postgres connection string as `DATABASE_URL`.
- Create two Render web services from `render.yaml`: `vetagent-internal` and `vetagent-client`.
- Add shared env vars to both services: `DATABASE_URL`, `HOSPITAL_NAME`, `APP_TIME_ZONE`, `MOCK_MODE`, `AGENT_RUNTIME`.
- Add notification env vars and `CRON_SECRET` only to internal.
- Internal passcodes: VA and Admin env passcodes plus doctor profile passcodes from Admin settings.
- VA/Admin passcodes must be configured with `VET_ADMIN_PASSCODE` and `VET_APP_ADMIN_PASSCODE`.
- Veterinarian profile passcodes are configured in Admin settings after deployment.
- Keep `NOTIFICATION_MODE=disabled` until real sends are approved. Use a test-only carrier gateway address in `TEST_SMS_NOTIFICATION_RECIPIENTS` for smoke tests.
- Veterinarian passcodes and delivery preferences live in Admin settings. Email and SMS channels are separate from escalation and daily medium/high alert opt-ins, and profiles start opted out until explicitly enabled.
- Internal overdue summary runs as the `vetagent-overdue-summary` Render cron job.
