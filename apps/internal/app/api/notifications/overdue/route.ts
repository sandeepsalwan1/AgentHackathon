import { sendOverdueSummary } from "@central-vet/notifications";
import { NextResponse } from "next/server";
import { dbError, logInfo, logWarn, resolveClinicFromRequest } from "../../_shared";

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    if (!cronAuthorized(request)) {
      logWarn("overdue_notification_rejected", {
        reason: process.env.CRON_SECRET ? "invalid_secret" : "missing_cron_secret"
      });
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const clinic = await resolveClinicFromRequest(request);
    const result = await sendOverdueSummary({
      clinicId: clinic.clinicId,
      timeZone: clinic.timeZone
    });
    logInfo("overdue_notification_checked", {
      skipped: result.skipped,
      taskCount: result.taskCount,
      resultCount: result.results.length
    });
    return NextResponse.json(result);
  } catch (error) {
    return dbError(error, { route: "notifications.overdue" });
  }
}
