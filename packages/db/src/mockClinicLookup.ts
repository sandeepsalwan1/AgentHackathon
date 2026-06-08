import { resolveClinicId } from "./clinics";
import { getSql } from "./connection";
import {
  normalizeAppointment,
  type AppointmentRow
} from "./mockClinicRows";

function cleanLookupText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function phoneDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

export async function findArrivalAppointment(input: {
  clinicId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  petName?: string | null;
}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const nameKey = cleanLookupText(input.clientName);
  const phoneKey = phoneDigits(input.clientPhone);
  const petKey = cleanLookupText(input.petName);
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
    join mock_clients client on client.id = appointment.client_id and client.clinic_id = appointment.clinic_id
    join mock_pets pet on pet.id = appointment.pet_id and pet.clinic_id = appointment.clinic_id
    where appointment.clinic_id = ${clinicId}
      and appointment.appointment_date = current_date
    order by
      case when appointment.status = 'arrived' then 1 else 0 end,
      appointment.appointment_time asc
  `;

  const row = rows.find((appointment) => {
    const nameMatch = nameKey.length >= 4 && cleanLookupText(appointment.client_name).includes(nameKey);
    const phoneMatch = phoneKey.length >= 7 && phoneDigits(appointment.client_phone).endsWith(phoneKey.slice(-10));
    const petMatch = petKey.length >= 2 && cleanLookupText(appointment.pet_name).includes(petKey);
    return Boolean(petMatch && (nameMatch || phoneMatch));
  });
  return row ? normalizeAppointment(row) : null;
}
