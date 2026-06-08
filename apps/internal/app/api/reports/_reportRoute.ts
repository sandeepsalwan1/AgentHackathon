import { listAgentReports } from "@central-vet/db";
import { NextResponse } from "next/server";
import {
  authenticateActorFromQuery,
  canManage,
  dbError,
  noStoreHeaders,
  resolveClinicFromRequest
} from "../_shared";

type ReportRouteOptions = {
  route: string;
  reportType: string;
  loadExtra?: (clinicId: string) => Promise<Record<string, unknown>>;
};

export function createReportGet(options: ReportRouteOptions) {
  return async function GET(request: Request) {
    try {
      const url = new URL(request.url);
      const clinic = await resolveClinicFromRequest(request);
      const auth = await authenticateActorFromQuery(url, request, clinic);
      if ("response" in auth) return auth.response;
      if (!canManage(auth.actor.role)) {
        return NextResponse.json({ error: "Manager access required." }, { status: 403 });
      }

      const [reports, extra] = await Promise.all([
        listAgentReports({ clinicId: clinic.clinicId, reportType: options.reportType }),
        options.loadExtra?.(clinic.clinicId) ?? Promise.resolve({})
      ]);
      return NextResponse.json({ ok: true, reports, ...extra }, { headers: noStoreHeaders });
    } catch (error) {
      return dbError(error, { route: options.route });
    }
  };
}
