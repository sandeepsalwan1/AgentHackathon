import { createHash, randomUUID } from "node:crypto";
import {
  runExternalAgent,
  runGoogleAdkExternalAgent,
  runGoogleAdkInternalAgent,
  runInternalAgent,
  type AgentIntent,
  type AgentMode,
  type AgentWorkflowResult,
  type WorkflowEventDraft
} from "@central-vet/agents";
import {
  createAgentRun,
  createWorkflowEvent,
  failAgentRun,
  updateAgentRun,
  type Actor,
  type ClinicContext
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders, resolveClinicFromRequest } from "../_shared";
import { loadAgentClinicData } from "./_clinicData";
import { persistAgentEffects, type PersistedAgentEffects } from "./_effectPersistence";

type AgentKind = "external" | "internal";
export type RouteIntent =
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

type AgentWorkflowRoute = {
  agent: AgentKind;
  routeIntent: RouteIntent;
  auth: "public" | "manager";
};

type RunnerInput = {
  agent: AgentKind;
  routeIntent: RouteIntent;
  input: Record<string, unknown>;
  actor?: Actor;
  clinic?: ClinicContext;
  request: Request;
};

const agentActor: Actor = { name: "VetAgent", role: "admin" };
const workflowRoutes = {
  booking: { agent: "external", routeIntent: "booking", auth: "public" },
  call: { agent: "external", routeIntent: "call", auth: "public" },
  checkin: { agent: "external", routeIntent: "checkin", auth: "public" },
  "daily-ops": { agent: "internal", routeIntent: "daily_ops", auth: "manager" },
  external: { agent: "external", routeIntent: "external", auth: "public" },
  followup: { agent: "external", routeIntent: "followup", auth: "public" },
  internal: { agent: "internal", routeIntent: "internal", auth: "manager" },
  invoice: { agent: "internal", routeIntent: "invoice", auth: "manager" },
  pickup: { agent: "external", routeIntent: "pickup", auth: "public" },
  pricing: { agent: "internal", routeIntent: "pricing", auth: "manager" },
  records: { agent: "external", routeIntent: "records", auth: "public" }
} satisfies Record<string, AgentWorkflowRoute>;
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

export function getAgentWorkflowRoute(slug: string) {
  return workflowRoutes[slug as keyof typeof workflowRoutes] ?? null;
}

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

function agentMode(): AgentMode {
  if (process.env.AGENT_RUNTIME === "google-adk" && hasGoogleAdkCredentials()) return "google-adk";
  return "mock";
}

function normalizeInput(routeIntent: RouteIntent, input: Record<string, unknown>) {
  if (!concreteIntents.has(routeIntent)) return input;
  return { ...input, intent: routeIntent };
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
} & PersistedAgentEffects) {
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
  const clinic = input.clinic ?? await resolveClinicFromRequest(input.request);
  const normalizedInput = normalizeInput(input.routeIntent, input.input);
  let runId: string | null = null;

  try {
    const run = await createAgentRun({
      clinicId: clinic.clinicId,
      agent: input.agent,
      intent: input.routeIntent,
      // Record the actual resolved runtime, not just the env flag: when
      // AGENT_RUNTIME=google-adk but credentials are absent, agentMode() falls back
      // to "mock" and the run row must reflect that (a runtime_fallback event is also
      // emitted below). Avoids a run row that falsely claims mode=google-adk.
      mode,
      status: "running",
      input: normalizedInput,
      traceId,
      requestId,
      model: mode === "google-adk" ? process.env.GOOGLE_ADK_MODEL || "gemini-2.5-flash" : null,
      inputHash: hashInput(normalizedInput),
      inputSummary: summary(normalizedInput)
    });
    runId = run.id;
    const clinicData = await loadAgentClinicData(clinic.clinicId);
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

    const persisted = await persistAgentEffects(
      runId,
      traceId,
      result,
      input.actor ?? agentActor,
      clinic
    );
    const durationMs = Date.now() - started;
    await updateAgentRun(runId, {
      clinicId: clinic.clinicId,
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
        clinicId: clinic.clinicId,
        error: message,
        errorKind: error instanceof Error ? error.name : "agent_error",
        durationMs
      }).catch(() => null);
      await createWorkflowEvent({
        clinicId: clinic.clinicId,
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
