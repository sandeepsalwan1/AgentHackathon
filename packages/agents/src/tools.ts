import { z } from "zod";
import type {
  AgentApprovalDraft,
  AgentEffect,
  AgentInput,
  AgentIntent,
  AgentReportDraft,
  AgentTaskDraft,
  MockApproval,
  MockAppointment,
  MockClinicData,
  MockClient,
  MockInvoice,
  MockLabOrder,
  MockLabResult,
  MockPet,
  MockReport,
  MockService,
  MockTask,
  PricingObservation,
  TaskPriority,
  TaskRequestType,
  ToolCallTrace,
  WorkflowEventDraft
} from "./contracts";
import { mockClinicData } from "./mockData";
import { DEFAULT_SEARCH_ACTOR, apifyConfigured, runApifyActor } from "./apifyClient";

export type ToolRuntime = {
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

type RunnableTool = {
  parameters: z.ZodTypeAny;
  execute: (args: unknown, runtime: ToolRuntime) => Promise<Record<string, unknown>>;
};

function defineTool<TParameters extends z.ZodTypeAny>(
  definition: ToolDefinition<TParameters>
) {
  return definition;
}

function defineTools<const TTools extends Record<string, ToolDefinition<z.ZodTypeAny>>>(
  definitions: TTools
) {
  return definitions;
}

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

async function createBookingHold(args: {
  slotId: string;
  clientId: string;
  petId: string;
  reason?: string;
}, runtime: ToolRuntime) {
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

function followupCandidates(runtime: ToolRuntime, status = "open") {
  return runtime.data.followups.filter((followup) => followup.status === status);
}

function triageText(message: string) {
  const text = message.toLowerCase();
  const urgent = /(blood|seizure|collapse|poison|toxin|breathing|emergency|lethargic)/.test(text);
  const intent =
    urgent || /(vomit|diarrhea|pain|sick|hurt)/.test(text)
      ? "sick_pet"
      : /(record|transfer)/.test(text)
        ? "records"
        : /(arriv|outside|check.?in|waiting|here for)/.test(text)
            ? "checkin"
            : /(book|schedule|appointment|reschedule)/.test(text)
              ? "booking"
              : "unknown";
  return { triage: { intent, urgent } };
}

function guardrailDecision(kind: "medical" | "records" | "billing" | "pricing", text: string) {
  const lower = text.toLowerCase();
  if (kind === "medical") {
    const terms = ["blood", "breathing", "choking", "collapse", "diarrhea", "emergency", "lethargic", "pain", "poison", "seizure", "toxin", "vomit"];
    const matched = terms.filter((term) => lower.includes(term));
    return {
      allowed: matched.length === 0,
      medicalAdviceGiven: false,
      priority: matched.some((term) => ["blood", "breathing", "choking", "collapse", "poison", "seizure", "toxin"].includes(term)) ? "high" : matched.length ? "medium" : "low",
      reasons: matched
    };
  }
  if (kind === "records") {
    const risky = /(send|release|transfer|email).*record/i.test(text);
    return { allowed: !risky, requiresApproval: risky, reasons: risky ? ["records_transfer_requires_approval"] : [] };
  }
  if (kind === "billing") {
    const risky = /(refund|charge|discount|void|write.?off|change.*invoice)/i.test(text);
    return { allowed: !risky, changedInvoices: false, reasons: risky ? ["billing_mutation_requires_review"] : [] };
  }
  const risky = /(update|change|set|raise|lower).*price/i.test(text);
  return { allowed: !risky, changedPrices: false, reasons: risky ? ["pricing_mutation_blocked"] : [] };
}

function todayText(runtime: ToolRuntime) {
  return runtime.now.toISOString().slice(0, 10);
}

function isTodayOrLiteralToday(date: string, runtime: ToolRuntime) {
  return date === "today" || date === todayText(runtime);
}

function traceJson(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max-depth]";
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => traceJson(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      /passcode|api.?key|token|authorization|auth.?header|secret/i.test(key) ? "[redacted]" : traceJson(item, depth + 1)
    ]));
  }
  return String(value);
}

function traceObject(value: unknown) {
  return traceJson(value ?? {}) as Record<string, unknown>;
}

function samplePricing(data: MockClinicData) {
  return data.pricingObservations.filter((item) => item.source === "sample");
}

const PRICE_PATTERN = /\$\s?([0-9][0-9,]*(?:\.[0-9]{2})?)/;

function hostnameLabel(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function extractPriceCents(text: string): { cents: number | null; matched: string | null } {
  const match = text.match(PRICE_PATTERN);
  if (!match) return { cents: null, matched: null };
  const value = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return { cents: null, matched: match[0] };
  return { cents: Math.round(value * 100), matched: match[0] };
}

// Live competitor pricing via Apify. Uses APIFY_PRICING_ACTOR_ID when set,
// otherwise a general public web-search actor so the live path works with just
// a token. Normalizes arbitrary search/scrape output into pricing observations,
// mapping each back to a catalog service. Returns null on any gap so the caller
// falls back to deterministic sample data with an observable event.
async function fetchApifyPricing(services: MockService[]): Promise<PricingObservation[] | null> {
  if (!apifyConfigured()) return null;
  const actorId = process.env.APIFY_PRICING_ACTOR_ID || DEFAULT_SEARCH_ACTOR;
  const targeted = services.slice(0, 4);
  if (!targeted.length) return null;
  const rows = await runApifyActor<Record<string, unknown>>(
    actorId,
    {
      // google-search-scraper expects newline-separated `queries`...
      queries: targeted.map((service) => `veterinary ${service.serviceName} price cost`).join("\n"),
      maxPagesPerQuery: 1,
      resultsPerPage: 5,
      countryCode: "us",
      // ...generic scrapers (rag-web-browser, etc.) accept `query` / `maxResults`.
      query: targeted.map((service) => service.serviceName).join(", "),
      maxResults: 8
    },
    { timeoutMs: 45_000, limit: 12 }
  );
  if (!rows?.length) return null;

  const observations: PricingObservation[] = [];
  rows.forEach((record, rowIndex) => {
    const row = record && typeof record === "object" ? record : {};
    const rawQuery = (row as Record<string, unknown>).searchQuery;
    const queryTerm = typeof rawQuery === "string"
      ? rawQuery
      : rawQuery && typeof rawQuery === "object"
        ? String((rawQuery as Record<string, unknown>).term ?? "")
        : "";
    const matchedService = targeted.find((service) => looseMatch(queryTerm, service.serviceName))
      ?? targeted[Math.min(rowIndex, targeted.length - 1)];
    const organicResults = (row as Record<string, unknown>).organicResults;
    const results = Array.isArray(organicResults) ? organicResults : [row];
    results.slice(0, 4).forEach((result, resultIndex) => {
      const item = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
      const url = typeof item.url === "string" ? item.url
        : typeof (row as Record<string, unknown>).url === "string" ? (row as Record<string, unknown>).url as string
          : undefined;
      const title = String(item.title ?? (row as Record<string, unknown>).title ?? "");
      const snippet = String(item.description ?? item.snippet ?? item.text ?? (row as Record<string, unknown>).text ?? "");
      const { cents, matched } = extractPriceCents(`${snippet} ${title}`);
      observations.push({
        id: `apify-${rowIndex}-${resultIndex}`,
        source: "apify",
        competitorName: hostnameLabel(url) ?? (title.slice(0, 60) || "Web result"),
        serviceName: matchedService?.serviceName ?? (queryTerm || "Unknown service"),
        observedPriceCents: cents,
        observedText: matched ?? (snippet ? snippet.slice(0, 140) : undefined),
        url
      });
    });
  });

  if (!observations.length) return null;
  // Surface priced observations first, but keep real web results either way so the
  // live path is demonstrable even when a snippet omits a clean price.
  observations.sort((a, b) => Number(b.observedPriceCents !== null) - Number(a.observedPriceCents !== null));
  return observations.slice(0, 12);
}

function firstLabOrder(data: MockClinicData, args: { clientId?: string; petId?: string; status?: string; patientName?: string }) {
  return (data.labOrders ?? []).find((order) => {
    if (args.clientId && order.clientId !== args.clientId) return false;
    if (args.petId && order.petId !== args.petId) return false;
    if (args.status && order.status !== args.status) return false;
    if (args.patientName && !looseMatch(order.patientName, args.patientName)) return false;
    return true;
  }) ?? null;
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

const recordWorkflowEventToolName = "record_\u0077orkflow_event";

export const tools = defineTools({
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
    description: "Create a booking hold task for staff confirmation; does not finalize appointments.",
    parameters: z.object({
      slotId: z.string(),
      clientId: z.string(),
      petId: z.string(),
      reason: z.string().optional()
    }),
    execute: async (args, runtime) => createBookingHold(args, runtime)
  }),
  book_appointment: defineTool({
    description: "Prepare a booking confirmation for a client and pet.",
    parameters: z.object({
      slotId: z.string(),
      clientId: z.string(),
      petId: z.string(),
      reason: z.string().optional()
    }),
    execute: async (args, runtime) => {
      return createBookingHold(args, runtime);
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
  }),
  mark_arrived: defineTool({
    description: "Prepare arrival update and staff task. Set waitComplaint when the client reports waiting too long.",
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
          metadata: { appointmentId: appointment.id }
        });
        return { arrived: true, alreadyArrived: true, appointment, client, pet, task: null };
      }
      const task = addEffect(runtime, makeTask({
        status: "due",
        priority: args.waitComplaint || appointment.waitMinutes >= 30 ? "high" : "medium",
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
  }),
  mark_pet_ready: defineTool({
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
  }),
  send_status_update: defineTool({
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
  }),
  list_tasks: defineTool({
    description: "List current staff tasks from the runner-provided clinic context.",
    parameters: z.object({
      status: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional()
    }),
    execute: async (args, runtime) => {
      const tasks = (runtime.data.tasks ?? []).filter((task) => {
        if (args.status && task.status !== args.status) return false;
        if (args.priority && task.priority !== args.priority) return false;
        return true;
      });
      return { tasks };
    }
  }),
  list_approvals: defineTool({
    description: "List pending approvals from the runner-provided clinic context.",
    parameters: z.object({
      status: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const approvals = (runtime.data.approvals ?? []).filter((approval) =>
        args.status ? approval.status === args.status : true
      );
      return { approvals };
    }
  }),
  list_reports: defineTool({
    description: "List recent agent reports from the runner-provided clinic context.",
    parameters: z.object({
      reportType: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const reports = (runtime.data.reports ?? []).filter((report) =>
        args.reportType ? report.reportType === args.reportType : true
      );
      return { reports };
    }
  }),
  list_service_catalog: defineTool({
    description: "List service catalog prices for pricing review.",
    parameters: z.object({}),
    execute: async (_args, runtime) => ({ services: runtime.data.services })
  }),
  create_task: defineTool({
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
  }),
  create_approval: defineTool({
    description: "Create an approval draft for human review.",
    parameters: z.object({
      approvalType: z.enum(["records_transfer", "billing_review", "pricing_review"]),
      title: z.string(),
      summary: z.string(),
      taskId: z.string().optional().nullable(),
      requestedAction: z.record(z.string(), z.unknown()).optional()
    }),
    execute: async (args, runtime) => {
      const approval = addEffect(runtime, makeApproval({
        approvalType: args.approvalType,
        title: args.title,
        summary: args.summary,
        taskId: args.taskId ?? null,
        requestedAction: args.requestedAction ?? {}
      }));
      recordEvent(runtime, {
        eventType: "approval_created",
        title: args.title,
        detail: args.summary,
        metadata: { approvalId: approval.id, taskId: args.taskId ?? null }
      });
      return { approval };
    }
  }),
  decide_approval: defineTool({
    description: "Draft an approval decision request; no approval is decided automatically.",
    parameters: z.object({
      approvalId: z.string(),
      decision: z.enum(["approved", "rejected", "needs_review"]),
      note: z.string().optional()
    }),
    execute: async (args, runtime) => {
      recordEvent(runtime, {
        eventType: "approval_decision_requested",
        title: "Approval decision requested",
        detail: args.note ?? null,
        metadata: { approvalId: args.approvalId, decision: args.decision }
      });
      return { decided: false, requiresHuman: true, ...args };
    }
  }),
  create_agent_report: defineTool({
    description: "Create a generic report draft.",
    parameters: z.object({
      reportType: z.enum(["daily_ops", "followup", "invoice", "pricing"]),
      title: z.string(),
      summary: z.string(),
      taskId: z.string().optional().nullable(),
      data: z.record(z.string(), z.unknown()).optional()
    }),
    execute: async (args, runtime) => {
      const report = addEffect(runtime, makeReport({
        reportType: args.reportType,
        title: args.title,
        summary: args.summary,
        taskId: args.taskId ?? null,
        data: args.data ?? {}
      }));
      recordEvent(runtime, {
        eventType: "report_created",
        title: args.title,
        detail: args.summary,
        metadata: { reportId: report.id, taskId: args.taskId ?? null }
      });
      return { report };
    }
  }),
  create_daily_ops_report: defineTool({
    description: "Create a daily operations digest report.",
    parameters: z.object({
      summary: z.record(z.string(), z.unknown()),
      rankedWork: z.array(z.string())
    }),
    execute: async (args, runtime) => {
      const report = addEffect(runtime, makeReport({
        reportType: "daily_ops",
        title: "Daily ops digest",
        summary: `${args.summary.openTasks ?? 0} open task(s), ${args.summary.highPriority ?? 0} high-priority item(s), ${args.summary.pendingApprovals ?? 0} approval(s) pending.`,
        data: { summary: args.summary, rankedWork: args.rankedWork }
      }));
      recordEvent(runtime, {
        eventType: "digest_created",
        title: "Daily ops digest created",
        detail: report.summary,
        metadata: { reportId: report.id, summary: args.summary }
      });
      return { report };
    }
  }),
  update_task: defineTool({
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
  }),
  triage_message: defineTool({
    description: "Classify client message urgency and intent.",
    parameters: z.object({
      message: z.string()
    }),
    execute: async (args) => triageText(args.message)
  }),
  triage_call: defineTool({
    description: "Classify a phone transcript.",
    parameters: z.object({
      transcript: z.string()
    }),
      execute: async (args) => triageText(args.transcript)
  }),
  check_medical_guardrail: defineTool({
    description: "Check whether medical safety guardrails apply.",
    parameters: z.object({ text: z.string() }),
    execute: async (args) => guardrailDecision("medical", args.text)
  }),
  check_records_guardrail: defineTool({
    description: "Check whether records transfer approval is required.",
    parameters: z.object({ text: z.string() }),
    execute: async (args) => guardrailDecision("records", args.text)
  }),
  check_billing_guardrail: defineTool({
    description: "Check whether billing mutation is blocked.",
    parameters: z.object({ text: z.string() }),
    execute: async (args) => guardrailDecision("billing", args.text)
  }),
  check_pricing_guardrail: defineTool({
    description: "Check whether pricing mutation is blocked.",
    parameters: z.object({ text: z.string() }),
    execute: async (args) => guardrailDecision("pricing", args.text)
  }),
  request_records_transfer: defineTool({
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
          destination: args.destination ?? null,
          audit: {
            status: "needs_approval",
            source: "local_records_policy",
            reason: "Records transfers always require staff approval.",
            checkedAt: runtime.now.toISOString()
          }
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
  }),
  audit_records_transfer: defineTool({
    description: "Run local records-transfer policy audit; no external vendor is called.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      destination: z.string().optional().nullable()
    }),
    execute: async (args, runtime) => {
      const missingDestination = !args.destination?.trim();
      const audit = {
        status: missingDestination ? "blocked" : "needs_approval",
        source: "local_records_policy",
        reason: missingDestination
          ? "Destination is missing; staff must confirm before preparing records."
          : "Records transfers require human approval before disclosure.",
        checkedAt: runtime.now.toISOString(),
        clientName: args.clientName ?? null,
        petName: args.petName ?? null,
        destination: args.destination ?? null
      };
      recordEvent(runtime, {
        eventType: "records_local_approval",
        title: "Records transfer audited locally",
        detail: audit.reason,
        metadata: audit
      });
      return { audit };
    }
  }),
  prepare_records_packet: defineTool({
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
  }),
  get_invoice_summary: defineTool({
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
  }),
  flag_invoice_issue: defineTool({
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
      recordEvent(runtime, {
        eventType: "invoice_review_created",
        title: "Invoice review report created",
        detail: args.issueDetails,
        metadata: { invoiceId: args.invoiceId, taskId: task.id, reportId: report.id, changedInvoices: false }
      });
      return { invoice, task, report };
    }
  }),
  find_followup_candidates: defineTool({
    description: "Find open follow-up opportunities.",
    parameters: z.object({
      status: z.enum(["open", "contacted", "closed"]).optional()
    }),
    execute: async (args, runtime) => {
      const status = args.status ?? "open";
      const candidates = followupCandidates(runtime, status);
      return { candidates };
    }
  }),
  list_followup_candidates: defineTool({
    description: "List open follow-up candidates.",
    parameters: z.object({
      status: z.enum(["open", "contacted", "closed"]).optional()
    }),
    execute: async (args, runtime) => {
      const candidates = followupCandidates(runtime, args.status ?? "open");
      return { candidates };
    }
  }),
  create_followup_task: defineTool({
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
      recordEvent(runtime, {
        eventType: "followup_task_created",
        title: "Follow-up task drafted",
        detail: candidate.recommendedAction,
        metadata: { candidateId: candidate.id, taskId: task.id }
      });
      return { candidate, client, pet, task };
    }
  }),
  run_competitor_scan: defineTool({
    description: "Read sample or Apify-normalized competitor pricing observations.",
    parameters: z.object({
      source: z.enum(["sample", "apify"]).optional()
    }),
    execute: async (args, runtime) => {
      if (args.source === "apify") {
        const live = await fetchApifyPricing(runtime.data.services);
        if (live?.length) {
          runtime.data.pricingObservations = live;
          recordEvent(runtime, {
            eventType: "apify_scan",
            title: "Apify pricing scan completed",
            detail: `${live.length} live observation(s) normalized.`,
            metadata: { provider: "apify", count: live.length }
          });
          return { mode: "apify", observations: live };
        }
        const fallback = samplePricing(runtime.data);
        runtime.data.pricingObservations = fallback;
        recordEvent(runtime, {
          eventType: "apify_fallback",
          title: "Apify pricing fallback used",
          detail: "Apify token missing or live scan returned no usable results; using sample pricing.",
          metadata: { provider: "mock", actor: process.env.APIFY_PRICING_ACTOR_ID || DEFAULT_SEARCH_ACTOR, apifyConfigured: apifyConfigured() }
        });
        return { mode: "mock", observations: fallback };
      }
      const observations = args.source
        ? runtime.data.pricingObservations.filter((item) => item.source === args.source)
        : runtime.data.pricingObservations;
      runtime.data.pricingObservations = observations.length ? observations : samplePricing(runtime.data);
      return { mode: "mock", observations: runtime.data.pricingObservations };
    }
  }),
  compare_service_prices: defineTool({
    description: "Compare service catalog to competitor pricing observations.",
    parameters: z.object({}),
    execute: async (_args, runtime) => ({
      comparisons: comparePrices(runtime.data.services, runtime.data.pricingObservations)
    })
  }),
  create_price_review_report: defineTool({
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
      recordEvent(runtime, {
        eventType: "pricing_report_created",
        title: "Pricing report created",
        detail: "No service prices were changed.",
        metadata: { taskId: task.id, reportId: report.id, flaggedCount: args.flaggedCount, changedPrices: false }
      });
      return { task, report };
    }
  }),
  list_lab_catalog: defineTool({
    description: "List mock lab catalog entries shaped like a future Antech adapter.",
    parameters: z.object({
      active: z.boolean().optional()
    }),
    execute: async (args, runtime) => {
      const catalog = (runtime.data.labCatalog ?? []).filter((item) =>
        typeof args.active === "boolean" ? item.active === args.active : true
      );
      return { labVendor: "antech_mock", catalog };
    }
  }),
  lookup_lab_orders: defineTool({
    description: "Look up mock lab orders by patient, client, pet, or status.",
    parameters: z.object({
      clientId: z.string().optional(),
      petId: z.string().optional(),
      patientName: z.string().optional(),
      status: z.enum(["ordered", "in_progress", "partial", "final", "cancelled"]).optional()
    }),
    execute: async (args, runtime) => {
      const orders = (runtime.data.labOrders ?? []).filter((order) => {
        if (args.clientId && order.clientId !== args.clientId) return false;
        if (args.petId && order.petId !== args.petId) return false;
        if (args.patientName && !looseMatch(order.patientName, args.patientName)) return false;
        if (args.status && order.status !== args.status) return false;
        return true;
      });
      return { labVendor: "antech_mock", orders };
    }
  }),
  get_lab_result: defineTool({
    description: "Fetch mock lab result metadata for an order/accession.",
    parameters: z.object({
      labOrderId: z.string().optional(),
      externalOrderId: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const result = (runtime.data.labResults ?? []).find((item) =>
        (args.labOrderId && item.labOrderId === args.labOrderId) ||
        (args.externalOrderId && item.externalOrderId === args.externalOrderId)
      ) ?? null;
      const order = result
        ? (runtime.data.labOrders ?? []).find((item) => item.id === result.labOrderId) ?? null
        : null;
      return { labVendor: "antech_mock", order, result };
    }
  }),
  summarize_lab_result: defineTool({
    description: "Summarize mock lab result without giving diagnosis or treatment advice.",
    parameters: z.object({
      labOrderId: z.string().optional(),
      externalOrderId: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const result = (runtime.data.labResults ?? []).find((item) =>
        (args.labOrderId && item.labOrderId === args.labOrderId) ||
        (args.externalOrderId && item.externalOrderId === args.externalOrderId)
      ) ?? null;
      const order = result
        ? (runtime.data.labOrders ?? []).find((item) => item.id === result.labOrderId) ?? null
        : firstLabOrder(runtime.data, { status: "final" });
      const summary = result
        ? {
            labVendor: result.labVendor,
            source: "mock lab data",
            externalOrderId: result.externalOrderId,
            status: result.status,
            resultSummary: result.resultSummary,
            abnormalFlags: result.abnormalFlags,
            reportUrl: result.reportUrl,
            medicalAdviceGiven: false
          }
        : {
            labVendor: "antech_mock",
            source: "mock lab data",
            status: order?.status ?? "not_found",
            resultSummary: "No finalized mock lab result matched.",
            abnormalFlags: [],
            reportUrl: null,
            medicalAdviceGiven: false
          };
      return { order, result, summary };
    }
  }),
  create_lab_followup_task: defineTool({
    description: "Create staff review task for final or abnormal mock lab results.",
    parameters: z.object({
      labOrderId: z.string(),
      reason: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const order = (runtime.data.labOrders ?? []).find((item) => item.id === args.labOrderId) ?? null;
      const result = order ? (runtime.data.labResults ?? []).find((item) => item.labOrderId === order.id) ?? null : null;
      const client = order ? clientFor(runtime.data, order.clientId) : null;
      const pet = order ? petFor(runtime.data, order.petId) : null;
      const abnormal = Boolean(result?.abnormalFlags?.length);
      const task = addEffect(runtime, makeTask({
        status: "due",
        priority: abnormal ? "high" : "medium",
        requestType: "labs_xrays",
        clientName: client?.fullName ?? null,
        clientPhone: client?.phone ?? null,
        petName: pet?.name ?? order?.patientName ?? null,
        request: `Review mock lab result ${order?.externalOrderId ?? args.labOrderId}.`,
        notes: args.reason ?? result?.resultSummary ?? "Lab result needs staff review before client disclosure."
      }));
      recordEvent(runtime, {
        eventType: "lab_review_task_created",
        title: "Mock lab review task created",
        detail: "No diagnosis or treatment recommendation was provided.",
        metadata: {
          taskId: task.id,
          labVendor: order?.labVendor ?? "antech_mock",
          externalOrderId: order?.externalOrderId ?? null,
          abnormalFlags: result?.abnormalFlags ?? [],
          medicalAdviceGiven: false
        }
      });
      return { task, order, result, medicalAdviceGiven: false };
    }
  }),
  [recordWorkflowEventToolName]: defineTool({
    description: "Record a workflow event draft in the current run.",
    parameters: z.object({
      eventType: z.string(),
      title: z.string(),
      detail: z.string().optional().nullable(),
      metadata: z.record(z.string(), z.unknown()).optional()
    }),
    execute: async (args, runtime) => {
      const event = recordEvent(runtime, {
        eventType: args.eventType,
        title: args.title,
        detail: args.detail ?? null,
        metadata: args.metadata ?? {}
      });
      return { event };
    }
  }),
  record_tool_call: defineTool({
    description: "Record a no-op observability marker; persistence happens in the route runner.",
    parameters: z.object({
      toolName: z.string(),
      status: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional()
    }),
    execute: async (args) => ({ recorded: true, ...args })
  }),
  create_agent_run: defineTool({
    description: "No-op observability helper; the route runner creates the persisted run.",
    parameters: z.object({}),
    execute: async () => ({ createdBy: "runner" })
  }),
  complete_agent_run: defineTool({
    description: "No-op observability helper; the route runner completes the persisted run.",
    parameters: z.object({}),
    execute: async () => ({ completedBy: "runner" })
  }),
  fail_agent_run: defineTool({
    description: "No-op observability helper; the route runner fails the persisted run.",
    parameters: z.object({
      error: z.string().optional()
    }),
    execute: async (args) => ({ failedBy: "runner", error: args.error ?? null })
  })
});

export async function executeTool<TName extends ToolName>(
  name: TName,
  args: unknown,
  runtime: ToolRuntime
) {
  const definition = tools[name] as RunnableTool;
  const started = Date.now();
  const parsed = definition.parameters.parse(args);
  try {
    const result = await definition.execute(parsed, runtime);
    runtime.toolCalls.push({
      id: id("tool", `${String(name)}-${runtime.toolCalls.length}`),
      toolName: String(name),
      args: traceObject(parsed),
      result: traceObject(result),
      status: "ok",
      durationMs: Date.now() - started,
      createdAt: runtime.now.toISOString()
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool failed";
    runtime.toolCalls.push({
      id: id("tool", `${String(name)}-${runtime.toolCalls.length}`),
      toolName: String(name),
      args: traceObject(parsed),
      result: {},
      status: "error",
      error: message,
      durationMs: Date.now() - started,
      createdAt: runtime.now.toISOString()
    });
    return { ok: false, error: message };
  }
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
