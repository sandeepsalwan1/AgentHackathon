import type {
  AgentInput,
  AgentTaskDraft,
  AgentWorkflowResult,
  RunAgentOptions
} from "./contracts";
import {
  buildResult,
  createRuntime,
  normalizeAgentInput,
  resolveMode
} from "./mockProvider";
import { executeTool, getInputText } from "./tools";

type TriageResult = {
  triage: {
    intent: string;
    urgent: boolean;
  };
};

export async function runCallAgent(input: AgentInput | unknown, options: RunAgentOptions = {}): Promise<AgentWorkflowResult> {
  const normalized = normalizeAgentInput(input);
  const intent = "call";
  const mode = resolveMode(options);
  const runtime = createRuntime(normalized, intent, options);
  const transcript = normalized.transcript ?? getInputText(normalized);
  const triage = await executeTool("triage_call", { transcript }, runtime) as TriageResult;
  const taskResult = await executeTool("create_task", {
    status: triage.triage.urgent ? "due" : "pending_review",
    priority: triage.triage.urgent ? "high" : "medium",
    requestType: triage.triage.intent === "booking" ? "scheduling" : "patient_update",
    clientName: normalized.callerName ?? normalized.clientName ?? null,
    clientPhone: normalized.callerPhone ?? normalized.clientPhone ?? null,
    petName: normalized.petName ?? null,
    request: `Call transcript routed to staff: ${transcript || "No transcript provided."}`,
    notes: `Classified as ${triage.triage.intent}.`
  }, runtime) as {
    task: AgentTaskDraft;
  };

  return buildResult({
    intent,
    mode,
    message: triage.triage.urgent
      ? "I turned this call into a high-priority staff task."
      : "I turned this call into a staff review task.",
    result: {
      classifiedIntent: triage.triage.intent,
      urgent: triage.triage.urgent
    },
    runtime,
    options,
    task: taskResult.task
  });
}
