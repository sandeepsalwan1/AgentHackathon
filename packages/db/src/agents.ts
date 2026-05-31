import { getSql } from "./connection";

export type WorkflowRun = {
  id: string;
  status: string;
  agentType: string;
  scenario: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowEvent = {
  id: string;
  runId: string;
  eventType: string;
  toolName: string | null;
  payload: Record<string, any>;
  createdAt: string;
};

export type ApprovalRequest = {
  id: string;
  taskId: string | null;
  requestType: string;
  status: string;
  requesterRole: string;
  requestedAction: string;
  payload: Record<string, any>;
  decidedByName: string | null;
  decidedByRole: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type AgentTrace = {
  id: string;
  runId: string;
  prompt: string;
  response: string;
  createdAt: string;
};

export async function createWorkflowRun(agentType: string, scenario: string, metadata: Record<string, any> = {}) {
  const sql = getSql();
  const rows = await sql<WorkflowRun[]>`
    insert into workflow_runs (agent_type, scenario, metadata)
    values (${agentType}, ${scenario}, ${sql.json(metadata)})
    returning id, status, agent_type as "agentType", scenario, metadata, created_at as "createdAt", updated_at as "updatedAt"
  `;
  return rows[0];
}

export async function updateWorkflowRunStatus(runId: string, status: string, metadata: Record<string, any> = {}) {
  const sql = getSql();
  const rows = await sql<WorkflowRun[]>`
    update workflow_runs
    set status = ${status}, metadata = metadata || ${sql.json(metadata)}, updated_at = now()
    where id = ${runId}
    returning id, status, agent_type as "agentType", scenario, metadata, created_at as "createdAt", updated_at as "updatedAt"
  `;
  return rows[0] || null;
}

export async function getWorkflowRun(runId: string) {
  const sql = getSql();
  const rows = await sql<WorkflowRun[]>`
    select id, status, agent_type as "agentType", scenario, metadata, created_at as "createdAt", updated_at as "updatedAt"
    from workflow_runs
    where id = ${runId}
  `;
  return rows[0] || null;
}

export async function logWorkflowEvent(runId: string, eventType: string, toolName: string | null, payload: Record<string, any> = {}) {
  const sql = getSql();
  const rows = await sql<WorkflowEvent[]>`
    insert into workflow_events (run_id, event_type, tool_name, payload)
    values (${runId}, ${eventType}, ${toolName}, ${sql.json(payload)})
    returning id, run_id as "runId", event_type as "eventType", tool_name as "toolName", payload, created_at as "createdAt"
  `;
  return rows[0];
}

export async function getWorkflowEvents(runId: string) {
  const sql = getSql();
  return sql<WorkflowEvent[]>`
    select id, run_id as "runId", event_type as "eventType", tool_name as "toolName", payload, created_at as "createdAt"
    from workflow_events
    where run_id = ${runId}
    order by created_at asc
  `;
}

export async function createApprovalRequest(
  taskId: string | null,
  requestType: string,
  requesterRole: string,
  requestedAction: string,
  payload: Record<string, any> = {}
) {
  const sql = getSql();
  const rows = await sql<ApprovalRequest[]>`
    insert into approval_requests (task_id, request_type, requester_role, requested_action, payload)
    values (${taskId}, ${requestType}, ${requesterRole}, ${requestedAction}, ${sql.json(payload)})
    returning id, task_id as "taskId", request_type as "requestType", status, requester_role as "requesterRole", requested_action as "requestedAction", payload, decided_by_name as "decidedByName", decided_by_role as "decidedByRole", decided_at as "decidedAt", created_at as "createdAt"
  `;
  return rows[0];
}

export async function decideApprovalRequest(approvalId: string, status: string, actorName: string, actorRole: string) {
  const sql = getSql();
  const rows = await sql<ApprovalRequest[]>`
    update approval_requests
    set status = ${status}, decided_by_name = ${actorName}, decided_by_role = ${actorRole}, decided_at = now()
    where id = ${approvalId}
    returning id, task_id as "taskId", request_type as "requestType", status, requester_role as "requesterRole", requested_action as "requestedAction", payload, decided_by_name as "decidedByName", decided_by_role as "decidedByRole", decided_at as "decidedAt", created_at as "createdAt"
  `;
  return rows[0] || null;
}

export async function getApprovalRequests(status?: string) {
  const sql = getSql();
  if (status) {
    return sql<ApprovalRequest[]>`
      select id, task_id as "taskId", request_type as "requestType", status, requester_role as "requesterRole", requested_action as "requestedAction", payload, decided_by_name as "decidedByName", decided_by_role as "decidedByRole", decided_at as "decidedAt", created_at as "createdAt"
      from approval_requests
      where status = ${status}
      order by created_at desc
    `;
  }
  return sql<ApprovalRequest[]>`
    select id, task_id as "taskId", request_type as "requestType", status, requester_role as "requesterRole", requested_action as "requestedAction", payload, decided_by_name as "decidedByName", decided_by_role as "decidedByRole", decided_at as "decidedAt", created_at as "createdAt"
    from approval_requests
    order by created_at desc
  `;
}

export async function getApprovalRequest(id: string) {
  const sql = getSql();
  const rows = await sql<ApprovalRequest[]>`
    select id, task_id as "taskId", request_type as "requestType", status, requester_role as "requesterRole", requested_action as "requestedAction", payload, decided_by_name as "decidedByName", decided_by_role as "decidedByRole", decided_at as "decidedAt", created_at as "createdAt"
    from approval_requests
    where id = ${id}
  `;
  return rows[0] || null;
}

export async function logAgentTrace(runId: string, prompt: string, response: string) {
  const sql = getSql();
  const rows = await sql<AgentTrace[]>`
    insert into agent_traces (run_id, prompt, response)
    values (${runId}, ${prompt}, ${response})
    returning id, run_id as "runId", prompt, response, created_at as "createdAt"
  `;
  return rows[0];
}

export async function createDailyOpsSummary(content: string) {
  const sql = getSql();
  const rows = await sql<{ id: string; summary_date: string; content: string; created_at: string }[]>`
    insert into daily_ops_summaries (content)
    values (${content})
    returning id, summary_date::text as "summaryDate", content, created_at as "createdAt"
  `;
  return rows[0];
}

export async function getDailyOpsSummaries() {
  const sql = getSql();
  return sql<{ id: string; summaryDate: string; content: string; createdAt: string }[]>`
    select id, summary_date::text as "summaryDate", content, created_at as "createdAt"
    from daily_ops_summaries
    order by created_at desc
  `;
}

export async function createPricingReport(content: string) {
  const sql = getSql();
  const rows = await sql<{ id: string; report_date: string; content: string; created_at: string }[]>`
    insert into pricing_reports (content)
    values (${content})
    returning id, report_date::text as "reportDate", content, created_at as "createdAt"
  `;
  return rows[0];
}

export async function getPricingReports() {
  const sql = getSql();
  return sql<{ id: string; reportDate: string; content: string; createdAt: string }[]>`
    select id, report_date::text as "reportDate", content, created_at as "createdAt"
    from pricing_reports
    order by created_at desc
  `;
}

export async function createInvoiceReviewReport(invoiceId: string, issueDetails: string, status = "pending") {
  const sql = getSql();
  const rows = await sql<{ id: string; invoice_id: string; issue_details: string; status: string; created_at: string }[]>`
    insert into invoice_review_reports (invoice_id, issue_details, status)
    values (${invoiceId}, ${issueDetails}, ${status})
    returning id, invoice_id as "invoiceId", issue_details as "issueDetails", status, created_at as "createdAt"
  `;
  return rows[0];
}

export async function getInvoiceReviewReports() {
  const sql = getSql();
  return sql<{ id: string; invoiceId: string; issueDetails: string; status: string; createdAt: string }[]>`
    select id, invoice_id as "invoiceId", issue_details as "issueDetails", status, created_at as "createdAt"
    from invoice_review_reports
    order by created_at desc
  `;
}
