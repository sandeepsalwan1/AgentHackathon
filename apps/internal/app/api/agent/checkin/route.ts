import { runExternalAgent } from "@central-vet/agents";
import { NextResponse } from "next/server";
import { dbError } from "../../_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, clientName, petName, runId } = body;

    if (!tenantId || !clientName || !petName) {
      return NextResponse.json({ error: "tenantId, clientName, and petName are required." }, { status: 400 });
    }

    const message = `Check-in request for ${petName} owned by ${clientName}`;
    const response = await runExternalAgent(message, {
      tenantId,
      runId,
      scenario: "checkin"
    });

    return NextResponse.json(response);
  } catch (error) {
    return dbError(error, { route: "agent.checkin" });
  }
}
