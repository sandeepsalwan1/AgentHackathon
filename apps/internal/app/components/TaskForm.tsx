"use client";

import { Pencil, Plus } from "lucide-react";
import type { AppRole, Task, TaskPriority, TaskRequestType, TaskStatus } from "@central-vet/db";
import type { FormEvent } from "react";
import { requestTypes } from "./taskBoardDisplay";

export type TaskFormState = {
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

type TaskFormProps = {
  form: TaskFormState;
  setForm: (next: TaskFormState) => void;
  editing: Task | null;
  role: AppRole;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};

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

function requiredLabel(text: string) {
  return (
    <span className="labelText">
      {text} <span className="requiredStar">*</span>
    </span>
  );
}

export function TaskForm({
  form,
  setForm,
  editing,
  role,
  saving,
  onClose,
  onSubmit
}: TaskFormProps) {
  const update = (key: keyof TaskFormState, value: string) =>
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
