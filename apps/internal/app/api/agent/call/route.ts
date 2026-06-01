import { dbError } from "../../_shared";
import { readPublicAgentBody } from "../_auth";
import { executeVetAgentWorkflow } from "../_runner";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await readPublicAgentBody(request, "call");
    if ("response" in parsed) return parsed.response;
    return executeVetAgentWorkflow({ agent: "external", routeIntent: "call", input: parsed.body, request });
  } catch (error) {
    return dbError(error, { route: "agent.call" });
  }
}
