import { listApprovals } from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders, resolveClinicFromRequest } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const clinic = await resolveClinicFromRequest(request);
    const approvals = await listApprovals({
      clinicId: clinic.clinicId,
      status: "pending"
    });
    return NextResponse.json({ ok: true, approvals }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.vet-approvals" });
  }
}
