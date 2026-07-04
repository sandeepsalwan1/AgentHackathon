import { sendDailyPrioritySummary } from "@central-vet/notifications";
import { NextResponse } from "next/server";
import { dbError, logInfo } from "../../_apiResponse";
import { resolveClinicFromRequest } from "../../_shared";
import { requireCronAuthorization } from "../_notificationRequest";

export async function GET(request: Request) {
  try {
    const unauthorized = requireCronAuthorization(request, "daily_priority_summary_rejected");
    if (unauthorized) return unauthorized;
    const clinic = await resolveClinicFromRequest(request);
    const result = await sendDailyPrioritySummary({
      clinicId: clinic.clinicId,
      timeZone: clinic.timeZone
    });
    logInfo("daily_priority_summary_checked", {
      skipped: result.skipped,
      taskCount: result.taskCount,
      resultCount: result.results.length
    });
    return NextResponse.json(result);
  } catch (error) {
    return dbError(error, { route: "notifications.dailyPrioritySummary" });
  }
}
