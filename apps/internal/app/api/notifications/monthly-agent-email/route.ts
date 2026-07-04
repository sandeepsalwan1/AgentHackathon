import { sendAgentExampleEmail } from "@central-vet/notifications";
import { NextResponse } from "next/server";
import { dbError, logInfo } from "../../_apiResponse";
import { resolveClinicFromRequest } from "../../_shared";
import { envList, notificationMode, requireCronAuthorization } from "../_notificationRequest";

export const dynamic = "force-dynamic";

async function handler(request: Request) {
  try {
    const unauthorized = requireCronAuthorization(request, "monthly_agent_email_rejected");
    if (unauthorized) return unauthorized;

    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    const mode = notificationMode(
      url.searchParams.get("mode") ||
      process.env.MONTHLY_AGENT_EMAIL_MODE ||
      process.env.NOTIFICATION_MODE
    );
    const period = url.searchParams.get("period") || undefined;
    if (period && !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "period must be YYYY-MM." }, { status: 400 });
    }

    const result = await sendAgentExampleEmail({
      clinicId: clinic.clinicId,
      timeZone: clinic.timeZone,
      modeOverride: mode,
      cadence: "monthly",
      period,
      recipients: envList(process.env.MONTHLY_AGENT_EMAIL_RECIPIENTS),
      subject: process.env.MONTHLY_AGENT_EMAIL_SUBJECT || `${clinic.name} monthly agent email`,
      message: process.env.MONTHLY_AGENT_EMAIL_MESSAGE ||
        "This is the monthly VetAgent email path check."
    });

    logInfo("monthly_agent_email_checked", {
      mode,
      resultCount: result.results.length
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return dbError(error, { route: "notifications.monthly_agent_email" });
  }
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
