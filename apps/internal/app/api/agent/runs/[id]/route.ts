import { getAgentRunWithTimeline } from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../../_apiResponse";
import {
  requireManagerFromQuery
} from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireManagerFromQuery(request);
    if ("response" in auth) return auth.response;
    const { id } = await context.params;
    const detail = await getAgentRunWithTimeline(id, { clinicId: auth.clinic.clinicId });
    if (!detail) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    return NextResponse.json({ ok: true, ...detail }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.runs.get" });
  }
}
