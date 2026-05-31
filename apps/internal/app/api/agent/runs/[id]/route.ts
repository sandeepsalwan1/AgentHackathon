import { getWorkflowRun, getWorkflowEvents } from "@central-vet/db";
import { dbError } from "../../../_shared";
import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const run = await getWorkflowRun(id);
    if (!run) {
      return NextResponse.json({ error: "Workflow run not found." }, { status: 404 });
    }
    const events = await getWorkflowEvents(id);
    return NextResponse.json({ run, events });
  } catch (error) {
    return dbError(error, { route: "agent.runs.get" });
  }
}
