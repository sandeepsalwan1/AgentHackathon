"use client";

import { Bot, CheckCircle2, Loader2, Send } from "lucide-react";
import { FormEvent, useState } from "react";

type PublicAgentFlowProps = {
  title: string;
  endpoint: string;
  intent: string;
  prompt: string;
  placeholder: string;
  buttonLabel: string;
  transcript?: boolean;
  destination?: boolean;
};

type AgentResponse = {
  ok?: boolean;
  intent?: string;
  mode?: string;
  message?: string;
  runId?: string;
  task?: { id: string; request?: string; priority?: string };
  approval?: { id: string; title?: string };
  result?: Record<string, unknown>;
};

const blanks = {
  clientName: "",
  clientPhone: "",
  petName: "",
  destination: "",
  message: ""
};

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data as AgentResponse;
}

function titleize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function displayValue(value: unknown) {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value : null;
}

function resultSummaryItems(result?: Record<string, unknown>) {
  if (!result) return [];
  const items: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    const text = displayValue(value);
    if (text) items.push({ label, value: text });
  };
  add("action", typeof result.action === "string" ? titleize(result.action) : null);
  add("confirmation", result.confirmationId);
  const appointment = recordValue(result.appointment);
  if (appointment) {
    const date = displayValue(appointment.appointmentDate);
    const time = displayValue(appointment.appointmentTime);
    const doctor = displayValue(appointment.doctor);
    const type = displayValue(appointment.appointmentType);
    add("appointment", [type, date, time, doctor ? `with ${doctor}` : ""].filter(Boolean).join(" "));
    add("status", appointment.status);
  }
  if (typeof result.waitEstimateMinutes === "number") add("wait", `${result.waitEstimateMinutes} min`);
  if (typeof result.ready === "boolean") add("pickup ready", result.ready);
  const statusUpdate = recordValue(result.statusUpdate);
  if (statusUpdate) add("portal update", statusUpdate.queued ? "queued" : statusUpdate.delivery);
  const outreach = recordValue(result.outreach);
  if (outreach) add("outreach", `${displayValue(outreach.status) ?? "queued"} via ${displayValue(outreach.channel) ?? "portal"}`);
  if (result.requiresApproval === true) add("checkpoint", "pending");
  if (typeof result.recordsSentAutomatically === "boolean") add("records transfer", result.recordsSentAutomatically ? "queued" : "not queued");
  return items.slice(0, 6);
}

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

export function PublicAgentFlow({
  title,
  endpoint,
  intent,
  prompt,
  placeholder,
  buttonLabel,
  transcript = false,
  destination = false
}: PublicAgentFlowProps) {
  const [form, setForm] = useState(blanks);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const resultItems = resultSummaryItems(response?.result);

  const update = (key: keyof typeof blanks, value: string) => {
    setForm({ ...form, [key]: value });
    setError("");
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setResponse(null);
    try {
      const payload = {
        intent,
        clientName: form.clientName,
        clientPhone: form.clientPhone,
        phone: form.clientPhone,
        petName: form.petName,
        destination: form.destination,
        message: transcript ? "" : form.message,
        transcript: transcript ? form.message : ""
      };
      setResponse(
        await readJson(
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
        )
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="publicShell">
      <section className="publicPanel">
        <div className="publicHeader">
          <Bot size={28} />
          <div>
            <p>Central Veterinary Hospital</p>
            <h1>{title}</h1>
          </div>
        </div>
        <form className="publicForm" onSubmit={submit}>
          <div className="publicGrid">
            <label>
              Your name
              <input
                value={form.clientName}
                onChange={(event) => update("clientName", event.target.value)}
                autoFocus
              />
            </label>
            <label>
              Phone
              <input
                value={form.clientPhone}
                onChange={(event) => update("clientPhone", formatPhoneInput(event.target.value))}
                inputMode="tel"
              />
            </label>
            <label>
              Pet name
              <input value={form.petName} onChange={(event) => update("petName", event.target.value)} />
            </label>
            {destination ? (
              <label>
                Destination hospital
                <input value={form.destination} onChange={(event) => update("destination", event.target.value)} />
              </label>
            ) : null}
          </div>
          <label>
            {prompt}
            <textarea
              rows={6}
              value={form.message}
              placeholder={placeholder}
              onChange={(event) => update("message", event.target.value)}
            />
          </label>
          {error ? <div className="errorBox">{error}</div> : null}
          <button className="sendButton" type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="spinIcon" size={18} /> : <Send size={18} />}
            {submitting ? "Sending" : buttonLabel}
          </button>
        </form>
        {response ? (
          <div className="agentResult">
            <CheckCircle2 size={26} />
            <div>
              <h2>{response.intent || "Done"}</h2>
              <p>{response.message}</p>
              <dl>
                {resultItems.map((item) => (
                  <div key={`${item.label}-${item.value}`}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
                <div>
                  <dt>mode</dt>
                  <dd>{response.mode || "mock"}</dd>
                </div>
                {response.task?.id ? (
                  <div>
                    <dt>task</dt>
                    <dd>{response.task.id}</dd>
                  </div>
                ) : null}
                {response.approval?.id ? (
                  <div>
                    <dt>approval</dt>
                    <dd>{response.approval.id}</dd>
                  </div>
                ) : null}
                {response.runId ? (
                  <div>
                    <dt>run</dt>
                    <dd>{response.runId}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        ) : null}
      </section>
      <nav className="publicNav" aria-label="Client flows">
        <a href="/arrival">Arrival</a>
        <a href="/booking">Booking</a>
        <a href="/pickup">Pickup</a>
        <a href="/records">Records</a>
        <a href="/followup">Follow-up</a>
        <a href="/request">Request</a>
        <a href="/staff">Staff</a>
      </nav>
    </main>
  );
}
