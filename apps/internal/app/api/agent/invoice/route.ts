import { runInternalAgent } from "@central-vet/agents";
import { NextResponse } from "next/server";
import { authenticateActor, dbError } from "../../_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, actor: actorInput, runId } = body;

    if (!tenantId || !actorInput) {
      return NextResponse.json({ error: "tenantId and actor are required." }, { status: 400 });
    }

    const auth = await authenticateActor(actorInput, request);
    if ("response" in auth) {
      return auth.response;
    }
    const actor = auth.actor;

    const response = await runInternalAgent("Audit invoices and flag issues", {
      tenantId,
      runId,
      scenario: "invoice",
      actor
    });

    return NextResponse.json(response);
  } catch (error) {
    return dbError(error, { route: "agent.invoice" });
  }
}
