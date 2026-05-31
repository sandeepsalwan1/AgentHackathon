import { z } from "zod";
import type {
  AgentApprovalDraft,
  AgentEffect,
  AgentInput,
  AgentIntent,
  AgentReportDraft,
  AgentTaskDraft,
  MockAppointment,
  MockClinicData,
  MockClient,
  MockInvoice,
  MockPet,
  MockService,
  PricingObservation,
  TaskPriority,
  TaskRequestType,
  ToolCallTrace,
  WorkflowEventDraft
} from "./contracts";
import { mockClinicData } from "./mockData";

type ToolRuntime = {
  data: MockClinicData;
  now: Date;
  input: AgentInput;
  workflowType: AgentIntent;
  effects: AgentEffect[];
  workflowEvents: WorkflowEventDraft[];
  toolCalls: ToolCallTrace[];
};

type ToolDefinition<T extends z.ZodTypeAny> = {
  description: string;
  parameters: T;
  execute: (args: z.infer<T>, runtime: ToolRuntime) => Promise<Record<string, unknown>>;
};

type ToolRegistry = typeof tools;
export type ToolName = keyof ToolRegistry;

function id(prefix: string, seed: string) {
  return `${prefix}-${seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"}`;
}

function clean(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? "";
}

function looseMatch(source: string, query: string) {
  const left = source.toLowerCase().replace(/[^a-z0-9]/g, "");
  const right = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  return Boolean(right && left.includes(right));
}

function textFromInput(input: AgentInput) {
  return [
    input.message,
    input.request,
    input.transcript,
    input.body
  ].filter((value): value is string => Boolean(value?.trim())).join(" ");
}

function clientFor(data: MockClinicData, clientId: string) {
  return data.clients.find((client) => client.id === clientId) ?? null;
}

function petFor(data: MockClinicData, petId: string) {
  return data.pets.find((pet) => pet.id === petId) ?? null;
}

function firstClient(data: MockClinicData, clientName?: string, phone?: string) {
  const phoneDigits = clean(phone).replace(/[^0-9]/g, "");
  return data.clients.find((client) => {
    const nameOk = clientName ? looseMatch(client.fullName, clientName) : false;
    const phoneOk = phoneDigits
      ? client.phone.replace(/[^0-9]/g, "").endsWith(phoneDigits.slice(-7))
      : false;
    return nameOk || phoneOk;
  }) ?? null;
}

function firstPet(data: MockClinicData, clientId: string, petName?: string) {
  const pets = data.pets.filter((pet) => pet.clientId === clientId);
  return petName
    ? pets.find((pet) => looseMatch(pet.name, petName)) ?? null
    : pets[0] ?? null;
}

function makeTask(input: {
  status?: "pending_review" | "due" | "pending";
  priority?: TaskPriority;
  requestType?: TaskRequestType;
  clientName?: string | null;
  clientPhone?: string | null;
  petName?: string | null;
  request: string;
  notes?: string | null;
  dueTimeHint?: string;
}) {
  const task: AgentTaskDraft = {
    id: id("task", `${input.clientName ?? "clinic"}-${input.petName ?? "request"}-${input.request}`),
    kind: "task",
    status: input.status ?? "pending_review",
    priority: input.priority ?? "medium",
    requestType: input.requestType ?? "patient_update",
    clientName: input.clientName ?? null,
    clientPhone: input.clientPhone ?? null,
    petName: input.petName ?? null,
    request: input.request,
    notes: input.notes ?? null,
    dueTimeHint: input.dueTimeHint
  };
  return task;
}

function makeApproval(input: Omit<AgentApprovalDraft, "id" | "kind">) {
  return {
    id: id("approval", `${input.approvalType}-${input.title}`),
    kind: "approval" as const,
    ...input
  };
}

function makeReport(input: Omit<AgentReportDraft, "id" | "kind">) {
  return {
    id: id("report", `${input.reportType}-${input.title}`),
    kind: "report" as const,
    ...input
  };
}

function recordEvent(runtime: ToolRuntime, event: Omit<WorkflowEventDraft, "id" | "createdAt" | "workflowType">) {
  const workflowEvent: WorkflowEventDraft = {
    id: id("event", `${runtime.workflowType}-${event.eventType}-${runtime.workflowEvents.length}`),
    workflowType: runtime.workflowType,
    eventType: event.eventType,
    title: event.title,
    detail: event.detail,
    metadata: event.metadata,
    createdAt: runtime.now.toISOString()
  };
  runtime.workflowEvents.push(workflowEvent);
  runtime.effects.push(workflowEvent);
  return workflowEvent;
}

function addEffect<T extends AgentEffect>(runtime: ToolRuntime, effect: T) {
  runtime.effects.push(effect);
  return effect;
}

function comparePrices(services: MockService[], observations: PricingObservation[]) {
  return observations.map((observation) => {
    const service = services.find((candidate) =>
      looseMatch(candidate.serviceName, observation.serviceName) ||
      looseMatch(observation.serviceName, candidate.serviceName)
    );
    const deltaCents =
      service && typeof observation.observedPriceCents === "number"
        ? observation.observedPriceCents - service.currentPriceCents
        : null;
    const recommendation =
      deltaCents === null
        ? "Review manually; competitor price was not normalized."
        : deltaCents > 1000
          ? "Clinic appears under local market; review whether the price is sustainable."
          : deltaCents < -1000
            ? "Clinic appears above local market; review client sensitivity and positioning."
            : "Close to observed market; no immediate change recommended.";
    return {
      observation,
      service,
      deltaCents,
      recommendation,
      flagged: deltaCents === null || Math.abs(deltaCents) > 1000
    };
  });
}

function triageText(message: string) {
  const text = message.toLowerCase();
  const urgent = /(blood|seizure|collapse|poison|toxin|breathing|emergency|lethargic)/.test(text);
  const intent =
    urgent || /(vomit|diarrhea|pain|sick|hurt)/.test(text)
      ? "sick_pet"
      : /(record|transfer)/.test(text)
        ? "records"
        : /(book|schedule|appointment|reschedule)/.test(text)
          ? "booking"
          : /(arriv|outside|check.?in|waiting|here for)/.test(text)
            ? "checkin"
            : "unknown";
  return { triage: { intent, urgent } };
}

export function createToolRuntime(input: AgentInput, workflowType: AgentIntent, options: {
  clinicData?: MockClinicData;
  now?: Date;
} = {}): ToolRuntime {
  return {
    data: options.clinicData ?? mockClinicData,
    now: options.now ?? new Date("2026-05-31T12:00:00.000Z"),
    input,
    workflowType,
    effects: [],
    workflowEvents: [],
    toolCalls: []
  };
}

export const tools = {
  lookup_client: {
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
  },
  lookup_pet: {
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
  },
  list_slots: {
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
  },
  book_appointment: {
    description: "Prepare a booking confirmation for a client and pet.",
    parameters: z.object({
      slotId: z.string(),
      clientId: z.string(),
      petId: z.string(),
      reason: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const slot = runtime.data.slots.find((candidate) => candidate.id === args.slotId && candidate.available) ?? null;
      const client = clientFor(runtime.data, args.clientId);
      const pet = petFor(runtime.data, args.petId);
      if (!slot || !client || !pet) return { booked: false, slot, client, pet };
      const task = addEffect(runtime, makeTask({
        status: "pending_review",
        priority: "medium",
        requestType: "scheduling",
        clientName: client.fullName,
        clientPhone: client.phone,
        petName: pet.name,
        request: `Confirm ${slot.appointmentType} appointment for ${pet.name} on ${slot.slotDate} at ${slot.slotTime}.`,
        notes: args.reason ?? "Agent-selected slot needs staff confirmation."
      }));
      recordEvent(runtime, {
        eventType: "booking_prepared",
        title: "Booking option selected",
        detail: "No appointment was finalized without staff confirmation.",
        metadata: { slotId: slot.id, taskId: task.id }
      });
      return { booked: true, slot, client, pet, task };
    }
  },
  start_arrival: {
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
            candidate.appointmentDate === "today" &&
            candidate.status === "scheduled"
          ) ?? null
        : null;
      return { client, pet, appointment };
    }
  },
  get_wait_status: {
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
  },
  mark_arrived: {
    description: "Prepare arrival update and staff task.",
    parameters: z.object({
      appointmentId: z.string()
    }),
    execute: async (args, runtime) => {
      const appointment = runtime.data.appointments.find((candidate) => candidate.id === args.appointmentId) ?? null;
      const client = appointment ? clientFor(runtime.data, appointment.clientId) : null;
      const pet = appointment ? petFor(runtime.data, appointment.petId) : null;
      if (!appointment || !client || !pet) return { arrived: false };
      const task = addEffect(runtime, makeTask({
        status: "due",
        priority: appointment.waitMinutes >= 30 ? "high" : "medium",
        requestType: "scheduling",
        clientName: client.fullName,
        clientPhone: client.phone,
        petName: pet.name,
        request: `${pet.name} arrived for ${appointment.appointmentType}; wait estimate ${appointment.waitMinutes} minutes.`,
        notes: appointment.notes ?? null
      }));
      recordEvent(runtime, {
        eventType: "arrived",
        title: `${pet.name} checked in`,
        detail: `${client.fullName} matched to ${appointment.appointmentTime} with ${appointment.doctor}.`,
        metadata: { appointmentId: appointment.id, taskId: task.id, waitMinutes: appointment.waitMinutes }
      });
      return { arrived: true, appointment: { ...appointment, status: "arrived" }, client, pet, task };
    }
  },
  mark_pet_ready: {
    description: "Prepare a ready-for-pickup status update.",
    parameters: z.object({
      petId: z.string(),
      message: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const pet = petFor(runtime.data, args.petId);
      const client = pet ? clientFor(runtime.data, pet.clientId) : null;
      const task = pet && client ? addEffect(runtime, makeTask({
        status: "due",
        priority: "low",
        requestType: "patient_update",
        clientName: client.fullName,
        clientPhone: client.phone,
        petName: pet.name,
        request: args.message ?? `${pet.name} is ready for pickup.`
      })) : null;
      return { ready: Boolean(pet), pet, client, task };
    }
  },
  send_status_update: {
    description: "Draft a client status update; no SMS is sent by the agent package.",
    parameters: z.object({
      clientId: z.string(),
      message: z.string()
    }),
    execute: async (args, runtime) => {
      const client = clientFor(runtime.data, args.clientId);
      recordEvent(runtime, {
        eventType: "status_update_drafted",
        title: "Client update drafted",
        detail: "Delivery is left to the route/application layer.",
        metadata: { clientId: args.clientId }
      });
      return { sent: false, delivery: "draft_only", client, message: args.message };
    }
  },
  create_task: {
    description: "Create a structured task draft for clinic staff.",
    parameters: z.object({
      request: z.string(),
      requestType: z.enum(["prescription", "labs_xrays", "records_request", "scheduling", "patient_update"]).optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      status: z.enum(["pending_review", "due", "pending"]).optional(),
      clientName: z.string().optional().nullable(),
      clientPhone: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      notes: z.string().optional().nullable()
    }),
    execute: async (args, runtime) => {
      const task = addEffect(runtime, makeTask(args));
      recordEvent(runtime, {
        eventType: "task_created",
        title: "Staff task drafted",
        detail: args.request,
        metadata: { taskId: task.id, priority: task.priority }
      });
      return { task };
    }
  },
  update_task: {
    description: "Draft a task update without mutating persistence directly.",
    parameters: z.object({
      taskId: z.string(),
      status: z.enum(["pending_review", "due", "pending", "completed", "invalid", "archived"]).optional(),
      notes: z.string().optional()
    }),
    execute: async (args, runtime) => {
      recordEvent(runtime, {
        eventType: "task_update_requested",
        title: "Task update requested",
        detail: args.notes ?? null,
        metadata: { taskId: args.taskId, status: args.status ?? null }
      });
      return { taskUpdate: args };
    }
  },
  triage_message: {
    description: "Classify client message urgency and intent.",
    parameters: z.object({
      message: z.string()
    }),
    execute: async (args) => triageText(args.message)
  },
  triage_call: {
    description: "Classify a phone transcript.",
    parameters: z.object({
      transcript: z.string()
    }),
    execute: async (args) => triageText(args.transcript)
  },
  request_records_transfer: {
    description: "Create a human approval draft for records transfer.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      destination: z.string().optional().nullable()
    }),
    execute: async (args, runtime) => {
      const task = addEffect(runtime, makeTask({
        status: "pending_review",
        priority: "medium",
        requestType: "records_request",
        clientName: args.clientName ?? null,
        petName: args.petName ?? null,
        request: `Review records transfer request for ${args.petName ?? "pet"}.`,
        notes: `Destination: ${args.destination ?? "not provided"}`
      }));
      const approval = addEffect(runtime, makeApproval({
        approvalType: "records_transfer",
        title: "Approve records transfer",
        summary: "Client requested records transfer. No records should be sent until staff approves.",
        taskId: task.id,
        requestedAction: {
          clientName: args.clientName ?? null,
          petName: args.petName ?? null,
          destination: args.destination ?? null
        }
      }));
      recordEvent(runtime, {
        eventType: "approval_created",
        title: "Records approval drafted",
        detail: "Risky records action requires a human decision.",
        metadata: { approvalId: approval.id, taskId: task.id }
      });
      return { task, approval };
    }
  },
  prepare_records_packet: {
    description: "Prepare records metadata for the application layer to audit/send.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      destination: z.string().optional().nullable()
    }),
    execute: async (args) => ({
      packet: {
        clientName: args.clientName ?? null,
        petName: args.petName ?? null,
        destination: args.destination ?? null,
        requiresApproval: true,
        attachments: []
      }
    })
  },
  get_invoice_summary: {
    description: "Return invoice data for review.",
    parameters: z.object({
      clientName: z.string().optional(),
      petName: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const client = firstClient(runtime.data, args.clientName);
      const pet = client ? firstPet(runtime.data, client.id, args.petName) : null;
      const invoices = runtime.data.invoices.filter((invoice) =>
        (!client || invoice.clientId === client.id) && (!pet || invoice.petId === pet.id)
      );
      return { client, pet, invoices };
    }
  },
  flag_invoice_issue: {
    description: "Create invoice review task and report draft.",
    parameters: z.object({
      invoiceId: z.string(),
      issueDetails: z.string()
    }),
    execute: async (args, runtime) => {
      const invoice = runtime.data.invoices.find((candidate) => candidate.id === args.invoiceId) ?? null;
      const client = invoice ? clientFor(runtime.data, invoice.clientId) : null;
      const pet = invoice ? petFor(runtime.data, invoice.petId) : null;
      const task = addEffect(runtime, makeTask({
        status: "pending_review",
        priority: "medium",
        requestType: "patient_update",
        clientName: client?.fullName ?? null,
        clientPhone: client?.phone ?? null,
        petName: pet?.name ?? null,
        request: `Invoice review needed: ${args.issueDetails}`,
        notes: invoice ? `Invoice ${invoice.invoiceNumber}` : null
      }));
      const report = addEffect(runtime, makeReport({
        reportType: "invoice",
        title: "Invoice review",
        summary: args.issueDetails,
        taskId: task.id,
        data: { invoice }
      }));
      return { invoice, task, report };
    }
  },
  find_followup_candidates: {
    description: "Find open follow-up opportunities.",
    parameters: z.object({
      status: z.enum(["open", "contacted", "closed"]).optional()
    }),
    execute: async (args, runtime) => {
      const status = args.status ?? "open";
      const candidates = runtime.data.followups.filter((followup) => followup.status === status);
      return { candidates };
    }
  },
  create_followup_task: {
    description: "Create outreach task for a follow-up candidate.",
    parameters: z.object({
      candidateId: z.string()
    }),
    execute: async (args, runtime) => {
      const candidate = runtime.data.followups.find((item) => item.id === args.candidateId) ?? null;
      const client = candidate ? clientFor(runtime.data, candidate.clientId) : null;
      const pet = candidate ? petFor(runtime.data, candidate.petId) : null;
      if (!candidate || !client || !pet) return { candidate, task: null };
      const task = addEffect(runtime, makeTask({
        status: "pending_review",
        priority: "medium",
        requestType: "scheduling",
        clientName: client.fullName,
        clientPhone: client.phone,
        petName: pet.name,
        request: `${pet.name} is due for ${candidate.followupType}.`,
        notes: candidate.recommendedAction
      }));
      return { candidate, client, pet, task };
    }
  },
  run_competitor_scan: {
    description: "Read sample or Apify-normalized competitor pricing observations.",
    parameters: z.object({
      source: z.enum(["sample", "apify"]).optional()
    }),
    execute: async (args, runtime) => {
      const observations = runtime.data.pricingObservations.filter((item) =>
        args.source ? item.source === args.source : true
      );
      return { observations };
    }
  },
  compare_service_prices: {
    description: "Compare service catalog to competitor pricing observations.",
    parameters: z.object({}),
    execute: async (_args, runtime) => ({
      comparisons: comparePrices(runtime.data.services, runtime.data.pricingObservations)
    })
  },
  create_price_review_report: {
    description: "Create pricing report and review task without changing prices.",
    parameters: z.object({
      summary: z.string(),
      flaggedCount: z.number(),
      comparisons: z.array(z.unknown())
    }),
    execute: async (args, runtime) => {
      const task = addEffect(runtime, makeTask({
        status: "pending_review",
        priority: args.flaggedCount > 0 ? "medium" : "low",
        requestType: "patient_update",
        request: `Review competitor pricing report: ${args.flaggedCount} flagged item(s).`,
        notes: "Agent did not change service prices."
      }));
      const report = addEffect(runtime, makeReport({
        reportType: "pricing",
        title: "Competitor pricing review",
        summary: args.summary,
        taskId: task.id,
        data: { comparisons: args.comparisons, changedPrices: false }
      }));
      return { task, report };
    }
  }
} satisfies Record<string, ToolDefinition<z.ZodTypeAny>>;

export async function executeTool<TName extends ToolName>(
  name: TName,
  args: unknown,
  runtime: ToolRuntime
) {
  const definition = tools[name];
  const parsed = definition.parameters.parse(args);
  const result = await definition.execute(parsed, runtime);
  runtime.toolCalls.push({
    id: id("tool", `${String(name)}-${runtime.toolCalls.length}`),
    toolName: String(name),
    args: parsed as Record<string, unknown>,
    result,
    createdAt: runtime.now.toISOString()
  });
  return result;
}

export function getInputText(input: AgentInput) {
  return textFromInput(input);
}

export function getClientPetFromInput(input: AgentInput, data: MockClinicData) {
  const clientName = input.clientName ?? input.callerName;
  const phone = input.clientPhone ?? input.callerPhone;
  const client = firstClient(data, clientName, phone);
  const pet = client ? firstPet(data, client.id, input.petName) : null;
  return { client, pet };
}

export function summarizeInvoice(invoice: MockInvoice) {
  const dollars = (invoice.totalCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
  return `${invoice.invoiceNumber} (${dollars}, ${invoice.flags.length} flag(s))`;
}
