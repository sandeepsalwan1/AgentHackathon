import { dbError } from "../../_shared";
import { requireManagerFromBody } from "../_auth";
import { executeVetAgentWorkflow } from "../_runner";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    return executeVetAgentWorkflow({ agent: "internal", routeIntent: "internal", input: auth.body, actor: auth.actor, request });
  } catch (error) {
    return dbError(error, { route: "agent.internal" });
  }
}
