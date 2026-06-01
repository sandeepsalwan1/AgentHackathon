"use client";

import { Mail, X } from "lucide-react";
import type { PetOwner } from "./PetOwnersList";

type Props = {
  owner: PetOwner;
  onClose: () => void;
};

const priorityMeta: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "vetPriorityBadge vetPriorityBadge--high" },
  medium: { label: "Medium", cls: "vetPriorityBadge vetPriorityBadge--medium" },
  low: { label: "Low", cls: "vetPriorityBadge vetPriorityBadge--low" },
};

const statusMeta: Record<string, { label: string; cls: string }> = {
  due: { label: "Due", cls: "vetStatusBadge vetStatusBadge--due" },
  pending_review: { label: "Pending Review", cls: "vetStatusBadge vetStatusBadge--review" },
  pending: { label: "Pending", cls: "vetStatusBadge vetStatusBadge--review" },
  completed: { label: "Completed", cls: "vetStatusBadge vetStatusBadge--done" },
  archived: { label: "Archived", cls: "vetStatusBadge" },
  invalid: { label: "Invalid", cls: "vetStatusBadge" },
};

export function PetOwnerDetail({ owner, onClose }: Props) {
  return (
    <div className="vetDetailPanel">
      <div className="vetDetailHeader">
        <div className="vetDetailHeaderInfo">
          <div className="vetDetailOwnerName">{owner.clientName}</div>
          {owner.petName && <div className="vetDetailPetName">{owner.petName}</div>}
        </div>
        <div className="vetDetailHeaderActions">
          <button
            className="vetDetailEmailBtn"
            type="button"
            onClick={() => {/* TODO: wire up email flow */}}
            title="Send email to owner"
          >
            <Mail size={14} />
            Send Email
          </button>
          <button className="iconButton" type="button" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="vetDetailBody">
        <div className="vetDetailSection">
          <h3 className="vetDetailSectionTitle">
            Task History
            <span className="vetDetailTaskCount">{owner.tasks.length}</span>
          </h3>
          {owner.tasks.length === 0 ? (
            <p className="vetOwnerEmpty">No tasks found for this client.</p>
          ) : (
            <div className="vetDetailTaskList">
              {owner.tasks.map((task) => {
                const p = priorityMeta[task.priority] ?? priorityMeta.low;
                const s = statusMeta[task.status] ?? { label: task.status, cls: "vetStatusBadge" };
                const date = new Date(task.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <div key={task.id} className="vetDetailTaskRow">
                    <div className="vetDetailTaskRequest">{task.request}</div>
                    <div className="vetDetailTaskMeta">
                      <span className={p.cls}>{p.label}</span>
                      <span className={s.cls}>{s.label}</span>
                      <span className="vetTaskRowTime">{date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
