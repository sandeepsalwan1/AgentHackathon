import { sendSmokeEmail } from "@central-vet/notifications";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManage } from "../../lib/taskWorkflow";
import { logInfo, logWarn } from "../_apiResponse";
import {
  actorSchema,
  authenticateActor,
  resolveClinicFromRequest
} from "../_shared";

export type NotificationMode = "disabled" | "test" | "production";

const smokeBodySchema = z.object({
  actor: actorSchema,
  mode: z.enum(["disabled", "test", "production"]).optional()
});

export function notificationMode(value: string | null | undefined): NotificationMode {
  if (value === "test" || value === "production") return value;
  return "disabled";
}

export function envList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export function requireCronAuthorization(request: Request, rejectedEvent: string) {
  if (cronAuthorized(request)) return null;
  logWarn(rejectedEvent, {
    reason: process.env.CRON_SECRET ? "invalid_secret" : "missing_cron_secret"
  });
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export async function smokeNotificationPayload(request: Request) {
  const body = smokeBodySchema.safeParse(await request.json());
  if (!body.success) {
    logWarn("smoke_notification_rejected", { reason: "unauthorized" });
    return {
      response: NextResponse.json({ error: "Authorized passcode required." }, { status: 403 })
    };
  }

  const clinic = await resolveClinicFromRequest(request);
  const auth = await authenticateActor(body.data.actor, request, clinic);
  if ("response" in auth) {
    logWarn("smoke_notification_rejected", { reason: "unauthorized" });
    return { response: auth.response };
  }
  if (!canManage(auth.actor.role)) {
    logWarn("smoke_notification_rejected", {
      reason: "insufficient_role",
      actorRole: auth.actor.role
    });
    return {
      response: NextResponse.json({ error: "Authorized passcode required." }, { status: 403 })
    };
  }

  const result = await sendSmokeEmail({
    clinicId: clinic.clinicId,
    timeZone: clinic.timeZone,
    modeOverride: body.data.mode
  });
  logInfo("smoke_notification_checked", {
    mode: body.data.mode || "env",
    resultCount: result.results.length
  });
  return { result };
}
