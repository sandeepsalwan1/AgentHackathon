"use client";

import { Bot, ClipboardList, FileCheck2, Loader2, Mail, ReceiptText, Search, Stethoscope } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { canManage } from "../lib/taskWorkflow";
import { useClinicBrand } from "./ClinicContext";
import { readStoredTaskBoardSession } from "./taskBoardBrowserState";
import type { TaskBoardSession as Session } from "./taskBoardTypes";

type AgentResult = {
  message?: string;
  mode?: string;
  intent?: string;
  runId?: string;
  task?: { id: string };
  approval?: { id: string };
  report?: { id: string; title?: string; summary?: string };
  result?: {
    from?: string;
    subject?: string;
    results?: Array<{
      recipient: string;
      status: string;
      channel: string;
      resendId?: string | null;
      error?: string;
    }>;
  };
};

const quickActions = [
  { intent: "daily_ops", label: "Daily ops", icon: ClipboardList, endpoint: "/api/agent/daily-ops" },
  { intent: "pricing", label: "Pricing", icon: Search, endpoint: "/api/agent/pricing" },
  { intent: "invoice", label: "Invoices", icon: ReceiptText, endpoint: "/api/agent/invoice" },
  {
    intent: "email",
    label: "Email",
    icon: Mail,
    endpoint: "/api/agent/email",
    prompt: "Send the monthly example email from VetAgent."
  },
  { intent: "records", label: "Records", icon: FileCheck2, endpoint: "/api/agent/internal" },
  { intent: "sick_pet", label: "Sick pet", icon: Stethoscope, endpoint: "/api/agent/internal" }
] as const;

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data as AgentResult;
}

export function StaffAgentConsole() {
  const clinic = useClinicBrand();
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("Summarize what front desk should do next.");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSession(readStoredTaskBoardSession());
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
  const emailResults = result?.intent === "email" ? result.result?.results ?? [] : [];

  async function run(endpoint: string, intent?: string, promptOverride?: string) {
    if (!actor) return;
    const requestMessage = promptOverride ?? message;
    setLoading(intent || "freeform");
    setError("");
    setResult(null);
    try {
      setResult(
        await readJson(
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actor, ...(intent ? { intent } : {}), message: requestMessage })
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
            <p>{clinic.name}</p>
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
                onClick={() => void run(action.endpoint, action.intent, "prompt" in action ? action.prompt : undefined)}
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
                {result.intent === "email" && result.result?.from ? (
                  <div>
                    <dt>from</dt>
                    <dd>{result.result.from}</dd>
                  </div>
                ) : null}
              </dl>
              {emailResults.length > 0 ? (
                <div className="agentEmailResults">
                  {emailResults.map((item) => (
                    <div key={`${item.channel}-${item.recipient || item.status}`}>
                      <span>{item.recipient || "configured recipients"}</span>
                      <strong>{item.status}</strong>
                      {item.error ? <em>{item.error}</em> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
