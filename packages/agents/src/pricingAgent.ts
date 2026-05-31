import type {
  AgentInput,
  AgentReportDraft,
  AgentTaskDraft,
  AgentWorkflowResult,
  RunAgentOptions
} from "./contracts";
import { checkPricingGuardrail } from "./guardrails";
import {
  buildResult,
  createRuntime,
  normalizeAgentInput,
  resolveMode
} from "./mockProvider";
import { executeTool, getInputText } from "./tools";

type PriceComparison = {
  deltaCents: number | null;
  flagged: boolean;
  recommendation: string;
};

export async function runPricingAgent(input: AgentInput | unknown, options: RunAgentOptions = {}): Promise<AgentWorkflowResult> {
  const normalized = normalizeAgentInput(input);
  const intent = "pricing";
  const mode = normalized.live ? "apify" : resolveMode(options);
  const runtime = createRuntime(normalized, intent, options);
  const guardrail = checkPricingGuardrail(getInputText(normalized));

  await executeTool("run_competitor_scan", {
    source: normalized.live ? "apify" : "sample"
  }, runtime);
  const comparisonResult = await executeTool("compare_service_prices", {}, runtime) as {
    comparisons: PriceComparison[];
  };
  const flagged = comparisonResult.comparisons.filter((comparison) => comparison.flagged);
  const summary = `${flagged.length} pricing item(s) need review. No service prices were changed.`;
  const reportResult = await executeTool("create_price_review_report", {
    summary,
    flaggedCount: flagged.length,
    comparisons: comparisonResult.comparisons
  }, runtime) as {
    task: AgentTaskDraft;
    report: AgentReportDraft;
  };

  return buildResult({
    intent,
    mode,
    message: guardrail.allowed ? summary : guardrail.message ?? summary,
    result: {
      changedPrices: false,
      comparisons: comparisonResult.comparisons,
      flagged
    },
    runtime,
    options,
    task: reportResult.task,
    report: reportResult.report
  });
}
