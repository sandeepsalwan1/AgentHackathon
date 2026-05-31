# Central Veterinary Hospital MVP

Two Vercel apps in one npm workspace.

- `apps/internal`: Staff, VA, Veterinarian, and Admin task board.
- `apps/client-request`: public request form only.
- `packages/db`: Postgres schema and server helpers.
- `packages/notifications`: Resend email and email-to-SMS notification helpers.

Local commands:

- `npm install`
- `cp .env.example .env.local` and fill `DATABASE_URL` or `POSTGRES_URL`
- `npm run db:migrate`
- `npm run dev:internal`
- `npm run dev:client`

Vercel:

- Create two projects with root directories `apps/internal` and `apps/client-request`.
- Add shared env vars to both projects: `DATABASE_URL`, `VET_ADMIN_PASSCODE`, `VET_APP_ADMIN_PASSCODE`, `HOSPITAL_NAME`, `APP_TIME_ZONE`.
- Add notification env vars and `CRON_SECRET` only to internal.
- Internal passcodes: VA and Admin env passcodes plus doctor profile passcodes from Admin settings.
- VA/Admin passcodes must be configured with `VET_ADMIN_PASSCODE` and `VET_APP_ADMIN_PASSCODE`.
- Veterinarian profile passcodes are configured in Admin settings after deployment.
- Keep `NOTIFICATION_MODE=disabled` until real sends are approved. Use a test-only carrier gateway address in `TEST_SMS_NOTIFICATION_RECIPIENTS` for smoke tests.
- Veterinarian passcodes and delivery preferences live in Admin settings. Email and SMS channels are separate from escalation and daily medium/high alert opt-ins, and profiles start opted out until explicitly enabled.
- Internal cron lives in `apps/internal/vercel.json`.
