import {
  getSql,
  type Actor,
  type CreateTaskInput,
  type TaskSource,
  type TaskStatus
} from "@central-vet/db";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createStatusForActor, sourceForActor } from "../../lib/taskWorkflow";

export const taskCreateSchema = z.object({
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

type TaskCreatePayload = z.infer<typeof taskCreateSchema>;

const staffCreateMaxPerHour = 15;
const duplicateWindow = "2 minutes";

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

function taskGuardContent(actor: Actor, task: TaskCreatePayload) {
  return {
    actorRole: actor.role,
    actorName: actor.name,
    clientName: task.clientName,
    clientPhone: task.clientPhone,
    petName: task.petName,
    requestType: task.requestType,
    request: task.request,
    dueDate: task.dueDate,
    dueTime: task.dueTime
  };
}

export function taskCreateInputForActor(args: {
  clinicId: string;
  hospitalName: string;
  actor: Actor;
  task: TaskCreatePayload;
}): CreateTaskInput {
  const assignedTo = args.task.assignedTo?.trim() || null;
  const source: TaskSource = sourceForActor(args.actor.role);
  const status: TaskStatus = createStatusForActor({
    role: args.actor.role,
    requestedStatus: args.task.status,
    assignedTo
  });

  return {
    ...args.task,
    clinicId: args.clinicId,
    hospitalName: args.hospitalName,
    assignedTo,
    source,
    status
  };
}

export async function internalTaskCreateGuard(args: {
  clinicId: string;
  request: Request;
  actor: Actor;
  task: TaskCreatePayload;
}) {
  const sql = getSql();
  const clientHash = clientKey(args.request, args.actor);
  const requestHash = contentHash(taskGuardContent(args.actor, args.task));
  const rows = await sql<{ client_count: number; duplicate_count: number }[]>`
    select
      (
        select count(*)::int
        from request_guard_events
        where clinic_id = ${args.clinicId}
          and client_key_hash = ${clientHash}
          and status = 'internal_staff_created'
          and created_at > now() - interval '1 hour'
      ) as client_count,
      (
        select count(*)::int
        from request_guard_events
        where clinic_id = ${args.clinicId}
          and content_hash = ${requestHash}
          and status like 'internal_%_created'
          and created_at > now() - ${sql.unsafe(`interval '${duplicateWindow}'`)}
      ) as duplicate_count
  `;
  const row = rows[0];
  if (args.actor.role === "staff" && (row?.client_count ?? 0) >= staffCreateMaxPerHour) {
    await sql`
      insert into request_guard_events (clinic_id, client_key_hash, content_hash, status)
      values (${args.clinicId}, ${clientHash}, ${requestHash}, 'internal_staff_rate_limited')
    `;
    return "Staff task limit reached. Ask an Admin or Veterinarian if this is urgent.";
  }
  if ((row?.duplicate_count ?? 0) > 0) {
    await sql`
      insert into request_guard_events (clinic_id, client_key_hash, content_hash, status)
      values (${args.clinicId}, ${clientHash}, ${requestHash}, 'internal_staff_duplicate')
    `;
    return "That task already looks submitted.";
  }
  await sql`
    insert into request_guard_events (clinic_id, client_key_hash, content_hash, status)
    values (${args.clinicId}, ${clientHash}, ${requestHash}, ${`internal_${args.actor.role}_created`})
  `;
  return null;
}
