import { listAgentDecisions, type AgentDecisionStatus } from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_apiResponse";
import {
  requireManagerFromQuery
} from "../../_shared";

export const dynamic = "force-dynamic";

const decisionStatuses = new Set<AgentDecisionStatus>([
  "proposed",
  "confirmed",
  "completed",
  "blocked",
  "skipped",
  "failed"
]);

function statusParam(value: string | null) {
  return value && decisionStatuses.has(value as AgentDecisionStatus)
    ? value as AgentDecisionStatus
    : null;
}

function limitParam(value: string | null) {
  const limit = Number(value || 50);
  return Number.isFinite(limit) ? limit : 50;
}

export async function GET(request: Request) {
  try {
    const auth = await requireManagerFromQuery(request);
    if ("response" in auth) return auth.response;
    const url = auth.url;
    const decisions = await listAgentDecisions({
      clinicId: auth.clinic.clinicId,
      runId: url.searchParams.get("runId"),
      decisionKind: url.searchParams.get("kind"),
      status: statusParam(url.searchParams.get("status")),
      limit: limitParam(url.searchParams.get("limit"))
    });
    return NextResponse.json({ ok: true, decisions }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.decisions" });
  }
}
