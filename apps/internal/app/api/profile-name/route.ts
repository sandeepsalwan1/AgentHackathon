import { NextResponse } from "next/server";
import { dbError, logInfo, noStoreHeaders } from "../_apiResponse";
import { applyProfileNameUpdate, profileNameUpdateContext } from "./_profileNameRequest";

export async function PATCH(request: Request) {
  try {
    const context = await profileNameUpdateContext(request);
    if ("response" in context) return context.response;
    const result = await applyProfileNameUpdate({
      actor: context.actor,
      name: context.name,
      clinicId: context.clinicId
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    logInfo("profile_name_updated", result.logFields);
    return NextResponse.json(result.body, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "profile-name.update" });
  }
}
