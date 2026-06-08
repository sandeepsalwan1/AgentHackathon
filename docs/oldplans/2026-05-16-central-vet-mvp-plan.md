# Central Veterinary Hospital MVP Plan

Date: 2026-05-16

Archive status: old implementation plan. Current docs live in `../README.md`; keep this file for historical context only.

This document is a cleaned, scoped version of the full product idea. It is meant to be pasted into another AI/agent as the working spec. It is self-contained; no extra prompt context is needed. Follow it closely, but feel free to replan implementation details if the repo, free-tier provider limits, or Render/Supabase setup make a different path better. Keep the product intent unchanged.

## Pasteable Clean Prompt

Build a free-tier MVP for Central Veterinary Hospital. Use Render for deployment, Render-generated domains for now, and Supabase Postgres for persistence. The goal is a quick internal app plus a separate public website/form, not a big enterprise system. This should be ready to go live quickly, including working doctor email notifications.

First, do a smoke check and make sure deployment/tooling is ready: Render workspace, Supabase org/project, Node/npm, package manager, email/notification option, and anything needed to work autonomously. Do as much as possible directly. Only stop for a blocker that truly requires an account, secret, billing approval, or manual dashboard step.

The current clinic workflow needs to change. Right now, assistant messages go to the two business owners/doctors, who are also veterinarians. The doctors then have to redirect tasks to employees. Employees then need to remember, complete, and follow up. This makes the doctors the routing bottleneck.

Build an internal task board where a task adder/assistant can directly type the current issue into the page. The app should track task status clearly: is it done, pending, overdue, invalid, or still needing review? If something is not done by end of day, the doctors must be alerted by email, which gives phone notifications through Gmail.

Build a separately deployed public client request form. Customers should not access the internal task board. The form should be tiny and clear:

- Client name
- Phone number
- Date of birth
- Pet's name
- Optional pet weight
- Optional last visit
- Request

When the public form is submitted, it should create an internal item with status `Pending Review`. A task adder reviews it and decides what to do with it. Do not send client form submissions directly into normal due work without review.

The internal app should be extremely easy, almost no-login. Use a lightweight entry screen:

- Name
- Role

Roles:

- Staff/Employee
- VA
- Veterinarian
- Admin

VA keeps old Admin behavior. Admin keeps old Veterinarian behavior. Veterinarian uses separate doctor passcodes/profiles with optional name auto-fill. Admin can add/edit/deactivate veterinarian profiles. Doctor profiles have separate email/SMS channel opt-ins and separate escalation/daily medium-high alert opt-ins.

Role behavior:

- Staff/Employee can see tasks, mark tasks complete, and mark a task as error/invalid if it is not a real issue or cannot be done.
- Staff/Employee can request a task, but that should be visually labeled as staff requested and route through review.
- Task Adder can create tasks, edit tasks, review client/staff requests, move things from Pending Review into Due/Pending, and handle staff error/invalid marks.
- Veterinarian has full permissions to do whatever: create, edit, move, archive, restore, undo, and review activity.

The main internal dashboard should be very clear:

- Pending Review
- Due Tasks
- Pending
- Completed

Due tasks should sort newest to oldest, with overdue items floated to the top. Overdue means not completed by end of day. Completed tasks should be satisfying: green, checkmark, maybe strike-through, clearly completed by someone. Staff should be able to cross out or mark an issue invalid/error, so task adders can review it. Nothing should be hard-deleted in normal use.

Make the UI very, very easy and color-coded:

- Completed = green
- Overdue = red/high priority
- Pending = amber/yellow
- Due = blue or neutral
- Pending Review = cyan/purple or another clear review color
- Staff requested = yellow label
- Client requested = distinct label
- Error/Invalid = gray/red outline, not confused with completed

Make it hard to permanently mess up:

- Soft archive instead of hard delete
- Activity log
- Undo recent actions if feasible
- Vet/admin restore

Use free-tier-friendly infrastructure. Default recommendation: Supabase Postgres plus Render web services. Simple polling every 10-30 seconds is fine for near-realtime MVP updates; Supabase Realtime can be added later if useful.

Use Resend for email notifications. This is required for go-live, not optional. Resend docs:

- https://resend.com/docs
- https://resend.com/docs/llms-full.txt

Notification emails:

- Production doctor email: `doctor.com`
- Test email: `test.com`

Email launch rule:

- Implement email notifications before production handoff.
- Smoke-test once to `test.com`.
- Then configure production mode for `doctor.com`.
- Production sender is verified and ready: `Central Veterinary Hospital <notifications@example.com>`.

Domain:

- Use Render-generated domains for MVP.
- `eepish.com` exists on Cloudflare and can be used later.
- Optional future URLs:
  - `tasks.eepish.com`
  - `request.eepish.com`

Free-tier first:

- Render free tier where possible.
- Supabase free tier where possible.
- Resend free tier if possible, but production email sending must work for go-live.
- No paid domain work needed.
- No paid messaging integrations for MVP.

Deliverables:

- Internal Render app for staff/task adders/vets.
- Separate public Render app/form for clients.
- Shared database.
- Email notification path for overdue tasks.
- Clear role-based UI.
- Color-coded task states.
- Safe undo/archive/activity-log model.
- Smoke-tested deployed URLs.

## Setup Status

Verified:

- Supabase MCP is connected.
- Supabase org visible: `sandeepsalwan1's Org` (`dflgitlurgfmnexbdpqg`).
- Existing Supabase projects are inactive; new `vetagent` project needs explicit org/cost confirmation.
- Render MCP is connected but no workspace is selected. User must select the workspace before service creation.
- `render.yaml` is the deployment blueprint.
- Fresh shells use the default nvm Node setup:
  - Node: `/Users/sandeep/.nvm/versions/node/v24.15.0/bin/node`
  - npm global prefix: `/Users/sandeep/.nvm/versions/node/v24.15.0`
- `eepish.com` nameservers resolve to Cloudflare:
  - `piotr.ns.cloudflare.com`
  - `sasha.ns.cloudflare.com`
- Cloudflare API token is set locally in `~/.secrets` and verified active.
- Resend API key is set locally in `~/.secrets`.
- `eepish.com` is added and verified in Resend.
- Production sender is verified and ready: `Central Veterinary Hospital <notifications@example.com>`.
- Required Resend DNS records were added in Cloudflare:
  - `TXT resend._domainkey.eepish.com`
  - `MX send.eepish.com`
  - `TXT send.eepish.com`
- Email sender env is set:
  - `EMAIL_FROM=Central Veterinary Hospital <notifications@example.com>`
  - `DOCTOR_NOTIFICATION_EMAILS=doctor.com`
  - `TEST_NOTIFICATION_EMAIL=test.com`
  - `NOTIFICATION_MODE=disabled`
- Resend smoke email to `test.com` succeeded.

Missing from local shell right now:

- Supabase `DATABASE_URL`
- confirmed Supabase project for this repo
- selected Render workspace

These are not reasons to stop scaffolding the app. Build with env placeholders and free-tier defaults. But a complete live launch needs:

- a working Supabase `DATABASE_URL`
- deployed app env vars copied from local secret store / Render configuration
- final deployed email smoke test after the app exists

Stop only when final database provisioning, deployed database writes, real email sending, or custom DNS requires a missing secret or dashboard authorization.

## Free-Tier Provider Decision

Default database path:

- Supabase Postgres.
- Reason: project direction now standardizes on Supabase, with optional realtime/storage/auth later.
- Use Supabase Postgres connection string as `DATABASE_URL`.
- Use polling every 10-30 seconds for near-realtime updates until Realtime is intentionally added.

Email path:

- Resend, production-required.
- Use `test.com` for one smoke test.
- Use `doctor.com` for go-live production notifications.
- Use `EMAIL_FROM=Central Veterinary Hospital <notifications@example.com>`.
- `eepish.com` is verified in Resend and the sender is ready.

DNS path:

- No custom domain for MVP.
- Do not touch Cloudflare unless explicitly switching to `eepish.com`.

Useful references:

- Resend docs: https://resend.com/docs/llms-full.txt
- Supabase pricing/free pause: https://supabase.com/pricing
- Supabase 90-day paused restore docs: https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause
- Render monorepo support: https://render.com/docs/monorepo-support
- Supabase database migrations: https://supabase.com/docs/guides/deployment/database-migrations

## Product Intent

The current real-world workflow is too manual:

- Assistant messages currently go to two business owners/doctors.
- The doctors then have to redirect the work to employees.
- Employees have to remember, complete, and follow up manually.

The MVP should remove the doctors as the default router. It should give virtual assistants/task adders and staff a very clear place to create, review, and complete tasks.

Primary goal:

- A very easy internal task system where task adders enter issues, staff sees what needs to be done, staff marks items complete/error, and veterinarians/admins can oversee everything.

Secondary goal:

- A very small public client form that creates a pending review request. Customers do not get access to the internal board.

Core feeling:

- Extremely clear UI.
- Minimal login friction.
- Satisfying completion.
- Color-coded.
- Hard to mess up permanently.
- Easy enough that busy clinic staff can use it without training.

## Final Q&A From Discovery

Q: Deploy target?

A: Render.

Q: Custom domain now?

A: No. Use Render-generated domains for MVP.

Q: Hospital name?

A: Central Veterinary Hospital.

Q: Should clients use the internal task app?

A: No. Customers should not access the internal app.

Q: Should there be a client-facing thing at all?

A: Yes, but only a tiny separate public form.

Q: Should client form be separate from internal dashboard?

A: Yes. Two separate Render services is preferred so customers do not access the internal tool.

Q: What should the client form collect?

A:

- Name
- Phone number
- Date of birth
- Pet's name
- Optional pet weight
- Optional last visit
- Request (at least 25 chars non spaces) some rate limiting (dont needa go overboard)

Q: Where should client form submissions go?

A: `Pending Review`. Task adders see pending reviews and decide what to do.

Q: How should doctors get phone notifications?

A: Use email notifications. Doctors can receive Gmail notifications on phone.

Q: Doctor email?

A: `doctor.com`.

Q: Test notification email?

A: `test.com`.

Q: Login?

A: Keep it almost no-login. Ask for name and role. No full account system in MVP.

Q: Roles?

A:

- Staff/Employee
- Task Adder
- Veterinarian

Q: Veterinarian access?

A: Veterinarian role uses doctor profile passcodes. doctor profile passcodes from Admin settings.

Q: Staff permissions?

A: Staff can view tasks, mark complete, and mark something as error/invalid. Staff may request/create a task if needed, but staff-created items should be visibly flagged as staff requested.

Q: Task adder permissions?

A: Task adder can create tasks, edit their task details, review client requests, move tasks into due/pending work, and monitor status.

Q: Veterinarian permissions?

A: Full admin: create, edit, complete, archive, restore, undo, review activity, manage anything.

Q: Status columns?

A:

- Due
- Pending
- Completed

Also support:

- Pending Review for client/staff-requested items that task adders need to triage.
- Error/Invalid as an action/state so staff can cross off something that is not real or cannot be done.

Q: Sorting?

A: Due tasks should sort newest to oldest unless implementation finds a better clinic workflow. Overdue items should float to top.

Q: What counts as overdue?

A: Not completed by end of day.

Q: Should it be realtime?

A: Yes if easy. Staff/task adders should see updates without refreshing where possible.

Q: What should completion feel like?

A: Satisfying. Clear completed state, green, checkmark, strike-through or finished animation if tasteful.

Q: Should there be undo?

A: Yes. Avoid destructive operations. Use soft-delete/archive and activity log.

## Recommended Architecture

Use one monorepo with two apps and shared packages.

Recommended stack:

- Next.js on Render
- TypeScript
- Supabase Postgres as the default database path
- Simple polling/refresh for near-realtime MVP updates
- Optional Supabase Realtime if built-in live updates become useful
- Resend for email notifications
- Render Cron for end-of-day overdue summaries
- CSS modules, Tailwind, or existing repo styling if the implementing agent scaffolds with a template

Suggested structure:

```text
/Users/sandeep/projects/centralVet
  apps/
    internal/
      # Internal task board
    client-request/
      # Public client form
  packages/
    db/
      # Database schema, queries, server helpers
    ui/
      # Shared UI primitives if useful
    notifications/
      # Resend helpers
  db/
    migrations/
  docs/
    implementation-notes.md
  docs/oldplans/2026-05-16-central-vet-mvp-plan.md
```

Deploy two separate Render services: one internal task board and one public client request form. A monorepo is fine, but do not ship customers and staff through the same deployed app unless there is a very strong reason and the internal routes are protected from public visitors.

## App 1: Internal Task Board

Audience:

- Staff/Employee
- Task Adders
- Veterinarians/admins

Entry screen:

- Hospital name at top: Central Veterinary Hospital.
- Name input.
- Role selector:
  - Staff/Employee
  - Task Adder
  - Veterinarian
- If Veterinarian selected, show passcode input.
- Passcodes: VA and Admin env passcodes plus doctor profile passcodes from Admin settings.
- Remember the session locally so staff/task adders/vets do not need to re-enter every time on the same device.

Do not build full email/password auth for MVP unless the agent determines it is necessary. Minimal friction is a core requirement.

Main dashboard:

- Clear columns or grouped lanes:
  - Pending Review
  - Due
  - Pending
  - Completed
- Overdue items should be visually prominent and float near the top.
- The board should be easy to scan from a clinic computer.
- Avoid clutter, tiny text, or hidden controls.

Task card should show:

- Client name
- Client phone number if present
- Pet name
- Request summary
- Source badge:
  - Client request
  - Task adder
  - Staff requested
  - Veterinarian
- Status badge
- Due date / created date
- Created by
- Assigned to if set
- Last updated by
- Completed by if completed
- Error/invalid marker if set

Task actions:

- Mark complete
- Move to pending
- Move to due
- Mark error/invalid
- Edit task
- Archive/restore for admin
- Undo recent action when feasible

Staff view:

- Can see Due, Pending, Completed.
- Can mark tasks complete.
- Can mark task error/invalid.
- Can create/request a task if needed, but it should be labeled `Staff requested` and optionally routed through Pending Review.
- Should not have scary admin controls.

Task Adder view:

- Can create tasks.
- Can review Pending Review submissions.
- Can convert client form submissions into actual Due/Pending tasks.
- Can edit task details.
- Can see staff error/invalid marks and decide next step.
- Should get notified visually when staff marks something error/invalid.

Veterinarian view:

- Full permissions.
- Can see all tasks and activity.
- Can restore archived tasks.
- Can override status.
- Can inspect who did what.

## App 2: Public Client Request Form

Audience:

- Clients/customers.

Purpose:

- Let a client submit a simple request that becomes a Pending Review item in the internal board.

Important:

- The public form must not expose the internal dashboard.
- The public form must not allow reading existing tasks.
- It only inserts a new client request.

Fields:

- Client name, required.
- Phone number, required unless the implementing agent has a good reason to make it optional.
- Date of birth, required as requested. Clarify in UI whether this means client DOB or pet DOB only if needed. If not clarified, label as `Date of birth`.
- Pet's name, required.
- Pet weight, optional.
- Last visit, optional.
- Request, required.

Submission behavior:

- Create a request/task with:
  - `source = client_form`
  - `status = pending_review`
  - `hospital_name = Central Veterinary Hospital`
  - `created_by_name = client name`
- Show a simple success message.
- Do not show task board or queue.
- Do not promise emergency response unless the business explicitly wants that language.

Suggested copy:

- Keep it plain and clinic-safe.
- Avoid legal/medical commitments.
- Add a small note: "For emergencies, call the hospital directly." Only include an exact phone number if one is configured.

## Database Model

Use Supabase Postgres through the shared `DATABASE_URL`.

Suggested SQL schema:

```sql
create type app_role as enum ('staff', 'task_adder', 'veterinarian');
create type task_status as enum ('pending_review', 'due', 'pending', 'completed', 'invalid', 'archived');
create type task_source as enum ('client_form', 'task_adder', 'staff_request', 'veterinarian');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  hospital_name text not null default 'Central Veterinary Hospital',
  status task_status not null default 'pending_review',
  source task_source not null,
  client_name text,
  client_phone text,
  client_date_of_birth date,
  pet_name text,
  pet_weight text,
  last_visit date,
  request text not null,
  notes text,
  assigned_to text,
  due_date date not null default current_date,
  created_by_name text,
  created_by_role app_role,
  updated_by_name text,
  completed_by_name text,
  completed_at timestamptz,
  invalid_reason text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  actor_name text,
  actor_role app_role,
  event_type text not null,
  previous_status task_status,
  next_status task_status,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table notification_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete set null,
  notification_type text not null,
  recipient text not null,
  status text not null default 'pending',
  resend_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
```

Adjust exact schema after implementation review. Keep event logging even if simple.

RLS/security concept:

- Public client form should call a server route that validates input and inserts through a server-side database client.
- Internal app should not put privileged database credentials in browser code.
- If using no real login, enforce most permission checks in server routes and keep role/name session as lightweight identity.
- For MVP, passcode-based veterinarian access can be app-level rather than database-auth-level.

## Notification Plan

Go-live notification channel:

- Email via Resend.
- Doctors receive email notifications on their phones through Gmail.
- Production email is required before live handoff.

Resend docs:

- https://resend.com/docs
- https://resend.com/docs/llms-full.txt

Notification recipients:

- Production: `doctor.com`
- Test: `test.com`

Sender:

- Production sender: `Central Veterinary Hospital <notifications@example.com>`.
- `eepish.com` is verified in Resend.
- Render app domains do not automatically give a usable email sender domain.

Launch blocker:

- Do not consider the system production-ready until a real Resend send to `doctor.com` has been configured or explicitly approved after a smoke test.

Events that should trigger notification:

1. End-of-day overdue summary

- Run daily at 6:00 PM America/Los_Angeles.
- Find tasks not completed by end of day:
  - status in `pending_review`, `due`, `pending`, `invalid` if invalid still needs review
  - due date <= today
  - not completed
  - not archived
- Send a concise summary to doctors.
- This is required for go-live.

2. Staff error/invalid alert

- If a staff member marks a task as error/invalid, notify task adders and/or doctors depending on role rules.
- For the first live version, dashboard highlighting is acceptable if end-of-day email is working.
- Add email for this event if implementation time allows.

3. Optional daily morning digest

- Not required, but useful later.

Email implementation requirements:

- Use idempotency keys to prevent duplicate sends.
- Log notification attempts in `notification_events`.
- Retry only safe failures.
- Do not crash task mutations if email fails; record the failure and show admin-visible warning.

Suggested env vars:

```text
RESEND_API_KEY=
EMAIL_FROM=Central Veterinary Hospital <notifications@example.com>
DOCTOR_NOTIFICATION_EMAILS=doctor.com
TEST_NOTIFICATION_EMAIL=test.com
NOTIFICATION_MODE=disabled
```

`NOTIFICATION_MODE` options:

- `disabled`: no email sends, log only.
- `test`: send all emails to `TEST_NOTIFICATION_EMAIL`.
- `production`: send to `DOCTOR_NOTIFICATION_EMAILS`.

Email is paused for now. Use `test` for a smoke test, then switch to `production` only after approval.

## UI/UX Direction

Clarity and ease matter a lot. Build the actual tool, not a marketing page.

General UI:

- First screen should be the app, not a hero/landing page.
- Use clear role-based entry.
- Use large enough controls for clinic staff.
- Avoid generic AI-looking layouts.
- Avoid excessive explanation text inside the app.
- Make common actions obvious.

Color coding:

- Pending Review: soft purple or cyan, clearly distinct from normal tasks.
- Due: blue or neutral.
- Pending: amber/yellow.
- Completed: green, checkmark, satisfying completion state.
- Overdue: red, high contrast, top priority.
- Staff requested: yellow label.
- Client request: cyan/purple label.
- Error/Invalid: gray/red outline, not confused with completed.

Completion:

- Completed tasks should visually move to Completed.
- Add checkmark and gentle strike-through.
- Optionally use a small transition if it does not feel gimmicky.

Overdue:

- Not completed by end of day.
- Red badge: `Overdue`.
- Float overdue items above other due/pending tasks.

Staff error/invalid:

- Staff should be able to "cross out" or mark a task as invalid/error.
- This should not delete the task.
- Task adders should see it clearly and decide what to do.

Undo/safety:

- Avoid hard delete.
- Archive instead of delete.
- Keep activity log.
- Provide undo toast after status changes if feasible.
- Vet/admin can restore archived items.

## Implementation Phases

Phase 0: Setup

- Choose package manager from repo if already present. If empty, use a modern Next.js setup.
- Create monorepo or two Next apps.
- Add TypeScript.
- Add linting/formatting.
- Add env examples.
- Confirm Render services can be created/deployed.
- Confirm Supabase database connection through `DATABASE_URL`.
- Confirm Resend API key and sender behavior.

Phase 1: Data foundation

- Create database migrations.
- Add tasks table.
- Add task_events table.
- Add notification_events table.
- Add server-side database helpers.
- Generate or define TypeScript types.
- Seed a few local/dev sample tasks only in development.

Phase 2: Public client form

- Build simple client form.
- Validate inputs.
- Include phone number.
- Insert as `pending_review`.
- Show success state.
- Prevent reading tasks from public app.
- Add smoke test for submission.

Phase 3: Internal entry and session

- Build role/name entry screen.
- Persist name/role in local storage.
- Vet passcode gate.
- Keep role state simple.
- Add logout/change role control.

Phase 4: Internal dashboard

- Build task board with Pending Review, Due, Pending, Completed.
- Add status changes.
- Add completion flow.
- Add invalid/error flow.
- Add task create/edit flow for task adders/vets.
- Add task review flow for client requests.
- Add near-realtime updates through polling/refresh first. Supabase Realtime is acceptable if intentionally added.

Phase 5: Permissions and safety

- Server-side action checks for role.
- Staff can complete/invalid/request.
- Task adder can create/edit/review.
- Vet can administer.
- Add task_events logging.
- Add archive/restore for vet.
- Add undo for recent actions if feasible.

Phase 6: Email notifications

- Add Resend helper.
- Add test and production notification modes.
- Add end-of-day Render cron route.
- Add notification_events logging.
- Add overdue summary email.
- Add manual smoke test route or script guarded by env.
- Test first with `test.com`.
- Switch to production recipient `doctor.com` before live handoff.
- Production handoff is not complete until Resend can send to the production recipient or a launch owner explicitly accepts a temporary notification fallback.

Phase 7: Deploy

- Deploy internal app to Render-generated domain.
- Deploy public client request form to separate Render-generated domain.
- Set env vars in each Render service.
- Run migration.
- Smoke test both deployed URLs.
- Submit public form.
- Confirm item appears in internal Pending Review.
- Move item to Due/Pending.
- Mark complete.
- Confirm activity log.
- Test overdue email to `test.com`.
- Confirm production email configuration for `doctor.com`.

## Acceptance Criteria

Internal app:

- Staff/task adders/vets can enter name and role.
- Veterinarian role requires a configured doctor profile passcode.
- Staff can view tasks and mark complete.
- Staff can mark error/invalid.
- Task adder can create a task.
- Task adder can review client form submissions from Pending Review.
- Veterinarian can perform all actions.
- Completed tasks are green and satisfying.
- Overdue tasks are red and prominent.
- No hard delete in normal UI.
- Activity log records meaningful changes.

Public form:

- Client can submit name, phone number, DOB, pet name, optional weight, optional last visit, and request.
- Submission creates a Pending Review item.
- Public visitor cannot see the task board.

Notifications:

- End-of-day overdue summary can be sent via Resend.
- Test mode sends to `test.com`.
- Production mode sends to `doctor.com`.
- Notification failures are logged and do not break the app.

Deployment:

- Two separate Render services.
- Render-generated URLs are acceptable.
- Env vars configured in Render.
- Database is connected.
- Smoke test passes on deployed apps.

## Suggested Environment Variables

Shared:

```text
DATABASE_URL=
VET_ADMIN_PASSCODE=
VET_APP_ADMIN_PASSCODE=
HOSPITAL_NAME=Central Veterinary Hospital
TZ=America/Los_Angeles
```

Supabase optional/future:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Internal app:

```text
RESEND_API_KEY=
EMAIL_FROM=Central Veterinary Hospital <notifications@example.com>
DOCTOR_NOTIFICATION_EMAILS=doctor.com
TEST_NOTIFICATION_EMAIL=test.com
NOTIFICATION_MODE=disabled
OVERDUE_CHECK_HOUR=18
```

Client request app:

```text
DATABASE_URL=
HOSPITAL_NAME=Central Veterinary Hospital
```

## Smoke Tests

Local:

1. Start internal app.
2. Enter as Task Adder.
3. Create task.
4. Enter as Staff.
5. Mark task complete.
6. Confirm completed state and activity log.
7. Enter as Vet with env-configured passcode.
8. Restore/archive/edit a task.
9. Start public form.
10. Submit sample client request.
11. Confirm internal Pending Review shows request.

Deployed:

1. Open public Render URL.
2. Submit test request:
   - Client: Test Client
   - Phone: a fake/test number
   - DOB: test date
   - Pet: Test Pet
   - Request: Test request from deployed form
3. Open internal Render URL.
4. Confirm request appears in Pending Review.
5. Convert it to Due.
6. Mark complete.
7. Trigger notification smoke test to `test.com`.
8. Confirm production notification env targets `doctor.com`.
9. If approved for final live smoke, send one production email to `doctor.com`.

## Risks / Things To Watch

- Resend may require a verified sending domain before emailing production recipients. Render app domain does not automatically provide an email sender domain.
- Supabase free-tier projects can pause after inactivity. Daily clinic usage should avoid that, but idle demo projects may need unpausing before demos.
- Lightweight name/role login is intentionally not strong security. Acceptable for MVP only if internal URL is not broadly shared.
- Passcodes must be configured per deployment and rotated as needed.
- Public client form must be insert-only. Do not expose internal data.
- Medical/clinical wording should avoid implying emergency monitoring unless the hospital approves.
- Notification fatigue: do not email too aggressively. Go live with end-of-day summary first; add immediate alerts only where clearly useful.
- Realtime is nice, but core persistence and clear task status matter more.

## Future Ideas

Not MVP unless explicitly requested:

- Proper staff accounts.
- Audit export.
- Client dashboard.
- File/image uploads.
- Appointment integration.
- Employee assignment notifications.
- Multiple hospital locations.
- Additional/custom sender domains beyond the launch sender.

## Build Priorities

1. Make it usable for staff and task adders.
2. Keep client form separate and safe.
3. Make Pending Review flow clear.
4. Make completion satisfying.
5. Make overdue obvious.
6. Add production-ready email notifications.
7. Deploy both apps on Render.
8. Verify end to end, including email.

## Final Verification Requirement

Do not end early. Do not hand off a half-finished app. The final answer should only happen after the implementation is complete or after a true blocker is clearly identified.

Before final handoff, heavily verify everything:

- Run install/build/lint/typecheck/tests using the repo's package manager.
- Run database migrations against the chosen production database.
- Confirm both Render services deploy successfully.
- Open both deployed Render URLs.
- Submit a real test request through the public client form.
- Confirm the request appears in the internal app as `Pending Review`.
- Log in locally in the internal app as each role:
  - Staff/Employee
  - Task Adder
  - Veterinarian with env-configured passcode
- Verify staff can complete and mark invalid/error.
- Verify task adder can review client requests and move them to Due/Pending.
- Verify veterinarian/admin can edit, archive, restore, and review activity.
- Verify completed tasks are visibly green/satisfying and record who completed them.
- Verify overdue logic works and is understandable.
- Verify no public visitor can read the internal task board.
- Verify privileged database credentials are not exposed to browser code.
- Verify Resend env vars are present in Render.
- Send one test email to `test.com`.
- Confirm production email config points to `doctor.com`.
- If doing a final production smoke is approved, send exactly one production test email to `doctor.com`.
- Check browser console and server logs for errors.
- Check mobile-ish and desktop layouts for readable, non-overlapping UI.
- Make sure the UI is simple enough for clinic staff and the public client form is obvious.



The final report must include:

- Internal app Render URL.
- Public client form Render URL.
- Database provider used.
- Email sender and recipient configuration.
- What was tested.
- Any remaining caveats or things that still need an owner.

If something blocks completion, state the blocker exactly, include the failing command/error, and list the smallest next action needed. Do not present the work as complete until the app is actually deployed, verified, and usable.
