import { createHash, randomUUID } from "node:crypto";
import {
  createAgentRun,
  createAgentToolCall,
  createWorkflowEvent,
  failAgentRun,
  updateAgentRun
} from "@central-vet/db";
import { notificationEmailFrom, sendAgentExampleEmail } from "@central-vet/notifications";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dbError, logInfo, noStoreHeaders } from "../../_shared";
import { requireManagerFromBody } from "../_auth";

export const dynamic = "force-dynamic";

const modeSchema = z.enum(["disabled", "test", "production"]);
const cadenceSchema = z.enum(["once", "monthly"]);
const emailBodySchema = z.object({
  message: z.string().trim().max(4000).optional(),
  subject: z.string().trim().max(160).optional(),
  mode: modeSchema.optional(),
  cadence: cadenceSchema.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  recipient: z.string().trim().max(320).optional(),
  to: z.union([z.string().trim().max(2000), z.array(z.string().trim().max(320)).max(20)]).optional(),
  recipients: z.array(z.string().trim().max(320)).max(20).optional()
}).passthrough();

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const emailAddressSchema = z.string().email();

function hashInput(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function summarizeInput(value: Record<string, unknown>) {
  const message = typeof value.message === "string" ? value.message : "";
  return message.trim().slice(0, 500) || "agent email send";
}

function emailsFrom(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\s;]+/) : [];
  return values.filter((item): item is string => typeof item === "string");
}

function recipientsFromBody(body: z.infer<typeof emailBodySchema>) {
  const candidates = [
    ...emailsFrom(body.recipient),
    ...emailsFrom(body.to),
    ...emailsFrom(body.recipients),
    ...(body.message?.match(emailPattern) ?? [])
  ];
  const unique = Array.from(new Set(candidates.map((item) => item.trim()).filter(Boolean)));
  return unique.filter((item) => emailAddressSchema.safeParse(item).success).slice(0, 20);
}

function cadenceFromBody(body: z.infer<typeof emailBodySchema>) {
  if (body.cadence) return body.cadence;
  return /\b(monthly|every month|per month|month-end|month end)\b/i.test(body.message ?? "") ? "monthly" : "once";
}

function resultStats(results: Array<{ status: string }>) {
  return results.reduce(
    (stats, result) => {
      stats[result.status as keyof typeof stats] = (stats[result.status as keyof typeof stats] ?? 0) + 1;
      return stats;
    },
    { sent: 0, skipped: 0, duplicate: 0, failed: 0 }
  );
}

function statusMessage(stats: ReturnType<typeof resultStats>, mode: string) {
  if (stats.sent > 0) return `Agent email sent to ${stats.sent} recipient${stats.sent === 1 ? "" : "s"}.`;
  if (stats.skipped > 0) return `Agent email prepared but not sent because notification mode is ${mode}.`;
  if (stats.duplicate > 0) return "Agent email was already processed for this idempotency key.";
  return "Agent email could not be sent; check notification recipients and Resend configuration.";
}

export async function POST(request: Request) {
  const traceId = randomUUID();
  const requestId = request.headers.get("x-request-id") || randomUUID();
  const started = Date.now();
  let runId: string | null = null;

  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;

    const parsed = emailBodySchema.safeParse(auth.body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email agent request." }, { status: 400 });
    }

    const recipients = recipientsFromBody(parsed.data);
    const mode = parsed.data.mode ?? "test";
    const cadence = cadenceFromBody(parsed.data);
    const input = {
      intent: "email",
      mode,
      cadence,
      period: parsed.data.period,
      subject: parsed.data.subject,
      message: parsed.data.message,
      recipients,
      actor: {
        name: auth.actor.name,
        role: auth.actor.role,
        profileId: auth.actor.profileId ?? null
      }
    };
    const run = await createAgentRun({
      agent: "internal",
      intent: "email",
      mode,
      status: "running",
      input,
      traceId,
      requestId,
      inputHash: hashInput(input),
      inputSummary: summarizeInput(input)
    });
    runId = run.id;

    const sent = await sendAgentExampleEmail({
      modeOverride: mode,
      recipients,
      subject: parsed.data.subject,
      message: parsed.data.message,
      actorName: auth.actor.name,
      cadence,
      period: parsed.data.period
    });
    const stats = resultStats(sent.results);
    const message = statusMessage(stats, mode);
    const durationMs = Date.now() - started;
    const toolCall = await createAgentToolCall({
      runId,
      traceId,
      sequence: 1,
      toolName: "send_agent_example_email",
      status: stats.failed > 0 && stats.sent === 0 && stats.skipped === 0 && stats.duplicate === 0 ? "error" : "ok",
      args: {
        from: notificationEmailFrom(),
        recipients: recipients.length > 0 ? recipients : "env configured recipients",
        subject: sent.subject,
        cadence,
        period: sent.period,
        mode
      },
      result: sent,
      error: stats.failed > 0 && stats.sent === 0 ? "No email was sent." : null,
      durationMs
    });
    const event = await createWorkflowEvent({
      runId,
      workflowType: "email",
      eventType: "agent_email_checked",
      title: "Agent email send checked",
      detail: message,
      metadata: {
        traceId,
        from: sent.from,
        recipientCount: recipients.length,
        mode,
        cadence,
        period: sent.period,
        stats
      }
    });
    await updateAgentRun(runId, {
      status: "completed",
      output: {
        ok: true,
        mode,
        intent: "email",
        message,
        result: sent,
        cadence,
        period: sent.period,
        stats
      },
      error: null,
      durationMs,
      outputSummary: message,
      toolCallCount: 1
    });
    logInfo("agent_email_checked", { mode, resultCount: sent.results.length });

    return NextResponse.json(
      {
        ok: true,
        runId,
        traceId,
        durationMs,
        status: "completed",
        mode,
        intent: "email",
        message,
        cadence,
        period: sent.period,
        result: sent,
        workflowEvents: [event],
        toolCalls: [toolCall]
      },
      {
        headers: {
          ...noStoreHeaders,
          "x-vetagent-run-id": runId,
          "x-vetagent-trace-id": traceId
        }
      }
    );
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "Agent email workflow failed.";
    if (runId) {
      await failAgentRun(runId, {
        error: message,
        errorKind: error instanceof Error ? error.name : "agent_email_error",
        durationMs,
        toolCallCount: 0
      }).catch(() => null);
      await createWorkflowEvent({
        runId,
        workflowType: "email",
        eventType: "run_failed",
        title: "Agent email run failed",
        detail: message,
        metadata: { traceId, requestId }
      }).catch(() => null);
    }
    return dbError(error, { route: "agent.email" });
  }
}
