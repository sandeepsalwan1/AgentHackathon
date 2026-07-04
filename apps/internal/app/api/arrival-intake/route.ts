import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../_apiResponse";
import {
  authenticateActor,
  authenticateActorFromQuery,
  resolveClinicFromRequest
} from "../_shared";
import {
  applyArrivalDeskPatch,
  applyPublicArrivalAction,
  arrivalDeskPatchSchema,
  arrivalDeskPayload,
  publicArrivalActionSchema,
  publicArrivalSettings
} from "./_arrivalIntakeRequest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    if (!url.searchParams.has("role")) {
      return NextResponse.json(await publicArrivalSettings(clinic.clinicId), { headers: noStoreHeaders });
    }

    const auth = await authenticateActorFromQuery(url, request, clinic);
    if ("response" in auth) return auth.response;
    return NextResponse.json(await arrivalDeskPayload(clinic.clinicId), { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "arrival-intake.get" });
  }
}

export async function POST(request: Request) {
  try {
    const clinic = await resolveClinicFromRequest(request);
    const body = publicArrivalActionSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: "Use the check-in form." }, { status: 400 });
    }
    const result = await applyPublicArrivalAction(clinic.clinicId, body.data);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return dbError(error, { route: "arrival-intake.post" });
  }
}

export async function PATCH(request: Request) {
  try {
    const clinic = await resolveClinicFromRequest(request);
    const body = arrivalDeskPatchSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid arrival update." }, { status: 400 });
    }

    const auth = await authenticateActor(body.data.actor, request, clinic);
    if ("response" in auth) return auth.response;

    const result = await applyArrivalDeskPatch(clinic.clinicId, auth.actor, body.data);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return dbError(error, { route: "arrival-intake.patch" });
  }
}
