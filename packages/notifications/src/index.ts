import { randomUUID } from "node:crypto";
import {
  archiveCompletedTasksBefore,
  createNotificationAttempt,
  listIncompletePriorityTasks,
  listRecipientProfiles,
  markNotificationFailed,
  markNotificationSent,
  markNotificationSkipped,
  type Task
} from "@central-vet/db";
import { Resend } from "resend";

export type NotificationMode = "disabled" | "test" | "production";
export type NotificationChannel = "email" | "sms" | "both";
export type AgentEmailCadence = "once" | "monthly";

type SendResult = {
  recipient: string;
  status: "sent" | "skipped" | "duplicate" | "failed";
  channel: "email" | "sms";
  resendId?: string | null;
  error?: string;
};

type Delivery = { channel: "email" | "sms"; recipients: string[] };
type ProfileAlertKind = "escalation" | "dailyPriority";

const defaultEmailFrom = "Central Veterinary Hospital <notifications@eepish.com>";
const systemActor = { name: "System", role: "admin" as const };

export function notificationEmailFrom() {
  return process.env.EMAIL_FROM || defaultEmailFrom;
}

function mode(): NotificationMode {
  const value = process.env.NOTIFICATION_MODE;
  if (value === "test" || value === "production") return value;
  return "disabled";
}

function channel(): NotificationChannel {
  const value = process.env.NOTIFICATION_CHANNEL;
  if (value === "sms" || value === "both") return value;
  return "email";
}

function envList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function emailRecipientsFor(currentMode: NotificationMode) {
  if (currentMode === "test") return envList(process.env.TEST_NOTIFICATION_EMAIL);
  if (currentMode === "production") {
    return envList(process.env.DOCTOR_NOTIFICATION_EMAILS);
  }
  return envList(process.env.TEST_NOTIFICATION_EMAIL || process.env.DOCTOR_NOTIFICATION_EMAILS);
}

function smsRecipientsFor(currentMode: NotificationMode) {
  if (currentMode === "test") {
    return envList(process.env.TEST_SMS_NOTIFICATION_RECIPIENTS || process.env.SMS_NOTIFICATION_RECIPIENTS);
  }
  if (currentMode === "production") {
    return envList(process.env.SMS_NOTIFICATION_RECIPIENTS);
  }
  return envList(process.env.TEST_SMS_NOTIFICATION_RECIPIENTS || process.env.SMS_NOTIFICATION_RECIPIENTS);
}

function deliveriesFor(currentMode: NotificationMode, currentChannel: NotificationChannel) {
  const deliveries: Delivery[] = [];
  if (currentChannel === "email" || currentChannel === "both") {
    deliveries.push({ channel: "email", recipients: emailRecipientsFor(currentMode) });
  }
  if (currentChannel === "sms" || currentChannel === "both") {
    deliveries.push({ channel: "sms", recipients: smsRecipientsFor(currentMode) });
  }
  return deliveries;
}

function localParts(
  timeZone = process.env.APP_TIME_ZONE || process.env.TZ || "America/Los_Angeles"
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    month: `${get("year")}-${get("month")}`,
    hour: Number(get("hour"))
  };
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sourceLabel(source: Task["source"]) {
  return source
    .replace("_form", " form")
    .replace("_request", " request")
    .replace("_", " ");
}

function formatPhone(value: string | null) {
  const clean = value?.trim();
  if (!clean) return "Not listed";
  if (clean.includes("@")) return clean;
  const digits = clean.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length === 10) {
    const formatted = `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
    return digits.length === 11 ? `+1 ${formatted}` : formatted;
  }
  if (local.length === 7) return `${local.slice(0, 3)}-${local.slice(3)}`;
  return clean;
}

function overdueHtml(tasks: Task[], localDate: string) {
  const rows = tasks
    .map(
      (task) => `
        <li style="margin:0 0 12px 0;">
          <strong>${escapeHtml(task.petName || task.clientName || "Task")}</strong>
          <span style="color:#64748b;">(${escapeHtml(task.status)} · ${escapeHtml(sourceLabel(task.source))})</span><br />
          <span>${escapeHtml(task.request)}</span><br />
          <span style="color:#64748b;">Client: ${escapeHtml(task.clientName || "Not listed")} · Phone: ${escapeHtml(formatPhone(task.clientPhone))} · Due: ${escapeHtml(task.dueDate)}</span>
        </li>`
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.45;">
      <h1 style="font-size:20px;margin:0 0 12px;">Central Veterinary Hospital overdue task summary</h1>
      <p style="margin:0 0 16px;">${tasks.length} medium/high priority task${tasks.length === 1 ? "" : "s"} are still open at end of day ${escapeHtml(localDate)}.</p>
      <ul style="padding-left:20px;margin:0;">${rows}</ul>
    </div>
  `;
}

function priorityTaskHtml(task: Task) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.45;">
      <h1 style="font-size:20px;margin:0 0 12px;">Central Veterinary Hospital ${escapeHtml(task.priority)} priority task</h1>
      <p style="margin:0 0 12px;">A ${escapeHtml(task.priority)} priority task was added and is ready for review/action.</p>
      <p style="margin:0 0 8px;"><strong>${escapeHtml(task.petName || task.clientName || "Task")}</strong></p>
      <p style="margin:0 0 8px;">${escapeHtml(task.request)}</p>
      <p style="margin:0;color:#64748b;">Client: ${escapeHtml(task.clientName || "Not listed")} · Phone: ${escapeHtml(formatPhone(task.clientPhone))} · Due: ${escapeHtml(task.dueDate)} · Source: ${escapeHtml(sourceLabel(task.source))}</p>
    </div>
  `;
}

function agentExampleHtml(message: string, sentBy: string | undefined, localDate: string) {
  const byline = sentBy ? `<p style="margin:0 0 12px;color:#64748b;">Sent by ${escapeHtml(sentBy)} via VetAgent.</p>` : "";
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.45;">
      <h1 style="font-size:20px;margin:0 0 12px;">Central Veterinary Hospital agent email</h1>
      ${byline}
      <p style="margin:0 0 12px;">${escapeHtml(message)}</p>
      <p style="margin:0;color:#64748b;">Example send verified for ${escapeHtml(localDate)}.</p>
    </div>
  `;
}

function agentExampleText(message: string, sentBy: string | undefined, localDate: string) {
  const byline = sentBy ? ` Sent by ${sentBy} via VetAgent.` : "";
  return truncateText(`Central Veterinary Hospital agent email.${byline} ${message} Example send verified for ${localDate}.`);
}

function truncateText(value: string, maxLength = 480) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

function overdueText(tasks: Task[], localDate: string) {
  const firstTasks = tasks
    .slice(0, 3)
    .map((task) => {
      const name = task.petName || task.clientName || "Task";
      const phone = task.clientPhone ? ` ${formatPhone(task.clientPhone)}` : "";
      return `${name}: ${task.request}${phone}`;
    })
    .join(" | ");
  const more = tasks.length > 3 ? ` +${tasks.length - 3} more.` : "";
  return truncateText(`Central Veterinary Hospital end-of-day medium/high ${localDate}: ${tasks.length} open task${tasks.length === 1 ? "" : "s"}. ${firstTasks}${more}`);
}

function priorityTaskText(task: Task) {
  const name = task.petName || task.clientName || "Task";
  const phone = task.clientPhone ? ` Phone: ${formatPhone(task.clientPhone)}.` : "";
  return truncateText(`Central Veterinary Hospital ${task.priority} priority: ${name}. ${task.request}.${phone}`);
}

function escalationHtml(task: Task) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.45;">
      <h1 style="font-size:20px;margin:0 0 12px;">Central Veterinary Hospital escalated task</h1>
      <p style="margin:0 0 8px;"><strong>${escapeHtml(task.petName || task.clientName || "Task")}</strong></p>
      <p style="margin:0 0 8px;">${escapeHtml(task.request)}</p>
      <p style="margin:0;color:#64748b;">Client: ${escapeHtml(task.clientName || "Not listed")} · Phone: ${escapeHtml(formatPhone(task.clientPhone))} · Due: ${escapeHtml(task.dueDate)}</p>
    </div>
  `;
}

function escalationText(task: Task) {
  const name = task.petName || task.clientName || "Task";
  const phone = task.clientPhone ? ` Phone: ${formatPhone(task.clientPhone)}.` : "";
  return truncateText(`Central Veterinary Hospital escalated: ${name}. ${task.request}.${phone}`);
}

function smsAddressFor(phone: string) {
  const clean = phone.trim();
  if (clean.includes("@")) return clean;
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 10) return `${digits}@vtext.com`;
  if (digits.length === 11 && digits.startsWith("1")) return `${digits.slice(1)}@vtext.com`;
  return "";
}

async function veterinarianDeliveries(kind: ProfileAlertKind) {
  const profiles = await listRecipientProfiles({ includeInactive: false });
  const enabledForKind = (profile: Awaited<ReturnType<typeof listRecipientProfiles>>[number]) =>
    kind === "escalation" ? profile.escalationOptIn : profile.dailyPriorityOptIn;
  const emailRecipients = profiles
    .filter((profile) => enabledForKind(profile) && profile.emailOptIn && profile.email)
    .map((profile) => profile.email);
  const smsRecipients = profiles
    .filter((profile) => enabledForKind(profile) && profile.smsOptIn && profile.phone)
    .map((profile) => smsAddressFor(profile.phone))
    .filter(Boolean);
  return [
    { channel: "email" as const, recipients: emailRecipients },
    { channel: "sms" as const, recipients: smsRecipients }
  ].filter((delivery) => delivery.recipients.length > 0);
}

async function sendNotification(args: {
  notificationType: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKeyBase: string;
  taskId?: string | null;
  modeOverride?: NotificationMode;
  channelOverride?: NotificationChannel;
  deliveriesOverride?: Delivery[];
}) {
  const currentMode = args.modeOverride ?? mode();
  const currentChannel = args.channelOverride ?? channel();
  const deliveries = args.deliveriesOverride ?? deliveriesFor(currentMode, currentChannel);
  const from = notificationEmailFrom();
  const recipientCount = deliveries.reduce((count, delivery) => count + delivery.recipients.length, 0);

  if (recipientCount === 0) {
    return [
      {
        recipient: "",
        status: "failed" as const,
        channel: currentChannel === "both" ? "sms" as const : currentChannel,
        error: "No notification recipients configured."
      }
    ];
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = currentMode === "disabled" || !resendApiKey ? null : new Resend(resendApiKey);
  const results: SendResult[] = [];

  for (const delivery of deliveries) {
    for (const recipient of delivery.recipients) {
      const idempotencyKey = `${args.idempotencyKeyBase}/${currentMode}/${delivery.channel}/${recipient}`;
      const notificationId = await createNotificationAttempt({
        taskId: args.taskId,
        notificationType: `${args.notificationType}_${delivery.channel}`,
        recipient,
        idempotencyKey
      });

      if (!notificationId) {
        results.push({ recipient, status: "duplicate", channel: delivery.channel });
        continue;
      }

      if (currentMode === "disabled") {
        await markNotificationSkipped(notificationId, "NOTIFICATION_MODE=disabled");
        results.push({ recipient, status: "skipped", channel: delivery.channel });
        continue;
      }

      if (!resend) {
        await markNotificationFailed(notificationId, "RESEND_API_KEY is required.");
        results.push({
          recipient,
          status: "failed",
          channel: delivery.channel,
          error: "RESEND_API_KEY is required."
        });
        continue;
      }

      try {
        const emailPayload =
          delivery.channel === "sms"
            ? {
                from,
                to: [recipient],
                subject: "Central Veterinary Hospital",
                text: args.text
              }
            : {
                from,
                to: [recipient],
                subject: args.subject,
                html: args.html
              };
        const { data, error } = await resend!.emails.send(
          emailPayload,
          { idempotencyKey }
        );

        if (error) {
          const message = error.message || "Resend send failed.";
          await markNotificationFailed(notificationId, message);
          results.push({ recipient, status: "failed", channel: delivery.channel, error: message });
        } else {
          await markNotificationSent(notificationId, data?.id ?? null);
          results.push({
            recipient,
            status: "sent",
            channel: delivery.channel,
            resendId: data?.id ?? null
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown send error.";
        await markNotificationFailed(notificationId, message);
        results.push({ recipient, status: "failed", channel: delivery.channel, error: message });
      }
    }
  }

  return results;
}

export async function sendPriorityTaskAlert(task: Task, options?: {
  modeOverride?: NotificationMode;
  channelOverride?: NotificationChannel;
}) {
  const results = await sendNotification({
    notificationType: "priority_task",
    subject: `Central Veterinary Hospital ${task.priority} priority task: ${task.petName || task.clientName || "New task"}`,
    html: priorityTaskHtml(task),
    text: priorityTaskText(task),
    idempotencyKeyBase: `priority-task/${task.id}/${task.priority}`,
    taskId: task.id,
    modeOverride: options?.modeOverride,
    channelOverride: options?.channelOverride
  });
  return { taskId: task.id, priority: task.priority, results };
}

export async function sendEscalationAlert(task: Task, options?: {
  modeOverride?: NotificationMode;
}) {
  const deliveries = await veterinarianDeliveries("escalation");

  if (deliveries.length === 0) {
    return {
      taskId: task.id,
      skipped: true,
      reason: "All veterinarian escalation notifications are opted out.",
      results: [] as SendResult[]
    };
  }

  const results = await sendNotification({
    notificationType: "escalation",
    subject: `Central Veterinary Hospital escalated task: ${task.petName || task.clientName || "Task"}`,
    html: escalationHtml(task),
    text: escalationText(task),
    idempotencyKeyBase: `escalation/${task.id}/${task.escalatedAt || "new"}`,
    taskId: task.id,
    modeOverride: options?.modeOverride,
    deliveriesOverride: deliveries
  });
  return { taskId: task.id, skipped: false, results };
}

export async function sendOverdueSummary(options?: {
  modeOverride?: NotificationMode;
  channelOverride?: NotificationChannel;
  force?: boolean;
}) {
  const { date, hour } = localParts();
  const requiredHour = Number(process.env.OVERDUE_CHECK_HOUR ?? 18);
  const archivedCompleted = await archiveCompletedTasksBefore(
    date,
    systemActor,
    process.env.APP_TIME_ZONE || process.env.TZ || "America/Los_Angeles"
  );
  if (!options?.force && hour < requiredHour) {
    return {
      skipped: true,
      reason: `Local hour ${hour} is before ${requiredHour}.`,
      localDate: date,
      archivedCompletedCount: archivedCompleted.length,
      taskCount: 0,
      results: [] as SendResult[]
    };
  }

  const tasks = await listIncompletePriorityTasks(date);
  if (tasks.length === 0) {
    return {
      skipped: false,
      reason: "No incomplete medium/high priority tasks.",
      localDate: date,
      archivedCompletedCount: archivedCompleted.length,
      taskCount: 0,
      results: [] as SendResult[]
    };
  }

  const currentMode = options?.modeOverride ?? mode();
  const deliveries = await veterinarianDeliveries("dailyPriority");
  if (deliveries.length === 0) {
    return {
      skipped: true,
      reason: "All veterinarian daily medium/high alerts are opted out.",
      localDate: date,
      archivedCompletedCount: archivedCompleted.length,
      taskCount: tasks.length,
      results: [] as SendResult[]
    };
  }

  const results = await sendNotification({
    notificationType: "daily_priority_summary",
    subject: `Central Veterinary Hospital medium/high tasks still open: ${tasks.length}`,
    html: overdueHtml(tasks, date),
    text: overdueText(tasks, date),
    idempotencyKeyBase: `daily-priority-summary/${date}`,
    modeOverride: currentMode,
    channelOverride: options?.channelOverride,
    deliveriesOverride: deliveries
  });

  return {
    skipped: false,
    localDate: date,
    archivedCompletedCount: archivedCompleted.length,
    taskCount: tasks.length,
    results
  };
}

export async function sendSmokeEmail(options?: {
  modeOverride?: NotificationMode;
  channelOverride?: NotificationChannel;
}) {
  const { date } = localParts();
  const stamp = new Date().toISOString().slice(0, 16);
  const results = await sendNotification({
    notificationType: "smoke_test",
    subject: "Central Veterinary Hospital notification smoke test",
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.45;">
        <h1 style="font-size:20px;margin:0 0 12px;">Central Veterinary Hospital notification smoke test</h1>
        <p style="margin:0;">Email path is working for ${escapeHtml(date)}.</p>
      </div>
    `,
    text: `Central Veterinary Hospital notification smoke test for ${date}.`,
    idempotencyKeyBase: `smoke-test/${stamp}`,
    modeOverride: options?.modeOverride,
    channelOverride: options?.channelOverride
  });
  return { localDate: date, results };
}

export async function sendAgentExampleEmail(options?: {
  modeOverride?: NotificationMode;
  recipients?: string[];
  subject?: string;
  message?: string;
  actorName?: string;
  cadence?: AgentEmailCadence;
  period?: string;
  idempotencyKeyBase?: string;
}) {
  const { date, month } = localParts();
  const requestedRecipients = Array.from(
    new Set((options?.recipients ?? []).map((recipient) => recipient.trim()).filter(Boolean))
  );
  const message = options?.message?.trim() || "This is an example email from the Central Veterinary Hospital agent.";
  const subject = options?.subject?.trim() || "Central Veterinary Hospital agent email";
  const currentMode = options?.modeOverride ?? "test";
  const deliveryRecipients = currentMode === "test" ? [] : requestedRecipients;
  const cadence = options?.cadence ?? "once";
  const period = cadence === "monthly" ? options?.period ?? month : undefined;
  const idempotencyKeyBase = options?.idempotencyKeyBase ??
    (cadence === "monthly"
      ? `agent-example-email/monthly/${period}`
      : `agent-example-email/${randomUUID()}`);
  const results = await sendNotification({
    notificationType: "agent_example_email",
    subject,
    html: agentExampleHtml(message, options?.actorName, date),
    text: agentExampleText(message, options?.actorName, date),
    idempotencyKeyBase,
    modeOverride: currentMode,
    channelOverride: "email",
    deliveriesOverride: deliveryRecipients.length > 0 ? [{ channel: "email", recipients: deliveryRecipients }] : undefined
  });
  return {
    localDate: date,
    mode: currentMode,
    from: notificationEmailFrom(),
    recipients: deliveryRecipients,
    requestedRecipients,
    subject,
    cadence,
    period: period ?? null,
    results
  };
}
