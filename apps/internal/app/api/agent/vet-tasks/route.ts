import { listTasks } from "@central-vet/db";
import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await listTasks({ role: "veterinarian" });

    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    const stats = {
      dueToday: tasks.filter(
        (t) => t.status === "due" && t.dueDate.slice(0, 10) <= today
      ).length,
      dueTodayUrgent: tasks.filter(
        (t) => t.status === "due" && t.dueDate.slice(0, 10) <= today && t.priority === "high"
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
