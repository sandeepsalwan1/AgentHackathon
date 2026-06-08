# PIMS Permission Packet — Email Command Center

Last updated: 2026-06-08. This is your one-stop file to get IDEXX / ezyVet access moving. The three emails below are **already saved as Gmail drafts** — you mostly just hit Send.

Pilot clinic: **Tricity Veterinary Hospital** (Cornerstone). Sender: **Sandeep Salwan, Founder, VetAgent** (salwansandeep5@gmail.com).

---

## ✅ What's already done

- Researched the real IDEXX path (see `docs/pims-integration.md`). The official front door is the **IDEXX Integration Request Form** (a web form) plus a routed support email.
- Wrote three polished, human, professional emails — and **saved them as Gmail drafts** in your account, ready to send.
- Baked in your pilot clinic (Tricity, Cornerstone) and your name/email so there's almost nothing to type.

## 👉 What to do next (in order — ~15 minutes)

1. **Fill 2 blanks once.** In each draft, replace `[your phone]` and `[your website]` with your real phone and the VetAgent site (or just delete those two lines if you don't have them yet). That's the only edit the two IDEXX drafts need.
2. **Send Draft 1 — IDEXX / Cornerstone.** Open the draft titled *"VetAgent — IDEXX integration partner request"* (to `cornerstone@idexx.com`) and hit Send.
3. **Send Draft 2 — ezyVet.** Open *"VetAgent — ezyVet API commercial partnership inquiry"* (to `apisupport-ezyvet@idexx.com`) and hit Send.
4. **Send Draft 3 — Tricity authorization (biggest accelerator).** Open *"Quick favor — one note to your IDEXX rep…"*. Change the **To** field to your Tricity contact's email, fill the bracketed clinic details, then Send. A request from the clinic moves the review faster than anything else.
5. **Submit the web form** if you haven't already: https://www.idexx.com/en/veterinary/software-services/idexx-practice-management-software-integration-request-form/ — answers are ready in `docs/pims-integration.md` section 8. Select **Cornerstone**.
6. **Log it.** Note the date you sent each one. If IDEXX goes quiet for ~2 days, use the phone script below and ask for a ticket/reference number.

> The only blanks anywhere: **your phone, your website, and the Tricity contact's email + clinic address/ID** (Draft 3). Everything else is filled in.

---

## The three emails (same text as the Gmail drafts)

### Draft 1 — IDEXX / Cornerstone (Data Services)

To: `cornerstone@idexx.com`
Subject: VetAgent — IDEXX integration partner request (Cornerstone, pilot clinic ready)

> If you already submitted the web form, you can add one line at the top: "I recently submitted the IDEXX Integration Request Form and am following up to make sure it reached the right team."

```text
Dear IDEXX Integration Team,

My name is Sandeep Salwan, and I am the founder of VetAgent, a front-desk workflow tool for veterinary clinics. I am writing to request the approved path to becoming an IDEXX integration partner for Cornerstone, and to make sure my request reaches the Data Services / Practice Management Software integrations team.

To give you some context on why this is timely: we are working with Tricity Veterinary Hospital, a Cornerstone practice, as our pilot clinic. They are ready to authorize the integration, so we have a real, named clinic asking for this. Today their staff re-key information by hand between VetAgent and Cornerstone, and we would like to replace that manual step with a proper, supported connection rather than any unsupported database access, scraping, or shared logins.

The scope we have in mind is small and read-mostly, to keep the security review light:

- Read: upcoming appointments and the matching client and patient details, plus lab and diagnostic results where available, so staff see the right context for each request.
- Write (later, and optional): a single staff-approved visit note saved back to the patient record, and a follow-up reminder if permitted. A staff member approves every write first, and we are happy to begin entirely read-only for phase one.
- Security: OAuth credentials only, encrypted in transit and at rest, separate credentials per clinic, least-privilege scopes, full audit logging, and clinic authorization the practice can revoke at any time.

I have reviewed the IDEXX Data Services documentation and we are already building against the public Cornerstone spec, so we can move quickly to sandbox and certification. I can provide our pilot clinic's authorization, a workflow overview, the exact endpoint list, a security summary, and a demo environment whenever it is useful.

Could you let me know the right next step for sandbox and API review, and the best reference or ticket number to use for follow-up?

Thank you for your time. I look forward to working with the IDEXX team.

Best regards,

Sandeep Salwan
Founder, VetAgent
salwansandeep5@gmail.com
[your phone]
[your website]
```

### Draft 2 — ezyVet API (parallel track)

To: `apisupport-ezyvet@idexx.com`
Subject: VetAgent — ezyVet API commercial partnership inquiry

```text
Dear ezyVet API Team,

My name is Sandeep Salwan, founder of VetAgent, a front-desk workflow product for veterinary clinics. We are applying to become a commercial ezyVet API partner, and I would like to understand the right next step and a few practical details before we begin development.

VetAgent helps clinics manage everyday front-desk work: check-ins, booking requests, records requests, pickups and follow-ups, client messages, and staff-reviewed drafts. Today, clinics run VetAgent alongside their practice software and re-enter approved notes and context by hand. We want to remove that double entry through the supported API, while keeping staff approval and full auditability in place.

The scope we are planning is small and read-first:

- Read: contacts and clients, animals and patients, appointments and appointment status, availability, and diagnostic or lab records where available.
- Write (later, and optional): a staff-approved note, task, or appointment update, only where supported and approved. Read-only is fine for phase one.
- Security: OAuth client-credential flow, separate credentials per clinic, encrypted credential storage, least-privilege scopes, audit logging, no shared logins, and revocable clinic access.

Our first pilot clinic, Tricity Veterinary Hospital, is on Cornerstone, and we are requesting the IDEXX Data Services path for them separately. We would like ezyVet support ready in parallel, so we can onboard ezyVet practices as soon as they come on.

Could you confirm the correct commercial partnership next step, the mutual-clinic details you need, the sandbox process, the write-back fee schedule, and any scope or rate-limit constraints we should plan around?

Thank you very much for your help.

Best regards,

Sandeep Salwan
Founder, VetAgent
salwansandeep5@gmail.com
[your phone]
[your website]
```

### Draft 3 — Tricity clinic authorization (highest leverage)

To: **your Tricity contact** (the draft is parked in your own inbox — change the To field before sending)
Subject: Quick favor — one note to your IDEXX rep to speed up the VetAgent integration

Sandeep sends this to the Tricity contact; they forward the inner note to their IDEXX rep and CC Sandeep.

```text
Hi [Tricity contact first name],

Thank you again for partnering with us on VetAgent. There is one quick thing that would genuinely speed up the IDEXX integration: a short note from Tricity to your IDEXX or Cornerstone account contact, authorizing them to discuss the integration with us. A request that comes from the clinic moves the review along far faster than anything we can send on our own.

If it is easy, would you mind sending the note below to your IDEXX/Cornerstone contact and copying me? Please feel free to edit anything.

----------

Dear IDEXX Team,

Tricity Veterinary Hospital uses Cornerstone, and we would like to evaluate VetAgent as an integration partner for our front-desk workflow.

We authorize IDEXX to discuss VetAgent's integration request with them on our behalf, and to evaluate VetAgent for sandbox, pilot, or approved API access under your normal process. The integration we want is narrow: read appointment, client, patient, and lab-result context to match incoming client requests, and optionally save a staff-approved note back to the record if you approve write-back. There is no direct database access, no screen scraping, and no shared logins.

Clinic details:
- Clinic: Tricity Veterinary Hospital
- Address: [clinic address]
- Website: [clinic website]
- PIMS: Cornerstone
- IDEXX account / customer ID (if handy): [ID]
- Clinic contact: [name, title, email, phone]

Please route this to the team that handles IDEXX PIMS / Data Services integration requests.

Thank you,
[Clinic contact name]

----------

Thanks so much — this really helps.

Best regards,

Sandeep Salwan
Founder, VetAgent
salwansandeep5@gmail.com
```

---

## If IDEXX goes quiet — phone script

Call one of these and ask to be routed to PIMS integrations / Data Services:

- Cornerstone software/hardware: 1-800-695-2877
- Practice Solutions: 1-888-224-4408
- ezyVet: 1-844-439-9838
- Email/chat fallback: `cornerstone@idexx.com` / `idexx.com/cschat`

```text
Hi, I'm Sandeep Salwan with VetAgent. I submitted the IDEXX Practice Management Software Integration Request Form and emailed about it, and I'm following up to make sure it reached the team that handles PIMS integrations and Data Services API access.

We are not asking for database access or scraping — just the approved API path for a small integration: read appointments, clients, patients, and lab context, and optionally write a staff-approved note. We have a mutual clinic, Tricity Veterinary Hospital on Cornerstone, ready to authorize it.

Can you create or find the ticket, attach this, and route it to the integrations / Data Services / Practice Solutions partner team? What reference number should I use for follow-up?
```

Before hanging up, get: **ticket/reference number, team it was routed to, rep name, expected response date, and the email for attachments.**

---

## Reference: paste-under-any-email overview

```text
VetAgent integration overview

Product: VetAgent helps veterinary clinics manage front-desk workflows — client requests, arrival/check-in, booking requests, records requests, pickup/follow-up work, internal tasks, and staff-reviewed drafts.

Problem: Without a PIMS integration, staff manually look up appointments, clients, patients, and lab context, then copy approved notes back into the system of record. That creates double entry and avoidable mistakes.

Phase 1 (requested): Read-only API access for appointment, client, patient, and lab/result context so VetAgent can match work to the right record.

Phase 2 (later): Narrow write-back for staff-approved notes or status updates, only where officially supported.

Controls: Staff approve every write. Tenant-specific credentials. Least-privilege scopes. Encryption in transit and at rest. Audit logs. No direct database access. No scraping. No shared logins. Clinic can revoke access.

Pilot: Tricity Veterinary Hospital (Cornerstone), plus a demo system, endpoint list, workflow docs, and security-review material on request.
```

## Reference: security FAQ

```text
Direct database access? No — official API / approved partner path only.
Scrape the PIMS UI? No.
Shared clinic logins? No.
Can a clinic revoke access? Yes — tenant-specific and revocable by the clinic.
Do staff approve writes? Yes — every write-back is staff-approved; read-only phase 1 is fine.
What data is stored? Only the minimum to route and audit clinic work: matched client/patient/appointment IDs, task context, approved notes/messages, and run/audit metadata. We do not sell clinic data.
Credential storage? Encrypted at rest, scoped per tenant, never printed in logs, rotated/revoked on change.
Audit logs? Yes — actor, time, route, and result for every action and write-back attempt.
```

---

## Antech (later, optional)

Antech is Mars-owned (a competitor to IDEXX), and there is no public developer API. The clean path is to read Antech results **through Cornerstone** once the IDEXX integration is live — no separate Antech deal needed. Only pursue Antech directly if a clinic is Antech-portal-only. Routing line if needed: US support 1-800-872-1001, ask for Website Support (HealthTracks / Antech Online / PIMS). Full draft and details are in git history if you need them.

## Sources

- IDEXX Integration Request Form: https://www.idexx.com/en/veterinary/software-services/idexx-practice-management-software-integration-request-form/
- IDEXX support contacts: https://www.idexx.com/en/veterinary/support/support-contact/
- ezyVet commercial partner application: https://developers.ezyvet.com/apply/commercial.html
- ezyVet become a partner: https://www.ezyvet.com/become-a-partner
- Full research + form answers: `docs/pims-integration.md`
