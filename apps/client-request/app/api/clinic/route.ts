import { resolveClinicForHostname } from "@central-vet/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clinic = await resolveClinicForHostname(
    request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host
  );
  return NextResponse.json(
    { clinic },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
  );
}
