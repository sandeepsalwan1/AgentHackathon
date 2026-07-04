import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_apiResponse";
import { resolveClinicFromRequest } from "../../_shared";
import { decideApprovalFromBody } from "../_approvalRequest";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const clinic = await resolveClinicFromRequest(request);
    const { id } = await context.params;
    const result = await decideApprovalFromBody(request, body, clinic, id);
    if ("response" in result) return result.response;
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, approval: result.approval }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "approvals.decide" });
  }
}
