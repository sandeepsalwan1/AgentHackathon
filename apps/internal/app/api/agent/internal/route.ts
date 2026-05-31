import { runInternalAgent } from "@central-vet/agents";
import { NextResponse } from "next/server";
import { authenticateActor, dbError } from "../../_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, scenario, message, actor: actorInput, runId } = body;

    if (!tenantId || !message || !actorInput) {
      return NextResponse.json({ error: "tenantId, message, and actor are required." }, { status: 400 });
    }

    // Authenticate staff actor (requires passcode if not staff)
    const auth = await authenticateActor(actorInput, request);
    if ("response" in auth) {
      return auth.response;
    }
    const actor = auth.actor;

    const response = await runInternalAgent(message, {
      tenantId,
      runId,
      scenario,
      actor
    });

    return NextResponse.json(response);
  } catch (error) {
    return dbError(error, { route: "agent.internal" });
  }
}
