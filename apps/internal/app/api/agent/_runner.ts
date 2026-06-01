import { createHash, randomUUID } from "node:crypto";
import {
  runExternalAgent,
  runGoogleAdkExternalAgent,
  runGoogleAdkInternalAgent,
  runInternalAgent,
  type AgentApprovalDraft,
  type AgentIntent,
  type AgentMode,
  type AgentReportDraft,
  type AgentTaskDraft,
  type AgentWorkflowResult,
  type MockClinicData,
  type ToolCallTrace,
  type WorkflowEventDraft
} from "@central-vet/agents";
import {
  createAgentReport,
  createAgentRun,
  createAgentToolCall,
  createApproval,
  createTask,
  createWorkflowEvent,
  failAgentRun,
  listAgentReports,
  listApprovals,
  listMockClinic,
  listTasks,
  markAppointmentArrived,
  updateAgentRun,
  type Actor,
  type AgentReport,
  type Approval,
  type Task,
  type WorkflowEvent
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../_shared";

type AgentKind = "external" | "internal";
type RouteIntent =
  | "checkin"
  | "booking"
  | "pickup"
  | "records"
  | "followup"
  | "call"
  | "daily_ops"
  | "invoice"
  | "pricing"
  | "external"
  | "internal";

type RunnerInput = {
  agent: AgentKind;
  routeIntent: RouteIntent;
  input: Record<string, unknown>;
  actor?: Actor;
  request: Request;
};

const agentActor: Actor = { name: "VetAgent", role: "admin" };
const concreteIntents = new Set([
  "checkin",
  "booking",
  "pickup",
  "records",
  "followup",
  "call",
  "daily_ops",
  "invoice",
  "pricing"
]);

function hasGoogleAdkCredentials() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_USE_VERTEXAI === "TRUE" ||
    process.env.GOOGLE_GENAI_USE_VERTEXAI === "true"
  );
}

function textFromInput(input: Record<string, unknown>) {
  return ["message", "request", "transcript", "body"]
    .map((key) => input[key])
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ");
}

function summary(value: Record<string, unknown>) {
  const text = textFromInput(value);
  if (text) return text.slice(0, 500);
  const keys = Object.keys(value).filter((key) => key !== "actor").slice(0, 8);
  return keys.join(", ") || "empty input";
}

function hashInput(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function soonTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30);
  return date.toTimeString().slice(0, 5);
}

function agentMode(): AgentMode {
  if (process.env.AGENT_RUNTIME === "google-adk" && hasGoogleAdkCredentials()) return "google-adk";
  return "mock";
}

function normalizeInput(routeIntent: RouteIntent, input: Record<string, unknown>) {
  if (!concreteIntents.has(routeIntent)) return input;
  return { ...input, intent: routeIntent };
}

async function loadClinicData(): Promise<MockClinicData> {
  const [clinic, tasks, approvals, reports] = await Promise.all([
    listMockClinic(),
    listTasks({ role: "admin", includeArchived: false }),
    listApprovals({ status: "pending", limit: 50 }),
    listAgentReports({ limit: 50 })
  ]);
  return {
    clients: clinic.clients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email ?? undefined,
      notes: client.notes ?? undefined
    })),
    pets: clinic.pets.map((pet) => ({
      id: pet.id,
      clientId: pet.clientId,
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? undefined,
      alerts: pet.alerts ?? undefined
    })),
    appointments: clinic.appointments.map((appointment) => ({
      ...appointment,
      status: appointment.status as MockClinicData["appointments"][number]["status"],
      roomStatus: appointment.roomStatus as MockClinicData["appointments"][number]["roomStatus"],
      notes: appointment.notes ?? undefined
    })),
    slots: clinic.slots,
    followups: clinic.followups.map((followup) => ({
      ...followup,
      status: followup.status as MockClinicData["followups"][number]["status"]
    })),
    invoices: clinic.invoices.map((invoice) => ({
      id: invoice.id,
      clientId: invoice.clientId,
      petId: invoice.petId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status as MockClinicData["invoices"][number]["status"],
      totalCents: invoice.totalCents,
      flags: invoice.flags.map((flag) => ({
        reason: typeof flag.reason === "string"
          ? flag.reason
          : typeof flag.message === "string"
            ? flag.message
            : "Invoice flag needs review.",
        severity: flag.severity === "low" || flag.severity === "high" ? flag.severity : "medium"
      }))
    })),
    services: clinic.services,
    pricingObservations: clinic.pricingObservations.map((observation) => ({
      id: observation.id,
      source: observation.source === "apify" ? "apify" : "sample",
      competitorName: observation.competitorName,
      serviceName: observation.serviceName,
      observedPriceCents: observation.observedPriceCents,
      observedText: observation.observedText ?? undefined,
      url: observation.url ?? undefined
    })),
    messages: clinic.messages.map((message) => ({
      id: message.id,
      clientId: message.clientId,
      body: message.body,
      intentHint: message.intentHint as AgentIntent | undefined,
      urgency: message.urgency === "urgent" ? "high" : message.urgency === "high" ? "high" : "normal"
    })),
    calls: clinic.callTranscripts.map((call) => ({
      id: call.id,
      callerName: call.callerName,
      callerPhone: call.callerPhone,
      transcript: call.transcript,
      intentHint: call.intentHint as AgentIntent | undefined
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      status: task.status,
      priority: task.priority,
      requestType: task.requestType,
      clientName: task.clientName,
      petName: task.petName,
      request: task.request,
      notes: task.notes,
      dueDate: task.dueDate,
      dueTime: task.dueTime
    })),
    approvals: approvals.map((approval) => ({
      id: approval.id,
      status: approval.status,
      approvalType: approval.approvalType,
      title: approval.title,
      summary: approval.summary,
      taskId: approval.taskId
    })),
    reports: reports.map((report) => ({
      id: report.id,
      reportType: report.reportType,
      title: report.title,
      summary: report.summary,
      taskId: report.taskId
    })),
    labCatalog: clinic.labCatalog,
    labOrders: clinic.labOrders.map((order) => ({
      ...order,
      status: order.status as NonNullable<MockClinicData["labOrders"]>[number]["status"]
    })),
    labResults: clinic.labResults.map((result) => ({
      ...result,
      status: result.status as NonNullable<MockClinicData["labResults"]>[number]["status"]
    }))
  };
}

function replaceDraftIds(value: unknown, ids: Map<string, string>): unknown {
  if (typeof value === "string") return ids.get(value) ?? value;
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => replaceDraftIds(item, ids));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, replaceDraftIds(item, ids)])
  );
}

async function persistTask(draft: AgentTaskDraft, actor: Actor) {
  return createTask({
    hospitalName: process.env.HOSPITAL_NAME || "Central Veterinary Hospital",
    source: "admin",
    status: draft.status,
    priority: draft.priority,
    requestType: draft.requestType,
    clientName: draft.clientName,
    clientPhone: draft.clientPhone,
    petName: draft.petName,
    request: draft.request,
    notes: draft.notes,
    dueDate: today(),
    dueTime: draft.dueTimeHint || (draft.priority === "high" ? soonTime() : "19:00")
  }, actor);
}

async function persistEffects(runId: string, traceId: string, result: AgentWorkflowResult, actor: Actor) {
  const draftIds = new Map<string, string>();
  const seen = new Set<string>();
  let task: Task | undefined;
  let approval: Approval | undefined;
  let report: AgentReport | undefined;
  const workflowEvents: WorkflowEvent[] = [];

  for (const effect of result.effects.filter((effect) => "kind" in effect && effect.kind === "task") as AgentTaskDraft[]) {
    if (seen.has(effect.id)) continue;
    seen.add(effect.id);
    const persisted = await persistTask(effect, actor);
    draftIds.set(effect.id, persisted.id);
    if (result.task?.id === effect.id || !task) task = persisted;
  }

  for (const effect of result.effects.filter((effect) => "kind" in effect && effect.kind === "approval") as AgentApprovalDraft[]) {
    if (seen.has(effect.id)) continue;
    seen.add(effect.id);
    const persisted = await createApproval({
      runId,
      taskId: effect.taskId ? draftIds.get(effect.taskId) ?? effect.taskId : null,
      approvalType: effect.approvalType,
      title: effect.title,
      summary: effect.summary,
      requestedAction: replaceDraftIds(effect.requestedAction, draftIds) as Record<string, unknown>
    });
    draftIds.set(effect.id, persisted.id);
    if (result.approval?.id === effect.id || !approval) approval = persisted;
  }

  for (const effect of result.effects.filter((effect) => "kind" in effect && effect.kind === "report") as AgentReportDraft[]) {
    if (seen.has(effect.id)) continue;
    seen.add(effect.id);
    const persisted = await createAgentReport({
      runId,
      taskId: effect.taskId ? draftIds.get(effect.taskId) ?? effect.taskId : null,
      reportType: effect.reportType,
      title: effect.title,
      summary: effect.summary,
      data: replaceDraftIds(effect.data, draftIds) as Record<string, unknown>
    });
    draftIds.set(effect.id, persisted.id);
    if (result.report?.id === effect.id || !report) report = persisted;
  }

  for (const effect of result.effects.filter((effect) => !("kind" in effect)) as WorkflowEventDraft[]) {
    if (seen.has(effect.id)) continue;
    seen.add(effect.id);
    workflowEvents.push(await createWorkflowEvent({
      runId,
      workflowType: effect.workflowType,
      eventType: effect.eventType,
      title: effect.title,
      detail: effect.detail,
      metadata: replaceDraftIds(effect.metadata, draftIds) as Record<string, unknown>
    }));
  }

  for (const [sequence, toolCall] of result.toolCalls.entries()) {
    await createAgentToolCall({
      runId,
      traceId,
      sequence: sequence + 1,
      toolName: toolCall.toolName,
      status: toolCall.status ?? "ok",
      args: toolCall.args,
      result: replaceDraftIds(toolCall.result, draftIds) as Record<string, unknown>,
      error: toolCall.error ?? null,
      durationMs: toolCall.durationMs ?? null
    });
  }

  await persistArrivalMutations(result.toolCalls);
  return { task, approval, report, workflowEvents };
}

async function persistArrivalMutations(toolCalls: ToolCallTrace[]) {
  const arrival = toolCalls.find((call) =>
    call.toolName === "mark_arrived" &&
    call.result?.arrived === true &&
    call.result?.alreadyArrived !== true
  );
  const appointment = arrival?.result?.appointment;
  if (appointment && typeof appointment === "object" && "id" in appointment && typeof appointment.id === "string") {
    await markAppointmentArrived(appointment.id);
  }
}

function fallbackEvent(routeIntent: RouteIntent, traceId: string, runId: string): WorkflowEventDraft {
  return {
    id: `event-runtime-fallback-${runId}`,
    workflowType: concreteIntents.has(routeIntent) ? routeIntent as AgentIntent : "unknown",
    eventType: "runtime_fallback",
    title: "Google ADK credentials missing",
    detail: "AGENT_RUNTIME=google-adk requested, but Google credentials were not present. Fallback registry path used.",
    metadata: {
      traceId,
      env: {
        GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
        GOOGLE_API_KEY: Boolean(process.env.GOOGLE_API_KEY),
        GOOGLE_GENAI_USE_VERTEXAI: Boolean(process.env.GOOGLE_GENAI_USE_VERTEXAI)
      }
    },
    createdAt: new Date().toISOString()
  };
}

function withResponseFields(result: AgentWorkflowResult, input: {
  runId: string;
  traceId: string;
  durationMs: number;
  task?: Task;
  approval?: Approval;
  report?: AgentReport;
  workflowEvents: WorkflowEvent[];
}) {
  return {
    ...result,
    runId: input.runId,
    traceId: input.traceId,
    durationMs: input.durationMs,
    task: input.task ?? result.task,
    approval: input.approval ?? result.approval,
    report: input.report ?? result.report,
    workflowEvents: input.workflowEvents,
    toolCalls: result.toolCalls
  };
}

function runnerHeaders(runId: string, traceId: string) {
  return {
    ...noStoreHeaders,
    "x-vetagent-run-id": runId,
    "x-vetagent-trace-id": traceId
  };
}

export async function executeVetAgentWorkflow(input: RunnerInput) {
  const traceId = randomUUID();
  const requestId = input.request.headers.get("x-request-id") || randomUUID();
  const started = Date.now();
  const mode = agentMode();
  const normalizedInput = normalizeInput(input.routeIntent, input.input);
  let runId: string | null = null;

  try {
    const run = await createAgentRun({
      agent: input.agent,
      intent: input.routeIntent,
      mode: process.env.AGENT_RUNTIME === "google-adk" ? "google-adk" : mode,
      status: "running",
      input: normalizedInput,
      traceId,
      requestId,
      model: mode === "google-adk" ? process.env.GOOGLE_ADK_MODEL || "gemini-2.5-flash" : null,
      inputHash: hashInput(normalizedInput),
      inputSummary: summary(normalizedInput)
    });
    runId = run.id;
    const clinicData = await loadClinicData();
    const options = {
      runId,
      traceId,
      routeIntent: input.routeIntent,
      mode,
      model: mode === "google-adk" ? process.env.GOOGLE_ADK_MODEL || "gemini-2.5-flash" : undefined,
      clinicData,
      now: new Date()
    };
    let result = input.agent === "internal"
      ? mode === "google-adk"
        ? await runGoogleAdkInternalAgent(normalizedInput, options)
        : await runInternalAgent(normalizedInput, options)
      : mode === "google-adk"
        ? await runGoogleAdkExternalAgent(normalizedInput, options)
        : await runExternalAgent(normalizedInput, options);

    if (process.env.AGENT_RUNTIME === "google-adk" && mode !== "google-adk") {
      const event = fallbackEvent(input.routeIntent, traceId, runId);
      result = {
        ...result,
        workflowEvents: [event, ...result.workflowEvents],
        effects: [event, ...result.effects],
        result: { ...result.result, adkFallback: true }
      };
    }

    const persisted = await persistEffects(runId, traceId, result, input.actor ?? agentActor);
    const durationMs = Date.now() - started;
    await updateAgentRun(runId, {
      status: "completed",
      output: {
        ok: true,
        mode: result.mode,
        intent: result.intent,
        message: result.message,
        result: result.result,
        taskId: persisted.task?.id ?? null,
        approvalId: persisted.approval?.id ?? null,
        reportId: persisted.report?.id ?? null
      },
      error: null,
      durationMs,
      outputSummary: result.message.slice(0, 500),
      toolCallCount: result.toolCalls.length,
      model: mode === "google-adk" ? process.env.GOOGLE_ADK_MODEL || "gemini-2.5-flash" : null
    });
    const body = withResponseFields(result, {
      runId,
      traceId,
      durationMs,
      task: persisted.task,
      approval: persisted.approval,
      report: persisted.report,
      workflowEvents: persisted.workflowEvents
    });
    return NextResponse.json(body, { headers: runnerHeaders(runId, traceId) });
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "Agent workflow failed";
    if (runId) {
      await failAgentRun(runId, {
        error: message,
        errorKind: error instanceof Error ? error.name : "agent_error",
        durationMs
      }).catch(() => null);
      await createWorkflowEvent({
        runId,
        workflowType: concreteIntents.has(input.routeIntent) ? input.routeIntent : "unknown",
        eventType: "run_failed",
        title: "Agent run failed",
        detail: message,
        metadata: { traceId, requestId }
      }).catch(() => null);
    }
    return dbError(error, { route: `agent.${input.routeIntent}` });
  }
}
