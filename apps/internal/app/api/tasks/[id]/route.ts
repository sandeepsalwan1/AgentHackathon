import {
  editTask,
  escalateTask,
  getTask,
  transitionTask,
  type UpdateTaskInput
} from "@central-vet/db";
import { sendEscalationAlert } from "@central-vet/notifications";
import { NextResponse } from "next/server";
import { z } from "zod";
import { persistedStatusForRequest, validateTaskAction } from "../../../lib/taskWorkflow";
import {
  authenticateActor,
  actorSchema,
  dbError,
  logError,
  logInfo,
  logWarn,
  sanitizeTaskForActor
} from "../../_shared";

const editableSchema = z.object({
  clientName: z.string().trim().min(1).max(120).optional(),
  clarityId: z.string().trim().max(120).optional().nullable(),
  clientPhone: z.string().trim().min(7).max(80).optional().nullable(),
  clientDateOfBirth: z.string().trim().optional().nullable(),
  petName: z.string().trim().min(1).max(120).optional(),
  petWeight: z.string().trim().max(80).optional().nullable(),
  lastVisit: z.string().optional().nullable(),
  request: z.string().trim().min(10).max(4000).optional(),
  requestType: z
    .enum(["prescription", "labs_xrays", "records_request", "scheduling", "patient_update"])
    .optional()
    .nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  assignedTo: z.string().trim().max(120).optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable()
});

const bodySchema = z.object({
  actor: actorSchema,
  action: z.enum(["edit", "status", "archive", "restore", "escalate"]),
  task: editableSchema.optional(),
  nextStatus: z
    .enum(["pending_review", "due", "pending", "completed", "invalid", "archived"])
    .optional(),
  invalidReason: z.string().trim().max(500).optional().nullable()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) {
      logWarn("task_update_rejected", { reason: "invalid_payload" });
      return NextResponse.json({ error: "Invalid task update." }, { status: 400 });
    }

    const { id } = await context.params;
    const auth = await authenticateActor(body.data.actor, request);
    if ("response" in auth) {
      logWarn("task_update_rejected", {
        taskId: id,
        reason: "invalid_passcode",
        actorRole: body.data.actor.role
      });
      return auth.response;
    }
    const actor = auth.actor;

    if (body.data.action === "edit") {
      const currentTask = await getTask(id);
      if (!currentTask) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      const workflowError = validateTaskAction({
        action: "edit",
        actorRole: actor.role,
        currentTask
      });
      if (workflowError) {
        return NextResponse.json({ error: workflowError.error }, { status: workflowError.status });
      }
      const task = await editTask(
        id,
        (body.data.task ?? {}) as UpdateTaskInput,
        actor
      );
      if (task) {
        logInfo("task_updated", {
          taskId: id,
          action: "edit",
          actorRole: actor.role,
          status: task.status
        });
      }
      return NextResponse.json({ task: task ? sanitizeTaskForActor(task, actor.role) : task });
    }

    if (body.data.action === "archive") {
      const currentTask = await getTask(id);
      if (!currentTask) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      const workflowError = validateTaskAction({
        action: "archive",
        actorRole: actor.role,
        currentTask
      });
      if (workflowError) {
        return NextResponse.json({ error: workflowError.error }, { status: workflowError.status });
      }
      const task = await transitionTask({
        id,
        nextStatus: "archived",
        actor
      });
      if (task) {
        logInfo("task_updated", {
          taskId: id,
          action: "archive",
          actorRole: actor.role,
          status: task.status
        });
      }
      return NextResponse.json({ task: task ? sanitizeTaskForActor(task, actor.role) : task });
    }

    if (body.data.action === "escalate") {
      const currentTask = await getTask(id);
      if (!currentTask) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      const workflowError = validateTaskAction({
        action: "escalate",
        actorRole: actor.role,
        currentTask
      });
      if (workflowError) {
        return NextResponse.json({ error: workflowError.error }, { status: workflowError.status });
      }
      const task = await escalateTask(id, actor);
      if (task) {
        logInfo("task_updated", {
          taskId: id,
          action: "escalate",
          actorRole: actor.role,
          status: task.status
        });
        await sendEscalationAlert(task).catch((error) => {
          logError("escalation_notification_failed", error, { taskId: task.id });
        });
      }
      return NextResponse.json({ task: task ? sanitizeTaskForActor(task, actor.role) : task });
    }

    if (body.data.action === "restore") {
      const currentTask = await getTask(id);
      if (!currentTask) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      const workflowError = validateTaskAction({
        action: "restore",
        actorRole: actor.role,
        currentTask
      });
      if (workflowError) {
        return NextResponse.json({ error: workflowError.error }, { status: workflowError.status });
      }
      const task = await transitionTask({
        id,
        nextStatus: "due",
        actor
      });
      if (task) {
        logInfo("task_updated", {
          taskId: id,
          action: "restore",
          actorRole: actor.role,
          status: task.status
        });
      }
      return NextResponse.json({ task: task ? sanitizeTaskForActor(task, actor.role) : task });
    }

    const nextStatus = body.data.nextStatus;
    if (!nextStatus) {
      return NextResponse.json({ error: "Missing next status." }, { status: 400 });
    }

    const currentTask = await getTask(id);
    if (!currentTask) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const workflowError = validateTaskAction({
      action: "status",
      actorRole: actor.role,
      currentTask,
      nextStatus
    });
    if (workflowError) {
      return NextResponse.json({ error: workflowError.error }, { status: workflowError.status });
    }

    const task = await transitionTask({
      id,
      nextStatus: persistedStatusForRequest(nextStatus),
      actor,
      invalidReason: body.data.invalidReason
    });
    if (task) {
      logInfo("task_updated", {
        taskId: id,
        action: "status",
        actorRole: actor.role,
        nextStatus,
        status: task.status
      });
    }
    return NextResponse.json({ task: task ? sanitizeTaskForActor(task, actor.role) : task });
  } catch (error) {
    return dbError(error, { route: "tasks.update" });
  }
}
