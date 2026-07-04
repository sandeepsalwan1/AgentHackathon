import { listMockClinic, resetMockClinicState } from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_apiResponse";
import {
  requireManagerFromQuery
} from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireManagerFromQuery(request);
    if ("response" in auth) return auth.response;
    const clinic = await listMockClinic({ clinicId: auth.clinic.clinicId });
    return NextResponse.json({ ok: true, clinic }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "mock.clinic" });
  }
}

// Manager-only reset for reproducible demos/scenarios: undoes arrival mutations so
// check-in happy-path fixtures are fresh again. Mock fixtures only; no real PMS data.
export async function POST(request: Request) {
  try {
    const auth = await requireManagerFromQuery(request);
    if ("response" in auth) return auth.response;
    const reset = await resetMockClinicState({ clinicId: auth.clinic.clinicId });
    return NextResponse.json({ ok: true, reset }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "mock.clinic.reset" });
  }
}
