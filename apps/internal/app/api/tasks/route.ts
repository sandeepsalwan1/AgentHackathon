import {
  auditRecordsTransfer,
  buildRecordsTransferPacket
} from "@central-vet/agents";
import {
  archiveCompletedTasksBefore,
  createTask,
  getSql,
  listTasks,
  recordTaskEvent,
  type Actor,
  type CreateTaskInput,
  type TaskSource,
  type TaskStatus
} from "@central-vet/db";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createStatusForActor, sourceForActor } from "../../lib/taskWorkflow";
import {
  authenticateActor,
  authenticateActorFromQuery,
  actorSchema,
  dbError,
  logInfo,
  logWarn,
  noStoreHeaders,
  sanitizeTaskForActor
} from "../_shared";

const taskSchema = z.object({
  status: z
    .enum(["pending_review", "due", "pending", "completed", "invalid"])
    .default("pending_review"),
  clientName: z.string().trim().min(1).max(120),
  clarityId: z.string().trim().max(120).optional().nullable(),
  clientPhone: z.string().trim().min(7).max(80),
  clientDateOfBirth: z.string().trim().optional().nullable(),
  petName: z.string().trim().min(1).max(120),
  petWeight: z.string().trim().max(80).optional().nullable(),
  lastVisit: z.string().optional().nullable(),
  request: z.string().trim().min(10).max(4000),
  requestType: z
    .enum(["prescription", "labs_xrays", "records_request", "scheduling", "patient_update"])
    .default("labs_xrays"),
  notes: z.string().trim().max(4000).optional().nullable(),
  assignedTo: z.string().trim().max(120).optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable()
});

const staffCreateMaxPerHour = 15;
const duplicateWindow = "2 minutes";
const systemActor = { name: "System", role: "admin" as const };

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function clientKey(request: Request, actor: Actor) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return hashValue(
    [
      "internal",
      actor.role,
      actor.name.toLowerCase().trim(),
      ip,
      request.headers.get("user-agent") || "unknown"
    ].join("|")
  );
}

function contentHash(value: unknown) {
  return hashValue(JSON.stringify(value).toLowerCase().replace(/\s+/g, " ").trim());
}

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

function priorityForAudit(
  auditStatus: "approved" | "flagged" | "blocked" | null | undefined,
  requestedPriority: "low" | "medium" | "high"
) {
  if (auditStatus === "blocked") return "high";
  if (auditStatus === "flagged" && requestedPriority === "low") return "medium";
  return requestedPriority;
}

async function internalCreateGuard(args: {
  request: Request;
  actor: Actor;
  task: z.infer<typeof taskSchema>;
}) {
  const sql = getSql();
  const clientHash = clientKey(args.request, args.actor);
  const requestHash = contentHash({
    actorRole: args.actor.role,
    actorName: args.actor.name,
    clientName: args.task.clientName,
    clientPhone: args.task.clientPhone,
    petName: args.task.petName,
    requestType: args.task.requestType,
    request: args.task.request,
    dueDate: args.task.dueDate,
    dueTime: args.task.dueTime
  });
  const rows = await sql<{ client_count: number; duplicate_count: number }[]>`
    select
      (
        select count(*)::int
        from request_guard_events
        where client_key_hash = ${clientHash}
          and status = 'internal_staff_created'
          and created_at > now() - interval '1 hour'
      ) as client_count,
      (
        select count(*)::int
        from request_guard_events
        where content_hash = ${requestHash}
          and status like 'internal_%_created'
          and created_at > now() - ${sql.unsafe(`interval '${duplicateWindow}'`)}
      ) as duplicate_count
  `;
  const row = rows[0];
  if (args.actor.role === "staff" && (row?.client_count ?? 0) >= staffCreateMaxPerHour) {
    await sql`
      insert into request_guard_events (client_key_hash, content_hash, status)
      values (${clientHash}, ${requestHash}, 'internal_staff_rate_limited')
    `;
    return "Staff task limit reached. Ask an Admin or Veterinarian if this is urgent.";
  }
  if ((row?.duplicate_count ?? 0) > 0) {
    await sql`
      insert into request_guard_events (client_key_hash, content_hash, status)
      values (${clientHash}, ${requestHash}, 'internal_staff_duplicate')
    `;
    return "That task already looks submitted.";
  }
  await sql`
    insert into request_guard_events (client_key_hash, content_hash, status)
    values (${clientHash}, ${requestHash}, ${`internal_${args.actor.role}_created`})
  `;
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const auth = await authenticateActorFromQuery(url, request);
    if ("response" in auth) {
      logWarn("tasks_list_rejected", { reason: "invalid_actor" });
      return auth.response;
    }
    const actor = auth.actor;

    const includeArchived = url.searchParams.get("includeArchived") === "true";
    await archiveCompletedTasksBefore(
      localDateString(),
      systemActor,
      process.env.APP_TIME_ZONE || process.env.TZ || "America/Los_Angeles"
    );
    const tasks = await listTasks({ role: actor.role, includeArchived });
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
    const taskResult = taskSchema.safeParse(body.task);

    if (!actorResult.success || !taskResult.success) {
      logWarn("task_create_rejected", { reason: "invalid_payload" });
      return NextResponse.json({ error: "Invalid task request." }, { status: 400 });
    }

    const auth = await authenticateActor(actorResult.data, request);
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

    const assignedTo = taskResult.data.assignedTo?.trim() || null;
    const source: TaskSource = sourceForActor(actor.role);
    const status: TaskStatus = createStatusForActor({
      role: actor.role,
      requestedStatus: taskResult.data.status,
      assignedTo
    });

    const opseraAudit =
      taskResult.data.requestType === "records_request"
        ? await auditRecordsTransfer(
            buildRecordsTransferPacket({
              clientName: taskResult.data.clientName,
              clientPhone: taskResult.data.clientPhone,
              clientDateOfBirth: taskResult.data.clientDateOfBirth,
              clientId: taskResult.data.clarityId,
              petName: taskResult.data.petName,
              petWeight: taskResult.data.petWeight,
              lastVisit: taskResult.data.lastVisit,
              request: taskResult.data.request,
              requestedBy: actor.name,
              metadata: {
                source,
                actorRole: actor.role,
                requestedStatus: status
              }
            })
          )
        : null;

    const input: CreateTaskInput = {
      ...taskResult.data,
      assignedTo,
      source,
      status,
      priority: priorityForAudit(opseraAudit?.status, taskResult.data.priority),
      opseraAuditStatus: opseraAudit?.status ?? null,
      opseraAuditReason: opseraAudit?.reason ?? null,
      opseraAuditId: opseraAudit?.auditId ?? null,
      opseraAuditCheckedAt: opseraAudit?.checkedAt ?? null
    };

    const guardError = await internalCreateGuard({
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
    if (opseraAudit) {
      await recordTaskEvent({
        taskId: task.id,
        actor,
        eventType: "opsera_records_audit",
        previousStatus: null,
        nextStatus: task.status,
        metadata: {
          opseraStatus: opseraAudit.status,
          opseraReason: opseraAudit.reason,
          opseraAuditId: opseraAudit.auditId,
          opseraSource: opseraAudit.source
        }
      });
      logInfo("opsera_records_audit", {
        taskId: task.id,
        actorRole: actor.role,
        status: opseraAudit.status
      });
    }
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
