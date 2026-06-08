import { listTasks } from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders, resolveClinicFromRequest } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const clinic = await resolveClinicFromRequest(request);
    const tasks = await listTasks({ clinicId: clinic.clinicId, role: "veterinarian" });

    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const toDateStr = (val: unknown) =>
      val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);

    const stats = {
      dueToday: tasks.filter(
        (t) => t.status === "due" && toDateStr(t.dueDate) <= today
      ).length,
      dueTodayUrgent: tasks.filter(
        (t) => t.status === "due" && toDateStr(t.dueDate) <= today && t.priority === "high"
      ).length,
      pendingReview: tasks.filter((t) => t.status === "pending_review").length,
      pendingReviewUrgent: tasks.filter(
        (t) => t.status === "pending_review" && t.priority === "high"
      ).length,
      escalated: tasks.filter(
        (t) => t.escalatedAt !== null && t.status !== "archived" && t.status !== "completed"
      ).length,
      escalatedUrgent: tasks.filter(
        (t) => t.escalatedAt !== null && t.status !== "archived" && t.status !== "completed" && t.priority === "high"
      ).length,
      completed: tasks.filter((t) => t.status === "completed").length,
    };

    return NextResponse.json({ ok: true, tasks, stats }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.vet-tasks" });
  }
}
