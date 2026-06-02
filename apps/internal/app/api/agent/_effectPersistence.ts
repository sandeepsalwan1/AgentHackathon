import type {
  AgentApprovalDraft,
  AgentReportDraft,
  AgentTaskDraft,
  AgentWorkflowResult,
  WorkflowEventDraft
} from "@central-vet/agents";
import {
  createAgentReport,
  createAgentToolCall,
  createApproval,
  createTask,
  createWorkflowEvent,
  type Actor,
  type AgentReport,
  type Approval,
  type Task,
  type WorkflowEvent
} from "@central-vet/db";
import { persistOperationalMutations } from "./_operationalMutations";

export type PersistedAgentEffects = {
  task?: Task;
  approval?: Approval;
  report?: AgentReport;
  workflowEvents: WorkflowEvent[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function soonTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30);
  return date.toTimeString().slice(0, 5);
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

export async function persistAgentEffects(
  runId: string,
  traceId: string,
  result: AgentWorkflowResult,
  actor: Actor
): Promise<PersistedAgentEffects> {
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

  const mutationEvents = await persistOperationalMutations(runId, traceId, result.toolCalls);
  return { task, approval, report, workflowEvents: [...workflowEvents, ...mutationEvents] };
}
