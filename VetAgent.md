# VetAgent — Complete Product Intent, Missing Context, and Final Agent-Centric Plan

This document is a revised, fuller implementation brief for VetAgent. It is meant to be handed to another AI or engineer so they can understand the complete intent, missing context, exact priorities, constraints, architecture, and execution plan.

This version explicitly adds the details that were previously underemphasized:

- The current top priority is **internal and external agents**.
- A **task manager already exists** in a Tri-City Veterinary Hospital implementation and should be reused.
- There is **not yet reliable access to all integrations**, so the early system must be designed to work with **mock data, simulated adapters, and local mirrors** until real integrations are available.
- The **internal agent** must do more than tasks and inbox work. It should also handle records-switch workflows, internal grunt work, invoice/admin support, and recurring competitor/price research.
- The **external agent** must handle real end-to-end client workflows such as check-in, booking, requests, status updates, and follow-ups.

---

## 1. Plain-English product intent

VetAgent is an AI-native operating layer for veterinary hospitals first, and later for many kinds of local businesses. The point is not to build a toy chatbot. The point is to build a system that can take action based on context, chain reasoning and tools together, and solve real hospital problems end to end.

The long-term vision is:

- start with real veterinary hospitals,
- automate high-friction operations,
- reduce grunt work and missed follow-up revenue,
- sit on top of incumbent systems at first,
- eventually become the modern operating layer for the business.

The founder intent is:

- move extremely fast,
- avoid a high-touch services business,
- make onboarding and operations as automated as possible,
- build around reusable agents and reusable workflows,
- reuse existing work where possible,
- prioritize software over hardware,
- prefer web over native apps,
- scale from one clinic to many clinics and later to many local-business verticals.

---

## 2. What is already true

### 2.1 Existing work already done

A version has already been built for Tri-City Veterinary Hospital.

That existing work has two parts:

1. A task manager.
2. The broader agent vision.

This means VetAgent should **not** start by rebuilding task management from scratch. The existing task manager should be treated as a reusable core module that agents can read from and write to.

### 2.2 Current hospital context

The hospital context described includes:

- no real digital check-in,
- old intake software that staff can learn but is not a great experience,
- major phone backlog,
- long wait times,
- lots of operational grunt work,
- record-switch requests when clients move hospitals,
- “my dog is sick, please help” inbound messages,
- weak or underused internal task tracking,
- poor follow-up automation,
- fragmented software across PMS, reminders, labs, outreach, and communications.

Busy clinics can experience average check-in and check-out waits of roughly 21 to 29 minutes during busy visits, which fits the observed complaints about phone and front-desk backlog.[cite:81]

---

## 3. Core product thesis

The thesis is:

> Veterinary hospitals use too many disconnected systems, still do too much manual work, and lose both time and revenue because the client-facing and staff-facing workflows are not unified.

So VetAgent should be:

- one AI-native workflow layer,
- with one external agent,
- one internal agent,
- one shared task engine,
- and one normalized data model,
- sitting on top of incumbent systems where needed.

The external agent handles the outside of the business.
The internal agent handles the inside of the business.
The task engine is the execution memory and work queue between them.

---

## 4. Final priorities for this version

This is the actual priority stack implied by the conversation.

### Priority 1 — External agent

The external agent is the most visible product surface and should own:

- booking,
- check-in,
- intake guidance,
- pickup and drop-off workflows,
- status updates,
- follow-ups,
- campaign-triggered reactivation,
- turning client requests into structured actions.

### Priority 2 — Internal agent

The internal agent is the force multiplier and should own:

- inbox triage,
- task prioritization,
- record-switch workflows,
- invoice/admin help,
- drafting replies,
- operational suggestions,
- competitor research,
- recurring price review,
- and other internal grunt work.

### Priority 3 — Reuse the existing task manager

The task system already exists conceptually and should act as the common execution substrate.

### Priority 4 — Build without depending on perfect integrations

Because there is not yet reliable access to every real integration, the system must be built so the agents work with:

- local mock data,
- fake adapters,
- internal test clinics,
- and a normalized local database.

Then, real integrations can be plugged in later.

### Priority 5 — Add real integrations incrementally

Real integrations should come after the core agent workflows are proven with mocks and local data.

---

## 5. The most important architecture decision

### Build the product so agents do not depend on live integrations

This is one of the most important missing details.

Right now, real integration access may be incomplete or unavailable. That means the system cannot be designed in a way where the agents only work if Avimark, Cornerstone, Idexx, Demandforce, or other systems are already connected.

So the architecture must support three execution modes:

### Mode A — Mock mode

Used during early development.

- Fake appointments.
- Fake clients and pets.
- Fake invoices.
- Fake lab results.
- Fake queue state.
- Fake tasks.
- Fake pricing datasets.

This lets the agent workflows be built immediately.

### Mode B — Mirror mode

Used when some real data is available but write access is limited.

- Import CSVs or exports.
- Pull read-only snapshots.
- Store normalized local copies.
- Let agents reason over local state.
- Require manual approval for actions that must be performed in an external system.

### Mode C — Live integration mode

Used when real adapters exist.

- Read/write real appointments.
- Send real messages.
- Sync real records.
- Pull real invoices.
- Pull real lab results.

This design lets you move fast now instead of waiting for perfect integration access.

---

## 6. Incumbent systems discussed

The systems discussed across the conversation include:

- Avimark as a veterinary practice-management system with scheduling, invoicing, reminders, records, and other operational features.[cite:69][cite:72][cite:79]
- Cornerstone as a major practice-management backbone with official integration defaults and ecosystem integrations.[cite:34][cite:61]
- Idexx as a lab/diagnostics provider integrated into clinic workflows.[cite:52][cite:60]
- Antech as a diagnostics/lab integration provider rather than a full front-desk replacement.[cite:54][cite:57][cite:59][cite:66]
- Demandforce or similar client communication/reminder tools for outreach and follow-ups.[cite:70][cite:73][cite:77][cite:80]

The product should treat these as providers behind adapters, not as logic embedded directly into the agents.

---

## 7. Final system model

VetAgent should be built from four core layers.

### Layer 1 — Agent layer

- External agent.
- Internal agent.
- Optional router/handoff logic.

### Layer 2 — Tool layer

All agent capabilities exposed as generic tools.

### Layer 3 — Workflow and task layer

- Task manager.
- Approval queues.
- Workflow runs.
- Event logs.

### Layer 4 — Data and integration layer

- normalized local DB,
- mock providers,
- provider adapters,
- syncing/import/export jobs.

This means the AI is never directly tied to one vendor. It works through a stable interface.

---

## 8. External agent — complete plan

The external agent is the client-facing automation layer.

### 8.1 External agent mission

The external agent should:

- reduce calls,
- reduce front-desk bottlenecks,
- improve booking,
- improve wait-time transparency,
- improve check-in,
- improve pickup/drop-off flows,
- improve follow-ups,
- convert more reminders into revenue,
- and turn client requests into structured, trackable work.

### 8.2 External agent workflows

The external agent should support:

- appointment booking,
- appointment rescheduling,
- appointment cancellation,
- pre-visit intake,
- arrival and check-in,
- queue status,
- “I’m here” flow,
- pickup pet flow,
- pickup meds flow,
- drop-off boarding flow,
- food/product order flow,
- pet-ready notifications,
- post-visit follow-up,
- reactivation campaigns,
- and escalation of ambiguous or urgent messages.

### 8.3 External agent examples

Examples of what the external agent should handle:

- “I’m outside, I’m here for my appointment.”
- “Can I schedule vaccines next week?”
- “Can I pick up my dog now?”
- “Can I pick up medication?”
- “I need records sent to another hospital.”
- “My dog is sick, please help.”
- “I need to order food.”
- “Is my pet ready?”

### 8.4 External agent tool set

Suggested tools:

- `lookup_client()`
- `lookup_pet()`
- `create_client()`
- `create_pet()`
- `list_slots()`
- `book_appointment()`
- `reschedule_appointment()`
- `cancel_appointment()`
- `start_checkin()`
- `update_intake_answers()`
- `get_wait_status()`
- `mark_arrived()`
- `send_sms()`
- `send_email()`
- `create_task()`
- `trigger_followup()`
- `trigger_campaign()`
- `request_records_transfer()`

### 8.5 External agent safety rules

- No freeform medical advice.
- Escalate emergencies.
- Escalate ambiguous sick-pet cases.
- Confirm sensitive actions.
- Use tools, not hallucinations.
- Create tasks when staff review is required.

### 8.6 External agent UI surfaces

- Website widget.
- Public portal.
- QR check-in flow.
- SMS deep links.
- Email-driven links.
- Future voice/call transcript handoff.

---

## 9. Internal agent — complete plan

The internal agent is the staff-side operations agent and was previously under-specified. This section fills that gap.

### 9.1 Internal agent mission

The internal agent should:

- reduce internal grunt work,
- reduce dropped requests,
- reduce follow-up failures,
- reduce admin overhead,
- improve staff response speed,
- surface what matters now,
- and improve revenue opportunities.

### 9.2 Internal agent core jobs

The internal agent should do all of the following:

- triage emails and inbound messages,
- turn messy requests into structured tasks,
- prioritize work,
- draft replies,
- manage records requests,
- help with invoices and billing/admin workflows,
- help generate or prepare records,
- surface overdue follow-ups,
- review competitor pricing periodically,
- suggest pricing adjustments or pricing-review tasks,
- summarize operational status,
- and coordinate the internal execution side of the clinic.

### 9.3 Internal agent competitor and pricing role

This was an important missing piece.

The internal agent should have a recurring market-research workflow:

- periodically look at local or comparable competitor pricing,
- compare the clinic’s current services and prices,
- identify categories where the clinic may be underpriced, overpriced, or inconsistent,
- create a report or task for staff review,
- optionally recommend specific price changes,
- and maintain a history of pricing observations over time.

Important note: this should generally be **recommendation + approval**, not autonomous repricing.

### 9.4 Internal agent records-switch role

This was another key missing piece.

If a client wants to switch hospitals or requests records, the internal agent should:

- detect the request from email, portal, or call notes,
- identify the client and pet,
- gather required record artifacts,
- prepare the transfer packet,
- create the task or approval request if review is needed,
- send the records automatically if rules allow,
- or draft the records-transfer communication for staff approval.

This should become one of the clearest end-to-end workflows in the product because it is repetitive, annoying, and easy to standardize.

### 9.5 Internal agent invoice/admin role

The internal agent should:

- review invoices or invoice summaries,
- detect missing or suspicious charges,
- highlight incomplete administrative items,
- create tasks for follow-through,
- draft messages related to billing/admin questions,
- and surface work that tends to be forgotten.

### 9.6 Internal agent examples

Examples of things the internal agent should handle:

- “Summarize all outstanding tasks today.”
- “Which record-transfer requests are still open?”
- “Draft a reply to this client saying we received their request.”
- “Show me clients whose pets are overdue for vaccines.”
- “Look at local competitor prices and flag anything weird.”
- “Find possible missed invoice items.”
- “What should front desk do next?”

### 9.7 Internal agent tool set

Suggested tools:

- `get_open_tasks()`
- `create_task()`
- `update_task()`
- `summarize_inbox_item()`
- `draft_reply()`
- `send_reply()`
- `get_client_record()`
- `prepare_records_packet()`
- `request_records_transfer()`
- `get_invoice_summary()`
- `flag_invoice_issue()`
- `get_followup_candidates()`
- `create_followup_task()`
- `run_competitor_scan()`
- `compare_service_prices()`
- `create_price_review_report()`
- `get_daily_ops_summary()`

### 9.8 Internal agent safety rules

- No silent billing changes.
- No autonomous pricing changes without approval.
- No silent release of sensitive records unless allowed by explicit workflow rules.
- Always attach recommendations to tasks, records, or reports.
- Preserve audit logs.

---

## 10. Task manager role in the new system

The task manager is no longer the main product. It is the execution fabric.

That means:

- every agent can create tasks,
- every workflow can emit tasks,
- every missed action becomes trackable,
- and staff can see work in one place.

The task manager should receive tasks from:

- portal submissions,
- agent decisions,
- email ingestion,
- phone notes,
- record-transfer workflows,
- invoice-review workflows,
- follow-up workflows,
- competitor-pricing workflows.

The task manager should expose:

- queue by priority,
- queue by role,
- queue by staff owner,
- queue by due time,
- queue by workflow type,
- and queue by blocked/waiting state.

---

## 11. Build strategy without integrations

Because live integrations are not yet guaranteed, the recommended build approach is:

### Stage A — Build full agent behavior on mocks

Create a realistic veterinary sandbox dataset:

- clients,
- pets,
- appointments,
- visits,
- tasks,
- records,
- invoices,
- service catalog,
- competitor pricing snapshots,
- campaign cohorts.

Then build the external and internal agents against that simulated environment.

### Stage B — Add importable local data

Support:

- CSV import,
- manual admin entry,
- JSON fixtures,
- spreadsheets,
- one-time exports from incumbent systems.

This gives a bridge from fake data to semi-real environments.

### Stage C — Add real adapters later

Once real credentials and access exist, map provider capabilities to the same generic tools.

This avoids blocking product development on integration politics.

---

## 12. Provider and capability model

The correct abstraction is **capabilities**, not vendor names.

Suggested capabilities:

- `schedule.read`
- `schedule.write`
- `visit.create`
- `visit.update`
- `client.read`
- `client.write`
- `pet.read`
- `pet.write`
- `records.export`
- `records.transfer`
- `invoice.read`
- `invoice.flag`
- `lab.results.read`
- `message.send`
- `campaign.send`
- `task.sync`

Providers then declare what they support.

Example:

- Avimark: scheduling, records, invoices, reminders-related data, maybe more depending on access.[cite:69][cite:72][cite:79]
- Cornerstone: practice-management workflows and integration defaults.[cite:34][cite:61]
- Idexx: lab-related data and diagnostics.[cite:52][cite:60]
- Antech: lab-related requests/results, not the full clinic workflow.[cite:54][cite:57][cite:59][cite:66]
- Demandforce: messaging/outreach layer rather than the full operating system.[cite:70][cite:73][cite:77][cite:80]

---

## 13. Data model

Suggested normalized entities:

- `tenant`
- `location`
- `staff_user`
- `client`
- `pet`
- `appointment`
- `visit`
- `intake_response`
- `message`
- `task`
- `records_request`
- `invoice`
- `service_catalog`
- `competitor_price_snapshot`
- `followup_campaign`
- `workflow_run`
- `integration_config`
- `provider_capability`
- `audit_log`

The important point is that even without live integrations, the local model should already exist and be complete enough for the agents to work.

---

## 14. Agent runtime recommendation

Use the OpenAI Agents SDK first because it gives production-relevant primitives around agents, tools, handoffs, guardrails, and tracing.[cite:82][cite:85][cite:89][cite:92]

Use LangGraph later if the workflow graph becomes significantly more stateful, explicit, looping, or orchestration-heavy than the initial system requires.[cite:87][cite:90][cite:96]

This means the practical first design is:

- one external agent,
- one internal agent,
- optional router/handoff,
- tool-driven actions,
- guardrails,
- trace logging,
- approval checkpoints.

---

## 15. Human-in-the-loop policy

Not every action should be autonomous. Human-in-the-loop oversight is important for riskier workflows in enterprise and agentic systems.[cite:88][cite:91][cite:94]

Recommended policy:

### Fully automated

- low-risk reminders,
- low-risk status texts,
- simple task creation,
- queue updates,
- internal summaries,
- low-risk follow-up nudges.

### Draft + approval

- records transfer,
- billing responses,
- invoice changes,
- competitor-pricing recommendations,
- ambiguous client communications,
- medical-ish inbound email handling.

### Never autonomous

- medical diagnosis,
- care recommendations outside approved scripts,
- unreviewed major pricing changes,
- any sensitive irreversible action.

---

## 16. Product surfaces

### Public/client-facing surfaces

- booking page,
- check-in page,
- status page,
- intake page,
- pickup flow,
- order-food/products flow,
- follow-up links,
- QR-linked portal,
- website widget/chat.

### Staff-facing surfaces

- task board,
- queue dashboard,
- inbox triage screen,
- records-transfer queue,
- invoice/admin review pane,
- internal-agent copilot pane,
- daily summary screen,
- pricing/competitor review screen.

---

## 17. Specific workflows to build first

Because the user explicitly said to focus on the agents, the first workflows should be agent-dominant workflows, not pure CRUD pages.

### External-agent-first workflows

1. Booking request → slot suggestion → confirmation.
2. Arrival/check-in → queue status → room-ready update.
3. Pickup request → status lookup → pickup notification.
4. “My dog is sick, please help” → guided triage → escalate/create task.
5. “Send my records to another hospital” → intake info → create internal workflow.
6. Follow-up reminder → one-click response → appointment/task creation.

### Internal-agent-first workflows

1. Inbox item → summarize → classify → create task.
2. Records-switch request → gather data → prepare packet → send/draft.
3. Daily ops digest → rank tasks and blockers.
4. Invoice scan → flag anomalies → create review task.
5. Competitor pricing scan → compare to current catalog → create report.
6. Follow-up opportunity scan → create cohort → external agent sends outreach.

---

## 18. Execution roadmap

### Phase 0 — foundation

- create monorepo,
- define schema,
- import/reuse Tri-City task manager,
- define generic tool interfaces,
- create mock provider layer,
- create veterinary seed dataset.

### Phase 1 — external agent MVP

- build external agent on mock data,
- build booking flow,
- build check-in flow,
- build pickup flow,
- build request-to-task flow,
- build notifications.

### Phase 2 — internal agent MVP

- inbox triage,
- records-transfer workflow,
- task prioritization,
- daily ops summary,
- draft replies,
- invoice/admin helpers.

### Phase 3 — pricing and competitor intelligence

- add competitor scan job,
- normalize service catalog,
- compare internal and competitor prices,
- create internal report and price-review tasks,
- no autonomous repricing yet.

### Phase 4 — bridge to semi-real data

- CSV import,
- spreadsheet import,
- manual admin tools,
- read-only snapshots from incumbent systems.

### Phase 5 — live integrations

- add first real provider adapter,
- add validation and sync,
- add approval-backed live actions,
- measure what still breaks.

### Phase 6 — multi-clinic automation

- tenant bootstrap,
- provider templates,
- default workflow installation,
- QR generation,
- per-clinic configuration presets.

---

## 19. Recommended repo structure

```text
VetAgent-platform/
  backend/
    app/
    agents/
      external/
      internal/
      router/
    tools/
    workflows/
    providers/
      mock/
      avimark/
      cornerstone/
      idexx/
      antech/
      demandforce/
    tasks/
    pricing/
    inbox/
    records/
    billing/
    models/
    jobs/
    cli/
  frontend/
    portal/
    staff/
  docs/
    product/
    architecture/
    prompts/
  infra/
```

---

## 20. Recommended CLI surface

```bash
VetAgent dev up
VetAgent dev down
VetAgent db migrate
VetAgent db seed --dataset vet-sandbox
VetAgent tenant create "Tri-City Veterinary Hospital" --slug tri-city
VetAgent provider enable mock --tenant tri-city
VetAgent workflow install default-vet --tenant tri-city
VetAgent agent test external --tenant tri-city --scenario booking
VetAgent agent test external --tenant tri-city --scenario checkin
VetAgent agent test internal --tenant tri-city --scenario records-transfer
VetAgent agent test internal --tenant tri-city --scenario pricing-review
VetAgent import csv appointments.csv --tenant tri-city
VetAgent import csv clients.csv --tenant tri-city
VetAgent integration connect avimark --tenant tri-city
VetAgent integration validate --tenant tri-city
VetAgent agent trace --run-id <id>
```

---

## 21. The real product bet

The biggest product bet is not “AI chat.”

The real bet is:

- the external agent reduces friction and captures demand,
- the internal agent reduces dropped work and increases operational leverage,
- the task engine ensures nothing disappears,
- and the system turns fragmented software into one operating layer.

That is the thing that makes this scalable instead of turning it into a consulting project.

---

## 22. Builder handoff prompt

Use this if another AI is going to build the system:

> Build VetAgent as a multi-tenant veterinary operations platform with two main agents and a shared task engine. Reuse the existing Tri-City task-manager concept instead of rebuilding it. Focus first on the external and internal agents. The external agent handles booking, check-in, intake, pickup/drop-off, status updates, follow-ups, and turning client requests into structured actions. The internal agent handles inbox triage, records-switch workflows, task prioritization, invoice/admin assistance, competitor price research, and internal recommendations. Build the system so it works even before real integrations exist by using mock providers, local normalized data, and mirror mode. Put Avimark, Cornerstone, Idexx, Antech, and Demandforce-like systems behind capability-based adapters later. Use generic tools, guardrails, tracing, and human-approval flows. Optimize for rapid development, low-touch onboarding, and long-term reuse across clinics and eventually other local-business verticals.[cite:34][cite:61][cite:69][cite:70][cite:79][cite:82][cite:85][cite:88][cite:90]
