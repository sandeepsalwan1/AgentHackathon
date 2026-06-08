import { NextResponse } from "next/server";
import {
  authenticateActor,
  actorSchema,
  dbError,
  logError,
  logInfo,
  logWarn,
  resolveClinicFromRequest,
  sanitizeTaskForActor
} from "../../_shared";
import {
  applyTaskUpdateAction,
  taskUpdateBodySchema
} from "./_taskUpdateRequest";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const rawBody = await request.json();
    const actorResult = actorSchema.safeParse(rawBody.actor);
    const bodyResult = taskUpdateBodySchema.safeParse(rawBody);
    if (!actorResult.success || !bodyResult.success) {
      logWarn("task_update_rejected", { reason: "invalid_payload" });
      return NextResponse.json({ error: "Invalid task update." }, { status: 400 });
    }

    const { id } = await context.params;
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActor(actorResult.data, request, clinic);
    if ("response" in auth) {
      logWarn("task_update_rejected", {
        taskId: id,
        reason: "invalid_passcode",
        actorRole: actorResult.data.role
      });
      return auth.response;
    }
    const actor = auth.actor;

    const result = await applyTaskUpdateAction({
      id,
      clinicId: clinic.clinicId,
      actor,
      body: bodyResult.data,
      onEscalationAlertError: (error, taskId) => {
        logError("escalation_notification_failed", error, { taskId });
      }
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if (result.task) {
      logInfo("task_updated", {
        taskId: id,
        action: result.action,
        actorRole: actor.role,
        nextStatus: result.nextStatus,
        status: result.task.status
      });
    }
    return NextResponse.json({ task: result.task ? sanitizeTaskForActor(result.task, actor.role) : result.task });
  } catch (error) {
    return dbError(error, { route: "tasks.update" });
  }
}
