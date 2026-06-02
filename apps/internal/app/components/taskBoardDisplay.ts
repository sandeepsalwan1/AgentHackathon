import type { AppRole, Task, TaskPriority, TaskRequestType, TaskStatus } from "@central-vet/db";

export const defaultDueTime = "19:00";

export const requestTypes: { value: TaskRequestType; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "labs_xrays", label: "Labs & X-Rays" },
  { value: "records_request", label: "Records Request" },
  { value: "scheduling", label: "Scheduling" },
  { value: "patient_update", label: "Patient Update" }
];

export function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function doctorName(name: string | null) {
  const clean = name?.trim();
  if (!clean) return "Veterinarian";
  return /^dr\.?\s/i.test(clean) ? clean : `Dr. ${clean}`;
}

export function statusLabel(status: TaskStatus) {
  return status.replace("_", " ");
}

export function roleLabel(role: AppRole) {
  if (role === "va" || role === "task_adder") return "VA";
  if (role === "veterinarian") return "Veterinarian";
  if (role === "admin") return "Admin";
  return "Staff";
}

export function actorDisplay(
  name: string | null,
  role: AppRole | null,
  viewerRole: AppRole
) {
  if (viewerRole === "staff" && (role === "va" || role === "task_adder")) return "VA";
  if (viewerRole === "staff" && role === "admin") return "Admin";
  if (role === "veterinarian") return doctorName(name);
  return name || (role ? roleLabel(role) : "Unknown");
}

export function sourceDisplay(task: Task, viewerRole: AppRole) {
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

export function requestTypeLabel(value: TaskRequestType) {
  return requestTypes.find((item) => item.value === value)?.label || "Labs & X-Rays";
}

export function priorityLabel(value: TaskPriority) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatPhone(value: string | null) {
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

export function formatDate(value: string | null) {
  if (!value) return "Not set";
  const [date] = value.split("T");
  return date || value;
}

export function formatDateTime(value: string | null) {
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

export function formatDue(task: Task) {
  const date = formatDate(task.dueDate);
  const time = formatTime(task.dueTime);
  return time ? `${date}, ${time}` : date;
}

export function isOverdue(task: Task) {
  return (
    task.status !== "completed" &&
    task.status !== "archived" &&
    task.dueDate < today()
  );
}

export function compareTasks(a: Task, b: Task) {
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
