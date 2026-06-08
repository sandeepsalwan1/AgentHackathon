import { resolveClinicForHostname } from "@central-vet/db";
import { handleClientRequestIntake } from "@central-vet/request-intake";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const clinic = await resolveClinicForHostname(
    request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host
  );
  const result = await handleClientRequestIntake(request, {
    clinicId: clinic.clinicId,
    hospitalName: clinic.name,
    maxTrackedClients: 1000
  });
  return NextResponse.json(result.body, { status: result.status });
}
