import { runExternalAgent } from "@central-vet/agents";
import { NextResponse } from "next/server";
import { dbError } from "../../_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, scenario, message, runId } = body;

    if (!tenantId || !message) {
      return NextResponse.json({ error: "tenantId and message are required." }, { status: 400 });
    }

    const response = await runExternalAgent(message, {
      tenantId,
      runId,
      scenario
    });

    return NextResponse.json(response);
  } catch (error) {
    return dbError(error, { route: "agent.external" });
  }
}
