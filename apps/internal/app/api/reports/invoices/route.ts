import { listAgentReports } from "@central-vet/db";
import { NextResponse } from "next/server";
import { authenticateActorFromQuery, canManage, dbError, noStoreHeaders } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const auth = await authenticateActorFromQuery(url, request);
    if ("response" in auth) return auth.response;
    if (!canManage(auth.actor.role)) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }
    const reports = await listAgentReports({ reportType: "invoice" });
    return NextResponse.json({ ok: true, reports }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "reports.invoices" });
  }
}
