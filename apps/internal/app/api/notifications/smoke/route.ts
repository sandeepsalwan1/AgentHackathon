import { sendSmokeEmail } from "@central-vet/notifications";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateActor, actorSchema, canManage, dbError, logInfo, logWarn } from "../../_shared";

const bodySchema = z.object({
  actor: actorSchema,
  mode: z.enum(["disabled", "test", "production"]).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) {
      logWarn("smoke_notification_rejected", { reason: "unauthorized" });
      return NextResponse.json({ error: "Authorized passcode required." }, { status: 403 });
    }
    const auth = await authenticateActor(body.data.actor, request);
    if ("response" in auth) {
      logWarn("smoke_notification_rejected", { reason: "unauthorized" });
      return auth.response;
    }
    if (!canManage(auth.actor.role)) {
      logWarn("smoke_notification_rejected", {
        reason: "insufficient_role",
        actorRole: auth.actor.role
      });
      return NextResponse.json({ error: "Authorized passcode required." }, { status: 403 });
    }

    const result = await sendSmokeEmail({ modeOverride: body.data.mode });
    logInfo("smoke_notification_checked", {
      mode: body.data.mode || "env",
      resultCount: result.results.length
    });
    return NextResponse.json(result);
  } catch (error) {
    return dbError(error, { route: "notifications.smoke" });
  }
}
