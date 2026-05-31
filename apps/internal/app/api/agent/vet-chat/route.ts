import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_shared";
import { runInternalAgent } from "../_workflow";

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

    const result = await runInternalAgent({ message, name: vetName, intent });
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.vet-chat" });
  }
}
