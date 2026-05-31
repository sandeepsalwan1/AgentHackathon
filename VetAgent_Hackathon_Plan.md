# VetAgent — Hackathon Team Plan
**Event:** Applied Intelligence Hackathon · Theme: "Agents That Act"
**Track:** Healthcare
**Repo:** https://github.com/sandeepsalwan1/AgentHackathon
**Duration:** 6 hours · Team of 4

---

## The Pitch (2 min version)

> Vet clinics average 21–29 minutes of check-in wait time due to phone backlogs and front-desk bottlenecks. VetAgent eliminates that with two autonomous agents sharing one task engine — an external agent that handles every client-facing workflow, and an internal agent that multiplies staff capacity. Five sponsor integrations. Live demo. Real healthcare problem.

---

## What the Repo Already Has

### ✅ Already Built
- Next.js 16 monorepo (npm workspaces)
- `apps/internal` — staff task board UI
- `apps/client-request` — public client form
- `packages/db` — Postgres schema (`tasks`, `task_events`, `notification_events`)
- `packages/notifications` — Resend email helpers
- Task status enums: `pending_review`, `due`, `pending`, `completed`, `invalid`, `archived`
- Role system: `staff`, `task_adder`, `veterinarian`
- DB migration scripts (`npm run db:migrate`)
- Zod validation, TypeScript throughout
- Vercel deployment config (`vercel.internal.json`, `vercel.request.json`)

### ❌ Missing — Build This
- Claude API agent integration (zero AI currently)
- External agent: booking, check-in, pickup, escalation flows
- Internal agent: triage, records, invoice scan, pricing
- Supabase migration (currently uses raw Postgres/Neon)
- Supabase Realtime subscription for live task feed
- E2B sandbox integration for invoice/pricing scripts
- Opsera MCP call in records-transfer flow
- Apify actor trigger for competitor pricing research
- Client chat widget (external agent surface)
- Internal agent copilot panel in staff dashboard
- Supabase Storage for record PDFs
- Render deployment

---

## Final Stack

| Service | Role |
|---|---|
| **Claude API** | Both agents (external + internal) |
| **E2B** | Sandboxed microVM execution for invoice + pricing scripts |
| **Opsera** | MCP compliance audit before any records transfer fires — **prize track ($500/$300/$200)** |
| **Apify** | Competitor vet clinic price scraping |
| **Supabase** | Postgres DB + Auth + Storage + Realtime |
| **Render** | Deploy frontend + backend, shareable live URL for judges |

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT UI                                               │
│  apps/client-request  →  External agent chat + QR       │
│  apps/internal        →  Staff task board + copilot     │
│                                    [Render]              │
├─────────────────────────────────────────────────────────┤
│  AGENT LAYER                                             │
│  External Agent (Claude API)                             │
│    booking · check-in · pickup · sick-pet · records      │
│  Internal Agent (Claude API)                             │
│    triage · records · invoice scan · pricing research    │
│              [Opsera MCP]  [Apify]  [E2B]                │
├─────────────────────────────────────────────────────────┤
│  TOOL LAYER                                              │
│  /api/tools/* — REST endpoints, one per agent tool       │
│              [Supabase Edge Functions / Next.js routes]  │
├─────────────────────────────────────────────────────────┤
│  EXECUTION LAYER                                         │
│  Invoice anomaly scripts · Pricing diff · Records        │
│              [E2B — Firecracker microVM per run]         │
├─────────────────────────────────────────────────────────┤
│  DATA LAYER                                              │
│  Postgres (tasks, clients, pets, appts, invoices)        │
│  Realtime CDC → live task feed                           │
│  Storage → record PDFs                                   │
│              [Supabase]                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 6-Hour Timeline

| Time | Phase | Who |
|---|---|---|
| 0:00–0:45 | Foundation — schema alignment, Supabase setup, API contract | All 4 together |
| 0:45–2:30 | Core build — agents, tool routes, UI components | Parallel |
| 2:30–4:00 | Integration sprint — wire agents to live backend, test flows | Parallel |
| 4:00–5:00 | Polish — demo triggers, loading states, live feed animations | All |
| 5:00–6:00 | Rehearse + submit — run demo 3x, pitch prep, submit | All |

---

## Key Demo Flows (show these to judges)

### Flow 1 — Client check-in
```
Client texts "I'm here" 
  → External agent looks up appointment 
  → Creates "arrived" task 
  → Sends queue position 
  → Staff dashboard updates live via Supabase Realtime
```

### Flow 2 — Sick pet escalation
```
"My dog is sick, please help" 
  → Agent asks triage questions 
  → Classifies urgency level 
  → Creates urgent task with priority flag 
  → Notifies staff panel instantly
```

### Flow 3 — Records transfer with Opsera audit
```
Inbound request: "Send my records to another hospital" 
  → Internal agent identifies client + pet 
  → Fetches record PDFs from Supabase Storage 
  → Calls Opsera MCP → compliance audit result 
  → Draft transfer response shown to staff 
  → Staff approves → task marked complete
```

---

## Person 1 — Agent Engineer
**Owns:** Claude API · Opsera MCP · Apify · E2B  
**Files to create:** `packages/agents/`

### Hour 0–0:45 — Setup and contracts (with Person 2)
- [ ] Create `packages/agents/` directory in the monorepo
- [ ] Add to root `package.json`: `@anthropic-ai/sdk`, `@e2b/code-interpreter`
- [ ] Add env vars to `.env.example`: `ANTHROPIC_API_KEY`, `E2B_API_KEY`, `OPSERA_MCP_URL`, `APIFY_API_KEY`
- [ ] **Align with Person 2** on every tool function signature before writing a single agent tool call

### Hour 0:45–2:30 — External agent
- [ ] Create `packages/agents/external/agent.ts` — Claude API agent for client-facing workflows
- [ ] Create `packages/agents/external/prompts.ts` — system prompt (keep separate from logic)
- [ ] System prompt rules: no freeform medical advice, always escalate emergencies, confirm sensitive actions
- [ ] Define tool set (all call Person 2's API routes):
  - `lookup_client(name, phone)`
  - `lookup_pet(name, client_id)`
  - `list_slots(date_range)`
  - `book_appointment(client_id, pet_id, slot_id)`
  - `mark_arrived(appointment_id)`
  - `get_wait_status(appointment_id)`
  - `create_task(source, metadata)`
  - `send_sms(phone, message)`
- [ ] Export `runExternalAgent(messages, sessionId)` — Person 4 calls this from the chat widget route

### Hour 1:30–3:00 — Internal agent
- [ ] Create `packages/agents/internal/agent.ts` — Claude API agent for staff operations
- [ ] Create `packages/agents/internal/prompts.ts` — system prompt
- [ ] System prompt covers: inbox triage, records handling, invoice anomaly detection, pricing research, daily ops summary
- [ ] Define tool set:
  - `get_open_tasks(filters)`
  - `create_task(source, metadata)`
  - `update_task(id, fields)`
  - `draft_reply(context)`
  - `get_client_record(client_id)`
  - `prepare_records_packet(client_id, pet_id)` → triggers Opsera
  - `run_invoice_scan(invoice_data)` → calls E2B
  - `run_competitor_scan(location)` → calls Apify → E2B
  - `get_daily_ops_summary()`
- [ ] Export `runInternalAgent(prompt, sessionId)` — Person 3 calls this from the copilot panel

### Hour 2:00–3:30 — E2B sandbox tools
- [ ] Create `packages/agents/tools/e2b.ts`
- [ ] Implement `runInvoiceScan(invoiceData: InvoiceRow[])`:
  - Creates E2B sandbox via `Sandbox.create()`
  - Runs Python script: checks for duplicate line items, missing charges, price mismatches
  - Returns `{ flags: FlaggedItem[], summary: string }`
  - Closes sandbox after execution
- [ ] Implement `runPricingDiff(clinicPrices: ServiceRow[], competitorPrices: CompetitorRow[])`:
  - Runs comparison script in E2B
  - Returns list of over/under-priced services
- [ ] Register both as tools in the internal agent

### Hour 2:30–4:00 — Opsera MCP + Apify
- [ ] Create `packages/agents/tools/opsera.ts`
- [ ] Implement `auditRecordsTransfer(recordsPacket)`:
  - Calls Opsera MCP endpoint
  - Returns `{ status: "approved" | "flagged" | "blocked", reason: string }`
  - Wire into `prepare_records_packet()` tool — audit runs before task is created
- [ ] Create `packages/agents/tools/apify.ts`
- [ ] Implement `scrapeCompetitorPrices(location: string)`:
  - POST to Apify API to trigger vet-clinic price scraper actor
  - Poll for completion, return `CompetitorRow[]`
  - Chain: Apify result → E2B `runPricingDiff()` → structured report → task created

### Hour 4:00–5:00 — Integration + demo scenarios
- [ ] Test external agent end-to-end: "I'm here for my appointment" → tool calls fire → task in Supabase
- [ ] Test internal agent: "run invoice scan" → E2B fires → structured result returned
- [ ] Test records flow: agent → Opsera MCP → audit result → task with approval flag
- [ ] Create `packages/agents/demo/scenarios.ts` — three hardcoded demo payloads for Person 4's trigger buttons

> **Key constraint:** The existing `packages/db` has the `tasks` and `task_events` tables. Agent tool calls must reuse these exact table shapes. Call Person 2's tool endpoints — do not create a new tasks schema.

---

## Person 2 — Backend + Infra
**Owns:** Supabase · Render · All agent tool API routes  
**Files to create/modify:** `apps/internal/app/api/tools/`, `packages/db/src/realtime.ts`, new DB migrations

### Hour 0–0:45 — Supabase migration
- [ ] Create Supabase project
- [ ] Replace `DATABASE_URL`/`POSTGRES_URL` in `.env.example` with Supabase connection string
- [ ] Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Run existing migration against Supabase: `npm run db:migrate`
- [ ] Write new migration for VetAgent-specific tables:
  - `clients` (id, name, phone, email, created_at)
  - `pets` (id, client_id, name, species, breed, weight, created_at)
  - `appointments` (id, client_id, pet_id, slot_time, status, created_at)
  - `invoices` (id, client_id, pet_id, line_items jsonb, total, created_at)
  - `service_catalog` (id, name, price, category)
  - `competitor_price_snapshots` (id, competitor_name, service_name, price, scraped_at)
- [ ] Seed mock data: 5 clients, 8 pets, 10 appointments, 15 invoice line items, 20 service catalog entries → save as `db/seed/vet-sandbox.sql`
- [ ] Create Supabase Storage bucket `records`. Upload 3 mock PDF records for demo pets.

### Hour 0:45–2:30 — Agent tool API routes
Create `apps/internal/app/api/tools/` with one Next.js Route Handler per tool:

- [ ] `lookup-client/route.ts` — query `clients` by name or phone, return client + pet list
- [ ] `lookup-pet/route.ts` — query `pets` by name + client_id
- [ ] `list-slots/route.ts` — query `appointments` for available slots, return next 5 open
- [ ] `book-appointment/route.ts` — insert into `appointments`, return confirmation
- [ ] `mark-arrived/route.ts` — update appointment status to `arrived`, emit task_event
- [ ] `get-wait-status/route.ts` — count appointments ahead in queue, return position
- [ ] `create-task/route.ts` — **reuse existing** task insert logic from `packages/db`
- [ ] `get-open-tasks/route.ts` — query tasks by status, return sorted list
- [ ] `prepare-records-packet/route.ts` — fetch PDFs from Supabase Storage, bundle metadata, return packet for Opsera
- [ ] `get-invoice-summary/route.ts` — query `invoices` for a client/pet, return line items for E2B
- [ ] `get-service-catalog/route.ts` — return all service catalog entries
- [ ] `complete-records-transfer/route.ts` — finalize approved transfer, update task status

**Rules for all routes:** validate input with Zod, use Supabase service-role client server-side, never expose credentials to browser.

### Hour 2:00–3:00 — Supabase Realtime + agent-chat route
- [ ] Enable Realtime on the `tasks` table in Supabase dashboard
- [ ] Create `packages/db/src/realtime.ts` — export `subscribeToTasks(callback)` using `@supabase/supabase-js` channel subscription
- [ ] Create `apps/internal/app/api/agent-chat/route.ts`:
  - POST endpoint accepting `{ messages: Message[], agentType: "external" | "internal" }`
  - Calls Person 1's `runExternalAgent()` or `runInternalAgent()`
  - Streams response back to caller
  - **This is the single route both Person 3 and Person 4 depend on**

### Hour 3:00–4:30 — Render deployment
- [ ] Create two Render web services: one for `apps/internal`, one for `apps/client-request`
- [ ] Set all env vars in both Render services
- [ ] Verify both Render deploy URLs are live — share with team immediately
- [ ] Run `db:migrate` against Supabase to confirm schema is deployed
- [ ] Smoke test: submit client form → confirm task appears in internal Pending Review

> **Critical handoff:** Share the exact `/api/tools/` endpoint list with request/response shapes with Person 1 **by the end of hour 1**. Person 1 cannot write agent tool definitions without this. Paste in a shared doc or Discord channel.

---

## Person 3 — Staff Dashboard
**Owns:** `apps/internal` — React UI extensions, live task feed, internal agent copilot  
**Key rule:** Do not rewrite the existing task board — add new panels alongside it.

### Hour 0–0:45 — Understand existing UI
- [ ] Run `npm run dev:internal` locally
- [ ] Find the main dashboard page file (likely `apps/internal/app/page.tsx`)
- [ ] Map what already works vs what needs to be added — only add, don't rewrite

### Hour 0:45–2:30 — Live task feed
- [ ] Create `apps/internal/components/LiveTaskFeed.tsx`
- [ ] Import `subscribeToTasks()` from `packages/db/src/realtime.ts` (Person 2 builds this)
- [ ] Display a scrollable feed: agent action, task name, timestamp, which agent triggered it
- [ ] Color coding:
  - External agent actions → blue
  - Internal agent actions → amber
  - Human actions → gray
- [ ] Animate new entries sliding in from top (this is the judge "wow" moment)
- [ ] Embed as a right-side panel on the main dashboard
- [ ] Use static mock entries while waiting for Person 2's Realtime export

### Hour 1:30–3:00 — Internal agent copilot panel
- [ ] Create `apps/internal/components/AgentCopilot.tsx`
- [ ] Text input + send button. POST to `/api/agent-chat` with `agentType: "internal"`
- [ ] Stream the response token-by-token, render in chat-like view
- [ ] Show tool calls as they fire (judges need to see this):
  - "⚙ Running invoice scan in E2B..."
  - "⚙ Calling Opsera MCP..."
  - "⚙ Fetching competitor prices via Apify..."
- [ ] Show E2B results:
  - Invoice anomalies as a table (item, expected price, actual price, flag reason)
  - Pricing diff as two-column comparison (clinic price vs competitor price)
- [ ] Show Opsera audit result as a badge: 🟢 Approved / 🟡 Review Required / 🔴 Blocked
- [ ] Pre-load three demo prompt buttons:
  - "Scan today's invoices"
  - "Check competitor prices"
  - "What tasks need attention?"

### Hour 2:30–4:00 — Inbox triage + approve/reject
- [ ] Extend Pending Review column: show agent-generated draft replies for records requests
- [ ] Add Approve / Reject buttons on tasks with `requires_approval: true` in metadata
- [ ] On Approve → POST to `/api/tools/complete-records-transfer`
- [ ] On Reject → update task status to `invalid` using existing task update logic
- [ ] Add a "Records Transfer" filter tab to the task board
- [ ] Add "Show QR Code" button that displays the check-in QR (Person 4 provides the QR component)

> **Key dependency:** Person 3 needs Person 2's `realtime.ts` and `/api/agent-chat` route. Use mock data during hours 1–2 while Person 2 finishes, then swap in real calls.

---

## Person 4 — Client Portal + Demo
**Owns:** `apps/client-request` — external agent chat widget, QR check-in page, pitch  
**Key rule:** Keep the existing form 100% intact. Add the agent chat as a second surface.

### Hour 0–0:45 — Understand existing form
- [ ] Run `npm run dev:client` locally
- [ ] The existing form collects: name, phone, DOB, pet name, weight, last visit, request
- [ ] Plan where to add the agent chat widget (suggest: as the main landing, with existing form as fallback)

### Hour 0:45–2:30 — External agent chat widget
- [ ] Create `apps/client-request/components/AgentChat.tsx`
- [ ] Chat UI: message history, input bar, send button
- [ ] Mobile-first layout — large touch targets, readable at arm's length
- [ ] On send: POST to `/api/agent-chat` with `agentType: "external"` and messages array
- [ ] Stream response token-by-token
- [ ] When agent calls `create_task()`: show "Your request has been received ✓" inline confirmation card
- [ ] When agent calls `book_appointment()`: show booking confirmation card with slot time
- [ ] Add "New conversation" reset button (important for demo resets)
- [ ] Use a mocked API response during hours 1–2, swap to real endpoint when Person 2 is ready

### Hour 1:30–2:30 — QR check-in page
- [ ] Create `apps/client-request/app/checkin/page.tsx`
- [ ] Content: "Welcome to Central Veterinary Hospital" + AgentChat pre-loaded with "Hi! I'm here for my appointment."
- [ ] Create `apps/client-request/components/QRCode.tsx` using `qrcode` npm package, pointing to `/checkin`
- [ ] Confirm the flow on mobile: scan QR → page loads → type message → agent fires → task in staff dashboard
- [ ] Share QR component with Person 3 to embed "Show QR Code" button in staff dashboard

### Hour 3:00–4:30 — Demo scenarios + pitch
- [ ] Add three demo trigger buttons to chat widget (visible only with `?demo=true` in URL):
  - "Client Check-In" → inject check-in conversation
  - "Sick Pet Escalation" → inject sick pet conversation
  - "Records Transfer Request" → inject records request conversation
- [ ] Use the scenario payloads from Person 1's `packages/agents/demo/scenarios.ts`
- [ ] Test all three scenarios on the deployed Render URL
- [ ] Confirm the demo URL: `https://[your-render-url]/client?demo=true`

### Pitch script (2 minutes)

**Problem (20 sec):** Vet clinics average 21–29 minutes of check-in wait time. Phones are backed up. Staff are the bottleneck. Doctors are routing tasks manually.

**Solution (30 sec):** VetAgent has two autonomous agents sharing one task engine. The external agent owns every client-facing workflow. The internal agent is a force multiplier for staff — it scans invoices, researches competitor prices, handles records transfers with compliance auditing.

**Live demo (60 sec):** Show all three demo flows. Point to the live task feed updating in real time.

**Sponsor callouts (10 sec):**
> "E2B gives us microVM-isolated execution for patient data scripts — critical for healthcare. Opsera MCP audits every records transfer before it fires. Apify powers our pricing intelligence. Supabase Realtime drives this live feed. All deployed on Render."

**Scale (10 sec):** One clinic today. Multi-tenant architecture ready for any local business vertical.

> **Key dependency:** Person 4 needs Person 2's `/api/agent-chat` route and Person 1's `demo/scenarios.ts`. Build UI with mocked responses first — don't block on either.

---

## Critical Handoffs

| From → To | What | By when |
|---|---|---|
| **P2 → P1** | Exact `/api/tools/` endpoint list with request/response shapes | End of hour 1 |
| **P2 → P3** | `packages/db/src/realtime.ts` export (`subscribeToTasks`) | End of hour 2 |
| **P2 → P3 + P4** | `/api/agent-chat` route live on Render | End of hour 2 |
| **P1 → P4** | `packages/agents/demo/scenarios.ts` demo payloads | End of hour 3 |
| **P4 → P3** | QR code component for staff dashboard embed | End of hour 2 |

---

## New Environment Variables to Add

```bash
# Claude agents
ANTHROPIC_API_KEY=

# E2B sandboxed execution
E2B_API_KEY=

# Opsera MCP
OPSERA_MCP_URL=
OPSERA_API_KEY=

# Apify
APIFY_API_KEY=

# Supabase (replaces raw DATABASE_URL)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## New Directory Structure

```
AgentHackathon/
  apps/
    internal/
      app/
        api/
          agent-chat/route.ts        ← NEW: P2
          tools/
            lookup-client/route.ts   ← NEW: P2
            lookup-pet/route.ts      ← NEW: P2
            list-slots/route.ts      ← NEW: P2
            book-appointment/route.ts ← NEW: P2
            mark-arrived/route.ts    ← NEW: P2
            get-wait-status/route.ts ← NEW: P2
            create-task/route.ts     ← NEW: P2
            get-open-tasks/route.ts  ← NEW: P2
            prepare-records-packet/route.ts ← NEW: P2
            get-invoice-summary/route.ts    ← NEW: P2
            get-service-catalog/route.ts    ← NEW: P2
      components/
        LiveTaskFeed.tsx             ← NEW: P3
        AgentCopilot.tsx             ← NEW: P3
    client-request/
      app/
        checkin/page.tsx             ← NEW: P4
      components/
        AgentChat.tsx                ← NEW: P4
        QRCode.tsx                   ← NEW: P4
  packages/
    agents/                          ← NEW directory
      external/
        agent.ts                     ← NEW: P1
        prompts.ts                   ← NEW: P1
      internal/
        agent.ts                     ← NEW: P1
        prompts.ts                   ← NEW: P1
      tools/
        e2b.ts                       ← NEW: P1
        opsera.ts                    ← NEW: P1
        apify.ts                     ← NEW: P1
      demo/
        scenarios.ts                 ← NEW: P1
    db/
      src/
        realtime.ts                  ← NEW: P2
      migrations/
        002_vetagent_tables.sql      ← NEW: P2
      seed/
        vet-sandbox.sql              ← NEW: P2
```

---

## Quick Commands

```bash
# Install deps (after adding new packages)
npm install

# Local dev
npm run dev:internal    # Staff dashboard on :3000
npm run dev:client      # Client portal on :3001

# DB
npm run db:migrate      # Run all migrations against Supabase

# Type check everything
npm run typecheck
```

---

*Last updated: hackathon day. Built on top of sandeepsalwan1/AgentHackathon.*
