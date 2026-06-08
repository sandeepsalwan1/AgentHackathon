import { listAgentReports } from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders, resolveClinicFromRequest } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    const type = url.searchParams.get("type") ?? undefined;
    const reports = await listAgentReports({
      clinicId: clinic.clinicId,
      reportType: type,
      limit: 20
    });
    return NextResponse.json({ ok: true, reports }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.vet-reports" });
  }
}
