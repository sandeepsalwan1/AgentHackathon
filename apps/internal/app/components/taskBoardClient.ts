import type {
  ArrivalDeskSnapshot,
  ArrivalQuestionnaire,
  RecipientProfile,
  RoomState,
  Task,
  TaskEvent,
  TaskStatus
} from "@central-vet/db";
import { canManage } from "../lib/taskWorkflow";
import type { TaskFormState } from "./TaskForm";
import type { TaskBoardSession } from "./taskBoardTypes";

type TaskBoardSettingsPayload = {
  priorityAlertsEnabled: boolean;
  recipientProfiles: RecipientProfile[];
  canEditAllProfiles: boolean;
  currentProfileId: string | null;
};

type TaskBoardSettingsResponse = Partial<TaskBoardSettingsPayload>;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || data.detail || "Request failed.", response.status);
  }
  return data;
}

export function isAuthError(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 429);
}

export function sessionReadHeaders(currentSession: TaskBoardSession) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (currentSession.passcode) {
    headers["X-Central-Vet-Passcode"] = currentSession.passcode;
  }
  return headers;
}

function taskBoardSettingsPayload(data: TaskBoardSettingsResponse): TaskBoardSettingsPayload {
  return {
    priorityAlertsEnabled: Boolean(data.priorityAlertsEnabled),
    recipientProfiles: data.recipientProfiles ?? [],
    canEditAllProfiles: Boolean(data.canEditAllProfiles),
    currentProfileId: data.currentProfileId ?? null
  };
}

export async function readTaskBoardSnapshot(currentSession: TaskBoardSession, actorQuery: string) {
  const fetchOptions: RequestInit = {
    cache: "no-store",
    headers: sessionReadHeaders(currentSession)
  };
  const taskRequest = fetch(`/api/tasks?${actorQuery}`, fetchOptions).then(readJson);
  const eventRequest = canManage(currentSession.role)
    ? fetch(`/api/events?${actorQuery}`, fetchOptions).then(readJson)
    : Promise.resolve({ events: [] });
  const [taskData, eventData] = await Promise.all([
    taskRequest as Promise<{ tasks: Task[] }>,
    eventRequest as Promise<{ events: TaskEvent[] }>
  ]);
  return {
    tasks: taskData.tasks,
    events: eventData.events
  };
}

export async function readTaskBoardSettings(
  currentSession: TaskBoardSession,
  actorQuery: string
): Promise<TaskBoardSettingsPayload> {
  const data = await readJson(
    await fetch(`/api/settings?${actorQuery}`, {
      cache: "no-store",
      headers: sessionReadHeaders(currentSession)
    })
  );
  return taskBoardSettingsPayload(data);
}

export async function readArrivalDeskSnapshot(currentSession: TaskBoardSession, actorQuery: string): Promise<ArrivalDeskSnapshot> {
  return readJson(
    await fetch(`/api/arrival-intake?${actorQuery}`, {
      cache: "no-store",
      headers: sessionReadHeaders(currentSession)
    })
  );
}

export async function updateArrivalRoomState(
  currentSession: TaskBoardSession,
  roomId: string,
  state: RoomState
) {
  return readJson(
    await fetch("/api/arrival-intake", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "room",
        actor: currentSession,
        roomId,
        state
      })
    })
  );
}

export async function checkoutArrivalRoomState(
  currentSession: TaskBoardSession,
  arrivalId: string
) {
  return readJson(
    await fetch("/api/arrival-intake", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "checkout",
        actor: currentSession,
        arrivalId
      })
    })
  );
}

export async function saveArrivalDeskSettings(
  currentSession: TaskBoardSession,
  roomAssignmentEnabled: boolean,
  questionnaire: ArrivalQuestionnaire
) {
  return readJson(
    await fetch("/api/arrival-intake", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "settings",
        actor: currentSession,
        roomAssignmentEnabled,
        questionnaire
      })
    })
  );
}

export async function updateTaskBoardProfileName(currentSession: TaskBoardSession, name: string) {
  return readJson(
    await fetch("/api/profile-name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: currentSession,
        name
      })
    })
  );
}

export async function saveTaskBoardForm(args: {
  currentSession: TaskBoardSession;
  form: TaskFormState;
  editingTaskId?: string | null;
}) {
  const body = args.editingTaskId
    ? {
        actor: args.currentSession,
        action: "edit",
        task: args.form
      }
    : {
        actor: args.currentSession,
        task: args.form
      };
  return readJson(
    await fetch(args.editingTaskId ? `/api/tasks/${args.editingTaskId}` : "/api/tasks", {
      method: args.editingTaskId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

export async function updateTaskBoardStatus(args: {
  currentSession: TaskBoardSession;
  taskId: string;
  nextStatus: TaskStatus;
  invalidReason?: string;
}) {
  return readJson(
    await fetch(`/api/tasks/${args.taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: args.currentSession,
        action: "status",
        nextStatus: args.nextStatus,
        invalidReason: args.invalidReason
      })
    })
  );
}

export async function setTaskBoardArchiveState(args: {
  currentSession: TaskBoardSession;
  taskId: string;
  action: "archive" | "restore";
}) {
  return readJson(
    await fetch(`/api/tasks/${args.taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: args.currentSession,
        action: args.action
      })
    })
  );
}

export async function escalateTaskBoardTask(currentSession: TaskBoardSession, taskId: string) {
  return readJson(
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: currentSession,
        action: "escalate"
      })
    })
  );
}

export async function undoTaskBoardStatus(currentSession: TaskBoardSession, taskId: string) {
  return readJson(
    await fetch(`/api/tasks/${taskId}/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentSession })
    })
  );
}

export async function setTaskBoardPriorityAlerts(
  currentSession: TaskBoardSession,
  priorityAlertsEnabled: boolean
): Promise<TaskBoardSettingsPayload> {
  const data = await readJson(
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: currentSession,
        priorityAlertsEnabled
      })
    })
  );
  return taskBoardSettingsPayload(data);
}

export async function saveTaskBoardRecipientProfile(
  currentSession: TaskBoardSession,
  recipientProfile: RecipientProfile
): Promise<TaskBoardSettingsPayload> {
  const data = await readJson(
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: currentSession,
        recipientProfile
      })
    })
  );
  return taskBoardSettingsPayload(data);
}

export async function deactivateTaskBoardRecipientProfile(
  currentSession: TaskBoardSession,
  deactivateProfileId: string
): Promise<TaskBoardSettingsPayload> {
  const data = await readJson(
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: currentSession,
        deactivateProfileId
      })
    })
  );
  return taskBoardSettingsPayload(data);
}
