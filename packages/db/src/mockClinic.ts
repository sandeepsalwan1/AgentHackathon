import { getSql } from "./connection";
import { resolveClinicId } from "./clinics";
import {
  normalizeAppointment,
  normalizeFollowup,
  normalizeInvoice,
  normalizeSlot,
  type AppointmentRow,
  type FollowupRow,
  type InvoiceRow,
  type SlotRow
} from "./mockClinicRows";
export type {
  MockAppointment,
  MockCallTranscript,
  MockClient,
  MockFollowup,
  MockInvoice,
  MockMessage,
  MockPet,
  MockSlot
} from "./mockClinicRows";
export type {
  MockService,
  PricingObservation
} from "./mockClinicPricingRows";
export type {
  MockLabCatalogItem,
  MockLabOrder,
  MockLabResult
} from "./mockClinicLabRows";

export async function resetMockClinicState(options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  const appointmentRows = await sql<{ id: string }[]>`
    update mock_appointments
    set status = 'scheduled',
      room_status = 'waiting',
      arrived_at = null,
      updated_at = now()
    where clinic_id = ${clinicId}
      and (status = 'arrived' or arrived_at is not null)
    returning id
  `;
  const bookedRows = await sql<{ id: string }[]>`
    delete from mock_appointments
    where clinic_id = ${clinicId}
      and id like 'appointment-slot-%'
    returning id
  `;
  const slotRows = await sql<{ id: string }[]>`
    update mock_slots
    set available = true
    where clinic_id = ${clinicId}
      and available = false
    returning id
  `;
  const followupRows = await sql<{ id: string }[]>`
    update mock_followups
    set status = 'open'
    where clinic_id = ${clinicId}
      and status <> 'open'
    returning id
  `;
  return {
    resetAppointments: appointmentRows.length,
    resetBookedAppointments: bookedRows.length,
    resetSlots: slotRows.length,
    resetFollowups: followupRows.length
  };
}

export async function markAppointmentArrived(id: string, options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
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
      and clinic_id = ${clinicId}
    returning id, client_id, pet_id, appointment_date, appointment_time, appointment_type, doctor, status, wait_minutes, room_status, arrived_at, notes
  `;
  return rows[0] ? normalizeAppointment(rows[0]) : null;
}

export async function bookMockAppointment(input: {
  clinicId?: string | null;
  slotId: string;
  clientId: string;
  petId: string;
  reason?: string | null;
}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const rows = await sql<AppointmentRow[]>`
    with selected_slot as (
      update mock_slots
      set available = false
      where id = ${input.slotId}
        and clinic_id = ${clinicId}
        and available = true
      returning id, slot_date, slot_time, doctor, appointment_type
    ),
    inserted as (
      insert into mock_appointments (
        id,
        clinic_id,
        client_id,
        pet_id,
        appointment_date,
        appointment_time,
        appointment_type,
        doctor,
        status,
        wait_minutes,
        room_status,
        notes
      )
      select
        ${`appointment-${input.slotId}-${input.petId}`},
        ${clinicId},
        ${input.clientId},
        ${input.petId},
        slot_date,
        slot_time,
        appointment_type,
        doctor,
        'scheduled',
        0,
        'waiting',
        ${input.reason ?? "Booked by VetAgent"}
      from selected_slot
      on conflict (id) do update
        set status = excluded.status,
          updated_at = now()
        where mock_appointments.clinic_id = ${clinicId}
      returning id, client_id, pet_id, appointment_date, appointment_time, appointment_type, doctor, status, wait_minutes, room_status, arrived_at, notes
    )
    select * from inserted
  `;
  return rows[0] ? normalizeAppointment(rows[0]) : null;
}

export async function listAvailableSlots(
  appointmentType?: string | null,
  options?: { clinicId?: string | null }
) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  const type = appointmentType?.trim();
  const rows = type
    ? await sql<SlotRow[]>`
        select id, slot_date, slot_time, doctor, appointment_type, available
        from mock_slots
        where available = true
          and clinic_id = ${clinicId}
          and appointment_type ilike ${`%${type}%`}
        order by slot_date asc, slot_time asc
        limit 8
      `
    : await sql<SlotRow[]>`
        select id, slot_date, slot_time, doctor, appointment_type, available
        from mock_slots
        where available = true
          and clinic_id = ${clinicId}
        order by slot_date asc, slot_time asc
        limit 8
      `;
  return rows.map(normalizeSlot);
}

export async function listOpenFollowups(options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  const rows = await sql<FollowupRow[]>`
    select id, client_id, pet_id, followup_type, due_date, recommended_action, status
    from mock_followups
    where clinic_id = ${clinicId}
      and status = 'open'
    order by due_date asc
  `;
  return rows.map(normalizeFollowup);
}

export async function markFollowupContacted(id: string, options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  const rows = await sql<FollowupRow[]>`
    update mock_followups
    set status = 'contacted'
    where id = ${id}
      and clinic_id = ${clinicId}
    returning id, client_id, pet_id, followup_type, due_date, recommended_action, status
  `;
  return rows[0] ? normalizeFollowup(rows[0]) : null;
}

export async function listReviewInvoices(options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  const rows = await sql<InvoiceRow[]>`
    select id, client_id, pet_id, invoice_number, invoice_date, total_cents, status, line_items, flags
    from mock_invoices
    where clinic_id = ${clinicId}
      and (status = 'review' or jsonb_array_length(flags) > 0)
    order by invoice_date desc
  `;
  return rows.map(normalizeInvoice);
}
