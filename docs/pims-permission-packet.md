# PIMS Permission Packet

Last checked: 2026-06-08. Purpose: copy/paste material to get IDEXX/ezyVet/Antech access moving after the IDEXX form was submitted and went quiet.

## Fast path

Do these today:

1. Reply/follow up on the IDEXX form with the IDEXX email below. If there is no confirmation email, send through the IDEXX support/contact path and call Cornerstone support.
2. Ask one real clinic to send the clinic authorization email from a clinic-domain or known clinic email. This is the biggest accelerator.
3. Submit the ezyVet partner form in parallel if any clinic uses ezyVet. ezyVet asks for mutual clinic details and later written pilot consent.
4. Keep the initial scope small: read appointments, clients, patients, diagnostics/lab results; write only staff-approved notes, with read-only acceptable for phase 1.
5. Log every touch: date, channel, person, ticket/reference number, next promised date.

Need from you before sending:

- IDEXX form submission date.
- Company website URL.
- Company email, phone, title.
- Truthful customer count and veterinary customer count.
- Pilot clinic name, address, website, PIMS, clinic contact.
- Any IDEXX/ezyVet ticket/reference number.

## IDEXX follow-up email

Send to: any IDEXX confirmation email if you have one. If not, send to `cornerstone@idexx.com`, use `idexx.com/cschat`, and call Cornerstone or Practice Solutions support to route it.

Subject: Follow-up: VetAgent PIMS Integration Request submitted [DATE]

```text
Hi IDEXX team,

I submitted the IDEXX Practice Management Software Integration Request Form for VetAgent on [DATE] and wanted to follow up on routing and next steps.

VetAgent is a veterinary front-desk workflow product. Clinics use it to collect client requests, check-ins, booking requests, records requests, pickup/follow-up items, and staff-reviewed AI drafts. Today staff copy approved notes and context into their PIMS manually. We are requesting an approved IDEXX path so mutual clinics do not need any unsupported database access, scraping, or shared logins.

Requested initial scope:
- PIMS: Cornerstone first; Neo/ezyVet if available through the same review path.
- Read: upcoming appointments, clients, patients, diagnostics/lab results, and basic record context needed to match a client request to the right patient.
- Write: staff-approved patient/visit note only, and only if approved by IDEXX. We are happy to start read-only for phase 1.
- Security: OAuth/API credentials only, encrypted in transit and at rest, tenant-specific credentials, least privilege, audit logging, no direct database access, no RPA, and revocable clinic authorization.

We can provide a pilot clinic contact, product workflow, endpoint list, security overview, and a demo system. Could you route this to the Data Services / Practice Management Software integrations team and let me know the correct next step for sandbox/API review?

Thanks,
Sandeep Salwan
[TITLE]
VetAgent
[WEBSITE]
[EMAIL]
[PHONE]
```

## Clinic authorization email

Send this to the clinic owner/manager. Ask them to forward it to their IDEXX account manager/support contact and CC you.

Subject: Quick authorization for VetAgent + IDEXX integration review

```text
Hi [CLINIC_CONTACT],

Could you send the note below to your IDEXX/Cornerstone contact and CC me? A clinic request helps IDEXX route the integration review much faster.

---

Hi IDEXX team,

[CLINIC_NAME] uses [Cornerstone/Neo/ezyVet] and would like to evaluate VetAgent as an integration partner for front-desk workflow support.

We authorize IDEXX to discuss the integration request with VetAgent for our clinic and to evaluate whether VetAgent can receive sandbox, pilot, or approved API access under the normal IDEXX process.

The initial workflow we want is narrow:
- read appointment, client, patient, and lab/result context needed to match client requests;
- optionally save a staff-approved note back to the patient record if IDEXX approves write-back;
- no direct database access, no screen scraping, and no shared clinic login.

Clinic details:
- Clinic: [CLINIC_NAME]
- Address: [CLINIC_ADDRESS]
- Website: [CLINIC_WEBSITE]
- PIMS: [Cornerstone/Neo/ezyVet]
- IDEXX account/customer ID, if available: [ID]
- Clinic contact: [NAME, TITLE, EMAIL, PHONE]

Please route this to the team that handles IDEXX PIMS / Data Services integration requests.

Thanks,
[CLINIC_CONTACT]
```

## IDEXX phone script

Call:

- Cornerstone software/hardware: 1-800-695-2877
- Cornerstone email/chat fallback: `cornerstone@idexx.com` / `idexx.com/cschat`
- Practice Solutions: 1-888-224-4408
- Neo support: 1-800-296-7141
- ezyVet: 1-844-439-9838

Script:

```text
Hi, I submitted the IDEXX Practice Management Software Integration Request Form for VetAgent on [DATE]. I am calling to make sure it reached the team that handles PIMS integrations / Data Services API access.

We are not asking for database access or scraping. We want the approved API path for a small integration: read appointments/clients/patients/lab context and optionally write a staff-approved note. We have or are getting a mutual clinic authorization.

Can you create or find the ticket, attach this note, and route it to the integrations, Data Services, or Practice Solutions partner team? What email or reference number should I use for follow-up?
```

Ask before hanging up:

- Ticket/reference number.
- Team name it was routed to.
- Rep name.
- Expected response date.
- Email address or portal for attachments.
- Whether a clinic authorization email helps and where to send it.

## ezyVet parallel request

Use this for the ezyVet partner form or an email to `apisupport-ezyvet@idexx.com`.

Subject: VetAgent ezyVet API partnership / scope request

```text
Hi ezyVet API team,

VetAgent is applying for ezyVet API access as a commercial integration partner. We help veterinary clinics manage front-desk workflows: check-in, booking requests, records requests, pickups/follow-ups, client messages, and staff-reviewed AI drafts.

Current non-integrated workflow:
Clinics use VetAgent next to ezyVet. Requests and draft notes are reviewed in VetAgent, then staff manually look up the client/patient/appointment in ezyVet and copy approved notes or reminders back by hand.

Requested endpoints / scope:
- Read: contacts/clients, animals/patients, appointments, appointment status/type, resources/availability, invoices/estimates if available, diagnostics/lab-related records if available.
- Write phase 1: none, if read-only is easier for approval.
- Write later: staff-approved note/comms/task or appointment update only where supported and approved.

Business objective:
Remove double entry for mutual clinics while keeping staff approval and auditability. VetAgent should work beside ezyVet, not replace it.

Security posture:
OAuth/client-credential flow only, tenant-specific credentials, encrypted credential storage, least privilege scopes, audit logs for reads/writes, no shared clinic users, no scraping, revocable clinic access.

Could you confirm the correct commercial partnership next step, required mutual clinic details, sandbox process, write-back fee schedule, and any endpoint/scope constraints we should account for before development?

Thanks,
Sandeep Salwan
[TITLE]
VetAgent
[WEBSITE]
[EMAIL]
[PHONE]
```

ezyVet form notes:

- Business category: Check-In / Triage / Queue Management; Communications Tools; Appointment Scheduling; Data Reporting / Analytics if needed.
- Mutual clinics: only list real clinics that already use VetAgent and ezyVet non-integrated.
- Referee: put the clinic/account contact if one exists; otherwise say none / direct application.
- Endpoint answer: paste the requested endpoints/scope above.

## Antech fallback request

Use after IDEXX/ezyVet are moving. For Antech, ask for lab result integration routing; do not imply a public REST API exists.

Subject: VetAgent request for Antech lab/PIMS integration routing

```text
Hi Antech team,

VetAgent helps veterinary clinics manage front-desk workflows and staff-reviewed client communications. We are researching the approved way for an authorized clinic to let VetAgent receive Antech lab result context or integrate with HealthTracks / Antech Online / PIMS result workflows.

We are not asking for portal scraping or shared clinic logins. We want the supported partner path, if one exists.

Could you route this to the team that handles HealthTracks, Antech Online, PIMS, HL7, or third-party software integrations?

Initial use case:
- Read lab result status/result context for a clinic that authorizes access.
- Match results to the right client/patient/task in VetAgent.
- No ordering or write-back in phase 1 unless Antech recommends a supported workflow.

Pilot clinic:
- Clinic: [CLINIC_NAME]
- Antech account/clinic ID, if available: [ID]
- PIMS: [PIMS]
- Clinic contact: [NAME, TITLE, EMAIL, PHONE]

Thanks,
Sandeep Salwan
[TITLE]
VetAgent
[WEBSITE]
[EMAIL]
[PHONE]
```

Call path:

- US support: 1-800-872-1001
- Ask for Reference Lab Services, Website Support for HealthTracks / Antech Online / PIMS.
- HealthTracks mobile support also lists 844-674-4422.

## One-page summary to paste

Use this under any email as the "integration overview."

```text
VetAgent integration overview

Product:
VetAgent helps veterinary clinics manage front-desk workflows: client requests, arrival/check-in, booking requests, records requests, pickup/follow-up work, internal tasks, and staff-reviewed AI drafts.

Problem:
Without a PIMS integration, staff must manually look up appointments, clients, patients, and lab context, then copy approved notes back into the system of record. That creates double entry and avoidable mistakes.

Requested phase 1:
Read-only API access for appointment, client, patient, and lab/result context so VetAgent can match work to the right record.

Requested phase 2:
Narrow write-back for staff-approved notes or status updates only where officially supported.

Controls:
Staff approve every write. Tenant-specific credentials. Least privilege scopes. Encryption in transit and at rest. Audit logs. No direct database access. No scraping. No shared clinic login. Clinic can revoke access.

Pilot:
We can support a limited pilot with one authorized clinic, a demo system, endpoint list, workflow documentation, and security review material.
```

## Security FAQ

```text
Do you need direct database access?
No. We want the official API / approved partner path only.

Do you scrape the PIMS UI?
No.

Do you use shared clinic logins?
No.

Can a clinic revoke access?
Yes. Access is tenant-specific and should be revocable by the clinic/vendor.

Do staff approve writes?
Yes. Every PIMS write-back is staff-approved. Read-only phase 1 is acceptable.

What data do you store?
Only the minimum context needed to route and audit clinic work: matched client/patient/appointment identifiers, task context, approved notes/messages, run/audit metadata, and integration status. We do not sell clinic data.

How are credentials stored?
Encrypted at rest, scoped by tenant, never printed in logs, and rotated/revoked if access changes.

Do you support audit logs?
Yes. Agent/tool actions and write-back attempts are logged with actor, time, route, and result.
```

## Follow-up cadence

- Day 0: send IDEXX follow-up + clinic authorization request.
- Day 1: call IDEXX support; get ticket/reference.
- Day 3: resend with ticket number and clinic authorization attached.
- Day 5: ask pilot clinic to ask their IDEXX account manager directly.
- Day 7: submit ezyVet commercial partner form if relevant.
- Day 10: call again; ask if request is blocked on company website, security review, mutual clinic, or endpoint scope.
- Weekly: one concise follow-up until routed or rejected.

## Sources checked

- IDEXX Integration Request Form: https://www.idexx.com/en/veterinary/software-services/idexx-practice-management-software-integration-request-form/
- IDEXX support contacts: https://www.idexx.com/en/veterinary/support/support-contact/
- Cornerstone current-customer support: https://software.idexx.com/products/cornerstone/current-customers
- ezyVet API commercial partnership docs: https://developers.ezyvet.com/apply/commercial.html
- ezyVet partner form: https://www.ezyvet.com/become-a-partner
- Antech contact/support: https://www.antechdiagnostics.com/contact-us/
- Antech HealthTracks: https://www.antechdiagnostics.com/reference-lab/healthtracks/
