// AGENT CLIENT — wired to real backend routes
// Customer chat → POST /api/agent/external (public, no auth)
// Vet chat      → POST /api/agent/vet-chat  (server-side proxy)

export type WorkflowStatus = "running" | "needs_approval" | "completed" | "failed";

type WorkflowEventDTO = {
  id: string;
  eventType: string;
  toolName?: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type ReportSummary = {
  id: string;
  reportType: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type AgentRunResponse = {
  runId: string;
  status: WorkflowStatus;
  message: string;
  taskIds: string[];
  approvalIds: string[];
  events: WorkflowEventDTO[];
  report?: ReportSummary;
};

export type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

// ── Backend response shape ────────────────────────────────────────────────────

type WorkflowResult = {
  ok: true;
  runId: string;
  intent: string;
  mode: string;
  message: string;
  result: Record<string, unknown>;
  task?: { id: string };
  approval?: { id: string };
  report?: { id: string; reportType: string; title: string; summary: string; data: Record<string, unknown>; createdAt: string };
  workflowEvents: { id: string; eventType: string; createdAt: string; metadata?: Record<string, unknown> }[];
};

function mapWorkflowResult(r: WorkflowResult): AgentRunResponse {
  return {
    runId: r.runId,
    status: r.approval ? "needs_approval" : "completed",
    message: r.message,
    taskIds: r.task ? [r.task.id] : [],
    approvalIds: r.approval ? [r.approval.id] : [],
    events: r.workflowEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      createdAt: e.createdAt,
      payload: e.metadata ?? {},
    })),
    report: r.report ?? undefined,
  };
}

async function postJson(url: string, body: Record<string, unknown>): Promise<AgentRunResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(err.error ?? `Request failed with status ${res.status}`);
  }

  const data = await res.json() as WorkflowResult;
  return mapWorkflowResult(data);
}

// ── Public API ────────────────────────────────────────────────────────────────

export type CustomerContext = {
  name: string;
  phone?: string;
  petName?: string;
};

export async function sendCustomerMessage(
  ctx: CustomerContext,
  _history: ChatHistoryItem[],
  message: string
): Promise<AgentRunResponse> {
  return postJson("/api/agent/external", {
    clientName: ctx.name,
    clientPhone: ctx.phone,
    petName: ctx.petName,
    message,
  });
}

export async function sendVetMessage(
  vetName: string,
  _history: ChatHistoryItem[],
  message: string,
  intent?: string
): Promise<AgentRunResponse> {
  return postJson("/api/agent/vet-chat", { message, vetName, ...(intent ? { intent } : {}) });
}
