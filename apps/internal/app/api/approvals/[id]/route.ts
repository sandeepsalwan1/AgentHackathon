import { decideApproval } from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dbError, noStoreHeaders } from "../../_apiResponse";
import {
  actorSchema,
  authenticateActor,
  resolveClinicFromRequest
} from "../../_shared";
import { canManage } from "../../../lib/taskWorkflow";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional().nullable()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const actorResult = actorSchema.safeParse(body.actor);
    const decisionResult = decisionSchema.safeParse(body.decision ?? body);
    if (!actorResult.success || !decisionResult.success) {
      return NextResponse.json({ error: "Invalid approval decision." }, { status: 400 });
    }
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActor(actorResult.data, request, clinic);
    if ("response" in auth) return auth.response;
    if (!canManage(auth.actor.role)) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }
    const { id } = await context.params;
    const approval = await decideApproval(id, {
      clinicId: clinic.clinicId,
      status: decisionResult.data.status,
      actor: auth.actor,
      note: decisionResult.data.note
    });
    if (!approval) return NextResponse.json({ error: "Approval not found." }, { status: 404 });
    return NextResponse.json({ ok: true, approval }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "approvals.decide" });
  }
}
