import { getApprovalRequests, createApprovalRequest } from "@central-vet/db";
import { authenticateActor, dbError } from "../_shared";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const approvals = await getApprovalRequests(status);
    return NextResponse.json({ approvals });
  } catch (error) {
    return dbError(error, { route: "approvals.list" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId, requestType, requestedAction, payload, actor: actorInput } = body;

    if (!requestType || !requestedAction || !actorInput) {
      return NextResponse.json({ error: "requestType, requestedAction, and actor are required." }, { status: 400 });
    }

    const auth = await authenticateActor(actorInput, request);
    if ("response" in auth) {
      return auth.response;
    }
    const actor = auth.actor;

    const approval = await createApprovalRequest(
      taskId || null,
      requestType,
      actor.role,
      requestedAction,
      payload
    );

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    return dbError(error, { route: "approvals.create" });
  }
}
