import { runExternalAgent } from "@central-vet/agents";
import { NextResponse } from "next/server";
import { dbError } from "../../_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, transcript, runId } = body;

    if (!tenantId || !transcript) {
      return NextResponse.json({ error: "tenantId and transcript are required." }, { status: 400 });
    }

    const message = `Call transcript intake: "${transcript}"`;
    const response = await runExternalAgent(message, {
      tenantId,
      runId,
      scenario: "triage"
    });

    return NextResponse.json(response);
  } catch (error) {
    return dbError(error, { route: "agent.call" });
  }
}
