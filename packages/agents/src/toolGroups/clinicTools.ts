import { z } from "zod";
import type { MockAppointment } from "../contracts";
import {
  clientFor,
  defineTool,
  firstClient,
  firstPet,
  id,
  isTodayOrLiteralToday,
  looseMatch,
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

export const clinicTools = {
  lookup_client: defineTool({
    description: "Look up a client by name or phone number.",
    parameters: z.object({
      clientName: z.string().optional(),
      phone: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const clients = runtime.data.clients.filter((client) => {
        if (!args.clientName && !args.phone) return true;
        return client === firstClient(runtime.data, args.clientName, args.phone);
      });
      return { clients };
    }
  }),
  lookup_pet: defineTool({
    description: "Look up pets registered to a client.",
    parameters: z.object({
      clientId: z.string(),
      petName: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const pets = runtime.data.pets.filter((pet) =>
        pet.clientId === args.clientId && (!args.petName || looseMatch(pet.name, args.petName))
      );
      return { pets };
    }
  }),
  lookup_appointment: defineTool({
    description: "Look up appointments by client, pet, status, or date.",
    parameters: z.object({
      clientId: z.string().optional(),
      petId: z.string().optional(),
      status: z.enum(["scheduled", "arrived", "ready", "completed"]).optional(),
      date: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const appointments = runtime.data.appointments.filter((appointment) => {
        if (args.clientId && appointment.clientId !== args.clientId) return false;
        if (args.petId && appointment.petId !== args.petId) return false;
        if (args.status && appointment.status !== args.status) return false;
        if (args.date && appointment.appointmentDate !== args.date && !(args.date === "today" && isTodayOrLiteralToday(appointment.appointmentDate, runtime))) return false;
        return true;
      });
      return { appointments };
    }
  }),
  list_slots: defineTool({
    description: "List available appointment slots.",
    parameters: z.object({
      appointmentType: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const slots = runtime.data.slots.filter((slot) =>
        slot.available && (!args.appointmentType || looseMatch(slot.appointmentType, args.appointmentType))
      );
      return { slots };
    }
  }),
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
  start_arrival: defineTool({
    description: "Match an arriving client and pet to today's appointment.",
    parameters: z.object({
      clientName: z.string().optional(),
      clientPhone: z.string().optional(),
      petName: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const client = firstClient(runtime.data, args.clientName, args.clientPhone);
      const pet = client ? firstPet(runtime.data, client.id, args.petName) : null;
      const appointment = pet
        ? runtime.data.appointments.find((candidate) =>
            candidate.petId === pet.id &&
            candidate.clientId === pet.clientId &&
            isTodayOrLiteralToday(candidate.appointmentDate, runtime) &&
            (candidate.status === "scheduled" || candidate.status === "arrived")
          ) ?? null
        : null;
      return { client, pet, appointment };
    }
  }),
  get_wait_status: defineTool({
    description: "Return wait estimate for an appointment.",
    parameters: z.object({
      appointmentId: z.string().optional(),
      petId: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const appointment = runtime.data.appointments.find((candidate) =>
        (args.appointmentId && candidate.id === args.appointmentId) ||
        (args.petId && candidate.petId === args.petId)
      ) ?? null;
      return {
        waitStatus: appointment
          ? {
              appointmentId: appointment.id,
              waitMinutes: appointment.waitMinutes,
              queuePosition: appointment.waitMinutes > 0 ? 2 : 0,
              roomStatus: appointment.roomStatus
            }
          : null
      };
    }
  }),
  mark_arrived: defineTool({
    description: "Mark an appointment arrived. Set waitComplaint when the client reports waiting too long.",
    parameters: z.object({
      appointmentId: z.string(),
      waitComplaint: z.boolean().optional()
    }),
    execute: async (args, runtime) => {
      const appointment = runtime.data.appointments.find((candidate) => candidate.id === args.appointmentId) ?? null;
      const client = appointment ? clientFor(runtime.data, appointment.clientId) : null;
      const pet = appointment ? petFor(runtime.data, appointment.petId) : null;
      if (!appointment || !client || !pet) return { arrived: false };
      if (appointment.status === "arrived") {
        recordEvent(runtime, {
          eventType: "already_arrived",
          title: `${pet.name} was already checked in`,
          detail: "No duplicate arrival task was created.",
          metadata: { appointmentId: appointment.id, action: "already_checked_in" }
        });
        return { arrived: true, action: "already_checked_in", alreadyArrived: true, appointment, client, pet, task: null };
      }
      const needsStaffAttention = Boolean(args.waitComplaint || appointment.waitMinutes >= 30);
      const alert = needsStaffAttention
        ? {
            action: "wait_concern_dispatched",
            status: "sent",
            delivery: "front_desk_console_mock",
            alertId: id("wait-alert", `${appointment.id}-${pet.id}-${appointment.waitMinutes}`),
            priority: "high",
            clientName: client.fullName,
            clientPhone: client.phone,
            petName: pet.name,
            waitMinutes: appointment.waitMinutes,
            notes: appointment.notes ?? null,
            sentAt: runtime.now.toISOString()
          }
        : null;
      if (alert) {
        recordEvent(runtime, {
          eventType: "wait_concern_dispatched",
          title: "Wait concern alert sent",
          detail: `${pet.name} arrived and reports a wait concern; wait estimate ${appointment.waitMinutes} minutes.`,
          metadata: alert
        });
      }
      recordEvent(runtime, {
        eventType: "arrived",
        title: `${pet.name} checked in`,
        detail: `${client.fullName} matched to ${appointment.appointmentTime} with ${appointment.doctor}.`,
        metadata: {
          appointmentId: appointment.id,
          alertId: alert?.alertId ?? null,
          waitMinutes: appointment.waitMinutes,
          action: "checked_in"
        }
      });
      return { arrived: true, action: "checked_in", appointment: { ...appointment, status: "arrived" }, client, pet, alert, task: null };
    }
  }),
  mark_pet_ready: defineTool({
    description: "Prepare a ready-for-pickup mock status update without creating a task.",
    parameters: z.object({
      petId: z.string(),
      message: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const pet = petFor(runtime.data, args.petId);
      const client = pet ? clientFor(runtime.data, pet.clientId) : null;
      if (pet && client) {
        recordEvent(runtime, {
          eventType: "pickup_status_prepared",
          title: "Pickup status prepared",
          detail: args.message ?? `${pet.name} is ready for pickup.`,
          metadata: {
            action: "pickup_status_prepared",
            delivery: "client_portal_mock",
            clientId: client.id,
            petId: pet.id
          }
        });
      }
      return { ready: Boolean(pet), pet, client, task: null };
    }
  }),
  send_status_update: defineTool({
    description: "Send a mock client portal status update; future adapter can replace this with the real portal/SMS integration.",
    parameters: z.object({
      clientId: z.string(),
      message: z.string()
    }),
    execute: async (args, runtime) => {
      const client = clientFor(runtime.data, args.clientId);
      recordEvent(runtime, {
        eventType: "status_update_sent",
        title: "Client portal update sent",
        detail: args.message,
        metadata: { clientId: args.clientId, delivery: "client_portal_mock", action: "status_update_sent" }
      });
      return { sent: true, delivery: "client_portal_mock", client, message: args.message };
    }
  }),
  capture_arrival_exception: defineTool({
    description: "Capture an arrival/check-in exception as a mock front-desk integration event, without creating a review task.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      clientPhone: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      request: z.string()
    }),
    execute: async (args, runtime) => {
      const exception = {
        action: "arrival_exception_captured",
        status: "captured",
        delivery: "front_desk_console_mock",
        confirmationId: id("arrival-exception", `${args.clientName ?? "client"}-${args.petName ?? "pet"}-${args.request}`),
        clientName: args.clientName ?? null,
        clientPhone: args.clientPhone ?? null,
        petName: args.petName ?? null,
        request: args.request,
        capturedAt: runtime.now.toISOString()
      };
      recordEvent(runtime, {
        eventType: "arrival_exception_captured",
        title: "Arrival exception captured",
        detail: args.request,
        metadata: exception
      });
      return { exception };
    }
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
  }),
  send_clinic_inbox_message: defineTool({
    description: "Send a mock clinic inbox/front-desk message for unresolved client requests, without creating a task.",
    parameters: z.object({
      subject: z.string(),
      message: z.string(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      clientName: z.string().optional().nullable(),
      clientPhone: z.string().optional().nullable(),
      petName: z.string().optional().nullable()
    }),
    execute: async (args, runtime) => {
      const message = {
        action: "clinic_message_sent",
        status: "sent",
        delivery: "clinic_inbox_mock",
        messageId: id("clinic-message", `${args.subject}-${args.clientName ?? "client"}-${args.petName ?? "pet"}-${args.message}`),
        priority: args.priority ?? "medium",
        clientName: args.clientName ?? null,
        clientPhone: args.clientPhone ?? null,
        petName: args.petName ?? null,
        subject: args.subject,
        body: args.message,
        sentAt: runtime.now.toISOString()
      };
      recordEvent(runtime, {
        eventType: "clinic_message_sent",
        title: args.subject,
        detail: args.message,
        metadata: message
      });
      return { message };
    }
  }),
  dispatch_clinical_triage: defineTool({
    description: "Dispatch a mock urgent clinical triage alert without giving medical advice or creating a review task.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      clientPhone: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      message: z.string(),
      priority: z.enum(["low", "medium", "high"]),
      reasons: z.array(z.string()).optional()
    }),
    execute: async (args, runtime) => {
      const alert = {
        action: "clinical_triage_dispatched",
        status: "sent",
        delivery: "clinical_triage_mock",
        alertId: id("clinical-alert", `${args.clientName ?? "client"}-${args.petName ?? "pet"}-${args.message}`),
        priority: args.priority,
        clientName: args.clientName ?? null,
        clientPhone: args.clientPhone ?? null,
        petName: args.petName ?? null,
        message: args.message,
        reasons: args.reasons ?? [],
        medicalAdviceGiven: false,
        sentAt: runtime.now.toISOString()
      };
      recordEvent(runtime, {
        eventType: "clinical_triage_dispatched",
        title: "Clinical triage alert sent",
        detail: args.message,
        metadata: alert
      });
      return { alert, medicalAdviceGiven: false };
    }
  })
};
