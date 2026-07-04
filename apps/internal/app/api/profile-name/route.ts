import { NextResponse } from "next/server";
import { dbError, logInfo, logWarn, noStoreHeaders } from "../_apiResponse";
import {
  authenticateActor,
  resolveClinicFromRequest
} from "../_shared";
import { applyProfileNameUpdate, profileNameBodySchema } from "./_profileNameRequest";

export async function PATCH(request: Request) {
  try {
    const parsed = profileNameBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      logWarn("profile_name_rejected", { reason: "invalid_payload" });
      return NextResponse.json({ error: "Enter a valid name." }, { status: 400 });
    }

    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActor(parsed.data.actor, request, clinic);
    if ("response" in auth) {
      logWarn("profile_name_rejected", { reason: "unauthorized", actorRole: parsed.data.actor.role });
      return auth.response;
    }

    const result = await applyProfileNameUpdate({
      actor: auth.actor,
      name: parsed.data.name,
      clinicId: clinic.clinicId
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
