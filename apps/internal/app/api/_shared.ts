import {
  checkAuthAttemptLimit,
  getRecipientProfileByPasscode,
  MissingDatabaseUrlError,
  recordAuthAttempt,
  type Actor,
  type AppRole,
  type Task
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
export { canAdmin, canManage } from "../lib/taskWorkflow";

export const roleSchema = z.enum(["staff", "va", "task_adder", "veterinarian", "admin"]);
export const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0, must-revalidate"
};

type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

export const actorSchema = z.object({
  name: z.string().trim().max(80).optional().default(""),
  role: roleSchema,
  passcode: z.string().optional(),
  profileId: z.string().optional().nullable()
});

type RawActor = z.infer<typeof actorSchema>;
const passcodeHeader = "x-central-vet-passcode";

function configuredPasscode(value: string | undefined) {
  const passcode = value?.trim();
  return passcode || null;
}

export function vaPasscode() {
  return configuredPasscode(process.env.VET_ADMIN_PASSCODE);
}

export function adminPasscode() {
  return configuredPasscode(process.env.VET_APP_ADMIN_PASSCODE || process.env.VET_VETERINARIAN_PASSCODE);
}

export function veterinarianPasscode() {
  return configuredPasscode(process.env.VET_VETERINARIAN_PASSCODE);
}

export async function normalizeActor(actor: z.infer<typeof actorSchema>): Promise<Actor | null> {
  const name = actor.name?.trim() || "";
  if (actor.role === "staff") {
    return name ? { name, role: "staff" } : null;
  }
  const vaCode = vaPasscode();
  if ((actor.role === "va" || actor.role === "task_adder") && vaCode && actor.passcode === vaCode) {
    return name ? { name, role: "va" } : null;
  }
  const adminCode = adminPasscode();
  if (actor.role === "admin" && adminCode && actor.passcode === adminCode) {
    return name ? { name, role: "admin" } : null;
  }
  if (actor.role === "veterinarian") {
    const profile = await getRecipientProfileByPasscode(actor.passcode);
    if (profile) {
      return {
        name: profile.displayName,
        role: "veterinarian",
        profileId: profile.profileId
      };
    }
    const vetCode = veterinarianPasscode();
    if (vetCode && actor.passcode === vetCode) {
      return name ? { name, role: "veterinarian" } : null;
    }
  }
  return null;
}

export async function validateVet(actor: z.infer<typeof actorSchema>) {
  return Boolean(await normalizeActor(actor));
}

function passcodeFromRequest(url: URL, request?: Request) {
  return request?.headers.get(passcodeHeader) || url.searchParams.get("passcode") || undefined;
}

export async function actorFromQuery(url: URL, request?: Request) {
  const role = roleSchema.safeParse(url.searchParams.get("role") ?? "staff");
  const name = url.searchParams.get("name") || "";
  const passcode = passcodeFromRequest(url, request);
  if (!role.success) return null;
  const actor = { name, role: role.data, passcode };
  return normalizeActor(actor);
}

export async function publicActor(actor: z.infer<typeof actorSchema>): Promise<Actor> {
  const normalized = await normalizeActor(actor);
  if (!normalized) throw new Error("Invalid actor.");
  return normalized;
}

function clientIdentity(request: Request, role: AppRole) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return [
    "passcode",
    role,
    ip,
    request.headers.get("user-agent") || "unknown"
  ].join("|");
}

export async function authenticateActor(
  actor: RawActor,
  request: Request
): Promise<{ actor: Actor } | { response: NextResponse }> {
  if (actor.role !== "staff") {
    const identity = clientIdentity(request, actor.role);
    const limit = await checkAuthAttemptLimit(identity);
    if (!limit.allowed) {
      logWarn("auth_rate_limited", {
        actorRole: actor.role,
        failureCount: limit.failureCount,
        windowMinutes: limit.windowMinutes
      });
      return {
        response: NextResponse.json(
          {
            error: `Too many passcode tries. Wait about ${limit.windowMinutes} minutes, then try again.`
          },
          { status: 429 }
        )
      };
    }

    const normalized = await normalizeActor(actor);
    await recordAuthAttempt({
      identity,
      role: actor.role,
      success: Boolean(normalized)
    });
    if (!normalized) {
      return {
        response: NextResponse.json({ error: "Invalid passcode." }, { status: 403 })
      };
    }
    return { actor: normalized };
  }

  const normalized = await normalizeActor(actor);
  if (!normalized) {
    return {
      response: NextResponse.json({ error: "Invalid role or name." }, { status: 403 })
    };
  }
  return { actor: normalized };
}

export async function authenticateActorFromQuery(url: URL, request: Request) {
  const role = roleSchema.safeParse(url.searchParams.get("role") ?? "staff");
  const name = url.searchParams.get("name") || "";
  const passcode = passcodeFromRequest(url, request);
  if (!role.success) {
    return {
      response: NextResponse.json({ error: "Invalid role or passcode." }, { status: 403 })
    };
  }
  return authenticateActor({ name, role: role.data, passcode }, request);
}

function staffSafeActorName(role: AppRole | null, name: string | null) {
  if (role === "va" || role === "task_adder") return "VA";
  if (role === "admin") return "Admin";
  return name;
}

export function sanitizeTaskForActor(task: Task, role: AppRole) {
  if (role !== "staff") return task;
  const adminOrVaSource =
    task.source === "admin" ||
    task.source === "va" ||
    task.source === "task_adder";
  const assignedTo =
    task.status === "pending"
      ? staffSafeActorName(task.assignedByRole, task.assignedTo)
      : adminOrVaSource
        ? null
        : task.assignedTo;

  return {
    ...task,
    assignedTo,
    updatedByName: null,
    createdByName: staffSafeActorName(task.createdByRole, task.createdByName),
    completedByName: staffSafeActorName(task.completedByRole, task.completedByName),
    archivedByName: staffSafeActorName(task.archivedByRole, task.archivedByName),
    escalatedByName: staffSafeActorName(task.escalatedByRole, task.escalatedByName)
  };
}

function logPayload(event: string, fields: LogFields = {}) {
  return {
    event,
    at: new Date().toISOString(),
    ...fields
  };
}

export function logInfo(event: string, fields?: LogFields) {
  console.info(logPayload(event, fields));
}

export function logWarn(event: string, fields?: LogFields) {
  console.warn(logPayload(event, fields));
}

export function logError(event: string, error: unknown, fields?: LogFields) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(logPayload(event, { ...fields, error: message }));
}

export function dbError(error: unknown, fields?: LogFields) {
  if (error instanceof MissingDatabaseUrlError) {
    logWarn("database_missing_url", fields);
    return NextResponse.json(
      {
        error: "Database not configured.",
        detail: "Set Supabase DATABASE_URL, then run npm run db:migrate."
      },
      { status: 503 }
    );
  }

  logError("server_error", error, fields);
  return NextResponse.json({ error: "Server error." }, { status: 500 });
}
