import { getSql } from "./connection";
import type { Actor, AppRole } from "./types";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

export type AgentRun = {
  id: string;
  agent: string;
  intent: string;
  mode: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  traceId: string | null;
  requestId: string | null;
  model: string | null;
  durationMs: number | null;
  inputHash: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  errorKind: string | null;
  tokenInput: number | null;
  tokenOutput: number | null;
  toolCallCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowEvent = {
  id: string;
  runId: string | null;
  workflowType: string;
  eventType: string;
  title: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type Approval = {
  id: string;
  runId: string | null;
  taskId: string | null;
  approvalType: string;
  status: string;
  title: string;
  summary: string;
  requestedAction: Record<string, unknown>;
  decidedByName: string | null;
  decidedByRole: AppRole | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentReport = {
  id: string;
  runId: string | null;
  taskId: string | null;
  reportType: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type AgentToolCall = {
  id: string;
  runId: string | null;
  traceId: string | null;
  sequence: number;
  toolName: string;
  status: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
};

export type AgentRunTimeline = {
  run: AgentRun;
  workflowEvents: WorkflowEvent[];
  toolCalls: AgentToolCall[];
  approvals: Approval[];
  reports: AgentReport[];
  linkedTaskIds: string[];
  linkedApprovalIds: string[];
  linkedReportIds: string[];
};

type AgentRunRow = {
  id: string;
  agent: string;
  intent: string;
  mode: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  trace_id: string | null;
  request_id: string | null;
  model: string | null;
  duration_ms: number | null;
  input_hash: string | null;
  input_summary: string | null;
  output_summary: string | null;
  error_kind: string | null;
  token_input: number | null;
  token_output: number | null;
  tool_call_count: number;
  created_at: string;
  updated_at: string;
};

type WorkflowEventRow = {
  id: string;
  run_id: string | null;
  workflow_type: string;
  event_type: string;
  title: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ApprovalRow = {
  id: string;
  run_id: string | null;
  task_id: string | null;
  approval_type: string;
  status: string;
  title: string;
  summary: string;
  requested_action: Record<string, unknown>;
  decided_by_name: string | null;
  decided_by_role: AppRole | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

type AgentReportRow = {
  id: string;
  run_id: string | null;
  task_id: string | null;
  report_type: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  created_at: string;
};

type AgentToolCallRow = {
  id: string;
  run_id: string | null;
  trace_id: string | null;
  sequence: number;
  tool_name: string;
  status: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
};

const agentRunColumns = `
  id,
  agent,
  intent,
  mode,
  status,
  input,
  output,
  error,
  trace_id,
  request_id,
  model,
  duration_ms,
  input_hash,
  input_summary,
  output_summary,
  error_kind,
  token_input,
  token_output,
  tool_call_count,
  created_at,
  updated_at
`;

const workflowEventColumns = `
  id,
  run_id,
  workflow_type,
  event_type,
  title,
  detail,
  metadata,
  created_at
`;

const approvalColumns = `
  id,
  run_id,
  task_id,
  approval_type,
  status,
  title,
  summary,
  requested_action,
  decided_by_name,
  decided_by_role,
  decided_at,
  decision_note,
  created_at,
  updated_at
`;

const reportColumns = `
  id,
  run_id,
  task_id,
  report_type,
  title,
  summary,
  data,
  created_at
`;

const toolCallColumns = `
  id,
  run_id,
  trace_id,
  sequence,
  tool_name,
  status,
  args,
  result,
  error,
  duration_ms,
  created_at
`;

function normalizeRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    agent: row.agent,
    intent: row.intent,
    mode: row.mode,
    status: row.status,
    input: row.input ?? {},
    output: row.output ?? {},
    error: row.error,
    traceId: row.trace_id,
    requestId: row.request_id,
    model: row.model,
    durationMs: row.duration_ms,
    inputHash: row.input_hash,
    inputSummary: row.input_summary,
    outputSummary: row.output_summary,
    errorKind: row.error_kind,
    tokenInput: row.token_input,
    tokenOutput: row.token_output,
    toolCallCount: row.tool_call_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeWorkflowEvent(row: WorkflowEventRow): WorkflowEvent {
  return {
    id: row.id,
    runId: row.run_id,
    workflowType: row.workflow_type,
    eventType: row.event_type,
    title: row.title,
    detail: row.detail,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

function normalizeApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id,
    approvalType: row.approval_type,
    status: row.status,
    title: row.title,
    summary: row.summary,
    requestedAction: row.requested_action ?? {},
    decidedByName: row.decided_by_name,
    decidedByRole: row.decided_by_role,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeReport(row: AgentReportRow): AgentReport {
  return {
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id,
    reportType: row.report_type,
    title: row.title,
    summary: row.summary,
    data: row.data ?? {},
    createdAt: row.created_at
  };
}

function normalizeToolCall(row: AgentToolCallRow): AgentToolCall {
  return {
    id: row.id,
    runId: row.run_id,
    traceId: row.trace_id,
    sequence: row.sequence,
    toolName: row.tool_name,
    status: row.status,
    args: row.args ?? {},
    result: row.result ?? {},
    error: row.error,
    durationMs: row.duration_ms,
    createdAt: row.created_at
  };
}

function jsonInput(value: Record<string, unknown> | Record<string, unknown>[]) {
  return value as never;
}

function redactJson(value: unknown, depth = 0): JsonValue {
  if (depth > 8) return "[max-depth]";
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactJson(item, depth + 1));
  if (typeof value === "object") {
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/passcode|api.?key|token|authorization|auth.?header|secret/i.test(key)) {
        output[key] = "[redacted]";
      } else {
        output[key] = redactJson(item, depth + 1);
      }
    }
    return output;
  }
  return String(value);
}

function redactedObject(value: Record<string, unknown> | undefined) {
  return redactJson(value ?? {}) as Record<string, unknown>;
}

export async function createAgentRun(input: {
  agent: string;
  intent: string;
  mode?: string;
  status?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  traceId?: string | null;
  requestId?: string | null;
  model?: string | null;
  inputHash?: string | null;
  inputSummary?: string | null;
}) {
  const sql = getSql();
  const rows = await sql<AgentRunRow[]>`
    insert into agent_runs (
      agent,
      intent,
      mode,
      status,
      input,
      output,
      trace_id,
      request_id,
      model,
      input_hash,
      input_summary
    )
    values (
      ${input.agent},
      ${input.intent},
      ${input.mode ?? "mock"},
      ${input.status ?? "completed"},
      ${sql.json(jsonInput(redactedObject(input.input)))},
      ${sql.json(jsonInput(redactedObject(input.output)))},
      ${input.traceId ?? null},
      ${input.requestId ?? null},
      ${input.model ?? null},
      ${input.inputHash ?? null},
      ${input.inputSummary ?? null}
    )
    returning ${sql.unsafe(agentRunColumns)}
  `;
  return normalizeRun(rows[0]);
}

export async function updateAgentRun(
  id: string,
  patch: {
    status?: string;
    output?: Record<string, unknown>;
    error?: string | null;
    traceId?: string | null;
    requestId?: string | null;
    model?: string | null;
    durationMs?: number | null;
    outputSummary?: string | null;
    errorKind?: string | null;
    tokenInput?: number | null;
    tokenOutput?: number | null;
    toolCallCount?: number | null;
  }
) {
  const sql = getSql();
  const rows = await sql<AgentRunRow[]>`
    update agent_runs
    set
      status = coalesce(${patch.status ?? null}, status),
      output = coalesce(${patch.output ? sql.json(jsonInput(redactedObject(patch.output))) : null}, output),
      error = ${patch.error ?? null},
      trace_id = coalesce(${patch.traceId ?? null}, trace_id),
      request_id = coalesce(${patch.requestId ?? null}, request_id),
      model = coalesce(${patch.model ?? null}, model),
      duration_ms = coalesce(${patch.durationMs ?? null}, duration_ms),
      output_summary = coalesce(${patch.outputSummary ?? null}, output_summary),
      error_kind = coalesce(${patch.errorKind ?? null}, error_kind),
      token_input = coalesce(${patch.tokenInput ?? null}, token_input),
      token_output = coalesce(${patch.tokenOutput ?? null}, token_output),
      tool_call_count = coalesce(${patch.toolCallCount ?? null}, tool_call_count),
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(agentRunColumns)}
  `;
  return rows[0] ? normalizeRun(rows[0]) : null;
}

export async function failAgentRun(
  id: string,
  patch: {
    error: string;
    errorKind?: string | null;
    output?: Record<string, unknown>;
    durationMs?: number | null;
    toolCallCount?: number | null;
  }
) {
  return updateAgentRun(id, {
    status: "failed",
    error: patch.error,
    errorKind: patch.errorKind ?? "agent_error",
    output: patch.output,
    durationMs: patch.durationMs,
    toolCallCount: patch.toolCallCount
  });
}

export async function getAgentRun(id: string) {
  const sql = getSql();
  const rows = await sql<AgentRunRow[]>`
    select ${sql.unsafe(agentRunColumns)}
    from agent_runs
    where id = ${id}
  `;
  return rows[0] ? normalizeRun(rows[0]) : null;
}

export async function createAgentToolCall(input: {
  runId?: string | null;
  traceId?: string | null;
  sequence: number;
  toolName: string;
  status: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string | null;
  durationMs?: number | null;
}) {
  const sql = getSql();
  const rows = await sql<AgentToolCallRow[]>`
    insert into agent_tool_calls (
      run_id,
      trace_id,
      sequence,
      tool_name,
      status,
      args,
      result,
      error,
      duration_ms
    )
    values (
      ${input.runId ?? null},
      ${input.traceId ?? null},
      ${input.sequence},
      ${input.toolName},
      ${input.status},
      ${sql.json(jsonInput(redactedObject(input.args)))},
      ${sql.json(jsonInput(redactedObject(input.result)))},
      ${input.error ?? null},
      ${input.durationMs ?? null}
    )
    returning ${sql.unsafe(toolCallColumns)}
  `;
  return normalizeToolCall(rows[0]);
}

export async function listAgentToolCalls(options: {
  runId?: string | null;
  toolName?: string | null;
  limit?: number;
} = {}) {
  const sql = getSql();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const rows = options.runId
    ? await sql<AgentToolCallRow[]>`
        select ${sql.unsafe(toolCallColumns)}
        from agent_tool_calls
        where run_id = ${options.runId}
        order by sequence asc, created_at asc
        limit ${limit}
      `
    : options.toolName
      ? await sql<AgentToolCallRow[]>`
          select ${sql.unsafe(toolCallColumns)}
          from agent_tool_calls
          where tool_name = ${options.toolName}
          order by created_at desc
          limit ${limit}
        `
      : await sql<AgentToolCallRow[]>`
          select ${sql.unsafe(toolCallColumns)}
          from agent_tool_calls
          order by created_at desc
          limit ${limit}
        `;
  return rows.map(normalizeToolCall);
}

export async function createWorkflowEvent(input: {
  runId?: string | null;
  workflowType: string;
  eventType: string;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql<WorkflowEventRow[]>`
    insert into workflow_events (
      run_id,
      workflow_type,
      event_type,
      title,
      detail,
      metadata
    )
    values (
      ${input.runId ?? null},
      ${input.workflowType},
      ${input.eventType},
      ${input.title},
      ${input.detail ?? null},
      ${sql.json(jsonInput(input.metadata ?? {}))}
    )
    returning ${sql.unsafe(workflowEventColumns)}
  `;
  return normalizeWorkflowEvent(rows[0]);
}

export async function listWorkflowEvents(options: {
  runId?: string | null;
  workflowType?: string | null;
  limit?: number;
} = {}) {
  const sql = getSql();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = options.runId
    ? await sql<WorkflowEventRow[]>`
        select ${sql.unsafe(workflowEventColumns)}
        from workflow_events
        where run_id = ${options.runId}
        order by created_at asc
        limit ${limit}
      `
    : options.workflowType
      ? await sql<WorkflowEventRow[]>`
          select ${sql.unsafe(workflowEventColumns)}
          from workflow_events
          where workflow_type = ${options.workflowType}
          order by created_at desc
          limit ${limit}
        `
      : await sql<WorkflowEventRow[]>`
          select ${sql.unsafe(workflowEventColumns)}
          from workflow_events
          order by created_at desc
          limit ${limit}
        `;
  return rows.map(normalizeWorkflowEvent);
}

export async function createApproval(input: {
  runId?: string | null;
  taskId?: string | null;
  approvalType: string;
  title: string;
  summary: string;
  requestedAction?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql<ApprovalRow[]>`
    insert into approvals (
      run_id,
      task_id,
      approval_type,
      title,
      summary,
      requested_action
    )
    values (
      ${input.runId ?? null},
      ${input.taskId ?? null},
      ${input.approvalType},
      ${input.title},
      ${input.summary},
      ${sql.json(jsonInput(input.requestedAction ?? {}))}
    )
    returning ${sql.unsafe(approvalColumns)}
  `;
  return normalizeApproval(rows[0]);
}

export async function listApprovals(options: {
  status?: string | null;
  limit?: number;
} = {}) {
  const sql = getSql();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = options.status
    ? await sql<ApprovalRow[]>`
        select ${sql.unsafe(approvalColumns)}
        from approvals
        where status = ${options.status}
        order by created_at desc
        limit ${limit}
      `
    : await sql<ApprovalRow[]>`
        select ${sql.unsafe(approvalColumns)}
        from approvals
        order by created_at desc
        limit ${limit}
      `;
  return rows.map(normalizeApproval);
}

export async function decideApproval(
  id: string,
  input: {
    status: "approved" | "rejected";
    actor: Actor;
    note?: string | null;
  }
) {
  const sql = getSql();
  const rows = await sql<ApprovalRow[]>`
    update approvals
    set
      status = ${input.status},
      decided_by_name = ${input.actor.name},
      decided_by_role = ${input.actor.role}::app_role,
      decided_at = now(),
      decision_note = ${input.note ?? null},
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(approvalColumns)}
  `;
  return rows[0] ? normalizeApproval(rows[0]) : null;
}

export async function createAgentReport(input: {
  runId?: string | null;
  taskId?: string | null;
  reportType: string;
  title: string;
  summary: string;
  data?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql<AgentReportRow[]>`
    insert into agent_reports (
      run_id,
      task_id,
      report_type,
      title,
      summary,
      data
    )
    values (
      ${input.runId ?? null},
      ${input.taskId ?? null},
      ${input.reportType},
      ${input.title},
      ${input.summary},
      ${sql.json(jsonInput(input.data ?? {}))}
    )
    returning ${sql.unsafe(reportColumns)}
  `;
  return normalizeReport(rows[0]);
}

export async function listAgentReports(options: {
  reportType?: string | null;
  limit?: number;
} = {}) {
  const sql = getSql();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = options.reportType
    ? await sql<AgentReportRow[]>`
        select ${sql.unsafe(reportColumns)}
        from agent_reports
        where report_type = ${options.reportType}
        order by created_at desc
        limit ${limit}
      `
    : await sql<AgentReportRow[]>`
        select ${sql.unsafe(reportColumns)}
        from agent_reports
        order by created_at desc
        limit ${limit}
      `;
  return rows.map(normalizeReport);
}

export async function getAgentRunWithTimeline(id: string): Promise<AgentRunTimeline | null> {
  const run = await getAgentRun(id);
  if (!run) return null;
  const sql = getSql();
  const [workflowEvents, toolCalls, approvalRows, reportRows] = await Promise.all([
    listWorkflowEvents({ runId: id, limit: 200 }),
    listAgentToolCalls({ runId: id, limit: 500 }),
    sql<ApprovalRow[]>`
      select ${sql.unsafe(approvalColumns)}
      from approvals
      where run_id = ${id}
      order by created_at asc
    `,
    sql<AgentReportRow[]>`
      select ${sql.unsafe(reportColumns)}
      from agent_reports
      where run_id = ${id}
      order by created_at asc
    `
  ]);
  const approvals = approvalRows.map(normalizeApproval);
  const reports = reportRows.map(normalizeReport);
  const eventTaskIds = workflowEvents
    .map((event) => event.metadata.taskId)
    .filter((value): value is string => typeof value === "string");
  const outputTaskId = typeof run.output.taskId === "string" ? run.output.taskId : null;
  const linkedTaskIds = Array.from(new Set([
    outputTaskId,
    ...eventTaskIds,
    ...approvals.map((approval) => approval.taskId),
    ...reports.map((report) => report.taskId)
  ].filter((value): value is string => Boolean(value))));
  return {
    run,
    workflowEvents,
    toolCalls,
    approvals,
    reports,
    linkedTaskIds,
    linkedApprovalIds: approvals.map((approval) => approval.id),
    linkedReportIds: reports.map((report) => report.id)
  };
}
