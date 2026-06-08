"use client";

import {
  AlertTriangle,
  Archive,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RotateCcw,
  ShieldCheck
} from "lucide-react";
import type { AppRole, Task, TaskEvent, TaskStatus } from "@central-vet/db";
import { canSeeEscalations, taskBelongsInLane } from "../lib/taskWorkflow";
import { TaskCard } from "./TaskCard";
import { actorDisplay, compareTasks, requestTypeLabel } from "./taskBoardDisplay";

const laneDefs = [
  { key: "escalated", title: "Escalated", icon: BellRing },
  { key: "pending_review", title: "Pending Review", icon: ClipboardList },
  { key: "due", title: "Due Tasks", icon: Clock3 },
  { key: "pending", title: "Pending", icon: AlertTriangle },
  { key: "completed", title: "Completed", icon: CheckCircle2 },
  { key: "archived", title: "Archived", icon: Archive }
] as const;

type LaneKey = (typeof laneDefs)[number]["key"];

type TaskLaneGridProps = {
  tasks: Task[];
  role: AppRole;
  loading: boolean;
  hasLoaded: boolean;
  onEdit: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onInvalid: (task: Task) => void;
  onArchive: (task: Task, action: "archive" | "restore") => void;
  onEscalate: (task: Task) => void;
  onUndo: (taskId: string) => void;
};

function visibleLanes(role: AppRole) {
  return laneDefs.filter((lane) => {
    if (lane.key === "escalated") return canSeeEscalations(role);
    if (lane.key === "pending_review" && role === "staff") return false;
    if (lane.key === "archived") return false;
    return true;
  });
}

function laneTasks(tasks: Task[], lane: LaneKey, role: AppRole) {
  return tasks
    .filter((task) => taskBelongsInLane({ task, lane, viewerRole: role }))
    .sort(compareTasks);
}

export function TaskLaneGrid({
  tasks,
  role,
  loading,
  hasLoaded,
  onEdit,
  onStatus,
  onInvalid,
  onArchive,
  onEscalate,
  onUndo
}: TaskLaneGridProps) {
  return (
    <section className="boardGrid">
      {visibleLanes(role).map((lane) => {
        const Icon = lane.icon;
        const items = laneTasks(tasks, lane.key, role);
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
                  role={role}
                  onEdit={onEdit}
                  onStatus={onStatus}
                  onInvalid={onInvalid}
                  onArchive={onArchive}
                  onEscalate={onEscalate}
                  onUndo={onUndo}
                />
              )) : null}
              {hasLoaded && items.length === 0 ? <div className="emptyLane">No tasks</div> : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function TaskActivityPanel({
  events,
  archivedTasks,
  role,
  onRestore
}: {
  events: TaskEvent[];
  archivedTasks: Task[];
  role: AppRole;
  onRestore: (task: Task) => void;
}) {
  return (
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
                {actorDisplay(event.actorName, event.actorRole, role)} ·{" "}
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
                  {actorDisplay(task.archivedByName, task.archivedByRole, role)}
                </span>
              </div>
              <button
                type="button"
                className="plainButton compact archiveRestore"
                onClick={() => onRestore(task)}
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
  );
}
