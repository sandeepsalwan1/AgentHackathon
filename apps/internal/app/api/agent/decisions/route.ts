import { listAgentDecisions, type AgentDecisionStatus } from "@central-vet/db";
import { NextResponse } from "next/server";
import {
  authenticateActorFromQuery,
  canManage,
  dbError,
  noStoreHeaders,
  resolveClinicFromRequest
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
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActorFromQuery(url, request, clinic);
    if ("response" in auth) return auth.response;
    if (!canManage(auth.actor.role)) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }
    const decisions = await listAgentDecisions({
      clinicId: clinic.clinicId,
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
