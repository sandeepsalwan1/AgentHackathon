import {
  archiveCompletedTasksBefore,
  createTask,
  listTasks
} from "@central-vet/db";
import { NextResponse } from "next/server";
import {
  authenticateActor,
  authenticateActorFromQuery,
  actorSchema,
  dbError,
  logInfo,
  logWarn,
  noStoreHeaders,
  resolveClinicFromRequest,
  sanitizeTaskForActor
} from "../_shared";
import {
  internalTaskCreateGuard,
  taskCreateInputForActor,
  taskCreateSchema
} from "./_taskCreateRequest";

const systemActor = { name: "System", role: "admin" as const };

function localDateString(
  timeZone = process.env.APP_TIME_ZONE || process.env.TZ || "America/Los_Angeles"
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

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
    await archiveCompletedTasksBefore(
      localDateString(),
      systemActor,
      clinic.timeZone || process.env.APP_TIME_ZONE || process.env.TZ || "America/Los_Angeles",
      { clinicId: clinic.clinicId }
    );
    const tasks = await listTasks({
      clinicId: clinic.clinicId,
      role: actor.role,
      includeArchived
    });
    return NextResponse.json(
      {
        tasks: tasks.map((task) => sanitizeTaskForActor(task, actor.role))
      },
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
