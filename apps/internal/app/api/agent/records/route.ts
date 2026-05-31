import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_shared";
import { readPublicAgentBody } from "../_auth";
import { runRecords } from "../_workflow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await readPublicAgentBody(request, "records");
    if ("response" in parsed) return parsed.response;
    const result = await runRecords(parsed.body);
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.records" });
  }
}
