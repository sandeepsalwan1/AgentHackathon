import { AgentResponse, AgentContext } from "./contracts";
import { runMockAgent } from "./mockProvider";
import { tools } from "./tools";

// Instructions for the Staff-Facing Agent
const instructions = `
You are the Staff-Facing AI Agent for Central Veterinary Hospital. 
You assist clinic staff (Veterinary Assistants, Veterinarians, Admins) in optimizing workflows and handling administrative backlog.
Your key duties:
1. DAILY OPS SUMMARY: Summarize active queue items, pending tasks, follow-ups, and billing issues.
2. PRICE REVIEW SCAN: Trigger competitor pricing research. Compare catalog pricing and output reports. Do NOT change database prices directly.
3. INVOICE AUDIT: Help detect billing discrepancies (surcharges) and flag them for staff reviews.
4. OUTREACH CAMPAIGNS: Identify follow-up candidates (vaccines, wellness rechecks due) and create staff contact tasks.

Use the provided tools to fetch reports, scan competitors, compare prices, create review tasks, or approve records transfers. Be efficient, operational, and detailed.
`;

export async function runInternalAgent(
  message: string,
  context: AgentContext
): Promise<AgentResponse> {
  const isMock = process.env.MOCK_MODE === "true" || process.env.AGENT_RUNTIME === "mock";
  
  if (isMock) {
    let scenario = context.scenario || "daily_ops";
    const lowercaseMsg = message.toLowerCase();
    
    if (lowercaseMsg.includes("price") || lowercaseMsg.includes("pricing") || lowercaseMsg.includes("competitor") || lowercaseMsg.includes("scan")) {
      scenario = "pricing_scan";
    } else if (lowercaseMsg.includes("followup") || lowercaseMsg.includes("outreach") || lowercaseMsg.includes("vaccine")) {
      scenario = "followup";
    } else if (lowercaseMsg.includes("invoice") || lowercaseMsg.includes("billing") || lowercaseMsg.includes("audit")) {
      scenario = "invoice";
    }
    
    return runMockAgent("internal", scenario, message, context);
  }

  // Real OpenAI Agent Path (dynamically imported to bypass peer dependency warnings in mock runtime)
  // @ts-ignore
  const { Agent, run: runAgent, tool } = await import("@openai/agents");

  const agentTools = Object.entries(tools).map(([name, toolObj]) => {
    return tool({
      name,
      description: toolObj.description,
      parameters: toolObj.parameters,
      execute: async (args: any) => {
        return toolObj.execute(args, context.runId);
      }
    });
  });

  const agent = new Agent({
    name: "InternalVetAgent",
    instructions,
    model: "gpt-4o",
    tools: agentTools
  });

  const result = await runAgent(agent, message);

  return {
    runId: context.runId || "openai-run-" + Math.random().toString(36).substring(7),
    status: "completed",
    message: result.finalOutput || "Staff agent execution complete.",
    taskIds: [],
    approvalIds: [],
    events: []
  };
}
