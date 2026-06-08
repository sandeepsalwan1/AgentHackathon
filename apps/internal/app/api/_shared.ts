import {
  checkAuthAttemptLimit,
  getRecipientProfileByPasscode,
  MissingDatabaseUrlError,
  recordAuthAttempt,
  resolveClinicForHostname,
  type Actor,
  type AppRole,
  type ClinicContext,
  type Task
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
export { canAdmin, canManage } from "../lib/taskWorkflow";

const roleSchema = z.enum(["staff", "va", "task_adder", "veterinarian", "admin"]);
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

function demoAccountsEnabled() {
  return process.env.DEMO_ACCOUNTS !== "disabled";
}

function vaPasscode() {
  return configuredPasscode(process.env.VET_ADMIN_PASSCODE);
}

function adminPasscode() {
  return configuredPasscode(process.env.VET_APP_ADMIN_PASSCODE || process.env.VET_VETERINARIAN_PASSCODE);
}

function veterinarianPasscode() {
  return configuredPasscode(process.env.VET_VETERINARIAN_PASSCODE);
}

function passcodeMatches(input: string | undefined, ...allowed: Array<string | null>) {
  const passcode = configuredPasscode(input);
  return Boolean(passcode && allowed.some((candidate) => candidate === passcode));
}

export async function resolveClinicFromRequest(request: Request): Promise<ClinicContext> {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  return resolveClinicForHostname(host);
}

async function normalizeActor(
  actor: z.infer<typeof actorSchema>,
  clinic: ClinicContext
): Promise<Actor | null> {
  const name = actor.name?.trim() || "";
  if (actor.role === "staff") {
    return name ? { name, role: "staff" } : null;
  }
  const vaCode = vaPasscode();
  const demoAdminCode = demoAccountsEnabled() ? "246810" : null;
  const demoVetCode = demoAccountsEnabled() ? "135790" : null;
  if ((actor.role === "va" || actor.role === "task_adder") && passcodeMatches(actor.passcode, vaCode, demoAdminCode)) {
    return name ? { name, role: "va" } : null;
  }
  const adminCode = adminPasscode();
  if (actor.role === "admin" && passcodeMatches(actor.passcode, adminCode, demoAdminCode)) {
    return name ? { name, role: "admin" } : null;
  }
  if (actor.role === "veterinarian") {
    const profile = await getRecipientProfileByPasscode(actor.passcode, {
      clinicId: clinic.clinicId
    });
    if (profile) {
      return {
        name: profile.displayName,
        role: "veterinarian",
        profileId: profile.profileId
      };
    }
    const vetCode = veterinarianPasscode();
    if (passcodeMatches(actor.passcode, vetCode, demoVetCode)) {
      return name ? { name, role: "veterinarian" } : null;
    }
  }
  return null;
}

function passcodeFromRequest(url: URL, request?: Request) {
  return request?.headers.get(passcodeHeader) || url.searchParams.get("passcode") || undefined;
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
  request: Request,
  clinic?: ClinicContext
): Promise<{ actor: Actor } | { response: NextResponse }> {
  const clinicContext = clinic ?? await resolveClinicFromRequest(request);
  if (actor.role !== "staff") {
    const identity = clientIdentity(request, actor.role);
    const limit = await checkAuthAttemptLimit(identity, {
      clinicId: clinicContext.clinicId
    });
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

    const normalized = await normalizeActor(actor, clinicContext);
    await recordAuthAttempt({
      clinicId: clinicContext.clinicId,
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

  const normalized = await normalizeActor(actor, clinicContext);
  if (!normalized) {
    return {
      response: NextResponse.json({ error: "Invalid role or name." }, { status: 403 })
    };
  }
  return { actor: normalized };
}

export async function authenticateActorFromQuery(
  url: URL,
  request: Request,
  clinic?: ClinicContext
) {
  const role = roleSchema.safeParse(url.searchParams.get("role") ?? "staff");
  const name = url.searchParams.get("name") || "";
  const passcode = passcodeFromRequest(url, request);
  if (!role.success) {
    return {
      response: NextResponse.json({ error: "Invalid role or passcode." }, { status: 403 })
    };
  }
  return authenticateActor({ name, role: role.data, passcode }, request, clinic);
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
