"use client";

import {
  AlertTriangle,
  BellRing,
  LogOut,
  Plus,
  Undo2,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Task, TaskStatus } from "@central-vet/db";
import { logout as clearAccountSession } from "../lib/accountStore";
import {
  canManage,
  canSeeEscalations,
  isOpenPriorityTask
} from "../lib/taskWorkflow";
import { TaskActivityPanel, TaskLaneGrid } from "./TaskBoardPanels";
import { ArrivalDeskPanel } from "./ArrivalDeskPanel";
import { useClinicBrand } from "./ClinicContext";
import { TaskForm, type TaskFormState } from "./TaskForm";
import { BootScreen, EntryScreen, MiniConfetti, SessionNameTag } from "./TaskBoardChrome";
import { NotificationSettingsMenu } from "./TaskBoardSettings";
import { writeStoredTaskBoardSession } from "./taskBoardBrowserState";
import {
  escalateTaskBoardTask,
  saveTaskBoardForm,
  setTaskBoardArchiveState,
  undoTaskBoardStatus,
  updateTaskBoardProfileName,
  updateTaskBoardStatus
} from "./taskBoardClient";
import {
  doctorName,
  roleLabel
} from "./taskBoardDisplay";
import {
  blankTaskForm,
  renameEventActorNames,
  renameTaskActorNames,
  taskFormFromTask
} from "./taskBoardState";
import type { TaskBoardToast } from "./taskBoardTypes";
import { useTaskBoardDataSync } from "./useTaskBoardDataSync";
import { useTaskBoardSettings } from "./useTaskBoardSettings";

export function TaskBoard() {
  const clinic = useClinicBrand();
  const {
    booted,
    session,
    setSession,
    tasks,
    setTasks,
    events,
    setEvents,
    loading,
    hasLoaded,
    syncPaused,
    error,
    setError,
    settingsRefreshToken,
    actorQuery,
    load,
    publishSync,
    saveSession,
    clearSession,
    markActive
  } = useTaskBoardDataSync();
  const [toast, setToast] = useState<TaskBoardToast | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormState>(blankTaskForm);
  const [invalidTask, setInvalidTask] = useState<Task | null>(null);
  const [invalidReason, setInvalidReason] = useState("");
  const [confetti, setConfetti] = useState(false);

  const {
    settingsOpen,
    settingsSaving,
    priorityAlertsEnabled,
    recipientProfiles,
    canEditAllProfiles,
    currentProfileId,
    addingProfile,
    loadSettings,
    toggleSettingsOpen,
    togglePriorityAlerts,
    saveRecipientProfile,
    deactivateRecipientProfile,
    startAddingProfile,
    setRecipientProfiles,
    setCurrentProfileId
  } = useTaskBoardSettings({
    session,
    actorQuery,
    clearSession,
    setSession,
    setError,
    setToast,
    publishSync
  });

  useEffect(() => {
    if (!session) return;
    void loadSettings();
  }, [loadSettings, session, settingsRefreshToken]);

  function logout() {
    clearSession();
    clearAccountSession();
    window.location.assign("/staff");
  }

  async function updateSessionName(nextName: string) {
    if (!session) return false;
    const cleanName = nextName.trim();
    if (!cleanName) return false;
    const name = session.role === "veterinarian" ? doctorName(cleanName) : cleanName;
    const previousSession = session;
    const nextSession = { ...session, name };
    markActive();
    setSession(nextSession);
    writeStoredTaskBoardSession(nextSession);
    try {
      const data = await updateTaskBoardProfileName(previousSession, name);
      const savedSession = {
        ...nextSession,
        name: data.actor?.name ?? name,
        profileId: data.actor?.profileId ?? nextSession.profileId
      };
      setSession(savedSession);
      writeStoredTaskBoardSession(savedSession);
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
      writeStoredTaskBoardSession(previousSession);
      setError(profileError instanceof Error ? profileError.message : "Profile name failed.");
      return false;
    }
    setToast({ text: session.role === "veterinarian" ? "Profile name updated." : "Name updated." });
    return true;
  }

  function openCreate() {
    setEditing(null);
    setForm(blankTaskForm());
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm(taskFormFromTask(task));
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    if (!session || formSaving) return;

    setFormSaving(true);
    try {
      await saveTaskBoardForm({
        currentSession: session,
        form,
        editingTaskId: editing?.id
      });
      setToast({
        text: editing
          ? "Task updated."
          : session.role === "staff"
            ? "Task added."
            : "Task created."
      });
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
      await updateTaskBoardStatus({
        currentSession: session,
        taskId: task.id,
        nextStatus,
        invalidReason: invalidReasonText
      });
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
      await setTaskBoardArchiveState({
        currentSession: session,
        taskId: task.id,
        action
      });
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
      await escalateTaskBoardTask(session, task.id);
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
      await undoTaskBoardStatus(session, taskId);
      setToast({ text: "Undone." });
      publishSync();
      await load({ silent: true });
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Undo failed.");
    }
  }

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
          <p className="eyebrow">{clinic.name}</p>
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
          <NotificationSettingsMenu
            open={settingsOpen}
            saving={settingsSaving}
            priorityAlertsEnabled={priorityAlertsEnabled}
            recipientProfiles={recipientProfiles}
            canEditAllProfiles={canEditAllProfiles}
            currentProfileId={currentProfileId}
            addingProfile={addingProfile}
            onToggleOpen={toggleSettingsOpen}
            onTogglePriorityAlerts={togglePriorityAlerts}
            onSaveProfile={saveRecipientProfile}
            onDeactivateProfile={deactivateRecipientProfile}
            onAddProfile={startAddingProfile}
          />
        ) : null}
      </section>

      {error ? <div className="alertLine">{error}</div> : null}

      <ArrivalDeskPanel
        session={session}
        actorQuery={actorQuery}
        onError={setError}
      />

      <TaskLaneGrid
        tasks={tasks}
        role={session.role}
        loading={loading}
        hasLoaded={hasLoaded}
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

      {canManage(session.role) ? (
        <TaskActivityPanel
          events={events}
          archivedTasks={archivedTasks}
          role={session.role}
          onRestore={(task) => void archiveAction(task, "restore")}
        />
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
