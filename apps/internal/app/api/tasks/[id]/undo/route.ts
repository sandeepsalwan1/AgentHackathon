import { undoLastStatusChange } from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dbError, logInfo, logWarn } from "../../../_apiResponse";
import {
  authenticateActor,
  actorSchema,
  resolveClinicFromRequest
} from "../../../_shared";
import { sanitizeTaskForActor } from "../../_taskVisibility";
import { canManage } from "../../../../lib/taskWorkflow";

const bodySchema = z.object({
  actor: actorSchema
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) {
      logWarn("task_undo_rejected", { reason: "invalid_payload" });
      return NextResponse.json({ error: "Invalid undo request." }, { status: 400 });
    }

    const { id } = await context.params;
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActor(body.data.actor, request, clinic);
    if ("response" in auth) {
      logWarn("task_undo_rejected", {
        taskId: id,
        reason: "unauthorized",
        actorRole: body.data.actor.role
      });
      return auth.response;
    }
    if (!canManage(auth.actor.role)) {
      logWarn("task_undo_rejected", {
        taskId: id,
        reason: "unauthorized",
        actorRole: body.data.actor.role
      });
      return NextResponse.json({ error: "Undo not allowed." }, { status: 403 });
    }
    const actor = auth.actor;

    const task = await undoLastStatusChange(id, actor, { clinicId: clinic.clinicId });
    if (task) {
      logInfo("task_updated", {
        taskId: id,
        action: "undo",
        actorRole: actor.role,
        status: task.status
      });
    }
    return NextResponse.json({ task: task ? sanitizeTaskForActor(task, actor.role) : task });
  } catch (error) {
    return dbError(error, { route: "tasks.undo" });
  }
}
