import { getSql } from "./connection";
import type { Actor, AppRole } from "./types";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type AgentRun = {
  id: string;
  agent: string;
  intent: string;
  mode: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
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

type AgentRunRow = {
  id: string;
  agent: string;
  intent: string;
  mode: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
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

const agentRunColumns = `
  id,
  agent,
  intent,
  mode,
  status,
  input,
  output,
  error,
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

function jsonInput(value: Record<string, unknown> | Record<string, unknown>[]) {
  return value as never;
}

export async function createAgentRun(input: {
  agent: string;
  intent: string;
  mode?: string;
  status?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql<AgentRunRow[]>`
    insert into agent_runs (agent, intent, mode, status, input, output)
    values (
      ${input.agent},
      ${input.intent},
      ${input.mode ?? "mock"},
      ${input.status ?? "completed"},
      ${sql.json(jsonInput(input.input ?? {}))},
      ${sql.json(jsonInput(input.output ?? {}))}
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
  }
) {
  const sql = getSql();
  const rows = await sql<AgentRunRow[]>`
    update agent_runs
    set
      status = coalesce(${patch.status ?? null}, status),
      output = coalesce(${patch.output ? sql.json(jsonInput(patch.output)) : null}, output),
      error = ${patch.error ?? null},
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(agentRunColumns)}
  `;
  return rows[0] ? normalizeRun(rows[0]) : null;
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
