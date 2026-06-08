# PIMS Permission Packet — Email Command Center

Last updated: 2026-06-08. This is your one-stop file to get IDEXX / ezyVet / Antech access moving. Three vendor emails are **send-ready Gmail drafts**. The Tricity authorization note is a relay template that still needs the clinic contact/address/account blanks filled by the clinic.

Sender: **Sandeep Salwan, Founder, VetAgent** · salwansandeep5@gmail.com · (510) 789-3428 · eepish.com
Pilot clinic: **Tricity Veterinary Hospital** (Cornerstone) · (510) 796-8387 · no clinic email (you have direct contact)

---

## ✅ What's already done

- Researched the real path (see `docs/pims-integration.md`). Official front door = the **IDEXX Integration Request Form** (a web form) plus routed support email.
- Wrote three vendor emails and one Tricity relay template as Gmail drafts, with your phone, website, and known Tricity details already filled in.
- Found the real Antech HealthTracks support route (`healthtrackssupport@antechdx.com`, or US support `1-800-872-1001`) so that one is send-ready too.

## 👉 What to do next (~10 minutes)

1. **Clean up first.** You'll see **3 older drafts** that still contain the text `[your phone]` / `[your website]` from an earlier pass — **delete those 3**. (I can create drafts but can't delete them for you.) Keep the three send-ready vendor drafts plus the Tricity relay template below.
2. **Send → IDEXX / Cornerstone** — draft to `cornerstone@idexx.com`. One click.
3. **Send → ezyVet** — draft to `apisupport-ezyvet@idexx.com`. One click.
4. **Send → Antech** — draft to `healthtrackssupport@antechdx.com`. One click.
5. **Relay → Tricity authorization** (biggest accelerator) — open the draft titled *"Tricity → IDEXX authorization note"*. Since Tricity has no email, use your direct contact: ask the clinic owner/manager to send the lower note to their IDEXX rep from the clinic's own email and CC you. Fill the clinic's address + IDEXX account ID if they have it.
6. **Submit the web form** if not done yet: https://www.idexx.com/en/veterinary/software-services/idexx-practice-management-software-integration-request-form/ — answers ready in `docs/pims-integration.md` §8. Select **Cornerstone**.
7. **Log dates.** If IDEXX is quiet ~2 days, call `1-800-695-2877`, ask for PIMS integrations, get a ticket number (phone script below).

> Optional credibility boost: a `@eepish.com` email reads better to IDEXX than gmail. If you have one, swap the signature address before sending.

---

## The four drafts

### 1 — IDEXX / Cornerstone (Data Services) → `cornerstone@idexx.com`

Subject: VetAgent — IDEXX integration partner request (Cornerstone, pilot clinic ready)

> Already submitted the web form? Add one line at the top: "I recently submitted the IDEXX Integration Request Form and am following up to make sure it reached the right team."

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
(510) 789-3428
eepish.com
```

### 2 — ezyVet API → `apisupport-ezyvet@idexx.com`

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
(510) 789-3428
eepish.com
```

### 3 — Antech lab / HealthTracks → `healthtrackssupport@antechdx.com`

Subject: VetAgent — Antech lab / HealthTracks integration routing request

> Note: Antech is Mars-owned and has no public developer API. Once IDEXX is live you can read Antech results straight through Cornerstone, so this email is mainly to open the conversation. Phone fallback: 1-800-872-1001.

```text
Dear Antech HealthTracks Team,

My name is Sandeep Salwan, and I am the founder of VetAgent, a front-desk workflow tool for veterinary clinics. I am writing to find the supported way for an authorized clinic to let VetAgent receive Antech lab result context, whether through HealthTracks, Antech Online, or the standard PIMS result workflow.

To be clear up front, we are not asking for portal scraping or shared clinic logins. We are looking for the approved partner or integration path, if one exists.

Our pilot clinic, Tricity Veterinary Hospital, runs on Cornerstone and is ready to authorize access. Our initial use case is simple and read-only:

- Read lab result status and result context for a clinic that authorizes it.
- Match each result to the right client, patient, and task inside VetAgent.
- No ordering or write-back in phase one, unless you recommend a supported workflow.

Could you route this to the team that handles HealthTracks, Antech Online, PIMS, HL7, or third-party software integrations, and let me know the correct next step and any partner requirements?

Thank you very much for your help.

Best regards,

Sandeep Salwan
Founder, VetAgent
salwansandeep5@gmail.com
(510) 789-3428
eepish.com
```

### 4 — Tricity → IDEXX authorization note (relay through the clinic)

Draft is parked in your own inbox. Tricity has no email, so use your direct contact: have the clinic owner/manager send the lower note to their IDEXX rep from the clinic email and CC you.

```text
Hi [Tricity contact first name],

Thank you again for partnering with us on VetAgent. One quick thing would genuinely speed up the IDEXX integration: a short note from Tricity to your IDEXX or Cornerstone account contact, authorizing them to discuss the integration with us. A request that comes from the clinic moves the review along far faster than anything we can send on our own. If it is easy, would you mind sending the note below from your clinic email and copying me? Please feel free to edit anything.

----------

Dear IDEXX Team,

Tricity Veterinary Hospital uses Cornerstone, and we would like to evaluate VetAgent as an integration partner for our front-desk workflow.

We authorize IDEXX to discuss VetAgent's integration request with them on our behalf, and to evaluate VetAgent for sandbox, pilot, or approved API access under your normal process. The integration we want is narrow: read appointment, client, patient, and lab-result context to match incoming client requests, and optionally save a staff-approved note back to the record if you approve write-back. There is no direct database access, no screen scraping, and no shared logins.

Clinic details:
- Clinic: Tricity Veterinary Hospital
- Phone: (510) 796-8387
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
(510) 789-3428
eepish.com
```

---

## If IDEXX goes quiet — phone script

Call and ask to be routed to PIMS integrations / Data Services:

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

## Sources

- IDEXX Integration Request Form: https://www.idexx.com/en/veterinary/software-services/idexx-practice-management-software-integration-request-form/
- IDEXX support contacts: https://www.idexx.com/en/veterinary/support/support-contact/
- ezyVet commercial partner application: https://developers.ezyvet.com/apply/commercial.html
- Antech contact / support: https://www.antechdiagnostics.com/contact-us/ · HealthTracks support source: https://www.antechdiagnostics.com/reference-lab/microbiology/
- Full research + form answers: `docs/pims-integration.md`
