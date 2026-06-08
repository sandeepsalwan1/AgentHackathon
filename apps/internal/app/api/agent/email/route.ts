import { createHash, randomUUID } from "node:crypto";
import {
  createAgentDecision,
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
const cadenceSchema = z.enum(["once", "monthly", "post_appointment"]);
const audienceSchema = z.enum(["explicit_recipients", "all_active_clients", "recent_clients", "recent_appointments"]);
const emailBodySchema = z.object({
  message: z.string().trim().max(4000).optional(),
  subject: z.string().trim().max(160).optional(),
  mode: modeSchema.optional(),
  cadence: cadenceSchema.optional(),
  audience: audienceSchema.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  recipient: z.string().trim().max(320).optional(),
  to: z.union([z.string().trim().max(2000), z.array(z.string().trim().max(320)).max(20)]).optional(),
  recipients: z.array(z.string().trim().max(320)).max(20).optional(),
  recipientCount: z.number().int().min(0).optional(),
  templateId: z.string().trim().max(80).optional(),
  templateVersion: z.string().trim().max(80).optional(),
  templateReviewed: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  sendNow: z.boolean().optional(),
  scheduledFor: z.string().trim().max(80).optional(),
  postAppointmentDelayDays: z.number().int().min(1).max(90).optional()
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
  if (/\b(post[- ]?appointment|after appointment|after visit|follow[- ]?up)\b/i.test(body.message ?? "")) {
    return "post_appointment";
  }
  return /\b(monthly|every month|per month|month-end|month end)\b/i.test(body.message ?? "") ? "monthly" : "once";
}

function audienceFromBody(body: z.infer<typeof emailBodySchema>, cadence: z.infer<typeof cadenceSchema>, recipients: string[]) {
  if (body.audience) return body.audience;
  if (recipients.length > 0) return "explicit_recipients";
  if (cadence === "post_appointment") return "recent_appointments";
  if (cadence === "monthly") return "all_active_clients";
  return "explicit_recipients";
}

function emailConfirmation(input: {
  body: z.infer<typeof emailBodySchema>;
  mode: z.infer<typeof modeSchema>;
  cadence: z.infer<typeof cadenceSchema>;
  audience: z.infer<typeof audienceSchema>;
  recipients: string[];
  actorProfileId?: string | null;
}) {
  const recipientCount = input.body.recipientCount ?? input.recipients.length;
  return {
    mode: input.mode,
    cadence: input.cadence,
    audience: input.audience,
    recipientCount,
    subject: input.body.subject?.trim() || "Clinic agent email",
    templateId: input.body.templateId?.trim() || `${input.cadence}-default`,
    templateVersion: input.body.templateVersion?.trim() || "draft",
    templateReviewed: input.body.templateReviewed ?? input.mode === "disabled",
    reviewedByActorId: input.actorProfileId ?? "unknown",
    sendNow: input.body.sendNow ?? input.cadence === "once",
    scheduledFor: input.body.scheduledFor,
    postAppointmentDelayDays: input.cadence === "post_appointment"
      ? input.body.postAppointmentDelayDays ?? 7
      : undefined
  };
}

function emailBlockers(confirmation: ReturnType<typeof emailConfirmation>, confirmed: boolean | undefined) {
  const blockers: string[] = [];
  const riskySend = confirmation.mode !== "disabled" &&
    (confirmation.mode === "production" || confirmation.cadence !== "once" || confirmation.recipientCount > 1);
  if (riskySend && !confirmation.templateReviewed) blockers.push("template_review_required");
  if (confirmation.mode === "production" && !confirmed) blockers.push("production_confirmation_required");
  if (confirmation.mode === "production" && confirmation.recipientCount > 500) blockers.push("recipient_count_too_high");
  if (confirmation.cadence === "post_appointment" && confirmation.audience !== "recent_appointments") {
    blockers.push("post_appointment_requires_recent_appointments_audience");
  }
  if (confirmation.cadence === "monthly" && confirmation.audience === "recent_appointments") {
    blockers.push("monthly_audience_mismatch");
  }
  return blockers;
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

function blockedMessage(blockers: string[]) {
  if (blockers.includes("template_review_required")) return "Agent email needs template review before sending.";
  if (blockers.includes("production_confirmation_required")) return "Agent email needs explicit production confirmation before sending.";
  return "Agent email needs confirmation before sending.";
}

export async function POST(request: Request) {
  const traceId = randomUUID();
  const requestId = request.headers.get("x-request-id") || randomUUID();
  const started = Date.now();
  let runId: string | null = null;
  let clinicId: string | null = null;

  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    clinicId = auth.clinic.clinicId;

    const parsed = emailBodySchema.safeParse(auth.body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email agent request." }, { status: 400 });
    }

    const recipients = recipientsFromBody(parsed.data);
    const mode = parsed.data.mode ?? "test";
    const cadence = cadenceFromBody(parsed.data);
    const audience = audienceFromBody(parsed.data, cadence, recipients);
    const confirmation = emailConfirmation({
      body: parsed.data,
      mode,
      cadence,
      audience,
      recipients,
      actorProfileId: auth.actor.profileId ?? null
    });
    const blockers = emailBlockers(confirmation, parsed.data.confirmed);
    const capabilityDecision = {
      agent: "internal",
      agentKind: "internal",
      capability: "internal_email",
      parsedInput: {
        mode,
        cadence,
        audience,
        subject: confirmation.subject,
        recipientCount: confirmation.recipientCount,
        templateId: confirmation.templateId,
        templateVersion: confirmation.templateVersion,
        templateReviewed: confirmation.templateReviewed,
        sendNow: confirmation.sendNow,
        scheduledFor: confirmation.scheduledFor ?? null,
        postAppointmentDelayDays: confirmation.postAppointmentDelayDays ?? null
      },
      requiredMissingFields: blockers,
      riskLevel: mode === "production" || cadence !== "once" ? "high" : "medium",
      cachePolicy: "none",
      nextAction: blockers.length ? "confirm" : "call_tool"
    };
    const input = {
      intent: "email",
      mode,
      cadence,
      audience,
      period: parsed.data.period,
      subject: parsed.data.subject,
      message: parsed.data.message,
      recipients,
      confirmation,
      actor: {
        name: auth.actor.name,
        role: auth.actor.role,
        profileId: auth.actor.profileId ?? null
      }
    };
    const run = await createAgentRun({
      clinicId,
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

    if (blockers.length > 0) {
      const message = blockedMessage(blockers);
      const durationMs = Date.now() - started;
      const toolCall = await createAgentToolCall({
        clinicId,
        runId,
        traceId,
        sequence: 1,
        toolName: "validate_email_campaign_confirmation",
        status: "ok",
        args: { confirmation },
        result: { blocked: true, blockers },
        error: null,
        durationMs
      });
      const event = await createWorkflowEvent({
        clinicId,
        runId,
        workflowType: "email",
        eventType: "agent_email_decision",
        title: "Agent email blocked for confirmation",
        detail: message,
        metadata: {
          traceId,
          status: "blocked",
          blockers,
          confirmation,
          capabilityDecision
        }
      });
      const decisionRow = await createAgentDecision({
        clinicId,
        runId,
        traceId,
        agent: "internal",
        capability: "internal_email",
        decisionKind: "email_campaign",
        status: "blocked",
        ttl: "long",
        actor: auth.actor,
        action: "validate_email_campaign_confirmation",
        inputSummary: summarizeInput(input),
        resultSummary: message,
        metadata: { blockers, confirmation, capabilityDecision }
      });
      await updateAgentRun(runId, {
        clinicId,
        status: "completed",
        output: {
          ok: true,
          mode,
          intent: "email",
          capability: "internal_email",
          capabilityDecision,
          message,
          result: { blocked: true, blockers, confirmation },
          cadence,
          audience,
          period: parsed.data.period ?? null,
          confirmation,
          decision: {
            kind: "email_campaign",
            status: "blocked",
            ttl: "long"
          },
          decisionIds: [decisionRow.id]
        },
        error: null,
        durationMs,
        outputSummary: message,
        toolCallCount: 1
      });
      logInfo("agent_email_blocked", { mode, cadence, blockers: blockers.join(", ") });

      return NextResponse.json(
        {
          ok: true,
          runId,
          traceId,
          durationMs,
          status: "completed",
          mode,
          intent: "email",
          capability: "internal_email",
          capabilityDecision,
          message,
          cadence,
          audience,
          period: parsed.data.period ?? null,
          confirmation,
          decision: {
            kind: "email_campaign",
            status: "blocked",
            ttl: "long"
          },
          decisionIds: [decisionRow.id],
          result: { blocked: true, blockers, confirmation },
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
    }

    const sent = await sendAgentExampleEmail({
      clinicId,
      timeZone: auth.clinic.timeZone,
      modeOverride: mode,
      recipients,
      subject: parsed.data.subject,
      message: parsed.data.message,
      actorName: auth.actor.name,
      cadence,
      period: parsed.data.period,
      postAppointmentDelayDays: confirmation.postAppointmentDelayDays
    });
    const stats = resultStats(sent.results);
    const message = statusMessage(stats, mode);
    const durationMs = Date.now() - started;
    const decisionStatus = stats.sent > 0 ? "completed" : stats.skipped > 0 ? "blocked" : "proposed";
    const toolCall = await createAgentToolCall({
      clinicId,
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
        audience,
        period: sent.period,
        mode
      },
      result: sent,
      error: stats.failed > 0 && stats.sent === 0 ? "No email was sent." : null,
      durationMs
    });
    const event = await createWorkflowEvent({
      clinicId,
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
        audience,
        period: sent.period,
        stats,
        confirmation,
        capabilityDecision
      }
    });
    const decisionRow = await createAgentDecision({
      clinicId,
      runId,
      traceId,
      agent: "internal",
      capability: "internal_email",
      decisionKind: "email_campaign",
      status: decisionStatus,
      ttl: "long",
      actor: auth.actor,
      action: "send_agent_email",
      inputSummary: summarizeInput(input),
      resultSummary: message,
      metadata: { stats, confirmation, capabilityDecision, sent }
    });
    await updateAgentRun(runId, {
      clinicId,
      status: "completed",
      output: {
        ok: true,
        mode,
        intent: "email",
        capability: "internal_email",
        capabilityDecision,
        message,
        result: sent,
        cadence,
        audience,
        period: sent.period,
        stats,
        confirmation,
        decision: {
          kind: "email_campaign",
          status: decisionStatus,
          ttl: "long"
        },
        decisionIds: [decisionRow.id]
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
        capability: "internal_email",
        capabilityDecision,
        message,
        cadence,
        audience,
        period: sent.period,
        confirmation,
        decision: {
          kind: "email_campaign",
          status: decisionStatus,
          ttl: "long"
        },
        decisionIds: [decisionRow.id],
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
        clinicId,
        error: message,
        errorKind: error instanceof Error ? error.name : "agent_email_error",
        durationMs,
        toolCallCount: 0
      }).catch(() => null);
      await createWorkflowEvent({
        clinicId,
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
