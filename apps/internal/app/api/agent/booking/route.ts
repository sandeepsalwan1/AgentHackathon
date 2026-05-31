import { runExternalAgent } from "@central-vet/agents";
import { NextResponse } from "next/server";
import { dbError } from "../../_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, clientName, petName, slotId, reason, runId } = body;

    if (!tenantId || !clientName || !petName || !slotId) {
      return NextResponse.json({ error: "tenantId, clientName, petName, and slotId are required." }, { status: 400 });
    }

    const message = `Book appointment request for ${petName} owned by ${clientName} in slot ${slotId} for reason: ${reason || "Checkup"}`;
    const response = await runExternalAgent(message, {
      tenantId,
      runId,
      scenario: "booking"
    });

    return NextResponse.json(response);
  } catch (error) {
    return dbError(error, { route: "agent.booking" });
  }
}
