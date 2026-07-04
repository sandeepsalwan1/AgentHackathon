import {
  createApproval,
  decideApproval,
  listApprovals,
  type Actor,
  type ClinicContext
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManage } from "../../lib/taskWorkflow";
import { actorSchema, authenticateActor } from "../_shared";

const approvalSchema = z.object({
  runId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  approvalType: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(2).max(2000),
  requestedAction: z.record(z.string(), z.unknown()).optional()
});

const decisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional().nullable()
});

type ApprovalRequestResult =
  | { ok: true; approval: unknown; status?: number }
  | { ok: false; error: string; status: number }
  | { response: NextResponse };

export async function approvalListPayload(clinicId: string, status: string) {
  const approvals = await listApprovals({ clinicId, status });
  return { ok: true, approvals };
}

async function requireManagerActor(
  request: Request,
  body: Record<string, unknown>,
  clinic: ClinicContext,
  invalidActorError: { error: string; status: number }
): Promise<{ actor: Actor } | { ok: false; error: string; status: number } | { response: NextResponse }> {
  const actorResult = actorSchema.safeParse(body.actor);
  if (!actorResult.success) return { ok: false, ...invalidActorError };

  const auth = await authenticateActor(actorResult.data, request, clinic);
  if ("response" in auth) return { response: auth.response };
  if (!canManage(auth.actor.role)) {
    return { ok: false, error: "Manager access required.", status: 403 };
  }
  return { actor: auth.actor };
}

export async function createApprovalFromBody(
  request: Request,
  body: Record<string, unknown>,
  clinic: ClinicContext
): Promise<ApprovalRequestResult> {
  const manager = await requireManagerActor(
    request,
    body,
    clinic,
    { error: "Actor credentials are required.", status: 403 }
  );
  if ("response" in manager || "ok" in manager) return manager;

  const parsed = approvalSchema.safeParse(body.approval);
  if (!parsed.success) {
    return { ok: false, error: "Invalid approval request.", status: 400 };
  }

  return {
    ok: true,
    status: 201,
    approval: await createApproval({
      ...parsed.data,
      clinicId: clinic.clinicId
    })
  };
}

export async function decideApprovalFromBody(
  request: Request,
  body: Record<string, unknown>,
  clinic: ClinicContext,
  approvalId: string
): Promise<ApprovalRequestResult> {
  const decisionResult = decisionSchema.safeParse(body.decision ?? body);
  const manager = await requireManagerActor(
    request,
    body,
    clinic,
    { error: "Invalid approval decision.", status: 400 }
  );
  if (!decisionResult.success || "ok" in manager) {
    return { ok: false, error: "Invalid approval decision.", status: 400 };
  }
  if ("response" in manager) return manager;

  const approval = await decideApproval(approvalId, {
    clinicId: clinic.clinicId,
    status: decisionResult.data.status,
    actor: manager.actor,
    note: decisionResult.data.note
  });
  return approval
    ? { ok: true, approval }
    : { ok: false, error: "Approval not found.", status: 404 };
}
