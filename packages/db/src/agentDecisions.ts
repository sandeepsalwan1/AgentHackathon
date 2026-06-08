import { getSql } from "./connection";
import { resolveClinicId } from "./clinics";
import type { Actor } from "./types";
import { jsonInput, redactedAgentObject } from "./agentJson";

export type AgentDecisionStatus = "proposed" | "confirmed" | "completed" | "blocked" | "skipped" | "failed";
export type AgentDecisionTtl = "short" | "long" | "permanent";

export type AgentDecision = {
  id: string;
  clinicId: string;
  runId: string | null;
  traceId: string | null;
  agent: string;
  capability: string;
  decisionKind: string;
  status: AgentDecisionStatus;
  ttl: AgentDecisionTtl;
  actorName: string | null;
  actorRole: string | null;
  actorProfileId: string | null;
  action: string;
  inputSummary: string | null;
  resultSummary: string | null;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AgentDecisionRow = {
  id: string;
  clinic_id: string;
  run_id: string | null;
  trace_id: string | null;
  agent: string;
  capability: string;
  decision_kind: string;
  status: AgentDecisionStatus;
  ttl: AgentDecisionTtl;
  actor_name: string | null;
  actor_role: string | null;
  actor_profile_id: string | null;
  action: string;
  input_summary: string | null;
  result_summary: string | null;
  metadata: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

const decisionColumns = `
  id,
  clinic_id,
  run_id,
  trace_id,
  agent,
  capability,
  decision_kind,
  status,
  ttl,
  actor_name,
  actor_role,
  actor_profile_id,
  action,
  input_summary,
  result_summary,
  metadata,
  expires_at,
  created_at,
  updated_at
`;

function normalizeDecision(row: AgentDecisionRow): AgentDecision {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    runId: row.run_id,
    traceId: row.trace_id,
    agent: row.agent,
    capability: row.capability,
    decisionKind: row.decision_kind,
    status: row.status,
    ttl: row.ttl,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    actorProfileId: row.actor_profile_id,
    action: row.action,
    inputSummary: row.input_summary,
    resultSummary: row.result_summary,
    metadata: row.metadata ?? {},
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function expiresSql(ttl: AgentDecisionTtl) {
  if (ttl === "short") return "now() + interval '3 minutes'";
  if (ttl === "long") return "now() + interval '1 year'";
  return "null";
}

export async function createAgentDecision(input: {
  clinicId?: string | null;
  runId?: string | null;
  traceId?: string | null;
  agent: string;
  capability: string;
  decisionKind: string;
  status: AgentDecisionStatus;
  ttl?: AgentDecisionTtl;
  actor?: Actor | null;
  action: string;
  inputSummary?: string | null;
  resultSummary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const ttl = input.ttl ?? "long";
  const rows = await sql<AgentDecisionRow[]>`
    insert into agent_decisions (
      clinic_id,
      run_id,
      trace_id,
      agent,
      capability,
      decision_kind,
      status,
      ttl,
      actor_name,
      actor_role,
      actor_profile_id,
      action,
      input_summary,
      result_summary,
      metadata,
      expires_at
    )
    values (
      ${clinicId},
      ${input.runId ?? null},
      ${input.traceId ?? null},
      ${input.agent},
      ${input.capability},
      ${input.decisionKind},
      ${input.status},
      ${ttl},
      ${input.actor?.name ?? null},
      ${input.actor?.role ?? null},
      ${input.actor?.profileId ?? null},
      ${input.action},
      ${input.inputSummary ?? null},
      ${input.resultSummary ?? null},
      ${sql.json(jsonInput(redactedAgentObject(input.metadata)))},
      ${sql.unsafe(expiresSql(ttl))}
    )
    returning ${sql.unsafe(decisionColumns)}
  `;
  return normalizeDecision(rows[0]);
}

export async function listAgentDecisions(options: {
  clinicId?: string | null;
  runId?: string | null;
  decisionKind?: string | null;
  status?: AgentDecisionStatus | null;
  limit?: number;
} = {}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options.clinicId);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = await sql<AgentDecisionRow[]>`
    select ${sql.unsafe(decisionColumns)}
    from agent_decisions
    where clinic_id = ${clinicId}
      and (${options.runId ?? null}::uuid is null or run_id = ${options.runId ?? null})
      and (${options.decisionKind ?? null}::text is null or decision_kind = ${options.decisionKind ?? null})
      and (${options.status ?? null}::text is null or status = ${options.status ?? null})
    order by created_at desc
    limit ${limit}
  `;
  return rows.map(normalizeDecision);
}

export async function updateAgentDecisionStatus(
  id: string,
  input: {
    clinicId?: string | null;
    status: AgentDecisionStatus;
    actor?: Actor | null;
    resultSummary?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const rows = await sql<AgentDecisionRow[]>`
    update agent_decisions
    set
      status = ${input.status},
      actor_name = coalesce(${input.actor?.name ?? null}, actor_name),
      actor_role = coalesce(${input.actor?.role ?? null}, actor_role),
      actor_profile_id = coalesce(${input.actor?.profileId ?? null}, actor_profile_id),
      result_summary = coalesce(${input.resultSummary ?? null}, result_summary),
      metadata = metadata || ${sql.json(jsonInput(redactedAgentObject(input.metadata)))},
      updated_at = now()
    where id = ${id}
      and clinic_id = ${clinicId}
    returning ${sql.unsafe(decisionColumns)}
  `;
  return rows[0] ? normalizeDecision(rows[0]) : null;
}
