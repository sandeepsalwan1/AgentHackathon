import type {
  AgentInput,
  AgentReportDraft,
  AgentTaskDraft,
  AgentWorkflowResult,
  MockInvoice,
  RunAgentOptions
} from "./contracts";
import { checkBillingGuardrail, checkMedicalGuardrail } from "./guardrails";
import {
  buildResult,
  classifyIntent,
  createRuntime,
  normalizeAgentInput,
  resolveMode
} from "./mockProvider";
import { runFollowupAgent } from "./followupAgent";
import { runPricingAgent } from "./pricingAgent";
import { runRecordsAgent } from "./recordsAgent";
import { executeTool, getInputText, summarizeInvoice } from "./tools";

export async function runInternalAgent(input: AgentInput | unknown, options: RunAgentOptions = {}): Promise<AgentWorkflowResult> {
  const normalized = normalizeAgentInput(input);
  const intent = classifyIntent(normalized, "daily_ops");
  if (intent === "pricing") return runPricingAgent(normalized, options);
  if (intent === "records") return runRecordsAgent(normalized, options);
  if (intent === "followup") return runFollowupAgent(normalized, options);

  const mode = resolveMode(options);
  const runtime = createRuntime(normalized, intent === "unknown" ? "daily_ops" : intent, options);

  if (intent === "sick_pet") {
    const guardrail = checkMedicalGuardrail(normalized);
    const taskResult = await executeTool("create_task", {
      status: "due",
      priority: guardrail.priority,
      requestType: "patient_update",
      clientName: normalized.clientName ?? null,
      clientPhone: normalized.clientPhone ?? null,
      petName: normalized.petName ?? null,
      request: `Staff triage needed for sick-pet message: ${getInputText(normalized)}`,
      notes: "No diagnosis or treatment recommendation was produced."
    }, runtime) as { task: AgentTaskDraft };
    return buildResult({
      intent,
      mode,
      message: guardrail.message ?? "Sick-pet message routed for staff triage.",
      result: { escalated: true, medicalAdviceGiven: false, reasons: guardrail.reasons },
      runtime,
      options,
      task: taskResult.task
    });
  }

  if (intent === "invoice") {
    const guardrail = checkBillingGuardrail(getInputText(normalized));
    const invoice = runtime.data.invoices.find((candidate) => candidate.flags.length > 0) ?? runtime.data.invoices[0] ?? null;
    const reportResult = invoice
      ? await executeTool("flag_invoice_issue", {
          invoiceId: invoice.id,
          issueDetails: invoice.flags[0]?.reason ?? "Invoice needs staff review."
        }, runtime) as { task: AgentTaskDraft; report: AgentReportDraft; invoice: MockInvoice | null }
      : null;
    return buildResult({
      intent,
      mode,
      message: guardrail.allowed
        ? invoice
          ? `Invoice review created for ${summarizeInvoice(invoice)}.`
          : "No mock invoice issues found."
        : guardrail.message ?? "Billing review task created.",
      result: {
        changedInvoices: false,
        invoice: reportResult?.invoice ?? null
      },
      runtime,
      options,
      task: reportResult?.task,
      report: reportResult?.report
    });
  }

  const openTasks = 3;
  const highPriority = runtime.data.messages.filter((message) => message.urgency === "high").length;
  const pendingFollowups = runtime.data.followups.filter((followup) => followup.status === "open").length;
  const invoiceReviews = runtime.data.invoices.filter((invoice) => invoice.flags.length > 0).length;
  const summary = {
    openTasks,
    highPriority,
    pendingApprovals: 1,
    openFollowups: pendingFollowups,
    invoiceReviews,
    pricingItems: runtime.data.pricingObservations.length
  };
  const report: AgentReportDraft = {
    id: "report-daily-ops",
    kind: "report",
    reportType: "daily_ops",
    title: "Daily ops digest",
    summary: `${openTasks} open task(s), ${highPriority} urgent message(s), ${pendingFollowups} follow-up candidate(s).`,
    data: {
      summary,
      rankedWork: [
        "Review urgent sick-pet messages first.",
        "Confirm pending records-transfer approval.",
        "Work invoice review before end of day.",
        "Schedule open follow-up candidates."
      ]
    }
  };
  runtime.effects.push(report);

  return buildResult({
    intent: "daily_ops",
    mode,
    message: report.summary,
    result: report.data,
    runtime,
    options,
    report
  });
}
