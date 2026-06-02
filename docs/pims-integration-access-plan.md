# Veterinary PIMS and Lab Data Access: Integration Plan

Last researched: 2026-06-01. This is a real product, not a demo. Sources are primary vendor docs, the live IDEXX OpenAPI spec, AVMA policy, and vendor help pages, each verified by adversarial cross checking. Terms, fees, rate limits, and timelines are vendor controlled and change, so reconfirm at application time.

---

## 1. Action plan (do these in order)

1. Submit the IDEXX Practice Management Software Integration Request Form. This is the single biggest unlock and covers Cornerstone, Neo, and ezyVet in one application.
   - Form: https://www.idexx.com/en/veterinary/software-services/idexx-practice-management-software-integration-request-form/
   - Select Cornerstone (priority). Also select Neo and ezyVet, since it is the same connection and there is no downside.
   - Draft answers are in section 8 below.

2. Email the ezyVet API partner team to open the ezyVet public API track in parallel.
   - Contact: apisupport-ezyvet@idexx.com or https://www.ezyvet.com/become-a-partner
   - Ask the write back access fee schedule up front, because ezyVet charges for write back.

3. Pull the Cornerstone API spec now and model our normalized adapter against the real shapes while approval runs.
   - Docs: https://io.datapointapi.com/documentation/Cornerstone
   - Machine spec: https://io.datapointapi.com/swagger/Cornerstone/swagger.json

4. Contact Antech and Mars about their lab integration or partner process, and meanwhile plan to read Antech lab results through the IDEXX laboratories endpoints (see section 4).
   - Antech does not appear to offer a public third party developer API. Confirm directly.

5. Prepare a per clinic data sharing agreement and a revocable consent flow.
   - Lean on AVMA data ownership (the clinic owns its data and can authorize us). Build a 30 day off switch to match how IDEXX handles discontinuation.

6. Evaluate Sikka OneAPI as a build versus buy option for non IDEXX systems (Avimark, ImproMed, Vetspire, Provet, Shepherd, DaySmart, Pulse, Digitail, Hippo).
   - https://www.sikka.ai/oneapi

Rough timeline: plan months, not weeks, for full IDEXX certification. We can build against the sandbox and spec immediately, and we can start read only to de risk approval.

---

## 2. Bottom line

There is a real, official, production API that covers Cornerstone: IDEXX Data Services (also branded DataPoint). It is OAuth gated, not open or anonymous. It reads our core domains and writes back limited actions into Cornerstone specifically (notes, comms log, appointment status, vitals, check in). The legitimate path for the whole IDEXX family is one partner program plus a credentialed API. We do not need direct database access, ODBC, or screen scraping for IDEXX systems.

Antech is different. It is a PIMS to lab integration, not a public developer API. The cleanest way to get Antech results is to read them through the practice management system after they land there.

Confidence: high for the IDEXX API facts (verified against the live spec and developer portals). Medium for the claim that Antech has no public developer API (this is absence of evidence, so confirm directly with Antech).

---

## 3. How to connect, per vendor

### IDEXX family (Cornerstone, Neo, Animana, ezyVet)

One intake door for all IDEXX practice software: the Integration Request Form linked in step 1.

IDEXX Data Services / DataPoint (the API for Cornerstone, Neo, Animana, and also Avimark, Impromed, Intravet):
- Portal: https://dataservices.idexx.com/ ("OData V4 compliant APIs for accessing data collected from practices").
- Cornerstone docs: https://io.datapointapi.com/documentation/Cornerstone
- Auth: OAuth bearer token. POST to https://dataservices.idexx.com/pims-rt/v1/token with a username and password (provisioned WebAdmin credentials, grant_type=password). It returns a JWT used as Authorization: Bearer. These are gated credentials, not self signup.
- Read (GET): clients, patients, appointments, appointment-slots, invoices, invoice-items, estimates, laboratories, laboratory-profiles, diagnostics, reminders, prescriptions, documents, vitals.
- Write back into Cornerstone (POST), all validated against the site rules:
  - /api/{siteId}/documents (notes, Cornerstone only)
  - /api/{siteId}/appointments (insert or update, which covers status)
  - /api/{siteId}/commslog (requires Cornerstone 9.6 or higher)
  - /api/{siteId}/prescriptions/label (Cornerstone only)
  - /api/{siteId}/patients/visit-list
  - /api/{siteId}/vitals/{patientId}
  - /api/{siteId}/visits/checkin (Cornerstone only)
- Architecture note: this is a vendor hosted cloud layer that normalizes several PIMS. It is the opposite of touching the local Cornerstone database.

ezyVet (IDEXX owned since June 2021), a separately documented API:
- Portal: https://developers.ezyvet.com/ (RESTful JSON).
- Auth: OAuth2 client credentials. POST /v1/oauth/access_token with partner_id, client_id, client_secret. Token lasts 12 hours.
- Full read. Write back is gated and paid (write back access fees apply). Rate limit around 180 calls per period.
- Contact: apisupport-ezyvet@idexx.com. Partner page: https://www.ezyvet.com/become-a-partner

Animana:
- Partner gated API at https://api.animana.com (approved partner login only).
- Apply via the Partner Request form. Contact: IDEXX-Animana-API@idexx.com. Docs: https://help.animana.com/kb/api-docs/

The IDEXX and ezyVet certification path (realistic stages):
Application, then Sandbox, then Workflow Confirmation, then Development and Documentation (a 6 month dev window), then Certification (a 60 minute demo), then Pilot (about 5 sites for a 6 week trial), then Customer and Support documentation, then General Availability. Expect an NDA, a security review, a signed agreement, and for ezyVet write back, fees. Authorized means built to IDEXX's API library with the practice supplying its own credentials. Source: https://www.ezyvet.com/blog/is-your-integration-safe

Proof it works in production: Otto writes AI generated SOAP notes back into Cornerstone (one of 7 PIMS) and IDEXX's own Vello product writes into the Cornerstone communications log through this same Data Services stack.

Cornerstone technical facts:
- Database engine: Sybase / SAP SQL Anywhere (files cstone.db and cstone.log) with a PowerBuilder application layer. It is not Pervasive or Actian PSQL, and not Microsoft SQL Server. There is no marketed third party ODBC connection.
- The sanctioned way to run custom reports against Cornerstone data is a paid in product add on called Practice Explorer (powered by IDEXX SmartLink), not an open database connection. IDEXX explicitly labels scraping and unsupported API integrations as unsanctioned and unsupported.

### Antech (reference lab)

Antech is a PIMS to lab integration, not a general developer API.
- HealthTracks and Antech Online are the lab results portal and ordering system (one place for diagnostics, ordering with auto populated client and patient info, courier scheduling). Not a general developer API.
- Integration is set up per clinic with credentials, inside a PIMS:
  - Vetspire uses an "Antech V3" connection and asks for Account Number, Username, Password, and Clinic ID.
  - DaySmart Vet uses the Antech ID or Clinic ID plus an Antech Online or HealthTracks account. Orders go out and results sync back automatically.
- The transport is HL7, brokered by a third party. The site antech.admin.hl7i.com is an "HL7i Admin portal" by Greywind Technologies ("Convert HL7 to anything").
- No public or self serve Antech third party developer API surfaced. Mars or Antech may run a private PIMS partner program, so confirm directly.

Two ways to get Antech data for our product:
1. Easiest: read it through the PIMS. A Cornerstone clinic's Antech results land in Cornerstone, so we pull them via the IDEXX Data Services laboratories, laboratory-profiles, and diagnostics endpoints. One integration, no separate Antech deal.
2. Direct Antech: contact Antech and Mars for their lab integration process (HL7 result feed via the Greywind interface engine). In practice we would register like a PIMS does, not like an app hitting a REST API.

---

## 4. Recommended architecture

1. Official API first. IDEXX Data Services for Cornerstone, Neo, Animana, Avimark, Impromed, and Intravet. ezyVet's REST API for ezyVet. These cover read and the narrow write back we want.
2. Clinic authorized, per tenant credentials. Store each practice's own provisioned credentials per tenant (a provider_connection table). The practice authorizes access to its own data. This matches both IDEXX's model and AVMA policy.
3. Antech via the PIMS. Read lab results through the PIMS endpoints unless a clinic is Antech portal only. Only then pursue a direct Antech lab feed.
4. Human approved, narrow write back. The agent drafts, staff approve in our UI, and a background job posts via the official endpoints. Expect batch latency (Otto runs nightly), so do not promise real time.
5. No scraping and no shared or ghost user accounts. It is fragile and a legal risk (see section 5). IDEXX directs legitimate integrators to Data Services and disclaims unsanctioned ones.
6. Build versus buy. Consider licensing an aggregator (Sikka, section 6) to reach non IDEXX systems instead of many bespoke integrations.

Keep the stated integration scope small to ease approval: read a few basics (appointments, matching client and patient details, lab results), and write back only a staff approved note (and a reminder if allowed). Offer to start read only.

---

## 5. Legal and competitive landmines

Data ownership is our leverage. AVMA policy is clear: "Veterinary practices own their practice data," it should be "portable and accessible," and "prior consent is the foundation of proper data use," with the right to limit or withdraw consent. So the clinic can authorize us. We build on the clinic's ownership right, not the vendor's goodwill.
- https://www.avma.org/resources-tools/avma-policies/principles-veterinary-data-ownership-and-stewardship

HIPAA does not apply to veterinary data. It is a state law patchwork. The practice owns the record and the client can request copies. There is no federal retention standard. We still need confidentiality, a data sharing agreement with each clinic, and the clinic's authorization. IDEXX's own privacy principles let a practice discontinue PIMS data sharing within 30 days, so design for revocable consent.
- https://co.vet/post/veterinary-medical-records-laws/
- https://www.idexx.com/en/about-idexx/practice-management-software-data-privacy-principles/

Scraping or RPA behind a login is a high risk fallback. After hiQ v. LinkedIn, scraping public data likely is not a CFAA violation, but data behind authentication is different. hiQ faced a 500,000 dollar judgment partly for accessing password protected pages with fake accounts (CFAA) plus breach of contract for violating the terms of service. A PIMS or Antech portal is exactly that: login gated and bound by terms. So RPA or ghost user access risks CFAA exposure, breach of contract, and the vendor killing the integration. Avoid it.
- https://www.fbm.com/publications/what-recent-rulings-in-hiq-v-linkedin-and-other-cases-say-about-the-legality-of-data-scraping/

IDEXX versus Mars, the cross vendor friction is real. IDEXX owns Cornerstone, Neo, Animana, ezyVet, and IDEXX reference labs. Mars owns Antech (plus Banfield and VCA). IDEXX is Antech's principal competitor, and the two hold roughly 70 to 80 percent of the market. IDEXX faces an active antitrust class action (filed December 2022): over 70 percent point of care share, six year exclusive practice contracts with disloyalty penalties up to 500,000 dollars, a prior 2013 FTC settlement, and a specific allegation that Cornerstone only works with IDEXX point of care products, locking out rivals. Implication: reading Antech (a rival's) lab data through IDEXX's Cornerstone API is clean today, but it sits on a contested seam that IDEXX controls. Keep a direct Antech fallback and do not architect solely around IDEXX carrying competitor lab data.
- https://www.avma.org/news/class-action-suit-alleges-anticompetitive-behavior-idexx
- https://marsveterinary.com/who-we-are/our-companies/
- https://www.idexx.com/en/about-idexx/news/newsroom-archive/idexx-acquires-ezyvet/

---

## 6. Build versus buy: middleware

Sikka OneAPI is a single API to over 400 practice management systems across dental, veterinary, and other fields, with read and a Payment Writeback API. Licensing and per PIMS coverage are not public, but it is a credible way to reach non IDEXX systems without many bespoke builds. Worth a sales call to compare against direct integration. Note that IDEXX Data Services is already a mini aggregator across IDEXX controlled PIMS.
- https://www.sikka.ai/oneapi

---

## 7. Fact check of the original writeup

- "You cannot just hit a public Cornerstone or Antech API and be done." Partly true. There is no open or anonymous API, but IDEXX Data Services is a real gated API for Cornerstone. The idea that there is no API at all and we must use the database or RPA is false.
- "HappyDoc and Otto integrate with Cornerstone using direct API or database integrations." Partly true. They integrate via the official IDEXX partner API, not direct database. The database framing is wrong. Otto is confirmed across 7 PIMS including Cornerstone.
- "IDEXX markets easy, secure integration and lists partners like Antech, AllyDVM, Otto." True. The Cornerstone integrations page is a 40 plus partner catalog. But it is marketing, not the developer portal, and has no API or program details.
- "Antech's lab module for Cornerstone enables online ordering and automatic results download into Cornerstone." True. This is the standard Antech to PIMS pattern via HealthTracks or Antech Online plus HL7.
- "Many PIMS, including Cornerstone, support internal reporting databases or ODBC access for third party tools." False for Cornerstone. It runs on Sybase SQL Anywhere with no marketed third party ODBC. The sanctioned path is the paid Practice Explorer add on. IDEXX warns against database access and scraping.
- "DaySmart exposes an Antech HealthTracks integration, Vetspire uses Antech V3 with account number, username, password, clinic ID." True, verbatim.
- "Loosely coupled integrations (UI, file based, RPA) are more fragile than direct APIs." True, and IDEXX agrees. But moot for Cornerstone, since the official API exists.
- "HappyDoc single click write back, Otto exports logs into Cornerstone on close." Partly true. Write back is real, but Otto's push is a nightly batch, not real time. Single click is app UI, not the transport.

---

## 8. IDEXX Integration Request Form: draft answers

Select Cornerstone (and optionally Neo and ezyVet). Replace every value marked TODO with a real, accurate fact. Keep numbers modest and true, since IDEXX can verify them.

Company Name: VetAgent (use the real registered entity if different).

Company Overview: VetAgent helps veterinary clinics handle everyday front desk work. We make it easier for staff to take in client requests, send follow ups, and keep their tasks in one place. The goal is simple: save the team time on routine admin so they can spend more time with patients. We use automation, including AI, to draft routine notes and messages, and staff always review them before anything is saved or sent. Staff stay in control of what the software does.

Website: TODO (a live page helps a lot).
Address: TODO.
Regions where product is available: United States.

Name: Sandeep Salwan.
Position or Title: TODO (for example Founder).
Email: TODO (a company email reads better than a personal one).
Phone Number: TODO.
Referred by: blank, or a name if someone pointed us here.

Product Name: VetAgent.

Product Overview: VetAgent gives clinics a simple way to manage client requests and follow ups. Clients can check in, ask for records or a prescription, request a booking, or ask for a call back using easy online forms. Each request shows up as a task for the team. The software can draft routine replies, notes, and reminders, and staff approve them before they go out. It also nudges the team about anything overdue so nothing slips through. It works next to the clinic's existing software, not as a replacement.

Product Category: Client communication and front desk workflow tools.
Countries where product is available: United States.

Is your product currently commercially available: Yes.
If so, how long has it been in the market: TODO (a real, accurate answer).
How is the product currently used by practices (non integrated): Right now, clinics use VetAgent next to their practice software. Client requests come in through our forms and become tasks. Staff review the notes and messages we draft, then type the approved ones into their main system by hand. That manual step is the part we would like to remove with an integration.

Number of customers currently using your product: TODO (a modest, honest number).
Number of customers in the veterinary space: TODO (same number, since we only serve veterinary clinics).
Number of customers with IDEXX PIMS using your product: TODO (the smaller number on Cornerstone, Neo, or ezyVet).

What problem are you solving for veterinary practices with your integration: Today, staff copy information by hand between VetAgent and Cornerstone. We want to remove that double entry. If VetAgent can see the day's basic schedule and the matching client and patient details, staff get the right context for each request without looking it up. And if a staff approved note can be saved back to the record, they no longer have to retype it. The goal is to save the team a few minutes on each request and keep records accurate.

Desired business objective with integration: We want to become an approved IDEXX partner so we can offer Cornerstone clinics a proper, supported connection instead of a manual workaround. Clinics expect their tools to work with the software they already use, so this helps us support practices on IDEXX systems.

Description of desired integration: We would like a small, mostly read only integration through the IDEXX Data Services API, using a secure login that each clinic approves and can turn off at any time. We do not need direct database access. To start, we would read a few basics: upcoming appointments and the matching client and patient details, plus lab results if available, only to show staff the right context for each request. For writing back, we want to keep it minimal: saving a staff approved visit note to the patient record, and a follow up reminder if allowed. A staff member approves every write first. We are happy to begin read only and add the note write back later if preferred.

---

## 9. Sources (primary)

- IDEXX Data Services portal: https://dataservices.idexx.com/
- IDEXX Data Services Cornerstone docs: https://io.datapointapi.com/documentation/Cornerstone
- IDEXX Integration Request Form: https://www.idexx.com/en/veterinary/software-services/idexx-practice-management-software-integration-request-form/
- IDEXX Cornerstone integrations catalog: https://software.idexx.com/cornerstone-integrations
- Cornerstone 9.5 install guide (Sybase SQL Anywhere): https://www.idexx.com/files/cornerstone-9.5-install-guide.pdf
- Cornerstone Practice Explorer: https://cornerstonehelphub.com/docs/practice-explorer-overview/
- ezyVet developers: https://developers.ezyvet.com/
- ezyVet "is your integration safe": https://www.ezyvet.com/blog/is-your-integration-safe
- Animana API docs: https://help.animana.com/kb/api-docs/
- Otto PIMS write back announcement: https://otto.vet/otto-launches-industry-first-pims-integration-for-ai-generated-medical-notes/
- IDEXX Vello for Cornerstone: https://software.idexx.com/vello-cornerstone
- Antech HealthTracks: https://www.antechdiagnostics.com/reference-lab/healthtracks/
- Vetspire Antech V3 setup: https://manual.vetspire.com/vetspire-user-manual/ok/Commercial/antech
- DaySmart Vet Antech HealthTracks: https://help.vettersoftware.com/en/articles/9680936-antech-healthtracks-integration
- AVMA data ownership and stewardship: https://www.avma.org/resources-tools/avma-policies/principles-veterinary-data-ownership-and-stewardship
- Veterinary records and HIPAA: https://co.vet/post/veterinary-medical-records-laws/
- IDEXX PIMS data privacy principles: https://www.idexx.com/en/about-idexx/practice-management-software-data-privacy-principles/
- hiQ v. LinkedIn and scraping legality: https://www.fbm.com/publications/what-recent-rulings-in-hiq-v-linkedin-and-other-cases-say-about-the-legality-of-data-scraping/
- IDEXX antitrust class action: https://www.avma.org/news/class-action-suit-alleges-anticompetitive-behavior-idexx
- Mars Veterinary Health companies: https://marsveterinary.com/who-we-are/our-companies/
- IDEXX acquires ezyVet: https://www.idexx.com/en/about-idexx/news/newsroom-archive/idexx-acquires-ezyvet/
- Sikka OneAPI: https://www.sikka.ai/oneapi
