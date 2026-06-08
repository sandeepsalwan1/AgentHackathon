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
  capability?: string;
  runId?: string;
  decisionIds?: string[];
  task?: { id: string };
  approval?: { id: string };
  report?: { id: string; title?: string; summary?: string };
  decision?: { kind?: string; status?: string; ttl?: string };
  confirmation?: {
    cadence?: string;
    audience?: string;
    recipientCount?: number;
    templateReviewed?: boolean;
    postAppointmentDelayDays?: number | null;
  };
  result?: {
    blocked?: boolean;
    blockers?: string[];
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

type AgentDecisionRow = {
  id: string;
  runId: string | null;
  agent: string;
  capability: string;
  decisionKind: string;
  status: string;
  action: string;
  resultSummary: string | null;
  createdAt: string;
};

type AgentMemoryRow = {
  id: string;
  subjectType: string;
  subjectId: string | null;
  memoryType: string;
  fact: string;
  confidence: number;
  createdAt: string;
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
  const [emailMode, setEmailMode] = useState<"disabled" | "test" | "production">("disabled");
  const [emailCadence, setEmailCadence] = useState<"once" | "monthly" | "post_appointment">("monthly");
  const [templateReviewed, setTemplateReviewed] = useState(false);
  const [productionConfirmed, setProductionConfirmed] = useState(false);
  const [postAppointmentDelayDays, setPostAppointmentDelayDays] = useState(7);
  const [decisions, setDecisions] = useState<AgentDecisionRow[]>([]);
  const [memories, setMemories] = useState<AgentMemoryRow[]>([]);
  const [memoryFact, setMemoryFact] = useState("");
  const [memorySubjectType, setMemorySubjectType] = useState("client");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");

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

  function authQuery() {
    const params = new URLSearchParams();
    if (actor?.name) params.set("name", actor.name);
    if (actor?.role) params.set("role", actor.role);
    return params;
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      ...(actor?.passcode ? { "x-central-vet-passcode": actor.passcode } : {})
    };
  }

  async function loadAudit() {
    if (!actor) return;
    setAuditLoading(true);
    setAuditError("");
    try {
      const query = authQuery();
      const [decisionResponse, memoryResponse] = await Promise.all([
        fetch(`/api/agent/decisions?${query.toString()}&limit=6`, { headers: authHeaders() }),
        fetch(`/api/agent/memory?${query.toString()}&limit=6`, { headers: authHeaders() })
      ]);
      const decisionData = await decisionResponse.json().catch(() => ({}));
      const memoryData = await memoryResponse.json().catch(() => ({}));
      if (!decisionResponse.ok) throw new Error(decisionData.error || "Decision audit failed.");
      if (!memoryResponse.ok) throw new Error(memoryData.error || "Memory audit failed.");
      setDecisions(Array.isArray(decisionData.decisions) ? decisionData.decisions : []);
      setMemories(Array.isArray(memoryData.memories) ? memoryData.memories : []);
    } catch (auditLoadError) {
      setAuditError(auditLoadError instanceof Error ? auditLoadError.message : "Audit load failed.");
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    if (!actor || !canManage(actor.role)) return;
    const auditTimer = window.setTimeout(() => {
      void loadAudit();
    }, 0);
    return () => window.clearTimeout(auditTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.name, actor?.role, actor?.passcode]);

  async function run(endpoint: string, intent?: string, promptOverride?: string) {
    if (!actor) return;
    const requestMessage = promptOverride ?? message;
    const emailPayload = intent === "email"
      ? {
          mode: emailMode,
          cadence: emailCadence,
          templateReviewed,
          confirmed: productionConfirmed,
          postAppointmentDelayDays
        }
      : {};
    setLoading(intent || "freeform");
    setError("");
    setResult(null);
    try {
      const nextResult = await readJson(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor, ...(intent ? { intent } : {}), message: requestMessage, ...emailPayload })
        })
      );
      setResult(nextResult);
      void loadAudit();
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

  async function writeMemory(method: "POST" | "PATCH" | "DELETE", id?: string) {
    if (!actor) return;
    const body = method === "DELETE"
      ? { actor, id, correctionNote: "Deleted from staff agent console." }
      : {
          actor,
          ...(id ? { id, correctionNote: "Corrected from staff agent console." } : {}),
          subjectType: memorySubjectType,
          fact: memoryFact,
          memoryType: "preference"
        };
    setAuditError("");
    try {
      const response = await fetch("/api/agent/memory", {
        method,
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Memory update failed.");
      setMemoryFact("");
      await loadAudit();
    } catch (memoryError) {
      setAuditError(memoryError instanceof Error ? memoryError.message : "Memory update failed.");
    }
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
        <div className="staffAgentControls">
          <label>
            Email mode
            <select value={emailMode} onChange={(event) => setEmailMode(event.target.value as typeof emailMode)}>
              <option value="disabled">disabled</option>
              <option value="test">test</option>
              <option value="production">production</option>
            </select>
          </label>
          <label>
            Cadence
            <select value={emailCadence} onChange={(event) => setEmailCadence(event.target.value as typeof emailCadence)}>
              <option value="once">once</option>
              <option value="monthly">monthly</option>
              <option value="post_appointment">post-appointment</option>
            </select>
          </label>
          {emailCadence === "post_appointment" ? (
            <label>
              Delay days
              <input
                type="number"
                min={1}
                max={90}
                value={postAppointmentDelayDays}
                onChange={(event) => setPostAppointmentDelayDays(Number(event.target.value) || 7)}
              />
            </label>
          ) : null}
          <label className="toggleLine">
            <input
              type="checkbox"
              checked={templateReviewed}
              onChange={(event) => setTemplateReviewed(event.target.checked)}
            />
            Template reviewed
          </label>
          <label className="toggleLine">
            <input
              type="checkbox"
              checked={productionConfirmed}
              onChange={(event) => setProductionConfirmed(event.target.checked)}
            />
            Production confirmed
          </label>
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
                {result.capability ? (
                  <div>
                    <dt>capability</dt>
                    <dd>{result.capability}</dd>
                  </div>
                ) : null}
                {result.decision?.status ? (
                  <div>
                    <dt>decision</dt>
                    <dd>{result.decision.status}</dd>
                  </div>
                ) : null}
                {result.decisionIds?.length ? (
                  <div>
                    <dt>decision id</dt>
                    <dd>{result.decisionIds[0]}</dd>
                  </div>
                ) : null}
                {result.confirmation?.cadence ? (
                  <div>
                    <dt>cadence</dt>
                    <dd>{result.confirmation.cadence}</dd>
                  </div>
                ) : null}
                {result.intent === "email" && result.result?.from ? (
                  <div>
                    <dt>from</dt>
                    <dd>{result.result.from}</dd>
                  </div>
                ) : null}
              </dl>
              {result.result?.blockers?.length ? (
                <div className="agentEmailResults">
                  {result.result.blockers.map((blocker) => (
                    <div key={blocker}>
                      <span>{blocker}</span>
                      <strong>blocked</strong>
                    </div>
                  ))}
                </div>
              ) : null}
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
        <div className="staffAgentAudit">
          <section>
            <div className="staffAgentAuditHeader">
              <h2>Decisions</h2>
              <button className="plainButton" type="button" onClick={() => void loadAudit()} disabled={auditLoading}>
                {auditLoading ? <Loader2 className="spinIcon" size={15} /> : <Search size={15} />}
                Refresh
              </button>
            </div>
            {decisions.length > 0 ? (
              <div className="agentEmailResults">
                {decisions.map((decision) => (
                  <div key={decision.id}>
                    <span>{decision.decisionKind} - {decision.action}</span>
                    <strong>{decision.status}</strong>
                    <em>{decision.resultSummary || decision.capability}</em>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mutedLine">No decisions yet.</p>
            )}
          </section>
          <section>
            <div className="staffAgentAuditHeader">
              <h2>Memory</h2>
            </div>
            <div className="staffMemoryEditor">
              <select value={memorySubjectType} onChange={(event) => setMemorySubjectType(event.target.value)}>
                <option value="client">client</option>
                <option value="pet">pet</option>
                <option value="clinic">clinic</option>
              </select>
              <input
                value={memoryFact}
                onChange={(event) => setMemoryFact(event.target.value)}
                placeholder="Preference or durable fact"
              />
              <button className="plainButton" type="button" disabled={!memoryFact.trim()} onClick={() => void writeMemory("POST")}>
                Add
              </button>
            </div>
            {memories.length > 0 ? (
              <div className="agentEmailResults">
                {memories.map((memory) => (
                  <div key={memory.id}>
                    <span>{memory.fact}</span>
                    <strong>{memory.subjectType}</strong>
                    <em>
                      <button className="textButton" type="button" disabled={!memoryFact.trim()} onClick={() => void writeMemory("PATCH", memory.id)}>
                        Correct
                      </button>
                      <button className="textButton dangerTextButton" type="button" onClick={() => void writeMemory("DELETE", memory.id)}>
                        Delete
                      </button>
                    </em>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mutedLine">No memory yet.</p>
            )}
            {auditError ? <div className="errorBox">{auditError}</div> : null}
          </section>
        </div>
      </section>
    </main>
  );
}
