import {
  createTask,
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, logInfo, logWarn, noStoreHeaders } from "../_apiResponse";
import {
  authenticateActor,
  authenticateActorFromQuery,
  actorSchema,
  resolveClinicFromRequest
} from "../_shared";
import {
  internalTaskCreateGuard,
  taskCreateInputForActor,
  taskCreateSchema
} from "./_taskCreateRequest";
import { taskListPayload } from "./_taskListRequest";
import { sanitizeTaskForActor } from "./_taskVisibility";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActorFromQuery(url, request, clinic);
    if ("response" in auth) {
      logWarn("tasks_list_rejected", { reason: "invalid_actor" });
      return auth.response;
    }
    const actor = auth.actor;

    const includeArchived = url.searchParams.get("includeArchived") === "true";
    return NextResponse.json(
      await taskListPayload({ actor, clinic, includeArchived }),
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return dbError(error, { route: "tasks.list" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actorResult = actorSchema.safeParse(body.actor);
    const taskResult = taskCreateSchema.safeParse(body.task);
    const clinic = await resolveClinicFromRequest(request);

    if (!actorResult.success || !taskResult.success) {
      logWarn("task_create_rejected", { reason: "invalid_payload" });
      return NextResponse.json({ error: "Invalid task request." }, { status: 400 });
    }

    const auth = await authenticateActor(actorResult.data, request, clinic);
    if ("response" in auth) {
      logWarn("task_create_rejected", {
        reason: "invalid_passcode",
        actorRole: actorResult.data.role
      });
      return auth.response;
    }
    const actor = auth.actor;
    if (actor.role === "staff" && actor.name.trim().length < 2) {
      return NextResponse.json({ error: "Enter your real name." }, { status: 400 });
    }

    const input = taskCreateInputForActor({
      clinicId: clinic.clinicId,
      hospitalName: clinic.name,
      actor,
      task: taskResult.data
    });

    const guardError = await internalTaskCreateGuard({
      clinicId: clinic.clinicId,
      request,
      actor,
      task: taskResult.data
    });
    if (guardError) {
      logWarn("task_create_rejected", {
        reason: "internal_guard",
        actorRole: actor.role
      });
      return NextResponse.json({ error: guardError }, { status: 429 });
    }

    const task = await createTask(input, actor);
    logInfo("task_created", {
      taskId: task.id,
      actorRole: actor.role,
      source: task.source,
      status: task.status,
      priority: task.priority
    });
    return NextResponse.json({ task: sanitizeTaskForActor(task, actor.role) }, { status: 201 });
  } catch (error) {
    return dbError(error, { route: "tasks.create" });
  }
}
