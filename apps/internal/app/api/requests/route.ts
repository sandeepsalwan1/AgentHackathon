import { handleClientRequestIntake } from "@central-vet/request-intake";
import { NextResponse } from "next/server";
import { resolveClinicFromRequest } from "../_shared";

export async function POST(request: Request) {
  const clinic = await resolveClinicFromRequest(request);
  const result = await handleClientRequestIntake(request, {
    clinicId: clinic.clinicId,
    hospitalName: clinic.name,
    maxTrackedClients: 2000
  });
  return NextResponse.json(result.body, { status: result.status });
}
