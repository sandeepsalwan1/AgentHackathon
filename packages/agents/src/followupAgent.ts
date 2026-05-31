import type {
  AgentInput,
  AgentReportDraft,
  AgentTaskDraft,
  AgentWorkflowResult,
  MockClient,
  MockFollowup,
  MockPet,
  RunAgentOptions
} from "./contracts";
import {
  buildResult,
  createRuntime,
  normalizeAgentInput,
  resolveMode
} from "./mockProvider";
import { executeTool } from "./tools";

type FollowupCandidateResult = {
  candidates: MockFollowup[];
};

type FollowupTaskResult = {
  candidate: MockFollowup | null;
  client: MockClient | null;
  pet: MockPet | null;
  task: AgentTaskDraft | null;
};

export async function runFollowupAgent(input: AgentInput | unknown, options: RunAgentOptions = {}): Promise<AgentWorkflowResult> {
  const normalized = normalizeAgentInput(input);
  const intent = "followup";
  const mode = resolveMode(options);
  const runtime = createRuntime(normalized, intent, options);
  const candidatesResult = await executeTool("find_followup_candidates", { status: "open" }, runtime) as FollowupCandidateResult;
  const candidate = candidatesResult.candidates[0] ?? null;

  if (!candidate) {
    const report: AgentReportDraft = {
      id: "report-followup-empty",
      kind: "report",
      reportType: "followup",
      title: "Follow-up scan",
      summary: "No open follow-up candidates found.",
      data: { candidates: [] }
    };
    runtime.effects.push(report);
    return buildResult({
      intent,
      mode,
      message: "No pending follow-up candidates found.",
      result: { candidates: [] },
      runtime,
      options,
      report
    });
  }

  const taskResult = await executeTool("create_followup_task", { candidateId: candidate.id }, runtime) as FollowupTaskResult;
  const report: AgentReportDraft = {
    id: `report-followup-${candidate.id}`,
    kind: "report",
    reportType: "followup",
    title: "Follow-up candidate review",
    summary: `${taskResult.pet?.name ?? "A pet"} is due for ${candidate.followupType}.`,
    data: {
      candidate,
      client: taskResult.client,
      pet: taskResult.pet
    },
    taskId: taskResult.task?.id ?? null
  };
  runtime.effects.push(report);
  return buildResult({
    intent,
    mode,
    message: taskResult.pet
      ? `I found a follow-up opportunity for ${taskResult.pet.name}. Staff has a task to turn it into outreach.`
      : "I found a follow-up opportunity and created a review task.",
    result: {
      candidate,
      client: taskResult.client,
      pet: taskResult.pet
    },
    runtime,
    options,
    task: taskResult.task ?? undefined,
    report
  });
}
