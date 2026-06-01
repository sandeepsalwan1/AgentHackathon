import { getSql } from "./connection";
import type {
  Actor,
  AppRole,
  CreateTaskInput,
  Task,
  TaskEvent,
  TaskStatus,
  UpdateTaskInput
} from "./types";

type TaskRow = {
  id: string;
  hospital_name: string;
  status: TaskStatus;
  source: Task["source"];
  client_name: string | null;
  clarity_id: string | null;
  client_phone: string | null;
  client_date_of_birth: string | null;
  pet_name: string | null;
  pet_weight: string | null;
  last_visit: string | null;
  request: string;
  request_type: Task["requestType"];
  notes: string | null;
  assigned_to: string | null;
  assigned_by_role: AppRole | null;
  priority: Task["priority"];
  due_date: string;
  due_time: string;
  created_by_name: string | null;
  created_by_role: AppRole | null;
  updated_by_name: string | null;
  completed_by_name: string | null;
  completed_by_role: AppRole | null;
  completed_at: string | null;
  invalid_reason: string | null;
  archived_at: string | null;
  archived_by_name: string | null;
  archived_by_role: AppRole | null;
  escalated_at: string | null;
  escalated_by_name: string | null;
  escalated_by_role: AppRole | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  task_id: string;
  actor_name: string | null;
  actor_role: AppRole | null;
  event_type: string;
  previous_status: TaskStatus | null;
  next_status: TaskStatus | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function metadataRole(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return value === "staff" ||
    value === "va" ||
    value === "task_adder" ||
    value === "veterinarian" ||
    value === "admin"
    ? value
    : null;
}

function canManageRole(role: AppRole | undefined) {
  return role === "va" ||
    role === "task_adder" ||
    role === "veterinarian" ||
    role === "admin";
}

const taskColumns = `
  id,
  hospital_name,
  status,
  source,
  client_name,
  clarity_id,
  client_phone,
  client_date_of_birth,
  pet_name,
  pet_weight,
  last_visit,
  request,
  request_type,
  notes,
  assigned_to,
  assigned_by_role,
  priority,
  due_date,
  due_time,
  created_by_name,
  created_by_role,
  updated_by_name,
  completed_by_name,
  completed_by_role,
  completed_at,
  invalid_reason,
  archived_at,
  archived_by_name,
  archived_by_role,
  escalated_at,
  escalated_by_name,
  escalated_by_role,
  created_at,
  updated_at
`;

const eventColumns = `
  id,
  task_id,
  actor_name,
  actor_role,
  event_type,
  previous_status,
  next_status,
  metadata,
  created_at
`;

function formatDateText(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function formatDateOnlyText(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeTask(row: TaskRow): Task {
  return {
    id: row.id,
    hospitalName: row.hospital_name,
    status: row.status,
    source: row.source,
    clientName: row.client_name,
    clarityId: row.clarity_id,
    clientPhone: row.client_phone,
    clientDateOfBirth: row.client_date_of_birth ? formatDateOnlyText(row.client_date_of_birth) : null,
    petName: row.pet_name,
    petWeight: row.pet_weight,
    lastVisit: row.last_visit ? formatDateOnlyText(row.last_visit) : null,
    request: row.request,
    requestType: row.request_type,
    notes: row.notes,
    assignedTo: row.assigned_to,
    assignedByRole: row.assigned_by_role,
    priority: row.priority,
    dueDate: formatDateOnlyText(row.due_date)!,
    dueTime: row.due_time,
    createdByName: row.created_by_name,
    createdByRole: row.created_by_role,
    updatedByName: row.updated_by_name,
    completedByName: row.completed_by_name,
    completedByRole: row.completed_by_role,
    completedAt: row.completed_at ? formatDateText(row.completed_at) : null,
    invalidReason: row.invalid_reason,
    archivedAt: row.archived_at ? formatDateText(row.archived_at) : null,
    archivedByName: row.archived_by_name,
    archivedByRole: row.archived_by_role,
    escalatedAt: row.escalated_at ? formatDateText(row.escalated_at) : null,
    escalatedByName: row.escalated_by_name,
    escalatedByRole: row.escalated_by_role,
    createdAt: formatDateText(row.created_at)!,
    updatedAt: formatDateText(row.updated_at)!
  };
}

function normalizeEvent(row: EventRow): TaskEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    eventType: row.event_type,
    previousStatus: row.previous_status,
    nextStatus: row.next_status,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function dateOrNull(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function priorityOrDefault(value: unknown) {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

function requestTypeOrDefault(value: unknown) {
  return value === "prescription" ||
    value === "labs_xrays" ||
    value === "records_request" ||
    value === "scheduling" ||
    value === "patient_update"
    ? value
    : "labs_xrays";
}

function timeOrDefault(value: unknown) {
  const text = cleanText(value);
  if (!text) return "19:00";
  const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return match ? `${match[1]}:${match[2]}` : "19:00";
}

function toInsert(input: CreateTaskInput, actor: Actor) {
  return {
    hospital_name:
      input.hospitalName?.trim() ||
      process.env.HOSPITAL_NAME ||
      "Central Veterinary Hospital",
    status: input.status,
    source: input.source,
    client_name: cleanText(input.clientName),
    clarity_id: cleanText(input.clarityId),
    client_phone: cleanText(input.clientPhone),
    client_date_of_birth: dateOrNull(input.clientDateOfBirth),
    pet_name: cleanText(input.petName),
    pet_weight: cleanText(input.petWeight),
    last_visit: dateOrNull(input.lastVisit),
    request: input.request.trim(),
    request_type: requestTypeOrDefault(input.requestType),
    notes: cleanText(input.notes),
    assigned_to: cleanText(input.assignedTo),
    assigned_by_role: cleanText(input.assignedTo) ? actor.role : null,
    priority: priorityOrDefault(input.priority),
    due_date: input.dueDate || new Date().toISOString().slice(0, 10),
    due_time: timeOrDefault(input.dueTime),
    created_by_name: actor.name,
    created_by_role: actor.role,
    updated_by_name: actor.name,
    completed_by_name: input.status === "completed" ? actor.name : null,
    completed_by_role: input.status === "completed" ? actor.role : null,
    completed_at: input.status === "completed" ? new Date().toISOString() : null
  };
}

function toPatch(input: UpdateTaskInput, actor: Actor) {
  const patch: Record<string, string | null> = {
    updated_by_name: actor.name
  };
  if ("clientName" in input) patch.client_name = cleanText(input.clientName);
  if ("clarityId" in input) patch.clarity_id = cleanText(input.clarityId);
  if ("clientPhone" in input) patch.client_phone = cleanText(input.clientPhone);
  if ("clientDateOfBirth" in input) {
    patch.client_date_of_birth = dateOrNull(input.clientDateOfBirth);
  }
  if ("petName" in input) patch.pet_name = cleanText(input.petName);
  if ("petWeight" in input) patch.pet_weight = cleanText(input.petWeight);
  if ("lastVisit" in input) patch.last_visit = dateOrNull(input.lastVisit);
  if ("request" in input && input.request) patch.request = input.request.trim();
  if ("requestType" in input) patch.request_type = requestTypeOrDefault(input.requestType);
  if ("notes" in input) patch.notes = cleanText(input.notes);
  if ("assignedTo" in input) {
    patch.assigned_to = cleanText(input.assignedTo);
  }
  if ("priority" in input) patch.priority = priorityOrDefault(input.priority);
  if ("dueDate" in input && input.dueDate) patch.due_date = input.dueDate;
  if ("dueTime" in input) patch.due_time = timeOrDefault(input.dueTime);
  return patch;
}

async function logTaskEvent(args: {
  taskId: string;
  actor: Actor;
  eventType: string;
  previousStatus?: TaskStatus | null;
  nextStatus?: TaskStatus | null;
  metadata?: JsonObject;
}) {
  const sql = getSql();
  await sql`
    insert into task_events (
      task_id,
      actor_name,
      actor_role,
      event_type,
      previous_status,
      next_status,
      metadata
    )
    values (
      ${args.taskId},
      ${args.actor.name},
      ${args.actor.role}::app_role,
      ${args.eventType},
      ${args.previousStatus ?? null},
      ${args.nextStatus ?? null},
      ${sql.json(args.metadata ?? {})}
    )
  `;
}

export async function listTasks(options?: {
  role?: AppRole;
  includeArchived?: boolean;
}) {
  const sql = getSql();
  const includeArchived =
    options?.includeArchived && canManageRole(options.role);

  const rows = includeArchived
    ? await sql<TaskRow[]>`
        select ${sql.unsafe(taskColumns)} from tasks
        order by
          case when status = 'archived' then 1 else 0 end,
          due_date asc,
          case
            when source = 'task_adder' then 0
            when source = 'va' then 0
            when source = 'admin' then 1
            when source = 'veterinarian' then 2
            when source = 'staff_request' then 3
            else 3
          end,
          due_time asc,
          created_at asc
      `
    : options?.role === "staff"
      ? await sql<TaskRow[]>`
          select ${sql.unsafe(taskColumns)} from tasks
          where archived_at is null
            and status <> 'archived'
            and status <> 'pending_review'
            and status <> 'invalid'
          order by
            due_date asc,
            case
              when source = 'task_adder' then 0
              when source = 'va' then 0
              when source = 'admin' then 1
              when source = 'veterinarian' then 2
              when source = 'staff_request' then 3
              else 3
            end,
            due_time asc,
            created_at asc
        `
      : await sql<TaskRow[]>`
          select ${sql.unsafe(taskColumns)} from tasks
          where archived_at is null
            and status <> 'archived'
          order by
            due_date asc,
            case
              when source = 'task_adder' then 0
              when source = 'va' then 0
              when source = 'admin' then 1
              when source = 'veterinarian' then 2
              when source = 'staff_request' then 3
              else 3
            end,
            due_time asc,
            created_at asc
        `;

  return rows.map(normalizeTask);
}

export async function getTask(id: string) {
  const sql = getSql();
  const rows = await sql<TaskRow[]>`
    select ${sql.unsafe(taskColumns)}
    from tasks
    where id = ${id}
  `;
  return rows[0] ? normalizeTask(rows[0]) : null;
}

export async function createTask(input: CreateTaskInput, actor: Actor) {
  const sql = getSql();
  const row = toInsert(input, actor);
  const rows = await sql<TaskRow[]>`
    insert into tasks ${sql(row)}
    returning ${sql.unsafe(taskColumns)}
  `;
  const task = normalizeTask(rows[0]);
  await logTaskEvent({
    taskId: task.id,
    actor,
    eventType:
      input.source === "client_form" ? "client_request_created" : "created",
    previousStatus: null,
    nextStatus: task.status,
    metadata: { source: input.source }
  });
  return task;
}

export async function editTask(id: string, input: UpdateTaskInput, actor: Actor) {
  const sql = getSql();
  const patch = toPatch(input, actor);
  const rows = await sql<TaskRow[]>`
    update tasks
    set ${sql(patch)}, updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(taskColumns)}
  `;
  let task = rows[0] ? normalizeTask(rows[0]) : null;
  if (task && "assignedTo" in input) {
    const assignedRole = cleanText(input.assignedTo) ? actor.role : null;
    const assignedRows = await sql<TaskRow[]>`
      update tasks
      set assigned_by_role = ${assignedRole}::app_role
      where id = ${id}
      returning ${sql.unsafe(taskColumns)}
    `;
    task = assignedRows[0] ? normalizeTask(assignedRows[0]) : task;
  }
  if (task) {
    await logTaskEvent({
      taskId: id,
      actor,
      eventType: "edited",
      previousStatus: task.status,
      nextStatus: task.status,
      metadata: { fields: Object.keys(patch).filter((key) => key !== "updated_by_name") }
    });
  }
  return task;
}

export async function transitionTask(args: {
  id: string;
  nextStatus: TaskStatus;
  actor: Actor;
  invalidReason?: string | null;
}) {
  const sql = getSql();
  const previous = await getTask(args.id);
  if (!previous) return null;

  const rows =
    args.nextStatus === "completed"
      ? await sql<TaskRow[]>`
          update tasks
          set status = ${args.nextStatus},
            updated_by_name = ${args.actor.name},
            assigned_to = null,
            assigned_by_role = null,
            completed_by_name = ${args.actor.name},
            completed_by_role = ${args.actor.role}::app_role,
            completed_at = now(),
            invalid_reason = null,
            archived_at = null,
            archived_by_name = null,
            archived_by_role = null,
            updated_at = now()
          where id = ${args.id}
          returning ${sql.unsafe(taskColumns)}
        `
      : args.nextStatus === "invalid"
        ? await sql<TaskRow[]>`
            update tasks
            set status = ${args.nextStatus},
              updated_by_name = ${args.actor.name},
              assigned_to = null,
              assigned_by_role = null,
              completed_by_name = null,
              completed_by_role = null,
              completed_at = null,
              invalid_reason = ${cleanText(args.invalidReason) || "Marked invalid"},
              archived_at = null,
              archived_by_name = null,
              archived_by_role = null,
              updated_at = now()
            where id = ${args.id}
            returning ${sql.unsafe(taskColumns)}
          `
        : args.nextStatus === "archived"
          ? await sql<TaskRow[]>`
              update tasks
              set status = ${args.nextStatus},
                updated_by_name = ${args.actor.name},
                assigned_to = null,
                assigned_by_role = null,
                invalid_reason = ${cleanText(args.invalidReason)},
                archived_at = now(),
                archived_by_name = ${args.actor.name},
                archived_by_role = ${args.actor.role}::app_role,
                updated_at = now()
              where id = ${args.id}
              returning ${sql.unsafe(taskColumns)}
            `
          : await sql<TaskRow[]>`
              update tasks
              set status = ${args.nextStatus},
                updated_by_name = ${args.actor.name},
                assigned_to = case when ${args.nextStatus} = 'pending' then ${args.actor.name} else null end,
                assigned_by_role = case when ${args.nextStatus} = 'pending' then ${args.actor.role}::app_role else null end,
                completed_by_name = null,
                completed_by_role = null,
                completed_at = null,
                invalid_reason = null,
                archived_at = null,
                archived_by_name = null,
                archived_by_role = null,
                updated_at = now()
              where id = ${args.id}
              returning ${sql.unsafe(taskColumns)}
            `;
  const task = rows[0] ? normalizeTask(rows[0]) : null;
  if (!task) return null;

  const eventType =
    args.nextStatus === "completed"
      ? "completed"
      : args.nextStatus === "invalid"
        ? "marked_invalid"
        : args.nextStatus === "archived"
          ? cleanText(args.invalidReason)
            ? "marked_invalid"
            : "archived"
          : previous.status === "archived"
            ? "restored"
            : "status_changed";
  const metadata: JsonObject = {};
  const invalidReason = cleanText(args.invalidReason);
  if (invalidReason) metadata.invalidReason = invalidReason;
  if (previous.status === "pending") {
    metadata.previousAssignedTo = previous.assignedTo;
    metadata.previousAssignedByRole = previous.assignedByRole;
  }
  if (args.nextStatus === "pending") {
    metadata.assignedTo = args.actor.name;
    metadata.assignedByRole = args.actor.role;
  }

  await logTaskEvent({
    taskId: args.id,
    actor: args.actor,
    eventType,
    previousStatus: previous.status,
    nextStatus: args.nextStatus,
    metadata
  });
  return task;
}

export async function archiveCompletedTasksBefore(
  localDate: string,
  actor: Actor,
  timeZone = "America/Los_Angeles"
) {
  const sql = getSql();
  const rows = await sql<TaskRow[]>`
    update tasks
    set status = 'archived',
      updated_by_name = ${actor.name},
      assigned_to = null,
      assigned_by_role = null,
      archived_at = now(),
      archived_by_name = ${actor.name},
      archived_by_role = ${actor.role}::app_role,
      updated_at = now()
    where archived_at is null
      and status = 'completed'
      and completed_at is not null
      and (completed_at at time zone ${timeZone})::date < ${localDate}::date
    returning ${sql.unsafe(taskColumns)}
  `;
  const tasks = rows.map(normalizeTask);
  for (const task of tasks) {
    await logTaskEvent({
      taskId: task.id,
      actor,
      eventType: "auto_archived",
      previousStatus: "completed",
      nextStatus: "archived",
      metadata: {
        reason: "completed_before_today",
        localDate
      }
    });
  }
  return tasks;
}

export async function escalateTask(taskId: string, actor: Actor) {
  const sql = getSql();
  const previous = await getTask(taskId);
  if (!previous) return null;

  const rows = await sql<TaskRow[]>`
    update tasks
    set escalated_at = coalesce(escalated_at, now()),
      escalated_by_name = coalesce(escalated_by_name, ${actor.name}),
      escalated_by_role = coalesce(escalated_by_role, ${actor.role}::app_role),
      updated_by_name = ${actor.name},
      updated_at = now()
    where id = ${taskId}
    returning ${sql.unsafe(taskColumns)}
  `;
  const task = rows[0] ? normalizeTask(rows[0]) : null;
  if (task) {
    await logTaskEvent({
      taskId,
      actor,
      eventType: previous.escalatedAt ? "escalation_seen" : "escalated",
      previousStatus: previous.status,
      nextStatus: task.status,
      metadata: {
        requestType: task.requestType,
        alreadyEscalated: Boolean(previous.escalatedAt)
      }
    });
  }
  return task;
}

export async function undoLastStatusChange(taskId: string, actor: Actor) {
  const sql = getSql();
  const events = await sql<EventRow[]>`
    select ${sql.unsafe(eventColumns)} from task_events
    where task_id = ${taskId}
      and previous_status is not null
      and next_status is not null
      and event_type <> 'undo'
    order by created_at desc
    limit 1
  `;
  const event = events[0];
  if (!event?.previous_status) return null;

  const restored = event.previous_status;
  const restoredAssignedTo = metadataText(event.metadata, "previousAssignedTo");
  const restoredAssignedByRole = metadataRole(event.metadata, "previousAssignedByRole");
  const rows = await sql<TaskRow[]>`
    update tasks
    set
      status = ${restored},
      updated_by_name = ${actor.name},
      assigned_to = case when ${restored} = 'pending' then ${restoredAssignedTo} else null end,
      assigned_by_role = case when ${restored} = 'pending' then ${restoredAssignedByRole}::app_role else null end,
      completed_by_name = case when ${restored} = 'completed' then completed_by_name else null end,
      completed_by_role = case when ${restored} = 'completed' then completed_by_role else null end,
      completed_at = case when ${restored} = 'completed' then completed_at else null end,
      invalid_reason = case when ${restored} = 'invalid' then invalid_reason else null end,
      archived_at = case when ${restored} = 'archived' then archived_at else null end,
      archived_by_name = case when ${restored} = 'archived' then archived_by_name else null end,
      archived_by_role = case when ${restored} = 'archived' then archived_by_role else null end,
      updated_at = now()
    where id = ${taskId}
    returning ${sql.unsafe(taskColumns)}
  `;
  const task = rows[0] ? normalizeTask(rows[0]) : null;
  if (task) {
    await logTaskEvent({
      taskId,
      actor,
      eventType: "undo",
      previousStatus: event.next_status,
      nextStatus: restored,
      metadata: { undoneEventId: event.id }
    });
  }
  return task;
}

export async function renameActorReferences(args: {
  actor: Actor;
  oldName: string;
  newName: string;
}) {
  const oldName = cleanText(args.oldName);
  const newName = cleanText(args.newName);
  if (!oldName || !newName || oldName === newName) {
    return { tasksUpdated: 0, eventsUpdated: 0 };
  }

  const sql = getSql();
  const role = args.actor.role;
  const taskRows = await sql<{ id: string }[]>`
    update tasks
    set
      assigned_to = case
        when assigned_by_role = ${role}::app_role and assigned_to = ${oldName} then ${newName}
        else assigned_to
      end,
      created_by_name = case
        when created_by_role = ${role}::app_role and created_by_name = ${oldName} then ${newName}
        else created_by_name
      end,
      completed_by_name = case
        when completed_by_role = ${role}::app_role and completed_by_name = ${oldName} then ${newName}
        else completed_by_name
      end,
      archived_by_name = case
        when archived_by_role = ${role}::app_role and archived_by_name = ${oldName} then ${newName}
        else archived_by_name
      end,
      escalated_by_name = case
        when escalated_by_role = ${role}::app_role and escalated_by_name = ${oldName} then ${newName}
        else escalated_by_name
      end,
      updated_at = now()
    where (assigned_by_role = ${role}::app_role and assigned_to = ${oldName})
      or (created_by_role = ${role}::app_role and created_by_name = ${oldName})
      or (completed_by_role = ${role}::app_role and completed_by_name = ${oldName})
      or (archived_by_role = ${role}::app_role and archived_by_name = ${oldName})
      or (escalated_by_role = ${role}::app_role and escalated_by_name = ${oldName})
    returning id
  `;

  const eventRows = await sql<{ id: string }[]>`
    update task_events
    set
      actor_name = case
        when actor_role = ${role}::app_role and actor_name = ${oldName} then ${newName}
        else actor_name
      end,
      metadata = case
        when metadata->>'previousAssignedByRole' = ${role}::text
          and metadata->>'previousAssignedTo' = ${oldName}
          and metadata->>'assignedByRole' = ${role}::text
          and metadata->>'assignedTo' = ${oldName}
          then metadata || jsonb_build_object('previousAssignedTo', ${newName}::text, 'assignedTo', ${newName}::text)
        when metadata->>'previousAssignedByRole' = ${role}::text
          and metadata->>'previousAssignedTo' = ${oldName}
          then metadata || jsonb_build_object('previousAssignedTo', ${newName}::text)
        when metadata->>'assignedByRole' = ${role}::text
          and metadata->>'assignedTo' = ${oldName}
          then metadata || jsonb_build_object('assignedTo', ${newName}::text)
        else metadata
      end
    where (actor_role = ${role}::app_role and actor_name = ${oldName})
      or (metadata->>'previousAssignedByRole' = ${role}::text and metadata->>'previousAssignedTo' = ${oldName})
      or (metadata->>'assignedByRole' = ${role}::text and metadata->>'assignedTo' = ${oldName})
    returning id
  `;

  return {
    tasksUpdated: taskRows.length,
    eventsUpdated: eventRows.length
  };
}

export async function listTaskEvents(limit = 60) {
  const sql = getSql();
  const rows = await sql<EventRow[]>`
    select ${sql.unsafe(eventColumns)} from task_events
    order by created_at desc
    limit ${limit}
  `;
  return rows.map(normalizeEvent);
}

export async function listOverdueTasks(localDate: string) {
  const sql = getSql();
  const rows = await sql<TaskRow[]>`
    select ${sql.unsafe(taskColumns)} from tasks
    where archived_at is null
      and status in ('pending_review', 'due', 'pending')
      and due_date < ${localDate}
    order by due_date asc, due_time asc, created_at asc
  `;
  return rows.map(normalizeTask);
}

export async function listIncompletePriorityTasks(localDate: string) {
  const sql = getSql();
  const rows = await sql<TaskRow[]>`
    select ${sql.unsafe(taskColumns)} from tasks
    where archived_at is null
      and status in ('pending_review', 'due', 'pending')
      and priority in ('medium', 'high')
      and due_date <= ${localDate}
    order by
      case when priority = 'high' then 0 else 1 end,
      due_date asc,
      due_time asc,
      created_at asc
  `;
  return rows.map(normalizeTask);
}
