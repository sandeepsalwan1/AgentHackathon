import { createHash } from "node:crypto";
import { createTask, getSql, MissingDatabaseUrlError } from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logError, logInfo, logWarn } from "../_shared";

const hits = new Map<string, number[]>();
const maxPerHour = 5;
const maxTrackedClients = 2000;
const rateWindowMs = 60 * 60 * 1000;
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

const requestSchema = z.object({
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

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function contentHash(value: unknown) {
  return hashValue(JSON.stringify(value).toLowerCase().replace(/\s+/g, " ").trim());
}

function clientKey(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return `${ip}|${request.headers.get("user-agent") || "unknown"}`;
}

function rateLimited(key: string) {
  const now = Date.now();
  if (now - lastRateLimitSweep > 60_000) {
    lastRateLimitSweep = now;
    for (const [trackedKey, stamps] of hits) {
      const fresh = stamps.filter((stamp) => now - stamp < rateWindowMs);
      if (fresh.length) hits.set(trackedKey, fresh);
      else hits.delete(trackedKey);
    }
  }
  const fresh = (hits.get(key) ?? []).filter((stamp) => now - stamp < rateWindowMs);
  if (fresh.length >= maxPerHour) {
    hits.set(key, fresh);
    return true;
  }
  if (!hits.has(key) && hits.size >= maxTrackedClients) {
    const oldestKey = hits.keys().next().value;
    if (oldestKey) hits.delete(oldestKey);
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
  return compact.length > 18 && !/\s/.test(value.trim());
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

function validateFields(value: z.infer<typeof requestSchema>) {
  const errors: FieldErrors = {};
  const nameError = realNameError(value.clientName, "Your name");
  if (nameError) errors.clientName = nameError;
  const phoneDigits = digits(value.clientPhone);
  if (!value.clientPhone.trim()) errors.clientPhone = "Phone is required.";
  else if (phoneDigits.length < 10) errors.clientPhone = "Enter a real phone # with at least 10 digits.";
  else if (new Set(phoneDigits).size < 3) errors.clientPhone = "Enter a real phone #.";
  const dateError = petDateError(value.clientDateOfBirth);
  if (dateError) errors.clientDateOfBirth = dateError;
  const petNameError = realNameError(value.petName, "Pet's name");
  if (petNameError) errors.petName = petNameError;
  if (value.petWeight?.trim() && !/\d/.test(value.petWeight)) {
    errors.petWeight = "Pet's weight should include a number.";
  }
  const words = value.request.match(/[A-Za-z]{2,}/g) ?? [];
  if (!value.request.trim()) errors.request = "Request is required.";
  else if (value.request.trim().length < 15 || words.length < 3) {
    errors.request = "Describe the request in a few real words.";
  } else if (looksLikeJunk(value.request)) {
    errors.request = "Describe the request in a few real words.";
  }
  return errors;
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
      return NextResponse.json({ error: "Please use the request form." }, { status: 400 });
    }
    requestHash = contentHash(body);
    if (rateLimited(clientHash)) {
      logWarn("client_request_rejected", { ...logIds(), reason: "memory_rate_limit" });
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    const guard = await persistentGuard(clientHash, requestHash);
    if (guard.rateLimited || guard.duplicate) {
      await recordGuard(clientHash, requestHash, guard.duplicate ? "duplicate" : "rate_limited");
      return NextResponse.json(
        { error: guard.duplicate ? "This request was already submitted." : "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      await recordGuard(clientHash, requestHash, "validation_failed");
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors: { request: "Please use the form fields." } },
        { status: 400 }
      );
    }
    const fieldErrors = validateFields(parsed.data);
    if (Object.keys(fieldErrors).length > 0) {
      await recordGuard(clientHash, requestHash, "validation_failed");
      return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors }, { status: 400 });
    }
    const task = await createTask(
      {
        ...parsed.data,
        hospitalName: process.env.HOSPITAL_NAME || "Central Veterinary Hospital",
        source: "client_form",
        status: "pending_review",
        priority: "low",
        requestType: parsed.data.requestType,
        dueDate: new Date().toISOString().slice(0, 10),
        dueTime: "19:00"
      },
      { name: parsed.data.clientName, role: "staff" }
    );
    await recordGuard(clientHash, requestHash, "accepted");
    logInfo("client_request_accepted", { ...logIds(), taskId: task.id });
    return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return NextResponse.json(
        { error: "Request system is not connected yet. Please call the hospital directly." },
        { status: 503 }
      );
    }
    logError("client_request_failed", error, logIds());
    return NextResponse.json({ error: "Unable to submit request." }, { status: 500 });
  }
}
