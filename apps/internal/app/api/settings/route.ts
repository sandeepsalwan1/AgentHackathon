import { NextResponse } from "next/server";
import { dbError, logInfo, noStoreHeaders } from "../_apiResponse";
import {
  applySettingsPatch,
  settingsPatchContext,
  settingsPayloadForActor,
  settingsReadContext
} from "./_settingsRequest";

export async function GET(request: Request) {
  try {
    const context = await settingsReadContext(request);
    if ("response" in context) return context.response;
    return NextResponse.json(
      await settingsPayloadForActor(context.actor, context.clinic),
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return dbError(error, { route: "settings.read" });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await settingsPatchContext(request);
    if ("response" in context) return context.response;
    const result = await applySettingsPatch(context.actor, context.clinic, context.patch);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    logInfo("settings_updated", result.logFields);
    return NextResponse.json(result.payload, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "settings.update" });
  }
}
