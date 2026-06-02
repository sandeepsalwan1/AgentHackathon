import { z } from "zod";
import type {
  AgentApprovalDraft,
  AgentEffect,
  AgentInput,
  AgentIntent,
  AgentReportDraft,
  AgentTaskDraft,
  MockClinicData,
  MockInvoice,
  ToolCallTrace,
  TaskPriority,
  TaskRequestType,
  WorkflowEventDraft
} from "./contracts";
import { mockClinicData } from "./mockData";

export type ToolRuntime = {
  data: MockClinicData;
  now: Date;
  input: AgentInput;
  workflowType: AgentIntent;
  effects: AgentEffect[];
  workflowEvents: WorkflowEventDraft[];
  toolCalls: ToolCallTrace[];
};

export type ToolDefinition<T extends z.ZodTypeAny> = {
  description: string;
  parameters: T;
  execute: (args: z.infer<T>, runtime: ToolRuntime) => Promise<Record<string, unknown>>;
};

export type RunnableTool = {
  parameters: z.ZodTypeAny;
  execute: (args: unknown, runtime: ToolRuntime) => Promise<Record<string, unknown>>;
};

export function defineTool<TParameters extends z.ZodTypeAny>(
  definition: ToolDefinition<TParameters>
) {
  return definition;
}

export function defineTools<const TTools extends Record<string, ToolDefinition<z.ZodTypeAny>>>(
  definitions: TTools
) {
  return definitions;
}

export function id(prefix: string, seed: string) {
  return `${prefix}-${seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"}`;
}

function clean(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function looseMatch(source: string, query: string) {
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

export function clientFor(data: MockClinicData, clientId: string) {
  return data.clients.find((client) => client.id === clientId) ?? null;
}

export function petFor(data: MockClinicData, petId: string) {
  return data.pets.find((pet) => pet.id === petId) ?? null;
}

export function firstClient(data: MockClinicData, clientName?: string, phone?: string) {
  const phoneDigits = clean(phone).replace(/[^0-9]/g, "");
  return data.clients.find((client) => {
    const nameOk = clientName ? looseMatch(client.fullName, clientName) : false;
    const phoneOk = phoneDigits
      ? client.phone.replace(/[^0-9]/g, "").endsWith(phoneDigits.slice(-7))
      : false;
    return nameOk || phoneOk;
  }) ?? null;
}

export function firstPet(data: MockClinicData, clientId: string, petName?: string) {
  const pets = data.pets.filter((pet) => pet.clientId === clientId);
  return petName
    ? pets.find((pet) => looseMatch(pet.name, petName)) ?? null
    : pets[0] ?? null;
}

export function makeTask(input: {
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

export function makeApproval(input: Omit<AgentApprovalDraft, "id" | "kind">) {
  return {
    id: id("approval", `${input.approvalType}-${input.title}`),
    kind: "approval" as const,
    ...input
  };
}

export function makeReport(input: Omit<AgentReportDraft, "id" | "kind">) {
  return {
    id: id("report", `${input.reportType}-${input.title}`),
    kind: "report" as const,
    ...input
  };
}

export function recordEvent(runtime: ToolRuntime, event: Omit<WorkflowEventDraft, "id" | "createdAt" | "workflowType">) {
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

export function addEffect<T extends AgentEffect>(runtime: ToolRuntime, effect: T) {
  runtime.effects.push(effect);
  return effect;
}

export function triageText(message: string) {
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

export function guardrailDecision(kind: "medical" | "records" | "billing" | "pricing", text: string) {
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
    return { allowed: true, requiresApproval: false, reasons: risky ? ["client_requested_records_transfer"] : [] };
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

export function isTodayOrLiteralToday(date: string, runtime: ToolRuntime) {
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

export function traceObject(value: unknown) {
  return traceJson(value ?? {}) as Record<string, unknown>;
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
