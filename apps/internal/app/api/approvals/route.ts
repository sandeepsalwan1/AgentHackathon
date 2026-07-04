import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../_apiResponse";
import {
  requireManagerFromQuery,
  resolveClinicFromRequest
} from "../_shared";
import { approvalListPayload, createApprovalFromBody } from "./_approvalRequest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireManagerFromQuery(request);
    if ("response" in auth) return auth.response;
    const status = auth.url.searchParams.get("status") || "pending";
    return NextResponse.json(
      await approvalListPayload(auth.clinic.clinicId, status),
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return dbError(error, { route: "approvals.list" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clinic = await resolveClinicFromRequest(request);
    const result = await createApprovalFromBody(request, body, clinic);
    if ("response" in result) return result.response;
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, approval: result.approval }, { headers: noStoreHeaders, status: result.status });
  } catch (error) {
    return dbError(error, { route: "approvals.create" });
  }
}
