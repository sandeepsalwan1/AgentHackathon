import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_shared";
import { readPublicAgentBody } from "../_auth";
import { runCall } from "../_workflow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await readPublicAgentBody(request, "call");
    if ("response" in parsed) return parsed.response;
    const result = await runCall(parsed.body);
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.call" });
  }
}
