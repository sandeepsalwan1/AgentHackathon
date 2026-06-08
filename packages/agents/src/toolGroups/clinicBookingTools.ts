import { z } from "zod";
import type { MockAppointment } from "../contracts";
import {
  clientFor,
  defineTool,
  id,
  petFor,
  recordEvent,
  type ToolRuntime
} from "../toolCore";

async function createBookingHold(args: {
  slotId: string;
  clientId: string;
  petId: string;
  reason?: string;
}, runtime: ToolRuntime) {
  const slot = runtime.data.slots.find((candidate) => candidate.id === args.slotId && candidate.available) ?? null;
  const client = clientFor(runtime.data, args.clientId);
  const pet = petFor(runtime.data, args.petId);
  if (!slot || !client || !pet) return { booked: false, action: "booking_not_completed", slot, client, pet };
  slot.available = false;
  const appointment: MockAppointment = {
    id: id("appointment", `${slot.id}-${pet.id}`),
    clientId: client.id,
    petId: pet.id,
    appointmentDate: slot.slotDate,
    appointmentTime: slot.slotTime,
    appointmentType: slot.appointmentType,
    doctor: slot.doctor,
    status: "scheduled",
    waitMinutes: 0,
    roomStatus: "waiting",
    notes: args.reason ?? "Booked by VetAgent."
  };
  runtime.data.appointments.push(appointment);
  recordEvent(runtime, {
    eventType: "appointment_booked",
    title: "Appointment booked",
    detail: `${pet.name} booked for ${slot.appointmentType} on ${slot.slotDate} at ${slot.slotTime}.`,
    metadata: {
      slotId: slot.id,
      appointmentId: appointment.id,
      clientId: client.id,
      petId: pet.id,
      action: "appointment_booked"
    }
  });
  return {
    booked: true,
    action: "appointment_booked",
    confirmationId: appointment.id,
    appointment,
    slot: { ...slot, available: false },
    client,
    pet,
    task: null
  };
}

export const clinicBookingTools = {
  create_booking_hold: defineTool({
    description: "Reserve an available appointment slot for a matched client and pet.",
    parameters: z.object({
      slotId: z.string(),
      clientId: z.string(),
      petId: z.string(),
      reason: z.string().optional()
    }),
    execute: async (args, runtime) => createBookingHold(args, runtime)
  }),
  book_appointment: defineTool({
    description: "Book an available appointment slot for a matched client and pet.",
    parameters: z.object({
      slotId: z.string(),
      clientId: z.string(),
      petId: z.string(),
      reason: z.string().optional()
    }),
    execute: async (args, runtime) => createBookingHold(args, runtime)
  }),
  capture_booking_request: defineTool({
    description: "Capture an appointment request in a mock scheduler intake, without creating a pending review task.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      clientPhone: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      appointmentType: z.string().optional().nullable(),
      request: z.string()
    }),
    execute: async (args, runtime) => {
      const intake = {
        action: "booking_request_captured",
        status: "captured",
        delivery: "scheduler_intake_mock",
        intakeId: id("booking-intake", `${args.clientName ?? "client"}-${args.petName ?? "pet"}-${args.appointmentType ?? "appointment"}-${args.request}`),
        clientName: args.clientName ?? null,
        clientPhone: args.clientPhone ?? null,
        petName: args.petName ?? null,
        appointmentType: args.appointmentType ?? null,
        request: args.request,
        capturedAt: runtime.now.toISOString()
      };
      recordEvent(runtime, {
        eventType: "booking_request_captured",
        title: "Booking request captured",
        detail: args.request,
        metadata: intake
      });
      return { intake };
    }
  })
};
