import { getApprovalRequest, decideApprovalRequest } from "@central-vet/db";
import { authenticateActor, dbError } from "../../_shared";
import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const approval = await getApprovalRequest(id);
    if (!approval) {
      return NextResponse.json({ error: "Approval request not found." }, { status: 404 });
    }
    return NextResponse.json({ approval });
  } catch (error) {
    return dbError(error, { route: "approvals.get" });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, actor: actorInput } = body;

    if (!status || !actorInput) {
      return NextResponse.json({ error: "status and actor are required." }, { status: 400 });
    }

    const auth = await authenticateActor(actorInput, request);
    if ("response" in auth) {
      return auth.response;
    }
    const actor = auth.actor;

    const approval = await decideApprovalRequest(id, status, actor.name, actor.role);
    if (!approval) {
      return NextResponse.json({ error: "Approval request not found." }, { status: 404 });
    }

    return NextResponse.json({ approval });
  } catch (error) {
    return dbError(error, { route: "approvals.decide" });
  }
}
