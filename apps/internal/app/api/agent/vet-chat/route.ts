import { NextResponse } from "next/server";
import { dbError } from "../../_shared";
import { executeVetAgentWorkflow } from "../_runner";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const vetName = typeof body.vetName === "string" ? body.vetName.trim() : "Veterinarian";
    const intent = typeof body.intent === "string" ? body.intent : undefined;

    if (!message) {
      return NextResponse.json({ error: "message is required." }, { status: 400 });
    }

    return executeVetAgentWorkflow({
      agent: "internal",
      routeIntent: "internal",
      input: { message, request: message, name: vetName, ...(intent ? { intent } : {}) },
      actor: { name: vetName, role: "veterinarian" },
      request
    });
  } catch (error) {
    return dbError(error, { route: "agent.vet-chat" });
  }
}
