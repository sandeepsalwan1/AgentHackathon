import { z } from "zod";
import {
  defineTool,
  firstClient,
  firstPet,
  isTodayOrLiteralToday,
  looseMatch
} from "../toolCore";

export const clinicLookupTools = {
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
  })
};
