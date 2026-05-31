import { decideApproval } from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dbError, noStoreHeaders } from "../../../_shared";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

const systemActor = { name: "VetAgent", role: "admin" as const };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid decision. Provide status: 'approved' | 'rejected'." }, { status: 400 });
    }
    const { id } = await context.params;
    const approval = await decideApproval(id, {
      status: parsed.data.status,
      actor: systemActor,
      note: parsed.data.note,
    });
    if (!approval) {
      return NextResponse.json({ error: "Approval not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, approval }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.vet-approve" });
  }
}
