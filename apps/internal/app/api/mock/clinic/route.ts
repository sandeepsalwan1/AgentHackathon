import { getAppointments, listSlots } from "@central-vet/db";
import { dbError } from "../../_shared";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId") || undefined;
    const petId = url.searchParams.get("petId") || undefined;
    const status = url.searchParams.get("status") || undefined;

    const appointments = await getAppointments({ clientId, petId, status });
    const slots = await listSlots(true);

    return NextResponse.json({ appointments, slots });
  } catch (error) {
    return dbError(error, { route: "mock.clinic" });
  }
}
