import type {
  AgentApprovalDraft,
  AgentInput,
  AgentTaskDraft,
  AgentWorkflowResult,
  RunAgentOptions
} from "./contracts";
import { checkRecordsGuardrail } from "./guardrails";
import {
  buildResult,
  createRuntime,
  normalizeAgentInput,
  resolveMode
} from "./mockProvider";
import { executeTool, getInputText } from "./tools";

export async function runRecordsAgent(input: AgentInput | unknown, options: RunAgentOptions = {}): Promise<AgentWorkflowResult> {
  const normalized = normalizeAgentInput(input);
  const intent = "records";
  const mode = resolveMode(options);
  const runtime = createRuntime(normalized, intent, options);
  const actionText = getInputText(normalized);
  const guardrail = checkRecordsGuardrail(actionText || "transfer records");

  const packet = await executeTool("prepare_records_packet", {
    clientName: normalized.clientName ?? normalized.callerName ?? null,
    petName: normalized.petName ?? null,
    destination: normalized.destination ?? null
  }, runtime);
  const isInternal = normalized.actor?.role && ["staff", "va", "task_adder", "veterinarian", "admin"].includes(normalized.actor.role);
  const allowed = guardrail.allowed || isInternal;

  if (allowed) {
    if (packet && typeof packet === "object" && "packet" in packet) {
      (packet as any).packet.requiresApproval = false;
    }
    return buildResult({
      intent,
      mode,
      message: `Here are the medical records for ${normalized.petName || "your pet"}. Access has been granted automatically.`,
      result: {
        requiresApproval: false,
        allowedAutomatically: true,
        packet
      },
      runtime,
      options
    });
  }

  const approvalResult = await executeTool("request_records_transfer", {
    clientName: normalized.clientName ?? normalized.callerName ?? null,
    petName: normalized.petName ?? null,
    destination: normalized.destination ?? null
  }, runtime) as {
    task: AgentTaskDraft;
    approval: AgentApprovalDraft;
  };

  return buildResult({
    intent,
    mode,
    message: guardrail.message ?? "I created a records-transfer approval for staff. Records will not be sent until a person reviews it.",
    result: {
      requiresApproval: true,
      allowedAutomatically: guardrail.allowed,
      packet
    },
    runtime,
    options,
    task: approvalResult.task,
    approval: approvalResult.approval
  });
}
