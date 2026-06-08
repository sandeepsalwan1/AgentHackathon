import { createApproval, listApprovals } from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  actorSchema,
  authenticateActor,
  authenticateActorFromQuery,
  canManage,
  dbError,
  noStoreHeaders,
  resolveClinicFromRequest
} from "../_shared";

export const dynamic = "force-dynamic";

const approvalSchema = z.object({
  runId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  approvalType: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(2).max(2000),
  requestedAction: z.record(z.string(), z.unknown()).optional()
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActorFromQuery(url, request, clinic);
    if ("response" in auth) return auth.response;
    if (!canManage(auth.actor.role)) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }
    const status = url.searchParams.get("status") || "pending";
    const approvals = await listApprovals({ clinicId: clinic.clinicId, status });
    return NextResponse.json({ ok: true, approvals }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "approvals.list" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actorResult = actorSchema.safeParse(body.actor);
    if (!actorResult.success) {
      return NextResponse.json({ error: "Actor credentials are required." }, { status: 403 });
    }
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActor(actorResult.data, request, clinic);
    if ("response" in auth) return auth.response;
    if (!canManage(auth.actor.role)) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }
    const parsed = approvalSchema.safeParse(body.approval);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
    }
    const approval = await createApproval({
      ...parsed.data,
      clinicId: clinic.clinicId
    });
    return NextResponse.json({ ok: true, approval }, { headers: noStoreHeaders, status: 201 });
  } catch (error) {
    return dbError(error, { route: "approvals.create" });
  }
}
