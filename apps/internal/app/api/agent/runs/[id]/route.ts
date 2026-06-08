import { getAgentRunWithTimeline } from "@central-vet/db";
import { NextResponse } from "next/server";
import {
  authenticateActorFromQuery,
  canManage,
  dbError,
  noStoreHeaders,
  resolveClinicFromRequest
} from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActorFromQuery(url, request, clinic);
    if ("response" in auth) return auth.response;
    if (!canManage(auth.actor.role)) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }
    const { id } = await context.params;
    const detail = await getAgentRunWithTimeline(id, { clinicId: clinic.clinicId });
    if (!detail) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    return NextResponse.json({ ok: true, ...detail }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.runs.get" });
  }
}
