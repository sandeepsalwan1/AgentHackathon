import { getSql } from "./connection";

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  createdAt: string;
};

export type Pet = {
  id: string;
  clientId: string;
  name: string;
  species: string;
  breed: string | null;
  weight: string | null;
  dateOfBirth: string | null;
  createdAt: string;
};

export type Appointment = {
  id: string;
  clientId: string;
  petId: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  status: string;
  reason: string | null;
  createdAt: string;
};

export type AppointmentSlot = {
  id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
};

export type WaitStatus = {
  id: string;
  petId: string;
  queuePosition: number;
  waitMinutes: number;
  status: string;
  message: string | null;
  updatedAt: string;
};

export type ServiceCatalogItem = {
  id: string;
  serviceName: string;
  price: number;
  category: string;
};

export type FollowupCandidate = {
  id: string;
  clientId: string;
  petId: string;
  followUpReason: string;
  dueDate: string;
  status: string;
  createdAt: string;
};

export type MockInboundMessage = {
  id: string;
  clientId: string | null;
  messageBody: string;
  receivedAt: string;
};

export type MockCallTranscript = {
  id: string;
  clientId: string | null;
  transcript: string;
  receivedAt: string;
};

export type MockInvoice = {
  id: string;
  clientId: string;
  totalAmount: number;
  status: string;
  createdAt: string;
};

export type CompetitorPriceObservation = {
  id: string;
  competitorName: string;
  serviceName: string;
  price: number;
  observedAt: string;
};

export async function lookupClient(name?: string, phone?: string) {
  const sql = getSql();
  if (name && phone) {
    return sql<Client[]>`
      select id, name, phone, email, date_of_birth::text as "dateOfBirth", created_at as "createdAt"
      from clients
      where name ilike ${'%' + name + '%'} or phone = ${phone}
    `;
  } else if (name) {
    return sql<Client[]>`
      select id, name, phone, email, date_of_birth::text as "dateOfBirth", created_at as "createdAt"
      from clients
      where name ilike ${'%' + name + '%'}
    `;
  } else if (phone) {
    return sql<Client[]>`
      select id, name, phone, email, date_of_birth::text as "dateOfBirth", created_at as "createdAt"
      from clients
      where phone = ${phone}
    `;
  }
  return sql<Client[]>`
    select id, name, phone, email, date_of_birth::text as "dateOfBirth", created_at as "createdAt"
    from clients
  `;
}

export async function lookupPet(clientId: string, petName?: string) {
  const sql = getSql();
  if (petName) {
    return sql<Pet[]>`
      select id, client_id as "clientId", name, species, breed, weight, date_of_birth::text as "dateOfBirth", created_at as "createdAt"
      from pets
      where client_id = ${clientId} and name ilike ${'%' + petName + '%'}
    `;
  }
  return sql<Pet[]>`
    select id, client_id as "clientId", name, species, breed, weight, date_of_birth::text as "dateOfBirth", created_at as "createdAt"
    from pets
    where client_id = ${clientId}
  `;
}

export async function getClientPets(clientId: string) {
  const sql = getSql();
  return sql<Pet[]>`
    select id, client_id as "clientId", name, species, breed, weight, date_of_birth::text as "dateOfBirth", created_at as "createdAt"
    from pets
    where client_id = ${clientId}
  `;
}

export async function getPetWaitStatus(petId: string) {
  const sql = getSql();
  const rows = await sql<WaitStatus[]>`
    select id, pet_id as "petId", queue_position as "queuePosition", wait_minutes as "waitMinutes", status, message, updated_at as "updatedAt"
    from wait_statuses
    where pet_id = ${petId}
  `;
  return rows[0] || null;
}

export async function updatePetWaitStatus(
  petId: string,
  status: string,
  queuePosition: number,
  waitMinutes: number,
  message?: string
) {
  const sql = getSql();
  const rows = await sql<WaitStatus[]>`
    insert into wait_statuses (pet_id, queue_position, wait_minutes, status, message)
    values (${petId}, ${queuePosition}, ${waitMinutes}, ${status}, ${message || null})
    on conflict (pet_id) do update
    set queue_position = ${queuePosition}, wait_minutes = ${waitMinutes}, status = ${status}, message = ${message || null}, updated_at = now()
    returning id, pet_id as "petId", queue_position as "queuePosition", wait_minutes as "waitMinutes", status, message, updated_at as "updatedAt"
  `;
  return rows[0];
}

export async function getAppointments(options?: { clientId?: string; petId?: string; status?: string }) {
  const sql = getSql();
  let query = sql`
    select id, client_id as "clientId", pet_id as "petId", doctor_id as "doctorId", start_time as "startTime", end_time as "endTime", status, reason, created_at as "createdAt"
    from appointments
    where 1=1
  `;
  if (options?.clientId) {
    query = sql`${query} and client_id = ${options.clientId}`;
  }
  if (options?.petId) {
    query = sql`${query} and pet_id = ${options.petId}`;
  }
  if (options?.status) {
    query = sql`${query} and status = ${options.status}`;
  }
  query = sql`${query} order by start_time asc`;
  return query as unknown as Promise<Appointment[]>;
}

export async function getAppointmentForCheckin(clientName: string, petName: string) {
  const sql = getSql();
  // Find clients matching clientName, then their pets matching petName, then today's appointments
  const rows = await sql<Appointment[]>`
    select a.id, a.client_id as "clientId", a.pet_id as "petId", a.doctor_id as "doctorId", a.start_time as "startTime", a.end_time as "endTime", a.status, a.reason, a.created_at as "createdAt"
    from appointments a
    join clients c on a.client_id = c.id
    join pets p on a.pet_id = p.id
    where c.name ilike ${'%' + clientName + '%'}
      and p.name ilike ${'%' + petName + '%'}
      and a.start_time::date = current_date
      and a.status = 'scheduled'
    limit 1
  `;
  return rows[0] || null;
}

export async function markAppointmentArrived(appointmentId: string) {
  const sql = getSql();
  const rows = await sql<Appointment[]>`
    update appointments
    set status = 'arrived'
    where id = ${appointmentId}
    returning id, client_id as "clientId", pet_id as "petId", doctor_id as "doctorId", start_time as "startTime", end_time as "endTime", status, reason, created_at as "createdAt"
  `;
  return rows[0] || null;
}

export async function listSlots(onlyAvailable = true) {
  const sql = getSql();
  if (onlyAvailable) {
    return sql<AppointmentSlot[]>`
      select id, doctor_id as "doctorId", start_time as "startTime", end_time as "endTime", is_booked as "isBooked"
      from appointment_slots
      where is_booked = false and start_time > now()
      order by start_time asc
    `;
  }
  return sql<AppointmentSlot[]>`
    select id, doctor_id as "doctorId", start_time as "startTime", end_time as "endTime", is_booked as "isBooked"
    from appointment_slots
    order by start_time asc
  `;
}

export async function bookAppointment(slotId: string, clientId: string, petId: string, reason: string) {
  const sql = getSql();
  // Fetch slot
  const slots = await sql<AppointmentSlot[]>`
    select id, doctor_id as "doctorId", start_time as "startTime", end_time as "endTime", is_booked as "isBooked"
    from appointment_slots
    where id = ${slotId} and is_booked = false
  `;
  const slot = slots[0];
  if (!slot) return null;

  // Mark slot booked
  await sql`
    update appointment_slots
    set is_booked = true
    where id = ${slotId}
  `;

  // Create appointment
  const rows = await sql<Appointment[]>`
    insert into appointments (client_id, pet_id, doctor_id, start_time, end_time, status, reason)
    values (${clientId}, ${petId}, ${slot.doctorId}, ${slot.startTime}, ${slot.endTime}, 'scheduled', ${reason})
    returning id, client_id as "clientId", pet_id as "petId", doctor_id as "doctorId", start_time as "startTime", end_time as "endTime", status, reason, created_at as "createdAt"
  `;
  return rows[0];
}

export async function listFollowupCandidates(status = "pending") {
  const sql = getSql();
  return sql<FollowupCandidate[]>`
    select id, client_id as "clientId", pet_id as "petId", follow_up_reason as "followUpReason", due_date::text as "dueDate", status, created_at as "createdAt"
    from followup_candidates
    where status = ${status}
    order by due_date asc
  `;
}

export async function updateFollowupCandidateStatus(candidateId: string, status: string) {
  const sql = getSql();
  const rows = await sql<FollowupCandidate[]>`
    update followup_candidates
    set status = ${status}
    where id = ${candidateId}
    returning id, client_id as "clientId", pet_id as "petId", follow_up_reason as "followUpReason", due_date::text as "dueDate", status, created_at as "createdAt"
  `;
  return rows[0] || null;
}

export async function getMockInvoices() {
  const sql = getSql();
  return sql<MockInvoice[]>`
    select id, client_id as "clientId", total_amount::numeric::float8 as "totalAmount", status, created_at as "createdAt"
    from mock_invoices
    order by created_at desc
  `;
}

export async function getMockInboundMessages() {
  const sql = getSql();
  return sql<MockInboundMessage[]>`
    select id, client_id as "clientId", message_body as "messageBody", received_at as "receivedAt"
    from mock_inbound_messages
    order by received_at desc
  `;
}

export async function getMockCallTranscripts() {
  const sql = getSql();
  return sql<MockCallTranscript[]>`
    select id, client_id as "clientId", transcript, received_at as "receivedAt"
    from mock_call_transcripts
    order by received_at desc
  `;
}

export async function getCompetitorPriceObservations() {
  const sql = getSql();
  return sql<CompetitorPriceObservation[]>`
    select id, competitor_name as "competitorName", service_name as "serviceName", price::numeric::float8 as "price", observed_at as "observedAt"
    from competitor_price_observations
    order by observed_at desc
  `;
}

export async function getServiceCatalog() {
  const sql = getSql();
  return sql<ServiceCatalogItem[]>`
    select id, service_name as "serviceName", price::numeric::float8 as "price", category
    from service_catalog
    order by service_name asc
  `;
}
