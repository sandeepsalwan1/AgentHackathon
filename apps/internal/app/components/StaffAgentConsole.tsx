"use client";

import { Bot, FileCheck2, Loader2, ReceiptText, Search, Stethoscope, ClipboardList } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AppRole } from "@central-vet/db";
import { canManage } from "../lib/taskWorkflow";

type Session = {
  name: string;
  role: AppRole;
  passcode?: string;
  profileId?: string | null;
};

type AgentResult = {
  message?: string;
  mode?: string;
  intent?: string;
  runId?: string;
  task?: { id: string };
  approval?: { id: string };
  report?: { id: string; title?: string; summary?: string };
};

const sessionKey = "central-vet-session";
const quickActions = [
  { intent: "daily_ops", label: "Daily ops", icon: ClipboardList, endpoint: "/api/agent/daily-ops" },
  { intent: "pricing", label: "Pricing", icon: Search, endpoint: "/api/agent/pricing" },
  { intent: "invoice", label: "Invoices", icon: ReceiptText, endpoint: "/api/agent/invoice" },
  { intent: "records", label: "Records", icon: FileCheck2, endpoint: "/api/agent/internal" },
  { intent: "sick_pet", label: "Sick pet", icon: Stethoscope, endpoint: "/api/agent/internal" }
] as const;

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
  return data as AgentResult;
}

export function StaffAgentConsole() {
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("Summarize what front desk should do next.");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);

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

  async function run(endpoint: string, intent?: string) {
    if (!actor) return;
    setLoading(intent || "freeform");
    setError("");
    setResult(null);
    try {
      setResult(
        await readJson(
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actor, ...(intent ? { intent } : {}), message })
          })
        )
      );
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Agent failed.");
    } finally {
      setLoading("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run("/api/agent/internal");
  }

  if (!session) {
    return (
      <main className="staffToolShell">
        <section className="staffToolPanel">
          <h1>Internal Agent</h1>
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
          <h1>Internal Agent</h1>
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
          <Bot size={28} />
          <div>
            <p>Central Veterinary Hospital</p>
            <h1>Internal Agent</h1>
          </div>
        </div>
        <div className="staffQuickActions">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.intent}
                type="button"
                className="plainButton"
                disabled={Boolean(loading)}
                onClick={() => void run(action.endpoint, action.intent)}
              >
                {loading === action.intent ? <Loader2 className="spinIcon" size={17} /> : <Icon size={17} />}
                {action.label}
              </button>
            );
          })}
        </div>
        <form className="staffAgentPrompt" onSubmit={submit}>
          <label>
            Agent request
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} />
          </label>
          <button className="primaryButton" type="submit" disabled={Boolean(loading)}>
            {loading ? <Loader2 className="spinIcon" size={17} /> : <Bot size={17} />}
            Run Agent
          </button>
        </form>
        {error ? <div className="errorBox">{error}</div> : null}
        {result ? (
          <div className="agentResult staffAgentResult">
            <Bot size={24} />
            <div>
              <h2>{result.intent || "agent"}</h2>
              <p>{result.message}</p>
              <dl>
                <div>
                  <dt>mode</dt>
                  <dd>{result.mode || "mock"}</dd>
                </div>
                {result.task?.id ? (
                  <div>
                    <dt>task</dt>
                    <dd>{result.task.id}</dd>
                  </div>
                ) : null}
                {result.approval?.id ? (
                  <div>
                    <dt>approval</dt>
                    <dd>{result.approval.id}</dd>
                  </div>
                ) : null}
                {result.report?.id ? (
                  <div>
                    <dt>report</dt>
                    <dd>{result.report.id}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
