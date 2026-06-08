# Central Veterinary Hospital Context

## Language

**Client request**:
A non-arrival client ask that becomes clinic staff work.
_Avoid_: Request intake

**Arrival intake**:
A client check-in for today's visit, with identity, visit reason, and concern-specific questions. It may match an appointment and place the patient in the arrival flow.
_Avoid_: Check-in request, seating

**Customer account**:
An optional pet-owner identity used to prefill public flows and access the portal.
_Avoid_: Required check-in login

**Account claim**:
A customer account activation that proves control of a phone number or email already associated with a clinic client record.
_Avoid_: Staff-created customer password

**PIMS**:
The clinic system of record for clients, patients, appointments, visits, and record write-backs.
_Avoid_: Lab system

**Lab integration**:
A diagnostic lab connection for orders, results, and lab report status.
_Avoid_: PIMS

**Matched arrival**:
An arrival intake that confidently links to one current clinic appointment and patient record using the customer account or the contact number on the clinic record, allowing automatic check-in actions.
_Avoid_: Pending staff review for matched check-in

**Arrival identity**:
The customer, patient, and verified clinic contact used to match an arrival before collecting visit questions.
_Avoid_: Free-form check-in identity

**Arrival exception**:
An arrival that cannot be safely matched to one current appointment and needs front-desk help before full intake.
_Avoid_: Unmatched full intake

**Visit reason**:
The primary reason for today's matched appointment, defaulted from the appointment when known and confirmed by the customer during arrival.
_Avoid_: Main concern

**Arrival questionnaire**:
The concern-specific questions collected after arrival identity is matched, using a fixed clinic form whose questions and options can be edited by admin.
_Avoid_: Pre-match intake form

**Check-in room**:
A clinic-controlled room that can receive matched arrivals when room assignment is enabled.
_Avoid_: Seating

**Room assignment**:
The placement of a matched arrival into an available check-in room, with the clinic team able to override room state.
_Avoid_: Staff-confirmed recommendation

**Room turnover**:
The process of moving a room from occupied to cleaning to open after a visit is done, preferably from a PIMS signal with clinic-team fallback.
_Avoid_: Manual-only room release

## Implementation Map

- Task workflow: rules for task creation, status moves, archive/restore, escalation, assignment side effects, and audit meaning.
- Request intake: public or internal path that accepts clinic work and creates a task.
- Request intake guard: public request memory rate-limit, persistent rate-limit, duplicate detection, and guard-event writes.
- Request intake validation: public request schema and real-client/pet/request field validation.
- Request intake logging: structured request intake event logging with hashed request/client identifiers.
- Request form: public client UI that collects request intake fields and submits them to request intake.
- Internal task create request: staff/role create payload validation, source/status derivation, duplicate guard, and staff rate-limit guard.
- Internal task update request: edit/status/archive/restore/escalate payload validation, workflow checks, task persistence, and escalation notification trigger.
- Agent tool group: domain-owned agent tool definitions composed by the central agent tool registry.
- Clinic lookup tool group: agent tools for client, pet, appointment, slot, arrival match, and wait-status reads.
- Clinic booking tool group: agent tools for appointment booking holds and scheduler-intake capture.
- Clinic front-desk tool group: agent tools for check-in, pickup, status updates, clinic inbox messages, and triage dispatch.
- Agent clinic data projection: persisted mock clinic/task/approval/report rows shaped for agent runtime input.
- Agent JSON persistence policy: JSON coercion, redaction, truncation, and depth limits for persisted agent runs and tool traces.
- Mock clinic appointment lookup: normalized client, phone, and pet matching for same-day arrival appointments.
- Mock clinic snapshot query: aggregate persisted mock clinic clients, pets, appointments, slots, followups, invoices, messages, pricing, and lab data for agent runtime input.
- Mock clinic row projection: database row-to-contract mapping for mock clinic clients, pets, appointments, pricing, and lab data.
- Mock clinic pricing row projection: database row-to-contract mapping for service catalog rows and competitor pricing observations.
- Mock clinic pricing persistence: service catalog reads and competitor pricing observation writes for pricing agent workflows.
- Mock clinic lab row projection: database row-to-contract mapping for lab catalog, lab order, and lab result rows.
- Agent effect persistence: rules that turn agent draft tasks, reports, approvals, workflow events, and tool-call audit into persisted state.
- Operational mutation persistence: rules that turn successful state-changing agent tool calls into mock clinic state changes and linked workflow events.
- Public agent ingress: public workflow request validation, rate limiting, duplicate detection, and guard-event writes before agent execution.
- Report route adapter: manager-authenticated report listing route shell with report-specific data payloads.
- Veterinarian profile: notification delivery preferences, passcode identity, display name, and actor-reference history.
- Task board projection: role-specific lane membership, visible actions, counts, and display policy for clinic tasks.
- Task board state projection: blank/edit task form mapping and actor-name reconciliation for optimistic task-board state.
- Task board browser state: local session persistence, task cache invalidation, cross-tab sync payloads, and active-polling timing for the task board.
- Task board API adapter: browser request payloads, auth-error interpretation, and response normalization for task board reads/mutations.
- Task board settings state: notification settings loading, priority-alert toggles, veterinarian profile saves/deactivation, and settings sync signalling.
- Task board settings UI: veterinarian notification profile controls and end-of-day alert panel for the task board.
- Task transition persistence: status moves, completion/invalid/archive/undo/escalation writes, and transition audit metadata.
- Task audit persistence: task event writes, task event listing, and audit metadata JSON shape.
- Task write projection: task create/edit input normalization and SQL insert/patch row shaping.
- Task row projection: database row-to-contract mapping for task rows and task audit events.
- Agent row projection: database row-to-contract mapping for agent runs, workflow events, approvals, reports, and tool calls.
- Agent timeline query: read-side agent run, workflow event, approval, report, and tool-call listing plus run timeline assembly.
- Notification content: HTML/text rendering for task, escalation, summary, smoke, and agent-example notifications.
- Notification delivery planning: mode, channel, recipient, timezone, and opt-in target selection for notification sends.
- Notification send pipeline: idempotency keys, notification attempt lifecycle, Resend transport, and per-recipient send results.
- Account auth shell: portal brand panel, account tab selection, and routing between customer and staff auth forms.
- Customer auth form: pet-owner login/signup state and local account-store calls.
- Staff auth form: clinic-team login, one-time-password redemption, and local account-store calls.
- Auth password input: reusable password visibility toggle and autocomplete policy.
