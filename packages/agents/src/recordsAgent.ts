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
