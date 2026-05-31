import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_shared";
import { requireManagerFromBody } from "../_auth";
import { runInternalAgent } from "../_workflow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    const result = await runInternalAgent(auth.body);
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.internal" });
  }
}
