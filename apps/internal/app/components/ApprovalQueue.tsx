"use client";

import { Check, FileCheck2, Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppRole } from "@central-vet/db";
import { canManage } from "../lib/taskWorkflow";

type Session = {
  name: string;
  role: AppRole;
  passcode?: string;
  profileId?: string | null;
};

type Approval = {
  id: string;
  approvalType: string;
  status: string;
  title: string;
  summary: string;
  createdAt: string;
};

const sessionKey = "central-vet-session";

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(sessionKey) || "null") as Session | null;
  } catch {
    return null;
  }
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function ApprovalQueue() {
  const [session, setSession] = useState<Session | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSession(readSession());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const actor = useMemo(() => {
    if (!session) return null;
    return {
      name: session.name,
      role: session.role,
      passcode: session.passcode,
      profileId: session.profileId
    };
  }, [session]);

  const actorQuery = useMemo(() => {
    if (!session) return "";
    return new URLSearchParams({ name: session.name, role: session.role }).toString();
  }, [session]);

  async function load() {
    if (!session || !actorQuery) return;
    setLoading(true);
    setError("");
    try {
      const headers: Record<string, string> = { "Cache-Control": "no-store" };
      if (session.passcode) headers["X-Central-Vet-Passcode"] = session.passcode;
      const data = await readJson(await fetch(`/api/approvals?${actorQuery}`, { headers, cache: "no-store" }));
      setApprovals(data.approvals ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorQuery]);

  async function decide(id: string, status: "approved" | "rejected") {
    if (!actor) return;
    setSaving(id);
    setError("");
    try {
      await readJson(
        await fetch(`/api/approvals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor, decision: { status } })
        })
      );
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setSaving("");
    }
  }

  if (!session) {
    return (
      <main className="staffToolShell">
        <section className="staffToolPanel">
          <h1>Approvals</h1>
          <p>Open the staff task board and sign in first.</p>
          <a className="primaryButton" href="/staff">Staff task board</a>
        </section>
      </main>
    );
  }

  if (!canManage(session.role)) {
    return (
      <main className="staffToolShell">
        <section className="staffToolPanel">
          <h1>Approvals</h1>
          <p>VA, Admin, or Veterinarian access is required.</p>
          <a className="primaryButton" href="/staff">Staff task board</a>
        </section>
      </main>
    );
  }

  return (
    <main className="staffToolShell">
      <section className="staffToolPanel">
        <div className="staffToolHeader">
          <FileCheck2 size={28} />
          <div>
            <p>Central Veterinary Hospital</p>
            <h1>Approvals</h1>
          </div>
        </div>
        {error ? <div className="errorBox">{error}</div> : null}
        {loading ? <p>Loading approvals...</p> : null}
        <div className="approvalStack">
          {approvals.map((approval) => (
            <article className="approvalItem" key={approval.id}>
              <div>
                <p>{approval.approvalType.replace("_", " ")}</p>
                <h2>{approval.title}</h2>
                <span>{approval.summary}</span>
              </div>
              <div className="approvalActions">
                <button className="completeButton" type="button" disabled={Boolean(saving)} onClick={() => void decide(approval.id, "approved")}>
                  {saving === approval.id ? <Loader2 className="spinIcon" size={16} /> : <Check size={16} />}
                  Approve
                </button>
                <button className="escalateButton" type="button" disabled={Boolean(saving)} onClick={() => void decide(approval.id, "rejected")}>
                  <XCircle size={16} />
                  Reject
                </button>
              </div>
            </article>
          ))}
          {!loading && approvals.length === 0 ? <p>No pending approvals.</p> : null}
        </div>
      </section>
    </main>
  );
}
