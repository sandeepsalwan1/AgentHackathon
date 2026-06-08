import type {
  MockAppointment,
  MockClinicData,
  MockClient,
  MockFollowup,
  MockInvoice,
  MockLabCatalogItem,
  MockLabOrder,
  MockLabResult,
  MockPet,
  MockService,
  MockSlot,
  PricingObservation
} from "./contracts";

export type AdapterContext = {
  clinicId?: string;
  data: MockClinicData;
  now: Date;
};

export type ClientLookupInput = {
  clientName?: string | null;
  phone?: string | null;
};

export type PetLookupInput = {
  clientId: string;
  petName?: string | null;
};

export type AppointmentLookupInput = {
  clientId?: string | null;
  petId?: string | null;
  status?: MockAppointment["status"] | null;
  date?: string | null;
};

export type SlotLookupInput = {
  appointmentType?: string | null;
};

export type BookingHoldInput = {
  slotId: string;
  clientId: string;
  petId: string;
  reason?: string | null;
};

export type BookingHoldResult = {
  booked: boolean;
  action: "appointment_booked" | "booking_not_completed";
  confirmationId?: string;
  appointment: MockAppointment | null;
  slot: MockSlot | null;
  client: MockClient | null;
  pet: MockPet | null;
  task: null;
};

export type ArrivalMatchInput = {
  clientName?: string | null;
  clientPhone?: string | null;
  petName?: string | null;
};

export type ArrivalMatchResult = {
  client: MockClient | null;
  pet: MockPet | null;
  appointment: MockAppointment | null;
};

export type WaitStatusInput = {
  appointmentId?: string | null;
  petId?: string | null;
};

export type WaitStatusResult = {
  appointmentId: string;
  waitMinutes: number;
  queuePosition: number;
  roomStatus: MockAppointment["roomStatus"];
} | null;

export type InvoiceLookupInput = {
  clientId?: string | null;
  petId?: string | null;
};

export type InvoiceContext = {
  invoice: MockInvoice | null;
  client: MockClient | null;
  pet: MockPet | null;
};

export type RecordsTransferInput = {
  clientName?: string | null;
  petName?: string | null;
  destination?: string | null;
  request?: string | null;
};

export type RecordsAuditResult = {
  status: "passed" | "blocked";
  source: string;
  reason: string;
  checkedAt: string;
  requiresApproval: boolean;
  clientName: string | null;
  petName: string | null;
  destination: string | null;
};

export type RecordsPacket = {
  clientName: string | null;
  petName: string | null;
  destination: string | null;
  requiresApproval: boolean;
  attachments: string[];
};

export type RecordsTransferResult = {
  status: "sent" | "blocked";
  delivery: string;
  clientName: string | null;
  petName: string | null;
  destination: string | null;
  confirmationId: string;
  sentAt: string | null;
};

export type LabOrderLookupInput = {
  clientId?: string | null;
  petId?: string | null;
  patientName?: string | null;
  status?: string | null;
};

export type LabResultLookupInput = {
  labOrderId?: string | null;
  externalOrderId?: string | null;
};

export type FollowupOutreachResult = {
  candidate: MockFollowup | null;
  client?: MockClient;
  pet?: MockPet;
  outreach?: {
    status: "sent";
    channel: string;
    sentAt: string;
    message: string;
  };
  task: null;
};

export type ClientAdapter = {
  findClients(input: ClientLookupInput): Promise<MockClient[]>;
  getClient(clientId: string): Promise<MockClient | null>;
};

export type PetAdapter = {
  findPets(input: PetLookupInput): Promise<MockPet[]>;
  getPet(petId: string): Promise<MockPet | null>;
};

export type AppointmentAdapter = {
  findAppointments(input: AppointmentLookupInput): Promise<MockAppointment[]>;
  listSlots(input: SlotLookupInput): Promise<MockSlot[]>;
  createBookingHold(input: BookingHoldInput): Promise<BookingHoldResult>;
  matchArrival(input: ArrivalMatchInput): Promise<ArrivalMatchResult>;
  getWaitStatus(input: WaitStatusInput): Promise<WaitStatusResult>;
};

export type PricingAdapter = {
  listServices(): Promise<MockService[]>;
  listObservations(input?: { source?: PricingObservation["source"] | null }): Promise<PricingObservation[]>;
  replaceObservations(observations: PricingObservation[]): Promise<PricingObservation[]>;
};

export type InvoiceAdapter = {
  findInvoices(input: InvoiceLookupInput): Promise<MockInvoice[]>;
  getInvoiceContext(invoiceId: string): Promise<InvoiceContext>;
};

export type RecordsAdapter = {
  auditTransfer(input: RecordsTransferInput): Promise<RecordsAuditResult>;
  preparePacket(input: RecordsTransferInput): Promise<RecordsPacket>;
  completeTransfer(input: RecordsTransferInput): Promise<RecordsTransferResult>;
};

export type LabAdapter = {
  listCatalog(input?: { active?: boolean | null }): Promise<MockLabCatalogItem[]>;
  findOrders(input: LabOrderLookupInput): Promise<MockLabOrder[]>;
  getResult(input: LabResultLookupInput): Promise<{ order: MockLabOrder | null; result: MockLabResult | null }>;
};

export type MessagingAdapter = {
  sendFollowupOutreach(candidateId: string): Promise<FollowupOutreachResult>;
};

export type VetAgentAdapters = {
  clients: ClientAdapter;
  pets: PetAdapter;
  appointments: AppointmentAdapter;
  pricing: PricingAdapter;
  invoices: InvoiceAdapter;
  records: RecordsAdapter;
  labs: LabAdapter;
  messaging: MessagingAdapter;
};

function clean(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? "";
}

function looseMatch(source: string, query: string) {
  const left = source.toLowerCase().replace(/[^a-z0-9]/g, "");
  const right = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  return Boolean(right && left.includes(right));
}

function mockId(prefix: string, seed: string) {
  return `${prefix}-${seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"}`;
}

function clientFor(data: MockClinicData, clientId: string) {
  return data.clients.find((client) => client.id === clientId) ?? null;
}

function petFor(data: MockClinicData, petId: string) {
  return data.pets.find((pet) => pet.id === petId) ?? null;
}

function firstClient(data: MockClinicData, input: ClientLookupInput) {
  const phoneDigits = clean(input.phone).replace(/[^0-9]/g, "");
  return data.clients.find((client) => {
    const nameOk = input.clientName ? looseMatch(client.fullName, input.clientName) : false;
    const phoneOk = phoneDigits
      ? client.phone.replace(/[^0-9]/g, "").endsWith(phoneDigits.slice(-7))
      : false;
    return nameOk || phoneOk;
  }) ?? null;
}

function firstPet(data: MockClinicData, input: PetLookupInput) {
  const pets = data.pets.filter((pet) => pet.clientId === input.clientId);
  const petName = input.petName;
  return petName
    ? pets.find((pet) => looseMatch(pet.name, petName)) ?? null
    : pets[0] ?? null;
}

function todayText(context: AdapterContext) {
  return context.now.toISOString().slice(0, 10);
}

function isTodayOrLiteralToday(date: string, context: AdapterContext) {
  return date === "today" || date === todayText(context);
}

function recordsTransfer(input: RecordsTransferInput, sentAt: string): RecordsTransferResult {
  const hasDestination = Boolean(input.destination?.trim());
  return {
    status: hasDestination ? "sent" : "blocked",
    delivery: "secure_portal_mock",
    clientName: input.clientName ?? null,
    petName: input.petName ?? null,
    destination: input.destination ?? null,
    confirmationId: mockId("records-transfer", `${input.clientName ?? "client"}-${input.petName ?? "pet"}-${input.destination ?? "destination"}`),
    sentAt: hasDestination ? sentAt : null
  };
}

export function createMockClinicAdapters(context: AdapterContext): VetAgentAdapters {
  const { data } = context;
  return {
    clients: {
      async findClients(input) {
        if (!input.clientName && !input.phone) return data.clients;
        const client = firstClient(data, input);
        return client ? [client] : [];
      },
      async getClient(clientId) {
        return clientFor(data, clientId);
      }
    },
    pets: {
      async findPets(input) {
        return data.pets.filter((pet) =>
          pet.clientId === input.clientId && (!input.petName || looseMatch(pet.name, input.petName))
        );
      },
      async getPet(petId) {
        return petFor(data, petId);
      }
    },
    appointments: {
      async findAppointments(input) {
        return data.appointments.filter((appointment) => {
          if (input.clientId && appointment.clientId !== input.clientId) return false;
          if (input.petId && appointment.petId !== input.petId) return false;
          if (input.status && appointment.status !== input.status) return false;
          if (input.date && appointment.appointmentDate !== input.date && !(input.date === "today" && isTodayOrLiteralToday(appointment.appointmentDate, context))) return false;
          return true;
        });
      },
      async listSlots(input) {
        return data.slots.filter((slot) =>
          slot.available && (!input.appointmentType || looseMatch(slot.appointmentType, input.appointmentType))
        );
      },
      async createBookingHold(input) {
        const slot = data.slots.find((candidate) => candidate.id === input.slotId && candidate.available) ?? null;
        const client = clientFor(data, input.clientId);
        const pet = petFor(data, input.petId);
        if (!slot || !client || !pet) {
          return { booked: false, action: "booking_not_completed", appointment: null, slot, client, pet, task: null };
        }
        slot.available = false;
        const appointment: MockAppointment = {
          id: mockId("appointment", `${slot.id}-${pet.id}`),
          clientId: client.id,
          petId: pet.id,
          appointmentDate: slot.slotDate,
          appointmentTime: slot.slotTime,
          appointmentType: slot.appointmentType,
          doctor: slot.doctor,
          status: "scheduled",
          waitMinutes: 0,
          roomStatus: "waiting",
          notes: input.reason ?? "Booked by VetAgent."
        };
        data.appointments.push(appointment);
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
      },
      async matchArrival(input) {
        const client = firstClient(data, { clientName: input.clientName, phone: input.clientPhone });
        const pet = client ? firstPet(data, { clientId: client.id, petName: input.petName }) : null;
        const appointment = pet
          ? data.appointments.find((candidate) =>
              candidate.petId === pet.id &&
              candidate.clientId === pet.clientId &&
              isTodayOrLiteralToday(candidate.appointmentDate, context) &&
              (candidate.status === "scheduled" || candidate.status === "arrived")
            ) ?? null
          : null;
        return { client, pet, appointment };
      },
      async getWaitStatus(input) {
        const appointment = data.appointments.find((candidate) =>
          (input.appointmentId && candidate.id === input.appointmentId) ||
          (input.petId && candidate.petId === input.petId)
        ) ?? null;
        return appointment
          ? {
              appointmentId: appointment.id,
              waitMinutes: appointment.waitMinutes,
              queuePosition: appointment.waitMinutes > 0 ? 2 : 0,
              roomStatus: appointment.roomStatus
            }
          : null;
      }
    },
    pricing: {
      async listServices() {
        return data.services;
      },
      async listObservations(input) {
        return input?.source
          ? data.pricingObservations.filter((item) => item.source === input.source)
          : data.pricingObservations;
      },
      async replaceObservations(observations) {
        data.pricingObservations = observations;
        return data.pricingObservations;
      }
    },
    invoices: {
      async findInvoices(input) {
        return data.invoices.filter((invoice) =>
          (!input.clientId || invoice.clientId === input.clientId) &&
          (!input.petId || invoice.petId === input.petId)
        );
      },
      async getInvoiceContext(invoiceId) {
        const invoice = data.invoices.find((candidate) => candidate.id === invoiceId) ?? null;
        const client = invoice ? clientFor(data, invoice.clientId) : null;
        const pet = invoice ? petFor(data, invoice.petId) : null;
        return { invoice, client, pet };
      }
    },
    records: {
      async auditTransfer(input) {
        const missingDestination = !input.destination?.trim();
        return {
          status: missingDestination ? "blocked" : "passed",
          source: "local_records_policy",
          reason: missingDestination
            ? "Destination is missing; transfer is blocked until a destination is provided."
            : "Client identity and destination fields passed demo transfer policy.",
          checkedAt: context.now.toISOString(),
          requiresApproval: false,
          clientName: input.clientName ?? null,
          petName: input.petName ?? null,
          destination: input.destination ?? null
        };
      },
      async preparePacket(input) {
        return {
          clientName: input.clientName ?? null,
          petName: input.petName ?? null,
          destination: input.destination ?? null,
          requiresApproval: false,
          attachments: ["vaccine-summary.pdf", "visit-notes.pdf"]
        };
      },
      async completeTransfer(input) {
        return recordsTransfer(input, context.now.toISOString());
      }
    },
    labs: {
      async listCatalog(input) {
        return (data.labCatalog ?? []).filter((item) =>
          typeof input?.active === "boolean" ? item.active === input.active : true
        );
      },
      async findOrders(input) {
        return (data.labOrders ?? []).filter((order) => {
          if (input.clientId && order.clientId !== input.clientId) return false;
          if (input.petId && order.petId !== input.petId) return false;
          if (input.status && order.status !== input.status) return false;
          if (input.patientName && !looseMatch(order.patientName, input.patientName)) return false;
          return true;
        });
      },
      async getResult(input) {
        const result = (data.labResults ?? []).find((item) =>
          (input.labOrderId && item.labOrderId === input.labOrderId) ||
          (input.externalOrderId && item.externalOrderId === input.externalOrderId)
        ) ?? null;
        const order = result
          ? (data.labOrders ?? []).find((item) => item.id === result.labOrderId) ?? null
          : null;
        return { order, result };
      }
    },
    messaging: {
      async sendFollowupOutreach(candidateId) {
        const candidate = data.followups.find((item) => item.id === candidateId) ?? null;
        const client = candidate ? clientFor(data, candidate.clientId) : null;
        const pet = candidate ? petFor(data, candidate.petId) : null;
        if (!candidate || !client || !pet) return { candidate, task: null };
        candidate.status = "contacted";
        return {
          candidate,
          client,
          pet,
          outreach: {
            status: "sent",
            channel: "client_portal_mock",
            sentAt: context.now.toISOString(),
            message: `${pet.name} is due for ${candidate.followupType}. ${candidate.recommendedAction}`
          },
          task: null
        };
      }
    }
  };
}
