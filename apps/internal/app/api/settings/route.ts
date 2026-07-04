import { NextResponse } from "next/server";
import { dbError, logInfo, logWarn, noStoreHeaders } from "../_apiResponse";
import {
  authenticateActor,
  authenticateActorFromQuery,
  resolveClinicFromRequest
} from "../_shared";
import { canUseNotificationSettings } from "../../lib/taskWorkflow";
import {
  applySettingsPatch,
  settingsPatchSchema,
  settingsPayloadForActor
} from "./_settingsRequest";

export async function GET(request: Request) {
  try {
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActorFromQuery(new URL(request.url), request, clinic);
    if ("response" in auth) {
      logWarn("settings_read_rejected", { reason: "unauthorized" });
      return auth.response;
    }
    if (!canUseNotificationSettings(auth.actor.role)) {
      logWarn("settings_read_rejected", { reason: "unauthorized" });
      return NextResponse.json({ error: "Settings require Admin or Veterinarian." }, { status: 403 });
    }
    const actor = auth.actor;

    return NextResponse.json(await settingsPayloadForActor(actor, clinic), { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "settings.read" });
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = settingsPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      logWarn("settings_update_rejected", { reason: "unauthorized_or_invalid" });
      return NextResponse.json({ error: "Settings require Admin or Veterinarian." }, { status: 403 });
    }

    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActor(parsed.data.actor, request, clinic);
    if ("response" in auth) {
      logWarn("settings_update_rejected", { reason: "unauthorized_or_invalid" });
      return auth.response;
    }
    if (!canUseNotificationSettings(auth.actor.role)) {
      logWarn("settings_update_rejected", { reason: "unauthorized_or_invalid" });
      return NextResponse.json({ error: "Settings require Admin or Veterinarian." }, { status: 403 });
    }

    const result = await applySettingsPatch(auth.actor, clinic, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    logInfo("settings_updated", result.logFields);
    return NextResponse.json(result.payload, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "settings.update" });
  }
}
