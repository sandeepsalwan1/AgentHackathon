import { createHash } from "node:crypto";
import { auditRecordsTransfer, buildRecordsTransferPacket } from "@central-vet/agents";
import { createTask, getSql, MissingDatabaseUrlError, recordTaskEvent } from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logError, logInfo, logWarn } from "../_logging";

const hits = new Map<string, number[]>();
const maxPerHour = 5;
const rateWindowMs = 60 * 60 * 1000;
const maxTrackedClients = 1000;
let lastRateLimitSweep = 0;

type RequestField =
  | "requestType"
  | "clientName"
  | "clientPhone"
  | "clientDateOfBirth"
  | "petName"
  | "petWeight"
  | "request";

type FieldErrors = Partial<Record<RequestField, string>>;

const requestSchema = z
  .object({
    requestType: z
      .enum(["prescription", "labs_xrays", "records_request", "scheduling"])
      .default("scheduling"),
    clientName: z.string().trim().max(120),
    clarityId: z.string().trim().max(120).optional().nullable(),
    clientPhone: z.string().trim().max(80),
    clientDateOfBirth: z.string().trim(),
    petName: z.string().trim().max(120),
    petWeight: z.string().trim().max(80).optional().nullable(),
    lastVisit: z.string().optional().nullable(),
    request: z.string().trim().max(4000)
  });

function clientKey(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return `${ip}|${request.headers.get("user-agent") || "unknown"}`;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function contentHash(value: unknown) {
  return hashValue(JSON.stringify(value).toLowerCase().replace(/\s+/g, " ").trim());
}

function rateLimited(key: string) {
  const now = Date.now();
  if (now - lastRateLimitSweep > 60_000 || hits.size > maxTrackedClients) {
    lastRateLimitSweep = now;
    for (const [trackedKey, stamps] of hits) {
      const freshStamps = stamps.filter((stamp) => now - stamp < rateWindowMs);
      if (freshStamps.length) {
        hits.set(trackedKey, freshStamps);
      } else {
        hits.delete(trackedKey);
      }
    }
    while (hits.size > maxTrackedClients) {
      const oldestKey = hits.keys().next().value;
      if (!oldestKey) break;
      hits.delete(oldestKey);
    }
  }

  const fresh = (hits.get(key) ?? []).filter((stamp) => now - stamp < rateWindowMs);
  if (fresh.length >= maxPerHour) {
    hits.set(key, fresh);
    return true;
  }
  fresh.push(now);
  hits.set(key, fresh);
  return false;
}

async function persistentGuard(clientHash: string, requestHash: string) {
  const sql = getSql();
  const rows = await sql<{ client_count: number; duplicate_count: number }[]>`
    select
      (
        select count(*)::int
        from request_guard_events
        where client_key_hash = ${clientHash}
          and created_at > now() - interval '1 hour'
      ) as client_count,
      (
        select count(*)::int
        from request_guard_events
        where content_hash = ${requestHash}
          and status = 'accepted'
          and created_at > now() - interval '24 hours'
      ) as duplicate_count
  `;
  const row = rows[0];
  return {
    rateLimited: (row?.client_count ?? 0) >= maxPerHour,
    duplicate: (row?.duplicate_count ?? 0) > 0
  };
}

async function recordGuard(clientHash: string, requestHash: string, status: string) {
  const sql = getSql();
  await sql`
    insert into request_guard_events (client_key_hash, content_hash, status)
    values (${clientHash}, ${requestHash}, ${status})
  `;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function looksLikeJunk(value: string) {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const letters = compact.replace(/[^a-z]/g, "");
  if (!compact) return true;
  if (/(asdf|qwer|zxcv|dfasdf|fasdf|sdaf)/.test(compact)) return true;
  if (/([a-z0-9])\1{3,}/.test(compact)) return true;
  if (letters.length >= 12 && new Set(letters).size <= 5) return true;
  if (compact.length > 18 && !/\s/.test(value.trim())) return true;
  return false;
}

function realNameError(value: string, label: string) {
  const letters = value.replace(/[^A-Za-z]/g, "");
  if (!value.trim()) return `${label} is required.`;
  if (letters.length < 2) return `${label} needs at least 2 letters.`;
  if (looksLikeJunk(value)) return `Use a real ${label.toLowerCase()}.`;
  return null;
}

function petDateError(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Use the pet's real date of birth.";
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return "Use the pet's real date of birth.";
  if (date > today) return "Pet's date of birth can't be in the future.";
  if (date.getFullYear() < 1980) return "Use the pet's real date of birth.";
  return null;
}

function petWeightError(value: string | null | undefined) {
  const clean = value?.trim();
  if (!clean) return null;
  if (!/\d/.test(clean)) return "Pet's weight should include a number.";
  if (looksLikeJunk(clean)) return "Pet's weight should look like a real weight.";
  return null;
}

function validateFields(value: z.infer<typeof requestSchema>) {
  const errors: FieldErrors = {};
  const nameError = realNameError(value.clientName, "Your name");
  if (nameError) errors.clientName = nameError;

  const phoneDigits = digits(value.clientPhone);
  if (!value.clientPhone.trim()) {
    errors.clientPhone = "Phone is required.";
  } else if (phoneDigits.length < 10) {
    errors.clientPhone = "Enter a real phone # with at least 10 digits.";
  } else if (new Set(phoneDigits).size < 3) {
    errors.clientPhone = "Enter a real phone #.";
  }

  const dateError = petDateError(value.clientDateOfBirth);
  if (dateError) errors.clientDateOfBirth = dateError;

  const petNameError = realNameError(value.petName, "Pet's name");
  if (petNameError) errors.petName = petNameError;

  const weightError = petWeightError(value.petWeight);
  if (weightError) errors.petWeight = weightError;

  const words = value.request.match(/[A-Za-z]{2,}/g) ?? [];
  if (!value.requestType) {
    errors.requestType = "Request type is required.";
  }
  if (!value.request.trim()) {
    errors.request = "Request is required.";
  } else if (value.request.trim().length < 15 || words.length < 3) {
    errors.request = "Describe the request in a few real words.";
  } else if (looksLikeJunk(value.request)) {
    errors.request = "Describe the request in a few real words.";
  }

  return errors;
}

function hasErrors(errors: FieldErrors) {
  return Object.keys(errors).length > 0;
}

export async function POST(request: Request) {
  const clientHash = hashValue(clientKey(request));
  let requestHash = hashValue("empty");
  const logIds = () => ({
    clientKey: clientHash.slice(0, 12),
    requestKey: requestHash.slice(0, 12)
  });
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      logWarn("client_request_rejected", {
        ...logIds(),
        reason: "invalid_json"
      });
      return NextResponse.json(
        { error: "Please use the request form." },
        { status: 400 }
      );
    }
    requestHash = contentHash(body);

    if (rateLimited(clientHash)) {
      logWarn("client_request_rejected", {
        ...logIds(),
        reason: "memory_rate_limit"
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const guard = await persistentGuard(clientHash, requestHash);
    if (guard.rateLimited || guard.duplicate) {
      await recordGuard(clientHash, requestHash, guard.duplicate ? "duplicate" : "rate_limited");
      logWarn("client_request_rejected", {
        ...logIds(),
        reason: guard.duplicate ? "duplicate" : "persistent_rate_limit"
      });
      return NextResponse.json(
        {
          error: guard.duplicate
            ? "This request was already submitted."
            : "Too many requests. Please try again later."
        },
        { status: 429 }
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      await recordGuard(clientHash, requestHash, "validation_failed");
      logWarn("client_request_rejected", {
        ...logIds(),
        reason: "invalid_schema"
      });
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors: { request: "Please use the form fields." } },
        { status: 400 }
      );
    }

    const fieldErrors = validateFields(parsed.data);
    if (hasErrors(fieldErrors)) {
      await recordGuard(clientHash, requestHash, "validation_failed");
      logWarn("client_request_rejected", {
        ...logIds(),
        reason: "field_validation",
        fields: Object.keys(fieldErrors).join(",")
      });
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors },
        { status: 400 }
      );
    }

    const opseraAudit =
      parsed.data.requestType === "records_request"
        ? await auditRecordsTransfer(
            buildRecordsTransferPacket({
              clientName: parsed.data.clientName,
              clientPhone: parsed.data.clientPhone,
              clientDateOfBirth: parsed.data.clientDateOfBirth,
              petName: parsed.data.petName,
              petWeight: parsed.data.petWeight,
              lastVisit: parsed.data.lastVisit,
              request: parsed.data.request,
              requestedBy: parsed.data.clientName,
              metadata: {
                source: "client_form",
                clarityId: parsed.data.clarityId ?? null
              }
            })
          )
        : null;

    const actor = {
      name: parsed.data.clientName,
      role: "staff" as const
    };
    const task = await createTask(
      {
        ...parsed.data,
        hospitalName: process.env.HOSPITAL_NAME || "Central Veterinary Hospital",
        source: "client_form",
        status: "pending_review",
        priority:
          opseraAudit?.status === "blocked"
            ? "high"
            : opseraAudit?.status === "flagged"
              ? "medium"
              : "low",
        requestType: parsed.data.requestType,
        dueDate: new Date().toISOString().slice(0, 10),
        dueTime: "19:00",
        opseraAuditStatus: opseraAudit?.status ?? null,
        opseraAuditReason: opseraAudit?.reason ?? null,
        opseraAuditId: opseraAudit?.auditId ?? null,
        opseraAuditCheckedAt: opseraAudit?.checkedAt ?? null
      },
      actor
    );

    if (opseraAudit) {
      await recordTaskEvent({
        taskId: task.id,
        actor,
        eventType: "opsera_records_audit",
        previousStatus: null,
        nextStatus: task.status,
        metadata: {
          opseraStatus: opseraAudit.status,
          opseraReason: opseraAudit.reason,
          opseraAuditId: opseraAudit.auditId,
          opseraSource: opseraAudit.source
        }
      });
      logInfo("opsera_records_audit", {
        ...logIds(),
        taskId: task.id,
        status: opseraAudit.status
      });
    }

    await recordGuard(clientHash, requestHash, "accepted");
    logInfo("client_request_accepted", {
      ...logIds(),
      taskId: task.id
    });
    return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      logWarn("client_request_failed", {
        ...logIds(),
        reason: "database_missing_url"
      });
      return NextResponse.json(
        {
          error: "Request system is not connected yet. Please call the hospital directly."
        },
        { status: 503 }
      );
    }
    logError("client_request_failed", error, logIds());
    return NextResponse.json({ error: "Unable to submit request." }, { status: 500 });
  }
}
