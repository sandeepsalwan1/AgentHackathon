import { listTaskEvents } from "@central-vet/db";
import { NextResponse } from "next/server";
import {
  authenticateActorFromQuery,
  canManage,
  dbError,
  logWarn,
  noStoreHeaders,
  resolveClinicFromRequest
} from "../_shared";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActorFromQuery(url, request, clinic);
    if ("response" in auth) {
      logWarn("events_read_rejected", { reason: "unauthorized" });
      return auth.response;
    }
    if (!canManage(auth.actor.role)) {
      logWarn("events_read_rejected", { reason: "unauthorized" });
      return NextResponse.json({ error: "Audit log requires VA, Veterinarian, or Admin." }, { status: 403 });
    }

    const events = await listTaskEvents(80, { clinicId: clinic.clinicId });
    return NextResponse.json({ events }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "events.list" });
  }
}
