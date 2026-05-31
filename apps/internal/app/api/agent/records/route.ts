import { runExternalAgent } from "@central-vet/agents";
import { NextResponse } from "next/server";
import { dbError } from "../../_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, clientName, petName, previousClinicName, runId } = body;

    if (!tenantId || !clientName || !petName || !previousClinicName) {
      return NextResponse.json({ error: "tenantId, clientName, petName, and previousClinicName are required." }, { status: 400 });
    }

    const message = `Request records transfer for ${petName} owned by ${clientName} from previous clinic: ${previousClinicName}`;
    const response = await runExternalAgent(message, {
      tenantId,
      runId,
      scenario: "records"
    });

    return NextResponse.json(response);
  } catch (error) {
    return dbError(error, { route: "agent.records" });
  }
}
