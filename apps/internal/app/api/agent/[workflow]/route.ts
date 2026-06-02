import { NextResponse } from "next/server";
import { dbError } from "../../_shared";
import { requireManagerFromBody } from "../_auth";
import { readPublicAgentBody } from "../_publicAgentGuard";
import { executeVetAgentWorkflow, getAgentWorkflowRoute } from "../_runner";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ workflow: string }> }
) {
  const { workflow } = await context.params;
  const route = getAgentWorkflowRoute(workflow);
  if (!route) return NextResponse.json({ error: "Agent workflow not found." }, { status: 404 });

  try {
    if (route.auth === "manager") {
      const auth = await requireManagerFromBody(request);
      if ("response" in auth) return auth.response;
      return executeVetAgentWorkflow({
        agent: route.agent,
        routeIntent: route.routeIntent,
        input: auth.body,
        actor: auth.actor,
        request
      });
    }

    const parsed = await readPublicAgentBody(request, route.routeIntent);
    if ("response" in parsed) return parsed.response;
    return executeVetAgentWorkflow({
      agent: route.agent,
      routeIntent: route.routeIntent,
      input: parsed.body,
      request
    });
  } catch (error) {
    return dbError(error, { route: `agent.${route.routeIntent}` });
  }
}
