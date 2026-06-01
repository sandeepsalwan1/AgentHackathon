"use client";

import { Search, User } from "lucide-react";
import { useMemo, useState } from "react";

type TaskRow = {
  id: string;
  clientName: string | null;
  petName: string | null;
  status: string;
  priority: string;
  request: string;
  createdAt: string;
  dueDate: string;
};

export type PetOwner = {
  clientName: string;
  petName: string | null;
  openTaskCount: number;
  lastTaskDate: string;
  tasks: TaskRow[];
};

type Props = {
  tasks: TaskRow[];
  onSelectOwner: (owner: PetOwner) => void;
  selectedOwnerName: string | null;
};

const OPEN_STATUSES = new Set(["due", "pending_review", "pending"]);

function deriveOwners(tasks: TaskRow[]): PetOwner[] {
  const map = new Map<string, { tasks: TaskRow[]; petName: string | null }>();
  for (const task of tasks) {
    if (!task.clientName) continue;
    const entry = map.get(task.clientName);
    if (entry) {
      entry.tasks.push(task);
      if (task.petName) entry.petName = task.petName;
    } else {
      map.set(task.clientName, { tasks: [task], petName: task.petName });
    }
  }

  return Array.from(map.entries())
    .map(([clientName, { tasks: ownerTasks, petName }]) => {
      const sorted = [...ownerTasks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return {
        clientName,
        petName,
        openTaskCount: ownerTasks.filter((t) => OPEN_STATUSES.has(t.status)).length,
        lastTaskDate: sorted[0].createdAt,
        tasks: sorted,
      };
    })
    .sort((a, b) => new Date(b.lastTaskDate).getTime() - new Date(a.lastTaskDate).getTime());
}

export function PetOwnersList({ tasks, onSelectOwner, selectedOwnerName }: Props) {
  const [search, setSearch] = useState("");
  const owners = useMemo(() => deriveOwners(tasks), [tasks]);

  const filtered = useMemo(() => {
    if (!search.trim()) return owners;
    const q = search.toLowerCase();
    return owners.filter(
      (o) =>
        o.clientName.toLowerCase().includes(q) ||
        (o.petName ?? "").toLowerCase().includes(q)
    );
  }, [owners, search]);

  return (
    <div className="vetOwnerListWrap">
      <div className="vetOwnerSearch">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search by owner or pet name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="vetOwnerEmpty">
          {owners.length === 0
            ? "No client records found. Records appear once tasks with client names are created."
            : "No clients match your search."}
        </p>
      ) : (
        <div className="vetOwnerList">
          {filtered.map((owner) => {
            const isSelected = owner.clientName === selectedOwnerName;
            const lastDate = new Date(owner.lastTaskDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return (
              <button
                key={owner.clientName}
                className={`vetOwnerRow${isSelected ? " vetOwnerRow--selected" : ""}`}
                onClick={() => onSelectOwner(owner)}
                type="button"
              >
                <div className="vetOwnerRowLeft">
                  <User size={14} className="vetOwnerIcon" />
                  <div>
                    <div className="vetOwnerName">{owner.clientName}</div>
                    <div className="vetOwnerPet">{owner.petName ?? "—"}</div>
                  </div>
                </div>
                <div className="vetOwnerRowRight">
                  {owner.openTaskCount > 0 && (
                    <span className="vetOpenBadge">{owner.openTaskCount} open</span>
                  )}
                  <span className="vetOwnerDate">{lastDate}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
