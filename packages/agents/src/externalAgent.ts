import { AgentResponse, AgentContext } from "./contracts";
import { runMockAgent } from "./mockProvider";
import { tools } from "./tools";

// Instructions for the Client-Facing Agent
const instructions = `
You are the Client-Facing AI Agent for Central Veterinary Hospital. 
You assist clients who text or speak to the hospital.
Your key duties:
1. CHECK-IN: Help arriving clients check in. Match their clientName and petName, mark their appointment arrived, and tell them their wait time.
2. BOOKING: Book appointments by finding open slots and matching client/pet records.
3. PICKUP STATUS: Check if a pet is ready for pickup and tell the owner.
4. RECORDS TRANSFER: Help clients request records from previous clinics (creates human approval requests).
5. SICK PET ESCALATION: Never make a medical diagnosis or prescribe treatment. If a client reports symptoms (throwing up, vomiting, diarrhea, lethargy, pain), immediately flag it as a high-priority task for staff and explain you have notified the clinical team.

Use the provided tools to lookup clients/pets, check wait status, mark arrival, book slots, request records, or create staff tasks. Be friendly, concise, and professional.
`;

export async function runExternalAgent(
  message: string,
  context: AgentContext
): Promise<AgentResponse> {
  const isMock = process.env.MOCK_MODE === "true" || process.env.AGENT_RUNTIME === "mock";
  
  if (isMock) {
    let scenario = context.scenario || "checkin";
    const lowercaseMsg = message.toLowerCase();
    
    if (lowercaseMsg.includes("vomit") || lowercaseMsg.includes("sick") || lowercaseMsg.includes("throw up") || lowercaseMsg.includes("lethargic")) {
      scenario = "sick_pet";
    } else if (lowercaseMsg.includes("book") || lowercaseMsg.includes("schedule") || lowercaseMsg.includes("tuesday") || lowercaseMsg.includes("reschedule")) {
      scenario = "booking";
    } else if (lowercaseMsg.includes("records") || lowercaseMsg.includes("transfer")) {
      scenario = "records";
    } else if (lowercaseMsg.includes("ready") || lowercaseMsg.includes("pickup") || lowercaseMsg.includes("leave")) {
      scenario = "pickup";
    }
    
    return runMockAgent("external", scenario, message, context);
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
    name: "ExternalVetAgent",
    instructions,
    model: "gpt-4o",
    tools: agentTools
  });

  const result = await runAgent(agent, message);

  return {
    runId: context.runId || "openai-run-" + Math.random().toString(36).substring(7),
    status: "completed",
    message: result.finalOutput || "Agent execution complete.",
    taskIds: [],
    approvalIds: [],
    events: []
  };
}
