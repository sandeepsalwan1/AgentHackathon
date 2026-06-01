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

type RecordsAgentOptions = RunAgentOptions & {
  audience?: "external" | "internal";
};

export async function runRecordsAgent(input: AgentInput | unknown, options: RecordsAgentOptions = {}): Promise<AgentWorkflowResult> {
  const normalized = normalizeAgentInput(input);
  const intent = "records";
  const mode = resolveMode(options);
  const runtime = createRuntime(normalized, intent, options);
  const actionText = getInputText(normalized);
  const guardrail = checkRecordsGuardrail(actionText || "transfer records");
  const audience = options.audience ?? "external";

  const packet = await executeTool("prepare_records_packet", {
    clientName: normalized.clientName ?? normalized.callerName ?? null,
    petName: normalized.petName ?? null,
    destination: normalized.destination ?? null
  }, runtime);
  const audit = await executeTool("audit_records_transfer", {
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
    message: audience === "internal"
      ? "I prepared the records-transfer packet and approval for internal review. No records were sent."
      : guardrail.message ?? "I created a records-transfer approval for staff. Records will not be sent until a person reviews it.",
    result: {
      audience,
      requiresApproval: true,
      allowedAutomatically: guardrail.allowed,
      recordsSentAutomatically: false,
      packet,
      audit
    },
    runtime,
    options,
    task: approvalResult.task,
    approval: approvalResult.approval
  });
}
