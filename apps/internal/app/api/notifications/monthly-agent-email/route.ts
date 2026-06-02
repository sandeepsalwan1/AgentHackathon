import { sendAgentExampleEmail, type NotificationMode } from "@central-vet/notifications";
import { NextResponse } from "next/server";
import { dbError, logInfo, logWarn } from "../../_shared";

export const dynamic = "force-dynamic";

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function notificationMode(value: string | null | undefined): NotificationMode {
  if (value === "test" || value === "production") return value;
  return "disabled";
}

function envList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function handler(request: Request) {
  try {
    if (!cronAuthorized(request)) {
      logWarn("monthly_agent_email_rejected", {
        reason: process.env.CRON_SECRET ? "invalid_secret" : "missing_cron_secret"
      });
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(request.url);
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
      modeOverride: mode,
      cadence: "monthly",
      period,
      recipients: envList(process.env.MONTHLY_AGENT_EMAIL_RECIPIENTS),
      subject: process.env.MONTHLY_AGENT_EMAIL_SUBJECT || "Central Veterinary Hospital monthly agent email",
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
