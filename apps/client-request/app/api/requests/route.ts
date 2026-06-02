import { handleClientRequestIntake } from "@central-vet/request-intake";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const result = await handleClientRequestIntake(request, {
    hospitalName: process.env.HOSPITAL_NAME,
    maxTrackedClients: 1000
  });
  return NextResponse.json(result.body, { status: result.status });
}
