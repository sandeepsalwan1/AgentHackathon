import { listApprovals } from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const approvals = await listApprovals({ status: "pending" });
    return NextResponse.json({ ok: true, approvals }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.vet-approvals" });
  }
}
