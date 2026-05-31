"use client";

import {
  AlertTriangle,
  Archive,
  BellRing,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  UserPlus,
  UserX,
  Undo2,
  XCircle
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppRole, RecipientProfile, Task, TaskEvent, TaskPriority, TaskRequestType, TaskStatus } from "@central-vet/db";
import {
  canEditTask,
  canManage,
  canMarkInvalid,
  canSeeEscalations,
  canUseNotificationSettings,
  isOpenPriorityTask,
  taskBelongsInLane
} from "../lib/taskWorkflow";

type Session = {
  name: string;
  role: AppRole;
  passcode?: string;
  profileId?: string | null;
};

type FormState = {
  status: TaskStatus;
  requestType: TaskRequestType;
  clientName: string;
  clarityId: string;
  clientPhone: string;
  clientDateOfBirth: string;
  petName: string;
  petWeight: string;
  lastVisit: string;
  request: string;
  notes: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string;
};

type Toast = {
  text: string;
  taskId?: string;
};

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const sessionKey = "central-vet-session";
const taskSyncKey = `${sessionKey}:task-sync`;
const taskSyncChannelName = "central-vet-task-sync";
const activeSyncIntervalMs = 8000;
const activeSyncWindowMs = 12 * 60 * 1000;
const defaultDueTime = "19:00";
const blankVeterinarianProfile: RecipientProfile = {
  profileId: "",
  displayName: "Dr. ",
  email: "",
  phone: "",
  passcode: "",
  active: true,
  emailOptIn: false,
  smsOptIn: false,
  escalationOptIn: false,
  dailyPriorityOptIn: false
};

const laneDefs = [
  { key: "escalated", title: "Escalated", icon: BellRing },
  { key: "pending_review", title: "Pending Review", icon: ClipboardList },
  { key: "due", title: "Due Tasks", icon: Clock3 },
  { key: "pending", title: "Pending", icon: AlertTriangle },
  { key: "completed", title: "Completed", icon: CheckCircle2 },
  { key: "archived", title: "Archived", icon: Archive }
] as const;

type LaneKey = (typeof laneDefs)[number]["key"];

const requestTypes: { value: TaskRequestType; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "labs_xrays", label: "Labs & X-Rays" },
  { value: "records_request", label: "Records Request" },
  { value: "scheduling", label: "Scheduling" },
  { value: "patient_update", label: "Patient Update" }
];

function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function blankForm(): FormState {
  return {
    status: "due",
    requestType: "labs_xrays",
    clientName: "",
    clarityId: "",
    clientPhone: "",
    clientDateOfBirth: "",
    petName: "",
    petWeight: "",
    lastVisit: "",
    request: "",
    notes: "",
    assignedTo: "",
    priority: "medium",
    dueDate: today(),
    dueTime: defaultDueTime
  };
}

function doctorName(name: string | null) {
  const clean = name?.trim();
  if (!clean) return "Veterinarian";
  return /^dr\.?\s/i.test(clean) ? clean : `Dr. ${clean}`;
}

function statusLabel(status: TaskStatus) {
  return status.replace("_", " ");
}

function roleLabel(role: AppRole) {
  if (role === "va" || role === "task_adder") return "VA";
  if (role === "veterinarian") return "Veterinarian";
  if (role === "admin") return "Admin";
  return "Staff";
}

function actorDisplay(
  name: string | null,
  role: AppRole | null,
  viewerRole: AppRole
) {
  if (viewerRole === "staff" && (role === "va" || role === "task_adder")) return "VA";
  if (viewerRole === "staff" && role === "admin") return "Admin";
  if (role === "veterinarian") return doctorName(name);
  return name || (role ? roleLabel(role) : "Unknown");
}

function sourceDisplay(task: Task, viewerRole: AppRole) {
  if (task.source === "client_form") return "Client request";
  if (task.source === "staff_request") {
    return `Added by ${actorDisplay(task.createdByName, task.createdByRole, viewerRole)}`;
  }
  if (task.source === "veterinarian") {
    return `Added by ${doctorName(task.createdByName)}`;
  }
  if (task.source === "admin") {
    return viewerRole === "staff" ? "Admin" : `Added by ${task.createdByName || "Admin"}`;
  }
  if (task.source === "va") {
    return viewerRole === "staff" ? "VA" : `Added by ${task.createdByName || "VA"}`;
  }
  return viewerRole === "staff"
    ? "VA"
    : `Added by ${task.createdByName || "VA"}`;
}

function sourceRank(source: Task["source"]) {
  if (source === "task_adder" || source === "va") return 0;
  if (source === "admin") return 1;
  if (source === "veterinarian") return 2;
  if (source === "staff_request") return 3;
  return 4;
}

function requestTypeLabel(value: TaskRequestType) {
  return requestTypes.find((item) => item.value === value)?.label || "Labs & X-Rays";
}

function priorityLabel(value: TaskPriority) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPhone(value: string | null) {
  const clean = value?.trim();
  if (!clean) return "Not listed";
  if (clean.includes("@")) return clean;
  const digits = clean.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length === 10) {
    const formatted = `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
    return digits.length === 11 ? `+1 ${formatted}` : formatted;
  }
  if (local.length === 7) return `${local.slice(0, 3)}-${local.slice(3)}`;
  return clean;
}

function formatPhoneInput(value: string) {
  if (value.includes("@")) return value;
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const prefix = digits.length === 11 && digits.startsWith("1") ? "+1 " : "";
  if (local.length === 0) return "";
  if (local.length <= 3) return `${prefix}${local}`;
  if (local.length <= 6) return `${prefix}(${local.slice(0, 3)}) ${local.slice(3)}`;
  if (local.length <= 10) {
    return `${prefix}(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return value;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const [date] = value.split("T");
  return date || value;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTime(value: string | null) {
  if (!value) return "";
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!match) return "";
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDue(task: Task) {
  const date = formatDate(task.dueDate);
  const time = formatTime(task.dueTime);
  return time ? `${date}, ${time}` : date;
}

function isOverdue(task: Task) {
  return (
    task.status !== "completed" &&
    task.status !== "archived" &&
    task.dueDate < today()
  );
}

function compareTasks(a: Task, b: Task) {
  const dueDateDelta = a.dueDate.localeCompare(b.dueDate);
  if (dueDateDelta !== 0) return dueDateDelta;

  const sourceDelta = sourceRank(a.source) - sourceRank(b.source);
  if (sourceDelta !== 0) return sourceDelta;

  const dueTimeDelta = (a.dueTime || defaultDueTime).localeCompare(
    b.dueTime || defaultDueTime
  );
  if (dueTimeDelta !== 0) return dueTimeDelta;

  return a.createdAt.localeCompare(b.createdAt);
}

function requiredLabel(text: string) {
  return (
    <span className="labelText">
      {text} <span className="requiredStar">*</span>
    </span>
  );
}

function parseSavedSession(saved: string | null) {
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as Session;
    if (parsed.role !== "staff" && !parsed.passcode) return null;
    return parsed;
  } catch {
    window.localStorage.removeItem(sessionKey);
    return null;
  }
}

function readStoredSession() {
  if (typeof window === "undefined") return null;
  return parseSavedSession(window.localStorage.getItem(sessionKey));
}

function sessionReadHeaders(currentSession: Session) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (currentSession.passcode) {
    headers["X-Central-Vet-Passcode"] = currentSession.passcode;
  }
  return headers;
}

function clearStoredTaskCaches() {
  if (typeof window === "undefined") return;
  const prefix = `${sessionKey}:tasks:`;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(prefix)) {
      window.localStorage.removeItem(key);
    }
  }
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || data.detail || "Request failed.", response.status);
  }
  return data;
}

function isAuthError(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 429);
}

function actorName(value: string | null, valueRole: AppRole | null, role: AppRole, oldName: string, nextName: string) {
  return valueRole === role && value === oldName ? nextName : value;
}

function renameTaskActorNames(task: Task, role: AppRole, oldName: string, nextName: string): Task {
  return {
    ...task,
    assignedTo: actorName(task.assignedTo, task.assignedByRole, role, oldName, nextName),
    createdByName: actorName(task.createdByName, task.createdByRole, role, oldName, nextName),
    completedByName: actorName(task.completedByName, task.completedByRole, role, oldName, nextName),
    archivedByName: actorName(task.archivedByName, task.archivedByRole, role, oldName, nextName),
    escalatedByName: actorName(task.escalatedByName, task.escalatedByRole, role, oldName, nextName)
  };
}

function renameEventActorNames(event: TaskEvent, role: AppRole, oldName: string, nextName: string): TaskEvent {
  const metadata = { ...event.metadata };
  if (metadata.previousAssignedByRole === role && metadata.previousAssignedTo === oldName) {
    metadata.previousAssignedTo = nextName;
  }
  if (metadata.assignedByRole === role && metadata.assignedTo === oldName) {
    metadata.assignedTo = nextName;
  }
  return {
    ...event,
    actorName: actorName(event.actorName, event.actorRole, role, oldName, nextName),
    metadata
  };
}

function tabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseSyncPayload(value: unknown) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (parsed?.type !== "tasks_changed" && parsed?.type !== "settings_changed") return null;
    return parsed as { type: "tasks_changed" | "settings_changed"; source: string; at: number };
  } catch {
    return null;
  }
}

export function TaskBoard() {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [syncPaused, setSyncPaused] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [invalidTask, setInvalidTask] = useState<Task | null>(null);
  const [invalidReason, setInvalidReason] = useState("");
  const [confetti, setConfetti] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [priorityAlertsEnabled, setPriorityAlertsEnabled] = useState(true);
  const [recipientProfiles, setRecipientProfiles] = useState<RecipientProfile[]>([]);
  const [canEditAllProfiles, setCanEditAllProfiles] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [addingProfile, setAddingProfile] = useState(false);
  const tabIdRef = useRef(tabId());
  const lastActivityRef = useRef(0);
  const actorQueryRef = useRef("");
  const loadInFlightRef = useRef(false);
  const loadSequenceRef = useRef(0);

  const actorQuery = useMemo(() => {
    if (!session) return "";
    const params = new URLSearchParams({
      name: session.name,
      role: session.role,
      includeArchived: canManage(session.role) ? "true" : "false"
    });
    return params.toString();
  }, [session]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      clearStoredTaskCaches();
      setSession(readStoredSession());
      setBooted(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    actorQueryRef.current = actorQuery;
    loadInFlightRef.current = false;
  }, [actorQuery]);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(sessionKey);
    setSession(null);
    setTasks([]);
    setEvents([]);
    setLoading(false);
    setSyncPaused(false);
    setHasLoaded(false);
  }, []);

  const load = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!session || !actorQuery) return;
    if (loadInFlightRef.current) {
      return;
    }

    const requestActorQuery = actorQuery;
    const requestId = loadSequenceRef.current + 1;
    loadSequenceRef.current = requestId;
    loadInFlightRef.current = true;
    if (!options.silent) setLoading(true);
    setError("");
    try {
      const fetchOptions: RequestInit = {
        cache: "no-store",
        headers: sessionReadHeaders(session)
      };
      const taskRequest = fetch(`/api/tasks?${requestActorQuery}`, fetchOptions).then(readJson);
      const eventRequest = canManage(session.role)
        ? fetch(`/api/events?${requestActorQuery}`, fetchOptions).then(readJson)
        : Promise.resolve({ events: [] });
      const [data, eventData] = await Promise.all([taskRequest, eventRequest]);
      if (actorQueryRef.current !== requestActorQuery || loadSequenceRef.current !== requestId) return;
      setTasks(data.tasks);
      setEvents(eventData.events);
    } catch (loadError) {
      if (actorQueryRef.current === requestActorQuery) {
        if (isAuthError(loadError)) {
          clearSession();
          setError(loadError instanceof Error ? loadError.message : "Invalid passcode.");
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Load failed.");
      }
    } finally {
      const shouldFinish = actorQueryRef.current === requestActorQuery;
      if (shouldFinish) {
        setLoading(false);
        setHasLoaded(true);
      }
      loadInFlightRef.current = false;
    }
  }, [actorQuery, clearSession, session]);

  const loadSettings = useCallback(async () => {
    if (!session || !canUseNotificationSettings(session.role)) return;
    try {
      const data = await readJson(
        await fetch(`/api/settings?${actorQuery}`, {
          cache: "no-store",
          headers: sessionReadHeaders(session)
        })
      );
      setPriorityAlertsEnabled(Boolean(data.priorityAlertsEnabled));
      setRecipientProfiles(data.recipientProfiles ?? []);
      setCanEditAllProfiles(Boolean(data.canEditAllProfiles));
      setCurrentProfileId(data.currentProfileId ?? null);
    } catch (settingsError) {
      if (isAuthError(settingsError)) {
        clearSession();
        setError(settingsError instanceof Error ? settingsError.message : "Invalid passcode.");
        return;
      }
      setPriorityAlertsEnabled(false);
      setRecipientProfiles([]);
      setCanEditAllProfiles(false);
      setCurrentProfileId(null);
    }
  }, [actorQuery, clearSession, session]);

  const publishSync = useCallback((type: "tasks_changed" | "settings_changed" = "tasks_changed") => {
    const payload = {
      type,
      source: tabIdRef.current,
      at: Date.now()
    };
    try {
      window.localStorage.setItem(taskSyncKey, JSON.stringify(payload));
    } catch {
      // Best-effort same-browser sync; polling still catches cross-browser changes.
    }
    try {
      const channel = new BroadcastChannel(taskSyncChannelName);
      channel.postMessage(payload);
      channel.close();
    } catch {
      // Storage events cover browsers without BroadcastChannel.
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    lastActivityRef.current = Date.now();
    const kickoff = window.setTimeout(() => {
      void load();
      void loadSettings();
    }, 0);
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastActivityRef.current > activeSyncWindowMs) {
        setSyncPaused(true);
        return;
      }
      setSyncPaused(false);
      void load({ silent: true });
    }, activeSyncIntervalMs);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(id);
    };
  }, [load, loadSettings, session]);

  useEffect(() => {
    if (!session) return;
    const markActive = () => {
      lastActivityRef.current = Date.now();
      setSyncPaused(false);
    };
    const refresh = () => {
      markActive();
      void load({ silent: hasLoaded });
      void loadSettings();
    };
    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("pointerdown", markActive, { passive: true });
    window.addEventListener("keydown", markActive);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
    };
  }, [hasLoaded, load, loadSettings, session]);

  useEffect(() => {
    if (!session) return;

    const refreshFromSync = (payload: ReturnType<typeof parseSyncPayload>) => {
      if (!payload || payload.source === tabIdRef.current) return;
      lastActivityRef.current = Date.now();
      setSyncPaused(false);
      if (document.hidden) return;
      void load({ silent: true });
      if (payload.type === "settings_changed") {
        void loadSettings();
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== taskSyncKey) return;
      refreshFromSync(parseSyncPayload(event.newValue));
    };
    const onMessage = (event: MessageEvent) => {
      refreshFromSync(parseSyncPayload(event.data));
    };
    const channel = "BroadcastChannel" in window
      ? new BroadcastChannel(taskSyncChannelName)
      : null;

    window.addEventListener("storage", onStorage);
    channel?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.removeEventListener("message", onMessage);
      channel?.close();
    };
  }, [load, loadSettings, session]);

  useEffect(() => {
    function syncSession(event: StorageEvent) {
      if (event.key !== sessionKey) return;
      const nextSession = parseSavedSession(event.newValue);
      setSession(nextSession);
      setTasks([]);
      setEvents([]);
      setHasLoaded(false);
    }
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  function saveSession(next: Session) {
    lastActivityRef.current = Date.now();
    setSession(next);
    setTasks([]);
    setEvents([]);
    setLoading(false);
    setHasLoaded(false);
    window.localStorage.setItem(sessionKey, JSON.stringify(next));
  }

  function logout() {
    clearSession();
  }

  async function updateSessionName(nextName: string) {
    if (!session) return false;
    const cleanName = nextName.trim();
    if (!cleanName) return false;
    const name = session.role === "veterinarian" ? doctorName(cleanName) : cleanName;
    const previousSession = session;
    const nextSession = { ...session, name };
    lastActivityRef.current = Date.now();
    setSession(nextSession);
    window.localStorage.setItem(sessionKey, JSON.stringify(nextSession));
    try {
      const data = await readJson(
        await fetch("/api/profile-name", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: previousSession,
            name
          })
        })
      );
      const savedSession = {
        ...nextSession,
        name: data.actor?.name ?? name,
        profileId: data.actor?.profileId ?? nextSession.profileId
      };
      setSession(savedSession);
      window.localStorage.setItem(sessionKey, JSON.stringify(savedSession));
      const oldName = data.previousName ?? previousSession.name;
      if (oldName && oldName !== savedSession.name) {
        setTasks((current) =>
          current.map((task) => renameTaskActorNames(task, previousSession.role, oldName, savedSession.name))
        );
        setEvents((current) =>
          current.map((event) => renameEventActorNames(event, previousSession.role, oldName, savedSession.name))
        );
      }
      if (session.role === "veterinarian" && session.profileId) {
        setRecipientProfiles(data.recipientProfiles ?? recipientProfiles);
        setCurrentProfileId(data.currentProfileId ?? currentProfileId);
      }
      publishSync("settings_changed");
    } catch (profileError) {
      setSession(previousSession);
      window.localStorage.setItem(sessionKey, JSON.stringify(previousSession));
      setError(profileError instanceof Error ? profileError.message : "Profile name failed.");
      return false;
    }
    setToast({ text: session.role === "veterinarian" ? "Profile name updated." : "Name updated." });
    return true;
  }

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      status: task.status === "archived" ? "pending_review" : task.status,
      requestType: task.requestType,
      clientName: task.clientName ?? "",
      clarityId: task.clarityId ?? "",
      clientPhone: task.clientPhone ?? "",
      clientDateOfBirth: task.clientDateOfBirth ?? "",
      petName: task.petName ?? "",
      petWeight: task.petWeight ?? "",
      lastVisit: task.lastVisit ?? "",
      request: task.request,
      notes: task.notes ?? "",
      assignedTo: task.assignedTo ?? "",
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: task.dueTime?.slice(0, 5) || defaultDueTime
    });
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    if (!session || formSaving) return;

    const payload = {
      actor: session,
      task: form
    };

    setFormSaving(true);
    try {
      if (editing) {
        await readJson(
          await fetch(`/api/tasks/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actor: session,
              action: "edit",
              task: form
            })
          })
        );
        setToast({ text: "Task updated." });
      } else {
        await readJson(
          await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
        );
        setToast({
          text:
            session.role === "staff"
              ? "Task added."
              : "Task created."
        });
      }
      setFormOpen(false);
      publishSync();
      await load({ silent: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Save failed.");
    } finally {
      setFormSaving(false);
    }
  }

  async function updateStatus(
    task: Task,
    nextStatus: TaskStatus,
    invalidReasonText?: string
  ) {
    if (!session) return;
    try {
      await readJson(
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: session,
            action: "status",
            nextStatus,
            invalidReason: invalidReasonText
          })
        })
      );
      setToast({
        text:
          nextStatus === "completed"
            ? "Completed."
            : nextStatus === "invalid"
              ? "Marked invalid."
            : "Moved.",
        taskId: canManage(session.role) ? task.id : undefined
      });
      if (nextStatus === "completed") {
        setConfetti(true);
        window.setTimeout(() => setConfetti(false), 900);
      }
      setInvalidTask(null);
      setInvalidReason("");
      publishSync();
      await load({ silent: true });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Update failed.");
    }
  }

  async function archiveAction(task: Task, action: "archive" | "restore") {
    if (!session) return;
    try {
      await readJson(
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: session, action })
        })
      );
      setToast({ text: action === "archive" ? "Archived." : "Restored.", taskId: task.id });
      publishSync();
      await load({ silent: true });
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Archive failed.");
    }
  }

  async function escalate(task: Task) {
    if (!session) return;
    try {
      await readJson(
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: session, action: "escalate" })
        })
      );
      setToast({ text: "Escalated for veterinarians.", taskId: canManage(session.role) ? task.id : undefined });
      publishSync();
      await load({ silent: true });
    } catch (escalateError) {
      setError(escalateError instanceof Error ? escalateError.message : "Escalation failed.");
    }
  }

  async function undo(taskId: string) {
    if (!session) return;
    try {
      await readJson(
        await fetch(`/api/tasks/${taskId}/undo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: session })
        })
      );
      setToast({ text: "Undone." });
      publishSync();
      await load({ silent: true });
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Undo failed.");
    }
  }

  async function togglePriorityAlerts() {
    if (!session || session.role !== "admin") return;
    const next = !priorityAlertsEnabled;
    setPriorityAlertsEnabled(next);
    setSettingsSaving(true);
    try {
      const data = await readJson(
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: session,
            priorityAlertsEnabled: next
          })
        })
      );
      setPriorityAlertsEnabled(Boolean(data.priorityAlertsEnabled));
      setRecipientProfiles(data.recipientProfiles ?? recipientProfiles);
      setCanEditAllProfiles(Boolean(data.canEditAllProfiles));
      setCurrentProfileId(data.currentProfileId ?? currentProfileId);
      setToast({ text: next ? "Priority alerts on." : "Priority alerts off." });
      publishSync("settings_changed");
    } catch (settingsError) {
      setPriorityAlertsEnabled(!next);
      setError(settingsError instanceof Error ? settingsError.message : "Settings failed.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveRecipientProfile(profile: RecipientProfile) {
    if (!session || !canUseNotificationSettings(session.role)) return;
    const normalizedProfile = {
      ...profile,
      displayName: doctorName(profile.displayName)
    };
    setSettingsSaving(true);
    try {
      const data = await readJson(
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: session,
            recipientProfile: normalizedProfile
          })
        })
      );
      setRecipientProfiles(data.recipientProfiles ?? recipientProfiles);
      setCanEditAllProfiles(Boolean(data.canEditAllProfiles));
      setCurrentProfileId(data.currentProfileId ?? currentProfileId);
      if (session.role === "veterinarian" && currentProfileId === normalizedProfile.profileId) {
        const nextSession = { ...session, name: normalizedProfile.displayName };
        setSession(nextSession);
        window.localStorage.setItem(sessionKey, JSON.stringify(nextSession));
      }
      setAddingProfile(false);
      setToast({ text: "Notification settings saved." });
      publishSync("settings_changed");
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Settings failed.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function deactivateRecipientProfile(profile: RecipientProfile) {
    if (!session || !canEditAllProfiles) return;
    const typed = window.prompt(`Type ${profile.displayName} to deactivate this veterinarian profile.`);
    if (typed !== profile.displayName) return;
    setSettingsSaving(true);
    try {
      const data = await readJson(
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: session,
            deactivateProfileId: profile.profileId
          })
        })
      );
      setRecipientProfiles(data.recipientProfiles ?? recipientProfiles);
      setCanEditAllProfiles(Boolean(data.canEditAllProfiles));
      setCurrentProfileId(data.currentProfileId ?? currentProfileId);
      setToast({ text: "Veterinarian profile deactivated." });
      publishSync("settings_changed");
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Settings failed.");
    } finally {
      setSettingsSaving(false);
    }
  }

  const lanes = useMemo(() => {
    if (!session) return [];
    return laneDefs.filter((lane) => {
      if (lane.key === "escalated") return canSeeEscalations(session.role);
      if (lane.key === "pending_review" && session.role === "staff") return false;
      if (lane.key === "archived") return false;
      return true;
    });
  }, [session]);

  const laneTasks = useCallback(
    (lane: LaneKey) =>
      tasks
        .filter((task) =>
          session ? taskBelongsInLane({ task, lane, viewerRole: session.role }) : false
        )
        .sort(compareTasks),
    [session, tasks]
  );

  const openMediumHighCount = useMemo(
    () => tasks.filter(isOpenPriorityTask).length,
    [tasks]
  );
  const archivedTasks = useMemo(
    () => tasks
      .filter((task) => task.status === "archived")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [tasks]
  );

  if (!booted) {
    return <BootScreen />;
  }

  if (!session) {
    return <EntryScreen onSave={saveSession} />;
  }

  return (
    <main className="appShell">
      <header className="topBar">
        <div>
          <p className="eyebrow">Central Veterinary Hospital</p>
          <h1>Clinic Tasks</h1>
        </div>
        <div className="topActions">
          <SessionNameTag session={session} onSave={updateSessionName} />
          <span className={`rolePill role-${session.role}`}>
            {roleLabel(session.role)}
          </span>
          <button className="iconButton" onClick={logout} title="Change role">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="commandStrip">
        <button className="primaryButton" onClick={openCreate}>
          <Plus size={18} />
          {session.role === "staff" ? "Add Task" : "New Task"}
        </button>
        <span className={`liveDot ${syncPaused ? "idleDot" : ""}`}>
          {loading ? "syncing" : syncPaused ? "idle" : "live"}
        </span>
        {canSeeEscalations(session.role) ? (
          <span className="escalationSignal">
            <BellRing size={15} />
            {tasks.filter((task) => task.escalatedAt && task.status !== "completed" && task.status !== "archived").length} escalated
          </span>
        ) : null}
        {canSeeEscalations(session.role) && openMediumHighCount > 0 ? (
          <span className="prioritySignal">
            <AlertTriangle size={15} />
            {openMediumHighCount} medium/high open
          </span>
        ) : null}
        {session.role === "admin" || session.role === "veterinarian" ? (
          <div className="settingsMenu">
            <button
              type="button"
              className="plainButton compact"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <Settings size={16} />
              Settings
            </button>
            {settingsOpen ? (
              <div className="settingsPanel">
                {canEditAllProfiles ? (
                  <label className="toggleLine strongToggle">
                    <input
                      type="checkbox"
                      checked={priorityAlertsEnabled}
                      disabled={settingsSaving}
                      onChange={() => void togglePriorityAlerts()}
                    />
                    End-of-day alert
                  </label>
                ) : null}
                <p className="settingsHelp">
                  Sends once daily when any medium or high priority task is still open or overdue.
                </p>
                <div className="settingsDivider" />
                <div className="settingsTitle">
                  <strong>Veterinarian notifications</strong>
                  <span>
                    Choose delivery channels and alert types separately. Escalated tasks appear for veterinarians and Admin.
                  </span>
                </div>
                {recipientProfiles.filter((profile) => profile.active).map((profile) => (
                  <ProfileSettings
                    key={`${profile.profileId}:${profile.displayName}:${profile.email}:${profile.phone}:${profile.passcode}:${profile.active}:${profile.emailOptIn}:${profile.smsOptIn}:${profile.escalationOptIn}:${profile.dailyPriorityOptIn}`}
                    profile={profile}
                    saving={settingsSaving}
                    canEditAll={canEditAllProfiles}
                    currentProfileId={currentProfileId}
                    onChange={saveRecipientProfile}
                    onDeactivate={deactivateRecipientProfile}
                  />
                ))}
                {addingProfile ? (
                  <ProfileSettings
                    profile={blankVeterinarianProfile}
                    saving={settingsSaving}
                    canEditAll={canEditAllProfiles}
                    currentProfileId={currentProfileId}
                    onChange={saveRecipientProfile}
                    onDeactivate={deactivateRecipientProfile}
                    isNew
                  />
                ) : null}
                {canEditAllProfiles ? (
                  <button
                    type="button"
                    className="plainButton compact"
                    disabled={settingsSaving}
                    onClick={() => setAddingProfile(true)}
                  >
                    <UserPlus size={16} />
                    Add veterinarian
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? <div className="alertLine">{error}</div> : null}

      <section className="boardGrid">
        {lanes.map((lane) => {
          const Icon = lane.icon;
          const items = laneTasks(lane.key);
          return (
            <div className={`lane lane-${lane.key}`} key={lane.key}>
              <div className="laneHeader">
                <Icon size={18} />
                <h2>{lane.title}</h2>
                <span>{items.length}</span>
              </div>
              <div className="taskStack">
                {!hasLoaded && loading ? (
                  <div className="emptyLane loadingLane">Loading tasks</div>
                ) : null}
                {hasLoaded ? items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    role={session.role}
                    onEdit={openEdit}
                    onStatus={updateStatus}
                    onInvalid={(item) => {
                      setInvalidTask(item);
                      setInvalidReason(item.invalidReason ?? "");
                    }}
                    onArchive={archiveAction}
                    onEscalate={escalate}
                    onUndo={undo}
                  />
                )) : null}
                {hasLoaded && items.length === 0 ? <div className="emptyLane">No tasks</div> : null}
              </div>
            </div>
          );
        })}
      </section>

      {canManage(session.role) ? (
        <aside className="activityPanel">
          <section className="auditSection">
            <div className="activityHeader">
              <ShieldCheck size={18} />
              <h2>Audit Log</h2>
              <span>{events.length}</span>
            </div>
            <div className="activityList" aria-label="Recent audit events">
              {events.slice(0, 40).map((event) => (
                <div className="activityItem" key={event.id}>
                  <strong>{event.eventType.replaceAll("_", " ")}</strong>
                  <span>
                    {actorDisplay(event.actorName, event.actorRole, session.role)} ·{" "}
                    {new Date(event.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </span>
                  <small>{event.taskId.slice(0, 8)} · {event.nextStatus || event.previousStatus || "logged"}</small>
                </div>
              ))}
            </div>
          </section>
          <div className="archiveUnderAudit">
            <div className="activityHeader">
              <Archive size={18} />
              <h2>Archive</h2>
              <span>{archivedTasks.length}</span>
            </div>
            <div className="archiveList" aria-label="Archived tasks">
              {archivedTasks.slice(0, 24).map((task) => (
                <div className="archiveItem" key={task.id}>
                  <div className="archiveItemText">
                    <strong>{task.petName || task.clientName || "Archived task"}</strong>
                    <span>
                      {requestTypeLabel(task.requestType)} ·{" "}
                      {actorDisplay(task.archivedByName, task.archivedByRole, session.role)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="plainButton compact archiveRestore"
                    onClick={() => void archiveAction(task, "restore")}
                    title="Restore task"
                  >
                    <RotateCcw size={15} />
                    Restore
                  </button>
                </div>
              ))}
              {archivedTasks.length === 0 ? <div className="emptyLane">No archived tasks</div> : null}
            </div>
          </div>
        </aside>
      ) : null}

      {formOpen ? (
        <TaskForm
          form={form}
          setForm={setForm}
          editing={editing}
          role={session.role}
          saving={formSaving}
          onClose={() => setFormOpen(false)}
          onSubmit={submitForm}
        />
      ) : null}

      {invalidTask ? (
        <div className="modalBackdrop">
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault();
              void updateStatus(invalidTask, "invalid", invalidReason);
            }}
          >
            <h2>Mark Invalid</h2>
            <label>
              Reason
              <textarea
                value={invalidReason}
                onChange={(event) => setInvalidReason(event.target.value)}
                placeholder="Not a real issue, already handled, missing info..."
                rows={4}
              />
            </label>
            <div className="modalActions">
              <button type="button" className="plainButton" onClick={() => setInvalidTask(null)}>
                Cancel
              </button>
              <button type="submit" className="dangerButton">
                <XCircle size={17} />
                Mark Invalid
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {toast ? (
        <div className="toast">
          <span>{toast.text}</span>
          {toast.taskId ? (
            <button onClick={() => void undo(toast.taskId!)}>
              <Undo2 size={16} />
              Undo
            </button>
          ) : null}
          <button onClick={() => setToast(null)}>×</button>
        </div>
      ) : null}
      {confetti ? <MiniConfetti /> : null}
    </main>
  );
}

function SessionNameTag({
  session,
  onSave
}: {
  session: Session;
  onSave: (name: string) => boolean | Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const displayName = session.name.trim() || roleLabel(session.role);

  if (editing) {
    return (
      <form
        className="sessionNameEdit"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            if (await onSave(draft)) setEditing(false);
          } finally {
            setSaving(false);
          }
        }}
      >
        <input
          aria-label="Current name"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={saving}
          autoFocus
          maxLength={36}
        />
        <button type="submit" title="Save name" aria-label="Save name" disabled={saving}>
          <Check size={13} />
        </button>
      </form>
    );
  }

  return (
    <span className="sessionNameTag">
      <span title={displayName}>{displayName}</span>
      <button
        type="button"
        onClick={() => {
          setDraft(session.name);
          setEditing(true);
        }}
        title="Edit name"
        aria-label="Edit name"
      >
        <Pencil size={11} />
      </button>
    </span>
  );
}

function ProfileSettings({
  profile,
  saving,
  canEditAll,
  currentProfileId,
  onChange,
  onDeactivate,
  isNew = false
}: {
  profile: RecipientProfile;
  saving: boolean;
  canEditAll: boolean;
  currentProfileId: string | null;
  onChange: (profile: RecipientProfile) => void;
  onDeactivate: (profile: RecipientProfile) => void;
  isNew?: boolean;
}) {
  const [draft, setDraft] = useState(profile);
  const ownProfile = draft.profileId === currentProfileId;
  const canEdit = canEditAll || ownProfile || isNew;
  const update = (patch: Partial<RecipientProfile>) => {
    setDraft({ ...draft, ...patch });
  };
  const channelCount = Number(draft.emailOptIn) + Number(draft.smsOptIn);
  const alertCount = Number(draft.escalationOptIn) + Number(draft.dailyPriorityOptIn);
  const phoneDigits = draft.phone.replace(/\D/g, "");
  const smsReady = phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1"));

  return (
    <section className={`profileSettings ${!draft.active ? "inactiveProfile" : ""}`}>
      <div className="profileHeader">
        <div>
          <strong>{draft.displayName || "New veterinarian"}</strong>
          <small>
            {draft.active ? "Active" : "Inactive"} · {channelCount}/2 channels · {alertCount}/2 alert types
          </small>
        </div>
        <span>{draft.escalationOptIn ? "Escalation on" : "Escalation off"}</span>
      </div>
      <div className="settingsGrid">
        <label>
          Profile name
          <input
            value={draft.displayName}
            disabled={saving || !canEdit}
            onChange={(event) => update({ displayName: event.target.value })}
            placeholder="Dr. Name"
          />
        </label>
        {canEditAll || isNew ? (
          <label>
            Login passcode
            <input
              value={draft.passcode}
              disabled={saving || !canEdit}
              onChange={(event) => update({ passcode: event.target.value })}
              placeholder="4+ digits"
              inputMode="numeric"
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            value={draft.email}
            disabled={saving || !canEdit}
            onChange={(event) => update({ email: event.target.value })}
            placeholder="email address"
          />
        </label>
        <label>
          Phone
          <input
            value={draft.phone}
            disabled={saving || !canEdit}
            onChange={(event) => update({ phone: event.target.value })}
            placeholder="10-digit number"
            inputMode="tel"
          />
          {draft.smsOptIn && !smsReady ? (
            <span className="fieldHint">SMS needs a 10-digit number.</span>
          ) : null}
        </label>
      </div>
      <div className="profileSubhead">Delivery channels</div>
      <div className="profileToggles">
        <label className="toggleLine">
          <input
            type="checkbox"
            checked={draft.emailOptIn}
            disabled={saving || !canEdit}
            onChange={(event) => update({ emailOptIn: event.target.checked })}
          />
          Email opt-in
        </label>
        <label className="toggleLine">
          <input
            type="checkbox"
            checked={draft.smsOptIn}
            disabled={saving || !canEdit}
            onChange={(event) => update({ smsOptIn: event.target.checked })}
          />
          SMS opt-in
        </label>
      </div>
      <div className="profileSubhead">Alert types</div>
      <div className="profileToggles">
        <label className="toggleLine">
          <input
            type="checkbox"
            checked={draft.escalationOptIn}
            disabled={saving || !canEdit}
            onChange={(event) => update({ escalationOptIn: event.target.checked })}
          />
          Escalation alerts
        </label>
        <label className="toggleLine">
          <input
            type="checkbox"
            checked={draft.dailyPriorityOptIn}
            disabled={saving || !canEdit}
            onChange={(event) => update({ dailyPriorityOptIn: event.target.checked })}
          />
          Daily medium/high alerts
        </label>
      </div>
      <div className="profileActions">
        <button
          type="button"
          className="plainButton compact"
          disabled={saving || !canEdit || !draft.displayName.trim() || !draft.passcode.trim()}
          onClick={() => void onChange(draft)}
        >
          Save settings
        </button>
        {canEditAll && !isNew && draft.active ? (
          <button
            type="button"
            className="plainButton compact dangerText"
            disabled={saving}
            onClick={() => void onDeactivate(draft)}
          >
            <UserX size={16} />
            Deactivate
          </button>
        ) : null}
      </div>
    </section>
  );
}

function BootScreen() {
  return (
    <main className="entryShell">
      <section className="entryPanel bootPanel">
        <p className="eyebrow">Central Veterinary Hospital</p>
        <h1>Clinic Tasks</h1>
        <div className="bootLine">Opening board</div>
        <div className="bootBar" aria-hidden="true" />
      </section>
    </main>
  );
}

function EntryScreen({ onSave }: { onSave: (session: Session) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("staff");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (role !== "veterinarian" && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (role !== "staff" && !passcode.trim()) {
      setError("Enter passcode.");
      return;
    }

    const nextSession = {
      name: name.trim(),
      role,
      passcode: role === "staff" ? undefined : passcode.trim(),
      profileId: null
    };

    setSubmitting(true);
    setError("");
    try {
      const data = await readJson(
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: nextSession })
        })
      );
      onSave({
        ...nextSession,
        name: data.actor?.name ?? nextSession.name,
        role: data.actor?.role ?? nextSession.role,
        profileId: data.actor?.profileId ?? nextSession.profileId
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Wrong passcode.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="entryShell">
      <form className="entryPanel" onSubmit={submit}>
        <p className="eyebrow">Central Veterinary Hospital</p>
        <h1>Clinic Tasks</h1>
        <label>
          {role === "veterinarian" ? "Name (optional)" : "Name"}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            placeholder={role === "veterinarian" ? "Auto-fills from passcode" : "Your name"}
          />
        </label>
        <div className="rolePicker">
          {[
            ["staff", "Staff"],
            ["va", "VA"],
            ["veterinarian", "Veterinarian"],
            ["admin", "Admin"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={role === value ? "selected" : ""}
              onClick={() => setRole(value as AppRole)}
            >
              {label}
            </button>
          ))}
        </div>
        {role !== "staff" ? (
          <label>
            Passcode
            <input
              value={passcode}
              onChange={(event) => setPasscode(event.target.value.trim())}
              type="password"
              inputMode="numeric"
              placeholder="Passcode"
            />
          </label>
        ) : null}
        {error ? <div className="alertLine">{error}</div> : null}
        <button className="primaryButton" type="submit" disabled={submitting}>
          <ShieldCheck size={18} />
          {submitting ? "Checking" : "Enter"}
        </button>
      </form>
    </main>
  );
}

function MiniConfetti() {
  return (
    <div className="miniConfetti" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function TaskForm({
  form,
  setForm,
  editing,
  role,
  saving,
  onClose,
  onSubmit
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  editing: Task | null;
  role: AppRole;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const update = (key: keyof FormState, value: string) =>
    setForm({ ...form, [key]: value });

  return (
    <div className="modalBackdrop">
      <form className="modal wideModal" onSubmit={onSubmit}>
        <h2>{editing ? "Edit Task" : role === "staff" ? "Add Task" : "New Task"}</h2>
        <fieldset className="requestTypePicker">
          <legend>{requiredLabel("Request Type")}</legend>
          {requestTypes.map((item) => (
            <button
              key={item.value}
              type="button"
              className={form.requestType === item.value ? "selected" : ""}
              onClick={() => update("requestType", item.value)}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
        <div className="formGrid">
          <label>
            {requiredLabel("Client Name")}
            <input required value={form.clientName} onChange={(event) => update("clientName", event.target.value)} />
          </label>
          <label>
            {requiredLabel("Phone")}
            <input
              required
              value={form.clientPhone}
              onChange={(event) => update("clientPhone", formatPhoneInput(event.target.value))}
              inputMode="tel"
            />
          </label>
          <label>
            {requiredLabel("Pet's name")}
            <input required value={form.petName} onChange={(event) => update("petName", event.target.value)} />
          </label>
          <label>
            {requiredLabel("Priority")}
            <select required value={form.priority} onChange={(event) => update("priority", event.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <label>
          {requiredLabel("Request")}
          <textarea
            value={form.request}
            onChange={(event) => update("request", event.target.value)}
            rows={5}
            required
            minLength={10}
          />
        </label>
        <div className="formGrid optionalGrid">
          <label>
            Due date
            <input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
          </label>
          <label>
            Due time
            <input type="time" value={form.dueTime} onChange={(event) => update("dueTime", event.target.value)} />
          </label>
          <label>
            Pet&apos;s date of birth
            <input type="date" value={form.clientDateOfBirth} onChange={(event) => update("clientDateOfBirth", event.target.value)} />
          </label>
          <label>
            Client ID
            <input value={form.clarityId} onChange={(event) => update("clarityId", event.target.value)} />
          </label>
          <label>
            Pet&apos;s weight
            <input value={form.petWeight} onChange={(event) => update("petWeight", event.target.value)} />
          </label>
          <label>
            Assigned to
            <input value={form.assignedTo} onChange={(event) => update("assignedTo", event.target.value)} />
          </label>
          {role !== "staff" ? (
            <label>
              Status
              <select value={form.status} onChange={(event) => update("status", event.target.value)}>
                <option value="due">Due</option>
                <option value="pending">Pending</option>
                <option value="pending_review">Pending Review</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="modalActions">
          <button type="button" className="plainButton" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primaryButton" disabled={saving}>
            {editing ? <Pencil size={17} /> : <Plus size={17} />}
            {saving ? "Saving" : editing ? "Save" : role === "staff" ? "Add Task" : "Create"}
          </button>
        </div>
        <p className="requiredNote"><span className="requiredStar">*</span> Required</p>
      </form>
    </div>
  );
}

function TaskCard({
  task,
  role,
  onEdit,
  onStatus,
  onInvalid,
  onArchive,
  onEscalate,
  onUndo
}: {
  task: Task;
  role: AppRole;
  onEdit: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onInvalid: (task: Task) => void;
  onArchive: (task: Task, action: "archive" | "restore") => void;
  onEscalate: (task: Task) => void;
  onUndo: (taskId: string) => void;
}) {
  const overdue = isOverdue(task);
  const manageable = canManage(role);
  const editable = canEditTask(role, task);
  const archiveAccess = canManage(role);
  const archived = task.status === "archived";
  const pendingReview = task.status === "pending_review";
  const finished = task.status === "completed" || task.status === "invalid";
  const invalidArchived = archived && Boolean(task.invalidReason);
  const showAssignment = Boolean(task.assignedTo) && !finished && !archived;
  const invalidAllowed = canMarkInvalid(role, task);

  return (
    <article className={`taskCard status-${task.status} ${overdue ? "isOverdue" : ""} ${task.escalatedAt ? "isEscalated" : ""}`}>
      <div className="cardTop">
        <span className={`sourceBadge source-${task.source}`}>{sourceDisplay(task, role)}</span>
        <span className={`statusBadge badge-${invalidArchived ? "invalid" : task.status}`}>
          {overdue ? "Overdue" : invalidArchived ? "Invalid" : statusLabel(task.status)}
        </span>
      </div>
      {task.escalatedAt ? (
        <div className="escalatedBanner">
          <BellRing size={15} />
          Escalated by {actorDisplay(task.escalatedByName, task.escalatedByRole, role)} {formatDateTime(task.escalatedAt)}
        </div>
      ) : null}
      {(task.priority === "medium" || task.priority === "high") && !finished && !archived ? (
        <div className="priorityBanner">
          <AlertTriangle size={15} />
          {priorityLabel(task.priority)} priority
        </div>
      ) : null}
      <h3 className={task.status === "completed" ? "doneTitle" : ""}>
        {task.petName || "No pet listed"}
      </h3>
      <p className={task.status === "invalid" || invalidArchived ? "invalidText" : ""}>
        {task.request}
      </p>
      <dl className="taskMeta">
        <div>
          <dt>Request Type</dt>
          <dd>{requestTypeLabel(task.requestType)}</dd>
        </div>
        <div>
          <dt>Client Name</dt>
          <dd>{task.clientName || "Not listed"}</dd>
        </div>
        {task.clarityId ? (
          <div>
            <dt>Client ID</dt>
            <dd>{task.clarityId}</dd>
          </div>
        ) : null}
        <div>
          <dt>Priority</dt>
          <dd>{priorityLabel(task.priority)}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{formatPhone(task.clientPhone)}</dd>
        </div>
        {task.clientDateOfBirth ? (
          <div>
            <dt>Pet DOB</dt>
            <dd>{formatDate(task.clientDateOfBirth)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Due</dt>
          <dd>{formatDue(task)}</dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{actorDisplay(task.createdByName, task.createdByRole, role)}</dd>
        </div>
        <div>
          <dt>Created at</dt>
          <dd>{formatDateTime(task.createdAt)}</dd>
        </div>
        {showAssignment ? (
          <div>
            <dt>{task.status === "pending" ? "Pending by" : "Assigned"}</dt>
            <dd>{task.assignedTo}</dd>
          </div>
        ) : null}
        {task.completedByName ? (
          <div>
            <dt>Completed by</dt>
            <dd>{actorDisplay(task.completedByName, task.completedByRole, role)}</dd>
          </div>
        ) : null}
        {task.completedAt ? (
          <div>
            <dt>Completed at</dt>
            <dd>{formatDateTime(task.completedAt)}</dd>
          </div>
        ) : null}
        {task.archivedByName ? (
          <div>
            <dt>Archived by</dt>
            <dd>{actorDisplay(task.archivedByName, task.archivedByRole, role)}</dd>
          </div>
        ) : null}
        {task.escalatedByName ? (
          <div>
            <dt>Escalated by</dt>
            <dd>{actorDisplay(task.escalatedByName, task.escalatedByRole, role)}</dd>
          </div>
        ) : null}
      </dl>
      {task.invalidReason ? <div className="invalidReason">{task.invalidReason}</div> : null}
      <div className="cardActions">
        {pendingReview && manageable ? (
          <>
            <button onClick={() => onStatus(task, "due")} className="plainButton compact">
              <Clock3 size={16} />
              Move to Due
            </button>
            <button onClick={() => onInvalid(task)} className="plainButton compact">
              <XCircle size={16} />
              Invalid
            </button>
          </>
        ) : null}
        {!archived && !pendingReview && !finished ? (
          <button onClick={() => onStatus(task, "completed")} className="completeButton">
            <CheckCircle2 size={16} />
            Complete
          </button>
        ) : null}
        {!archived && !pendingReview && invalidAllowed && task.status !== "invalid" && task.status !== "completed" ? (
          <button onClick={() => onInvalid(task)} className="plainButton compact">
            <XCircle size={16} />
            Invalid
          </button>
        ) : null}
        {role === "staff" && !archived && !pendingReview && task.status !== "invalid" ? (
          <>
            {task.status !== "due" ? (
              <button onClick={() => onStatus(task, "due")} className="plainButton compact">
                Due
              </button>
            ) : null}
            {task.status !== "pending" ? (
              <button onClick={() => onStatus(task, "pending")} className="plainButton compact">
                Pending
              </button>
            ) : null}
          </>
        ) : null}
        {manageable && !archived && !pendingReview ? (
          <>
            {task.status !== "due" ? (
              <button onClick={() => onStatus(task, "due")} className="plainButton compact">
                Due
              </button>
            ) : null}
            {task.status !== "pending" && task.status !== "invalid" ? (
              <button onClick={() => onStatus(task, "pending")} className="plainButton compact">
                Pending
              </button>
            ) : null}
            {task.status !== "invalid" ? (
              <button onClick={() => onEdit(task)} className="plainButton compact">
                <Pencil size={16} />
                Edit
              </button>
            ) : null}
            <button onClick={() => onUndo(task.id)} className="plainButton compact">
              <RotateCcw size={16} />
              Undo
            </button>
          </>
        ) : null}
        {archiveAccess ? (
          archived ? (
            <button onClick={() => onArchive(task, "restore")} className="plainButton compact">
              <RotateCcw size={16} />
              {invalidArchived ? "Restore to Due" : "Restore"}
            </button>
          ) : !pendingReview ? (
            <button onClick={() => onArchive(task, "archive")} className="plainButton compact">
              <Archive size={16} />
              Archive
            </button>
          ) : null
        ) : null}
        {!manageable && editable && !archived && !pendingReview && task.status !== "invalid" ? (
          <button onClick={() => onEdit(task)} className="plainButton compact">
            <Pencil size={16} />
            Edit
          </button>
        ) : null}
        {!archived && !finished && !task.escalatedAt ? (
          <button onClick={() => onEscalate(task)} className="escalateButton">
            <BellRing size={16} />
            Escalate
          </button>
        ) : null}
      </div>
    </article>
  );
}
