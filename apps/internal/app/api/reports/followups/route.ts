import { listAgentReports, listOpenFollowups } from "@central-vet/db";
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
    const [reports, followups] = await Promise.all([
      listAgentReports({ reportType: "followup" }),
      listOpenFollowups()
    ]);
    return NextResponse.json({ ok: true, reports, followups }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "reports.followups" });
  }
}
