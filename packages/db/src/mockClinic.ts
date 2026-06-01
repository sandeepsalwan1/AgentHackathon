import { getSql } from "./connection";

export type MockClient = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
};

export type MockPet = {
  id: string;
  clientId: string;
  name: string;
  species: string;
  breed: string | null;
  ageYears: number | null;
  weight: string | null;
  alerts: string | null;
};

export type MockAppointment = {
  id: string;
  clientId: string;
  petId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  doctor: string;
  status: string;
  waitMinutes: number;
  roomStatus: string;
  arrivedAt: string | null;
  notes: string | null;
};

export type MockSlot = {
  id: string;
  slotDate: string;
  slotTime: string;
  doctor: string;
  appointmentType: string;
  available: boolean;
};

export type MockFollowup = {
  id: string;
  clientId: string;
  petId: string;
  followupType: string;
  dueDate: string;
  recommendedAction: string;
  status: string;
};

export type MockInvoice = {
  id: string;
  clientId: string;
  petId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalCents: number;
  status: string;
  lineItems: Record<string, unknown>[];
  flags: Record<string, unknown>[];
};

export type MockMessage = {
  id: string;
  clientId: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  intentHint: string | null;
  urgency: string;
  createdAt: string;
};

export type MockCallTranscript = {
  id: string;
  callerName: string;
  callerPhone: string;
  transcript: string;
  intentHint: string | null;
  createdAt: string;
};

export type MockService = {
  id: string;
  serviceName: string;
  category: string;
  currentPriceCents: number;
  notes: string | null;
};

export type PricingObservation = {
  id: string;
  source: string;
  competitorName: string;
  serviceName: string;
  observedPriceCents: number | null;
  observedText: string | null;
  url: string | null;
  raw: Record<string, unknown>;
  createdAt: string;
};

export type MockLabCatalogItem = {
  id: string;
  labVendor: string;
  testCode: string;
  testName: string;
  specimenType: string;
  turnaroundHours: number;
  active: boolean;
  raw: Record<string, unknown>;
};

export type MockLabOrder = {
  id: string;
  labVendor: string;
  externalOrderId: string;
  clientId: string;
  petId: string;
  patientName: string;
  orderedBy: string;
  testCode: string;
  testName: string;
  specimenType: string;
  orderedAt: string;
  status: string;
  raw: Record<string, unknown>;
};

export type MockLabResult = {
  id: string;
  labOrderId: string;
  labVendor: string;
  externalOrderId: string;
  status: string;
  resultSummary: string;
  abnormalFlags: Record<string, unknown>[];
  reportUrl: string | null;
  raw: Record<string, unknown>;
  resultedAt: string | null;
};

type ClientRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
};

type PetRow = {
  id: string;
  client_id: string;
  name: string;
  species: string;
  breed: string | null;
  age_years: number | null;
  weight: string | null;
  alerts: string | null;
};

type AppointmentRow = {
  id: string;
  client_id: string;
  pet_id: string;
  appointment_date: string | Date;
  appointment_time: string;
  appointment_type: string;
  doctor: string;
  status: string;
  wait_minutes: number;
  room_status: string;
  arrived_at: string | null;
  notes: string | null;
};

type SlotRow = {
  id: string;
  slot_date: string | Date;
  slot_time: string;
  doctor: string;
  appointment_type: string;
  available: boolean;
};

type FollowupRow = {
  id: string;
  client_id: string;
  pet_id: string;
  followup_type: string;
  due_date: string | Date;
  recommended_action: string;
  status: string;
};

type InvoiceRow = {
  id: string;
  client_id: string;
  pet_id: string;
  invoice_number: string;
  invoice_date: string | Date;
  total_cents: number;
  status: string;
  line_items: Record<string, unknown>[];
  flags: Record<string, unknown>[];
};

type MessageRow = {
  id: string;
  client_id: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  intent_hint: string | null;
  urgency: string;
  created_at: string;
};

type CallRow = {
  id: string;
  caller_name: string;
  caller_phone: string;
  transcript: string;
  intent_hint: string | null;
  created_at: string;
};

type ServiceRow = {
  id: string;
  service_name: string;
  category: string;
  current_price_cents: number;
  notes: string | null;
};

type PricingObservationRow = {
  id: string;
  source: string;
  competitor_name: string;
  service_name: string;
  observed_price_cents: number | null;
  observed_text: string | null;
  url: string | null;
  raw: Record<string, unknown>;
  created_at: string;
};

type LabCatalogRow = {
  id: string;
  lab_vendor: string;
  test_code: string;
  test_name: string;
  specimen_type: string;
  turnaround_hours: number;
  active: boolean;
  raw: Record<string, unknown>;
};

type LabOrderRow = {
  id: string;
  lab_vendor: string;
  external_order_id: string;
  client_id: string;
  pet_id: string;
  patient_name: string;
  ordered_by: string;
  test_code: string;
  test_name: string;
  specimen_type: string;
  ordered_at: string;
  status: string;
  raw: Record<string, unknown>;
};

type LabResultRow = {
  id: string;
  lab_order_id: string;
  lab_vendor: string;
  external_order_id: string;
  status: string;
  result_summary: string;
  abnormal_flags: Record<string, unknown>[];
  report_url: string | null;
  raw: Record<string, unknown>;
  resulted_at: string | null;
};

type MockClinicRow = {
  clients: ClientRow[];
  pets: PetRow[];
  appointments: AppointmentRow[];
  slots: SlotRow[];
  followups: FollowupRow[];
  invoices: InvoiceRow[];
  messages: MessageRow[];
  call_transcripts: CallRow[];
  services: ServiceRow[];
  pricing_observations: PricingObservationRow[];
  lab_catalog: LabCatalogRow[];
  lab_orders: LabOrderRow[];
  lab_results: LabResultRow[];
};

function normalizeClient(row: ClientRow): MockClient {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    notes: row.notes
  };
}

function normalizePet(row: PetRow): MockPet {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    ageYears: row.age_years,
    weight: row.weight,
    alerts: row.alerts
  };
}

function dateText(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.split("T")[0] || value;
}

function normalizeAppointment(row: AppointmentRow): MockAppointment {
  return {
    id: row.id,
    clientId: row.client_id,
    petId: row.pet_id,
    appointmentDate: dateText(row.appointment_date),
    appointmentTime: row.appointment_time,
    appointmentType: row.appointment_type,
    doctor: row.doctor,
    status: row.status,
    waitMinutes: row.wait_minutes,
    roomStatus: row.room_status,
    arrivedAt: row.arrived_at,
    notes: row.notes
  };
}

function normalizeSlot(row: SlotRow): MockSlot {
  return {
    id: row.id,
    slotDate: dateText(row.slot_date),
    slotTime: row.slot_time,
    doctor: row.doctor,
    appointmentType: row.appointment_type,
    available: row.available
  };
}

function normalizeFollowup(row: FollowupRow): MockFollowup {
  return {
    id: row.id,
    clientId: row.client_id,
    petId: row.pet_id,
    followupType: row.followup_type,
    dueDate: dateText(row.due_date),
    recommendedAction: row.recommended_action,
    status: row.status
  };
}

function normalizeInvoice(row: InvoiceRow): MockInvoice {
  return {
    id: row.id,
    clientId: row.client_id,
    petId: row.pet_id,
    invoiceNumber: row.invoice_number,
    invoiceDate: dateText(row.invoice_date),
    totalCents: row.total_cents,
    status: row.status,
    lineItems: row.line_items ?? [],
    flags: row.flags ?? []
  };
}

function normalizeMessage(row: MessageRow): MockMessage {
  return {
    id: row.id,
    clientId: row.client_id,
    channel: row.channel,
    direction: row.direction,
    subject: row.subject,
    body: row.body,
    intentHint: row.intent_hint,
    urgency: row.urgency,
    createdAt: row.created_at
  };
}

function normalizeCall(row: CallRow): MockCallTranscript {
  return {
    id: row.id,
    callerName: row.caller_name,
    callerPhone: row.caller_phone,
    transcript: row.transcript,
    intentHint: row.intent_hint,
    createdAt: row.created_at
  };
}

function normalizeService(row: ServiceRow): MockService {
  return {
    id: row.id,
    serviceName: row.service_name,
    category: row.category,
    currentPriceCents: row.current_price_cents,
    notes: row.notes
  };
}

function normalizePricingObservation(row: PricingObservationRow): PricingObservation {
  return {
    id: row.id,
    source: row.source,
    competitorName: row.competitor_name,
    serviceName: row.service_name,
    observedPriceCents: row.observed_price_cents,
    observedText: row.observed_text,
    url: row.url,
    raw: row.raw ?? {},
    createdAt: row.created_at
  };
}

function normalizeLabCatalogItem(row: LabCatalogRow): MockLabCatalogItem {
  return {
    id: row.id,
    labVendor: row.lab_vendor,
    testCode: row.test_code,
    testName: row.test_name,
    specimenType: row.specimen_type,
    turnaroundHours: row.turnaround_hours,
    active: row.active,
    raw: row.raw ?? {}
  };
}

function normalizeLabOrder(row: LabOrderRow): MockLabOrder {
  return {
    id: row.id,
    labVendor: row.lab_vendor,
    externalOrderId: row.external_order_id,
    clientId: row.client_id,
    petId: row.pet_id,
    patientName: row.patient_name,
    orderedBy: row.ordered_by,
    testCode: row.test_code,
    testName: row.test_name,
    specimenType: row.specimen_type,
    orderedAt: row.ordered_at,
    status: row.status,
    raw: row.raw ?? {}
  };
}

function normalizeLabResult(row: LabResultRow): MockLabResult {
  return {
    id: row.id,
    labOrderId: row.lab_order_id,
    labVendor: row.lab_vendor,
    externalOrderId: row.external_order_id,
    status: row.status,
    resultSummary: row.result_summary,
    abnormalFlags: row.abnormal_flags ?? [],
    reportUrl: row.report_url,
    raw: row.raw ?? {},
    resultedAt: row.resulted_at
  };
}

function jsonInput(value: Record<string, unknown>) {
  return value as never;
}

function cleanQuery(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function digits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

export async function listMockClinic() {
  const sql = getSql();
  const [clinic] = await sql<MockClinicRow[]>`
    select
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, full_name, phone, email, notes
          from mock_clients
          order by full_name asc
        ) item
      ), '[]'::jsonb) as clients,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, client_id, name, species, breed, age_years, weight, alerts
          from mock_pets
          order by name asc
        ) item
      ), '[]'::jsonb) as pets,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, client_id, pet_id, appointment_date, appointment_time, appointment_type, doctor, status, wait_minutes, room_status, arrived_at, notes
          from mock_appointments
          order by appointment_date asc, appointment_time asc
        ) item
      ), '[]'::jsonb) as appointments,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, slot_date, slot_time, doctor, appointment_type, available
          from mock_slots
          order by slot_date asc, slot_time asc
        ) item
      ), '[]'::jsonb) as slots,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, client_id, pet_id, followup_type, due_date, recommended_action, status
          from mock_followups
          order by due_date asc
        ) item
      ), '[]'::jsonb) as followups,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, client_id, pet_id, invoice_number, invoice_date, total_cents, status, line_items, flags
          from mock_invoices
          order by invoice_date desc
        ) item
      ), '[]'::jsonb) as invoices,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, client_id, channel, direction, subject, body, intent_hint, urgency, created_at
          from mock_messages
          order by created_at desc
        ) item
      ), '[]'::jsonb) as messages,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, caller_name, caller_phone, transcript, intent_hint, created_at
          from mock_call_transcripts
          order by created_at desc
        ) item
      ), '[]'::jsonb) as call_transcripts,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, service_name, category, current_price_cents, notes
          from mock_service_catalog
          order by category asc, service_name asc
        ) item
      ), '[]'::jsonb) as services,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, source, competitor_name, service_name, observed_price_cents, observed_text, url, raw, created_at
          from pricing_observations
          order by created_at desc
          limit 50
        ) item
      ), '[]'::jsonb) as pricing_observations,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, lab_vendor, test_code, test_name, specimen_type, turnaround_hours, active, raw
          from mock_lab_catalog
          order by test_name asc
        ) item
      ), '[]'::jsonb) as lab_catalog,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, lab_vendor, external_order_id, client_id, pet_id, patient_name, ordered_by, test_code, test_name, specimen_type, ordered_at, status, raw
          from mock_lab_orders
          order by ordered_at desc
        ) item
      ), '[]'::jsonb) as lab_orders,
      coalesce((
        select jsonb_agg(row_to_json(item))
        from (
          select id, lab_order_id, lab_vendor, external_order_id, status, result_summary, abnormal_flags, report_url, raw, resulted_at
          from mock_lab_results
          order by resulted_at desc nulls last, created_at desc
        ) item
      ), '[]'::jsonb) as lab_results
  `;

  return {
    clients: clinic.clients.map(normalizeClient),
    pets: clinic.pets.map(normalizePet),
    appointments: clinic.appointments.map(normalizeAppointment),
    slots: clinic.slots.map(normalizeSlot),
    followups: clinic.followups.map(normalizeFollowup),
    invoices: clinic.invoices.map(normalizeInvoice),
    messages: clinic.messages.map(normalizeMessage),
    callTranscripts: clinic.call_transcripts.map(normalizeCall),
    services: clinic.services.map(normalizeService),
    pricingObservations: clinic.pricing_observations.map(normalizePricingObservation),
    labCatalog: clinic.lab_catalog.map(normalizeLabCatalogItem),
    labOrders: clinic.lab_orders.map(normalizeLabOrder),
    labResults: clinic.lab_results.map(normalizeLabResult)
  };
}

export async function findArrivalAppointment(input: {
  clientName?: string | null;
  clientPhone?: string | null;
  petName?: string | null;
}) {
  const sql = getSql();
  const nameKey = cleanQuery(input.clientName);
  const phoneKey = digits(input.clientPhone);
  const petKey = cleanQuery(input.petName);
  if (!petKey || (nameKey.length < 4 && phoneKey.length < 7)) return null;
  const rows = await sql<(AppointmentRow & {
    client_name: string;
    client_phone: string;
    pet_name: string;
  })[]>`
    select
      appointment.id,
      appointment.client_id,
      appointment.pet_id,
      appointment.appointment_date,
      appointment.appointment_time,
      appointment.appointment_type,
      appointment.doctor,
      appointment.status,
      appointment.wait_minutes,
      appointment.room_status,
      appointment.arrived_at,
      appointment.notes,
      client.full_name as client_name,
      client.phone as client_phone,
      pet.name as pet_name
    from mock_appointments appointment
    join mock_clients client on client.id = appointment.client_id
    join mock_pets pet on pet.id = appointment.pet_id
    where appointment.appointment_date = current_date
    order by
      case when appointment.status = 'arrived' then 1 else 0 end,
      appointment.appointment_time asc
  `;

  const row = rows.find((appointment) => {
    const nameMatch = nameKey.length >= 4 && cleanQuery(appointment.client_name).includes(nameKey);
    const phoneMatch = phoneKey.length >= 7 && digits(appointment.client_phone).endsWith(phoneKey.slice(-10));
    const petMatch = petKey.length >= 2 && cleanQuery(appointment.pet_name).includes(petKey);
    return Boolean(petMatch && (nameMatch || phoneMatch));
  });
  return row ? normalizeAppointment(row) : null;
}

export async function resetMockClinicState() {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    update mock_appointments
    set status = 'scheduled',
      room_status = 'waiting',
      arrived_at = null,
      updated_at = now()
    where status = 'arrived' or arrived_at is not null
    returning id
  `;
  return { resetAppointments: rows.length };
}

export async function markAppointmentArrived(id: string) {
  const sql = getSql();
  const rows = await sql<AppointmentRow[]>`
    update mock_appointments
    set status = 'arrived',
      room_status = case
        when room_status = 'ready' then room_status
        else 'checked in'
      end,
      arrived_at = coalesce(arrived_at, now()),
      updated_at = now()
    where id = ${id}
    returning id, client_id, pet_id, appointment_date, appointment_time, appointment_type, doctor, status, wait_minutes, room_status, arrived_at, notes
  `;
  return rows[0] ? normalizeAppointment(rows[0]) : null;
}

export async function listAvailableSlots(appointmentType?: string | null) {
  const sql = getSql();
  const type = appointmentType?.trim();
  const rows = type
    ? await sql<SlotRow[]>`
        select id, slot_date, slot_time, doctor, appointment_type, available
        from mock_slots
        where available = true
          and appointment_type ilike ${`%${type}%`}
        order by slot_date asc, slot_time asc
        limit 8
      `
    : await sql<SlotRow[]>`
        select id, slot_date, slot_time, doctor, appointment_type, available
        from mock_slots
        where available = true
        order by slot_date asc, slot_time asc
        limit 8
      `;
  return rows.map(normalizeSlot);
}

export async function listOpenFollowups() {
  const sql = getSql();
  const rows = await sql<FollowupRow[]>`
    select id, client_id, pet_id, followup_type, due_date, recommended_action, status
    from mock_followups
    where status = 'open'
    order by due_date asc
  `;
  return rows.map(normalizeFollowup);
}

export async function listReviewInvoices() {
  const sql = getSql();
  const rows = await sql<InvoiceRow[]>`
    select id, client_id, pet_id, invoice_number, invoice_date, total_cents, status, line_items, flags
    from mock_invoices
    where status = 'review' or jsonb_array_length(flags) > 0
    order by invoice_date desc
  `;
  return rows.map(normalizeInvoice);
}

export async function listServiceCatalog() {
  const sql = getSql();
  const rows = await sql<ServiceRow[]>`
    select id, service_name, category, current_price_cents, notes
    from mock_service_catalog
    order by category asc, service_name asc
  `;
  return rows.map(normalizeService);
}

export async function listPricingObservations(limit = 50) {
  const sql = getSql();
  const rows = await sql<PricingObservationRow[]>`
    select id, source, competitor_name, service_name, observed_price_cents, observed_text, url, raw, created_at
    from pricing_observations
    order by created_at desc
    limit ${Math.min(Math.max(limit, 1), 200)}
  `;
  return rows.map(normalizePricingObservation);
}

export async function createPricingObservation(input: {
  source: string;
  competitorName: string;
  serviceName: string;
  observedPriceCents?: number | null;
  observedText?: string | null;
  url?: string | null;
  raw?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql<PricingObservationRow[]>`
    insert into pricing_observations (
      source,
      competitor_name,
      service_name,
      observed_price_cents,
      observed_text,
      url,
      raw
    )
    values (
      ${input.source},
      ${input.competitorName},
      ${input.serviceName},
      ${input.observedPriceCents ?? null},
      ${input.observedText ?? null},
      ${input.url ?? null},
      ${sql.json(jsonInput(input.raw ?? {}))}
    )
    returning id, source, competitor_name, service_name, observed_price_cents, observed_text, url, raw, created_at
  `;
  return normalizePricingObservation(rows[0]);
}
