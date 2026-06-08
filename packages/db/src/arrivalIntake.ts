import { getSql } from "./connection";
import { resolveClinicId } from "./clinics";

export type RoomState = "open" | "occupied" | "closed" | "cleaning";
export type ArrivalStatus = "checked_in" | "exception";

export type ArrivalQuestionnaire = {
  visitReasons: string[];
  sickSignsLabel: string;
  sickSigns: string[];
  specialConcernsLabel: string;
  vaccineFeelingLabel: string;
  surgeryAteLabel: string;
  surgeryFeelingLabel: string;
  dentalConcernLabel: string;
  routineConcernLabel: string;
};

export type ArrivalSettings = {
  roomAssignmentEnabled: boolean;
  questionnaire: ArrivalQuestionnaire;
};

export type ClinicRoom = {
  id: string;
  clinicId: string;
  name: string;
  sortOrder: number;
  state: RoomState;
  currentArrivalId: string | null;
  stateChangedAt: string;
  autoOpenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArrivalIntake = {
  id: string;
  clinicId: string;
  status: ArrivalStatus;
  appointmentId: string | null;
  clientId: string | null;
  petId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  petName: string | null;
  visitReason: string | null;
  answers: Record<string, unknown>;
  roomId: string | null;
  roomName: string | null;
  pimsWriteStatus: string;
  pimsWriteSummary: string | null;
  exceptionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArrivalMatch = {
  appointmentId: string;
  clientId: string;
  petId: string;
  clientName: string;
  clientPhone: string;
  petName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  doctor: string;
  status: string;
  waitMinutes: number;
};

export type ArrivalDeskSnapshot = {
  settings: ArrivalSettings;
  rooms: ClinicRoom[];
  arrivals: ArrivalIntake[];
};

type SettingsRow = {
  room_assignment_enabled: boolean;
  questionnaire: ArrivalQuestionnaire | null;
};

type RoomRow = {
  id: string;
  clinic_id: string;
  name: string;
  sort_order: number;
  state: RoomState;
  current_arrival_id: string | null;
  state_changed_at: string;
  auto_open_at: string | null;
  created_at: string;
  updated_at: string;
};

type ArrivalRow = {
  id: string;
  clinic_id: string;
  status: ArrivalStatus;
  appointment_id: string | null;
  client_id: string | null;
  pet_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  pet_name: string | null;
  visit_reason: string | null;
  answers: Record<string, unknown> | null;
  room_id: string | null;
  room_name: string | null;
  pims_write_status: string;
  pims_write_summary: string | null;
  exception_reason: string | null;
  created_at: string;
  updated_at: string;
};

type MatchRow = {
  appointment_id: string;
  client_id: string;
  pet_id: string;
  client_name: string;
  client_phone: string;
  pet_name: string;
  appointment_date: string | Date;
  appointment_time: string;
  appointment_type: string;
  doctor: string;
  status: string;
  wait_minutes: number;
};

const defaultQuestionnaire: ArrivalQuestionnaire = {
  visitReasons: ["Sick", "Vaccines", "Surgery", "Dental", "Routine"],
  sickSignsLabel: "What signs are you seeing?",
  sickSigns: ["Vomiting", "Diarrhea", "Coughing", "Other signs"],
  specialConcernsLabel: "Any special concerns?",
  vaccineFeelingLabel: "How is your pet feeling today?",
  surgeryAteLabel: "Did your pet eat today?",
  surgeryFeelingLabel: "How is your pet feeling today?",
  dentalConcernLabel: "Any dental concerns today?",
  routineConcernLabel: "Scratching, itching, routine vaccines, or anything else?"
};

function jsonInput(value: Record<string, unknown>) {
  return value as never;
}

function cleanText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function lastName(value: string | null | undefined) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  return parts.at(-1) ?? "";
}

function phoneDigits(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function dateText(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.split("T")[0] || value;
}

function normalizeSettings(row: SettingsRow | null | undefined): ArrivalSettings {
  return {
    roomAssignmentEnabled: row?.room_assignment_enabled ?? true,
    questionnaire: {
      ...defaultQuestionnaire,
      ...(row?.questionnaire ?? {})
    }
  };
}

function normalizeRoom(row: RoomRow): ClinicRoom {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    name: row.name,
    sortOrder: row.sort_order,
    state: row.state,
    currentArrivalId: row.current_arrival_id,
    stateChangedAt: row.state_changed_at,
    autoOpenAt: row.auto_open_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeArrival(row: ArrivalRow): ArrivalIntake {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    status: row.status,
    appointmentId: row.appointment_id,
    clientId: row.client_id,
    petId: row.pet_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    petName: row.pet_name,
    visitReason: row.visit_reason,
    answers: row.answers ?? {},
    roomId: row.room_id,
    roomName: row.room_name,
    pimsWriteStatus: row.pims_write_status,
    pimsWriteSummary: row.pims_write_summary,
    exceptionReason: row.exception_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeMatch(row: MatchRow): ArrivalMatch {
  return {
    appointmentId: row.appointment_id,
    clientId: row.client_id,
    petId: row.pet_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    petName: row.pet_name,
    appointmentDate: dateText(row.appointment_date),
    appointmentTime: row.appointment_time,
    appointmentType: row.appointment_type,
    doctor: row.doctor,
    status: row.status,
    waitMinutes: row.wait_minutes
  };
}

export function defaultArrivalQuestionnaire() {
  return defaultQuestionnaire;
}

export async function ensureArrivalSetup(options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  await sql`
    insert into arrival_settings (clinic_id)
    values (${clinicId})
    on conflict (clinic_id) do nothing
  `;
  await sql`
    insert into clinic_rooms (clinic_id, name, sort_order)
    select ${clinicId}, room.name, room.sort_order
    from (
      values
        ('Exam Room 1', 1),
        ('Exam Room 2', 2),
        ('Exam Room 3', 3),
        ('Exam Room 4', 4),
        ('Exam Room 5', 5),
        ('Exam Room 6', 6)
    ) as room(name, sort_order)
    where not exists (
      select 1 from clinic_rooms existing where existing.clinic_id = ${clinicId}
    )
    on conflict (clinic_id, name) do nothing
  `;
  return clinicId;
}

export async function autoOpenReadyRooms(options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  await sql`
    update clinic_rooms
    set state = 'open',
      current_arrival_id = null,
      auto_open_at = null,
      state_changed_at = now(),
      updated_at = now()
    where clinic_id = ${clinicId}
      and state = 'cleaning'
      and auto_open_at is not null
      and auto_open_at <= now()
  `;
}

export async function getArrivalSettings(options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await ensureArrivalSetup({ clinicId: options?.clinicId });
  const rows = await sql<SettingsRow[]>`
    select room_assignment_enabled, questionnaire
    from arrival_settings
    where clinic_id = ${clinicId}
    limit 1
  `;
  return normalizeSettings(rows[0]);
}

export async function listArrivalDesk(options?: { clinicId?: string | null }): Promise<ArrivalDeskSnapshot> {
  const sql = getSql();
  const clinicId = await ensureArrivalSetup({ clinicId: options?.clinicId });
  await autoOpenReadyRooms({ clinicId });
  const [settingRows, roomRows, arrivalRows] = await Promise.all([
    sql<SettingsRow[]>`
      select room_assignment_enabled, questionnaire
      from arrival_settings
      where clinic_id = ${clinicId}
      limit 1
    `,
    sql<RoomRow[]>`
      select id, clinic_id, name, sort_order, state, current_arrival_id, state_changed_at, auto_open_at, created_at, updated_at
      from clinic_rooms
      where clinic_id = ${clinicId}
      order by sort_order asc, name asc
    `,
    sql<ArrivalRow[]>`
      select id, clinic_id, status, appointment_id, client_id, pet_id, client_name, client_phone, pet_name, visit_reason, answers, room_id, room_name, pims_write_status, pims_write_summary, exception_reason, created_at, updated_at
      from arrival_intakes
      where clinic_id = ${clinicId}
        and created_at >= now() - interval '18 hours'
      order by created_at desc
      limit 80
    `
  ]);
  return {
    settings: normalizeSettings(settingRows[0]),
    rooms: roomRows.map(normalizeRoom),
    arrivals: arrivalRows.map(normalizeArrival)
  };
}

export async function matchArrivalIdentity(input: {
  clinicId?: string | null;
  lastName?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  petName?: string | null;
}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const expectedLastName = cleanText(input.lastName || lastName(input.clientName));
  const phone = phoneDigits(input.clientPhone);
  const pet = cleanText(input.petName);
  if (expectedLastName.length < 2 || phone.length !== 10 || pet.length < 2) return null;

  const rows = await sql<MatchRow[]>`
    select
      appointment.id as appointment_id,
      appointment.client_id,
      appointment.pet_id,
      client.full_name as client_name,
      client.phone as client_phone,
      pet.name as pet_name,
      appointment.appointment_date,
      appointment.appointment_time,
      appointment.appointment_type,
      appointment.doctor,
      appointment.status,
      appointment.wait_minutes
    from mock_appointments appointment
    join mock_clients client on client.id = appointment.client_id and client.clinic_id = appointment.clinic_id
    join mock_pets pet on pet.id = appointment.pet_id and pet.clinic_id = appointment.clinic_id
    where appointment.clinic_id = ${clinicId}
      and appointment.appointment_date = current_date
      and appointment.status in ('scheduled', 'arrived')
    order by appointment.appointment_time asc
  `;

  const matches = rows.filter((row) => {
    const recordPhone = phoneDigits(row.client_phone);
    const phoneMatch = recordPhone === phone;
    const lastNameMatch = cleanText(lastName(row.client_name)) === expectedLastName;
    const petMatch = cleanText(row.pet_name) === pet;
    return phoneMatch && lastNameMatch && petMatch;
  });
  return matches.length === 1 ? normalizeMatch(matches[0]) : null;
}

function intakeSummary(input: {
  match: ArrivalMatch;
  visitReason: string;
  answers: Record<string, unknown>;
  roomName?: string | null;
}) {
  const parts = [
    `${input.match.petName} checked in for ${input.visitReason}.`,
    `Appointment ${input.match.appointmentTime} with ${input.match.doctor}.`,
    input.roomName ? `Assigned ${input.roomName}.` : "No room assigned.",
    `Answers: ${JSON.stringify(input.answers)}`
  ];
  return parts.join(" ");
}

async function assignOpenRoom(clinicId: string, arrivalId: string) {
  const sql = getSql();
  const rows = await sql<RoomRow[]>`
    with candidate as (
      select id
      from clinic_rooms
      where clinic_id = ${clinicId}
        and state = 'open'
      order by sort_order asc, name asc
      limit 1
    )
    update clinic_rooms room
    set state = 'occupied',
      current_arrival_id = ${arrivalId},
      auto_open_at = null,
      state_changed_at = now(),
      updated_at = now()
    where room.id in (select id from candidate)
    returning id, clinic_id, name, sort_order, state, current_arrival_id, state_changed_at, auto_open_at, created_at, updated_at
  `;
  return rows[0] ? normalizeRoom(rows[0]) : null;
}

export async function createArrivalException(input: {
  clinicId?: string | null;
  clientName?: string | null;
  lastName?: string | null;
  clientPhone?: string | null;
  petName?: string | null;
  reason?: string | null;
}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const rows = await sql<ArrivalRow[]>`
    insert into arrival_intakes (
      clinic_id,
      status,
      client_name,
      client_phone,
      pet_name,
      exception_reason,
      pims_write_status,
      pims_write_summary
    )
    values (
      ${clinicId},
      'exception',
      ${input.clientName ?? input.lastName ?? null},
      ${input.clientPhone ?? null},
      ${input.petName ?? null},
      ${input.reason ?? "No unique current appointment matched the submitted identity."},
      'not_written',
      'Front desk identity help needed before automated check-in.'
    )
    returning id, clinic_id, status, appointment_id, client_id, pet_id, client_name, client_phone, pet_name, visit_reason, answers, room_id, room_name, pims_write_status, pims_write_summary, exception_reason, created_at, updated_at
  `;
  return normalizeArrival(rows[0]);
}

export async function submitMatchedArrival(input: {
  clinicId?: string | null;
  match: ArrivalMatch;
  visitReason: string;
  answers: Record<string, unknown>;
}) {
  const sql = getSql();
  const clinicId = await ensureArrivalSetup({ clinicId: input.clinicId });
  const existing = await sql<ArrivalRow[]>`
    select id, clinic_id, status, appointment_id, client_id, pet_id, client_name, client_phone, pet_name, visit_reason, answers, room_id, room_name, pims_write_status, pims_write_summary, exception_reason, created_at, updated_at
    from arrival_intakes
    where clinic_id = ${clinicId}
      and appointment_id = ${input.match.appointmentId}
      and status = 'checked_in'
      and created_at >= current_date
    order by created_at desc
    limit 1
  `;
  if (existing[0]) return normalizeArrival(existing[0]);

  const setting = await getArrivalSettings({ clinicId });
  const rows = await sql<ArrivalRow[]>`
    insert into arrival_intakes (
      clinic_id,
      status,
      appointment_id,
      client_id,
      pet_id,
      client_name,
      client_phone,
      pet_name,
      visit_reason,
      answers,
      pims_write_status
    )
    values (
      ${clinicId},
      'checked_in',
      ${input.match.appointmentId},
      ${input.match.clientId},
      ${input.match.petId},
      ${input.match.clientName},
      ${input.match.clientPhone},
      ${input.match.petName},
      ${input.visitReason},
      ${sql.json(jsonInput(input.answers))},
      'mock_written'
    )
    returning id, clinic_id, status, appointment_id, client_id, pet_id, client_name, client_phone, pet_name, visit_reason, answers, room_id, room_name, pims_write_status, pims_write_summary, exception_reason, created_at, updated_at
  `;
  let arrival = normalizeArrival(rows[0]);
  const room = setting.roomAssignmentEnabled ? await assignOpenRoom(clinicId, arrival.id) : null;
  const summary = intakeSummary({
    match: input.match,
    visitReason: input.visitReason,
    answers: input.answers,
    roomName: room?.name ?? null
  });
  const updated = await sql<ArrivalRow[]>`
    update arrival_intakes
    set room_id = ${room?.id ?? null},
      room_name = ${room?.name ?? null},
      pims_write_summary = ${summary},
      updated_at = now()
    where id = ${arrival.id}
      and clinic_id = ${clinicId}
    returning id, clinic_id, status, appointment_id, client_id, pet_id, client_name, client_phone, pet_name, visit_reason, answers, room_id, room_name, pims_write_status, pims_write_summary, exception_reason, created_at, updated_at
  `;
  arrival = normalizeArrival(updated[0]);
  await sql`
    update mock_appointments
    set status = 'arrived',
      room_status = ${room?.name ?? "checked in"},
      arrived_at = coalesce(arrived_at, now()),
      updated_at = now()
    where clinic_id = ${clinicId}
      and id = ${input.match.appointmentId}
  `;
  return arrival;
}

export async function updateClinicRoom(input: {
  clinicId?: string | null;
  roomId: string;
  state: RoomState;
}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const rows = await sql<RoomRow[]>`
    update clinic_rooms
    set state = ${input.state},
      current_arrival_id = case when ${input.state} = 'occupied' then current_arrival_id else null end,
      auto_open_at = case when ${input.state} = 'cleaning' then now() + interval '10 minutes' else null end,
      state_changed_at = now(),
      updated_at = now()
    where clinic_id = ${clinicId}
      and id = ${input.roomId}
    returning id, clinic_id, name, sort_order, state, current_arrival_id, state_changed_at, auto_open_at, created_at, updated_at
  `;
  return rows[0] ? normalizeRoom(rows[0]) : null;
}

export async function checkoutArrivalRoom(input: {
  clinicId?: string | null;
  arrivalId: string;
}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const rows = await sql<RoomRow[]>`
    update clinic_rooms
    set state = 'cleaning',
      current_arrival_id = null,
      auto_open_at = now() + interval '10 minutes',
      state_changed_at = now(),
      updated_at = now()
    where clinic_id = ${clinicId}
      and current_arrival_id = ${input.arrivalId}
    returning id, clinic_id, name, sort_order, state, current_arrival_id, state_changed_at, auto_open_at, created_at, updated_at
  `;
  return rows[0] ? normalizeRoom(rows[0]) : null;
}

export async function updateArrivalSettings(input: {
  clinicId?: string | null;
  roomAssignmentEnabled: boolean;
  questionnaire: ArrivalQuestionnaire;
}) {
  const sql = getSql();
  const clinicId = await ensureArrivalSetup({ clinicId: input.clinicId });
  const rows = await sql<SettingsRow[]>`
    insert into arrival_settings (
      clinic_id,
      room_assignment_enabled,
      questionnaire
    )
    values (
      ${clinicId},
      ${input.roomAssignmentEnabled},
      ${sql.json(jsonInput(input.questionnaire))}
    )
    on conflict (clinic_id) do update set
      room_assignment_enabled = excluded.room_assignment_enabled,
      questionnaire = excluded.questionnaire,
      updated_at = now()
    returning room_assignment_enabled, questionnaire
  `;
  return normalizeSettings(rows[0]);
}
